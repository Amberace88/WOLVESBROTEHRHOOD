/* Wolves Brotherhood MC — satura pārvaldība (administrācijas panelis)
   Visas izmaiņas glabājas D1 tabulā `cms` kā pārrakstījumi virs noklusējuma satura (src/, i18n/).
   Atslēgas:
     i18n:<valoda>   — { "teksta.atslēga": "jaunais teksts", … }
     data:<NOSAUKUMS> — data.js kopas aizstājējs (CLUB, EVENTS, DIARY, HISTORY, MEMBERS, ROUTES, GALLERY, MERCH, DONATE, EU_EVENTS)
     ui              — { hidden: [sadaļu id], order: [sadaļu id], banner: {on, text:{lv…}, link, tone}, colors: {…}, css: "" }
     forumCats       — [{ id, icon, name:{lv…}, hidden }]
   Rakstīt drīkst tikai galvenais administrators un izstrādātājs (loma ≥ admin). */

export const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];
export const DATA_KEYS = ["CLUB", "EVENTS", "DIARY", "HISTORY", "MEMBERS", "ROUTES", "GALLERY", "MERCH", "DONATE", "EU_EVENTS"];
const KEY_RE = new RegExp(`^(i18n:(${LANGS.join("|")})|data:(${DATA_KEYS.join("|")})|ui|forumCats)$`);
const MAX_VALUE = 900 * 1024;
const FILE_MAX = 6 * 1024 * 1024;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
const err = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/* ---------- kešs (katrā Worker instancē; rakstot tiek notīrīts) ---------- */
let cache = null, cacheAt = 0;
export async function loadCms(env){
  if (cache && now() - cacheAt < 15000) return cache;
  const out = {};
  try {
    const { results } = await env.DB.prepare("SELECT key, value FROM cms").all();
    for (const r of results) { try { out[r.key] = JSON.parse(r.value); } catch (e) {} }
  } catch (e) { /* tabula vēl nav izveidota */ }
  cache = out; cacheAt = now();
  return out;
}
const dropCache = () => { cache = null; };

