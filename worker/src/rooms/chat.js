/* Saziņas istabas (čats) — reāllaika piegāde. Aizpilda saziņas modulis.
   Saskarne: fetch(room, req, url) — ceļi sākas ar /chat/ ; message(room, ws, attachment, raw) ; close(room, ws, attachment) */
export async function fetch(room, req, url){
  if (url.pathname === "/chat/connect") {
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    room.ctx.acceptWebSocket(server); server.serializeAttachment({ kind: "chat", user: JSON.parse(req.headers.get("X-User") || "null") });
    return new Response(null, { status: 101, webSocket: client });
  }
  if (url.pathname === "/chat/broadcast") { const msg = await req.text(); for (const ws of room.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) {} } return new Response("ok"); }
  return new Response("not found", { status: 404 });
}
export async function message(){}
export async function close(){}
