/* Saziņas istabas (čats) — reāllaika piegāde Durable Object iekšienē.
   Piekļuvi pārbauda API (worker/src/modules/comms.js) PIRMS pāradresācijas; DO uzticas X-User galvenei, jo to var izsaukt tikai Worker.
   Ceļi: /chat/connect (WebSocket), /chat/broadcast (POST: jauna/labota/dzēsta ziņa), /chat/kick (POST: aizver lietotāja savienojumus).
   Klienta ziņas: { type: "ping" } → pong; { type: "typing" } → citiem „raksta…” (ierobežots). Ziņas tiek sūtītas tikai caur API. */
const MAX_IN = 512, TYPING_MS = 2500;
const lastTyping = new WeakMap();

const sockets = room => room.ctx.getWebSockets().filter(ws => { const a = ws.deserializeAttachment() || {}; return a.kind === "chat"; });
function online(room, except){
  const seen = new Map();
  for (const ws of sockets(room)) { if (ws === except) continue; const a = ws.deserializeAttachment() || {}; if (a.user && !seen.has(a.user.id)) seen.set(a.user.id, a.user.name); }
  return [...seen].map(([id, name]) => ({ id, name }));
}
function send(ws, obj){ try { ws.send(typeof obj === "string" ? obj : JSON.stringify(obj)); } catch (e) {} }
function castAll(room, obj, except){ const s = JSON.stringify(obj); for (const ws of sockets(room)) if (ws !== except) send(ws, s); }

export async function fetch(room, req, url){
  if (url.pathname === "/chat/connect") {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    let user = null;
    try { user = JSON.parse(req.headers.get("X-User") || "null"); } catch (e) {}
    if (!user || !user.id) return new Response("forbidden", { status: 403 });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    room.ctx.acceptWebSocket(server);
    server.serializeAttachment({ kind: "chat", user: { id: String(user.id), name: String(user.name || "") }, room: req.headers.get("X-Room") || "" });
    send(server, { type: "hello", online: online(room) });
    castAll(room, { type: "presence", online: online(room) }, server);
    return new Response(null, { status: 101, webSocket: client });
  }
  if (url.pathname === "/chat/broadcast" && req.method === "POST") {
    const msg = await req.text();
    for (const ws of sockets(room)) send(ws, msg);
    return new Response("ok");
  }
  if (url.pathname === "/chat/kick" && req.method === "POST") {
    let b = {}; try { b = await req.json(); } catch (e) {}
    for (const ws of sockets(room)) { const a = ws.deserializeAttachment() || {}; if (a.user && a.user.id === b.user) { send(ws, { type: "removed" }); try { ws.close(4403, "removed"); } catch (e) {} } }
    return new Response("ok");
  }
  return new Response("not found", { status: 404 });
}

export async function message(room, ws, a, raw){
  if (typeof raw !== "string" || raw.length > MAX_IN) return;
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  if (!d || typeof d !== "object") return;
  if (d.type === "ping") return send(ws, { type: "pong", t: +d.t || 0 });
  if (d.type === "typing" && a.user) {
    const t = Date.now(), prev = lastTyping.get(ws) || 0;
    if (t - prev < TYPING_MS) return;
    lastTyping.set(ws, t);
    castAll(room, { type: "typing", user: a.user }, ws);
  }
}

export async function close(room, ws){
  castAll(room, { type: "presence", online: online(room, ws) }, ws);
}