export async function audit(env, user, action, target, detail){
  try {
    await env.DB.prepare("INSERT INTO audit (id, at, user_id, user_name, action, target, detail) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(uid(), now(), user ? user.id : null, user ? user.name : null, action, target || null, detail ? JSON.stringify(detail).slice(0, 4000) : null).run();
  } catch (e) {}
}

/* ---------- failu tips pēc satura (ne pēc nosaukuma) ---------- */
function sniff(b){
  const s = (o, arr) => arr.every((x, i) => b[o + i] === x);
  if (s(0, [0xFF, 0xD8, 0xFF])) return "image/jpeg";
  if (s(0, [0x89, 0x50, 0x4E, 0x47])) return "image/png";
  if (s(0, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (s(0, [0x52, 0x49, 0x46, 0x46]) && s(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (s(4, [0x66, 0x74, 0x79, 0x70]) && /avif|avis/.test(String.fromCharCode(...b.slice(8, 12)))) return "image/avif";
  if (s(0, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  return null;
}

/* ---------- API ---------- */
export async function cmsApi(ctx){
  const { p, m, env, req, url, user, need, body } = ctx;
  let mm;

  // publiski faili (attēli, PDF)
  if ((mm = p.match(/^\/files\/([a-z0-9]{16})$/)) && m === "GET") {
    const f = await env.DB.prepare("SELECT type, data, name FROM files WHERE id = ?").bind(mm[1]).first();
    if (!f) return err("Not found", 404);
    const bytes = f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : Uint8Array.from(f.data);
    return new Response(bytes, { headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox", "Content-Disposition": `inline; filename="${encodeURIComponent(f.name || "fails")}"` } });
  }

  if (!p.startsWith("/admin/")) return null;

  // ---- viss zemāk: tikai galvenais administrators un izstrādātājs
  if (p === "/admin/cms" && m === "GET") {
    need("admin");
    const { results } = await env.DB.prepare("SELECT key, value, updated, by_name FROM cms ORDER BY key").all();
    return json({ entries: results.map(r => ({ key: r.key, value: JSON.parse(r.value), updated: r.updated, by: r.by_name })) });
  }
  if (p === "/admin/cms" && m === "POST") {
    need("admin");
    const b = await body();
    const key = String(b.key || "");
    if (!KEY_RE.test(key)) return err("Unknown key");
    const raw = JSON.stringify(b.value ?? null);
    if (raw.length > MAX_VALUE) return err("Too large");
    if (key.startsWith("i18n:") && (typeof b.value !== "object" || Array.isArray(b.value) || b.value === null)) return err("Expected object");
    const prev = await env.DB.prepare("SELECT value FROM cms WHERE key = ?").bind(key).first();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO cms_history (id, key, value, at, by_name) VALUES (?, ?, ?, ?, ?)").bind(uid(), key, prev ? prev.value : null, now(), user.name),
      env.DB.prepare("INSERT INTO cms (key, value, updated, by_name) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated, by_name = excluded.by_name").bind(key, raw, now(), user.name)
    ]);
    dropCache();
    await audit(env, user, "cms.save", key, { size: raw.length });
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/admin\/cms\/(.+)$/)) && m === "DELETE") {
    need("admin");
    const key = decodeURIComponent(mm[1]);
    if (!KEY_RE.test(key)) return err("Unknown key");
    const prev = await env.DB.prepare("SELECT value FROM cms WHERE key = ?").bind(key).first();
    if (prev) await env.DB.batch([
      env.DB.prepare("INSERT INTO cms_history (id, key, value, at, by_name) VALUES (?, ?, ?, ?, ?)").bind(uid(), key, prev.value, now(), user.name),
      env.DB.prepare("DELETE FROM cms WHERE key = ?").bind(key)
    ]);
    dropCache();
    await audit(env, user, "cms.reset", key);
    return json({ ok: true });
  }
  if (p === "/admin/cms-history" && m === "GET") {
    need("admin");
    const key = url.searchParams.get("key") || "";
    const { results } = await env.DB.prepare("SELECT id, key, at, by_name, length(value) AS size FROM cms_history WHERE key = ? ORDER BY at DESC LIMIT 40").bind(key).all();
    return json({ items: results });
  }
  if (p === "/admin/cms-restore" && m === "POST") {
    need("admin");
    const h = await env.DB.prepare("SELECT key, value FROM cms_history WHERE id = ?").bind(String((await body()).id || "")).first();
    if (!h) return err("Not found", 404);
    const cur = await env.DB.prepare("SELECT value FROM cms WHERE key = ?").bind(h.key).first();
    const st = [env.DB.prepare("INSERT INTO cms_history (id, key, value, at, by_name) VALUES (?, ?, ?, ?, ?)").bind(uid(), h.key, cur ? cur.value : null, now(), user.name)];
    st.push(h.value === null
      ? env.DB.prepare("DELETE FROM cms WHERE key = ?").bind(h.key)
      : env.DB.prepare("INSERT INTO cms (key, value, updated, by_name) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated, by_name = excluded.by_name").bind(h.key, h.value, now(), user.name));
    await env.DB.batch(st);
    dropCache();
    await audit(env, user, "cms.restore", h.key);
    return json({ ok: true });
  }
  if (p === "/admin/export" && m === "GET") {
    need("admin");
    const { results } = await env.DB.prepare("SELECT key, value FROM cms").all();
    await audit(env, user, "cms.export");
    return json({ format: "wbmc-cms/1", exported: new Date().toISOString(), entries: Object.fromEntries(results.map(r => [r.key, JSON.parse(r.value)])) }, 200,
      { "Content-Disposition": `attachment; filename="wbmc-saturs-${new Date().toISOString().slice(0, 10)}.json"` });
  }
  if (p === "/admin/import" && m === "POST") {
    need("admin");
    const b = await body();
    if (b.format !== "wbmc-cms/1" || typeof b.entries !== "object") return err("Wrong file");
    const st = [];
    for (const [key, value] of Object.entries(b.entries)) {
      if (!KEY_RE.test(key)) continue;
      const raw = JSON.stringify(value); if (raw.length > MAX_VALUE) continue;
      const prev = await env.DB.prepare("SELECT value FROM cms WHERE key = ?").bind(key).first();
      st.push(env.DB.prepare("INSERT INTO cms_history (id, key, value, at, by_name) VALUES (?, ?, ?, ?, ?)").bind(uid(), key, prev ? prev.value : null, now(), user.name));
      st.push(env.DB.prepare("INSERT INTO cms (key, value, updated, by_name) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated, by_name = excluded.by_name").bind(key, raw, now(), user.name));
    }
    if (st.length) await env.DB.batch(st);
    dropCache();
    await audit(env, user, "cms.import", null, { keys: st.length / 2 });
    return json({ ok: true, imported: st.length / 2 });
  }

  // ---- faili
  if (p === "/admin/files" && m === "POST") {
    need("admin");
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length || buf.length > FILE_MAX) return err("File too large (max 6 MB)");
    const type = sniff(buf);
    if (!type) return err("Only JPG, PNG, WebP, GIF, AVIF or PDF");
    const fid = uid(), name = String(req.headers.get("X-Name") || "fails").replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120);
    await env.DB.prepare("INSERT INTO files (id, name, type, size, data, created, by_name) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(fid, name, type, buf.length, buf, now(), user.name).run();
    await audit(env, user, "file.upload", fid, { name, size: buf.length });
    return json({ id: fid, url: "/api/files/" + fid, type, name });
  }
  if (p === "/admin/files" && m === "GET") {
    need("admin");
    const { results } = await env.DB.prepare("SELECT id, name, type, size, created, by_name FROM files ORDER BY created DESC LIMIT 500").all();
    return json({ files: results.map(f => ({ ...f, url: "/api/files/" + f.id })) });
  }
  if ((mm = p.match(/^\/admin\/files\/([a-z0-9]{16})$/)) && m === "DELETE") {
    need("admin");
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(mm[1]).run();
    await audit(env, user, "file.delete", mm[1]);
    return json({ ok: true });
  }

  // ---- pārskats, žurnāls, moderācija
  if (p === "/admin/stats" && m === "GET") {
    need("admin");
    const q = sql => env.DB.prepare(sql).first().then(r => r ? r.n : 0).catch(() => 0);
    const roles = await env.DB.prepare("SELECT role, COUNT(*) AS n FROM users GROUP BY role").all();
    return json({
      roles: Object.fromEntries(roles.results.map(r => [r.role, r.n])),
      threads: await q("SELECT COUNT(*) AS n FROM threads"), posts: await q("SELECT COUNT(*) AS n FROM posts"),
      messages: await q("SELECT COUNT(*) AS n FROM messages"), sosOpen: await q("SELECT COUNT(*) AS n FROM sos WHERE resolved = 0"),
      hazards: await q(`SELECT COUNT(*) AS n FROM hazards WHERE created > ${now() - 7 * 864e5}`), helpers: await q("SELECT COUNT(*) AS n FROM helpers"),
      invitesOpen: await q("SELECT COUNT(*) AS n FROM invites WHERE used_by IS NULL"), cms: await q("SELECT COUNT(*) AS n FROM cms"),
      files: await q("SELECT COUNT(*) AS n FROM files"), chessGames: await q("SELECT COUNT(*) AS n FROM chess_games WHERE status = 'over'")
    });
  }
  if (p === "/admin/audit" && m === "GET") {
    need("admin");
    const { results } = await env.DB.prepare("SELECT * FROM audit ORDER BY at DESC LIMIT 300").all();
    return json({ items: results });
  }
  if (p === "/admin/moderation" && m === "GET") {
    need("admin");
    const [th, po, so, hz, hp] = await Promise.all([
      env.DB.prepare("SELECT t.id, t.cat, t.title, t.created, t.replies, u.name AS author FROM threads t LEFT JOIN users u ON u.id = t.author ORDER BY t.last_at DESC LIMIT 100").all(),
      env.DB.prepare("SELECT p.id, p.thread, substr(p.body, 1, 200) AS body, p.created, u.name AS author FROM posts p LEFT JOIN users u ON u.id = p.author ORDER BY p.created DESC LIMIT 100").all(),
      env.DB.prepare("SELECT s.id, s.kind, s.note, s.created, s.resolved, u.name AS author FROM sos s LEFT JOIN users u ON u.id = s.author ORDER BY s.created DESC LIMIT 100").all(),
      env.DB.prepare("SELECT h.id, h.kind, h.note, h.created, u.name AS author FROM hazards h LEFT JOIN users u ON u.id = h.by_user ORDER BY h.created DESC LIMIT 100").all(),
      env.DB.prepare("SELECT h.user_id AS id, h.city, h.note, h.updated AS created, u.name AS author FROM helpers h LEFT JOIN users u ON u.id = h.user_id ORDER BY h.updated DESC LIMIT 100").all()
    ]);
    return json({ threads: th.results, posts: po.results, sos: so.results, hazards: hz.results, helpers: hp.results });
  }
  if ((mm = p.match(/^\/admin\/(threads|posts|sos|hazards|helpers|messages)\/([\w-]+)$/)) && m === "DELETE") {
    need("admin");
    const [, kind, tid] = mm;
    const st = {
      threads: [env.DB.prepare("DELETE FROM posts WHERE thread = ?").bind(tid), env.DB.prepare("DELETE FROM threads WHERE id = ?").bind(tid)],
      posts: [env.DB.prepare("UPDATE threads SET replies = MAX(0, replies - 1) WHERE id = (SELECT thread FROM posts WHERE id = ?)").bind(tid), env.DB.prepare("DELETE FROM likes WHERE post = ?").bind(tid), env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(tid)],
      sos: [env.DB.prepare("DELETE FROM sos_resp WHERE sos = ?").bind(tid), env.DB.prepare("DELETE FROM sos WHERE id = ?").bind(tid)],
      hazards: [env.DB.prepare("DELETE FROM hazards WHERE id = ?").bind(tid)],
      helpers: [env.DB.prepare("DELETE FROM helpers WHERE user_id = ?").bind(tid)],
      messages: [env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(tid)]
    }[kind];
    await env.DB.batch(st);
    await audit(env, user, "moderate.delete", kind + ":" + tid);
    return json({ ok: true });
  }
  return null;
}

/* ---------- forum kategorijas: noklusējums + administrācijas pievienotās ---------- */
export async function forumCats(env, defaults){
  const c = await loadCms(env);
  const extra = Array.isArray(c.forumCats) ? c.forumCats : [];
  const ids = new Set(defaults);
  for (const x of extra) if (x && /^[a-z0-9-]{2,24}$/.test(x.id)) ids.add(x.id);
  return [...ids];
}

/* ---------- HTML: teksta pārrakstījumi un satura ievietošana pirms lapas skriptiem ---------- */
const escKeep = s => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, "&amp;").replace(/<(?!\/?(b|br|i)(\s|>|\/))/g, "&lt;").replace(/"/g, "&quot;");
const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safeJson = v => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/* atribūtos lietotie teksti (placeholder, aria-label, data-rocker…) — aizstāj pēc noklusējuma vērtības */
const assetCache = {};
async function assetJson(env, url, path){
  const k = path; if (assetCache[k] && now() - assetCache[k].at < 300000) return assetCache[k].v;
  let v = null;
  try { const r = await env.ASSETS.fetch(new Request(new URL(path, url).toString())); if (r.ok) v = await r.json(); } catch (e) {}
  assetCache[k] = { v, at: now() }; return v;
}
export async function renderHtml(res, env, url){
  const c = await loadCms(env);
  const seg = url.pathname.split("/").filter(Boolean);
  const lang = LANGS.includes(seg[0]) ? seg[0] : "lv";
  const file = (LANGS.includes(seg[0]) ? seg[1] : seg[0]) || "index.html";
  const page = file.replace(/\.html$/, "") || "index";
  const tr = c["i18n:" + lang] || {};
  const data = {};
  for (const k of DATA_KEYS) if (c["data:" + k] !== undefined) data[k] = c["data:" + k];
  const ui = c.ui || {};
  let html = await res.text();
  // teksti ar marķieriem <!--t:atslēga-->…<!--/t-->
  if (Object.keys(tr).length) {
    html = html.replace(/<!--t:([a-zA-Z0-9_.-]+)-->([\s\S]*?)<!--\/t-->/g, (all, k, cur) => tr[k] !== undefined && tr[k] !== "" ? `<!--t:${k}-->${escKeep(tr[k])}<!--/t-->` : all);
    const attrKeys = await assetJson(env, url, "/assets/i18n/attr-keys.json");
    const changed = Array.isArray(attrKeys) ? attrKeys.filter(k => tr[k] !== undefined && tr[k] !== "") : [];
    if (changed.length) {
      const def = await assetJson(env, url, `/assets/i18n/${lang}.json`) || {};
      const defEn = lang === "en" ? def : (await assetJson(env, url, "/assets/i18n/en.json") || {});
      const defLv = lang === "lv" ? def : (await assetJson(env, url, "/assets/i18n/lv.json") || {});
      for (const k of changed) {
        const d = def[k] ?? defEn[k] ?? defLv[k]; if (d === undefined || d === "") continue;
        const from = `="${escKeep(d)}"`, to = `="${escAttr(tr[k])}"`;
        html = html.split(from).join(to);
      }
    }
    const mt = tr[`meta.${page}.title`], md = tr[`meta.${page}.desc`];
    if (mt) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(mt)}</title>`).replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(mt)}$2`);
    if (md) html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(md)}$2`).replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escAttr(md)}$2`);
  }
  const payload = { i18n: tr, data, ui: { hidden: ui.hidden || [], order: ui.order || [], banner: ui.banner || null }, forumCats: Array.isArray(c.forumCats) ? c.forumCats : null };
  let headAdd = `<script>window.__CMS=${safeJson(payload)};</script>`;
  const vars = ui.colors && typeof ui.colors === "object" ? Object.entries(ui.colors).filter(([k, v]) => /^--[a-z0-9-]{1,30}$/.test(k) && /^#[0-9a-fA-F]{3,8}$/.test(String(v))) : [];
  let style = vars.length ? `:root{${vars.map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
  if (typeof ui.css === "string" && ui.css.trim()) style += "\n" + ui.css.replace(/<\/?style/gi, "").slice(0, 60000);
  html = html.replace(/<head>/i, `<head>\n${headAdd}`);
  if (style) html = html.replace(/<\/head>/i, `<style id="cms-style">${style}</style>\n</head>`);
  const h = new Headers(res.headers);
  h.delete("Content-Length"); h.delete("ETag");
  h.set("Cache-Control", "no-cache");
  return new Response(html, { status: res.status, headers: h });
}
