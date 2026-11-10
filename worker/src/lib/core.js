/* WBMC API — konteksts, sesijas, lomas un tiesības (RBAC), audits, drošības notikumi, ierobežojumi */
import { HttpError, fail, json, now, uid, cookies, setCookie, parseJSON, route } from "./http.js";
import { sha, token } from "./crypto.js";

/* Moduļi, kuriem piešķir tiesības. Darbības: v skatīt · c izveidot · e labot · d dzēst · a apstiprināt · x eksportēt */
export const MODULES = ["members", "memorials", "events", "places", "routes", "orders", "forum", "chat", "ideas", "merch", "partners", "ads", "gallery", "users", "invites", "roles", "audit", "security", "settings", "i18n"];
export const ACTIONS = ["v", "c", "e", "d", "a", "x"];
export const SESSION_DAYS = 30, SESSION_MAX_DAYS = 90, STEPUP_HOURS = 12;
export const COOKIE = "wbmc_s", DEVICE_COOKIE = "wbmc_d";

/* ---------- migrācijas ---------- */
let migrated = null;
export async function migrate(env, list){
  if (migrated) return migrated;
  migrated = (async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied INTEGER NOT NULL)").run();
    const { results } = await env.DB.prepare("SELECT id FROM _migrations").all();
    const done = new Set(results.map(r => r.id));
    for (const m of list) {
      if (done.has(m.id)) continue;
      const stmts = [];
      for (const sql of m.sql) {
        // ALTER TABLE … ADD COLUMN nav idempotents — pārbaudām kolonnu
        const alt = sql.match(/^\s*ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
        if (alt) {
          const { results: cols } = await env.DB.prepare(`PRAGMA table_info(${alt[1]})`).all();
          if (cols.some(c => c.name === alt[2])) continue;
        }
        stmts.push(env.DB.prepare(sql));
      }
      stmts.push(env.DB.prepare("INSERT OR IGNORE INTO _migrations (id, applied) VALUES (?, ?)").bind(m.id, now()));
      await env.DB.batch(stmts);
    }
  })().catch(e => { migrated = null; throw e; });
  return migrated;
}

/* ---------- lomu tiesību kešs (30 s) ---------- */
const permCache = new Map();
async function rolePerms(env, role){
  const c = permCache.get(role);
  if (c && c.t > now() - 30000) return c.p;
  const { results } = await env.DB.prepare("SELECT module, actions FROM role_perms WHERE role_id = ?").bind(role).all();
  const p = Object.fromEntries(results.map(r => [r.module, r.actions]));
  permCache.set(role, { t: now(), p });
  return p;
}
export const clearPermCache = () => permCache.clear();

/* ---------- sesija ---------- */
export async function loadSession(env, req){
  const tok = cookies(req)[COOKIE];
  if (!tok || !/^[0-9a-f]{64}$/.test(tok)) return null;
  const th = await sha(tok);
  const r = await env.DB.prepare(`SELECT s.token_hash, s.kind, s.mfa_at, s.last_seen, s.expires, s.created AS s_created,
      u.id, u.name, u.email, u.role, u.status, u.mfa_enabled, u.profile_id,
      r.name AS role_name, r.level, r.mfa_required
    FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN roles r ON r.id = u.role
    WHERE s.token_hash = ? AND s.expires > ?`).bind(th, now()).first();
  if (!r) return null;
  if (r.kind !== "full") return null;
  if (!r.last_seen || r.last_seen < now() - 3600e3) {
    const exp = Math.min(r.s_created + SESSION_MAX_DAYS * 864e5, now() + SESSION_DAYS * 864e5);
    await env.DB.prepare("UPDATE sessions SET last_seen = ?, expires = ? WHERE token_hash = ?").bind(now(), exp, th).run();
  }
  return {
    sid: th, id: r.id, name: r.name, email: r.email, role: r.role, roleName: r.role_name || r.role, level: r.level || 0,
    status: r.status, mfaEnabled: !!r.mfa_enabled, mfaRequired: !!r.mfa_required, mfaAt: r.mfa_at || 0, profileId: r.profile_id
  };
}
export async function createSession(ctx, userId, { kind = "full", mfa = false, ttlMs } = {}){
  const tok = token(32), th = await sha(tok), t = now();
  await ctx.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created, expires, kind, mfa_at, device, ip, ua, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(th, userId, t, t + (ttlMs || SESSION_DAYS * 864e5), kind, mfa ? t : 0, ctx.device, ctx.ip, ctx.ua.slice(0, 200), t).run();
  return { tok, th };
}
export function sessionCookie(ctx, tok){ ctx.setCookie(setCookie(COOKIE, tok, { maxAge: SESSION_DAYS * 86400, secure: ctx.secure })); }
export function clearSessionCookie(ctx){ ctx.setCookie(setCookie(COOKIE, "", { maxAge: 0, secure: ctx.secure })); }

