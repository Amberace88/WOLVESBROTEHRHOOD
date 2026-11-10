/* Moto pasākumi (3. sadaļa): vienots kalendārs ar redakcionālu apstiprināšanu.
   Publiski redzami tikai publicēti (un noslēgušies) pasākumi ar avotu; biedri var ieteikt (→ „pārbaudē”),
   publicē tikai lietotāji ar events:a. iCal plūsma (RFC 5545) un atsevišķa pasākuma .ics ar atgādinājumu.
   Nekas netiek dzēsts — tikai arhivēts. Katra izmaiņa audita žurnālā. */
import { route, json, fail, now, uid, clip, optNum, oneOf, bool, date, url, slug as slugify, ml, parseJSON, isDate, LANGS } from "../lib/http.js";
import { audit } from "../lib/core.js";
import { registerFileUpload, registerFileAccess } from "./files.js";
import EU_SEED from "../data/eu-events-seed.json";
import LV_RESEARCH from "../data/lv-events-research.json";

export const CATEGORIES = ["lv-moto", "eu-moto", "lv-other", "eu-other"];
export const TYPES = ["rally", "festival", "expo", "race", "ride", "custom-show", "season", "show", "other"];
export const STATUSES = ["draft", "review", "published", "cancelled", "ended"];
const WATCH_STATUSES = ["open", "added", "dismissed"];
const SITE = "https://wolvesbrotherhoodmc.com";
const SYSTEM = "wbmc-system";

/* šodiena Latvijas laikā (YYYY-MM-DD) */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/* ---------- sākotnējie dati (migrācijas) ---------- */
const SEED_TS = Date.parse("2026-11-10T12:00:00Z"), SEED_DAY = "2026-11-10";
const q = v => v === null || v === undefined || v === "" ? "NULL" : typeof v === "number" ? (Number.isFinite(v) ? String(v) : "NULL") : `'${String(v).replace(/'/g, "''")}'`;
const COLS = ["id", "slug", "category", "type", "title", "description", "start", '"end"', "start_time", "country", "region", "city", "venue", "lat", "lng", "organizer", "official_url", "source_url", "source_note", "status", "official", "image", "archived", "created", "updated", "created_by", "updated_by", "published_at"];
const seedInsert = e => `INSERT OR IGNORE INTO events (${COLS.join(", ")}) VALUES (${[
  e.id, e.id, e.category, e.type, JSON.stringify(e.title), JSON.stringify(e.description || {}), e.start, e.end, null, e.country, e.region || null, e.city || null, e.venue || null,
  e.lat ?? null, e.lng ?? null, e.organizer || null, e.official_url || null, e.source_url || null, e.source_note || null, e.status, 0, null, 0, SEED_TS, SEED_TS, SYSTEM, SYSTEM,
  e.status === "published" || e.status === "ended" ? SEED_TS : null].map(q).join(", ")})`;

