// Wolves Brotherhood MC — statiskās lapas būvētājs (bez atkarībām)
// node scripts/build.mjs  →  dist/ (lv saknē, pārējās valodas /en/, /ru/ …)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src"), DIST = path.join(ROOT, "dist"), I18N = path.join(ROOT, "i18n");
const SITE = "https://wolvesbrotherhoodmc.com";
export const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];
const LANG_NAMES = { lv: "Latviešu", en: "English", ru: "Русский", de: "Deutsch", lt: "Lietuvių", et: "Eesti", no: "Norsk", fr: "Français" };
const OG_LOCALE = { lv: "lv_LV", en: "en_GB", ru: "ru_RU", de: "de_DE", lt: "lt_LT", et: "et_EE", no: "nb_NO", fr: "fr_FR" };
const PAGES = fs.readdirSync(SRC).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/, ""));

const dicts = Object.fromEntries(LANGS.map(l => [l, JSON.parse(fs.readFileSync(path.join(I18N, l + ".json"), "utf8"))]));
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

function head(l, p) {
  const b = l === "lv" ? "" : "../";
  const alts = LANGS.map(x => `<link rel="alternate" hreflang="${x === "no" ? "nb" : x}" href="${urlFor(x, p)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${urlFor("lv", p)}">`;
  const title = T(l, `meta.${p}.title`), desc = T(l, `meta.${p}.desc`);
  return `<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${urlFor(l, p)}">
${alts}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wolves Brotherhood MC">
<meta property="og:locale" content="${OG_LOCALE[l]}">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${urlFor(l, p)}">
<meta property="og:image" content="${SITE}/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${b}assets/img/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="${b}assets/img/icon-180.png">
<link rel="manifest" href="${b}manifest.webmanifest">
<link rel="preload" href="${b}assets/fonts/big-shoulders-display-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${b}assets/vendor/leaflet/leaflet.css">
<link rel="stylesheet" href="${b}assets/css/style.css">
<script>window.LANG="${l}";window.BASE="${b}";window.PAGE="${p}";</script>
<script src="${b}assets/i18n/${l}.js"></script>
${p === "index" ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SportsOrganization", name: "Wolves Brotherhood MC", alternateName: "WBMC", sport: "Motorcycling", url: SITE, logo: SITE + "/assets/img/logo.png", email: "info@wolvesbrotherhoodmc.com", address: { "@type": "PostalAddress", streetAddress: "Jaunciema gatve 147-1", addressLocality: "Rīga", postalCode: "LV-1023", addressCountry: "LV" }, identifier: "40008360087" })}</script>` : ""}`;
}

function nav(l, p) {
  const h = p === "index" ? "" : "index.html";
  const item = (href, key, page) => `<li><a href="${href}"${page && page === p ? ' class="active" aria-current="page"' : ""}>${T(l, key)}</a></li>`;
  const langs = LANGS.map(x => `<li><a href="${l === "lv" ? (x === "lv" ? "" : x + "/") : (x === "lv" ? "../" : (x === l ? "" : "../" + x + "/"))}${pageFile(p)}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true"' : ""}><b>${x.toUpperCase()}</b> ${LANG_NAMES[x]}</a></li>`).join("");
  return `<header class="nav" id="nav">
  <div class="wrap">
    <a class="brand" href="${p === "index" ? "#top" : "index.html"}" aria-label="Wolves Brotherhood MC"><img src="${l === "lv" ? "" : "../"}assets/img/mark-256.png" alt="" width="44" height="44"><span>Wolves Brotherhood</span></a>
    <ul class="nav-links" id="navLinks">
      ${item(h + "#hronika", "nav.club")}
      ${item(h + "#pasakumi", "nav.events")}
      ${item("eiropa.html", "nav.europe", "eiropa")}
      ${item("karte.html", "nav.ridehq", "karte")}
      ${item("brali.html", "nav.riders", "brali")}
      ${item(h + "#merch", "nav.merch")}
      ${item(h + "#atbalsts", "nav.donate")}
    </ul>
    <div class="lang" id="lang">
      <button class="lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false" aria-label="${escAttr(T(l, "a11y.lang"))}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>${l.toUpperCase()}</button>
      <ul class="lang-menu" id="langMenu">${langs}</ul>
    </div>
    <a class="btn small nav-cta" href="brali.html">${T(l, "nav.cta")}</a>
    <button class="burger" id="burger" aria-label="${escAttr(T(l, "a11y.menu"))}" aria-expanded="false" aria-controls="navLinks"><span></span><span></span><span></span></button>
  </div>
</header>`;
}

function footer(l, p) {
  const h = p === "index" ? "" : "index.html";
  return `<footer>
  <div class="wrap">
    <div class="rocker" data-rocker="LATVIA" data-dir="down"></div>
    <ul class="flinks">
      <li><a href="${h}#hronika">${T(l, "nav.club")}</a></li><li><a href="eiropa.html">${T(l, "nav.europe")}</a></li><li><a href="karte.html">Ride HQ</a></li><li><a href="brali.html">${T(l, "nav.riders")}</a></li><li><a href="${h}#merch">Merch</a></li><li><a href="${h}#atbalsts">${T(l, "nav.donate")}</a></li><li><a href="${h}#pievienoties">${T(l, "nav.contact")}</a></li>
    </ul>
    <small class="reqs">Biedrība WBMC · ${T(l, "foot.reg")} 40008360087 · Jaunciema gatve 147-1, Rīga, LV-1023 · info@wolvesbrotherhoodmc.com</small>
    <small>© <span id="yr">${new Date().getFullYear()}</span> Wolves Brotherhood MC Latvia. ${T(l, "foot.credits")}</small>
  </div>
</footer>`;
}

function render(l, p) {
  let html = fs.readFileSync(path.join(SRC, p + ".html"), "utf8");
  html = html.replace(/\{\{@include:([^}]+)\}\}/g, (_, f) => fs.readFileSync(path.join(SRC, f.trim()), "utf8"));
  html = html.replace("{{@head}}", head(l, p)).replace("{{@nav}}", nav(l, p)).replace("{{@footer}}", footer(l, p));
  html = html.replace(/\{\{@lang\}\}/g, l === "no" ? "nb" : l).replace(/\{\{@base\}\}/g, l === "lv" ? "" : "../");
  html = html.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, k) => escHtmlKeep(T(l, k)));
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
// eu-events.json → JS
const ev = JSON.parse(fs.readFileSync(path.join(SRC, "assets/js/eu-events.json"), "utf8"));
fs.writeFileSync(path.join(DIST, "assets/js/eu-events.js"), "/* Eiropas moto pasākumi — ģenerēts no eu-events.json */\nwindow.EU_EVENTS=" + JSON.stringify(ev) + ";\n");
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
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  PAGES.filter(p => p !== "404").flatMap(p => LANGS.map(l => `<url><loc>${urlFor(l, p)}</loc>${LANGS.map(x => `<xhtml:link rel="alternate" hreflang="${x === "no" ? "nb" : x}" href="${urlFor(x, p)}"/>`).join("")}</url>`)).join("\n") + "\n</urlset>\n");
fs.writeFileSync(path.join(DIST, "manifest.webmanifest"), JSON.stringify({ name: "Wolves Brotherhood MC", short_name: "Wolves MC", start_url: "/", display: "standalone", background_color: "#000000", theme_color: "#000000", icons: [{ src: "/assets/img/icon-180.png", sizes: "180x180", type: "image/png" }, { src: "/assets/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }] }, null, 1));
console.log(`OK: ${LANGS.length} valodas × ${PAGES.length} lapas → dist/`);
