/* Autentifikācija: ielūgumi, pieteikšanās, MFA (TOTP + rezerves kodi), sesijas, ierīces */
import { route, json, fail, now, uid, clip, email as vEmail, text, setCookie, cookies, parseJSON } from "../lib/http.js";
import { createSession, sessionCookie, clearSessionCookie, pubUser, COOKIE, secEvent, MODULES } from "../lib/core.js";
import { hashPassword, passwordPolicy, eqConst, sha, verifyTotp, newTotpSecret, recoveryCodes, normCode, sealSecret, openSecret } from "../lib/crypto.js";

const MFA_COOKIE = "wbmc_m";
const LOCK_AFTER = 5, LOCK_MIN = 15;

async function adminExists(env){ return !!(await env.DB.prepare("SELECT 1 FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1").first()); }
const isBootstrap = (env, em) => !!(env.ADMIN_EMAIL && em === String(env.ADMIN_EMAIL).trim().toLowerCase());

async function finishLogin(ctx, u, { mfa }){
  const { env } = ctx;
  const { tok } = await createSession(ctx, u.id, { mfa });
  sessionCookie(ctx, tok);
  await env.DB.prepare("UPDATE users SET fails = 0, locked_until = 0, last_login = ? WHERE id = ?").bind(now(), u.id).run();
  // ierīču reģistrs — jauna ierīce = drošības notikums (paaugstinātām lomām → paziņojums)
  const dev = await env.DB.prepare("SELECT 1 FROM devices WHERE user_id = ? AND device = ?").bind(u.id, ctx.device).first();
  const role = await env.DB.prepare("SELECT level, mfa_required FROM roles WHERE id = ?").bind(u.role).first();
  const elevated = !!(role && (role.mfa_required || role.level >= 80));
  if (!dev) {
    await env.DB.prepare("INSERT INTO devices (user_id, device, first_seen, last_seen, ua, ip) VALUES (?, ?, ?, ?, ?, ?)").bind(u.id, ctx.device, now(), now(), ctx.ua.slice(0, 200), ctx.ip).run();
    const known = await env.DB.prepare("SELECT COUNT(*) AS n FROM devices WHERE user_id = ?").bind(u.id).first();
    if (known.n > 1) await secEvent(env, ctx, "new_device", elevated ? "HIGH" : "MEDIUM", { name: u.name }, u.id);
  } else await env.DB.prepare("UPDATE devices SET last_seen = ?, ip = ? WHERE user_id = ? AND device = ?").bind(now(), ctx.ip, u.id, ctx.device).run();
  await secEvent(env, ctx, elevated ? "admin_login" : "login", elevated ? "MEDIUM" : "LOW", { name: u.name, mfa: !!mfa }, u.id);
  // reizēm iztīrām vecus ierakstus (glabāšanas termiņi — skat. privātuma politiku)
  if (Math.random() < .05) ctx.waitUntil(env.DB.batch([
    env.DB.prepare("DELETE FROM security_events WHERE at < ?").bind(now() - 90 * 864e5),
    env.DB.prepare("DELETE FROM rate WHERE win < ?").bind(Math.floor(now() / 60000) - 1440),
    env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(now())
  ]));
}

async function failedLogin(ctx, u, reason){
  const { env } = ctx;
  if (u) {
    const fails = (u.fails || 0) + 1;
    const lock = fails >= LOCK_AFTER ? now() + LOCK_MIN * 60000 : 0;
    await env.DB.prepare("UPDATE users SET fails = ?, locked_until = ? WHERE id = ?").bind(lock ? 0 : fails, lock || u.locked_until || 0, u.id).run();
    await secEvent(env, ctx, lock ? "account_locked" : "login_failed", lock ? "HIGH" : (u.role === "admin" || u.role === "leadership" ? "MEDIUM" : "LOW"), { reason, fails }, u.id);
  } else await secEvent(env, ctx, "login_failed", "LOW", { reason: "unknown_email" });
}

async function me(ctx){
  if (!ctx.user) return json({ user: null });
  const perms = {};
  if (ctx.active) for (const m of MODULES) { const a = []; for (const x of "vcedax") if (await ctx.can(m, x)) a.push(x); if (a.length) perms[m] = a.join(""); }
  return json({ user: { ...pubUser(ctx.user), email: ctx.user.email }, perms, stepupFresh: ctx.user.mfaAt > now() - 12 * 3600e3 });
}

