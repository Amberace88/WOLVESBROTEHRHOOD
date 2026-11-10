/* Faili (attēli, PDF, balss ziņas) — glabāti D1, tips pārbaudīts pēc satura, piekļuve pārbaudīta katram failam.
   Moduļi reģistrē piekļuves pārbaudi ar registerFileAccess(ctxType, async (ctx, file) => boolean). */
import { route, json, fail, now, uid, clip, oneOf } from "../lib/http.js";

const ACCESS = {};
export const registerFileAccess = (ctxType, fn) => { ACCESS[ctxType] = fn; };
/* kurš drīkst augšupielādēt kontekstā (moduļi papildina) */
const UPLOAD = {};
export const registerFileUpload = (ctxType, fn) => { UPLOAD[ctxType] = fn; };

const LIMITS = { "image/jpeg": 900e3, "image/png": 900e3, "image/webp": 900e3, "application/pdf": 1.8e6, "audio/webm": 1.6e6, "audio/ogg": 1.6e6, "audio/mp4": 1.6e6 };
/* faila tips pēc „maģiskajiem baitiem”, nevis pēc klienta deklarācijas */
export function sniff(b){
  const h = (i, ...v) => v.every((x, k) => b[i + k] === x);
  if (h(0, 0xFF, 0xD8, 0xFF)) return "image/jpeg";
  if (h(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return "image/png";
  if (h(0, 0x52, 0x49, 0x46, 0x46) && h(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (h(0, 0x25, 0x50, 0x44, 0x46, 0x2D)) return "application/pdf";
  if (h(0, 0x1A, 0x45, 0xDF, 0xA3)) return "audio/webm";
  if (h(0, 0x4F, 0x67, 0x67, 0x53)) return "audio/ogg";
  if (h(4, 0x66, 0x74, 0x79, 0x70)) return "audio/mp4";
  return null;
}

export const routes = [
  /* augšupielāde: neapstrādāts ķermenis; galvenes X-Context, X-Context-Id, X-Name */
  route("POST", "/files", async ctx => {
    const u = ctx.needUser();
    await ctx.limit("upload:" + u.id, (await ctx.can("merch", "e")) ? 90 : 30, 600); /* 360° skatam vajag 24–36 kadrus */
    const ctxType = clip(ctx.req.headers.get("X-Context"), 20), ctxId = clip(ctx.req.headers.get("X-Context-Id"), 40) || null;
    const allow = UPLOAD[ctxType];
    if (!allow || !(await allow(ctx, ctxId))) fail(403, "Upload not allowed here", { code: "forbidden" });
    const len = +(ctx.req.headers.get("Content-Length") || 0);
    if (len > 2e6) fail(413, "File too large");
    const buf = new Uint8Array(await ctx.req.arrayBuffer());
    if (!buf.length) fail(400, "Empty file");
    const mime = sniff(buf);
    if (!mime) fail(415, "Unsupported file type (JPEG, PNG, WebP, PDF or audio)", { code: "type" });
    if (buf.length > LIMITS[mime]) fail(413, "File too large", { code: "size" });
    const id = uid(20), name = clip(decodeURIComponent(ctx.req.headers.get("X-Name") || ""), 120).replace(/[\\/:*?"<>|]/g, "_");
    await ctx.env.DB.prepare("INSERT INTO files (id, owner, ctx_type, ctx_id, mime, size, name, public, data, created) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
      .bind(id, u.id, ctxType, ctxId, mime, buf.length, name, buf, now()).run();
    return json({ id, mime, size: buf.length, name, url: `/api/files/${id}` });
  }),
  route("GET", /^\/files\/([0-9a-z]{20})$/, async (ctx, id) => {
    const f = await ctx.env.DB.prepare("SELECT id, owner, ctx_type, ctx_id, mime, size, name, public, created FROM files WHERE id = ?").bind(id).first();
    if (!f) fail(404, "Not found");
    if (!f.public) {
      const fn = ACCESS[f.ctx_type];
      const ok = (ctx.user && f.owner === ctx.user.id) || (fn && await fn(ctx, f)) || ctx.isAdmin;
      if (!ok) fail(ctx.user ? 403 : 401, "Forbidden");
    }
    const row = await ctx.env.DB.prepare("SELECT data FROM files WHERE id = ?").bind(id).first();
    const inline = f.mime.startsWith("image/") || f.mime.startsWith("audio/");
    return new Response(new Uint8Array(row.data), { headers: { /* D1 BLOB → masīvs/ArrayBuffer → baiti */
      "Content-Type": f.mime, "Content-Length": String(f.size), "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": f.public ? "public, max-age=86400" : "private, max-age=3600",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name || f.id)}`
    } });
  })
];
