/* Administrācija: konti un apstiprināšana, lomas un tiesības, ielūgumi, audits, Security Center, iestatījumi, tulkojumi */
import { route, json, fail, now, uid, clip, text, int, oneOf, bool, parseJSON, LANGS } from "../lib/http.js";
import { MODULES, ACTIONS, clearPermCache, getSetting, putSetting, secEvent } from "../lib/core.js";
import { sha, recoveryCodes, normCode } from "../lib/crypto.js";

const STATUSES = ["pending", "active", "suspended", "archived"];
const roleRow = (env, id) => env.DB.prepare("SELECT * FROM roles WHERE id = ?").bind(id).first();
/* lietotājs drīkst piešķirt/mainīt tikai lomas, kas zemākas par viņa paša (izņemot administratoru) */
async function assertRoleControl(ctx, targetRoleId){
  if (ctx.isAdmin) return;
  const r = await roleRow(ctx.env, targetRoleId);
  if (!r) fail(400, "Unknown role");
  if (r.level >= ctx.user.level) fail(403, "You cannot assign a role at or above your own level", { code: "forbidden" });
}
const csvCell = v => { const s = v === null || v === undefined ? "" : String(v); return /[",\n;]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };

export const routes = [
  /* ---- pārskats ---- */
  route("GET", "/admin/overview", async ctx => {
    ctx.needUser();
    const { env } = ctx;
    const out = {};
    const [pending, users, invites, sec24, fail24] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'pending'"),
      env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
      env.DB.prepare("SELECT COUNT(*) AS n FROM invites WHERE revoked = 0 AND uses < max_uses AND (expires IS NULL OR expires > ?)").bind(now()),
      env.DB.prepare("SELECT COUNT(*) AS n FROM security_events WHERE at > ? AND severity IN ('HIGH','CRITICAL')").bind(now() - 864e5),
      env.DB.prepare("SELECT COUNT(*) AS n FROM security_events WHERE at > ? AND type IN ('login_failed','account_locked','mfa_invalid','stepup_failed')").bind(now() - 864e5)
    ]);
    if (await ctx.can("users", "v")) { out.pendingUsers = pending.results[0].n; out.activeUsers = users.results[0].n; }
    if (await ctx.can("invites", "v")) out.openInvites = invites.results[0].n;
    if (await ctx.can("security", "v")) { out.highEvents24h = sec24.results[0].n; out.failedLogins24h = fail24.results[0].n; }
    out.mfaSetupNeeded = ctx.user.mfaRequired && !ctx.user.mfaEnabled;
    return json(out);
  }),

  /* ---- konti ---- */
  route("GET", "/admin/users", async ctx => {
    await ctx.need("users", "v", { elevated: true });
    const st = ctx.url.searchParams.get("status");
    const sql = `SELECT u.id, u.email, u.name, u.role, u.status, u.created, u.last_login, u.mfa_enabled, u.approved_at, u.invite_code, u.profile_id, r.name AS role_name, r.level
      FROM users u LEFT JOIN roles r ON r.id = u.role WHERE u.id != 'wbmc-system' ${STATUSES.includes(st) ? "AND u.status = ?" : ""} ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.created DESC LIMIT 500`;
    const q = ctx.env.DB.prepare(sql);
    const { results } = await (STATUSES.includes(st) ? q.bind(st) : q).all();
    const showEmail = await ctx.can("users", "e");
    return json({ users: results.map(u => ({ id: u.id, email: showEmail ? u.email : null, name: u.name, role: u.role, roleName: u.role_name, level: u.level, status: u.status, created: u.created, lastLogin: u.last_login, mfa: !!u.mfa_enabled, approvedAt: u.approved_at, invite: u.invite_code, profileId: u.profile_id })) });
  }),
  route("POST", /^\/admin\/users\/(\w{6,32})$/, async (ctx, id) => {
    const { env } = ctx;
    const b = await ctx.body();
    const u = await env.DB.prepare("SELECT u.*, r.level FROM users u LEFT JOIN roles r ON r.id = u.role WHERE u.id = ?").bind(id).first();
    if (!u) fail(404, "Not found");
    if (u.id === ctx.user?.id && (b.role !== undefined || b.status !== undefined)) fail(400, "You cannot change your own role or status");
    const approving = u.status === "pending" && b.status === "active";
    await ctx.need("users", approving ? "a" : "e", { elevated: true });
    if (!ctx.isAdmin && (u.level || 0) >= ctx.user.level) fail(403, "You cannot manage this account", { code: "forbidden" });
    const changes = {};
    if (b.role !== undefined && b.role !== u.role) { await assertRoleControl(ctx, b.role); if (!(await roleRow(env, b.role))) fail(400, "Unknown role"); changes.role = b.role; }
    if (b.status !== undefined && b.status !== u.status) changes.status = oneOf(b.status, STATUSES);
    if (b.name !== undefined) changes.name = text(b.name, 40, 2, "name");
    if (b.profileId !== undefined) changes.profile_id = b.profileId ? clip(b.profileId, 32) : null;
    if (!Object.keys(changes).length) return json({ ok: true });
    const sets = Object.keys(changes).map(k => `${k} = ?`);
    const vals = Object.values(changes);
    if (approving) { sets.push("approved_by = ?", "approved_at = ?"); vals.push(ctx.user.id, now()); }
    const stmts = [env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id)];
    if (changes.status && changes.status !== "active") stmts.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id));
    await env.DB.batch(stmts);
    await ctx.audit(approving ? "user.approve" : "user.update", "user", id, { before: { role: u.role, status: u.status, name: u.name }, after: changes });
    if (changes.role) await secEvent(env, ctx, "role_changed", (changes.role === "admin" || changes.role === "leadership") ? "HIGH" : "MEDIUM", { user: u.name, from: u.role, to: changes.role });
    return json({ ok: true });
  }),
  /* vienreizējs paroles atjaunošanas kods (nodod biedram personīgi) */
  route("POST", /^\/admin\/users\/(\w{6,32})\/reset$/, async (ctx, id) => {
    await ctx.need("users", "e", { elevated: true });
    const u = await ctx.env.DB.prepare("SELECT u.id, u.name, r.level FROM users u LEFT JOIN roles r ON r.id = u.role WHERE u.id = ?").bind(id).first();
    if (!u) fail(404, "Not found");
    if (!ctx.isAdmin && (u.level || 0) >= ctx.user.level) fail(403, "Forbidden", { code: "forbidden" });
    const code = recoveryCodes(1)[0] + "-" + recoveryCodes(1)[0];
    await ctx.env.DB.prepare("INSERT INTO password_resets (code_hash, user_id, created_by, created, expires) VALUES (?, ?, ?, ?, ?)").bind(await sha(normCode(code)), id, ctx.user.id, now(), now() + 24 * 3600e3).run();
    await ctx.audit("user.reset_code", "user", id, {});
    await secEvent(ctx.env, ctx, "reset_code_issued", "HIGH", { for: u.name });
    return json({ code, expires: now() + 24 * 3600e3 });
  }),
  route("POST", /^\/admin\/users\/(\w{6,32})\/sessions\/revoke$/, async (ctx, id) => {
    await ctx.need("security", "e", { elevated: true });
    await ctx.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
    await ctx.audit("user.sessions_revoked", "user", id, {});
    return json({ ok: true });
  }),

  /* ---- MFA atslēgšanas pieprasījumi (apstiprina cits pilnvarots administrators) ---- */
  route("GET", "/admin/mfa-requests", async ctx => {
    await ctx.need("security", "a", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT m.*, u.name FROM mfa_requests m JOIN users u ON u.id = m.user_id ORDER BY m.created DESC LIMIT 50").all();
    return json({ requests: results.map(r => ({ id: r.id, userId: r.user_id, name: r.name, reason: r.reason, status: r.status, created: r.created, decidedAt: r.decided_at })) });
  }),
  route("POST", /^\/admin\/mfa-requests\/(\w+)\/(approve|deny)$/, async (ctx, id, act) => {
    const { env } = ctx;
    await ctx.need("security", "a", { elevated: true });
    if (!ctx.user.mfaEnabled) fail(403, "Your own two-factor authentication must be enabled", { code: "mfa_setup" });
    const r = await env.DB.prepare("SELECT * FROM mfa_requests WHERE id = ? AND status = 'pending'").bind(id).first();
    if (!r) fail(404, "Not found");
    if (r.user_id === ctx.user.id) fail(403, "Another administrator must approve this request", { code: "forbidden" });
    const stmts = [env.DB.prepare("UPDATE mfa_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?").bind(act === "approve" ? "approved" : "denied", ctx.user.id, now(), id)];
    if (act === "approve") stmts.push(env.DB.prepare("UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, recovery = NULL WHERE id = ?").bind(r.user_id), env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(r.user_id));
    await env.DB.batch(stmts);
    await ctx.audit("mfa.disable_" + act, "user", r.user_id, { request: id });
    await secEvent(env, ctx, "mfa_disabled", act === "approve" ? "CRITICAL" : "MEDIUM", { request: id, decision: act }, r.user_id);
    return json({ ok: true });
  }),

  /* ---- lomas un tiesības ---- */
  route("GET", "/admin/roles", async ctx => {
    ctx.needUser();
    const [roles, perms, counts] = await ctx.env.DB.batch([
      ctx.env.DB.prepare("SELECT * FROM roles ORDER BY level DESC"),
      ctx.env.DB.prepare("SELECT * FROM role_perms"),
      ctx.env.DB.prepare("SELECT role, COUNT(*) AS n FROM users WHERE status = 'active' GROUP BY role")
    ]);
    const cnt = Object.fromEntries(counts.results.map(r => [r.role, r.n]));
    const showPerms = await ctx.can("roles", "v");
    return json({ modules: MODULES, actions: ACTIONS, roles: roles.results.map(r => ({ id: r.id, name: r.name, level: r.level, mfaRequired: !!r.mfa_required, system: !!r.system, description: r.description, members: cnt[r.id] || 0,
      perms: showPerms ? (r.id === "admin" ? Object.fromEntries(MODULES.map(m => [m, ACTIONS.join("")])) : Object.fromEntries(perms.results.filter(p => p.role_id === r.id).map(p => [p.module, p.actions]))) : undefined })) });
  }),
  route("POST", "/admin/roles", async ctx => {
    await ctx.need("roles", "c", { elevated: true });
    const b = await ctx.body();
    const id = clip(b.id, 24).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (id.length < 3) fail(400, "Role id must be at least 3 letters");
    if (await roleRow(ctx.env, id)) fail(409, "Role already exists");
    const level = int(b.level, 1, 99, "level");
    if (!ctx.isAdmin && level >= ctx.user.level) fail(403, "Forbidden", { code: "forbidden" });
    await ctx.env.DB.prepare("INSERT INTO roles (id, name, level, mfa_required, system, description, created) VALUES (?, ?, ?, ?, 0, ?, ?)").bind(id, text(b.name, 40, 2, "name"), level, bool(b.mfaRequired) ? 1 : 0, clip(b.description, 200), now()).run();
    await ctx.audit("role.create", "role", id, { level });
    return json({ ok: true, id });
  }),
  route("POST", /^\/admin\/roles\/([a-z0-9_-]{2,24})$/, async (ctx, id) => {
    const { env } = ctx;
    await ctx.need("roles", "e", { elevated: true });
    if (id === "admin") fail(400, "The administrator role cannot be changed");
    const r = await roleRow(env, id); if (!r) fail(404, "Not found");
    if (!ctx.isAdmin && r.level >= ctx.user.level) fail(403, "Forbidden", { code: "forbidden" });
    const b = await ctx.body();
    const stmts = [env.DB.prepare("UPDATE roles SET name = ?, level = ?, mfa_required = ?, description = ? WHERE id = ?")
      .bind(b.name !== undefined ? text(b.name, 40, 2, "name") : r.name, b.level !== undefined ? int(b.level, 1, 99, "level") : r.level, b.mfaRequired !== undefined ? (bool(b.mfaRequired) ? 1 : 0) : r.mfa_required, b.description !== undefined ? clip(b.description, 200) : r.description, id)];
    if (b.perms && typeof b.perms === "object") {
      stmts.push(env.DB.prepare("DELETE FROM role_perms WHERE role_id = ?").bind(id));
      for (const m of MODULES) {
        const a = [...new Set(String(b.perms[m] || "").split(""))].filter(x => ACTIONS.includes(x)).join("");
        if (a) stmts.push(env.DB.prepare("INSERT INTO role_perms (role_id, module, actions) VALUES (?, ?, ?)").bind(id, m, a));
      }
    }
    await env.DB.batch(stmts);
    clearPermCache();
    await ctx.audit("role.update", "role", id, { name: b.name, level: b.level, mfaRequired: b.mfaRequired, perms: b.perms });
    await secEvent(env, ctx, "role_permissions_changed", "HIGH", { role: id });
    return json({ ok: true });
  }),
  route("DELETE", /^\/admin\/roles\/([a-z0-9_-]{2,24})$/, async (ctx, id) => {
    await ctx.need("roles", "d", { elevated: true });
    const r = await roleRow(ctx.env, id); if (!r) fail(404, "Not found");
    if (r.system) fail(400, "System roles cannot be deleted");
    const used = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").bind(id).first();
    if (used.n) fail(400, "Move the accounts with this role first");
    await ctx.env.DB.batch([ctx.env.DB.prepare("DELETE FROM role_perms WHERE role_id = ?").bind(id), ctx.env.DB.prepare("DELETE FROM roles WHERE id = ?").bind(id)]);
    clearPermCache();
    await ctx.audit("role.delete", "role", id, { name: r.name });
    return json({ ok: true });
  }),

  /* ---- ielūgumi ---- */
  route("GET", "/admin/invites", async ctx => {
    await ctx.need("invites", "v", { elevated: true });
    const [inv, log] = await ctx.env.DB.batch([
      ctx.env.DB.prepare("SELECT i.*, u.name AS by_name, r.name AS role_name FROM invites i LEFT JOIN users u ON u.id = i.created_by LEFT JOIN roles r ON r.id = i.role ORDER BY i.created DESC LIMIT 200"),
      ctx.env.DB.prepare("SELECT l.*, u.name FROM invite_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.at DESC LIMIT 300")
    ]);
    return json({ invites: inv.results.map(i => ({ code: i.code, role: i.role, roleName: i.role_name, by: i.by_name, created: i.created, expires: i.expires, maxUses: i.max_uses, uses: i.uses, revoked: !!i.revoked, note: i.note,
      state: i.revoked ? "revoked" : (i.expires && i.expires < now()) ? "expired" : (i.uses >= i.max_uses) ? "used" : "open",
      log: log.results.filter(l => l.code === i.code).map(l => ({ event: l.event, at: l.at, name: l.name })) })) });
  }),
  route("POST", "/admin/invites", async ctx => {
    await ctx.need("invites", "c", { elevated: true });
    await ctx.limit("inv:" + ctx.user.id, 20, 3600);
    const b = await ctx.body();
    const role = clip(b.role, 24) || "member";
    if (!(await roleRow(ctx.env, role))) fail(400, "Unknown role");
    await assertRoleControl(ctx, role);
    const A = "23456789ABCDEFGHJKMNPQRSTUVWXYZ", rnd = crypto.getRandomValues(new Uint8Array(12));
    let s = ""; for (let i = 0; i < 12; i++) s += A[rnd[i] % A.length];
    const code = `WBMC-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
    const days = int(b.days ?? 14, 1, 90, "days"), uses = int(b.uses ?? 1, 1, 20, "uses");
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO invites (code, role, created_by, created, max_uses, uses, expires, revoked, note) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)").bind(code, role, ctx.user.id, now(), uses, now() + days * 864e5, clip(b.note, 140)),
      ctx.env.DB.prepare("INSERT INTO invite_log (id, code, event, actor, at, ip) VALUES (?, ?, 'created', ?, ?, ?)").bind(uid(), code, ctx.user.id, now(), ctx.ip)
    ]);
    await ctx.audit("invite.create", "invite", code, { role, days, uses });
    return json({ code, role, expires: now() + days * 864e5, maxUses: uses });
  }),
  route("POST", /^\/admin\/invites\/(WBMC-[A-Z0-9-]{14}|WOLF-[A-Z0-9-]{9,14})\/revoke$/, async (ctx, code) => {
    await ctx.need("invites", "c", { elevated: true });
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE invites SET revoked = 1 WHERE code = ?").bind(code),
      ctx.env.DB.prepare("INSERT INTO invite_log (id, code, event, actor, at, ip) VALUES (?, ?, 'revoked', ?, ?, ?)").bind(uid(), code, ctx.user.id, now(), ctx.ip)
    ]);
    await ctx.audit("invite.revoke", "invite", code, {});
    return json({ ok: true });
  }),

  /* ---- audita žurnāls ---- */
  route("GET", "/admin/audit", async ctx => {
    await ctx.need("audit", "v", { elevated: true });
    const sp = ctx.url.searchParams, where = [], args = [];
    if (sp.get("q")) { where.push("(action LIKE ? OR target_id LIKE ? OR actor_name LIKE ?)"); const q = `%${clip(sp.get("q"), 60)}%`; args.push(q, q, q); }
    if (sp.get("type")) { where.push("target_type = ?"); args.push(clip(sp.get("type"), 30)); }
    if (sp.get("before")) { where.push("at < ?"); args.push(+sp.get("before") || now()); }
    const fmt = sp.get("format");
    if (fmt === "csv") await ctx.need("audit", "x", { elevated: true });
    const { results } = await ctx.env.DB.prepare(`SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY at DESC LIMIT ${fmt === "csv" ? 5000 : 200}`).bind(...args).all();
    if (fmt === "csv") {
      await ctx.audit("audit.export", "audit", null, { rows: results.length });
      const rows = [["time", "actor", "action", "target_type", "target_id", "details", "ip"], ...results.map(r => [new Date(r.at).toISOString(), r.actor_name, r.action, r.target_type, r.target_id, r.details, r.ip])];
      return new Response("﻿" + rows.map(r => r.map(csvCell).join(";")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="wbmc-audit-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
    }
    return json({ entries: results.map(r => ({ id: r.id, at: r.at, actor: r.actor_name, action: r.action, targetType: r.target_type, targetId: r.target_id, details: parseJSON(r.details, null), ip: r.ip })) });
  }),

  /* ---- Security Center: tikai faktiski dati ---- */
  route("GET", "/admin/security", async ctx => {
    await ctx.need("security", "v", { elevated: true });
    const { env } = ctx, d1 = now() - 864e5, d7 = now() - 7 * 864e5;
    const [elev, logins, fails, devices, sessions, events, ips, migr] = await env.DB.batch([
      env.DB.prepare("SELECT u.id, u.name, u.role, u.mfa_enabled, u.last_login, r.name AS role_name, r.mfa_required FROM users u JOIN roles r ON r.id = u.role WHERE u.status = 'active' AND (r.mfa_required = 1 OR r.level >= 80) ORDER BY r.level DESC"),
      env.DB.prepare("SELECT s.*, u.name FROM security_events s LEFT JOIN users u ON u.id = s.user_id WHERE s.type IN ('admin_login','login') AND s.at > ? ORDER BY s.at DESC LIMIT 40").bind(d7),
      env.DB.prepare("SELECT s.*, u.name FROM security_events s LEFT JOIN users u ON u.id = s.user_id WHERE s.type IN ('login_failed','account_locked','login_blocked','stepup_failed','invite_invalid','reset_invalid') AND s.at > ? ORDER BY s.at DESC LIMIT 60").bind(d7),
      env.DB.prepare("SELECT s.*, u.name FROM security_events s LEFT JOIN users u ON u.id = s.user_id WHERE s.type = 'new_device' AND s.at > ? ORDER BY s.at DESC LIMIT 30").bind(d7 * 0 + now() - 30 * 864e5),
      env.DB.prepare("SELECT s.token_hash, s.created, s.last_seen, s.ip, s.ua, s.mfa_at, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.kind = 'full' AND s.expires > ? ORDER BY s.last_seen DESC LIMIT 100").bind(now()),
      env.DB.prepare("SELECT s.*, u.name FROM security_events s LEFT JOIN users u ON u.id = s.user_id WHERE s.severity IN ('HIGH','CRITICAL') ORDER BY s.at DESC LIMIT 50"),
      env.DB.prepare("SELECT ip, COUNT(*) AS n FROM security_events WHERE type IN ('login_failed','rate_limit','invite_invalid') AND at > ? GROUP BY ip ORDER BY n DESC LIMIT 10").bind(d1),
      env.DB.prepare("SELECT id, applied FROM _migrations ORDER BY applied DESC LIMIT 50")
    ]);
    const ev = r => ({ at: r.at, type: r.type, severity: r.severity, name: r.name, ip: r.ip, country: r.country, ua: r.ua, details: parseJSON(r.details, null) });
    return json({
      mfa: elev.results.map(u => ({ id: u.id, name: u.name, role: u.role_name, enabled: !!u.mfa_enabled, required: !!u.mfa_required, lastLogin: u.last_login })),
      logins: logins.results.map(ev), failures: fails.results.map(ev), newDevices: devices.results.map(ev), alerts: events.results.map(ev),
      topFailingIps: ips.results, sessions: sessions.results.map(s => ({ id: s.token_hash.slice(0, 16), name: s.name, role: s.role, created: s.created, lastSeen: s.last_seen, ip: s.ip, ua: s.ua, mfa: !!s.mfa_at })),
      backup: await getSetting(env, "last_backup", null),
      webhook: !!env.SECURITY_WEBHOOK, turnstile: !!env.TURNSTILE_SECRET,
      migrations: migr.results, ids: null, vulnerabilities: null
    });
  }),
  route("POST", /^\/admin\/security\/sessions\/([0-9a-f]{16})\/revoke$/, async (ctx, sid) => {
    await ctx.need("security", "e", { elevated: true });
    await ctx.env.DB.prepare("DELETE FROM sessions WHERE substr(token_hash, 1, 16) = ?").bind(sid).run();
    await ctx.audit("session.revoke", "session", sid, {});
    await secEvent(ctx.env, ctx, "session_revoked", "MEDIUM", { by: ctx.user.name });
    return json({ ok: true });
  }),

  /* ---- iestatījumi ---- */
  route("GET", "/admin/settings", async ctx => {
    await ctx.need("settings", "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT key, value, updated FROM settings WHERE key NOT LIKE 'secret_%'").all();
    return json({ settings: Object.fromEntries(results.map(r => [r.key, { value: parseJSON(r.value, null), updated: r.updated }])) });
  }),
  route("POST", "/admin/settings", async ctx => {
    await ctx.need("settings", "e", { elevated: true });
    const b = await ctx.body();
    const ALLOWED = { qr_target: v => { const s = clip(v, 300); if (!/^\/[^\s]*$|^https:\/\/[^\s]+$/.test(s)) fail(400, "QR target must start with / or https://"); return s; }, profile_visibility: v => (v && typeof v === "object" ? v : {}), contacts: v => (v && typeof v === "object" ? v : {}) };
    for (const [k, v] of Object.entries(b)) {
      if (!ALLOWED[k]) fail(400, "Unknown setting: " + k);
      const before = await getSetting(ctx.env, k, null), val = ALLOWED[k](v);
      await putSetting(ctx.env, k, val);
      await ctx.audit("settings.update", "setting", k, { before, after: val });
    }
    return json({ ok: true });
  }),

  /* ---- tulkojumu pārrakstīšana (admin) + publiskā nolasīšana ---- */
  route("GET", /^\/i18n\/([a-z]{2})$/, async (ctx, lang) => {
    if (!LANGS.includes(lang)) fail(404, "Not found");
    const { results } = await ctx.env.DB.prepare("SELECT key, value FROM i18n_overrides WHERE lang = ?").bind(lang).all();
    return json(Object.fromEntries(results.map(r => [r.key, r.value])), 200, { "Cache-Control": "public, max-age=300" });
  }),
  route("GET", "/admin/i18n", async ctx => {
    await ctx.need("i18n", "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT o.*, u.name FROM i18n_overrides o LEFT JOIN users u ON u.id = o.updated_by ORDER BY o.updated DESC").all();
    return json({ overrides: results.map(r => ({ lang: r.lang, key: r.key, value: r.value, updated: r.updated, by: r.name })) });
  }),
  route("POST", "/admin/i18n", async ctx => {
    await ctx.need("i18n", "e", { elevated: true });
    const b = await ctx.body();
    const lang = oneOf(b.lang, LANGS), key = clip(b.key, 80);
    if (!/^[\w.@-]+$/.test(key)) fail(400, "Invalid key");
    const value = clip(b.value, 2000);
    const before = await ctx.env.DB.prepare("SELECT value FROM i18n_overrides WHERE lang = ? AND key = ?").bind(lang, key).first();
    if (value) await ctx.env.DB.prepare("INSERT INTO i18n_overrides (lang, key, value, updated, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(lang, key) DO UPDATE SET value = excluded.value, updated = excluded.updated, updated_by = excluded.updated_by").bind(lang, key, value, now(), ctx.user.id).run();
    else await ctx.env.DB.prepare("DELETE FROM i18n_overrides WHERE lang = ? AND key = ?").bind(lang, key).run();
    await ctx.audit("i18n.update", "i18n", `${lang}:${key}`, { before: before ? before.value : null, after: value || null });
    return json({ ok: true });
  })
];
