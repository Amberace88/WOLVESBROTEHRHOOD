/* „Bars” — reāllaika atrašanās vieta kartē (istabas kods = parole). Atrašanās vieta netiek glabāta datubāzē. */
export async function fetch(room, req, url){
  if (url.pathname !== "/pack/connect") return new Response("not found", { status: 404 });
  const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
  const who = JSON.parse(req.headers.get("X-User") || "{}");
  room.ctx.acceptWebSocket(server); server.serializeAttachment({ ...who, kind: "pack" });
  for (const ws of room.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (ws !== server && a && a.last) try { server.send(JSON.stringify(a.last)); } catch (e) {} }
  return new Response(null, { status: 101, webSocket: client });
}
export async function message(room, ws, who, raw){
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  if (d.type !== "pos") return;
  const msg = { type: "pos", id: who.id, name: who.name, lat: +(+d.lat).toFixed(5), lon: +(+d.lon).toFixed(5), speed: Math.round(+d.speed || 0), t: Date.now() };
  if (!Number.isFinite(msg.lat) || !Number.isFinite(msg.lon) || Math.abs(msg.lat) > 90 || Math.abs(msg.lon) > 180) return;
  ws.serializeAttachment({ ...who, last: msg });
  const s = JSON.stringify(msg);
  for (const o of room.ctx.getWebSockets()) if (o !== ws) { try { o.send(s); } catch (e) {} }
}
export async function close(room, ws, who){
  const s = JSON.stringify({ type: "leave", id: who.id });
  for (const o of room.ctx.getWebSockets()) if (o !== ws) { try { o.send(s); } catch (e) {} }
}
