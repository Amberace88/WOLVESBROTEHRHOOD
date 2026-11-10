/* Modulis: comms — „Saziņa”: kanāli pēc pakāpes, grupas, privātās sarunas, norīkojumi ar vēsturi, idejas, videozvanu saites.
   Piekļuve vienmēr tiek pārbaudīta servera pusē (katram pieprasījumam, failam un WebSocket savienojumam).
   Reāllaika piegāde: Durable Object „Room” ar nosaukumu "chat:<istabas id>" (worker/src/rooms/chat.js). */
import { route, json, fail, now, uid, clip, text, int, oneOf, bool, parseJSON, ml, slug } from "../lib/http.js";
import { registerFileUpload, registerFileAccess } from "./files.js";

export const EDIT_WINDOW_MS = 15 * 60e3;
const BODY_MAX = 4000, ORDER_MAX = 8000, IDEA_MAX = 4000, COMMENT_MAX = 2000, GROUP_MAX = 50;
const TOPICS = ["general", "closed", "tech", "routes", "rhr", "other"];
const IDEA_TOPICS = ["idea", "plan", "suggestion", "visit"];
const IDEA_STATUS = ["new", "reviewed", "approved", "archived"];
const ORDER_STATUS = ["active", "archived"];
const ROOM_ID = "([a-z0-9-]{2,40})", MSG_ID = "([0-9a-z-]{6,40})";

/* ---------- sākuma kanāli (16. sadaļa: klubs var mainīt admin panelī) ---------- */
const SEED = [
  // id, topic, min_level, sort, name {lv,en}, description {lv,en}
  ["general", "general", 20, 10, { lv: "Vispārējais kluba čats", en: "General club chat" }, { lv: "Kluba ikdiena, jautājumi un ziņas visiem kluba kontiem.", en: "Everyday club talk, questions and news for all club accounts." }],
  ["closed", "closed", 50, 20, { lv: "Slēgtais čats", en: "Closed chat" }, { lv: "Tikai no pakāpes Member un augstāk.", en: "Member rank and above only." }],
  ["vadiba", "closed", 80, 30, { lv: "Kluba vadība", en: "Club leadership" }, { lv: "Kluba vadības sarunas.", en: "Club leadership conversations." }],
  ["tech", "tech", 20, 40, { lv: "Tehnika un serviss", en: "Tech and service" }, { lv: "Remonts, apkope, rezerves daļas, ekipējums un labi servisi.", en: "Repairs, maintenance, parts, gear and good workshops." }],
  ["routes", "routes", 20, 50, { lv: "Maršruti un braucieni", en: "Routes and rides" }, { lv: "Kas, kur, kad brauc. Ceļi, segumi, nakšņošana.", en: "Who rides where and when. Roads, surfaces, overnight stops." }],
  ["rhr", "rhr", 20, 60, { lv: "Riders Help Riders", en: "Riders Help Riders" }, { lv: "Palīdzība uz ceļa: SOS dēlis, palīdzības punkti un saruna.", en: "Help on the road: SOS board, helper network and discussion." }]
];
const q = s => `'${String(s).replace(/'/g, "''")}'`;
/* vecā foruma kategorijas → kanāli */
const CAT_ROOM = "CASE t.cat WHEN 'tech' THEN 'tech' WHEN 'gear' THEN 'tech' WHEN 'routes' THEN 'routes' WHEN 'roadhelp' THEN 'rhr' ELSE 'general' END";

export const migrations = [
  { id: "comms-001-rooms", sql: [
    "CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, kind TEXT NOT NULL, slug TEXT UNIQUE, name TEXT, description TEXT, min_level INTEGER NOT NULL DEFAULT 20, topic TEXT NOT NULL DEFAULT 'general', created_by TEXT, created INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0, video_room TEXT, sort INTEGER NOT NULL DEFAULT 50)",
    "CREATE TABLE IF NOT EXISTS room_members (room TEXT NOT NULL, user TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined INTEGER NOT NULL, muted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (room, user))",
    "CREATE INDEX IF NOT EXISTS room_members_user ON room_members(user)",
    "CREATE TABLE IF NOT EXISTS chat_reads (user TEXT NOT NULL, room TEXT NOT NULL, last_read_at INTEGER NOT NULL DEFAULT 0, muted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user, room))",
    "ALTER TABLE messages ADD COLUMN reply_to TEXT",
    "ALTER TABLE messages ADD COLUMN edited_at INTEGER",
    "ALTER TABLE messages ADD COLUMN deleted_at INTEGER",
    "ALTER TABLE messages ADD COLUMN deleted_by TEXT",
    "ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'",
    "ALTER TABLE messages ADD COLUMN file_id TEXT",
    "ALTER TABLE messages ADD COLUMN meta TEXT",
    "CREATE INDEX IF NOT EXISTS messages_file ON messages(file_id)",
    ...SEED.map(([id, topic, lvl, sort, name, desc]) => `INSERT OR IGNORE INTO rooms (id, kind, slug, name, description, min_level, topic, created_by, created, archived, sort) VALUES (${q(id)}, 'channel', ${q(id)}, ${q(JSON.stringify(name))}, ${q(JSON.stringify(desc))}, ${lvl}, ${q(topic)}, NULL, 1791900000000, 0, ${sort})`),
    // vecās čata istabas → jaunie kanāli (dati saglabājas)
    "UPDATE messages SET room = 'general' WHERE room = 'club'",
    "UPDATE messages SET room = 'routes' WHERE room = 'rides'",
    "UPDATE messages SET room = 'vadiba' WHERE room = 'officers'",
    // vecā publiskā foruma lietotāju tēmas → kanālu ziņas (pirmais ieraksts ar tēmas virsrakstu, atbildes kā atbildes uz to).
    // Oriģinālās tabulas threads/posts paliek neskartas. Sistēmas sākuma tēmas (publiskā foruma ievads) netiek pārnestas.
    `INSERT OR IGNORE INTO messages (id, room, author, body, created, kind, meta)
       SELECT 'fp-' || p.id, ${CAT_ROOM}, p.author, p.body, p.created, 'text', json_object('thread', t.id, 'title', t.title, 'solved', t.solved)
       FROM posts p JOIN threads t ON t.id = p.thread
       WHERE t.author != 'wbmc-system' AND p.id = (SELECT p2.id FROM posts p2 WHERE p2.thread = t.id ORDER BY p2.created, p2.id LIMIT 1)`,
    `INSERT OR IGNORE INTO messages (id, room, author, body, created, kind, meta, reply_to)
       SELECT 'fp-' || p.id, ${CAT_ROOM}, p.author, p.body, p.created, 'text', json_object('thread', t.id),
         'fp-' || (SELECT p2.id FROM posts p2 WHERE p2.thread = t.id ORDER BY p2.created, p2.id LIMIT 1)
       FROM posts p JOIN threads t ON t.id = p.thread
       WHERE t.author != 'wbmc-system' AND p.id != (SELECT p2.id FROM posts p2 WHERE p2.thread = t.id ORDER BY p2.created, p2.id LIMIT 1)`
  ] },
  { id: "comms-002-orders-ideas", sql: [
    "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, audience_min_level INTEGER NOT NULL DEFAULT 50, status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, updated_by TEXT)",
    "CREATE INDEX IF NOT EXISTS orders_updated ON orders(status, updated DESC)",
    "CREATE TABLE IF NOT EXISTS order_history (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, at INTEGER NOT NULL, by TEXT, before TEXT, after TEXT)",
    "CREATE INDEX IF NOT EXISTS order_history_order ON order_history(order_id, at)",
    "CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, topic TEXT NOT NULL DEFAULT 'idea', status TEXT NOT NULL DEFAULT 'new', author TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, status_by TEXT, status_at INTEGER)",
    "CREATE INDEX IF NOT EXISTS ideas_updated ON ideas(status, updated DESC)",
    "CREATE TABLE IF NOT EXISTS idea_comments (id TEXT PRIMARY KEY, idea TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'comment', created INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idea_comments_idea ON idea_comments(idea, created)"
  ] },
  /* noklusējuma tiesības: kluba vadība pārvalda kanālus (chat:e). Mainām tikai, ja klubs vēl nav mainījis noklusējumu. */
  { id: "comms-003-perms", sql: [
    "UPDATE role_perms SET actions = 'vcde' WHERE role_id = 'leadership' AND module = 'chat' AND actions = 'vcd'",
    "INSERT OR IGNORE INTO role_perms (role_id, module, actions) VALUES ('leadership', 'chat', 'vcde')"
  ] }
];

