/* Modulis: people — Brāļu profili (tikai biedriem) un Memorials (publicētās kartītes publiskas).
   Principi: neizdomāt faktus; pakāpe/statuss mainās tikai ar administratora darbību (audits pirms/pēc);
   lauku redzamība tiek filtrēta servera pusē pēc skatītāja lomas līmeņa; Memorials publicē tikai ar
   kluba apstiprinātāja tiesībām (memorials:a) un atzīmētu ģimenes/likumiskā pārstāvja piekrišanu. */
import { route, json, fail, now, uid, clip, text, int, oneOf, bool, ml, slug as slugify, parseJSON, email as emailV } from "../lib/http.js";
import { getSetting, putSetting } from "../lib/core.js";
import { registerFileUpload, registerFileAccess } from "./files.js";

/* ---------------- konfigurācija ---------------- */
/* Profila lauki, kuru redzamību var noteikt (segvārds redzams vienmēr — bez tā kartīte nav identificējama) */
export const FIELDS = ["photo", "rank", "position", "status", "bio", "joined_year", "bike", "city", "real_name", "phone", "email"];
/* minimālais lomas līmenis lauka redzēšanai (roles.level). 101 = tikai profilu redaktoriem (members:e) */
export const DEFAULT_VISIBILITY = { photo: 20, rank: 20, position: 20, status: 20, bio: 30, joined_year: 30, bike: 30, city: 30, real_name: 50, phone: 50, email: 50 };
const EDITORS_ONLY = 101;
/* Noklusējuma saraksti — tikai sākumpunkts; klubs tos apstiprina/maina administrācijā (iestatījumi 'ranks', 'positions', 'membership_statuses').
   Amati ņemti no iepriekšējās kluba lapas („officers”); pakāpes atbilst lomu noklusējumam (16. sadaļa, 1. lēmums). */
const DEFAULT_RANKS = [
  { id: "member", name: { lv: "Member", en: "Member" } },
  { id: "prospect", name: { lv: "Prospect", en: "Prospect" } },
  { id: "hangaround", name: { lv: "Hang-around", en: "Hang-around" } }
];
const DEFAULT_POSITIONS = [
  { id: "president", name: { lv: "President", en: "President" } },
  { id: "vice-president", name: { lv: "Vice President", en: "Vice President" } },
  { id: "sergeant-at-arms", name: { lv: "Sergeant at Arms", en: "Sergeant at Arms" } },
  { id: "road-captain", name: { lv: "Road Captain", en: "Road Captain" } },
  { id: "secretary", name: { lv: "Secretary", en: "Secretary" } },
  { id: "treasurer", name: { lv: "Treasurer", en: "Treasurer" } }
];
const DEFAULT_STATUSES = [
  { id: "member", name: { lv: "Biedrs", en: "Member" } },
  { id: "prospect", name: { lv: "Kandidāts (prospect)", en: "Prospect" } },
  { id: "honorary", name: { lv: "Goda biedrs", en: "Honorary member" } },
  { id: "retired", name: { lv: "Atvaļināts", en: "Retired" } },
  { id: "inactive", name: { lv: "Neaktīvs", en: "Inactive" } }
];
/* Memorials redakcionālais pamatteksts (specifikācija, 7. sadaļa) — redaktorā aizpildīts iepriekš, katrai kartītei paplašināms */
export const MEMORIAL_TEXT = {
  lv: "BRĀLIS UZ MŪŽIEM. Viņš bija daļa no mūsu vēstures, mūsu ceļa un mūsu brālības. Laiks nedzēš īstu draudzību, un attālums neatceļ uzticību. Mēs atceramies kopā noieto ceļu un saglabājam viņa vārdu Wolves Brotherhood MC vēsturē.",
  en: "BROTHER FOREVER. He was part of our history, our road and our brotherhood. Time does not erase true friendship, and distance does not cancel trust. We remember the road we rode together and keep his name in the history of Wolves Brotherhood MC."
};
const M_STATUSES = ["draft", "review", "published", "archived"];
const W_STATUSES = ["pending", "published", "hidden"];

/* ---------------- palīgi ---------------- */
const fileUrl = id => id ? `/api/files/${id}` : null;
const fileId = v => { const s = clip(v, 40); if (!s) return null; if (!/^[0-9a-z]{20}$/.test(s)) fail(400, "Invalid photo"); return s; };
const yearNow = () => new Date().getUTCFullYear();
const optYear = (v, field) => v === null || v === undefined || v === "" ? null : int(v, 1900, yearNow(), field);
const lifeDate = (v, field) => { const s = clip(v, 10); if (!s) return null; if (!/^\d{4}(-\d{2}-\d{2})?$/.test(s) || +s.slice(0, 4) < 1900 || +s.slice(0, 4) > yearNow()) fail(400, `Invalid ${field} (YYYY or YYYY-MM-DD)`); if (s.length === 10 && Number.isNaN(Date.parse(s))) fail(400, `Invalid ${field}`); return s; };
const phoneV = v => { const s = clip(v, 40); if (!s) return null; if (!/^[+0-9 ()\-]{5,40}$/.test(s)) fail(400, "Invalid phone"); return s; };