/* Latvijas pasākumi, kurus aizstāj detalizētākie Latvijas izpētes ieraksti (lai kalendārā nebūtu dublikātu) */
const REPLACED_BY_RESEARCH = { "mxgp-latvia-2027": "mxgp-latvia-2027", "sgp-riga-2027": "sgp2-latvia-riga-2027 + speedwaygp-latvia-riga-2027", "outdoor-riga-moto-velo-2027": "outdoor-riga-2027-moto-bikes" };
const EU_ROWS = EU_SEED.filter(e => !REPLACED_BY_RESEARCH[e.id]).map(e => {
  const estimated = e.status !== "confirmed";
  const status = estimated ? "review" : e.end < SEED_DAY ? "ended" : "published";
  const note = [
    estimated ? "NAV PUBLICĒTS: datums aprēķināts pēc iepriekšējo gadu prakses — organizators vēl nav paziņojis oficiālo datumu. Pārbaudi oficiālajā lapā un tikai tad publicē." : "",
    `Imports no WBMC pētījuma (eu-events.json, 2026-11): ${e.note || ""}`.trim()
  ].filter(Boolean).join("\n");
  return { id: e.id, category: e.cc === "LV" ? "lv-moto" : "eu-moto", type: TYPES.includes(e.type) ? e.type : "other", title: { lv: e.name, en: e.name }, description: e.desc,
    start: e.start, end: e.end, country: e.cc, city: e.city, venue: e.venue, lat: e.lat, lng: e.lon, official_url: e.url, source_url: e.source, source_note: note, status };
});
const LV_REVIEW = {
  "mxgp-latvia-2027": "NAV PUBLICĒTS: FIM/Infront 2027. gada MXGP kalendārs ir provizorisks. Pirms publicēšanas pārbaudi mxgp.com un aula.lv.",
  "baltic-international-airshow-2027": "NAV PUBLICĒTS: oficiālo lapu balticairshow.com neizdevās atvērt; datums zināms tikai no biļešu tirgotāja un MILAVIA. 2025. gada šovs tika atcelts dažas dienas iepriekš — pārbaudi pie organizatora."
};
const LV_TYPE = { exhibition: "expo", show: "show", race: "race" };
const LV_ROWS = LV_RESEARCH.confirmed.map(e => ({
  id: e.id, category: e.category, type: LV_TYPE[e.type] || (TYPES.includes(e.type) ? e.type : "other"), title: { lv: e.title_lv, en: e.title_en }, description: { lv: e.desc_lv, en: e.desc_en },
  start: e.start, end: e.end, country: "LV", region: e.region, city: e.city, venue: e.venue, lat: e.lat, lng: e.lng, organizer: e.organizer,
  official_url: e.official_url, source_url: e.source_url, source_note: [LV_REVIEW[e.id], `Latvijas pasākumu izpēte (${LV_RESEARCH.generated}): ${e.source_note}`].filter(Boolean).join("\n"),
  status: LV_REVIEW[e.id] ? "review" : e.end < SEED_DAY ? "ended" : "published"
}));
const WATCH_ROWS = LV_RESEARCH.unconfirmed.map(w => `INSERT OR IGNORE INTO event_watch (id, category, title, typical_month, city, organizer, last_edition, source_url, note, status, event_id, created, updated, updated_by) VALUES (${[
  w.id, w.category, JSON.stringify({ lv: w.title_lv, en: w.title_en }), w.typical_month, w.city, w.organizer, w.last_edition, w.source_url, w.note, "open", null, SEED_TS, SEED_TS, SYSTEM].map(q).join(", ")})`);

export const migrations = [
  { id: "events-001-schema", sql: [
    `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, slug TEXT NOT NULL, category TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      start TEXT NOT NULL, "end" TEXT NOT NULL, start_time TEXT, country TEXT, region TEXT, city TEXT, venue TEXT, lat REAL, lng REAL, organizer TEXT,
      official_url TEXT, source_url TEXT, source_note TEXT, status TEXT NOT NULL DEFAULT 'draft', official INTEGER NOT NULL DEFAULT 0, image TEXT,
      archived INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL, created_by TEXT, updated_by TEXT, published_at INTEGER)`,
    "CREATE INDEX IF NOT EXISTS events_status_start ON events(status, start)",
    "CREATE INDEX IF NOT EXISTS events_cat_start ON events(category, start)",
    "CREATE INDEX IF NOT EXISTS events_slug ON events(slug)",
    `CREATE TABLE IF NOT EXISTS event_watch (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, typical_month TEXT, city TEXT, organizer TEXT,
      last_edition TEXT, source_url TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'open', event_id TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, updated_by TEXT)`
  ] },
  { id: "events-002-seed-eu-2026-11", sql: EU_ROWS.map(seedInsert) },
  { id: "events-003-seed-lv-2026-11", sql: LV_ROWS.map(seedInsert) },
  { id: "events-004-watch-lv-2026-11", sql: WATCH_ROWS }
];

