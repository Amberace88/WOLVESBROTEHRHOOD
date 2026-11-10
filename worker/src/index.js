/* WBMC — Cloudflare Worker
   Apkalpo statisko daudzvalodu lapu (dist/) un /api/* moduļus. D1 datubāze + Durable Object „Room”.
   Drošība: HttpOnly sesijas sīkdatne, CSRF (Origin + X-WBMC galvene), CSP ar nonce, drošības galvenes, noindex slēgtajām lapām. */
import { HttpError, json, now } from "./lib/http.js";
import { makeContext, migrate, dispatch, getSetting } from "./lib/core.js";
import { CORE_MIGRATIONS } from "./migrations/core.js";
import * as auth from "./modules/auth.js";
import * as admin from "./modules/admin.js";
import * as files from "./modules/files.js";
import * as chess from "./modules/chess.js";
import * as ridehq from "./modules/ridehq.js";
import * as rhr from "./modules/rhr.js";
import * as events from "./modules/events.js";
import * as comms from "./modules/comms.js";
import * as people from "./modules/people.js";
import * as commerce from "./modules/commerce.js";
export { Room } from "./room.js";

const MODULES = [auth, admin, files, events, ridehq, comms, rhr, people, commerce, chess];
const ROUTES = MODULES.flatMap(m => m.routes || []);
const MIGRATIONS = [...CORE_MIGRATIONS, ...MODULES.flatMap(m => m.migrations || [])];

/* slēgtās (biedru/administrācijas) lapas — netiek indeksētas */
const PRIVATE_PAGES = /^\/(?:[a-z]{2}\/)?(?:sazina|brali|admin|pieslegties|profils)\.html$/;
/* vecie URL → jaunie (11.–12. sadaļa: esošos URL korekti novirzīt) */
const REDIRECTS = [[/^\/((?:[a-z]{2}\/)?)eiropa\.html$/, "/$1pasakumi.html"]];

const CSP_CONNECT = ["https://api.open-meteo.com", "https://router.project-osrm.org", "https://photon.komoot.io", "https://overpass-api.de", "https://api.rainviewer.com"];
const CSP_IMG = ["https://tile.openstreetmap.org", "https://tilecache.rainviewer.com"];
function securityHeaders(h, url, nonce){
  const https = url.protocol === "https:";
  const wss = `${https ? "wss" : "ws"}://${url.host}`;
  h.set("Content-Security-Policy", [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${CSP_IMG.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' ${wss} ${CSP_CONNECT.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://meet.jit.si",
    "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : [])
  ].join("; "));
  if (https) h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", 'geolocation=(self), microphone=(self "https://meet.jit.si"), camera=(self "https://meet.jit.si"), display-capture=(self "https://meet.jit.si"), payment=(), usb=()');
  h.set("Cross-Origin-Opener-Policy", "same-origin");
}

async function api(req, env, url, execCtx){
  const path = url.pathname.replace(/^\/api/, "") || "/";
  // CSRF: rakstošiem pieprasījumiem — tikai no mūsu lapas (Origin) un ar X-WBMC galveni (nav sūtāma bez CORS)
  const origin = req.headers.get("Origin");
  const ws = req.headers.get("Upgrade") === "websocket";
  if (origin && origin !== url.origin) return json({ error: "Cross-origin request blocked", code: "csrf" }, 403);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.get("X-WBMC") !== "1") return json({ error: "Missing request header", code: "csrf" }, 403);
  if (ws && !origin) return json({ error: "Origin required", code: "csrf" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  await migrate(env, MIGRATIONS);
  const ctx = await makeContext(req, env, url, execCtx);
  let res;
  try {
    res = await dispatch(ROUTES, ctx, path);
    if (!res) res = json({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof HttpError) res = json({ error: e.message, ...(e.extra || {}) }, e.status);
    else { console.error("API error", path, e && e.stack); res = json({ error: "Server error" }, 500); }
  }
  if (ctx.outCookies.length && res.status !== 101) {
    res = new Response(res.body, res);
    for (const c of ctx.outCookies) res.headers.append("Set-Cookie", c);
  }
  return res;
}

export default {
  async fetch(req, env, execCtx){
    const url = new URL(req.url);
    if (url.hostname.startsWith("www.")) { url.hostname = url.hostname.slice(4); return Response.redirect(url.toString(), 301); }
    if (url.pathname.startsWith("/api/")) {
      const res = await api(req, env, url, execCtx);
      if (res.status === 101) return res;
      const h = new Headers(res.headers);
      h.set("X-Content-Type-Options", "nosniff"); h.set("X-Robots-Tag", "noindex"); h.set("Referrer-Policy", "same-origin");
      return new Response(res.body, { status: res.status, headers: h });
    }
    /* pārvaldāmā QR pāradresācija: drukātais kods vienmēr ved uz /qr, mērķi maina admin panelī */
    if (url.pathname === "/qr") {
      let target = "/";
      try { await migrate(env, MIGRATIONS); target = (await getSetting(env, "qr_target", "/")) || "/"; } catch (e) {}
      return new Response(null, { status: 302, headers: { Location: new URL(target, url.origin).toString(), "Cache-Control": "no-store" } });
    }
    for (const [re, to] of REDIRECTS) if (re.test(url.pathname)) return Response.redirect(new URL(url.pathname.replace(re, to) + url.search, url.origin).toString(), 301);

    let res = await env.ASSETS.fetch(req);
    const h = new Headers(res.headers);
    const html = (h.get("Content-Type") || "").includes("text/html");
    const nonce = html ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))) : null;
    securityHeaders(h, url, nonce);
    if (PRIVATE_PAGES.test(url.pathname)) { h.set("X-Robots-Tag", "noindex, nofollow"); h.set("Cache-Control", "no-cache"); }
    if (/\/assets\/(fonts|img|vendor)\//.test(url.pathname)) h.set("Cache-Control", "public, max-age=2592000, immutable");
    else if (/\/assets\/(css|js|i18n)\//.test(url.pathname)) h.set("Cache-Control", "public, max-age=300, must-revalidate");
    res = new Response(res.body, { status: res.status, headers: h });
    if (html) res = new HTMLRewriter().on("script", { element(el){ if (!el.getAttribute("src")) el.setAttribute("nonce", nonce); } }).transform(res);
    return res;
  },
  /* plānotie uzdevumi (cron): moduļi var eksportēt scheduled(env, ctx) */
  async scheduled(event, env, execCtx){
    await migrate(env, MIGRATIONS);
    for (const m of MODULES) if (typeof m.scheduled === "function") execCtx.waitUntil(m.scheduled(env, execCtx, event).catch(e => console.error("scheduled", e && e.message)));
  }
};