/* ---------- piekļuve ---------- */
const lvl = ctx => ctx.isAdmin ? 100 : (ctx.user && ctx.user.level) || 0;
export const loadRoom = (env, id) => env.DB.prepare("SELECT * FROM rooms WHERE id = ?").bind(id).first();
/* vienas istabas tiesības šim lietotājam */
export async function roomAccess(ctx, room){
  const none = { read: false, post: false, mod: false, owner: false, member: false };
  if (!room || !ctx.active || !(await ctx.can("chat", "v"))) return none;
  let read = false, member = false, owner = false;
  if (room.kind === "channel") read = lvl(ctx) >= room.min_level && (!room.archived || ctx.isAdmin);
  else {
    const m = await ctx.env.DB.prepare("SELECT role FROM room_members WHERE room = ? AND user = ?").bind(room.id, ctx.user.id).first();
    read = member = !!m; owner = !!(m && m.role === "owner");
  }
  if (!read) return none;
  const post = !room.archived && await ctx.can("chat", "c");
  const mod = room.kind === "channel" && await ctx.can("chat", "d");
  return { read, post, mod, owner, member };
}
export async function canReadRoomId(ctx, id){ return (await roomAccess(ctx, await loadRoom(ctx.env, id))).read; }
/* istaba + tiesības vai kļūda (404 neeksistējošai, 403 nepieejamai) */
async function needRoom(ctx, id, what = "read"){
  ctx.needUser();
  const room = await loadRoom(ctx.env, id);
  if (!room) fail(404, "Conversation not found");
  const a = await roomAccess(ctx, room);
  if (!a.read || (what === "post" && !a.post)) fail(403, "You do not have access to this conversation", { code: "forbidden" });
  return { room, a };
}
/* SQL: istabas, ko lietotājs drīkst lasīt (bez chat:v — neviena) */
const READABLE = "SELECT r.id FROM rooms r LEFT JOIN room_members rm ON rm.room = r.id AND rm.user = ?1 WHERE (r.kind = 'channel' AND r.archived = 0 AND r.min_level <= ?2) OR rm.user IS NOT NULL";

/* failu konteksts "chat": augšupielādēt drīkst, kas drīkst rakstīt istabā; lasīt — kas drīkst lasīt istabu (dzēstu ziņu failus — nē) */
registerFileUpload("chat", async (ctx, roomId) => !!roomId && (await roomAccess(ctx, await loadRoom(ctx.env, roomId))).post);
registerFileAccess("chat", async (ctx, file) => {
  if (!file.ctx_id || !(await canReadRoomId(ctx, file.ctx_id))) return false;
  const del = await ctx.env.DB.prepare("SELECT 1 FROM messages WHERE file_id = ? AND deleted_at IS NOT NULL").bind(file.id).first();
  return !del;
});

/* ---------- reāllaika piegāde ---------- */
const stub = (env, roomId) => env.ROOMS.get(env.ROOMS.idFromName("chat:" + roomId));
export function cast(ctx, roomId, payload){
  if (!ctx.env.ROOMS) return;
  ctx.waitUntil(stub(ctx.env, roomId).fetch("https://room/chat/broadcast", { method: "POST", body: JSON.stringify(payload) }).catch(e => console.error("chat broadcast", e && e.message)));
}
function kick(ctx, roomId, userId){
  if (!ctx.env.ROOMS) return;
  ctx.waitUntil(stub(ctx.env, roomId).fetch("https://room/chat/kick", { method: "POST", body: JSON.stringify({ user: userId }) }).catch(() => {}));
}

/* ---------- ziņas ---------- */
const MSG_SEL = `SELECT m.id, m.room, m.author, m.body, m.created, m.edited_at, m.deleted_at, m.kind, m.file_id, m.meta, m.reply_to,
    u.name AS author_name, ro.name AS author_role,
    rp.author AS rp_author, rpu.name AS rp_name, rp.body AS rp_body, rp.kind AS rp_kind, rp.deleted_at AS rp_deleted,
    f.mime AS f_mime, f.size AS f_size, f.name AS f_name
  FROM messages m LEFT JOIN users u ON u.id = m.author LEFT JOIN roles ro ON ro.id = u.role
  LEFT JOIN messages rp ON rp.id = m.reply_to LEFT JOIN users rpu ON rpu.id = rp.author
  LEFT JOIN files f ON f.id = m.file_id`;
const snip = s => clip(String(s || "").replace(/\s+/g, " "), 140);
export function msgOut(r){
  const del = !!r.deleted_at;
  const meta = del ? {} : parseJSON(r.meta, {}) || {};
  return {
    id: r.id, room: r.room, author: r.author, authorName: r.author_name || "—", authorRole: r.author_role || null,
    body: del ? "" : r.body, created: r.created, editedAt: r.edited_at || null, deleted: del, kind: r.kind || "text",
    file: !del && r.file_id && r.f_mime ? { id: r.file_id, url: `/api/files/${r.file_id}`, mime: r.f_mime, size: r.f_size, name: r.f_name || "" } : null,
    meta, replyTo: r.reply_to || null,
    reply: r.reply_to && r.rp_kind ? { id: r.reply_to, author: r.rp_author, authorName: r.rp_name || "—", kind: r.rp_kind, deleted: !!r.rp_deleted, snippet: r.rp_deleted ? "" : snip(r.rp_body) } : null
  };
}
const getMsg = async (env, id) => { const r = await env.DB.prepare(MSG_SEL + " WHERE m.id = ?").bind(id).first(); return r ? msgOut(r) : null; };
/* sistēmas ziņa istabā (videozvans, dalībnieki, SOS) — teksts tiek veidots klientā pēc meta.event */
export async function postSystem(ctx, roomId, meta, body = ""){
  const id = uid(16), t = now();
  await ctx.env.DB.prepare("INSERT INTO messages (id, room, author, body, created, kind, meta) VALUES (?, ?, ?, ?, ?, 'system', ?)").bind(id, roomId, ctx.user.id, clip(body, BODY_MAX), t, JSON.stringify(meta)).run();
  const m = await getMsg(ctx.env, id);
  cast(ctx, roomId, { type: "message", message: m });
  return m;
}
const markRead = (env, user, room, at) => env.DB.prepare("INSERT INTO chat_reads (user, room, last_read_at) VALUES (?, ?, ?) ON CONFLICT(user, room) DO UPDATE SET last_read_at = MAX(last_read_at, excluded.last_read_at)").bind(user, room, at);

