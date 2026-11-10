// WBMC — statiskās lapas būvētājs (bez atkarībām)
// node scripts/build.mjs  →  dist/ (lv saknē, pārējās valodas /en/, /ru/ …)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src"), I18N = path.join(ROOT, "i18n");
const DIST = process.env.BUILD_OUT ? path.resolve(process.env.BUILD_OUT) : path.join(ROOT, "dist");
const SITE = "https://wolvesbrotherhoodmc.com";
export const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];
const LANG_NAMES = { lv: "Latviešu", en: "English", ru: "Русский", de: "Deutsch", lt: "Lietuvių", et: "Eesti", no: "Norsk", fr: "Français" };
const OG_LOCALE = { lv: "lv_LV", en: "en_GB", ru: "ru_RU", de: "de_DE", lt: "lt_LT", et: "et_EE", no: "nb_NO", fr: "fr_FR" };
const PAGES = fs.readdirSync(SRC).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/, ""));
/* slēgtās lapas: nav sitemap, robots Disallow, meta noindex (+ Worker X-Robots-Tag) */
const PRIVATE = new Set(["sazina", "brali", "admin", "pieslegties", "profils"]);
const FACEBOOK = "https://www.facebook.com/WolvesBrotherhoodMc/about";
const CONTACT_EMAIL = "wolvesmc@inbox.lv";

