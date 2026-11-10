/* Šaha partija Durable Object iekšienē: servera puses gājienu pārbaude, pulkstenis (alarm), Elo, skatītāji, revanšs */
import "../../../src/assets/js/chess-engine.js";
const { Game: ChessGame } = globalThis.WBChess;
const now = () => Date.now();

const CHESS_WIN = { "1-0": "w", "0-1": "b" };
async function chessRatings(env, g){
  // Elo: K=40 pirmās 20 partijas, tad 24
  const ids = [g.white.id, g.black.id];
  const rows = await Promise.all(ids.map(u => env.DB.prepare("SELECT * FROM chess_ratings WHERE user_id = ?").bind(u).first()));
  const [rw, rb] = rows.map(r => r || { elo: 1200, best: 1200, games: 0, wins: 0, losses: 0, draws: 0 });
  const sw = g.result === "1-0" ? 1 : g.result === "0-1" ? 0 : .5;
  const ew = 1 / (1 + Math.pow(10, (rb.elo - rw.elo) / 400));
  const kw = rw.games < 20 ? 40 : 24, kb = rb.games < 20 ? 40 : 24;
  const dw = Math.round(kw * (sw - ew)), db = Math.round(kb * ((1 - sw) - (1 - ew)));
  const up = (uid, r, d, s) => env.DB.prepare("INSERT INTO chess_ratings (user_id, elo, best, games, wins, losses, draws, updated) VALUES (?, ?, ?, 1, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET elo = excluded.elo, best = MAX(best, excluded.elo), games = games + 1, wins = wins + excluded.wins, losses = losses + excluded.losses, draws = draws + excluded.draws, updated = excluded.updated")
    .bind(uid, r.elo + d, Math.max(r.best, r.elo + d), s === 1 ? 1 : 0, s === 0 ? 1 : 0, s === .5 ? 1 : 0, now());
  await env.DB.batch([up(g.white.id, rw, dw, sw), up(g.black.id, rb, db, 1 - sw)]);
  return { w: dw, b: db, we: rw.elo + dw, be: rb.elo + db };
}


async function chessLoad(room, gid){
    if (room.g) return room.g;
    let g = await room.ctx.storage.get("g");
    if (!g && gid) {
      const r = await room.env.DB.prepare("SELECT g.*, wu.name AS wn, bu.name AS bn, wr.elo AS we, br.elo AS be FROM chess_games g LEFT JOIN users wu ON wu.id = g.white LEFT JOIN users bu ON bu.id = g.black LEFT JOIN chess_ratings wr ON wr.user_id = g.white LEFT JOIN chess_ratings br ON br.user_id = g.black WHERE g.id = ?").bind(gid).first();
      if (!r) return null;
      g = { id: r.id, creator: r.creator, white: r.white ? { id: r.white, name: r.wn, elo: r.we || 1200 } : null, black: r.black ? { id: r.black, name: r.bn, elo: r.be || 1200 } : null,
        tc: { base: r.tc_base, inc: r.tc_inc }, rated: !!r.rated, status: r.status, moves: r.moves ? r.moves.split(" ") : [], clocks: { w: r.tc_base, b: r.tc_base }, turnStart: 0,
        result: r.result || null, reason: r.reason || null, draw: null, rematch: {}, next: null, diffs: null };
      await room.ctx.storage.put("g", g);
    }
    return room.g = g || null;
  }
async function chessSave(room, g){ room.g = g; await room.ctx.storage.put("g", g); }
function chessCast(room, msg, except){ const s = JSON.stringify(msg); for (const o of room.ctx.getWebSockets()) if (o !== except) { try { o.send(s); } catch (e) {} } }
function chessPresence(room, g, closing){
    const on = { w: false, b: false }; let watchers = 0;
    for (const o of room.ctx.getWebSockets()) { if (o === closing) continue; const a = o.deserializeAttachment() || {}; if (a.kind !== "chess") continue; const c = a.user && g.white && a.user.id === g.white.id ? "w" : a.user && g.black && a.user.id === g.black.id ? "b" : null; if (c) on[c] = true; else watchers++; }
    return { type: "presence", online: on, watchers };
  }