/* ---------- attēlojums ---------- */
const effStatus = (r, d = today()) => r.status === "published" && r.end < d ? "ended" : r.status;
const pub = (r, d) => ({
  id: r.id, slug: r.slug, category: r.category, type: r.type, title: parseJSON(r.title, {}), description: parseJSON(r.description, {}),
  start: r.start, end: r.end, startTime: r.start_time || null, country: r.country || null, region: r.region || null, city: r.city || null, venue: r.venue || null,
  lat: r.lat ?? null, lng: r.lng ?? null, organizer: r.organizer || null, officialUrl: r.official_url || null, sourceUrl: r.source_url || null,
  official: !!r.official, status: effStatus(r, d), image: r.image ? `/api/files/${r.image}` : null, updated: r.updated
});
const adminRow = (r, d) => ({ ...pub(r, d), rawStatus: r.status, sourceNote: r.source_note || "", imageId: r.image || null, archived: !!r.archived,
  created: r.created, createdBy: r.created_by, createdByName: r.created_name || null, updatedByName: r.updated_name || null, publishedAt: r.published_at || null });
const PUBLIC_WHERE = `archived = 0 AND (status IN ('published','ended') OR (status = 'cancelled' AND published_at IS NOT NULL))`;
const cacheHdr = ctx => ({ "Cache-Control": ctx.user ? "private, max-age=60" : "public, max-age=300" });

/* ---------- ievades pārbaude ---------- */
const rowToInput = r => ({ category: r.category, type: r.type, title: parseJSON(r.title, {}), description: parseJSON(r.description, {}), start: r.start, end: r.end, startTime: r.start_time,
  country: r.country, region: r.region, city: r.city, venue: r.venue, lat: r.lat, lng: r.lng, organizer: r.organizer, officialUrl: r.official_url, sourceUrl: r.source_url,
  sourceNote: r.source_note, image: r.image });
function clean(b, base = {}){
  const v = k => b[k] !== undefined ? b[k] : base[k];
  const category = oneOf(v("category"), CATEGORIES, undefined);
  const start = date(v("start"), "start date");
  const end = date(v("end") || start, "end date");
  if (end < start) fail(400, "The end date is before the start date", { code: "ev_dates" });
  if (start < "2000-01-01" || end > "2100-12-31") fail(400, "Invalid date", { code: "ev_dates" });
  const st = clip(v("startTime"), 5);
  if (st && !/^([01]\d|2[0-3]):[0-5]\d$/.test(st)) fail(400, "Start time must be HH:MM");
  const country = clip(v("country"), 2).toUpperCase() || (category.startsWith("lv-") ? "LV" : "");
  if (!/^[A-Z]{2}$/.test(country)) fail(400, "Choose a country", { code: "ev_country" });
  if (category.startsWith("lv-") !== (country === "LV")) fail(400, "Latvian categories are for events in Latvia (LV), European categories for other countries", { code: "ev_country" });
  const lat = optNum(v("lat"), -90, 90, "latitude"), lng = optNum(v("lng"), -180, 180, "longitude");
  if ((lat === null) !== (lng === null)) fail(400, "Give both latitude and longitude, or neither");
  const img = clip(v("image"), 20);
  if (img && !/^[0-9a-z]{20}$/.test(img)) fail(400, "Invalid image");
  return {
    category, type: oneOf(v("type"), TYPES, "other"), title: ml(v("title"), 200, true, "title"), description: ml(v("description"), 1500),
    start, end, start_time: st || null, country, region: clip(v("region"), 60) || null, city: clip(v("city"), 80) || null, venue: clip(v("venue"), 160) || null,
    lat, lng, organizer: clip(v("organizer"), 160) || null, official_url: url(v("officialUrl"), "official link") || null, source_url: url(v("sourceUrl"), "source link") || null,
    source_note: clip(v("sourceNote"), 1500) || null, image: img || null
  };
}
const needSource = f => { if (!f.official_url && !f.source_url) fail(400, "Add an official or source link before publishing", { code: "ev_source" }); };
const getRow = (env, id) => env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
const diff = (a, b) => {
  const before = {}, after = {};
  for (const k of Object.keys(b)) { const x = a[k] ?? null, y = b[k] ?? null; if (JSON.stringify(x) !== JSON.stringify(y)) { before[k] = x; after[k] = y; } }
  return { before, after };
};
const dbFields = f => ({ ...f, title: JSON.stringify(f.title), description: JSON.stringify(f.description || {}) });
async function uniqueSlug(env, f, id){
  const base = (slugify(f.title.lv || f.title.en || "pasakums") || "pasakums").slice(0, 52) + "-" + f.start.slice(0, 4);
  let s = base, n = 1;
  while (await env.DB.prepare("SELECT 1 FROM events WHERE slug = ? AND id != ?").bind(s, id).first()) s = `${base}-${++n}`;
  return s;
}
async function publishImage(env, row){ if (row.image && row.status === "published") await env.DB.prepare("UPDATE files SET public = 1 WHERE id = ? AND ctx_type = 'event'").bind(row.image).run(); }