/* lietotāji, ar kuriem var sarakstīties (aktīvi, ar chat:v) */
const CHAT_USERS = `SELECT u.id, u.name, u.role, ro.name AS role_name, ro.level FROM users u LEFT JOIN roles ro ON ro.id = u.role
  WHERE u.status = 'active' AND u.id != 'wbmc-system' AND (u.role = 'admin' OR EXISTS (SELECT 1 FROM role_perms p WHERE p.role_id = u.role AND p.module = 'chat' AND p.actions LIKE '%v%'))`;
async function chatUsers(env, ids){
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const { results } = await env.DB.prepare(`${CHAT_USERS} AND u.id IN (${part.map(() => "?").join(",")})`).bind(...part).all();
    out.push(...results);
  }
  return out;
}
const roleForLevel = async (env, level) => { const r = await env.DB.prepare("SELECT name FROM roles WHERE level >= ? ORDER BY level ASC LIMIT 1").bind(level).first(); return r ? r.name : null; };
async function userSince(ctx){ const r = await ctx.env.DB.prepare("SELECT created, approved_at FROM users WHERE id = ?").bind(ctx.user.id).first(); return (r && (r.approved_at || r.created)) || 0; }

/* istabu saraksts ar nelasītajām un pēdējo ziņu */
async function listRooms(ctx){
  const { env } = ctx, me = ctx.user.id, since = await userSince(ctx);
  if (!(await ctx.can("chat", "v"))) return [];
  const { results } = await env.DB.prepare(`SELECT r.*, rm.role AS my_role, cr.last_read_at, cr.muted AS my_muted,
      (SELECT MAX(created) FROM messages WHERE room = r.id) AS last_at,
      (SELECT id FROM messages WHERE room = r.id ORDER BY created DESC LIMIT 1) AS last_id,
      (SELECT COUNT(*) FROM messages m WHERE m.room = r.id AND m.created > COALESCE(cr.last_read_at, ?3) AND m.author != ?1 AND m.deleted_at IS NULL) AS unread
    FROM rooms r LEFT JOIN room_members rm ON rm.room = r.id AND rm.user = ?1 LEFT JOIN chat_reads cr ON cr.room = r.id AND cr.user = ?1
    WHERE (r.kind = 'channel' AND r.archived = 0 AND r.min_level <= ?2) OR rm.user IS NOT NULL
    ORDER BY r.sort, r.created`).bind(me, lvl(ctx), since).all();
  const lastIds = results.map(r => r.last_id).filter(Boolean), last = {};
  for (let i = 0; i < lastIds.length; i += 80) {
    const part = lastIds.slice(i, i + 80);
    const { results: ms } = await env.DB.prepare(`${MSG_SEL} WHERE m.id IN (${part.map(() => "?").join(",")})`).bind(...part).all();
    for (const m of ms) last[m.room] = msgOut(m);
  }
  const priv = results.filter(r => r.kind !== "channel").map(r => r.id), members = {};
  for (let i = 0; i < priv.length; i += 80) {
    const part = priv.slice(i, i + 80);
    const { results: ms } = await env.DB.prepare(`SELECT rm.room, rm.user, rm.role, u.name, ro.name AS role_name, u.status FROM room_members rm JOIN users u ON u.id = rm.user LEFT JOIN roles ro ON ro.id = u.role WHERE rm.room IN (${part.map(() => "?").join(",")}) ORDER BY rm.joined`).bind(...part).all();
    for (const m of ms) (members[m.room] = members[m.room] || []).push({ id: m.user, name: m.name, roleName: m.role_name, owner: m.role === "owner", active: m.status === "active" });
  }
  const levels = {};
  for (const r of results) if (r.kind === "channel" && !(r.min_level in levels)) levels[r.min_level] = await roleForLevel(env, r.min_level);
  return results.map(r => {
    const mem = members[r.id] || [];
    const other = r.kind === "dm" ? mem.find(m => m.id !== me) || null : null;
    const lm = last[r.id];
    return {
      id: r.id, kind: r.kind, topic: r.topic, name: r.kind === "dm" ? { lv: other ? other.name : "—" } : parseJSON(r.name, {}), description: parseJSON(r.description, {}),
      minLevel: r.min_level, minRole: r.kind === "channel" ? levels[r.min_level] : null, locked: r.kind === "channel" && (r.topic === "closed" || r.min_level > 20),
      archived: !!r.archived, unread: r.unread || 0, muted: !!r.my_muted, lastAt: r.last_at || r.created, owner: r.my_role === "owner",
      lastRead: r.last_read_at || since, other: other ? { id: other.id, name: other.name, roleName: other.roleName } : null,
      members: r.kind === "group" ? mem : undefined, memberCount: r.kind === "channel" ? undefined : mem.length,
      hasVideo: !!r.video_room,
      last: lm ? { id: lm.id, author: lm.author, authorName: lm.authorName, kind: lm.kind, deleted: lm.deleted, snippet: snip(lm.body), created: lm.created, meta: lm.kind === "system" ? lm.meta : undefined, fileName: lm.file ? lm.file.name : undefined } : null
    };
  });
}