/* Cloudflare Turnstile: ja TURNSTILE_SECRET iestatīts, reģistrācija un pieteikšanās prasa derīgu žetonu */
async function humanCheck(ctx, b){
  const secret = ctx.env.TURNSTILE_SECRET;
  if (!secret || !ctx.env.TURNSTILE_SITEKEY) return;
  const tok = clip(b.turnstile, 2048);
  if (!tok) fail(400, "Confirm that you are not a robot", { code: "bot" });
  let ok = false;
  try {
    const form = new FormData(); form.append("secret", secret); form.append("response", tok); form.append("remoteip", ctx.ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    ok = !!(await r.json()).success;
  } catch (e) { ok = false; }
  if (!ok) { await secEvent(ctx.env, ctx, "bot_blocked", "MEDIUM", {}); fail(400, "Confirm that you are not a robot", { code: "bot" }); }
}

export const routes = [
  route("GET", "/health", () => json({ ok: true, v: 2 })),
  /* publiskā klienta konfigurācija (Turnstile vietnes atslēga nav noslēpums) */
  route("GET", "/config", ctx => json({ turnstile: ctx.env.TURNSTILE_SECRET && ctx.env.TURNSTILE_SITEKEY ? ctx.env.TURNSTILE_SITEKEY : null }, 200, { "Cache-Control": "public, max-age=300" })),
  route("GET", "/me", me),

  route("POST", "/auth/register", async ctx => {
    const { env } = ctx;
    await ctx.limit("reg:" + ctx.ip, 5, 600);
    const b = await ctx.body();
    await humanCheck(ctx, b);
    const em = vEmail(b.email), name = text(b.name, 40, 2, "name"), pw = String(b.password || "");
    if (!passwordPolicy(pw)) fail(400, "Password must be at least 10 characters", { code: "weak_password" });
    if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(em).first()) fail(409, "This email is already registered", { code: "exists" });
    const code = clip(b.invite, 40).toUpperCase().replace(/\s/g, "");
    let role = "member", status = "pending", inv = null;
    const boot = isBootstrap(env, em) && !(await adminExists(env));
    if (boot) { role = "admin"; status = "active"; }
    else {
      if (!code) fail(400, "An invitation code is required", { code: "invite_required" });
      inv = await env.DB.prepare("SELECT * FROM invites WHERE code = ?").bind(code).first();
      const bad = !inv || inv.revoked || (inv.expires && inv.expires < now()) || (inv.uses || 0) >= (inv.max_uses || 1) || (inv.used_by && (inv.max_uses || 1) <= 1);
      if (bad) { await secEvent(env, ctx, "invite_invalid", "MEDIUM", { code: code.slice(0, 6) + "…" }); fail(400, "The invitation code is invalid, used or expired", { code: "invite_invalid" }); }
      role = inv.role || "member";
    }
    const id = uid(16), { hash, salt } = await hashPassword(pw);
    const stmts = [env.DB.prepare("INSERT INTO users (id, email, name, role, pass, salt, created, status, invite_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, em, name, role, hash, salt, now(), status, inv ? code : null)];
    if (inv) {
      // atomiski: palielina lietojumu skaitu tikai tad, ja vēl ir brīvi
      stmts.push(env.DB.prepare("UPDATE invites SET uses = uses + 1, used_by = COALESCE(used_by, ?) WHERE code = ? AND uses < max_uses").bind(id, code));
      stmts.push(env.DB.prepare("INSERT INTO invite_log (id, code, event, user_id, at, ip) VALUES (?, ?, 'used', ?, ?, ?)").bind(uid(), code, id, now(), ctx.ip));
    }
    await env.DB.batch(stmts);
    await ctx.audit("user.register", "user", id, { role, status, invite: inv ? code : null, bootstrap: boot });
    await secEvent(env, ctx, "register", boot ? "HIGH" : "LOW", { name, bootstrap: boot }, id);
    await finishLogin(ctx, { id, role, name }, { mfa: false });
    return json({ ok: true, status });
  }),

  route("POST", "/auth/login", async ctx => {
    const { env } = ctx;
    await ctx.limit("login:" + ctx.ip, 10, 60);
    const b = await ctx.body();
    await humanCheck(ctx, b);
    const em = clip(b.email, 120).toLowerCase(), pw = String(b.password || "").slice(0, 200);
    const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(em).first();
    if (u && u.locked_until > now()) { await secEvent(env, ctx, "login_blocked", "MEDIUM", {}, u.id); fail(429, "Too many failed attempts. Try again in 15 minutes.", { code: "locked" }); }
    const { hash } = await hashPassword(pw, u ? u.salt : "00000000000000000000000000000000");
    if (!u || !eqConst(hash, u.pass)) { await failedLogin(ctx, u, "password"); fail(401, "Wrong email or password", { code: "credentials" }); }
    if (u.status === "suspended" || u.status === "archived") { await secEvent(env, ctx, "login_inactive", "MEDIUM", {}, u.id); fail(403, "This account is not active", { code: "inactive" }); }
    // pirmā administratora palaišana: ADMIN_EMAIL konts kļūst par administratoru, ja tāda vēl nav
    if (isBootstrap(env, em) && u.role !== "admin" && !(await adminExists(env))) {
      await env.DB.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?").bind(u.id).run();
      u.role = "admin"; u.status = "active";
      await ctx.audit("user.bootstrap_admin", "user", u.id, {});
      await secEvent(env, ctx, "bootstrap_admin", "HIGH", { name: u.name }, u.id);
    }
    if (u.mfa_enabled) {
      const { tok } = await createSession(ctx, u.id, { kind: "mfa", ttlMs: 5 * 60000 });
      ctx.setCookie(setCookie(MFA_COOKIE, tok, { maxAge: 300, secure: ctx.secure }));
      return json({ mfa: true });
    }
    await finishLogin(ctx, u, { mfa: false });
    return json({ ok: true, status: u.status });
  }),

  route("POST", "/auth/mfa", async ctx => {
    const { env } = ctx;
    await ctx.limit("mfa:" + ctx.ip, 8, 60);
    const tok = cookies(ctx.req)[MFA_COOKIE];
    if (!tok || !/^[0-9a-f]{64}$/.test(tok)) fail(401, "Session expired — sign in again", { code: "mfa_expired" });
    const th = await sha(tok);
    const s = await env.DB.prepare("SELECT s.*, u.mfa_secret, u.mfa_last, u.recovery, u.id AS uid, u.name, u.role, u.status, u.fails, u.locked_until FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.kind = 'mfa' AND s.expires > ?").bind(th, now()).first();
    if (!s) fail(401, "Session expired — sign in again", { code: "mfa_expired" });
    if (s.locked_until > now()) fail(429, "Too many failed attempts. Try again in 15 minutes.", { code: "locked" });
    const b = await ctx.body();
    let ok = false;
    if (b.recovery) {
      const list = parseJSON(s.recovery, []), h = await sha(normCode(b.recovery));
      const i = list.indexOf(h);
      if (i >= 0) { list.splice(i, 1); await env.DB.prepare("UPDATE users SET recovery = ? WHERE id = ?").bind(JSON.stringify(list), s.uid).run(); ok = true; await secEvent(env, ctx, "mfa_recovery_used", "HIGH", { left: list.length }, s.uid); }
    } else {
      const ctr = await verifyTotp(await openSecret(env, s.mfa_secret), b.code, s.mfa_last || 0);
      if (ctr) { ok = true; await env.DB.prepare("UPDATE users SET mfa_last = ? WHERE id = ?").bind(ctr, s.uid).run(); }
    }
    if (!ok) { await failedLogin(ctx, { id: s.uid, fails: s.fails, locked_until: s.locked_until, role: s.role }, "mfa"); fail(401, "Invalid code", { code: "mfa_invalid" }); }
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(th).run();
    ctx.setCookie(setCookie(MFA_COOKIE, "", { maxAge: 0, secure: ctx.secure }));
    await finishLogin(ctx, { id: s.uid, role: s.role, name: s.name }, { mfa: true });
    return json({ ok: true, status: s.status });
  }),

  route("POST", "/auth/logout", async ctx => {
    const tok = cookies(ctx.req)[COOKIE];
    if (tok && /^[0-9a-f]{64}$/.test(tok)) await ctx.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(tok)).run();
    clearSessionCookie(ctx);
    return json({ ok: true });
  }),

  /* step-up: svaigs MFA apstiprinājums administrācijas darbībām */
  route("POST", "/auth/stepup", async ctx => {
    const { env } = ctx;
    if (!ctx.user) fail(401, "Login required", { code: "login" });
    await ctx.limit("stepup:" + ctx.user.id, 6, 60);
    const u = await env.DB.prepare("SELECT mfa_secret, mfa_last, mfa_enabled FROM users WHERE id = ?").bind(ctx.user.id).first();
    if (!u.mfa_enabled) fail(400, "Two-factor authentication is not set up", { code: "mfa_setup" });
    const ctr = await verifyTotp(await openSecret(env, u.mfa_secret), (await ctx.body()).code, u.mfa_last || 0);
    if (!ctr) { await secEvent(env, ctx, "stepup_failed", "MEDIUM", {}); fail(401, "Invalid code", { code: "mfa_invalid" }); }
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET mfa_last = ? WHERE id = ?").bind(ctr, ctx.user.id),
      env.DB.prepare("UPDATE sessions SET mfa_at = ? WHERE token_hash = ?").bind(now(), ctx.user.sid)
    ]);
    return json({ ok: true });
  }),

  /* MFA iestatīšana */
  route("POST", "/me/mfa/setup", async ctx => {
    if (!ctx.user) fail(401, "Login required", { code: "login" });
    const u = await ctx.env.DB.prepare("SELECT mfa_enabled, email FROM users WHERE id = ?").bind(ctx.user.id).first();
    if (u.mfa_enabled) fail(400, "Two-factor authentication is already enabled", { code: "mfa_on" });
    const secret = newTotpSecret();
    await ctx.env.DB.prepare("UPDATE users SET mfa_pending = ? WHERE id = ?").bind(await sealSecret(ctx.env, secret), ctx.user.id).run();
    const label = encodeURIComponent(`WBMC:${u.email}`);
    return json({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=WBMC&algorithm=SHA1&digits=6&period=30` });
  }),
  route("POST", "/me/mfa/enable", async ctx => {
    const { env } = ctx;
    if (!ctx.user) fail(401, "Login required", { code: "login" });
    await ctx.limit("mfaen:" + ctx.user.id, 6, 60);
    const u = await env.DB.prepare("SELECT mfa_pending, mfa_enabled FROM users WHERE id = ?").bind(ctx.user.id).first();
    if (u.mfa_enabled) fail(400, "Already enabled", { code: "mfa_on" });
    if (!u.mfa_pending) fail(400, "Start the setup first", { code: "mfa_nosetup" });
    const ctr = await verifyTotp(await openSecret(env, u.mfa_pending), (await ctx.body()).code, 0);
    if (!ctr) fail(401, "Invalid code — check the time on your phone", { code: "mfa_invalid" });
    const codes = recoveryCodes(10), hashes = await Promise.all(codes.map(c => sha(normCode(c))));
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET mfa_secret = mfa_pending, mfa_pending = NULL, mfa_enabled = 1, mfa_last = ?, recovery = ? WHERE id = ?").bind(ctr, JSON.stringify(hashes), ctx.user.id),
      env.DB.prepare("UPDATE sessions SET mfa_at = ? WHERE token_hash = ?").bind(now(), ctx.user.sid)
    ]);
    await ctx.audit("mfa.enable", "user", ctx.user.id, {});
    await secEvent(env, ctx, "mfa_enabled", "MEDIUM", {});
    return json({ ok: true, recovery: codes });
  }),
  route("POST", "/me/mfa/recovery", async ctx => {
    const { env } = ctx;
    if (!ctx.user) fail(401, "Login required", { code: "login" });
    const u = await env.DB.prepare("SELECT mfa_secret, mfa_last, mfa_enabled FROM users WHERE id = ?").bind(ctx.user.id).first();
    if (!u.mfa_enabled) fail(400, "Two-factor authentication is not set up", { code: "mfa_setup" });
    const ctr = await verifyTotp(await openSecret(env, u.mfa_secret), (await ctx.body()).code, u.mfa_last || 0);
    if (!ctr) fail(401, "Invalid code", { code: "mfa_invalid" });
    const codes = recoveryCodes(10), hashes = await Promise.all(codes.map(c => sha(normCode(c))));
    await env.DB.prepare("UPDATE users SET recovery = ?, mfa_last = ? WHERE id = ?").bind(JSON.stringify(hashes), ctr, ctx.user.id).run();
    await secEvent(env, ctx, "mfa_recovery_regenerated", "MEDIUM", {});
    return json({ ok: true, recovery: codes });
  }),
  /* MFA atslēgšana: tikai ar pilnvarota administratora apstiprinājumu (11. sadaļa) */
  route("POST", "/me/mfa/disable-request", async ctx => {
    const { env } = ctx;
    if (!ctx.user) fail(401, "Login required", { code: "login" });
    const b = await ctx.body();
    const u = await env.DB.prepare("SELECT mfa_secret, mfa_last, mfa_enabled FROM users WHERE id = ?").bind(ctx.user.id).first();
    if (!u.mfa_enabled) fail(400, "Two-factor authentication is not enabled");
    const ctr = await verifyTotp(await openSecret(env, u.mfa_secret), b.code, u.mfa_last || 0);
    if (!ctr) fail(401, "Invalid code", { code: "mfa_invalid" });
    const id = uid();
    await env.DB.prepare("INSERT INTO mfa_requests (id, user_id, reason, status, created) VALUES (?, ?, ?, 'pending', ?)").bind(id, ctx.user.id, clip(b.reason, 300), now()).run();
    await secEvent(env, ctx, "mfa_disable_requested", "HIGH", { reason: clip(b.reason, 120) });
    return json({ ok: true, id });
  }),

  /* sesijas un ierīces */
  route("GET", "/me/sessions", async ctx => {
    ctx.needUser();
    const { results } = await ctx.env.DB.prepare("SELECT token_hash, created, last_seen, ip, ua, mfa_at FROM sessions WHERE user_id = ? AND kind = 'full' AND expires > ? ORDER BY last_seen DESC").bind(ctx.user.id, now()).all();
    return json({ sessions: results.map(r => ({ id: r.token_hash.slice(0, 16), current: r.token_hash === ctx.user.sid, created: r.created, lastSeen: r.last_seen, ip: r.ip, ua: r.ua, mfa: !!r.mfa_at })) });
  }),
  route("POST", /^\/me\/sessions\/([0-9a-f]{16})\/revoke$/, async (ctx, sid) => {
    if (!ctx.user) fail(401, "Login required");
    await ctx.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND substr(token_hash, 1, 16) = ?").bind(ctx.user.id, sid).run();
    await secEvent(ctx.env, ctx, "session_revoked", "LOW", { self: true });
    return json({ ok: true });
  }),
  route("POST", "/me/sessions/revoke-others", async ctx => {
    if (!ctx.user) fail(401, "Login required");
    await ctx.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(ctx.user.id, ctx.user.sid).run();
    await secEvent(ctx.env, ctx, "sessions_revoked_all", "MEDIUM", {});
    return json({ ok: true });
  }),
  route("POST", "/me/password", async ctx => {
    const { env } = ctx;
    if (!ctx.user) fail(401, "Login required");
    await ctx.limit("pw:" + ctx.user.id, 5, 600);
    const b = await ctx.body();
    const u = await env.DB.prepare("SELECT pass, salt FROM users WHERE id = ?").bind(ctx.user.id).first();
    const { hash } = await hashPassword(String(b.current || ""), u.salt);
    if (!eqConst(hash, u.pass)) { await secEvent(env, ctx, "password_change_failed", "MEDIUM", {}); fail(401, "Current password is wrong", { code: "credentials" }); }
    if (!passwordPolicy(String(b.next || ""))) fail(400, "Password must be at least 10 characters", { code: "weak_password" });
    const n = await hashPassword(String(b.next));
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET pass = ?, salt = ? WHERE id = ?").bind(n.hash, n.salt, ctx.user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(ctx.user.id, ctx.user.sid)
    ]);
    await secEvent(env, ctx, "password_changed", "MEDIUM", {});
    return json({ ok: true });
  }),
  /* paroles atjaunošana ar administratora izsniegtu vienreizēju kodu (e-pasta sūtīšana netiek izmantota) */
  route("POST", "/auth/reset", async ctx => {
    const { env } = ctx;
    await ctx.limit("reset:" + ctx.ip, 5, 600);
    const b = await ctx.body();
    const h = await sha(normCode(b.code));
    const r = await env.DB.prepare("SELECT * FROM password_resets WHERE code_hash = ? AND used = 0 AND expires > ?").bind(h, now()).first();
    if (!r) { await secEvent(env, ctx, "reset_invalid", "MEDIUM", {}); fail(400, "The reset code is invalid or expired", { code: "reset_invalid" }); }
    if (!passwordPolicy(String(b.password || ""))) fail(400, "Password must be at least 10 characters", { code: "weak_password" });
    const n = await hashPassword(String(b.password));
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET pass = ?, salt = ?, fails = 0, locked_until = 0 WHERE id = ?").bind(n.hash, n.salt, r.user_id),
      env.DB.prepare("UPDATE password_resets SET used = 1 WHERE code_hash = ?").bind(h),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(r.user_id)
    ]);
    await secEvent(env, ctx, "password_reset", "HIGH", {}, r.user_id);
    return json({ ok: true });
  })
];
