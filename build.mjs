// Wolves Brotherhood MC — statiskās lapas būve 8 valodās.
// Lietošana: node build.mjs   → izveido dist/
// Bez atkarībām (tikai Node 18+).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const SITE = "https://wolvesbrotherhoodmc.com";
export const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];
const DEFAULT = "lv";
const LANG_NAMES = { lv: "Latviešu", en: "English", ru: "Русский", de: "Deutsch", lt: "Lietuvių", et: "Eesti", no: "Norsk", fr: "Français" };
const OG = { lv: "lv_LV", en: "en_GB", ru: "ru_RU", de: "de_DE", lt: "lt_LT", et: "et_EE", no: "nb_NO", fr: "fr_FR" };
const PAGES = { index: "index.html", ride: "ride.html", events: "events.html", riders: "riders.html" };
const VER = Date.now().toString(36);

const read = p => fs.readFileSync(p, "utf8");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dicts = Object.fromEntries(LANGS.map(l => [l, JSON.parse(read(path.join(SRC, "i18n", l + ".json")))]));
const urlFor = (lang, page) => (lang === DEFAULT ? "/" : `/${lang}/`) + (page === "index" ? "" : PAGES[page]);

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    const s = path.join(a, f), d = path.join(b, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function expandPartials(html, depth = 0) {
  if (depth > 5) throw new Error("partials too deep");
  return html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => expandPartials(read(path.join(SRC, "partials", n + ".html")), depth + 1));
}

const missing = new Set();
function render(tpl, lang, page) {
  const d = dicts[lang], base = lang === DEFAULT ? "" : "../";
  const rel = p => base + (lang === DEFAULT ? "" : "") + PAGES[p];
  const hreflang = LANGS.map(l => `<link rel="alternate" hreflang="${l === "no" ? "nb" : l}" href="${SITE}${urlFor(l, page)}">`).join("\n") +
    `\n<link rel="alternate" hreflang="x-default" href="${SITE}${urlFor(DEFAULT, page)}">`;
  const langswitch = LANGS.map(l => {
    const href = (lang === DEFAULT ? (l === DEFAULT ? "" : l + "/") : (l === DEFAULT ? "../" : "../" + l + "/")) + PAGES[page];
    return `<li role="none"><a role="menuitem" href="${href}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ""}><b>${l.toUpperCase()}</b> ${LANG_NAMES[l]}</a></li>`;
  }).join("");
  const special = {
    lang, base, ver: VER, ogLocale: OG[lang], "lang.code": lang.toUpperCase(),
    home: base + "index.html", "p.ride": base + "ride.html", "p.events": base + "events.html", "p.riders": base + "riders.html", "p.index": base + "index.html",
    canonical: SITE + urlFor(lang, page), hreflang, langswitch,
    pagesJson: JSON.stringify({ index: base + "index.html", ride: base + "ride.html", events: base + "events.html", riders: base + "riders.html" }),
    "meta.title": d[`meta.${page}.title`] ?? dicts.en[`meta.${page}.title`],
    "meta.desc": d[`meta.${page}.desc`] ?? dicts.en[`meta.${page}.desc`]
  };
  const RAW = new Set(["hreflang", "langswitch", "pagesJson"]);
  return tpl.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (m, k) => {
    if (k in special) return RAW.has(k) ? special[k] : esc(special[k]);
    if (k in d) return esc(d[k]);
    missing.add(`${lang}:${k}`);
    if (k in dicts.en) return esc(dicts.en[k]);
    if (k in dicts.lv) return esc(dicts.lv[k]);
    throw new Error(`Missing i18n key "${k}" (page ${page})`);
  });
}

rmrf(DIST);
copyDir(path.join(SRC, "assets"), path.join(DIST, "assets"));
fs.mkdirSync(path.join(DIST, "assets", "i18n"), { recursive: true });
// events json → js
const ev = read(path.join(SRC, "assets", "js", "eu-events.json"));
fs.writeFileSync(path.join(DIST, "assets", "js", "eu-events.js"), "window.EU_EVENTS=" + JSON.stringify(JSON.parse(ev)) + ";\n");
for (const l of LANGS) {
  fs.writeFileSync(path.join(DIST, "assets", "i18n", l + ".js"), `window.I18N=${JSON.stringify(dicts[l])};window.I18N_EN=${l === "en" ? "window.I18N" : JSON.stringify(dicts.en)};\n`);
}
for (const [page, file] of Object.entries(PAGES)) {
  const srcFile = path.join(SRC, "pages", file);
  if (!fs.existsSync(srcFile)) { console.warn("skip (no template):", file); continue; }
  const tpl = expandPartials(read(srcFile));
  for (const l of LANGS) {
    const out = l === DEFAULT ? path.join(DIST, file) : path.join(DIST, l, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(tpl, l, page));
  }
}
// root files
for (const f of fs.readdirSync(path.join(SRC, "root"))) fs.copyFileSync(path.join(SRC, "root", f), path.join(DIST, f));
// sitemap
const urls = Object.keys(PAGES).filter(p => fs.existsSync(path.join(SRC, "pages", PAGES[p]))).flatMap(p => LANGS.map(l =>
  `<url><loc>${SITE}${urlFor(l, p)}</loc>${LANGS.map(x => `<xhtml:link rel="alternate" hreflang="${x === "no" ? "nb" : x}" href="${SITE}${urlFor(x, p)}"/>`).join("")}</url>`));
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`);
if (missing.size) console.warn(`i18n: ${missing.size} trūkstošas atslēgas (izmantots EN):\n  ` + [...missing].slice(0, 40).join("\n  "));
console.log(`OK → dist/ (${LANGS.length} valodas, versija ${VER})`);