/* tulkojumi: i18n/<lang>.json + i18n/<modulis>/<lang>.json */
const loadDict = l => {
  const d = JSON.parse(fs.readFileSync(path.join(I18N, l + ".json"), "utf8"));
  for (const dir of fs.readdirSync(I18N, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const f = path.join(I18N, dir.name, l + ".json");
    if (fs.existsSync(f)) Object.assign(d, JSON.parse(fs.readFileSync(f, "utf8")));
  }
  return d;
};
const dicts = Object.fromEntries(LANGS.map(l => [l, loadDict(l)]));
const base = dicts.lv;
let missing = 0;
for (const l of LANGS) for (const k of Object.keys(base)) if (!k.endsWith(".zero") && !(k in dicts[l])) { if (missing < 40) console.warn(`[i18n] ${l} trūkst: ${k}`); missing++; }
if (missing) console.warn(`[i18n] kopā trūkst ${missing} tulkojumu (izmanto en/lv rezerves)`);
const T = (l, k) => {
  const v = dicts[l][k] ?? dicts.en[k] ?? dicts.lv[k];
  if (v === undefined) throw new Error(`Nezināma i18n atslēga: ${k}`);
  return v;
};
const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const langDir = l => l === "lv" ? "" : l + "/";
const pageFile = p => p === "index" ? "" : p + ".html";
const urlFor = (l, p) => `${SITE}/${langDir(l)}${pageFile(p)}`;
const relLang = (from, to, p) => `${from === "lv" ? "" : "../"}${langDir(to)}${pageFile(p)}` || "./";

/* navigācija: secība pēc specifikācijas 1. sadaļas */
const NAV = [
  ["klubs", "nav.club", 1], ["pasakumi", "nav.events", 1], ["karte", "nav.ridehq", 1], ["brali", "nav.brothers", 1], ["memorials", "nav.memorials", 1],
  ["sazina", "nav.comms", 0, "member"], ["atbalsts", "nav.support", 0], ["merch", "nav.merch", 1], ["partneri", "nav.partners", 0]
];
const SUBNAV = [["sadarbiba", "nav.advertise"], ["spele", "nav.chess"], ["privatums", "nav.privacy"], ["admin", "nav.admin", "admin"]];

function head(l, p) {
  const b = l === "lv" ? "" : "../";
  const priv = PRIVATE.has(p);
  const alts = priv ? "" : LANGS.map(x => `<link rel="alternate" hreflang="${x === "no" ? "nb" : x}" href="${urlFor(x, p)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${urlFor("lv", p)}">`;
  const title = T(l, `meta.${p}.title`), desc = T(l, `meta.${p}.desc`);
  const ld = p === "index" ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SportsOrganization", name: "WBMC", alternateName: "Wolves Brotherhood MC", sport: "Motorcycling", foundingDate: "1999", url: SITE, logo: SITE + "/assets/img/logo.png", email: CONTACT_EMAIL, sameAs: [FACEBOOK], address: { "@type": "PostalAddress", addressLocality: "Rīga", addressCountry: "LV" } })}</script>` : "";
  return `<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
${priv ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${urlFor(l, p)}">`}
${alts}
<meta property="og:type" content="website">
<meta property="og:site_name" content="WBMC">
<meta property="og:locale" content="${OG_LOCALE[l]}">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${urlFor(l, p)}">
<meta property="og:image" content="${SITE}/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${b}assets/img/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="${b}assets/img/icon-180.png">
<link rel="manifest" href="${b}manifest.webmanifest">
<link rel="preload" href="${b}assets/fonts/big-shoulders-display-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${b}assets/fonts/fira-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${b}assets/css/core.css">
<script>document.documentElement.classList.add("js");window.LANG="${l}";window.BASE="${b}";window.PAGE="${p}";
(function(){try{var s=localStorage.getItem("wb-lang"),L=${JSON.stringify(LANGS)},r=document.referrer;if(s&&s!=="${l}"&&L.indexOf(s)>=0&&(!r||r.indexOf(location.origin)!==0)&&!/[?&]lang=/.test(location.search)){var p=location.pathname.replace(/^\\/(${LANGS.filter(x => x !== "lv").join("|")})\\//,"/");location.replace((s==="lv"?"":"/"+s)+p+location.search+location.hash)}}catch(e){}})();</script>
<script src="${b}assets/i18n/${l}.js"></script>
${ld}`;
}

const ICON = {
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.5-1 1-1h2.3V2.1L14.2 2C10.9 2 10 4.2 10 6.3v2.2H7.5V12H10v10h4V12h3l.4-3.5z"/></svg>'
};

function nav(l, p) {
  const b = l === "lv" ? "" : "../";
  const href = pg => pg === "index" ? (l === "lv" ? "./" : "./") : pg + ".html";
  const cur = pg => pg === p ? ' aria-current="page"' : "";
  const inline = NAV.filter(n => n[2]).map(([pg, k]) => `<li><a href="${href(pg)}"${cur(pg)}>${T(l, k)}</a></li>`).join("");
  const full = NAV.map(([pg, k, , need]) => `<li${need ? ` data-need="${need}" hidden` : ""}><a href="${href(pg)}"${cur(pg)}>${T(l, k)}</a></li>`).join("");
  const sub = SUBNAV.map(([pg, k, need]) => `<li${need ? ` data-need="${need}" hidden` : ""}><a href="${href(pg)}"${cur(pg)}>${T(l, k)}</a></li>`).join("");
  const langs = cls => LANGS.map(x => `<li><a href="${relLang(l, x, p)}" hreflang="${x}" lang="${x}" data-lang="${x}"${x === l ? ' aria-current="true"' : ""}><b>${x.toUpperCase()}</b>${LANG_NAMES[x]}</a></li>`).join("");
  return `<a class="skip" href="#main">${T(l, "a11y.skip")}</a>
<header class="nav" id="nav">
  <div class="wrap">
    <a class="brand" href="${href("index")}" aria-label="WBMC — ${escAttr(T(l, "nav.home"))}"><img src="${b}assets/img/logo-600.png" alt="" width="44" height="44"><span>WBMC</span></a>
    <ul class="nav-links">${inline}</ul>
    <div class="nav-tools">
      <div class="lang" id="lang">
        <button class="nav-btn" id="langBtn" aria-haspopup="true" aria-expanded="false" aria-controls="langMenu" aria-label="${escAttr(T(l, "a11y.lang"))}: ${LANG_NAMES[l]}">${ICON.globe}<span>${l.toUpperCase()}</span></button>
        <ul class="lang-menu" id="langMenu">${langs()}</ul>
      </div>
      <a class="nav-btn" id="commsBtn" href="sazina.html" hidden>${ICON.chat}<span class="account-label">${T(l, "nav.comms")}</span><span class="dot" id="commsDot" hidden></span></a>
      <a class="nav-btn" id="accountBtn" href="pieslegties.html">${ICON.user}<span class="account-label">${T(l, "nav.login")}</span></a>
      <button class="nav-btn menu-btn" id="menuBtn" aria-label="${escAttr(T(l, "a11y.menu"))}" aria-expanded="false" aria-controls="drawer"><i></i></button>
    </div>
  </div>
  <span class="nav-progress" id="navProgress" aria-hidden="true"></span>
</header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="${escAttr(T(l, "a11y.menu"))}">
  <div class="drawer-bg" data-close></div>
  <div class="drawer-panel">
    <div class="drawer-head"><a class="brand" href="${href("index")}"><img src="${b}assets/img/logo-600.png" alt="" width="40" height="40"><span>WBMC</span></a><button class="icon-btn" data-close aria-label="${escAttr(T(l, "a11y.close"))}">${ICON.close}</button></div>
    <div class="drawer-body">
      <nav aria-label="${escAttr(T(l, "a11y.mainnav"))}"><h2>${T(l, "nav.menu")}</h2><ul class="drawer-nav">${full}</ul></nav>
      <nav aria-label="${escAttr(T(l, "nav.more"))}"><ul class="drawer-nav sub">${sub}</ul></nav>
      <section><h2>${T(l, "a11y.lang")}</h2><ul class="lang-grid">${langs()}</ul></section>
    </div>
    <div class="drawer-foot"><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><a class="social" href="${FACEBOOK}" target="_blank" rel="noopener noreferrer">${ICON.fb}Facebook</a></div>
  </div>
</div>`;
}

function footer(l, p) {
  const b = l === "lv" ? "" : "../";
  const href = pg => pg === "index" ? "./" : pg + ".html";
  return `<footer class="site">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand"><img src="${b}assets/img/logo-600.png" alt="WBMC" width="132" height="132" loading="lazy"><p>Latvian Motorcycle Club from 1999</p><p class="motto">One brotherhood. One road. We are.</p></div>
      <nav aria-label="${escAttr(T(l, "a11y.footnav"))}"><h2>${T(l, "nav.menu")}</h2><ul class="foot-links">${NAV.filter(n => !n[3]).map(([pg, k]) => `<li><a href="${href(pg)}">${T(l, k)}</a></li>`).join("")}<li><a href="sadarbiba.html">${T(l, "nav.advertise")}</a></li></ul></nav>
      <div><h2>${T(l, "foot.contact")}</h2><ul class="foot-links"><li><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li><li><a class="social" href="${FACEBOOK}" target="_blank" rel="noopener noreferrer">${ICON.fb}Facebook</a></li><li><a href="atbalsts.html">${T(l, "nav.support")}</a></li><li><a href="privatums.html">${T(l, "nav.privacy")}</a></li></ul></div>
    </div>
    <div class="foot-legal"><span>WBMC BIEDRĪBA</span><span>${T(l, "foot.reg")} 40008360087</span><span>© ${new Date().getFullYear()} WBMC</span><span>${T(l, "foot.credits")}</span></div>
  </div>
</footer>`;
}

function render(l, p) {
  let html = fs.readFileSync(path.join(SRC, p + ".html"), "utf8");
  html = html.replace(/\{\{@include:([^}]+)\}\}/g, (_, f) => fs.readFileSync(path.join(SRC, f.trim()), "utf8"));
  html = html.replace("{{@head}}", head(l, p)).replace("{{@nav}}", nav(l, p)).replace("{{@footer}}", footer(l, p));
  html = html.replace(/\{\{@css:([^}]+)\}\}/g, (_, list) => list.split(",").map(n => n.trim()).filter(Boolean).map(n => n === "leaflet" ? `<link rel="stylesheet" href="{{@base}}assets/vendor/leaflet/leaflet.css">` : `<link rel="stylesheet" href="{{@base}}assets/css/${n}.css">`).join("\n"));
  html = html.replace(/\{\{@lang\}\}/g, l === "no" ? "nb" : l).replace(/\{\{@base\}\}/g, l === "lv" ? "" : "../");
  // teksta kontekstā atzīmējam atslēgu ar komentāriem, lai administratora tulkojumu labojumi darbotos arī statiskajā tekstā
  html = html.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (m, k, off, all) => {
    const v = escHtmlKeep(T(l, k));
    const inTag = all.lastIndexOf("<", off) > all.lastIndexOf(">", off);
    const inRaw = all.lastIndexOf("<title", off) > all.lastIndexOf("</title>", off) || all.lastIndexOf("<textarea", off) > all.lastIndexOf("</textarea>", off) || all.lastIndexOf("<option", off) > all.lastIndexOf(">", off);
    return inTag || inRaw ? v : `<!--t:${k}-->${v}<!--/t-->`;
  });
  if (/\{\{/.test(html)) throw new Error(`${l}/${p}: palika neaizstāts {{…}}`);
  return html;
}
// tulkojumos atļauts <b>, <br>, <a> — pārējais tiek escapēts
function escHtmlKeep(s) {
  return String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, "&amp;").replace(/<(?!\/?(b|br|i)(\s|>|\/))/g, "&lt;").replace(/"/g, "&quot;");
}

function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a, { withFileTypes: true })) {
    const s = path.join(a, f.name), d = path.join(b, f.name);
    f.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(SRC, "assets"), path.join(DIST, "assets"));
// eu-events.json → JS (rezerves dati, ja API nav pieejams)
if (fs.existsSync(path.join(SRC, "assets/js/eu-events.json"))) {
  const ev = JSON.parse(fs.readFileSync(path.join(SRC, "assets/js/eu-events.json"), "utf8"));
  fs.writeFileSync(path.join(DIST, "assets/js/eu-events.js"), "/* Moto pasākumi — ģenerēts no eu-events.json */\nwindow.EU_EVENTS=" + JSON.stringify(ev) + ";\n");
}
// i18n JS
fs.mkdirSync(path.join(DIST, "assets/i18n"), { recursive: true });
for (const l of LANGS) fs.writeFileSync(path.join(DIST, `assets/i18n/${l}.js`), `window.I18N=${JSON.stringify({ ...dicts.lv, ...dicts.en, ...dicts[l] })};\n`);
// pages
for (const l of LANGS) for (const p of PAGES) {
  const out = path.join(DIST, langDir(l), p + ".html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(l, p));
}
// static extras
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n${[...PRIVATE].flatMap(p => ["/" + p + ".html", ...LANGS.filter(l => l !== "lv").map(l => `/${l}/${p}.html`)]).map(x => "Disallow: " + x).join("\n")}\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  PAGES.filter(p => p !== "404" && !PRIVATE.has(p)).flatMap(p => LANGS.map(l => `<url><loc>${urlFor(l, p)}</loc>${LANGS.map(x => `<xhtml:link rel="alternate" hreflang="${x === "no" ? "nb" : x}" href="${urlFor(x, p)}"/>`).join("")}</url>`)).join("\n") + "\n</urlset>\n");
fs.writeFileSync(path.join(DIST, "manifest.webmanifest"), JSON.stringify({ name: "WBMC — Latvian Motorcycle Club", short_name: "WBMC", start_url: "/", display: "standalone", background_color: "#000000", theme_color: "#000000", icons: [{ src: "/assets/img/icon-180.png", sizes: "180x180", type: "image/png" }, { src: "/assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }] }, null, 1));
console.log(`OK: ${LANGS.length} valodas × ${PAGES.length} lapas → ${path.relative(ROOT, DIST) || "dist"}/`);