function chessView(room, g, you){
    const turn = g.moves.length % 2 ? "b" : "w", running = g.status === "live" && g.tc.base > 0 && g.moves.length >= 2;
    return { type: "state", id: g.id, white: g.white, black: g.black, tc: [g.tc.base / 60000, g.tc.inc / 1000], rated: g.rated, status: g.status, moves: g.moves,
      clocks: g.clocks, running, turn, elapsed: running ? Date.now() - g.turnStart : 0, result: g.result, reason: g.reason, draw: g.draw, rematch: g.rematch, next: g.next, diffs: g.diffs, you: you || null, creator: g.creator };
  }
async function chessConnect(room, req){
    const gid = req.headers.get("X-Game"), user = JSON.parse(req.headers.get("X-User") || "null");
    const g = await chessLoad(room, gid);
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    room.ctx.acceptWebSocket(server);
    if (!g) { server.serializeAttachment({ kind: "chess", user: null }); server.send(JSON.stringify({ type: "error", error: "notfound" })); server.close(4404, "not found"); return new Response(null, { status: 101, webSocket: client }); }
    let you = user && g.white && g.white.id === user.id ? "w" : user && g.black && g.black.id === user.id ? "b" : null;
    if (!you && user && g.status === "open") {
      const r = await room.env.DB.prepare("SELECT elo FROM chess_ratings WHERE user_id = ?").bind(user.id).first();
      const seat = { id: user.id, name: user.name, elo: r ? r.elo : 1200 };
      you = g.white ? "b" : "w"; g[you === "w" ? "white" : "black"] = seat; g.status = "live";
      await room.env.DB.prepare("UPDATE chess_games SET white = ?, black = ?, status = 'live' WHERE id = ? AND status = 'open'").bind(g.white.id, g.black.id, g.id).run();
      await chessSave(room, g);
    }
    server.serializeAttachment({ kind: "chess", user, gid: g.id });
    server.send(JSON.stringify(chessView(room, g, you)));
    // citiem — jauns stāvoklis (ja apsēdās otrs spēlētājs) + klātbūtne
    for (const o of room.ctx.getWebSockets()) if (o !== server) { const a = o.deserializeAttachment() || {}; if (a.kind !== "chess") continue; const c = a.user && g.white && a.user.id === g.white.id ? "w" : a.user && g.black && a.user.id === g.black.id ? "b" : null; try { o.send(JSON.stringify(chessView(room, g, c))); } catch (e) {} }
    chessCast(room, chessPresence(room, g));
    return new Response(null, { status: 101, webSocket: client });
  }
async function chessEnd(room, g, result, reason){
    g.status = "over"; g.result = result; g.reason = reason; g.draw = null;
    if (g.rated && reason !== "abort" && g.white && g.black && g.white.id !== g.black.id) { try { g.diffs = await chessRatings(room.env, g); } catch (e) { g.diffs = null; } }
    await room.env.DB.prepare("UPDATE chess_games SET status = 'over', result = ?, reason = ?, moves = ?, ended = ?, w_elo = ?, b_elo = ?, w_diff = ?, b_diff = ? WHERE id = ?")
      .bind(result, reason, g.moves.join(" "), Date.now(), g.diffs ? g.diffs.we : null, g.diffs ? g.diffs.be : null, g.diffs ? g.diffs.w : null, g.diffs ? g.diffs.b : null, g.id).run();
    await room.ctx.storage.deleteAlarm();
    await chessSave(room, g);
    chessCast(room, { type: "end", result, reason, diffs: g.diffs, clocks: g.clocks, moves: g.moves });
  }
  /* pārbauda, vai gājienā esošajam beidzies laiks */
async function chessFlag(room, g){
    if (g.status !== "live" || !g.tc.base || g.moves.length < 2) return false;
    const turn = g.moves.length % 2 ? "b" : "w", left = g.clocks[turn] - (Date.now() - g.turnStart);
    if (left > 0) return false;
    g.clocks[turn] = 0;
    const game = ChessGame.from(g.moves), other = turn === "w" ? 16 : 8;
    await chessEnd(room, g, game.pos.canMate(other) ? (turn === "w" ? "0-1" : "1-0") : "1/2-1/2", "timeout");
    return true;
  }
