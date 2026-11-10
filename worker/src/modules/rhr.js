/* Riders Help Riders — nav atsevišķa sadaļa, bet kanāls „rhr” saziņā (worker/src/modules/comms.js):
   saruna kanālā + SOS dēlis + palīdzības punktu tīkls. Piekļuve = drīkst lasīt kanālu „rhr” (pakāpe ≥ kanāla min_level, chat:v).
   Jauns SOS un tā atrisināšana parādās arī kanāla sarunā (sistēmas ziņa) un tiek nosūtīti reāllaikā. */
import { route, json, fail, now, uid, clip, num, oneOf } from "../lib/http.js";
import { roomAccess, loadRoom, postSystem, cast } from "./comms.js";

const SOS_KINDS = ["tyre", "battery", "fuel", "crash", "breakdown", "other"];
const OFFERS = ["tools", "garage", "trailer", "bed", "parts", "tow"];
const RHR = "rhr";
const SOS_SHOW_MS = 48 * 3600e3, RESOLVED_SHOW_MS = 6 * 3600e3;

async function needRhr(ctx, post = false){
  ctx.needUser();
  const a = await roomAccess(ctx, await loadRoom(ctx.env, RHR));
  if (!a.read || (post && !a.post)) fail(403, "Riders Help Riders is not available for your account", { code: "forbidden" });
  return a;
}
const canResolveAny = async ctx => (await ctx.can("chat", "d")) || (await ctx.can("forum", "a"));

export const migrations = [];
export const routes = [
  route("GET", "/sos", async ctx => {
    await needRhr(ctx);
    const u = ctx.user, any = await canResolveAny(ctx);
    const { results } = await ctx.env.DB.prepare(`SELECT s.*, us.name AS author_name,
        (SELECT COUNT(*) FROM sos_resp r WHERE r.sos = s.id) AS resp,
        (SELECT COUNT(*) FROM sos_resp r WHERE r.sos = s.id AND r.user = ?) AS responding,
        (SELECT group_concat(u2.name, ', ') FROM sos_resp r JOIN users u2 ON u2.id = r.user WHERE r.sos = s.id) AS resp_names
      FROM sos s JOIN users us ON us.id = s.author
      WHERE (s.resolved = 0 AND s.created > ?) OR s.created > ? ORDER BY s.resolved, s.created DESC LIMIT 50`).bind(u.id, now() - SOS_SHOW_MS, now() - RESOLVED_SHOW_MS).all();
    return json({ items: results.map(r => ({ id: r.id, kind: r.kind, note: r.note, phone: r.phone, lat: r.lat, lon: r.lon, author: r.author, authorName: r.author_name, created: r.created, resolved: !!r.resolved, responders: r.resp, responderNames: r.resp_names || "", responding: !!r.responding, mine: r.author === u.id, canResolve: !r.resolved && (r.author === u.id || any) })) });
  }),
  route("POST", "/sos", async ctx => {
    await needRhr(ctx, true);
    const u = ctx.user;
    await ctx.limit("sos:" + u.id, 3, 600);
    const b = await ctx.body();
    const id = uid(), kind = oneOf(b.kind, SOS_KINDS, "other"), note = clip(b.note, 500);
    await ctx.env.DB.prepare("INSERT INTO sos (id, kind, note, phone, lat, lon, author, created, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)")
      .bind(id, kind, note, clip(b.phone, 30), num(b.lat, -90, 90, "lat"), num(b.lon, -180, 180, "lon"), u.id, now()).run();
    await postSystem(ctx, RHR, { event: "sos", sos: id, sosKind: kind }, note);
    cast(ctx, RHR, { type: "sos" });
    return json({ ok: true, id });
  }),
  route("POST", /^\/sos\/(\w+)\/(respond|resolve)$/, async (ctx, id, act) => {
    await needRhr(ctx, true);
    const u = ctx.user;
    const s = await ctx.env.DB.prepare("SELECT author, resolved, kind FROM sos WHERE id = ?").bind(id).first();
    if (!s) fail(404, "Not found");
    if (act === "respond") {
      if (s.resolved) fail(400, "This request is already resolved");
      const ex = await ctx.env.DB.prepare("SELECT 1 FROM sos_resp WHERE sos = ? AND user = ?").bind(id, u.id).first();
      await ctx.env.DB.prepare(ex ? "DELETE FROM sos_resp WHERE sos = ? AND user = ?" : "INSERT INTO sos_resp (sos, user) VALUES (?, ?)").bind(id, u.id).run();
      cast(ctx, RHR, { type: "sos" });
      return json({ ok: true, responding: !ex });
    }
    if (s.resolved) return json({ ok: true });
    const own = s.author === u.id;
    if (!own && !(await canResolveAny(ctx))) fail(403, "Only the author or a moderator can close this request", { code: "forbidden" });
    await ctx.env.DB.prepare("UPDATE sos SET resolved = 1 WHERE id = ?").bind(id).run();
    if (!own) await ctx.audit("comms.sos.resolve", "sos", id, { author: s.author, kind: s.kind });
    await postSystem(ctx, RHR, { event: "sos_resolved", sos: id, sosKind: s.kind });
    cast(ctx, RHR, { type: "sos" });
    return json({ ok: true });
  }),
  route("GET", "/helpers", async ctx => {
    await needRhr(ctx);
    const { results } = await ctx.env.DB.prepare("SELECT h.*, u.name FROM helpers h JOIN users u ON u.id = h.user_id WHERE u.status = 'active' ORDER BY h.updated DESC LIMIT 500").all();
    return json({ items: results.map(r => { let offers = []; try { offers = JSON.parse(r.offers || "[]"); } catch (e) {} return { id: r.user_id, name: r.name, city: r.city, offers, note: r.note, contact: r.contact, lat: r.lat, lon: r.lon, updated: r.updated, mine: r.user_id === ctx.user.id }; }) });
  }),
  route("POST", "/helpers", async ctx => {
    await needRhr(ctx, true);
    const u = ctx.user;
    await ctx.limit("helper:" + u.id, 10, 600);
    const b = await ctx.body(); const offers = [...new Set((Array.isArray(b.offers) ? b.offers : []).filter(o => OFFERS.includes(o)))];
    if (!offers.length) fail(400, "Choose at least one way you can help");
    // atrašanās vieta noapaļota līdz ~1 km — precīza adrese netiek glabāta
    await ctx.env.DB.prepare("INSERT INTO helpers (user_id, city, offers, note, contact, lat, lon, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET city = excluded.city, offers = excluded.offers, note = excluded.note, contact = excluded.contact, lat = excluded.lat, lon = excluded.lon, updated = excluded.updated")
      .bind(u.id, clip(b.city, 60), JSON.stringify(offers), clip(b.note, 200), clip(b.contact, 80), Math.round(num(b.lat, -90, 90, "lat") * 100) / 100, Math.round(num(b.lon, -180, 180, "lon") * 100) / 100, now()).run();
    return json({ ok: true });
  }),
  route("DELETE", "/helpers", async ctx => {
    await needRhr(ctx);
    await ctx.env.DB.prepare("DELETE FROM helpers WHERE user_id = ?").bind(ctx.user.id).run();
    return json({ ok: true });
  })
];