/* ---------- iCalendar (RFC 5545) ---------- */
const icsText = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
const ENC = new TextEncoder();
/* rindu loka pēc 75 oktetiem (UTF-8), nesadalot rakstzīmes; turpinājuma rinda sākas ar atstarpi */
export function fold(line){
  const out = []; let cur = "", n = 0;
  for (const ch of line) {
    const b = ENC.encode(ch).length;
    if (n + b > 75) { out.push(cur); cur = " " + ch; n = 1 + b; } else { cur += ch; n += b; }
  }
  out.push(cur);
  return out.join("\r\n");
}
const ymd = s => s.replace(/-/g, "");
const nextDay = s => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const stamp = ts => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ICS_L = {
  lv: { org: "Organizators", off: "Oficiālā informācija", src: "Avots", time: "Sākums", more: "WBMC kalendārā", remind: "Rīt", cancelled: "ATCELTS", worldwide: "visā pasaulē" },
  en: { org: "Organiser", off: "Official information", src: "Source", time: "Starts", more: "In the WBMC calendar", remind: "Tomorrow", cancelled: "CANCELLED", worldwide: "worldwide" }
};
const pick = (o, l) => (o && (o[l] || o.en || o.lv || Object.values(o)[0])) || "";
const countryName = (cc, l) => { if (!cc) return ""; if (cc === "EU") return (ICS_L[l] || ICS_L.en).worldwide; try { return new Intl.DisplayNames([l === "no" ? "nb" : l], { type: "region" }).of(cc) || cc; } catch (e) { return cc; } };
const pageUrl = (l, id) => `${SITE}/${l === "lv" ? "" : l + "/"}pasakumi.html#e-${encodeURIComponent(id)}`;
function vevent(e, l, { alarm = false } = {}){
  const T = ICS_L[l] || ICS_L.en;
  const title = pick(e.title, l), cancelled = e.status === "cancelled";
  const loc = [e.venue, e.city, countryName(e.country, l)].filter(Boolean).join(", ");
  const desc = [pick(e.description, l), "",
    e.startTime ? `${T.time}: ${e.startTime}` : "", e.organizer ? `${T.org}: ${e.organizer}` : "",
    e.officialUrl ? `${T.off}: ${e.officialUrl}` : "", e.sourceUrl && e.sourceUrl !== e.officialUrl ? `${T.src}: ${e.sourceUrl}` : "",
    `${T.more}: ${pageUrl(l, e.id)}`].filter((x, i) => x || i === 1).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const lines = [
    "BEGIN:VEVENT", `UID:${e.id}@wolvesbrotherhoodmc.com`, `DTSTAMP:${stamp(now())}`, `LAST-MODIFIED:${stamp(e.updated || now())}`,
    `DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${nextDay(e.end || e.start)}`,
    `SUMMARY:${icsText((cancelled ? T.cancelled + ": " : "") + title)}`,
    loc ? `LOCATION:${icsText(loc)}` : "",
    e.lat !== null && e.lng !== null && e.country !== "EU" ? `GEO:${(+e.lat).toFixed(6)};${(+e.lng).toFixed(6)}` : "",
    `DESCRIPTION:${icsText(desc)}`,
    `URL:${(e.officialUrl || pageUrl(l, e.id)).replace(/[\r\n]/g, "")}`,
    `CATEGORIES:${icsText(e.category)},${icsText(e.type)}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`, "TRANSP:TRANSPARENT"
  ];
  /* atgādinājums dienu iepriekš: pasākums sākas 00:00 (visas dienas), tāpēc -PT15H = iepriekšējā dienā 09:00 */
  if (alarm && !cancelled) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`${T.remind}: ${title}`)}`, "TRIGGER:-PT15H", "END:VALARM");
  lines.push("END:VEVENT");
  return lines.filter(Boolean);
}
function calendar(events, l, opts){
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WBMC//Moto pasakumi//LV", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText("WBMC — Moto pasākumi")}`, "X-WR-TIMEZONE:Europe/Riga", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H",
    ...events.flatMap(e => vevent(e, l, opts)), "END:VCALENDAR"];
  return lines.map(fold).join("\r\n") + "\r\n";
}
const icsLang = ctx => { const l = clip(ctx.url.searchParams.get("lang"), 2).toLowerCase(); return LANGS.includes(l) ? l : "lv"; };
const icsResponse = (body, filename, disp = "inline") => new Response(body, { headers: {
  "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=900", "Content-Disposition": `${disp}; filename="${filename}"` } });