/* saraksts [{id, name:{lv,en…}}] ar unikāliem id */
function cleanList(v, field){
  if (!Array.isArray(v)) fail(400, `Invalid ${field}`);
  const seen = new Set(), out = [];
  for (const it of v.slice(0, 40)) {
    if (!it || typeof it !== "object") continue;
    const name = ml(it.name, 60, true, field);
    const id = slugify(it.id || name.lv || name.en).slice(0, 40);
    if (!id || seen.has(id)) fail(400, `Duplicate or empty id in ${field}`);
    seen.add(id); out.push({ id, name });
  }
  return out;
}
/* redzamības karte: tikai zināmi lauki, līmenis 0–101 */
function cleanVis(v, partial = false){
  const out = {};
  if (!v || typeof v !== "object") return out;
  for (const f of FIELDS) if (v[f] !== undefined && v[f] !== null && v[f] !== "") out[f] = int(v[f], 0, EDITORS_ONLY, "visibility");
  return partial ? out : { ...DEFAULT_VISIBILITY, ...out };
}
async function peopleSettings(env){
  const [ranks, positions, statuses, vis] = await Promise.all([
    getSetting(env, "ranks", null), getSetting(env, "positions", null), getSetting(env, "membership_statuses", null), getSetting(env, "profile_visibility", null)
  ]);
  // 'profile_visibility' var būt saglabāts arī caur kopējo /admin/settings → vienmēr attīrām
  let visibility; try { visibility = cleanVis(vis); } catch (e) { visibility = { ...DEFAULT_VISIBILITY }; }
  return {
    ranks: Array.isArray(ranks) ? ranks : DEFAULT_RANKS, positions: Array.isArray(positions) ? positions : DEFAULT_POSITIONS,
    statuses: Array.isArray(statuses) ? statuses : DEFAULT_STATUSES, visibility,
    defaults: { ranks: !Array.isArray(ranks), positions: !Array.isArray(positions), statuses: !Array.isArray(statuses), visibility: !vis }
  };
}

/* skatītāja tiesības profiliem */
async function viewer(ctx){
  return { id: ctx.user ? ctx.user.id : null, level: ctx.user ? ctx.user.level || 0 : 0, editor: await ctx.can("members", "e"), admin: await ctx.can("members", "a") };
}
const minLevel = (p, field, vis) => { const o = parseJSON(p.field_visibility, {}) || {}; const v = o[field] ?? vis[field] ?? DEFAULT_VISIBILITY[field] ?? EDITORS_ONLY; return +v; };
const mayView = (p, field, V, vis) => V.editor || (p.user_id && p.user_id === V.id) || V.level >= minLevel(p, field, vis);

/* profils → atbilde ar tikai redzamajiem laukiem (filtrs servera pusē) */
function profileOut(p, V, vis){
  const can = f => mayView(p, f, V, vis);
  const o = { id: p.id, nickname: p.nickname };
  if (can("photo") && p.photo) o.photo = fileUrl(p.photo);
  if (can("rank") && p.rank) o.rank = p.rank;
  if (can("position") && p.position) o.position = p.position;
  if (can("status") && p.membership_status) o.status = p.membership_status;
  if (can("bio")) { const b = parseJSON(p.bio, {}); if (b && Object.keys(b).length) o.bio = b; }
  if (can("joined_year") && p.joined_year) o.joinedYear = p.joined_year;
  if (can("bike") && p.bike) o.bike = p.bike;
  if (can("city") && p.city) o.city = p.city;
  if (can("real_name") && p.real_name) o.realName = p.real_name;
  if (can("phone") && p.phone) o.phone = p.phone;
  if (can("email") && p.email) o.email = p.email;
  // saziņai (Rakstīt) — tikai, ja profils piesaistīts aktīvam kontam
  if (p.user_id && p.u_status === "active") o.userId = p.user_id;
  if (p.user_id && p.user_id === V.id) o.mine = true;
  if (V.editor) {
    o.archived = !!p.archived; o.fieldVisibility = parseJSON(p.field_visibility, {}) || {};
    o.account = p.user_id ? { id: p.user_id, name: p.u_name, status: p.u_status } : null;
    o.photoId = p.photo || null; o.created = p.created; o.updated = p.updated;
  }
  return o;
}
const PROFILE_SQL = `SELECT p.*, u.name AS u_name, u.status AS u_status FROM profiles p LEFT JOIN users u ON u.id = p.user_id`;

