/* Wolves Brotherhood MC — Cloudflare Worker
   Apkalpo statisko lapu (dist/) un /api/* : auth, forums, čati, SOS, brīdinājumi,
   palīdzības punkti, bara (pack) reāllaika istabas. D1 + Durable Objects. */
import { DurableObject } from "cloudflare:workers";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
const err = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const RANK = { rider: 1, member: 2, officer: 3 };
const CATS = ["roadhelp", "tech", "routes", "gear", "market", "general"];
const ROOMS = { club: "member", rides: "member", officers: "officer" };
const SOS_KINDS = ["tyre", "battery", "fuel", "crash", "breakdown", "other"];
const HAZ_KINDS = ["gravel", "potholes", "oil", "roadworks", "animals", "other"];
const OFFERS = ["tools", "garage", "trailer", "bed", "parts", "tow"];
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const num = (v, min, max) => { const x = Number(v); if (!Number.isFinite(x) || x < min || x > max) throw new Error("bad number"); return x; };

/* ---------- crypto ---------- */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
async function hashPassword(pw, saltHex){
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}
const sha = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const eqConst = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

async function sessionUser(env, req, url){
  const h = req.headers.get("Authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : url.searchParams.get("token");
  if (!tok) return null;
  const row = await env.DB.prepare("SELECT u.id, u.name, u.role, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?").bind(await sha(tok), now()).first();
  return row || null;
}
async function newSession(env, userId){
  const tok = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)").bind(await sha(tok), userId, now(), now() + 1000 * 60 * 60 * 24 * 90).run();
  return tok;
}
const pub = u => ({ id: u.id, name: u.name, role: u.role });

/* ---------- simple rate limit (per user/IP, per minute, in D1) ---------- */
async function limited(env, key, max){
  const win = Math.floor(now() / 60000);
  const r = await env.DB.prepare("INSERT INTO rate (k, win, n) VALUES (?, ?, 1) ON CONFLICT(k, win) DO UPDATE SET n = n + 1 RETURNING n").bind(key, win).first();
  return r && r.n > max;
}

