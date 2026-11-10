/* Riders Help Riders kā saziņas tēma: SOS un palīdzības punkti (tikai kluba kontiem). Paplašina saziņas modulis. */
import { route, json, fail, now, uid, clip, num, oneOf } from "../lib/http.js";

const SOS_KINDS = ["tyre", "battery", "fuel", "crash", "breakdown", "other"];
const OFFERS = ["tools", "garage", "trailer", "bed", "parts", "tow"];
export const migrations = [];
export const routes = [
  route("GET", "/sos", async ctx => {
    const u = ctx.needUser();
    const { results } = await ctx.env.DB.prepare("SELECT s.*, us.name AS author_name, (SELECT COUNT(*) FROM sos_resp r WHERE r.sos = s.id) AS resp, (SELECT COUNT(*) FROM sos_resp r WHERE r.sos = s.id AND r.user = ?) AS responding FROM sos s JOIN users us ON us.id = s.author WHERE s.resolved = 0 OR s.created > ? ORDER BY s.created DESC LIMIT 50").bind(u.id, now() - 6 * 3600e3).all();
    return json({ items: results.map(r => ({ id: r.id, kind: r.kind, note: r.note, phone: r.phone, lat: r.lat, lon: r.lon, authorName: r.author_name, created: r.created, resolved: !!r.resolved, responders: r.resp, responding: !!r.responding, mine: r.author === u.id })) });
  }),
  route("POST", "/sos", async ctx => {
    const u = ctx.needUser();
    await ctx.limit("sos:" + u.id, 3);
    const b = await ctx.body();
    const id = uid();
    await ctx.env.DB.prepare("INSERT INTO sos (id, kind, note, phone, lat, lon, author, created, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)")
      .bind(id, oneOf(b.kind, SOS_KINDS, "other"), clip(b.note, 500), clip(b.phone, 30), num(b.lat, -90, 90, "lat"), num(b.lon, -180, 180, "lon"), u.id, now()).run();
    return json({ ok: true, id });
  }),
  route("POST", /^\/sos\/(\w+)\/(respond|resolve)$/, async (ctx, id, act) => {
    const u = ctx.needUser();
    if (act === "respond") {
      const ex = await ctx.env.DB.prepare("SELECT 1 FROM sos_resp WHERE sos = ? AND user = ?").bind(id, u.id).first();
      await ctx.env.DB.prepare(ex ? "DELETE FROM sos_resp WHERE sos = ? AND user = ?" : "INSERT INTO sos_resp (sos, user) VALUES (?, ?)").bind(id, u.id).run();
    } else {
      const s = await ctx.env.DB.prepare("SELECT author FROM sos WHERE id = ?").bind(id).first(); if (!s) fail(404, "Not found");
      if (s.author !== u.id && !(await ctx.can("forum", "a"))) fail(403, "Forbidden");
      await ctx.env.DB.prepare("UPDATE sos SET resolved = 1 WHERE id = ?").bind(id).run();
    }
    return json({ ok: true });
  }),
  route("GET", "/helpers", async ctx => {
    ctx.needUser();
    const { results } = await ctx.env.DB.prepare("SELECT h.*, u.name FROM helpers h JOIN users u ON u.id = h.user_id WHERE u.status = 'active' ORDER BY h.updated DESC LIMIT 500").all();
    return json({ items: results.map(r => ({ id: r.user_id, name: r.name, city: r.city, offers: JSON.parse(r.offers || "[]"), note: r.note, contact: r.contact, lat: r.lat, lon: r.lon })) });
  }),
  route("POST", "/helpers", async ctx => {
    const u = ctx.needUser();
    const b = await ctx.body(); const offers = (Array.isArray(b.offers) ? b.offers : []).filter(o => OFFERS.includes(o));
    await ctx.env.DB.prepare("INSERT INTO helpers (user_id, city, offers, note, contact, lat, lon, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET city = excluded.city, offers = excluded.offers, note = excluded.note, contact = excluded.contact, lat = excluded.lat, lon = excluded.lon, updated = excluded.updated")
      .bind(u.id, clip(b.city, 60), JSON.stringify(offers), clip(b.note, 200), clip(b.contact, 80), Math.round(num(b.lat, -90, 90, "lat") * 100) / 100, Math.round(num(b.lon, -180, 180, "lon") * 100) / 100, now()).run();
    return json({ ok: true });
  })
];