/* memoriāla attēlojums */
function memorialOut(m, { admin = false } = {}){
  const o = {
    id: m.id, slug: m.slug, name: m.name || "", nickname: m.nickname || "", born: m.born || null, died: m.died || null,
    clubFrom: m.club_from || null, clubTo: m.club_to || null, photo: fileUrl(m.photo),
    story: parseJSON(m.story, {}) || {}, contribution: parseJSON(m.contribution, {}) || {}, text: parseJSON(m.text, {}) || {}, status: m.status
  };
  if (admin) Object.assign(o, { photoId: m.photo || null, consentFamily: !!m.consent_family, consentNote: m.consent_note || "", consentBy: m.consent_by || "", consentAt: m.consent_at || null,
    approvedBy: m.approved_by_name || null, approvedAt: m.approved_at || null, created: m.created, updated: m.updated, pendingWords: m.pending_words || 0 });
  return o;
}
/* publicitātes sinhronizācija: publicētā memoriāla foto public=1, citādi 0 (arī vecajiem/aizstātajiem attēliem) */
async function syncMemorialFiles(env, m){
  const stmts = [env.DB.prepare("UPDATE files SET public = 0 WHERE ctx_type = 'memorial' AND ctx_id = ? AND id != ?").bind(m.id, m.photo || "")];
  if (m.photo) stmts.push(env.DB.prepare("UPDATE files SET public = ?, ctx_id = ? WHERE id = ? AND ctx_type = 'memorial'").bind(m.status === "published" ? 1 : 0, m.id, m.photo));
  await env.DB.batch(stmts);
}
async function uniqueSlug(env, base, selfId){
  let s = base || "bralis", n = 1;
  for (;;) {
    const r = await env.DB.prepare("SELECT id FROM memorials WHERE slug = ?").bind(s).first();
    if (!r || r.id === selfId) return s;
    n++; s = `${base}-${n}`;
  }
}

/* ---------------- failu konteksti ---------------- */
registerFileUpload("profile", async ctx => (await ctx.can("members", "e")) || (await ctx.can("members", "c")));
registerFileAccess("profile", async (ctx, f) => {
  if (!ctx.active || !(await ctx.can("members", "v"))) return false;
  const V = await viewer(ctx);
  if (V.editor) return true;
  const p = await ctx.env.DB.prepare("SELECT id, user_id, field_visibility FROM profiles WHERE photo = ? AND archived = 0").bind(f.id).first();
  if (!p) return false;
  return mayView(p, "photo", V, (await peopleSettings(ctx.env)).visibility);
});
registerFileUpload("memorial", async ctx => ctx.can("memorials", "e"));
/* nepublicētu memoriālu foto redz tikai redaktori; publicētie ir public=1 (files.js tos atdod bez pārbaudes) */
registerFileAccess("memorial", async ctx => ctx.can("memorials", "e"));

/* ---------------- migrācijas ---------------- */
export const migrations = [
  { id: "people-001-tables", sql: [
    `CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT, nickname TEXT NOT NULL, real_name TEXT, photo TEXT, rank TEXT, position TEXT,
      membership_status TEXT NOT NULL DEFAULT 'member', joined_year INTEGER, bio TEXT, phone TEXT, email TEXT, city TEXT, bike TEXT, field_visibility TEXT,
      archived INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL, created_by TEXT, updated_by TEXT)`,
    "CREATE INDEX IF NOT EXISTS profiles_archived ON profiles(archived, nickname)",
    "CREATE INDEX IF NOT EXISTS profiles_user ON profiles(user_id)",
    `CREATE TABLE IF NOT EXISTS memorials (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT, nickname TEXT, born TEXT, died TEXT, club_from INTEGER, club_to INTEGER,
      photo TEXT, story TEXT, contribution TEXT, text TEXT, status TEXT NOT NULL DEFAULT 'draft', consent_family INTEGER NOT NULL DEFAULT 0, consent_note TEXT, consent_by TEXT,
      consent_at INTEGER, approved_by TEXT, approved_at INTEGER, created INTEGER NOT NULL, updated INTEGER NOT NULL, created_by TEXT, updated_by TEXT)`,
    "CREATE INDEX IF NOT EXISTS memorials_status ON memorials(status, died)",
    `CREATE TABLE IF NOT EXISTS memorial_words (id TEXT PRIMARY KEY, memorial_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, show_name INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, moderated_by TEXT, moderated_at INTEGER)`,
    "CREATE INDEX IF NOT EXISTS memorial_words_m ON memorial_words(memorial_id, status, created)",
    "CREATE INDEX IF NOT EXISTS memorial_words_status ON memorial_words(status, created)"
  ] }
  /* Tiesību noklusējumi (members/memorials) jau ir core-002-roles: leadership members vceax, memorials vcea; member members v, memorials vc; prospect members v. */
];