/* ---------- konteksts ---------- */
export async function makeContext(req, env, url, execCtx){
  const ip = req.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const ck = cookies(req);
  const ctx = {
    req, env, url, method: req.method, ip, ua: req.headers.get("User-Agent") || "", secure: url.protocol === "https:",
    country: (req.cf && req.cf.country) || "", outCookies: [], params: [], user: null, perms: null,
    device: /^[0-9a-f]{32}$/.test(ck[DEVICE_COOKIE] || "") ? ck[DEVICE_COOKIE] : null,
    waitUntil: p => execCtx && execCtx.waitUntil ? execCtx.waitUntil(p) : p,
    setCookie(c){ this.outCookies.push(c); },
    _body: undefined,
    async body(){
      if (this._body !== undefined) return this._body;
      const len = +(req.headers.get("Content-Length") || 0);
      if (len > 256 * 1024) fail(413, "Request too large");
      const t = await req.text();
      if (t.length > 256 * 1024) fail(413, "Request too large");
      try { this._body = t ? JSON.parse(t) : {}; } catch (e) { fail(400, "Invalid JSON"); }
      if (!this._body || typeof this._body !== "object" || Array.isArray(this._body)) fail(400, "Invalid JSON");
      return this._body;
    }
  };
  if (!ctx.device) { ctx.device = token(16); ctx.newDevice = true; ctx.setCookie(setCookie(DEVICE_COOKIE, ctx.device, { maxAge: 400 * 86400, secure: ctx.secure, sameSite: "Lax" })); }
  ctx.user = await loadSession(env, req);
  ctx.active = !!(ctx.user && ctx.user.status === "active");
  ctx.isAdmin = !!(ctx.active && ctx.user.role === "admin");
  ctx.loadPerms = async () => { if (!ctx.perms) ctx.perms = ctx.active ? (ctx.isAdmin ? null : await rolePerms(env, ctx.user.role)) : {}; return ctx.perms; };
  ctx.can = async (module, action = "v") => {
    if (!ctx.active) return false;
    if (ctx.isAdmin) return true;
    const p = await ctx.loadPerms();
    return !!(p && p[module] && p[module].includes(action));
  };
  /* need(): servera puses tiesību pārbaude. elevated → administrācijas darbība, prasa MFA (ja lomai obligāta) un svaigu MFA apstiprinājumu */
  ctx.needUser = () => {
    if (!ctx.user) fail(401, "Login required", { code: "login" });
    if (ctx.user.status === "pending") fail(403, "Account is waiting for approval", { code: "pending" });
    if (ctx.user.status !== "active") fail(403, "Account is not active", { code: "inactive" });
    return ctx.user;
  };
  ctx.need = async (module, action = "v", { elevated = false } = {}) => {
    ctx.needUser();
    if (!(await ctx.can(module, action))) fail(403, "Forbidden", { code: "forbidden" });
    if (elevated || ctx.user.mfaRequired) {
      if (ctx.user.mfaRequired && !ctx.user.mfaEnabled) fail(403, "Two-factor authentication must be set up", { code: "mfa_setup" });
      if (elevated && ctx.user.mfaEnabled && ctx.user.mfaAt < now() - STEPUP_HOURS * 3600e3) fail(403, "Confirm with your authenticator code", { code: "mfa_stepup" });
    }
    return ctx.user;
  };
  ctx.audit = (action, targetType, targetId, details) => audit(env, ctx, action, targetType, targetId, details);
  ctx.sec = (type, severity, details, userId) => secEvent(env, ctx, type, severity, details, userId);
  ctx.limit = async (key, max, windowSec = 60) => { if (await limited(env, key, max, windowSec)) { ctx.sec("rate_limit", "LOW", { key }); fail(429, "Too many requests — try again shortly", { code: "rate" }); } };
  return ctx;
}