/* ---------- faili (pasākuma attēls) ---------- */
registerFileUpload("event", async ctx => ctx.can("events", "e"));
registerFileAccess("event", async (ctx, file) => ctx.can("events", "v"));

/* ---------- maršruti ---------- */
const ID = "([a-z0-9][a-z0-9-]{2,79})";
export const routes = [
  /* publiskais saraksts */
  route("GET", "/events", async ctx => {
    const sp = ctx.url.searchParams, d = today();
    const from = isDate(sp.get("from")) ? sp.get("from") : d;
    const to = isDate(sp.get("to")) ? sp.get("to") : null;
    const cats = (sp.get("category") || "").split(",").filter(c => CATEGORIES.includes(c));
    const cc = /^[A-Za-z]{2}$/.test(sp.get("country") || "") ? sp.get("country").toUpperCase() : null;
    const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit"), 10) || 200));
    const where = [sp.get("includeCancelled") === "1" ? PUBLIC_WHERE : "archived = 0 AND status IN ('published','ended')", `"end" >= ?`], binds = [from];
    if (to) { where.push("start <= ?"); binds.push(to); }
    if (cats.length) { where.push(`category IN (${cats.map(() => "?").join(",")})`); binds.push(...cats); }
    if (cc) { where.push("country = ?"); binds.push(cc); }
    const { results } = await ctx.env.DB.prepare(`SELECT * FROM events WHERE ${where.join(" AND ")} ORDER BY start, "end", id LIMIT ?`).bind(...binds, limit).all();
    return json({ events: results.map(r => pub(r, d)), today: d }, 200, cacheHdr(ctx));
  }),
  /* iCal plūsma: visi publicētie gaidāmie pasākumi (atceltie — ar STATUS:CANCELLED, lai abonenti to redz) */
  route("GET", "/events.ics", async ctx => {
    const d = today(), l = icsLang(ctx);
    const { results } = await ctx.env.DB.prepare(`SELECT * FROM events WHERE ${PUBLIC_WHERE} AND "end" >= ? ORDER BY start LIMIT 1000`).bind(d).all();
    return icsResponse(calendar(results.map(r => pub(r, d)), l), "wbmc-pasakumi.ics");
  }),
  route("GET", new RegExp(`^/events/${ID}\\.ics$`), async (ctx, id) => {
    const r = await ctx.env.DB.prepare(`SELECT * FROM events WHERE (id = ? OR slug = ?) AND ${PUBLIC_WHERE}`).bind(id, id).first();
    if (!r) fail(404, "Not found");
    return icsResponse(calendar([pub(r)], icsLang(ctx), { alarm: true }), `wbmc-${r.slug || r.id}.ics`, "attachment");
  }),
  route("GET", new RegExp(`^/events/${ID}$`), async ctx => {
    const id = ctx.params[0];
    const r = await ctx.env.DB.prepare(`SELECT * FROM events WHERE (id = ? OR slug = ?) AND ${PUBLIC_WHERE}`).bind(id, id).first();
    if (!r) fail(404, "Not found");
    return json({ event: pub(r) }, 200, cacheHdr(ctx));
  }),

  /* ---- administrācija: „gaidāmie pasākumi bez datuma” (izpētes saraksts) ---- */
  route("GET", "/admin/events/watch", async ctx => {
    await ctx.need("events", "e", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT * FROM event_watch ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'added' THEN 1 ELSE 2 END, category, id").all();
    return json({ items: results.map(w => ({ id: w.id, category: w.category, title: parseJSON(w.title, {}), typicalMonth: w.typical_month, city: w.city, organizer: w.organizer,
      lastEdition: w.last_edition, sourceUrl: w.source_url, note: w.note, status: w.status, eventId: w.event_id, updated: w.updated })) });
  }),
  route("POST", "/admin/events/watch", async ctx => {
    await ctx.need("events", "e", { elevated: true });
    const b = await ctx.body(), id = uid(12);
    const row = { category: oneOf(b.category, CATEGORIES), title: ml(b.title, 200, true, "title"), typical_month: clip(b.typicalMonth, 60) || null, city: clip(b.city, 80) || null,
      organizer: clip(b.organizer, 160) || null, last_edition: b.lastEdition ? date(b.lastEdition, "last edition") : null, source_url: url(b.sourceUrl, "source link") || null, note: clip(b.note, 1000) || null };
    await ctx.env.DB.prepare("INSERT INTO event_watch (id, category, title, typical_month, city, organizer, last_edition, source_url, note, status, created, updated, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)")
      .bind(id, row.category, JSON.stringify(row.title), row.typical_month, row.city, row.organizer, row.last_edition, row.source_url, row.note, now(), now(), ctx.user.id).run();
    await ctx.audit("events.watch_create", "event_watch", id, { after: row });
    return json({ ok: true, id });
  }),
  route("POST", /^\/admin\/events\/watch\/([a-z0-9-]{3,80})$/, async (ctx, id) => {
    await ctx.need("events", "e", { elevated: true });
    const w = await ctx.env.DB.prepare("SELECT * FROM event_watch WHERE id = ?").bind(id).first();
    if (!w) fail(404, "Not found");
    const b = await ctx.body();
    const after = { status: b.status !== undefined ? oneOf(b.status, WATCH_STATUSES) : w.status, note: b.note !== undefined ? clip(b.note, 1000) || null : w.note, event_id: b.eventId !== undefined ? (clip(b.eventId, 80) || null) : w.event_id };
    await ctx.env.DB.prepare("UPDATE event_watch SET status = ?, note = ?, event_id = ?, updated = ?, updated_by = ? WHERE id = ?").bind(after.status, after.note, after.event_id, now(), ctx.user.id, id).run();
    await ctx.audit("events.watch_update", "event_watch", id, diff({ status: w.status, note: w.note, event_id: w.event_id }, after));
    return json({ ok: true });
  }),

  /* ---- administrācija: pasākumi ---- */
  route("GET", "/admin/events", async ctx => {
    await ctx.need("events", "v", { elevated: true });
    const { env } = ctx, d = today(), sp = ctx.url.searchParams;
    const all = (await ctx.can("events", "e")) || (await ctx.can("events", "a"));
    const st = sp.get("status"), archived = sp.get("archived") === "1" ? 1 : 0;
    const where = ["e.archived = ?"], binds = [archived];
    if (!all) { where.push("e.created_by = ?"); binds.push(ctx.user.id); }
    if (st === "ended") { where.push(`(e.status = 'ended' OR (e.status = 'published' AND e."end" < ?))`); binds.push(d); }
    else if (st === "published") { where.push(`e.status = 'published' AND e."end" >= ?`); binds.push(d); }
    else if (STATUSES.includes(st)) { where.push("e.status = ?"); binds.push(st); }
    const [list, cnt] = await env.DB.batch([
      env.DB.prepare(`SELECT e.*, cu.name AS created_name, uu.name AS updated_name FROM events e LEFT JOIN users cu ON cu.id = e.created_by LEFT JOIN users uu ON uu.id = e.updated_by
        WHERE ${where.join(" AND ")} ORDER BY CASE e.status WHEN 'review' THEN 0 WHEN 'draft' THEN 1 WHEN 'published' THEN 2 WHEN 'cancelled' THEN 3 ELSE 4 END, e.start, e.id LIMIT 1000`).bind(...binds),
      env.DB.prepare(`SELECT status, "end", archived FROM events ${all ? "" : "WHERE created_by = ?"}`).bind(...(all ? [] : [ctx.user.id]))
    ]);
    const counts = { draft: 0, review: 0, published: 0, cancelled: 0, ended: 0, archived: 0 };
    for (const r of cnt.results) r.archived ? counts.archived++ : counts[effStatus(r, d)]++;
    return json({ events: list.results.map(r => adminRow(r, d)), counts, today: d, own: !all });
  }),
  route("POST", "/admin/events", async ctx => {
    await ctx.need("events", "c", { elevated: true });
    const { env } = ctx, b = await ctx.body();
    const canA = await ctx.can("events", "a");
    if (!canA) await ctx.limit("evprop:" + ctx.user.id, 10, 3600);
    const f = clean(b);
    /* bez apstiprināšanas tiesībām — tikai ieteikums, kas nonāk pārbaudē */
    const status = canA ? oneOf(b.status, STATUSES, "draft") : "review";
    if (status === "published") needSource(f);
    const official = canA && bool(b.official) ? 1 : 0;
    if (!canA) f.image = null;
    const id = uid(12), t = now(), s = await uniqueSlug(env, f, id);
    const row = { ...dbFields(f), status, official };
    await env.DB.prepare(`INSERT INTO events (id, slug, category, type, title, description, start, "end", start_time, country, region, city, venue, lat, lng, organizer, official_url, source_url, source_note, status, official, image, archived, created, updated, created_by, updated_by, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`)
      .bind(id, s, row.category, row.type, row.title, row.description, row.start, row.end, row.start_time, row.country, row.region, row.city, row.venue, row.lat, row.lng, row.organizer,
        row.official_url, row.source_url, row.source_note, status, official, row.image, t, t, ctx.user.id, ctx.user.id, status === "published" ? t : null).run();
    await publishImage(env, row);
    await ctx.audit(canA ? "events.create" : "events.propose", "event", id, { before: null, after: { ...f, status, official: !!official } });
    return json({ ok: true, id, slug: s, status });
  }),
  route("POST", new RegExp(`^/admin/events/${ID}/official$`), async (ctx, id) => {
    await ctx.need("events", "a", { elevated: true });
    const r = await getRow(ctx.env, id); if (!r) fail(404, "Not found");
    const b = await ctx.body();
    const v = b.official !== undefined ? (bool(b.official) ? 1 : 0) : (r.official ? 0 : 1);
    await ctx.env.DB.prepare("UPDATE events SET official = ?, updated = ?, updated_by = ? WHERE id = ?").bind(v, now(), ctx.user.id, id).run();
    await ctx.audit("events.official", "event", id, { before: { official: !!r.official }, after: { official: !!v } });
    return json({ ok: true, official: !!v });
  }),
  route("POST", new RegExp(`^/admin/events/${ID}/restore$`), async (ctx, id) => {
    await ctx.need("events", "d", { elevated: true });
    const r = await getRow(ctx.env, id); if (!r) fail(404, "Not found");
    await ctx.env.DB.prepare("UPDATE events SET archived = 0, updated = ?, updated_by = ? WHERE id = ?").bind(now(), ctx.user.id, id).run();
    await ctx.audit("events.restore", "event", id, { before: { archived: !!r.archived }, after: { archived: false } });
    return json({ ok: true });
  }),
  route("POST", new RegExp(`^/admin/events/${ID}$`), async (ctx, id) => {
    const { env } = ctx;
    ctx.needUser();
    const r = await getRow(env, id); if (!r) fail(404, "Not found");
    const canE = await ctx.can("events", "e"), canA = await ctx.can("events", "a");
    const own = r.created_by === ctx.user.id && ["draft", "review"].includes(r.status) && (await ctx.can("events", "c"));
    await ctx.need("events", canE ? "e" : own ? "c" : "e", { elevated: true });
    if (r.archived) fail(409, "Restore the event from the archive before editing", { code: "ev_archived" });
    const locked = !["draft", "review"].includes(r.status);
    if (locked && !canA) fail(403, "Only approvers can change a published, cancelled or ended event", { code: "ev_locked" });
    const b = await ctx.body();
    const f = clean(b, rowToInput(r));
    let status = r.status;
    if (b.status !== undefined && b.status !== r.status) {
      const ns = oneOf(b.status, STATUSES);
      if (!(["draft", "review"].includes(ns) && !locked) && !canA) fail(403, "Publishing, cancelling and ending events needs approval rights", { code: "forbidden" });
      status = ns;
    }
    if (status === "published") needSource(f);
    let official = r.official;
    if (b.official !== undefined && (bool(b.official) ? 1 : 0) !== r.official) { if (!canA) fail(403, "Forbidden", { code: "forbidden" }); official = bool(b.official) ? 1 : 0; }
    if (!canE) f.image = r.image;
    const t = now(), s = f.title.lv !== parseJSON(r.title, {}).lv || f.start.slice(0, 4) !== r.start.slice(0, 4) ? await uniqueSlug(env, f, id) : r.slug;
    const row = { ...dbFields(f), status, official };
    const publishedAt = status === "published" && !r.published_at ? t : r.published_at;
    await env.DB.prepare(`UPDATE events SET slug = ?, category = ?, type = ?, title = ?, description = ?, start = ?, "end" = ?, start_time = ?, country = ?, region = ?, city = ?, venue = ?, lat = ?, lng = ?,
      organizer = ?, official_url = ?, source_url = ?, source_note = ?, status = ?, official = ?, image = ?, updated = ?, updated_by = ?, published_at = ? WHERE id = ?`)
      .bind(s, row.category, row.type, row.title, row.description, row.start, row.end, row.start_time, row.country, row.region, row.city, row.venue, row.lat, row.lng,
        row.organizer, row.official_url, row.source_url, row.source_note, status, official, row.image, t, ctx.user.id, publishedAt, id).run();
    await publishImage(env, row);
    const prev = { ...rowToInput(r), status: r.status, official: !!r.official }, next = { ...rowToInput({ ...r, ...dbFields(f) }), status, official: !!official };
    const ch = diff(prev, next);
    await ctx.audit(ch.after.status ? "events.status" : "events.update", "event", id, ch);
    return json({ ok: true, status, slug: s });
  }),
  /* „dzēšana” = arhivēšana (nekad neizdzēš ierakstu) */
  route("DELETE", new RegExp(`^/admin/events/${ID}$`), async (ctx, id) => {
    await ctx.need("events", "d", { elevated: true });
    const r = await getRow(ctx.env, id); if (!r) fail(404, "Not found");
    await ctx.env.DB.prepare("UPDATE events SET archived = 1, updated = ?, updated_by = ? WHERE id = ?").bind(now(), ctx.user.id, id).run();
    await ctx.audit("events.archive", "event", id, { before: { archived: !!r.archived, status: r.status }, after: { archived: true } });
    return json({ ok: true });
  })
];

/* reizi dienā: publicētie pasākumi, kuru beigu datums pagājis → „noslēdzies” */
export async function scheduled(env){
  const d = today();
  const { results } = await env.DB.prepare(`UPDATE events SET status = 'ended', updated = ?, updated_by = ? WHERE status = 'published' AND "end" < ? RETURNING id`).bind(now(), SYSTEM, d).all();
  if (results && results.length) await audit(env, { user: null, ip: null }, "events.auto_end", "event", null, { ids: results.map(r => r.id).slice(0, 100), count: results.length, before: "published", after: "ended" });
}