/* ---------- API ---------- */
async function api(req, env, url){
  const p = url.pathname.replace(/^\/api/, "") || "/";
  const m = req.method;
  const body = async () => { try { return await req.json(); } catch (e) { return {}; } };
  const user = await sessionUser(env, req, url);
  const need = role => { if (!user) throw Object.assign(new Error("Login required"), { status: 401 }); if (RANK[user.role] < RANK[role]) throw Object.assign(new Error("Forbidden"), { status: 403 }); };
  const ip = req.headers.get("CF-Connecting-IP") || "0";

  if (p === "/health") return json({ ok: true });
  // ---- auth
  if (p === "/auth/register" && m === "POST") {
    if (await limited(env, "reg:" + ip, 5)) return err("Too many attempts", 429);
    const b = await body();
    const email = clip(b.email, 120).toLowerCase(), name = clip(b.name, 32) || email.split("@")[0], pw = String(b.password || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Invalid email");
    if (pw.length < 8) return err("Password too short");
    if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return err("Email already registered", 409);
    let role = "rider";
    const code = clip(b.invite, 24).toUpperCase();
    if (code) {
      const inv = await env.DB.prepare("SELECT role FROM invites WHERE code = ? AND used_by IS NULL").bind(code).first();
      if (!inv) return err("Invite code is invalid or used");
      role = inv.role;
    }
    if (env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase()) role = "officer";
    const uidv = id(), { hash, salt } = await hashPassword(pw);
    await env.DB.prepare("INSERT INTO users (id, email, name, role, pass, salt, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(uidv, email, name, role, hash, salt, now()).run();
    if (code) await env.DB.prepare("UPDATE invites SET used_by = ? WHERE code = ?").bind(uidv, code).run();
    return json({ token: await newSession(env, uidv), user: { id: uidv, name, role } });
  }
  if (p === "/auth/login" && m === "POST") {
    if (await limited(env, "login:" + ip, 10)) return err("Too many attempts", 429);
    const b = await body();
    const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(clip(b.email, 120).toLowerCase()).first();
    if (!u) return err("Wrong email or password", 401);
    const { hash } = await hashPassword(String(b.password || ""), u.salt);
    if (!eqConst(hash, u.pass)) return err("Wrong email or password", 401);
    return json({ token: await newSession(env, u.id), user: pub(u) });
  }
  if (p === "/auth/logout" && m === "POST") {
    const h = req.headers.get("Authorization") || ""; if (h.startsWith("Bearer ")) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(h.slice(7))).run();
    return json({ ok: true });
  }
  if (p === "/me") { if (!user) return err("Login required", 401); return json({ user: pub(user) }); }
  if (p === "/admin/invites" && m === "POST") {
    need("officer");
    const b = await body(); const role = b.role === "officer" ? "officer" : "member";
    const code = "WOLF-" + hex(crypto.getRandomValues(new Uint8Array(2))).toUpperCase() + "-" + hex(crypto.getRandomValues(new Uint8Array(2))).toUpperCase();
    await env.DB.prepare("INSERT INTO invites (code, role, created_by, created) VALUES (?, ?, ?, ?)").bind(code, role, user.id, now()).run();
    return json({ code, role });
  }

  // ---- forum (lasīt var visi)
  if (p === "/forum/threads" && m === "GET") {
    const cat = url.searchParams.get("cat");
    const q = cat && cat !== "all" ? env.DB.prepare("SELECT t.*, u.name AS author FROM threads t JOIN users u ON u.id = t.author WHERE t.cat = ? ORDER BY t.last_at DESC LIMIT 100").bind(cat)
      : env.DB.prepare("SELECT t.*, u.name AS author FROM threads t JOIN users u ON u.id = t.author ORDER BY t.last_at DESC LIMIT 100");
    const { results } = await q.all();
    return json({ threads: results.map(r => ({ id: r.id, cat: r.cat, title: r.title, author: r.author, created: r.created, lastAt: r.last_at, solved: !!r.solved, replies: r.replies })) }, 200, { "Cache-Control": "public, max-age=15" });
  }
  if (p === "/forum/threads" && m === "POST") {
    need("rider"); if (await limited(env, "post:" + user.id, 6)) return err("Slow down", 429);
    const b = await body(); const cat = CATS.includes(b.cat) ? b.cat : "general", title = clip(b.title, 140), text = clip(b.body, 8000);
    if (title.length < 3 || text.length < 2) return err("Title and text required");
    const tid = id(), t0 = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO threads (id, cat, title, author, created, last_at, solved, replies) VALUES (?, ?, ?, ?, ?, ?, 0, 0)").bind(tid, cat, title, user.id, t0, t0),
      env.DB.prepare("INSERT INTO posts (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(id(), tid, user.id, text, t0)
    ]);
    return json({ id: tid });
  }
  let mm;
  if ((mm = p.match(/^\/forum\/threads\/([\w-]+)$/)) && m === "GET") {
    const th = await env.DB.prepare("SELECT t.*, u.name AS author_name FROM threads t JOIN users u ON u.id = t.author WHERE t.id = ?").bind(mm[1]).first();
    if (!th) return err("Not found", 404);
    const { results } = await env.DB.prepare("SELECT p.*, u.name AS author_name, u.role, (SELECT COUNT(*) FROM likes l WHERE l.post = p.id) AS like_count, (SELECT COUNT(*) FROM likes l WHERE l.post = p.id AND l.user = ?) AS liked FROM posts p JOIN users u ON u.id = p.author WHERE p.thread = ? ORDER BY p.created ASC LIMIT 500").bind(user ? user.id : "", mm[1]).all();
    return json({ thread: { id: th.id, cat: th.cat, title: th.title, authorId: th.author, author: th.author_name, created: th.created, solved: !!th.solved },
      posts: results.map(r => ({ id: r.id, author: r.author, authorName: r.author_name, role: r.role, body: r.body, created: r.created, likeCount: r.like_count, liked: !!r.liked })) });
  }
  if ((mm = p.match(/^\/forum\/threads\/([\w-]+)\/posts$/)) && m === "POST") {
    need("rider"); if (await limited(env, "post:" + user.id, 10)) return err("Slow down", 429);
    const text = clip((await body()).body, 4000); if (text.length < 1) return err("Empty");
    const th = await env.DB.prepare("SELECT id FROM threads WHERE id = ?").bind(mm[1]).first(); if (!th) return err("Not found", 404);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO posts (id, thread, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(id(), mm[1], user.id, text, now()),
      env.DB.prepare("UPDATE threads SET last_at = ?, replies = replies + 1 WHERE id = ?").bind(now(), mm[1])
    ]);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/forum\/threads\/([\w-]+)\/solve$/)) && m === "POST") {
    need("rider");
    const th = await env.DB.prepare("SELECT author, solved FROM threads WHERE id = ?").bind(mm[1]).first(); if (!th) return err("Not found", 404);
    if (th.author !== user.id && RANK[user.role] < RANK.officer) return err("Forbidden", 403);
    await env.DB.prepare("UPDATE threads SET solved = ? WHERE id = ?").bind(th.solved ? 0 : 1, mm[1]).run();
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/forum\/posts\/([\w-]+)\/like$/)) && m === "POST") {
    need("rider");
    const ex = await env.DB.prepare("SELECT 1 FROM likes WHERE post = ? AND user = ?").bind(mm[1], user.id).first();
    await env.DB.prepare(ex ? "DELETE FROM likes WHERE post = ? AND user = ?" : "INSERT INTO likes (post, user) VALUES (?, ?)").bind(mm[1], user.id).run();
    return json({ ok: true });
  }

  // ---- chats (tikai biedriem)
  if ((mm = p.match(/^\/chat\/(\w+)\/(messages|ws)$/))) {
    const room = mm[1]; if (!ROOMS[room]) return err("Not found", 404);
    need(ROOMS[room]);
    const stub = env.ROOMS.get(env.ROOMS.idFromName("chat:" + room));
    if (mm[2] === "ws") {
      if (req.headers.get("Upgrade") !== "websocket") return err("Expected websocket", 426);
      const h = new Headers(req.headers); h.set("X-User", JSON.stringify(pub(user)));
      return stub.fetch(new Request("https://room/connect", { headers: h }));
    }
    if (m === "GET") {
      const { results } = await env.DB.prepare("SELECT m.*, u.name AS author_name FROM messages m JOIN users u ON u.id = m.author WHERE m.room = ? ORDER BY m.created DESC LIMIT 200").bind(room).all();
      return json({ messages: results.reverse().map(r => ({ id: r.id, author: r.author, authorName: r.author_name, body: r.body, created: r.created, mine: r.author === user.id })) });
    }
    if (m === "POST") {
      if (await limited(env, "chat:" + user.id, 30)) return err("Slow down", 429);
      const text = clip((await body()).body, 2000); if (!text) return err("Empty");
      const msg = { id: id(), room, author: user.id, authorName: user.name, body: text, created: now() };
      await env.DB.prepare("INSERT INTO messages (id, room, author, body, created) VALUES (?, ?, ?, ?, ?)").bind(msg.id, room, user.id, text, msg.created).run();
      await stub.fetch("https://room/broadcast", { method: "POST", body: JSON.stringify(msg) });
      return json(msg);
    }
  }

  // ---- SOS
  if (p === "/sos" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT s.*, u.name AS author_name, (SELECT COUNT(*) FROM sos_resp r WHERE r.sos = s.id) AS resp, (SELECT COUNT(*) FROM sos_resp r WHERE r.sos = s.id AND r.user = ?) AS responding FROM sos s JOIN users u ON u.id = s.author WHERE s.resolved = 0 OR s.created > ? ORDER BY s.created DESC LIMIT 50").bind(user ? user.id : "", now() - 6 * 3600e3).all();
    return json({ items: results.map(r => ({ id: r.id, kind: r.kind, note: r.note, phone: user ? r.phone : "", lat: r.lat, lon: r.lon, authorName: r.author_name, created: r.created, resolved: !!r.resolved, responders: Array(r.resp).fill(0), responding: !!r.responding, mine: user && r.author === user.id })) });
  }
  if (p === "/sos" && m === "POST") {
    need("rider"); if (await limited(env, "sos:" + user.id, 3)) return err("Slow down", 429);
    const b = await body();
    await env.DB.prepare("INSERT INTO sos (id, kind, note, phone, lat, lon, author, created, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)")
      .bind(id(), SOS_KINDS.includes(b.kind) ? b.kind : "other", clip(b.note, 500), clip(b.phone, 30), num(b.lat, -90, 90), num(b.lon, -180, 180), user.id, now()).run();
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/sos\/([\w-]+)\/(respond|resolve)$/)) && m === "POST") {
    need("rider");
    if (mm[2] === "respond") {
      const ex = await env.DB.prepare("SELECT 1 FROM sos_resp WHERE sos = ? AND user = ?").bind(mm[1], user.id).first();
      await env.DB.prepare(ex ? "DELETE FROM sos_resp WHERE sos = ? AND user = ?" : "INSERT INTO sos_resp (sos, user) VALUES (?, ?)").bind(mm[1], user.id).run();
    } else {
      const s = await env.DB.prepare("SELECT author FROM sos WHERE id = ?").bind(mm[1]).first(); if (!s) return err("Not found", 404);
      if (s.author !== user.id && RANK[user.role] < RANK.officer) return err("Forbidden", 403);
      await env.DB.prepare("UPDATE sos SET resolved = 1 WHERE id = ?").bind(mm[1]).run();
    }
    return json({ ok: true });
  }

  // ---- hazards
  if (p === "/hazards" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT h.*, u.name AS by_name FROM hazards h JOIN users u ON u.id = h.by_user WHERE h.created > ? ORDER BY h.created DESC LIMIT 300").bind(now() - 7 * 864e5).all();
    return json({ items: results.map(r => ({ id: r.id, kind: r.kind, note: r.note, lat: r.lat, lon: r.lon, by: r.by_name, created: r.created })) }, 200, { "Cache-Control": "public, max-age=30" });
  }
  if (p === "/hazards" && m === "POST") {
    need("rider"); if (await limited(env, "haz:" + user.id, 5)) return err("Slow down", 429);
    const b = await body();
    await env.DB.prepare("INSERT INTO hazards (id, kind, note, lat, lon, by_user, created) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id(), HAZ_KINDS.includes(b.kind) ? b.kind : "other", clip(b.note, 200), num(b.lat, -90, 90), num(b.lon, -180, 180), user.id, now()).run();
    return json({ ok: true });
  }

  // ---- helpers network
  if (p === "/helpers" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT h.*, u.name FROM helpers h JOIN users u ON u.id = h.user_id ORDER BY h.updated DESC LIMIT 500").all();
    return json({ items: results.map(r => ({ id: r.user_id, name: r.name, city: r.city, offers: JSON.parse(r.offers || "[]"), note: r.note, contact: user ? r.contact : "", lat: r.lat, lon: r.lon })) });
  }
  if (p === "/helpers" && m === "POST") {
    need("rider");
    const b = await body(); const offers = (Array.isArray(b.offers) ? b.offers : []).filter(o => OFFERS.includes(o));
    await env.DB.prepare("INSERT INTO helpers (user_id, city, offers, note, contact, lat, lon, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET city = excluded.city, offers = excluded.offers, note = excluded.note, contact = excluded.contact, lat = excluded.lat, lon = excluded.lon, updated = excluded.updated")
      .bind(user.id, clip(b.city, 60), JSON.stringify(offers), clip(b.note, 200), clip(b.contact, 80), Math.round(num(b.lat, -90, 90) * 100) / 100, Math.round(num(b.lon, -180, 180) * 100) / 100, now()).run();
    return json({ ok: true });
  }

  // ---- pack (bara reāllaika atrašanās vieta; istabas kods = parole)
  if ((mm = p.match(/^\/pack\/([A-Z0-9-]{3,12})$/i))) {
    if (req.headers.get("Upgrade") !== "websocket") return err("Expected websocket", 426);
    const stub = env.ROOMS.get(env.ROOMS.idFromName("pack:" + mm[1].toUpperCase()));
    const h = new Headers(req.headers); h.set("X-User", JSON.stringify({ id: clip(url.searchParams.get("id"), 24) || id(), name: clip(url.searchParams.get("name"), 24) || "Rider", pack: true }));
    return stub.fetch(new Request("https://room/connect", { headers: h }));
  }
  return err("Not found", 404);
}

