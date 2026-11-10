/* Ride HQ: ceļa brīdinājumi, „bars” (reāllaika atrašanās vieta), kluba pieturas (places), saglabātie maršruti, degvielas cenas.
   Degvielas cenas: EK Weekly Oil Bulletin (oficiāli, CC BY 4.0) + SSB tabula 09654 Norvēģijai. Nekas netiek izdomāts —
   ja avots nav pieejams, API atgriež to, kas ir saglabāts (ar datumu), vai { available: false }. */
import { route, json, fail, now, uid, clip, text, num, optNum, oneOf, bool, url, ml, arr, parseJSON } from "../lib/http.js";
import { getSetting, putSetting } from "../lib/core.js";
import { parseWOBFile, jsonStatValue } from "../lib/xlsx.js";

const HAZ_KINDS = ["gravel", "potholes", "oil", "roadworks", "animals", "other"];
const PLACE_KINDS = ["cafe", "fuel", "service", "rest", "lodging", "meeting", "viewpoint", "other"];
const PLACE_STATUS = ["draft", "published", "archived"];
const MAX_POINTS = 12, MAX_ROUTES_PER_USER = 200;

export const migrations = [
  { id: "ridehq-001-places-routes", sql: [
    "CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, description TEXT, lat REAL NOT NULL, lng REAL NOT NULL, address TEXT, url TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, updated_by TEXT)",
    "CREATE INDEX IF NOT EXISTS places_status ON places(status, name)",
    "CREATE TABLE IF NOT EXISTS saved_routes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, points TEXT NOT NULL, round_trip INTEGER NOT NULL DEFAULT 0, distance_km REAL, duration_min INTEGER, visibility TEXT NOT NULL DEFAULT 'private', created INTEGER NOT NULL, updated INTEGER)",
    "CREATE INDEX IF NOT EXISTS saved_routes_owner ON saved_routes(owner, created DESC)",
    "CREATE INDEX IF NOT EXISTS saved_routes_vis ON saved_routes(visibility, created DESC)"
  ] }
];

