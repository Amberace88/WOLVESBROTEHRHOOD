/* Šaha galds: vestibils, izaicinājumi, WebSocket uz partijas Durable Object. Spēlēt drīkst aktīvi kluba konti. */
import { route, json, fail, now, uid } from "../lib/http.js";
import { pubUser } from "../lib/core.js";

const TCS = { "3+2": [3, 2], "5+3": [5, 3], "10+5": [10, 5], "15+10": [15, 10], "30+0": [30, 0], "0+0": [0, 0] };
const sel = "SELECT g.*, wu.name AS wn, bu.name AS bn, wr.elo AS we, br.elo AS be FROM chess_games g LEFT JOIN users wu ON wu.id = g.white LEFT JOIN users bu ON bu.id = g.black LEFT JOIN chess_ratings wr ON wr.user_id = g.white LEFT JOIN chess_ratings br ON br.user_id = g.black ";
const game = r => ({ id: r.id, status: r.status, tc: [r.tc_base / 60000, r.tc_inc / 1000], rated: !!r.rated, created: r.created, ended: r.ended, result: r.result, reason: r.reason,
  creator: r.creator, white: r.white ? { id: r.white, name: r.wn, elo: r.we || 1200 } : null, black: r.black ? { id: r.black, name: r.bn, elo: r.be || 1200 } : null, wDiff: r.w_diff, bDiff: r.b_diff });

export const routes = [
  route("GET", "/chess/lobby", async ctx => {
    const { env } = ctx;
    if (!ctx.active) return json({ me: null, members: false, open: [], live: [], recent: [], top: [] });
    const [act, fin, top] = await env.DB.batch([
      env.DB.prepare(sel + "WHERE g.status IN ('open','live') AND g.created > ? ORDER BY g.created DESC LIMIT 40").bind(now() - 12 * 36e5),
      env.DB.prepare(sel + "WHERE g.status = 'over' AND g.reason != 'abort' ORDER BY g.ended DESC LIMIT 10"),
      env.DB.prepare("SELECT r.*, u.name FROM chess_ratings r JOIN users u ON u.id = r.user_id WHERE r.games > 0 AND u.status = 'active' ORDER BY r.elo DESC, r.games DESC LIMIT 12")
    ]);
    const r = await env.DB.prepare("SELECT * FROM chess_ratings WHERE user_id = ?").bind(ctx.user.id).first();
    const me = { ...pubUser(ctx.user), elo: r ? r.elo : 1200, games: r ? r.games : 0, wins: r ? r.wins : 0, losses: r ? r.losses : 0, draws: r ? r.draws : 0, best: r ? r.best : 1200 };
    return json({ me, members: true, open: act.results.filter(x => x.status === "open").map(game), live: act.results.filter(x => x.status === "live").map(game), recent: fin.results.map(game),
      top: top.results.map(x => ({ id: x.user_id, name: x.name, elo: x.elo, games: x.games, wins: x.wins, losses: x.losses, draws: x.draws })) });
  }),
  route("POST", "/chess/games", async ctx => {
    const u = ctx.needUser();
    await ctx.limit("chess:" + u.id, 8);
    const b = await ctx.body();
    const tc = TCS[b.tc] || TCS["10+5"];
    const color = b.color === "w" || b.color === "b" ? b.color : (crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? "w" : "b");
    const gid = uid(16);
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE chess_games SET status = 'cancelled' WHERE creator = ? AND status = 'open'").bind(u.id),
      ctx.env.DB.prepare("INSERT INTO chess_games (id, white, black, creator, tc_base, tc_inc, rated, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)")
        .bind(gid, color === "w" ? u.id : null, color === "b" ? u.id : null, u.id, tc[0] * 60000, tc[1] * 1000, b.rated === false ? 0 : 1, now())
    ]);
    return json({ id: gid, color });
  }),
  route("POST", /^\/chess\/games\/([\w]{6,32})\/cancel$/, async (ctx, id) => {
    const u = ctx.needUser();
    await ctx.env.DB.prepare("UPDATE chess_games SET status = 'cancelled' WHERE id = ? AND creator = ? AND status = 'open'").bind(id, u.id).run();
    await ctx.env.ROOMS.get(ctx.env.ROOMS.idFromName("chess:" + id)).fetch("https://room/chess/cancel", { method: "POST" });
    return json({ ok: true });
  }),
  route("GET", /^\/chess\/games\/([\w]{6,32})\/ws$/, async (ctx, id) => {
    if (ctx.req.headers.get("Upgrade") !== "websocket") fail(426, "Expected websocket");
    const h = new Headers(ctx.req.headers); h.set("X-User", JSON.stringify(ctx.active ? { id: ctx.user.id, name: ctx.user.name } : null)); h.set("X-Game", id);
    return ctx.env.ROOMS.get(ctx.env.ROOMS.idFromName("chess:" + id)).fetch(new Request("https://room/chess/connect", { headers: h }));
  })
];