/* ---------------- profila ievade ---------------- */
async function readProfile(ctx, b, before, S){
  const out = {};
  const has = k => b[k] !== undefined;
  if (!before || has("nickname")) out.nickname = text(b.nickname, 40, 1, "nickname");
  if (has("realName")) out.real_name = clip(b.realName, 80) || null;
  if (has("photo")) out.photo = fileId(b.photo);
  if (has("rank")) { const v = clip(b.rank, 40) || null; if (v && v !== (before && before.rank) && !S.ranks.some(r => r.id === v)) fail(400, "Unknown rank"); out.rank = v; }
  if (has("position")) { const v = clip(b.position, 40) || null; if (v && v !== (before && before.position) && !S.positions.some(r => r.id === v)) fail(400, "Unknown position"); out.position = v; }
  if (has("status") || !before) { const v = clip(b.status, 40) || (before ? before.membership_status : (S.statuses[0] && S.statuses[0].id) || "member"); if (v !== (before && before.membership_status) && !S.statuses.some(r => r.id === v)) fail(400, "Unknown membership status"); out.membership_status = v; }
  if (has("joinedYear")) out.joined_year = optYear(b.joinedYear, "joined year");
  if (has("bio")) out.bio = JSON.stringify(ml(b.bio, 1500));
  if (has("phone")) out.phone = phoneV(b.phone);
  if (has("email")) out.email = clip(b.email, 120) ? emailV(b.email) : null;
  if (has("city")) out.city = clip(b.city, 60) || null;
  if (has("bike")) out.bike = clip(b.bike, 80) || null;
  if (has("fieldVisibility")) {
    const v = JSON.stringify(cleanVis(b.fieldVisibility, true));
    if (before ? v !== (before.field_visibility || "{}") : v !== "{}") { if (!(await ctx.can("members", "a"))) fail(403, "Changing field visibility requires approval rights", { code: "forbidden" }); out.field_visibility = v; }
  }
  if (has("userId")) {
    const v = clip(b.userId, 32) || null;
    if (v) {
      const u = await ctx.env.DB.prepare("SELECT id FROM users WHERE id = ? AND id != 'wbmc-system'").bind(v).first();
      if (!u) fail(400, "Unknown account");
      const other = await ctx.env.DB.prepare("SELECT id FROM profiles WHERE user_id = ? AND id != ?").bind(v, before ? before.id : "").first();
      if (other) fail(409, "This account is already linked to another profile");
    }
    out.user_id = v;
  }
  return out;
}
/* audita detaļas: kontaktdati — tikai lauka nosaukums (datu minimizācija) */
const PRIVATE_AUDIT = ["phone", "email", "real_name", "bio"];
function diff(before, after){
  const changed = {}, names = [];
  for (const [k, v] of Object.entries(after)) {
    const b = before ? before[k] ?? null : null;
    if ((b ?? null) === (v ?? null)) continue;
    names.push(k);
    if (!PRIVATE_AUDIT.includes(k)) changed[k] = { before: b, after: v };
  }
  return { names, changed };
}
async function linkUser(env, profileId, prevUser, nextUser){
  const stmts = [];
  if (prevUser && prevUser !== nextUser) stmts.push(env.DB.prepare("UPDATE users SET profile_id = NULL WHERE id = ? AND profile_id = ?").bind(prevUser, profileId));
  if (nextUser) stmts.push(env.DB.prepare("UPDATE users SET profile_id = ? WHERE id = ?").bind(profileId, nextUser));
  if (stmts.length) await env.DB.batch(stmts);
}

