/* Kodola migrācijas — tikai papildinošas (nekas netiek dzēsts). Izpilda Worker, reģistrē tabulā _migrations. */
const BASE = [
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', pass TEXT NOT NULL, salt TEXT NOT NULL, created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)",
  "CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, role TEXT NOT NULL, created_by TEXT, used_by TEXT, created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, cat TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, created INTEGER NOT NULL, last_at INTEGER NOT NULL, solved INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0)",
  "CREATE INDEX IF NOT EXISTS threads_cat ON threads(cat, last_at DESC)",
  "CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, thread TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS posts_thread ON posts(thread, created)",
  "CREATE TABLE IF NOT EXISTS likes (post TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY (post, user))",
  "CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS messages_room ON messages(room, created DESC)",
  "CREATE TABLE IF NOT EXISTS sos (id TEXT PRIMARY KEY, kind TEXT NOT NULL, note TEXT, phone TEXT, lat REAL NOT NULL, lon REAL NOT NULL, author TEXT NOT NULL, created INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS sos_resp (sos TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY (sos, user))",
  "CREATE TABLE IF NOT EXISTS hazards (id TEXT PRIMARY KEY, kind TEXT NOT NULL, note TEXT, lat REAL NOT NULL, lon REAL NOT NULL, by_user TEXT NOT NULL, created INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS hazards_created ON hazards(created DESC)",
  "CREATE TABLE IF NOT EXISTS helpers (user_id TEXT PRIMARY KEY, city TEXT, offers TEXT, note TEXT, contact TEXT, lat REAL, lon REAL, updated INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS rate (k TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, win))",
  "CREATE TABLE IF NOT EXISTS chess_games (id TEXT PRIMARY KEY, white TEXT, black TEXT, creator TEXT NOT NULL, tc_base INTEGER NOT NULL, tc_inc INTEGER NOT NULL, rated INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL, result TEXT, reason TEXT, moves TEXT, created INTEGER NOT NULL, ended INTEGER, w_elo INTEGER, b_elo INTEGER, w_diff INTEGER, b_diff INTEGER)",
  "CREATE INDEX IF NOT EXISTS chess_status ON chess_games(status, created DESC)",
  "CREATE TABLE IF NOT EXISTS chess_ratings (user_id TEXT PRIMARY KEY, elo INTEGER NOT NULL DEFAULT 1200, best INTEGER NOT NULL DEFAULT 1200, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, updated INTEGER)"
];

/* Noklusējuma lomas — klubs tās maina admin panelī (16. sadaļa, 1. lēmums) */
const ROLES = [
  ["admin", "Administrators", 100, 1],
  ["leadership", "Kluba vadība", 80, 1],
  ["member", "Member", 50, 0],
  ["prospect", "Prospect", 30, 0],
  ["hangaround", "Hang-around", 20, 0],
  ["supporter", "Atbalstītājs", 10, 0]
];
const PERMS = {
  leadership: { members: "vceax", memorials: "vcea", events: "vcedax", places: "vced", routes: "vced", orders: "vced", forum: "vcdea", chat: "vcd", ideas: "vcea", merch: "vce", partners: "vce", ads: "v", gallery: "vced", users: "va", invites: "vc", audit: "v", security: "v" },
  member: { members: "v", memorials: "vc", events: "vc", places: "v", routes: "vc", orders: "v", forum: "vc", chat: "vc", ideas: "vc", gallery: "vc" },
  prospect: { members: "v", events: "v", orders: "v", forum: "vc", chat: "vc", ideas: "v", routes: "vc" },
  hangaround: { events: "v", forum: "v", chat: "vc" },
  supporter: { events: "v" }
};
const q = s => `'${String(s).replace(/'/g, "''")}'`;

