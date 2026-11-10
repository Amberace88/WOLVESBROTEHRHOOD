/* Durable Object „Room”: viena klase, vairāki istabu veidi (šahs, bars, saziņa).
   Veids nosakās pēc ceļa pirmā segmenta (/chess/…, /pack/…, /chat/…) un WebSocket pielikuma „kind”. */
import { DurableObject } from "cloudflare:workers";
import * as chess from "./rooms/chess.js";
import * as pack from "./rooms/pack.js";
import * as chat from "./rooms/chat.js";
const KINDS = { chess, pack, chat };

export class Room extends DurableObject {
  async fetch(req){
    const url = new URL(req.url);
    const h = KINDS[url.pathname.split("/")[1]];
    return h ? h.fetch(this, req, url) : new Response("not found", { status: 404 });
  }
  async webSocketMessage(ws, raw){
    const a = ws.deserializeAttachment() || {};
    const h = KINDS[a.kind];
    if (h && h.message) return h.message(this, ws, a, raw);
  }
  async webSocketClose(ws, code, reason){
    const a = ws.deserializeAttachment() || {};
    try { ws.close(code, reason); } catch (e) {}
    const h = KINDS[a.kind];
    if (h && h.close) return h.close(this, ws, a);
  }
  async webSocketError(ws){ return this.webSocketClose(ws, 1011, "error"); }
  async alarm(){
    // šobrīd modinātāju izmanto tikai šaha pulkstenis
    if (await this.ctx.storage.get("g")) return chess.alarm(this);
    if (chat.alarm) return chat.alarm(this);
  }
}