/* ---------------- memoriāla ievade ---------------- */
function readMemorial(b, before){
  const out = {}, has = k => b[k] !== undefined;
  if (!before || has("name")) out.name = clip(b.name, 80) || null;
  if (!before || has("nickname")) out.nickname = clip(b.nickname, 40) || null;
  if (!(out.name ?? (before && before.name)) && !(out.nickname ?? (before && before.nickname))) fail(400, "Name or club name is required");
  if (has("born")) out.born = lifeDate(b.born, "birth date");
  if (has("died")) out.died = lifeDate(b.died, "date of death");
  const born = out.born !== undefined ? out.born : before && before.born, died = out.died !== undefined ? out.died : before && before.died;
  if (born && died && died < born) fail(400, "Date of death is before date of birth");
  if (has("clubFrom")) out.club_from = optYear(b.clubFrom, "club years");
  if (has("clubTo")) out.club_to = optYear(b.clubTo, "club years");
  const cf = out.club_from !== undefined ? out.club_from : before && before.club_from, ct = out.club_to !== undefined ? out.club_to : before && before.club_to;
  if (cf && ct && ct < cf) fail(400, "Club years: end is before start");
  if (has("photo")) out.photo = fileId(b.photo);
  if (has("story")) out.story = JSON.stringify(ml(b.story, 6000));
  if (has("contribution")) out.contribution = JSON.stringify(ml(b.contribution, 4000));
  if (has("text") || !before) { const t = ml(b.text, 3000); out.text = JSON.stringify(Object.keys(t).length ? t : (before ? {} : MEMORIAL_TEXT)); }
  if (has("consentNote")) out.consent_note = clip(b.consentNote, 1000) || null;
  if (has("consentBy")) out.consent_by = clip(b.consentBy, 160) || null;
  if (has("consentFamily")) out.consent_family = bool(b.consentFamily) ? 1 : 0;
  return out;
}
const MEM_SQL = `SELECT m.*, u.name AS approved_by_name, (SELECT COUNT(*) FROM memorial_words w WHERE w.memorial_id = m.id AND w.status = 'pending') AS pending_words FROM memorials m LEFT JOIN users u ON u.id = m.approved_by`;