export const CORE_MIGRATIONS = [
  { id: "core-000-base", sql: BASE },
  { id: "core-001-security", sql: [
    "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN mfa_secret TEXT",
    "ALTER TABLE users ADD COLUMN mfa_pending TEXT",
    "ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN mfa_last INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN recovery TEXT",
    "ALTER TABLE users ADD COLUMN fails INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN last_login INTEGER",
    "ALTER TABLE users ADD COLUMN approved_by TEXT",
    "ALTER TABLE users ADD COLUMN approved_at INTEGER",
    "ALTER TABLE users ADD COLUMN profile_id TEXT",
    "ALTER TABLE users ADD COLUMN invite_code TEXT",
    "ALTER TABLE sessions ADD COLUMN kind TEXT",
    "ALTER TABLE sessions ADD COLUMN mfa_at INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE sessions ADD COLUMN device TEXT",
    "ALTER TABLE sessions ADD COLUMN ip TEXT",
    "ALTER TABLE sessions ADD COLUMN ua TEXT",
    "ALTER TABLE sessions ADD COLUMN last_seen INTEGER",
    "ALTER TABLE invites ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE invites ADD COLUMN uses INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE invites ADD COLUMN expires INTEGER",
    "ALTER TABLE invites ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE invites ADD COLUMN note TEXT",
    "CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, level INTEGER NOT NULL, mfa_required INTEGER NOT NULL DEFAULT 0, system INTEGER NOT NULL DEFAULT 0, description TEXT, created INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS role_perms (role_id TEXT NOT NULL, module TEXT NOT NULL, actions TEXT NOT NULL, PRIMARY KEY (role_id, module))",
    "CREATE TABLE IF NOT EXISTS invite_log (id TEXT PRIMARY KEY, code TEXT NOT NULL, event TEXT NOT NULL, user_id TEXT, actor TEXT, at INTEGER NOT NULL, ip TEXT)",
    "CREATE INDEX IF NOT EXISTS invite_log_code ON invite_log(code, at)",
    "CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, at INTEGER NOT NULL, actor TEXT, actor_name TEXT, action TEXT NOT NULL, target_type TEXT, target_id TEXT, details TEXT, ip TEXT)",
    "CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at DESC)",
    "CREATE INDEX IF NOT EXISTS audit_target ON audit_log(target_type, target_id)",
    "CREATE TABLE IF NOT EXISTS security_events (id TEXT PRIMARY KEY, at INTEGER NOT NULL, type TEXT NOT NULL, severity TEXT NOT NULL, user_id TEXT, ip TEXT, ua TEXT, country TEXT, details TEXT)",
    "CREATE INDEX IF NOT EXISTS sec_at ON security_events(at DESC)",
    "CREATE INDEX IF NOT EXISTS sec_type ON security_events(type, at DESC)",
    "CREATE TABLE IF NOT EXISTS devices (user_id TEXT NOT NULL, device TEXT NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, ua TEXT, ip TEXT, PRIMARY KEY (user_id, device))",
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated INTEGER)",
    "CREATE TABLE IF NOT EXISTS password_resets (code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_by TEXT, created INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS mfa_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, reason TEXT, status TEXT NOT NULL, created INTEGER NOT NULL, decided_by TEXT, decided_at INTEGER)",
    "CREATE TABLE IF NOT EXISTS i18n_overrides (lang TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated INTEGER NOT NULL, updated_by TEXT, PRIMARY KEY (lang, key))",
    "CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, owner TEXT, ctx_type TEXT NOT NULL, ctx_id TEXT, mime TEXT NOT NULL, size INTEGER NOT NULL, name TEXT, public INTEGER NOT NULL DEFAULT 0, data BLOB NOT NULL, created INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS files_ctx ON files(ctx_type, ctx_id)"
  ] },
  { id: "core-002-roles", sql: [
    ...ROLES.map(([id, name, level, mfa]) => `INSERT OR IGNORE INTO roles (id, name, level, mfa_required, system, created) VALUES (${q(id)}, ${q(name)}, ${level}, ${mfa}, ${id === "admin" ? 1 : 0}, 1791900000000)`),
    ...Object.entries(PERMS).flatMap(([role, mods]) => Object.entries(mods).map(([m, a]) => `INSERT OR IGNORE INTO role_perms (role_id, module, actions) VALUES (${q(role)}, ${q(m)}, ${q(a)})`)),
    // esošās lomas → jaunā struktūra: 'rider' konti gaida apstiprinājumu, 'officer' → kluba vadība
    "UPDATE users SET status = 'pending', role = 'member' WHERE role = 'rider'",
    "UPDATE users SET role = 'leadership' WHERE role = 'officer'",
    "UPDATE invites SET role = 'leadership' WHERE role = 'officer'",
    "UPDATE users SET status = 'archived', name = 'WBMC' WHERE id = 'wbmc-system'",
    // vecās bearer sesijas vairs nav derīgas (pāreja uz HttpOnly sīkdatni)
    "DELETE FROM sessions WHERE kind IS NULL"
  ] }
];