/* ---------- degvielas cenas ---------- */
const UA = "WBMC-RideHQ/2.0 (+https://wolvesbrotherhoodmc.com; fuel price import, once per day)";
export const FUEL = {
  ecFile: "https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en",
  ecPage: "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
  ssbApi: "https://data.ssb.no/api/v0/en/table/09654",
  ssbPage: "https://www.ssb.no/en/statbank/table/09654"
};
const DAY = 864e5, STALE_FETCH = 8 * DAY, STALE_PRICE = 15 * DAY, RETRY_AFTER = 3600e3;
const isZip = b => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;
async function get(u, opt = {}){
  const r = await fetch(u, { ...opt, headers: { "User-Agent": UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(20000), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${new URL(u).host}`);
  return r;
}
async function downloadWOB(){
  let r = await get(FUEL.ecFile), b = new Uint8Array(await r.arrayBuffer());
  if (isZip(b)) return { buf: b, fileUrl: FUEL.ecFile };
  // rezerves ceļš: dokumenta UUID nomainīts → meklējam saiti biļetena lapā
  const page = await (await get(FUEL.ecPage)).text();
  const m = page.match(/href="([^"]*\/document\/download\/[^"]*prices(?:%20|\s|_|-)+with(?:%20|\s|_|-)+taxes[^"]*)"/i);
  if (!m) throw new Error("WOB link not found on bulletin page");
  const link = new URL(m[1].replace(/&amp;/g, "&"), FUEL.ecPage).toString();
  r = await get(link); b = new Uint8Array(await r.arrayBuffer());
  if (!isZip(b)) throw new Error("WOB download is not an XLSX file");
  return { buf: b, fileUrl: link };
}
async function status(env, src, patch){
  const s = (await getSetting(env, "fuel_status", {})) || {};
  s[src] = { ...(s[src] || {}), ...patch };
  await putSetting(env, "fuel_status", s);
  return s;
}
/* EK biļetens: lejupielāde (vai administratora augšupielādēts oriģinālais fails) → parsēšana Worker'ī → settings.fuel_prices */
export async function refreshEC(env, { buf, via = "auto", by = null } = {}){
  await status(env, "ec", { attempt: now() });
  try {
    let fileUrl = FUEL.ecFile;
    if (!buf) ({ buf, fileUrl } = await downloadWOB());
    const p = await parseWOBFile(buf);
    const prev = await getSetting(env, "fuel_prices");
    if (prev && prev.date > p.date && via !== "auto") throw new Error(`file is older (${p.date}) than stored data (${prev.date})`);
    const data = {
      ...p, kind: "official", currency: "EUR",
      source: "European Commission — Weekly Oil Bulletin (prices with taxes)", sourceUrl: FUEL.ecPage, fileUrl: via === "upload" ? null : fileUrl,
      license: "CC BY 4.0", attribution: "© European Union, Weekly Oil Bulletin (DG ENER)", fetchedAt: now(), via, by
    };
    if (!prev || p.date >= prev.date || via !== "auto") await putSetting(env, "fuel_prices", data);
    else await putSetting(env, "fuel_prices", { ...prev, fetchedAt: now() }); // avots vēl rāda veco nedēļu — saglabātais paliek
    await status(env, "ec", { ok: true, okAt: now(), error: null, date: p.date });
    return { ok: true, date: p.date, countries: Object.keys(p.countries).length };
  } catch (e) {
    await status(env, "ec", { ok: false, error: String(e && e.message || e).slice(0, 300) });
    return { ok: false, error: String(e && e.message || e) };
  }
}
/* SSB 09654: benzīns 95 (031) un dīzelis (035), NOK/l, mēneša vidējā */
export async function refreshNO(env){
  await status(env, "no", { attempt: now() });
  try {
    const body = { query: [
      { code: "PetroleumProd", selection: { filter: "item", values: ["031", "035"] } },
      { code: "ContentsCode", selection: { filter: "item", values: ["Priser"] } },
      { code: "Tid", selection: { filter: "top", values: ["1"] } }
    ], response: { format: "json-stat2" } };
    const js = await (await get(FUEL.ssbApi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    const tid = Object.keys(js.dimension.Tid.category.index)[0];
    const val = c => { const v = jsonStatValue(js, { PetroleumProd: c, ContentsCode: "Priser", Tid: tid }); return v !== null && v > 5 && v < 60 ? Math.round(v * 100) / 100 : null; };
    const m = String(tid).match(/^(\d{4})M(\d{2})$/); if (!m) throw new Error("SSB: unexpected period " + tid);
    const data = {
      kind: "official", country: "NO", currency: "NOK", unit: "NOK/l", frequency: "monthly", period: `${m[1]}-${m[2]}`,
      e95: val("031"), diesel: val("035"), lpg: null,
      source: "Statistics Norway (SSB), table 09654", sourceUrl: FUEL.ssbPage, license: "CC BY 4.0", attribution: "Statistics Norway (SSB)", fetchedAt: now()
    };
    if (data.e95 === null && data.diesel === null) throw new Error("SSB: no values");
    await putSetting(env, "fuel_prices_no", data);
    await status(env, "no", { ok: true, okAt: now(), error: null, date: data.period });
    return { ok: true, period: data.period };
  } catch (e) {
    await status(env, "no", { ok: false, error: String(e && e.message || e).slice(0, 300) });
    return { ok: false, error: String(e && e.message || e) };
  }
}
export async function refreshFuel(env){ const [ec, no] = await Promise.all([refreshEC(env), refreshNO(env)]); return { ec, no }; }
/* cron (reizi dienā, wrangler.jsonc „triggers”) */
export async function scheduled(env){ await refreshFuel(env); }

/* ---------- palīgi ---------- */
const placeOut = (r, full) => ({ id: r.id, name: r.name, kind: r.kind, description: parseJSON(r.description, {}), lat: r.lat, lng: r.lng, address: r.address || "", url: r.url || "",
  ...(full ? { status: r.status, created: r.created, updated: r.updated, createdBy: r.created_by_name || null, updatedBy: r.updated_by_name || null } : {}) });
function placeIn(b){
  return {
    name: text(b.name, 120, 2, "name"), kind: oneOf(b.kind, PLACE_KINDS, "other"), description: JSON.stringify(ml(b.description, 600)),
    lat: num(b.lat, -90, 90, "lat"), lng: num(b.lng, -180, 180, "lng"), address: clip(b.address, 200), url: url(b.url, "url", true), status: oneOf(b.status, PLACE_STATUS, "draft")
  };
}
const routeOut = (r, me) => ({ id: r.id, name: r.name, points: parseJSON(r.points, []), roundTrip: !!r.round_trip, distanceKm: r.distance_km, durationMin: r.duration_min,
  visibility: r.visibility, created: r.created, mine: r.owner === me, ownerName: r.owner === me ? null : (r.owner_name || null) });
async function canReadRoute(ctx, r){ return r.owner === ctx.user.id || (r.visibility === "club" && await ctx.can("routes", "v")); }

export const routes = [
  /* ---- ceļa brīdinājumi (biedru ziņojumi, 7 dienas) ---- */
  route("GET", "/hazards", async ctx => {
    const { results } = await ctx.env.DB.prepare("SELECT h.*, u.name AS by_name FROM hazards h JOIN users u ON u.id = h.by_user WHERE h.created > ? ORDER BY h.created DESC LIMIT 300").bind(now() - 7 * 864e5).all();
    const members = ctx.active;
    return json({ items: results.map(r => ({ id: r.id, kind: r.kind, note: r.note, lat: r.lat, lon: r.lon, by: members ? r.by_name : null, created: r.created })), kind: "user", maxAgeDays: 7, at: now() },
      200, { "Cache-Control": members ? "private, max-age=30" : "public, max-age=60" });
  }),
  route("POST", "/hazards", async ctx => {
    const u = ctx.needUser();
    await ctx.limit("haz:" + u.id, 5);
    const b = await ctx.body();
    const id = uid();
    await ctx.env.DB.prepare("INSERT INTO hazards (id, kind, note, lat, lon, by_user, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, oneOf(b.kind, HAZ_KINDS, "other"), clip(b.note, 200), num(b.lat, -90, 90, "lat"), num(b.lon, -180, 180, "lon"), u.id, now()).run();
    return json({ ok: true, id });
  }),
  /* bars: tikai aktīviem kluba kontiem; vārds no konta, nevis no URL */
  route("GET", /^\/pack\/([A-Z0-9-]{3,12})$/i, async (ctx, code) => {
    const u = ctx.needUser();
    if (ctx.req.headers.get("Upgrade") !== "websocket") fail(426, "Expected websocket");
    const h = new Headers(ctx.req.headers); h.set("X-User", JSON.stringify({ id: u.id, name: u.name }));
    return ctx.env.ROOMS.get(ctx.env.ROOMS.idFromName("pack:" + code.toUpperCase())).fetch(new Request("https://room/pack/connect", { headers: h }));
  }),

  /* ---- kluba pieturas ---- */
  route("GET", "/places", async ctx => {
    const { results } = await ctx.env.DB.prepare("SELECT * FROM places WHERE status = 'published' ORDER BY name LIMIT 1000").all();
    return json({ items: results.map(r => placeOut(r)), kind: "club", at: now() }, 200, { "Cache-Control": "public, max-age=300" });
  }),
  route("GET", "/admin/places", async ctx => {
    await ctx.need("places", "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT p.*, a.name AS created_by_name, b.name AS updated_by_name FROM places p LEFT JOIN users a ON a.id = p.created_by LEFT JOIN users b ON b.id = p.updated_by ORDER BY CASE p.status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END, p.name LIMIT 2000").all();
    return json({ items: results.map(r => placeOut(r, true)), kinds: PLACE_KINDS });
  }),
  route("POST", "/admin/places", async ctx => {
    const u = await ctx.need("places", "c", { elevated: true });
    await ctx.limit("places:" + u.id, 30);
    const p = placeIn(await ctx.body()), id = uid(), t = now();
    await ctx.env.DB.prepare("INSERT INTO places (id, name, kind, description, lat, lng, address, url, status, created_by, created, updated, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, p.name, p.kind, p.description, p.lat, p.lng, p.address, p.url, p.status, u.id, t, t, u.id).run();
    await ctx.audit("place.create", "place", id, { after: { ...p, description: parseJSON(p.description, {}) } });
    return json({ ok: true, id });
  }),
  route("POST", /^\/admin\/places\/([0-9a-z]{16})$/, async (ctx, id) => {
    const u = await ctx.need("places", "e", { elevated: true });
    const before = await ctx.env.DB.prepare("SELECT * FROM places WHERE id = ?").bind(id).first();
    if (!before) fail(404, "Not found");
    const p = placeIn(await ctx.body());
    await ctx.env.DB.prepare("UPDATE places SET name = ?, kind = ?, description = ?, lat = ?, lng = ?, address = ?, url = ?, status = ?, updated = ?, updated_by = ? WHERE id = ?")
      .bind(p.name, p.kind, p.description, p.lat, p.lng, p.address, p.url, p.status, now(), u.id, id).run();
    await ctx.audit(before.status !== p.status ? `place.${p.status === "published" ? "publish" : p.status === "archived" ? "archive" : "update"}` : "place.update", "place", id,
      { before: placeOut(before, false), after: { ...p, description: parseJSON(p.description, {}) }, status: [before.status, p.status] });
    return json({ ok: true });
  }),
  route("DELETE", /^\/admin\/places\/([0-9a-z]{16})$/, async (ctx, id) => {
    await ctx.need("places", "d", { elevated: true });
    const before = await ctx.env.DB.prepare("SELECT * FROM places WHERE id = ?").bind(id).first();
    if (!before) fail(404, "Not found");
    await ctx.env.DB.prepare("DELETE FROM places WHERE id = ?").bind(id).run();
    await ctx.audit("place.delete", "place", id, { before: { ...placeOut(before, false), status: before.status } }); // pilns ieraksts auditā → atjaunojams
    return json({ ok: true });
  }),

  /* ---- saglabātie maršruti ---- */
  route("GET", "/routes", async ctx => {
    const u = ctx.needUser();
    const mine = (await ctx.env.DB.prepare("SELECT * FROM saved_routes WHERE owner = ? ORDER BY created DESC LIMIT ?").bind(u.id, MAX_ROUTES_PER_USER).all()).results;
    let club = [];
    if (await ctx.can("routes", "v")) club = (await ctx.env.DB.prepare("SELECT r.*, u.name AS owner_name FROM saved_routes r JOIN users u ON u.id = r.owner WHERE r.visibility = 'club' AND r.owner != ? AND u.status = 'active' ORDER BY r.created DESC LIMIT 100").bind(u.id).all()).results;
    return json({ mine: mine.map(r => routeOut(r, u.id)), club: club.map(r => routeOut(r, u.id)), canShare: await ctx.can("routes", "c") });
  }),
  route("POST", "/routes", async ctx => {
    const u = ctx.needUser();
    await ctx.limit("routes:" + u.id, 20);
    const b = await ctx.body();
    const points = arr(b.points, MAX_POINTS, p => p && typeof p === "object" ? { lat: Math.round(num(p.lat, -90, 90, "lat") * 1e5) / 1e5, lng: Math.round(num(p.lng, -180, 180, "lng") * 1e5) / 1e5, ...(clip(p.name, 80) ? { name: clip(p.name, 80) } : {}) } : null);
    const roundTrip = bool(b.roundTrip);
    if (points.length < 2) fail(400, "At least two points are required");
    const visibility = oneOf(b.visibility, ["private", "club"], "private");
    if (visibility === "club" && !(await ctx.can("routes", "c"))) fail(403, "Forbidden", { code: "forbidden" });
    const n = await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM saved_routes WHERE owner = ?").bind(u.id).first();
    if (n.n >= MAX_ROUTES_PER_USER) fail(400, "Too many saved routes — delete some first", { code: "route_limit" });
    const id = uid(), dist = optNum(b.distanceKm, 0, 30000, "distance"), dur = optNum(b.durationMin, 0, 60000, "duration");
    await ctx.env.DB.prepare("INSERT INTO saved_routes (id, owner, name, points, round_trip, distance_km, duration_min, visibility, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, u.id, text(b.name, 80, 1, "name"), JSON.stringify(points), roundTrip ? 1 : 0, dist === null ? null : Math.round(dist * 10) / 10, dur === null ? null : Math.round(dur), visibility, now(), now()).run();
    return json({ ok: true, id });
  }),
  route("GET", /^\/routes\/([0-9a-z]{16})$/, async (ctx, id) => {
    const u = ctx.needUser();
    const r = await ctx.env.DB.prepare("SELECT r.*, u.name AS owner_name FROM saved_routes r JOIN users u ON u.id = r.owner WHERE r.id = ?").bind(id).first();
    if (!r || !(await canReadRoute(ctx, r))) fail(404, "Not found");
    return json({ route: routeOut(r, u.id) });
  }),
  route("DELETE", /^\/routes\/([0-9a-z]{16})$/, async (ctx, id) => {
    const u = ctx.needUser();
    const r = await ctx.env.DB.prepare("SELECT * FROM saved_routes WHERE id = ?").bind(id).first();
    if (!r || !(await canReadRoute(ctx, r))) fail(404, "Not found");
    if (r.owner !== u.id) {
      await ctx.need("routes", "d", { elevated: true }); // moderācija: tikai kluba koplietotiem maršrutiem
      await ctx.audit("route.delete", "route", id, { before: routeOut(r, null), owner: r.owner });
    }
    await ctx.env.DB.prepare("DELETE FROM saved_routes WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }),

  /* ---- degvielas cenas ---- */
  route("GET", "/fuel", async ctx => {
    const env = ctx.env;
    const [ec, no, st] = await Promise.all([getSetting(env, "fuel_prices"), getSetting(env, "fuel_prices_no"), getSetting(env, "fuel_status", {})]);
    const t = now();
    const needEC = !ec || t - ec.fetchedAt > STALE_FETCH, needNO = !no || t - no.fetchedAt > 40 * DAY;
    const tried = src => st && st[src] && st[src].attempt && t - st[src].attempt < RETRY_AFTER;
    // novecojis → atjaunojam fonā (ne biežāk kā reizi stundā), bet atbildam ar to, kas ir
    if (needEC && !tried("ec")) ctx.waitUntil(refreshEC(env).catch(() => {}));
    if (needNO && !tried("no")) ctx.waitUntil(refreshNO(env).catch(() => {}));
    if (!ec && !no) return json({ available: false, at: t }, 200, { "Cache-Control": "public, max-age=600" });
    const stale = !ec || t - ec.fetchedAt > STALE_FETCH || t - Date.parse(ec.date + "T00:00:00Z") > STALE_PRICE;
    const strip = d => d && (({ by, ...rest }) => rest)(d);
    return json({ available: true, stale, ec: strip(ec), no: strip(no), at: t }, 200, { "Cache-Control": stale ? "public, max-age=600" : "public, max-age=3600" });
  }),
  route("GET", "/admin/fuel", async ctx => {
    await ctx.need((await ctx.can("settings", "v")) ? "settings" : "places", "v", { elevated: true });
    const [ec, no, st] = await Promise.all([getSetting(ctx.env, "fuel_prices"), getSetting(ctx.env, "fuel_prices_no"), getSetting(ctx.env, "fuel_status", {})]);
    return json({ ec: ec ? { date: ec.date, fetchedAt: ec.fetchedAt, via: ec.via, countries: Object.keys(ec.countries || {}).length, source: ec.source } : null,
      no: no ? { period: no.period, fetchedAt: no.fetchedAt, source: no.source } : null, status: st || {}, sources: FUEL });
  }),
  route("POST", "/admin/fuel/refresh", async ctx => {
    const u = await ctx.need("settings", "e", { elevated: true });
    await ctx.limit("fuelref:" + u.id, 6);
    const r = await refreshFuel(ctx.env);
    await ctx.audit("fuel.refresh", "setting", "fuel_prices", r);
    return json(r);
  }),
  /* rezerves ceļš: administrators augšupielādē oriģinālo EK XLSX failu (piem., ja EK saite mainās); parsē tas pats Worker kods */
  route("POST", "/admin/fuel/upload", async ctx => {
    const u = await ctx.need("settings", "e", { elevated: true });
    await ctx.limit("fuelup:" + u.id, 6);
    if (+(ctx.req.headers.get("Content-Length") || 0) > 2 * 1024 * 1024) fail(413, "File too large");
    const buf = new Uint8Array(await ctx.req.arrayBuffer());
    if (buf.length > 2 * 1024 * 1024) fail(413, "File too large");
    if (!isZip(buf)) fail(400, "Not an XLSX file", { code: "type" });
    const r = await refreshEC(ctx.env, { buf, via: "upload", by: u.id });
    await ctx.audit("fuel.upload", "setting", "fuel_prices", { ...r, bytes: buf.length });
    if (!r.ok) fail(400, "Could not read the bulletin file: " + r.error, { code: "fuel_parse" });
    return json(r);
  })
];
