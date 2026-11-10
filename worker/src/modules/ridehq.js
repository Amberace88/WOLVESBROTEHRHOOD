/* Ride HQ: ceļa brīdinājumi, „bars” (reāllaika atrašanās vieta). Paplašina Ride HQ modulis (pieturas, saglabātie maršruti, degvielas cenas). */
import { route, json, fail, now, uid, clip, num, oneOf } from "../lib/http.js";

const HAZ_KINDS = ["gravel", "potholes", "oil", "roadworks", "animals", "other"];
export const migrations = [];
export const routes = [
  route("GET", "/hazards", async ctx => {
    const { results } = await ctx.env.DB.prepare("SELECT h.*, u.name AS by_name FROM hazards h JOIN users u ON u.id = h.by_user WHERE h.created > ? ORDER BY h.created DESC LIMIT 300").bind(now() - 7 * 864e5).all();
    const members = ctx.active;
    return json({ items: results.map(r => ({ id: r.id, kind: r.kind, note: r.note, lat: r.lat, lon: r.lon, by: members ? r.by_name : null, created: r.created })) }, 200, { "Cache-Control": members ? "private, max-age=30" : "public, max-age=60" });
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
  })
];