/* ---------- ierobežojumi ---------- */
export async function limited(env, key, max, windowSec = 60){
  const win = Math.floor(now() / (windowSec * 1000));
  const r = await env.DB.prepare("INSERT INTO rate (k, win, n) VALUES (?, ?, 1) ON CONFLICT(k, win) DO UPDATE SET n = n + 1 RETURNING n").bind(`${windowSec}:${key}`, win).first();
  return r && r.n > max;
}

/* ---------- audits un drošības notikumi ---------- */
export async function audit(env, ctx, action, targetType, targetId, details){
  try {
    await env.DB.prepare("INSERT INTO audit_log (id, at, actor, actor_name, action, target_type, target_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(uid(), now(), ctx.user ? ctx.user.id : null, ctx.user ? ctx.user.name : null, action, targetType || null, targetId ? String(targetId) : null, details ? JSON.stringify(details).slice(0, 4000) : null, ctx.ip).run();
  } catch (e) { /* audits nedrīkst apturēt darbību, bet kļūda jāredz žurnālā */ console.error("audit failed", e && e.message); }
}
const SEV = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export async function secEvent(env, ctx, type, severity = "LOW", details, userId){
  const sev = SEV.includes(severity) ? severity : "LOW";
  const uidv = userId || (ctx.user && ctx.user.id) || null;
  try {
    await env.DB.prepare("INSERT INTO security_events (id, at, type, severity, user_id, ip, ua, country, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(uid(), now(), type, sev, uidv, ctx.ip, (ctx.ua || "").slice(0, 200), ctx.country || "", details ? JSON.stringify(details).slice(0, 2000) : null).run();
  } catch (e) { console.error("security event failed", e && e.message); }
  if ((sev === "HIGH" || sev === "CRITICAL") && env.SECURITY_WEBHOOK) ctx.waitUntil(notify(env, `[WBMC ${sev}] ${type}`, { user: uidv, ip: ctx.ip, country: ctx.country, ...(details || {}) }));
}
/* drošības paziņojums uz webhook (Slack/Discord/Telegram saderīgs: text + content) */
export async function notify(env, title, details){
  if (!env.SECURITY_WEBHOOK) return;
  const lines = Object.entries(details || {}).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  const msg = `${title}\n${lines.join("\n")}`.slice(0, 1800);
  try { await fetch(env.SECURITY_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg, content: msg }) }); } catch (e) { console.error("notify failed"); }
}

/* ---------- iestatījumi ---------- */
export async function getSetting(env, key, dflt = null){ const r = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first(); return r ? parseJSON(r.value, dflt) : dflt; }
export async function putSetting(env, key, value){ await env.DB.prepare("INSERT INTO settings (key, value, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated").bind(key, JSON.stringify(value), now()).run(); }

/* publiskais lietotāja attēlojums */
export const pubUser = u => u ? ({ id: u.id, name: u.name, role: u.role, roleName: u.roleName, level: u.level, status: u.status, mfaEnabled: u.mfaEnabled, mfaRequired: u.mfaRequired, profileId: u.profileId || null }) : null;

/* ---------- maršrutētājs ---------- */
export async function dispatch(routes, ctx, path){
  for (const r of routes) {
    if (r.method !== "*" && r.method !== ctx.method && !(r.method === "GET" && ctx.method === "HEAD")) continue;
    const m = typeof r.pattern === "string" ? (r.pattern === path ? [path] : null) : path.match(r.pattern);
    if (!m) continue;
    ctx.params = m.slice(1);
    return await r.handler(ctx, ...ctx.params);
  }
  return null;
}
export { HttpError, json, fail, route };