/* ---------------- maršruti ---------------- */
export const routes = [
  /* ===== Brāļi (tikai biedriem) ===== */
  route("GET", "/people", async ctx => {
    await ctx.need("members", "v");
    const V = await viewer(ctx), S = await peopleSettings(ctx.env);
    const withArchived = V.editor && ctx.url.searchParams.get("archived") === "1";
    const { results } = await ctx.env.DB.prepare(`${PROFILE_SQL} ${withArchived ? "" : "WHERE p.archived = 0"} ORDER BY p.archived, p.nickname COLLATE NOCASE LIMIT 1000`).all();
    return json({ profiles: results.map(p => profileOut(p, V, S.visibility)), ranks: S.ranks, positions: S.positions, statuses: S.statuses,
      canEdit: V.editor, canCreate: V.editor || await ctx.can("members", "c"), ...(V.editor ? { visibility: S.visibility } : {}) });
  }),
  route("GET", /^\/people\/([0-9a-z]{16})$/, async (ctx, id) => {
    await ctx.need("members", "v");
    const V = await viewer(ctx), S = await peopleSettings(ctx.env);
    const p = await ctx.env.DB.prepare(`${PROFILE_SQL} WHERE p.id = ?`).bind(id).first();
    if (!p || (p.archived && !V.editor)) fail(404, "Not found");
    return json({ profile: profileOut(p, V, S.visibility) });
  }),

  /* ===== Brāļi: administrācija ===== */
  route("POST", "/admin/people", async ctx => {
    await ctx.need("members", "c", { elevated: true });
    await ctx.limit("people:" + ctx.user.id, 60, 3600);
    const b = await ctx.body(), S = await peopleSettings(ctx.env);
    const v = await readProfile(ctx, b, null, S);
    const id = uid(16), t = now();
    const row = { id, ...v, created: t, updated: t, created_by: ctx.user.id, updated_by: ctx.user.id };
    const cols = Object.keys(row);
    await ctx.env.DB.prepare(`INSERT INTO profiles (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...cols.map(k => row[k] ?? null)).run();
    if (v.photo) await ctx.env.DB.prepare("UPDATE files SET ctx_id = ? WHERE id = ? AND ctx_type = 'profile'").bind(id, v.photo).run();
    if (v.user_id) await linkUser(ctx.env, id, null, v.user_id);
    const d = diff(null, v);
    await ctx.audit("people.create", "profile", id, { nickname: v.nickname, fields: d.names, rank: v.rank || null, position: v.position || null, status: v.membership_status, account: v.user_id || null });
    return json({ ok: true, id });
  }),
  route("POST", /^\/admin\/people\/([0-9a-z]{16})$/, async (ctx, id) => {
    await ctx.need("members", "e", { elevated: true });
    const { env } = ctx, b = await ctx.body(), S = await peopleSettings(env);
    const before = await env.DB.prepare("SELECT * FROM profiles WHERE id = ?").bind(id).first();
    if (!before) fail(404, "Not found");
    const v = await readProfile(ctx, b, before, S);
    const d = diff(before, v);
    if (!d.names.length) return json({ ok: true, changed: [] });
    const upd = Object.fromEntries(d.names.map(k => [k, v[k]]));
    upd.updated = now(); upd.updated_by = ctx.user.id;
    await env.DB.prepare(`UPDATE profiles SET ${Object.keys(upd).map(k => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...Object.values(upd).map(x => x ?? null), id).run();
    if (upd.photo) await env.DB.prepare("UPDATE files SET ctx_id = ? WHERE id = ? AND ctx_type = 'profile'").bind(id, upd.photo).run();
    if ("user_id" in upd) await linkUser(env, id, before.user_id, upd.user_id);
    /* pakāpe un statuss — tikai šeit, tikai manuāli, vienmēr ar atsevišķu audita ierakstu */
    for (const [k, label] of [["rank", "rank"], ["membership_status", "status"], ["position", "position"]]) {
      if (k in upd) await ctx.audit(k === "position" ? "people.position_change" : "people.rank_change", "profile", id, { field: label, nickname: v.nickname ?? before.nickname, before: before[k] ?? null, after: upd[k] ?? null });
    }
    const rest = d.names.filter(k => !["rank", "membership_status", "position"].includes(k));
    if (rest.length) await ctx.audit("people.update", "profile", id, { nickname: v.nickname ?? before.nickname, fields: rest,
      changes: Object.fromEntries(Object.entries(d.changed).filter(([k]) => rest.includes(k))) });
    return json({ ok: true, changed: d.names });
  }),
  route("POST", /^\/admin\/people\/([0-9a-z]{16})\/archive$/, async (ctx, id) => {
    await ctx.need("members", "e", { elevated: true });
    const b = await ctx.body();
    const p = await ctx.env.DB.prepare("SELECT id, nickname, archived FROM profiles WHERE id = ?").bind(id).first();
    if (!p) fail(404, "Not found");
    const archived = b.archived === undefined ? 1 : (bool(b.archived) ? 1 : 0);
    if (archived === p.archived) return json({ ok: true });
    await ctx.env.DB.prepare("UPDATE profiles SET archived = ?, updated = ?, updated_by = ? WHERE id = ?").bind(archived, now(), ctx.user.id, id).run();
    await ctx.audit(archived ? "people.archive" : "people.restore", "profile", id, { nickname: p.nickname, before: { archived: !!p.archived }, after: { archived: !!archived } });
    return json({ ok: true });
  }),
  route("GET", "/admin/people-settings", async ctx => {
    await ctx.need("members", "v", { elevated: true });
    const S = await peopleSettings(ctx.env);
    const { results } = await ctx.env.DB.prepare("SELECT id, name, level FROM roles ORDER BY level DESC").all();
    return json({ ...S, fields: FIELDS, defaultVisibility: DEFAULT_VISIBILITY, editorsOnly: EDITORS_ONLY, roles: results });
  }),
  route("POST", "/admin/people-settings", async ctx => {
    await ctx.need("members", "e", { elevated: true });
    const b = await ctx.body(), cur = await peopleSettings(ctx.env);
    const keys = { ranks: "ranks", positions: "positions", statuses: "membership_statuses" };
    for (const [k, key] of Object.entries(keys)) {
      if (b[k] === undefined) continue;
      const v = cleanList(b[k], k);
      if (k === "statuses" && !v.length) fail(400, "At least one membership status is required");
      await putSetting(ctx.env, key, v);
      await ctx.audit("people.settings", "setting", key, { before: cur[k], after: v });
    }
    if (b.visibility !== undefined) {
      await ctx.need("members", "a", { elevated: true });
      const v = cleanVis(b.visibility);
      await putSetting(ctx.env, "profile_visibility", v);
      await ctx.audit("people.visibility", "setting", "profile_visibility", { before: cur.visibility, after: v });
    }
    return json({ ok: true });
  }),

  /* ===== Memorials: publiski ===== */
  route("GET", "/memorials", async ctx => {
    const { results } = await ctx.env.DB.prepare("SELECT * FROM memorials WHERE status = 'published' ORDER BY COALESCE(died, '') DESC, created DESC LIMIT 300").all();
    return json({ memorials: results.map(m => memorialOut(m)), defaultText: MEMORIAL_TEXT, canSubmit: await ctx.can("memorials", "c"), canEdit: await ctx.can("memorials", "e") });
  }),
  route("GET", /^\/memorials\/([a-z0-9-]{1,64})$/, async (ctx, s) => {
    const { env } = ctx;
    const m = await env.DB.prepare("SELECT * FROM memorials WHERE slug = ?").bind(s).first();
    const editor = await ctx.can("memorials", "e");
    // melnraksti/pārbaudē — tikai redaktoriem (priekšskatījums), pārējiem 404 (neatklāj eksistenci)
    if (!m || (m.status !== "published" && !editor)) fail(404, "Not found");
    const { results } = await env.DB.prepare("SELECT w.id, w.body, w.show_name, w.created, u.name FROM memorial_words w LEFT JOIN users u ON u.id = w.author WHERE w.memorial_id = ? AND w.status = 'published' ORDER BY w.created").bind(m.id).all();
    let mine = [];
    if (ctx.active) mine = (await env.DB.prepare("SELECT id, body, status, created FROM memorial_words WHERE memorial_id = ? AND author = ? AND status = 'pending' ORDER BY created DESC LIMIT 10").bind(m.id, ctx.user.id).all()).results;
    return json({ memorial: memorialOut(m), preview: m.status !== "published",
      words: results.map(w => ({ id: w.id, body: w.body, author: w.show_name ? (w.name || null) : null, created: w.created })),
      myPending: mine.map(w => ({ id: w.id, body: w.body, created: w.created })), canSubmit: m.status === "published" && await ctx.can("memorials", "c") });
  }),
  route("POST", /^\/memorials\/([0-9a-z]{16})\/words$/, async (ctx, id) => {
    await ctx.need("memorials", "c");
    await ctx.limit("mwords:" + ctx.user.id, 6, 3600);
    const b = await ctx.body();
    const m = await ctx.env.DB.prepare("SELECT id, slug, status FROM memorials WHERE id = ?").bind(id).first();
    if (!m || m.status !== "published") fail(404, "Not found");
    const body = text(b.body, 1200, 2, "text");
    const wid = uid(16);
    await ctx.env.DB.prepare("INSERT INTO memorial_words (id, memorial_id, author, body, show_name, status, created) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(wid, id, ctx.user.id, body, bool(b.showName) ? 1 : 0, now()).run();
    await ctx.audit("memorials.words_submit", "memorial_word", wid, { memorial: m.slug, length: body.length, showName: bool(b.showName) });
    return json({ ok: true, id: wid, status: "pending" });
  }),

  /* ===== Memorials: administrācija ===== */
  route("GET", "/admin/memorials", async ctx => {
    await ctx.need("memorials", "e", { elevated: true });
    const { results } = await ctx.env.DB.prepare(`${MEM_SQL} ORDER BY CASE m.status WHEN 'review' THEN 0 WHEN 'draft' THEN 1 WHEN 'published' THEN 2 ELSE 3 END, m.updated DESC LIMIT 500`).all();
    return json({ memorials: results.map(m => memorialOut(m, { admin: true })), defaultText: MEMORIAL_TEXT, canApprove: await ctx.can("memorials", "a") });
  }),
  route("POST", "/admin/memorials", async ctx => {
    await ctx.need("memorials", "c", { elevated: true });
    if (!(await ctx.can("memorials", "e"))) fail(403, "Forbidden", { code: "forbidden" });
    await ctx.limit("memorials:" + ctx.user.id, 40, 3600);
    const { env } = ctx, b = await ctx.body();
    const v = readMemorial(b, null);
    const id = uid(16), t = now();
    const s = await uniqueSlug(env, slugify(b.slug || v.nickname || v.name) || "bralis", id);
    const row = { id, slug: s, ...v, status: "draft", consent_at: v.consent_family ? t : null, created: t, updated: t, created_by: ctx.user.id, updated_by: ctx.user.id };
    const cols = Object.keys(row);
    await env.DB.prepare(`INSERT INTO memorials (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...cols.map(k => row[k] ?? null)).run();
    await syncMemorialFiles(env, row);
    await ctx.audit("memorials.create", "memorial", id, { slug: s, name: v.name, nickname: v.nickname, consentFamily: !!v.consent_family });
    return json({ ok: true, id, slug: s });
  }),
  route("POST", /^\/admin\/memorials\/([0-9a-z]{16})$/, async (ctx, id) => {
    await ctx.need("memorials", "e", { elevated: true });
    const { env } = ctx, b = await ctx.body();
    const before = await env.DB.prepare("SELECT * FROM memorials WHERE id = ?").bind(id).first();
    if (!before) fail(404, "Not found");
    // publicētu kartīti drīkst labot tikai apstiprinātājs (tā saturs jau ir apstiprināts publiskošanai)
    if (before.status === "published") await ctx.need("memorials", "a", { elevated: true });
    const v = readMemorial(b, before);
    if (b.slug !== undefined && slugify(b.slug) && slugify(b.slug) !== before.slug) v.slug = await uniqueSlug(env, slugify(b.slug), id);
    if (before.status === "published" && v.consent_family === 0) fail(409, "Unpublish the card before withdrawing consent", { code: "consent_published" });
    if (v.consent_family === 1 && !before.consent_family) v.consent_at = now();
    if (v.consent_family === 0) v.consent_at = null;
    const d = diff(before, v);
    if (!d.names.length) return json({ ok: true, changed: [] });
    const upd = Object.fromEntries(d.names.map(k => [k, v[k]]));
    upd.updated = now(); upd.updated_by = ctx.user.id;
    await env.DB.prepare(`UPDATE memorials SET ${Object.keys(upd).map(k => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...Object.values(upd).map(x => x ?? null), id).run();
    await syncMemorialFiles(env, { ...before, ...upd });
    const consentKeys = ["consent_family", "consent_by", "consent_note"];
    if (d.names.some(k => consentKeys.includes(k))) await ctx.audit("memorials.consent", "memorial", id, { slug: before.slug, before: { consentFamily: !!before.consent_family, consentBy: before.consent_by }, after: { consentFamily: !!(upd.consent_family ?? before.consent_family), consentBy: upd.consent_by ?? before.consent_by }, noteChanged: "consent_note" in upd });
    const rest = d.names.filter(k => !consentKeys.includes(k) && k !== "consent_at");
    if (rest.length) await ctx.audit("memorials.update", "memorial", id, { slug: upd.slug || before.slug, fields: rest, status: before.status });
    return json({ ok: true, changed: d.names, slug: upd.slug || before.slug });
  }),
  route("POST", /^\/admin\/memorials\/([0-9a-z]{16})\/status$/, async (ctx, id) => {
    const { env } = ctx, b = await ctx.body();
    const to = oneOf(b.status, M_STATUSES);
    const m = await env.DB.prepare("SELECT * FROM memorials WHERE id = ?").bind(id).first();
    if (!m) fail(404, "Not found");
    if (m.status === to) return json({ ok: true, status: to });
    // publicēšana un publikācijas noņemšana — tikai apstiprinātājam; melnraksts ↔ pārbaude — redaktoram
    const approving = to === "published" || m.status === "published";
    await ctx.need("memorials", approving ? "a" : "e", { elevated: true });
    const upd = { status: to, updated: now(), updated_by: ctx.user.id };
    if (to === "published") {
      if (!m.consent_family) fail(409, "Family or legal representative consent must be recorded before publishing", { code: "consent_required" });
      if (!clip(m.consent_by, 160)) fail(409, "Record who approved the card (family / legal representative) before publishing", { code: "approver_required" });
      if (!(m.name || m.nickname)) fail(409, "Name is required", { code: "name_required" });
      upd.approved_by = ctx.user.id; upd.approved_at = now();
    }
    await env.DB.prepare(`UPDATE memorials SET ${Object.keys(upd).map(k => `${k} = ?`).join(", ")} WHERE id = ?`).bind(...Object.values(upd), id).run();
    await syncMemorialFiles(env, { ...m, ...upd });
    await ctx.audit(to === "published" ? "memorials.publish" : m.status === "published" ? "memorials.unpublish" : "memorials.status", "memorial", id, { slug: m.slug, before: m.status, after: to, consentBy: m.consent_by });
    return json({ ok: true, status: to });
  }),
  route("GET", "/admin/memorial-words", async ctx => {
    await ctx.need("memorials", "a", { elevated: true });
    const st = W_STATUSES.includes(ctx.url.searchParams.get("status")) ? ctx.url.searchParams.get("status") : "pending";
    const { results } = await ctx.env.DB.prepare(`SELECT w.*, u.name AS author_name, m.slug, m.name AS m_name, m.nickname AS m_nick, mu.name AS mod_name FROM memorial_words w
      LEFT JOIN users u ON u.id = w.author LEFT JOIN memorials m ON m.id = w.memorial_id LEFT JOIN users mu ON mu.id = w.moderated_by WHERE w.status = ? ORDER BY w.created DESC LIMIT 300`).bind(st).all();
    return json({ words: results.map(w => ({ id: w.id, memorialId: w.memorial_id, slug: w.slug, memorial: w.m_nick || w.m_name, body: w.body, author: w.author_name, showName: !!w.show_name, status: w.status, created: w.created, moderatedBy: w.mod_name, moderatedAt: w.moderated_at })) });
  }),
  route("POST", /^\/admin\/memorial-words\/([0-9a-z]{16})$/, async (ctx, id) => {
    await ctx.need("memorials", "a", { elevated: true });
    const b = await ctx.body();
    const to = oneOf(b.status, ["published", "hidden"]);
    const w = await ctx.env.DB.prepare("SELECT id, memorial_id, status FROM memorial_words WHERE id = ?").bind(id).first();
    if (!w) fail(404, "Not found");
    if (w.status === to) return json({ ok: true });
    await ctx.env.DB.prepare("UPDATE memorial_words SET status = ?, moderated_by = ?, moderated_at = ? WHERE id = ?").bind(to, ctx.user.id, now(), id).run();
    await ctx.audit("memorials.words_moderate", "memorial_word", id, { memorial: w.memorial_id, before: w.status, after: to });
    return json({ ok: true });
  })
];