/* ---------- Durable Object: WebSocket istaba (čats vai bars) ---------- */
export class Room extends DurableObject {
  async fetch(req){
    const url = new URL(req.url);
    if (url.pathname === "/broadcast") { const msg = await req.text(); for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) {} } return new Response("ok"); }
    if (url.pathname === "/connect") {
      const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
      const who = JSON.parse(req.headers.get("X-User") || "{}");
      this.ctx.acceptWebSocket(server); server.serializeAttachment(who);
      if (who.pack) for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (ws !== server && a && a.last) try { server.send(JSON.stringify(a.last)); } catch (e) {} }
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }
  async webSocketMessage(ws, raw){
    const who = ws.deserializeAttachment() || {};
    if (!who.pack) return; // čatā ziņas iet caur REST (saglabā D1), WS tikai saņem
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (d.type !== "pos") return;
    const msg = { type: "pos", id: who.id, name: who.name, lat: +(+d.lat).toFixed(5), lon: +(+d.lon).toFixed(5), speed: Math.round(+d.speed || 0), t: Date.now() };
    if (!Number.isFinite(msg.lat) || !Number.isFinite(msg.lon)) return;
    ws.serializeAttachment({ ...who, last: msg });
    const s = JSON.stringify(msg);
    for (const o of this.ctx.getWebSockets()) if (o !== ws) { try { o.send(s); } catch (e) {} }
  }
  async webSocketClose(ws){
    const who = ws.deserializeAttachment() || {};
    if (who.pack) { const s = JSON.stringify({ type: "leave", id: who.id }); for (const o of this.ctx.getWebSockets()) if (o !== ws) { try { o.send(s); } catch (e) {} } }
  }
}

/* ---------- entry ---------- */
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if (url.hostname.startsWith("www.")) { url.hostname = url.hostname.slice(4); return Response.redirect(url.toString(), 301); }
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") return new Response(null, { status: 204 });
      try { return await api(req, env, url); }
      catch (e) { return err(e.status ? e.message : "Server error", e.status || 500); }
    }
    const res = await env.ASSETS.fetch(req);
    const h = new Headers(res.headers);
    h.set("X-Content-Type-Options", "nosniff"); h.set("Referrer-Policy", "strict-origin-when-cross-origin"); h.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
    if (/\/assets\/(fonts|img|vendor)\//.test(url.pathname)) h.set("Cache-Control", "public, max-age=2592000, immutable");
    return new Response(res.body, { status: res.status, headers: h });
  }
};