/* norīkojumu „nelasītie”: aktīvie, mainīti kopš pēdējās atvēršanas */
async function ordersUnread(ctx, since){
  if (!(await ctx.can("orders", "v"))) return null;
  const r = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM orders o LEFT JOIN chat_reads cr ON cr.user = ? AND cr.room = '@orders' WHERE o.status = 'active' AND o.audience_min_level <= ? AND o.updated > COALESCE(cr.last_read_at, ?) AND o.updated_by != ?").bind(ctx.user.id, lvl(ctx), since, ctx.user.id).first();
  return r ? r.n : 0;
}
async function ideasUnread(ctx, since){
  if (!(await ctx.can("ideas", "v"))) return null;
  const r = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM ideas i LEFT JOIN chat_reads cr ON cr.user = ? AND cr.room = '@ideas' WHERE i.status != 'archived' AND i.updated > COALESCE(cr.last_read_at, ?) AND i.author != ?").bind(ctx.user.id, since, ctx.user.id).first();
  return r ? r.n : 0;
}
const activeSos = async env => { const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM sos WHERE resolved = 0 AND created > ?").bind(now() - 48 * 3600e3).first(); return r ? r.n : 0; };

/* ---------- norīkojumi ---------- */
const orderOut = (r, canEdit) => ({ id: r.id, title: r.title, body: r.body, audienceMinLevel: r.audience_min_level, audienceRole: r.audience_role || null, status: r.status, createdBy: r.created_by, createdByName: r.cb_name || "—", created: r.created, updated: r.updated, updatedBy: r.updated_by, updatedByName: r.ub_name || "—", canEdit });
const ORDER_SEL = `SELECT o.*, cb.name AS cb_name, ub.name AS ub_name, (SELECT name FROM roles WHERE level >= o.audience_min_level ORDER BY level ASC LIMIT 1) AS audience_role
  FROM orders o LEFT JOIN users cb ON cb.id = o.created_by LEFT JOIN users ub ON ub.id = o.updated_by`;
async function needOrder(ctx, id){
  await ctx.need("orders", "v");
  const o = await ctx.env.DB.prepare(ORDER_SEL + " WHERE o.id = ?").bind(id).first();
  if (!o) fail(404, "Order not found");
  if (o.audience_min_level > lvl(ctx)) fail(403, "This order is not addressed to your rank", { code: "forbidden" });
  return o;
}
const audience = (ctx, v) => { const n = int(v ?? 50, 1, 100, "audience"); if (n > lvl(ctx)) fail(400, "Audience cannot be above your own rank"); return n; };

/* ---------- idejas ---------- */
const IDEA_SEL = `SELECT i.*, u.name AS author_name, sb.name AS sb_name, (SELECT COUNT(*) FROM idea_comments c WHERE c.idea = i.id AND c.kind = 'comment') AS comments
  FROM ideas i LEFT JOIN users u ON u.id = i.author LEFT JOIN users sb ON sb.id = i.status_by`;
const ideaOut = r => ({ id: r.id, title: r.title, body: r.body, topic: r.topic, status: r.status, author: r.author, authorName: r.author_name || "—", created: r.created, updated: r.updated, statusBy: r.sb_name || null, statusAt: r.status_at || null, comments: r.comments || 0 });

const escLike = s => s.replace(/[\\%_]/g, "\\$&");
const jitsiBase = env => (env.JITSI_BASE || "https://meet.jit.si").replace(/\/+$/, "");

export const routes = [
  /* ---- istabas ---- */
  route("GET", "/comms/rooms", async ctx => {
    ctx.needUser();
    const since = await userSince(ctx);
    const rooms = await listRooms(ctx);
    const [ou, iu] = await Promise.all([ordersUnread(ctx, since), ideasUnread(ctx, since)]);
    const rhr = rooms.some(r => r.id === "rhr") ? await activeSos(ctx.env) : 0;
    return json({ rooms, orders: ou === null ? null : { unread: ou, canCreate: await ctx.can("orders", "c") }, ideas: iu === null ? null : { unread: iu, canCreate: await ctx.can("ideas", "c"), canStatus: await ctx.can("ideas", "a") },
      sos: rhr, me: { id: ctx.user.id, level: lvl(ctx), canGroup: await ctx.can("chat", "c"), mod: await ctx.can("chat", "d") }, editWindow: EDIT_WINDOW_MS, video: jitsiBase(ctx.env) });
  }),
  route("GET", "/comms/unread", async ctx => {
    // viens SQL vaicājums (galvenes punkts aptauj katras lapas fonā ik pēc 60 s); tiesības nāk no kešotajām lomas tiesībām
    ctx.needUser();
    const chat = await ctx.can("chat", "v"), ord = await ctx.can("orders", "v");
    if (!chat && !ord) return json({ total: 0, messages: 0, orders: 0 });
    const r = await ctx.env.DB.prepare(`WITH me AS (SELECT COALESCE(approved_at, created, 0) AS since FROM users WHERE id = ?1)
      SELECT
        CASE WHEN ?3 = 1 THEN (SELECT COUNT(*) FROM messages m JOIN (${READABLE}) a ON a.id = m.room LEFT JOIN chat_reads cr ON cr.room = m.room AND cr.user = ?1
          WHERE m.author != ?1 AND m.deleted_at IS NULL AND COALESCE(cr.muted, 0) = 0 AND m.created > COALESCE(cr.last_read_at, (SELECT since FROM me))) ELSE 0 END AS msgs,
        CASE WHEN ?4 = 1 THEN (SELECT COUNT(*) FROM orders o LEFT JOIN chat_reads cr ON cr.user = ?1 AND cr.room = '@orders'
          WHERE o.status = 'active' AND o.audience_min_level <= ?2 AND o.updated_by != ?1 AND o.updated > COALESCE(cr.last_read_at, (SELECT since FROM me))) ELSE 0 END AS ords`)
      .bind(ctx.user.id, lvl(ctx), chat ? 1 : 0, ord ? 1 : 0).first();
    const m = r ? r.msgs : 0, o = r ? r.ords : 0;
    return json({ total: m + o, messages: m, orders: o });
  }),
  /* grupas izveide */
  route("POST", "/comms/rooms", async ctx => {
    const u = await ctx.need("chat", "c");
    await ctx.limit("room:" + u.id, 10, 3600);
    const b = await ctx.body();
    const name = text(b.name, 60, 2, "name");
    const ids = [...new Set((Array.isArray(b.members) ? b.members : []).map(x => clip(x, 32)).filter(x => x && x !== u.id))].slice(0, GROUP_MAX - 1);
    const valid = await chatUsers(ctx.env, ids);
    if (!valid.length) fail(400, "Add at least one member");
    const id = uid(16), t = now();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO rooms (id, kind, slug, name, description, min_level, topic, created_by, created, archived, sort) VALUES (?, 'group', ?, ?, ?, 0, 'other', ?, ?, 0, 500)").bind(id, "g:" + id, JSON.stringify({ lv: name }), JSON.stringify({ lv: clip(b.description, 200) }), u.id, t),
      ctx.env.DB.prepare("INSERT INTO room_members (room, user, role, joined) VALUES (?, ?, 'owner', ?)").bind(id, u.id, t),
      ...valid.map(v => ctx.env.DB.prepare("INSERT OR IGNORE INTO room_members (room, user, role, joined) VALUES (?, ?, 'member', ?)").bind(id, v.id, t))
    ]);
    await postSystem(ctx, id, { event: "created", names: valid.map(v => v.name) });
    return json({ ok: true, id });
  }),
  /* privātā saruna: atrod vai izveido */
  route("POST", /^\/comms\/dm\/(\w{3,32})$/, async (ctx, other) => {
    const u = await ctx.need("chat", "c");
    if (other === u.id) fail(400, "You cannot message yourself");
    const [o] = await chatUsers(ctx.env, [other]);
    if (!o) fail(404, "Member not found");
    const key = "dm:" + [u.id, other].sort().join(":");
    let r = await ctx.env.DB.prepare("SELECT id FROM rooms WHERE slug = ?").bind(key).first();
    if (!r) {
      await ctx.limit("dm:" + u.id, 20, 3600);
      const id = uid(16), t = now();
      await ctx.env.DB.batch([
        ctx.env.DB.prepare("INSERT OR IGNORE INTO rooms (id, kind, slug, name, description, min_level, topic, created_by, created, archived, sort) VALUES (?, 'dm', ?, NULL, NULL, 0, 'other', ?, ?, 0, 900)").bind(id, key, u.id, t),
        ctx.env.DB.prepare("INSERT OR IGNORE INTO room_members (room, user, role, joined) SELECT id, ?, 'member', ? FROM rooms WHERE slug = ?").bind(u.id, t, key),
        ctx.env.DB.prepare("INSERT OR IGNORE INTO room_members (room, user, role, joined) SELECT id, ?, 'member', ? FROM rooms WHERE slug = ?").bind(other, t, key)
      ]);
      r = await ctx.env.DB.prepare("SELECT id FROM rooms WHERE slug = ?").bind(key).first();
    }
    return json({ ok: true, id: r.id, other: { id: o.id, name: o.name, roleName: o.role_name } });
  }),
  route("GET", "/comms/members", async ctx => {
    await ctx.need("chat", "v");
    const { results } = await ctx.env.DB.prepare(CHAT_USERS + " ORDER BY ro.level DESC, u.name COLLATE NOCASE LIMIT 1000").all();
    return json({ members: results.map(r => ({ id: r.id, name: r.name, roleName: r.role_name, me: r.id === ctx.user.id })) });
  }),
  route("GET", new RegExp(`^/comms/rooms/${ROOM_ID}$`), async (ctx, id) => {
    const { room, a } = await needRoom(ctx, id);
    const r = (await listRooms(ctx)).find(x => x.id === id) || null;
    let members = null;
    if (room.kind !== "channel") {
      const { results } = await ctx.env.DB.prepare("SELECT rm.user, rm.role, u.name, ro.name AS role_name FROM room_members rm JOIN users u ON u.id = rm.user LEFT JOIN roles ro ON ro.id = u.role WHERE rm.room = ? ORDER BY rm.role DESC, u.name").bind(id).all();
      members = results.map(m => ({ id: m.user, name: m.name, roleName: m.role_name, owner: m.role === "owner" }));
    }
    return json({ room: r, members, access: a, video: room.video_room ? `${jitsiBase(ctx.env)}/${room.video_room}` : null });
  }),
  /* grupas pārvaldība: pārdēvēt (īpašnieks) */
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}$`), async (ctx, id) => {
    const { room, a } = await needRoom(ctx, id);
    if (room.kind !== "group" || !a.owner) fail(403, "Only the group owner can change it", { code: "forbidden" });
    const b = await ctx.body();
    const name = text(b.name, 60, 2, "name");
    await ctx.env.DB.prepare("UPDATE rooms SET name = ?, description = ? WHERE id = ?").bind(JSON.stringify({ lv: name }), JSON.stringify({ lv: clip(b.description, 200) }), id).run();
    await postSystem(ctx, id, { event: "renamed", name });
    return json({ ok: true });
  }),
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}/members$`), async (ctx, id) => {
    const { room, a } = await needRoom(ctx, id);
    if (room.kind !== "group" || !a.owner) fail(403, "Only the group owner can change members", { code: "forbidden" });
    const b = await ctx.body();
    const add = await chatUsers(ctx.env, [...new Set((Array.isArray(b.add) ? b.add : []).map(x => clip(x, 32)))].slice(0, GROUP_MAX));
    const remove = [...new Set((Array.isArray(b.remove) ? b.remove : []).map(x => clip(x, 32)))].filter(x => x !== ctx.user.id).slice(0, GROUP_MAX);
    const cnt = (await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM room_members WHERE room = ?").bind(id).first()).n;
    if (cnt + add.length - remove.length > GROUP_MAX) fail(400, `A group can have at most ${GROUP_MAX} members`);
    const t = now(), stmts = [];
    for (const v of add) stmts.push(ctx.env.DB.prepare("INSERT OR IGNORE INTO room_members (room, user, role, joined) VALUES (?, ?, 'member', ?)").bind(id, v.id, t));
    for (const x of remove) stmts.push(ctx.env.DB.prepare("DELETE FROM room_members WHERE room = ? AND user = ? AND role != 'owner'").bind(id, x));
    if (stmts.length) await ctx.env.DB.batch(stmts);
    let names = [];
    if (remove.length) { const rs = await chatUsers(ctx.env, remove); names = rs.map(r => r.name); for (const x of remove) kick(ctx, id, x); }
    if (add.length) await postSystem(ctx, id, { event: "added", names: add.map(v => v.name) });
    if (names.length) await postSystem(ctx, id, { event: "removed", names });
    return json({ ok: true });
  }),
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}/leave$`), async (ctx, id) => {
    const { room, a } = await needRoom(ctx, id);
    if (room.kind !== "group") fail(400, "Only groups can be left");
    await postSystem(ctx, id, { event: "left", names: [ctx.user.name] });
    await ctx.env.DB.prepare("DELETE FROM room_members WHERE room = ? AND user = ?").bind(id, ctx.user.id).run();
    // īpašnieks aiziet → īpašnieka loma pāriet senākajam dalībniekam
    if (a.owner) await ctx.env.DB.prepare("UPDATE room_members SET role = 'owner' WHERE room = ? AND user = (SELECT user FROM room_members WHERE room = ? ORDER BY joined LIMIT 1)").bind(id, id).run();
    kick(ctx, id, ctx.user.id);
    return json({ ok: true });
  }),
  /* ziņas */
  route("GET", new RegExp(`^/comms/rooms/${ROOM_ID}/messages$`), async (ctx, id) => {
    await needRoom(ctx, id);
    const sp = ctx.url.searchParams;
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50", 10) || 50));
    const cr = await ctx.env.DB.prepare("SELECT last_read_at, muted FROM chat_reads WHERE user = ? AND room = ?").bind(ctx.user.id, id).first();
    const lastRead = cr ? cr.last_read_at : await userSince(ctx);
    const around = clip(sp.get("around"), 40);
    if (around) {
      const m = await ctx.env.DB.prepare("SELECT created FROM messages WHERE id = ? AND room = ?").bind(around, id).first();
      if (!m) fail(404, "Message not found");
      const [older, newer] = await ctx.env.DB.batch([
        ctx.env.DB.prepare(MSG_SEL + " WHERE m.room = ? AND m.created <= ? ORDER BY m.created DESC, m.id DESC LIMIT ?").bind(id, m.created, 30),
        ctx.env.DB.prepare(MSG_SEL + " WHERE m.room = ? AND m.created > ? ORDER BY m.created ASC, m.id ASC LIMIT ?").bind(id, m.created, 31)
      ]);
      return json({ messages: [...older.results.reverse(), ...newer.results.slice(0, 30)].map(msgOut), hasMore: older.results.length === 30, hasNewer: newer.results.length > 30, lastRead, muted: !!(cr && cr.muted) });
    }
    const before = parseInt(sp.get("before") || "0", 10);
    const { results } = await ctx.env.DB.prepare(MSG_SEL + " WHERE m.room = ? AND m.created < ? ORDER BY m.created DESC, m.id DESC LIMIT ?").bind(id, before > 0 ? before : 9e15, limit + 1).all();
    const hasMore = results.length > limit;
    return json({ messages: results.slice(0, limit).reverse().map(msgOut), hasMore, lastRead, muted: !!(cr && cr.muted) });
  }),
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}/messages$`), async (ctx, id) => {
    const { room } = await needRoom(ctx, id, "post");
    const u = ctx.user;
    await ctx.limit("msg:" + u.id, 30, 60);
    const b = await ctx.body();
    const raw = String(b.body ?? "");
    if (raw.length > BODY_MAX) fail(400, `Message is too long (max ${BODY_MAX} characters)`, { code: "too_long" });
    const body = clip(raw, BODY_MAX);
    let kind = "text", fileId = null; const meta = {};
    if (b.fileId) {
      fileId = clip(b.fileId, 20);
      const f = await ctx.env.DB.prepare("SELECT id, owner, ctx_type, ctx_id, mime, size, name FROM files WHERE id = ?").bind(fileId).first();
      if (!f || f.owner !== u.id || f.ctx_type !== "chat" || f.ctx_id !== id) fail(400, "Attach a file uploaded to this conversation");
      const used = await ctx.env.DB.prepare("SELECT 1 FROM messages WHERE file_id = ?").bind(fileId).first();
      if (used) fail(400, "This file is already attached");
      kind = f.mime.startsWith("image/") ? "image" : f.mime.startsWith("audio/") ? "voice" : "file";
      if (kind === "voice") meta.dur = Math.round(Math.max(0, Math.min(120, +b.duration || 0)));
      if (kind === "image" && b.w && b.h) { meta.w = int(b.w, 1, 10000, "w"); meta.h = int(b.h, 1, 10000, "h"); }
    } else if (!body) fail(400, "Message is empty", { code: "empty" });
    let replyTo = null;
    if (b.replyTo) {
      const rp = await ctx.env.DB.prepare("SELECT id FROM messages WHERE id = ? AND room = ?").bind(clip(b.replyTo, 40), id).first();
      if (!rp) fail(400, "The message you reply to is not in this conversation");
      replyTo = rp.id;
    }
    const mid = uid(16), t = now();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO messages (id, room, author, body, created, kind, file_id, meta, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(mid, id, u.id, body, t, kind, fileId, Object.keys(meta).length ? JSON.stringify(meta) : null, replyTo),
      markRead(ctx.env, u.id, id, t)
    ]);
    const m = await getMsg(ctx.env, mid);
    cast(ctx, id, { type: "message", message: m });
    return json({ ok: true, message: m });
  }),
  /* labošana: autors 15 minūšu laikā */
  route("POST", new RegExp(`^/comms/messages/${MSG_ID}$`), async (ctx, mid) => {
    ctx.needUser();
    const m = await ctx.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(mid).first();
    if (!m) fail(404, "Message not found");
    await needRoom(ctx, m.room, "post");
    if (m.author !== ctx.user.id) fail(403, "You can edit only your own messages", { code: "forbidden" });
    if (m.deleted_at) fail(400, "Deleted messages cannot be edited");
    if (m.kind === "system") fail(400, "System messages cannot be edited");
    if (now() - m.created > EDIT_WINDOW_MS) fail(403, "Messages can be edited only within 15 minutes", { code: "edit_window" });
    const b = await ctx.body();
    const raw = String(b.body ?? "");
    if (raw.length > BODY_MAX) fail(400, `Message is too long (max ${BODY_MAX} characters)`, { code: "too_long" });
    const body = clip(raw, BODY_MAX);
    if (!body && !m.file_id) fail(400, "Message is empty", { code: "empty" });
    await ctx.env.DB.prepare("UPDATE messages SET body = ?, edited_at = ? WHERE id = ?").bind(body, now(), mid).run();
    const out = await getMsg(ctx.env, mid);
    cast(ctx, m.room, { type: "edit", message: out });
    return json({ ok: true, message: out });
  }),
  /* dzēšana: autors — savas; moderators (chat:d) — jebkuru kanālā (auditēts, prasa svaigu MFA) */
  route("DELETE", new RegExp(`^/comms/messages/${MSG_ID}$`), async (ctx, mid) => {
    ctx.needUser();
    const m = await ctx.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(mid).first();
    if (!m) fail(404, "Message not found");
    const { room, a } = await needRoom(ctx, m.room);
    if (m.deleted_at) return json({ ok: true });
    const own = m.author === ctx.user.id;
    if (!own) {
      if (!a.mod) fail(403, "You can delete only your own messages", { code: "forbidden" });
      await ctx.need("chat", "d", { elevated: true });
    }
    await ctx.env.DB.prepare("UPDATE messages SET body = '', meta = NULL, deleted_at = ?, deleted_by = ? WHERE id = ?").bind(now(), ctx.user.id, mid).run();
    if (!own) {
      const au = await ctx.env.DB.prepare("SELECT name FROM users WHERE id = ?").bind(m.author).first();
      await ctx.audit("comms.message.delete", "message", mid, { room: room.id, roomName: parseJSON(room.name, {}).lv || room.id, author: m.author, authorName: au ? au.name : null, before: { body: clip(m.body, 500), kind: m.kind, file: m.file_id || null, created: m.created } });
    }
    cast(ctx, m.room, { type: "delete", id: mid });
    return json({ ok: true });
  }),
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}/read$`), async (ctx, id) => {
    await needRoom(ctx, id);
    await markRead(ctx.env, ctx.user.id, id, now()).run();
    return json({ ok: true });
  }),
  /* paziņojumu iestatījums istabai (apklusināt) */
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}/mute$`), async (ctx, id) => {
    await needRoom(ctx, id);
    const b = await ctx.body();
    await ctx.env.DB.prepare("INSERT INTO chat_reads (user, room, last_read_at, muted) VALUES (?, ?, 0, ?) ON CONFLICT(user, room) DO UPDATE SET muted = excluded.muted").bind(ctx.user.id, id, bool(b.muted) ? 1 : 0).run();
    return json({ ok: true, muted: bool(b.muted) });
  }),
  /* videozvans: neuzminams Jitsi istabas nosaukums, redzams tikai sarunas dalībniekiem */
  route("POST", new RegExp(`^/comms/rooms/${ROOM_ID}/video$`), async (ctx, id) => {
    const { room } = await needRoom(ctx, id, "post");
    if (!room.video_room) await ctx.env.DB.prepare("UPDATE rooms SET video_room = ? WHERE id = ? AND video_room IS NULL").bind("wbmc-" + uid(24), id).run();
    const r = await loadRoom(ctx.env, id);
    const url = `${jitsiBase(ctx.env)}/${r.video_room}`;
    const b = await ctx.body().catch(() => ({}));
    if (b && b.announce !== false) {
      const recent = await ctx.env.DB.prepare("SELECT 1 FROM messages WHERE room = ? AND kind = 'system' AND meta LIKE '%\"event\":\"video\"%' AND created > ? LIMIT 1").bind(id, now() - 10 * 60e3).first();
      if (!recent) await postSystem(ctx, id, { event: "video" });
    }
    return json({ ok: true, url, room: r.video_room });
  }),
  /* WebSocket: piekļuve pārbaudīta šeit, DO uzticas X-User galvenei (tai var piekļūt tikai Worker) */
  route("GET", new RegExp(`^/comms/rooms/${ROOM_ID}/ws$`), async (ctx, id) => {
    await needRoom(ctx, id);
    if (ctx.req.headers.get("Upgrade") !== "websocket") fail(426, "Expected websocket");
    const h = new Headers(ctx.req.headers);
    h.set("X-User", JSON.stringify({ id: ctx.user.id, name: ctx.user.name }));
    h.set("X-Room", id);
    return stub(ctx.env, id).fetch(new Request("https://room/chat/connect", { headers: h }));
  }),
  /* meklēšana tikai lasāmajās istabās */
  route("GET", "/comms/search", async ctx => {
    await ctx.need("chat", "v");
    const qs = clip(ctx.url.searchParams.get("q"), 100);
    if (qs.length < 2) fail(400, "Search needs at least 2 characters", { code: "short" });
    await ctx.limit("search:" + ctx.user.id, 30, 60);
    const { results } = await ctx.env.DB.prepare(`${MSG_SEL} JOIN (${READABLE}) a ON a.id = m.room
      WHERE m.deleted_at IS NULL AND m.kind != 'system' AND (m.body LIKE ?3 ESCAPE '\\' OR f.name LIKE ?3 ESCAPE '\\') ORDER BY m.created DESC LIMIT 50`).bind(ctx.user.id, lvl(ctx), `%${escLike(qs)}%`).all();
    const ids = [...new Set(results.map(r => r.room))], names = {};
    for (let i = 0; i < ids.length; i += 80) {
      const part = ids.slice(i, i + 80);
      const { results: rs } = await ctx.env.DB.prepare(`SELECT r.id, r.kind, r.name, (SELECT u.name FROM room_members rm JOIN users u ON u.id = rm.user WHERE rm.room = r.id AND rm.user != ? LIMIT 1) AS other, (SELECT rm.user FROM room_members rm WHERE rm.room = r.id AND rm.user != ? LIMIT 1) AS other_id FROM rooms r WHERE r.id IN (${part.map(() => "?").join(",")})`).bind(ctx.user.id, ctx.user.id, ...part).all();
      for (const r of rs) names[r.id] = { kind: r.kind, name: r.kind === "dm" ? { lv: r.other || "—" } : parseJSON(r.name, {}), other: r.other_id };
    }
    return json({ q: qs, results: results.map(r => ({ ...msgOut(r), roomKind: (names[r.room] || {}).kind, roomName: (names[r.room] || {}).name || {}, roomOther: (names[r.room] || {}).other || null })) });
  }),

  /* ---- norīkojumi ---- */
  route("GET", "/comms/orders", async ctx => {
    await ctx.need("orders", "v");
    const st = ctx.url.searchParams.get("status");
    const where = st === "all" ? "" : st === "archived" ? "AND o.status = 'archived'" : "AND o.status = 'active'";
    const { results } = await ctx.env.DB.prepare(`${ORDER_SEL} WHERE o.audience_min_level <= ? ${where} ORDER BY o.status, o.updated DESC LIMIT 200`).bind(lvl(ctx)).all();
    const canE = await ctx.can("orders", "e");
    await markRead(ctx.env, ctx.user.id, "@orders", now()).run();
    return json({ orders: results.map(r => orderOut(r, canE)), canCreate: await ctx.can("orders", "c"), canEdit: canE });
  }),
  route("GET", /^\/comms\/orders\/(\w{6,32})$/, async (ctx, id) => {
    const o = await needOrder(ctx, id);
    return json({ order: orderOut(o, await ctx.can("orders", "e")) });
  }),
  route("POST", "/comms/orders", async ctx => {
    const u = await ctx.need("orders", "c", { elevated: true });
    const b = await ctx.body();
    const o = { title: text(b.title, 160, 3, "title"), body: text(b.body, ORDER_MAX, 1, "body"), audience_min_level: audience(ctx, b.audienceMinLevel), status: oneOf(b.status, ORDER_STATUS, "active") };
    const id = uid(16), t = now();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO orders (id, title, body, audience_min_level, status, created_by, created, updated, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, o.title, o.body, o.audience_min_level, o.status, u.id, t, t, u.id),
      ctx.env.DB.prepare("INSERT INTO order_history (id, order_id, at, by, before, after) VALUES (?, ?, ?, ?, NULL, ?)").bind(uid(16), id, t, u.id, JSON.stringify(o))
    ]);
    await ctx.audit("comms.order.create", "order", id, { after: { title: o.title, audience: o.audience_min_level, status: o.status } });
    return json({ ok: true, id });
  }),
  route("POST", /^\/comms\/orders\/(\w{6,32})$/, async (ctx, id) => {
    const o = await needOrder(ctx, id);
    const u = await ctx.need("orders", "e", { elevated: true });
    const b = await ctx.body();
    const next = {};
    if (b.title !== undefined) next.title = text(b.title, 160, 3, "title");
    if (b.body !== undefined) next.body = text(b.body, ORDER_MAX, 1, "body");
    if (b.audienceMinLevel !== undefined) next.audience_min_level = audience(ctx, b.audienceMinLevel);
    if (b.status !== undefined) next.status = oneOf(b.status, ORDER_STATUS);
    const before = {}, after = {};
    for (const [k, v] of Object.entries(next)) if (o[k] !== v) { before[k] = o[k]; after[k] = v; }
    if (!Object.keys(after).length) return json({ ok: true, unchanged: true });
    const t = now();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE orders SET ${Object.keys(after).map(k => `${k} = ?`).join(", ")}, updated = ?, updated_by = ? WHERE id = ?`).bind(...Object.values(after), t, u.id, id),
      ctx.env.DB.prepare("INSERT INTO order_history (id, order_id, at, by, before, after) VALUES (?, ?, ?, ?, ?, ?)").bind(uid(16), id, t, u.id, JSON.stringify(before), JSON.stringify(after))
    ]);
    const short = x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "string" ? clip(v, 300) : v]));
    await ctx.audit("comms.order.update", "order", id, { before: short(before), after: short(after) });
    return json({ ok: true });
  }),
  route("GET", /^\/comms\/orders\/(\w{6,32})\/history$/, async (ctx, id) => {
    await needOrder(ctx, id);
    const { results } = await ctx.env.DB.prepare("SELECT h.*, u.name FROM order_history h LEFT JOIN users u ON u.id = h.by WHERE h.order_id = ? ORDER BY h.at DESC LIMIT 200").bind(id).all();
    return json({ history: results.map(h => ({ id: h.id, at: h.at, by: h.by, byName: h.name || "—", before: parseJSON(h.before, null), after: parseJSON(h.after, {}) })) });
  }),

  /* ---- idejas ---- */
  route("GET", "/comms/ideas", async ctx => {
    await ctx.need("ideas", "v");
    const st = ctx.url.searchParams.get("status");
    const where = IDEA_STATUS.includes(st) ? "WHERE i.status = ?" : st === "all" ? "" : "WHERE i.status != 'archived'";
    const s = ctx.env.DB.prepare(`${IDEA_SEL} ${where} ORDER BY CASE i.status WHEN 'new' THEN 0 WHEN 'reviewed' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, i.updated DESC LIMIT 300`);
    const { results } = await (IDEA_STATUS.includes(st) ? s.bind(st) : s).all();
    await markRead(ctx.env, ctx.user.id, "@ideas", now()).run();
    return json({ ideas: results.map(ideaOut), canCreate: await ctx.can("ideas", "c"), canStatus: await ctx.can("ideas", "a") });
  }),
  route("POST", "/comms/ideas", async ctx => {
    const u = await ctx.need("ideas", "c");
    await ctx.limit("idea:" + u.id, 10, 3600);
    const b = await ctx.body();
    const id = uid(16), t = now();
    await ctx.env.DB.prepare("INSERT INTO ideas (id, title, body, topic, status, author, created, updated) VALUES (?, ?, ?, ?, 'new', ?, ?, ?)")
      .bind(id, text(b.title, 160, 3, "title"), text(b.body, IDEA_MAX, 1, "body"), oneOf(b.topic, IDEA_TOPICS, "idea"), u.id, t, t).run();
    return json({ ok: true, id });
  }),
  route("GET", /^\/comms\/ideas\/(\w{6,32})$/, async (ctx, id) => {
    await ctx.need("ideas", "v");
    const i = await ctx.env.DB.prepare(IDEA_SEL + " WHERE i.id = ?").bind(id).first();
    if (!i) fail(404, "Idea not found");
    return json({ idea: ideaOut(i), canStatus: await ctx.can("ideas", "a"), canComment: await ctx.can("ideas", "c") });
  }),
  route("POST", /^\/comms\/ideas\/(\w{6,32})\/status$/, async (ctx, id) => {
    const u = await ctx.need("ideas", "a", { elevated: true });
    const i = await ctx.env.DB.prepare("SELECT * FROM ideas WHERE id = ?").bind(id).first();
    if (!i) fail(404, "Idea not found");
    const b = await ctx.body();
    const status = oneOf(b.status, IDEA_STATUS);
    const note = clip(b.note, COMMENT_MAX);
    if (status === i.status && !note) return json({ ok: true, unchanged: true });
    const t = now();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE ideas SET status = ?, status_by = ?, status_at = ?, updated = ? WHERE id = ?").bind(status, u.id, t, t, id),
      ctx.env.DB.prepare("INSERT INTO idea_comments (id, idea, author, body, kind, created) VALUES (?, ?, ?, ?, 'status', ?)").bind(uid(16), id, u.id, JSON.stringify({ from: i.status, to: status, note }), t)
    ]);
    await ctx.audit("comms.idea.status", "idea", id, { before: { status: i.status }, after: { status }, title: clip(i.title, 120), note: note || undefined });
    return json({ ok: true });
  }),
  route("GET", /^\/comms\/ideas\/(\w{6,32})\/comments$/, async (ctx, id) => {
    await ctx.need("ideas", "v");
    const { results } = await ctx.env.DB.prepare("SELECT c.*, u.name FROM idea_comments c LEFT JOIN users u ON u.id = c.author WHERE c.idea = ? ORDER BY c.created LIMIT 500").bind(id).all();
    return json({ comments: results.map(c => ({ id: c.id, author: c.author, authorName: c.name || "—", kind: c.kind, created: c.created, body: c.kind === "status" ? "" : c.body, status: c.kind === "status" ? parseJSON(c.body, {}) : undefined })) });
  }),
  route("POST", /^\/comms\/ideas\/(\w{6,32})\/comments$/, async (ctx, id) => {
    const u = await ctx.need("ideas", "c");
    await ctx.limit("ideac:" + u.id, 30, 600);
    const i = await ctx.env.DB.prepare("SELECT id, status FROM ideas WHERE id = ?").bind(id).first();
    if (!i) fail(404, "Idea not found");
    const b = await ctx.body(), t = now();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO idea_comments (id, idea, author, body, kind, created) VALUES (?, ?, ?, ?, 'comment', ?)").bind(uid(16), id, u.id, text(b.body, COMMENT_MAX, 1, "comment"), t),
      ctx.env.DB.prepare("UPDATE ideas SET updated = ? WHERE id = ?").bind(t, id)
    ]);
    return json({ ok: true });
  }),

  /* ---- administrācija: kanāli un moderācijas žurnāls ---- */
  route("GET", "/comms/admin/rooms", async ctx => {
    await ctx.need("chat", "e", { elevated: true });
    const { results } = await ctx.env.DB.prepare(`SELECT r.*, (SELECT COUNT(*) FROM messages m WHERE m.room = r.id) AS msgs, (SELECT MAX(created) FROM messages m WHERE m.room = r.id) AS last_at FROM rooms r WHERE r.kind = 'channel' ORDER BY r.archived, r.sort, r.created`).all();
    const [groups, dms] = await ctx.env.DB.batch([ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM rooms WHERE kind = 'group'"), ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM rooms WHERE kind = 'dm'")]);
    return json({ rooms: results.map(r => ({ id: r.id, name: parseJSON(r.name, {}), description: parseJSON(r.description, {}), topic: r.topic, minLevel: r.min_level, archived: !!r.archived, sort: r.sort, messages: r.msgs, lastAt: r.last_at, created: r.created })), groups: groups.results[0].n, dms: dms.results[0].n, topics: TOPICS });
  }),
  route("POST", "/comms/admin/rooms", async ctx => {
    await ctx.need("chat", "e", { elevated: true });
    const b = await ctx.body();
    const name = ml(b.name, 60, true, "name");
    let id = slug(b.id || name.lv || name.en || "").slice(0, 40) || uid(10);
    if (!/^[a-z0-9-]{2,40}$/.test(id)) id = uid(10);
    if (await loadRoom(ctx.env, id)) id = (id.slice(0, 30) + "-" + uid(5));
    const r = { min_level: int(b.minLevel ?? 20, 1, 100, "level"), topic: oneOf(b.topic, TOPICS, "general"), sort: int(b.sort ?? 100, 0, 999, "sort") };
    await ctx.env.DB.prepare("INSERT INTO rooms (id, kind, slug, name, description, min_level, topic, created_by, created, archived, sort) VALUES (?, 'channel', ?, ?, ?, ?, ?, ?, ?, 0, ?)")
      .bind(id, id, JSON.stringify(name), JSON.stringify(ml(b.description, 300)), r.min_level, r.topic, ctx.user.id, now(), r.sort).run();
    await ctx.audit("comms.room.create", "room", id, { after: { name: name.lv || name.en, ...r } });
    return json({ ok: true, id });
  }),
  route("POST", new RegExp(`^/comms/admin/rooms/${ROOM_ID}$`), async (ctx, id) => {
    await ctx.need("chat", "e", { elevated: true });
    const r = await loadRoom(ctx.env, id);
    if (!r || r.kind !== "channel") fail(404, "Channel not found");
    const b = await ctx.body();
    const next = {};
    if (b.name !== undefined) next.name = JSON.stringify(ml(b.name, 60, true, "name"));
    if (b.description !== undefined) next.description = JSON.stringify(ml(b.description, 300));
    if (b.minLevel !== undefined) next.min_level = int(b.minLevel, 1, 100, "level");
    if (b.topic !== undefined) next.topic = oneOf(b.topic, TOPICS);
    if (b.sort !== undefined) next.sort = int(b.sort, 0, 999, "sort");
    if (b.archived !== undefined) next.archived = bool(b.archived) ? 1 : 0;
    const before = {}, after = {};
    for (const [k, v] of Object.entries(next)) if (r[k] !== v) { before[k] = r[k]; after[k] = v; }
    if (!Object.keys(after).length) return json({ ok: true, unchanged: true });
    await ctx.env.DB.prepare(`UPDATE rooms SET ${Object.keys(after).map(k => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...Object.values(after), id).run();
    await ctx.audit(after.archived === 1 ? "comms.room.archive" : "comms.room.update", "room", id, { before, after });
    return json({ ok: true });
  }),
  route("GET", "/comms/admin/log", async ctx => {
    if (!(await ctx.can("chat", "d")) && !(await ctx.can("audit", "v"))) { ctx.needUser(); fail(403, "Forbidden", { code: "forbidden" }); }
    await ctx.need((await ctx.can("chat", "d")) ? "chat" : "audit", (await ctx.can("chat", "d")) ? "d" : "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT * FROM audit_log WHERE action LIKE 'comms.%' ORDER BY at DESC LIMIT 200").all();
    return json({ entries: results.map(x => ({ id: x.id, at: x.at, actor: x.actor_name, action: x.action, targetType: x.target_type, targetId: x.target_id, details: parseJSON(x.details, null) })) });
  })
];