async function alarm(room){ const g = await chessLoad(room); if (!g || g.status !== "live") return; if (!(await chessFlag(room, g))) { const turn = g.moves.length % 2 ? "b" : "w"; await room.ctx.storage.setAlarm(g.turnStart + g.clocks[turn] + 50); } }
async function chessMessage(room, ws, who, raw){
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    const g = await chessLoad(room, who.gid); if (!g) return;
    if (d.type === "ping") { ws.send(JSON.stringify({ type: "pong", t: d.t })); return; }
    const u = who.user, me = u && g.white && g.white.id === u.id ? "w" : u && g.black && g.black.id === u.id ? "b" : null;
    const reply = o => ws.send(JSON.stringify(o));
    if (!me) return reply({ type: "error", error: "spectator" });
    const other = me === "w" ? "b" : "w";
    if (d.type === "move") {
      if (g.status !== "live") return reply({ type: "error", error: "notlive" });
      if (await chessFlag(room, g)) return;
      const turn = g.moves.length % 2 ? "b" : "w";
      if (turn !== me || d.ply !== g.moves.length) return reply(chessView(room, g, me));
      const game = ChessGame.from(g.moves), mv = game.move(String(d.uci || ""));
      if (!mv) return reply({ ...chessView(room, g, me), error: "illegal" });
      const t = Date.now();
      if (g.tc.base && g.moves.length >= 2) { g.clocks[me] = Math.max(0, g.clocks[me] - (t - g.turnStart)) + g.tc.inc; }
      g.moves.push(mv.uci); g.turnStart = t;
      if (g.draw === other) g.draw = null; // gājiens = atteikums
      const st = game.status();
      const running = g.tc.base > 0 && g.moves.length >= 2;
      chessCast(room, { type: "move", uci: mv.uci, san: mv.san, ply: g.moves.length, clocks: g.clocks, running, elapsed: 0, draw: g.draw });
      if (st.over) return chessEnd(room, g, st.result, st.reason);
      await chessSave(room, g);
      if (running) await room.ctx.storage.setAlarm(t + g.clocks[other] + 50);
      return;
    }
    if (d.type === "resign" && g.status === "live") return chessEnd(room, g, me === "w" ? "0-1" : "1-0", "resign");
    if (d.type === "abort" && g.status === "live" && g.moves.length < 2) return chessEnd(room, g, "*", "abort");
    if (d.type === "draw" && g.status === "live") {
      if (g.draw === other) return chessEnd(room, g, "1/2-1/2", "agreement");
      if (g.moves.length < 2) return;
      g.draw = me; await chessSave(room, g); chessCast(room, { type: "draw", by: me }); return;
    }
    if (d.type === "decline" && g.draw === other) { g.draw = null; await chessSave(room, g); chessCast(room, { type: "draw", by: null }); return; }
    if (d.type === "rematch" && g.status === "over" && !g.next) {
      g.rematch = { ...(g.rematch || {}), [me]: true };
      if (g.rematch.w && g.rematch.b) {
        const nid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await room.env.DB.prepare("INSERT INTO chess_games (id, white, black, creator, tc_base, tc_inc, rated, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, 'live', ?)")
          .bind(nid, g.black.id, g.white.id, u.id, g.tc.base, g.tc.inc, g.rated ? 1 : 0, Date.now()).run();
        g.next = nid; await chessSave(room, g); chessCast(room, { type: "rematch", next: nid }); return;
      }
      await chessSave(room, g); chessCast(room, { type: "rematch", by: me }); return;
    }
  }

/* Room saskarne */
export async function fetch(room, req, url){
  if (url.pathname === "/chess/connect") return chessConnect(room, req);
  if (url.pathname === "/chess/cancel") { const g = await chessLoad(room); if (g && g.status === "open") { g.status = "cancelled"; await chessSave(room, g); chessCast(room, { type: "cancelled" }); } return new Response("ok"); }
  return new Response("not found", { status: 404 });
}
export const message = (room, ws, who, raw) => chessMessage(room, ws, who, raw);
export async function close(room, ws){ const g = await chessLoad(room); if (g) chessCast(room, chessPresence(room, g, ws)); }
export { alarm };
