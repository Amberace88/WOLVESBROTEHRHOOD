/* WBMC — kopīgās funkcijas visām lapām */
(function(){
const W = window.WB = {};
const LANG = W.lang = window.LANG || "lv";
const LOCALE = W.locale = { lv: "lv-LV", en: "en-GB", ru: "ru-RU", de: "de-DE", lt: "lt-LT", et: "et-EE", no: "nb-NO", fr: "fr-FR" }[LANG] || "lv-LV";
W.base = window.BASE || "";

/* ---------- helpers ---------- */
W.$ = (s, r=document) => r.querySelector(s);
W.$$ = (s, r=document) => [...r.querySelectorAll(s)];
W.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
W.pad = n => String(n).padStart(2,"0");
W.mmdd = d => W.pad(d.getMonth()+1) + "-" + W.pad(d.getDate());
W.iso = d => d.getFullYear()+"-"+W.pad(d.getMonth()+1)+"-"+W.pad(d.getDate());
W.day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
W.parseISO = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };

/* ---------- i18n ---------- */
const D = window.I18N || {};
W.t = (k, vars) => {
  let s = D[k]; if (s === undefined) { console.warn("i18n:", k); s = k; }
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
  return s;
};
const PR = new Intl.PluralRules(LOCALE);
W.tp = (k, n, vars) => { const r = PR.select(n); const key = D[`${k}.${r}`] !== undefined ? `${k}.${r}` : `${k}.other`; return W.t(key, { n, ...(vars||{}) }); };
// daudzvalodu saturs: string vai {lv, en, ru …}
W.L = v => v == null ? "" : typeof v === "string" ? v : (v[LANG] ?? v.en ?? v.lv ?? Object.values(v)[0] ?? "");

/* ---------- dates (Intl) ---------- */
const fmt = o => new Intl.DateTimeFormat(LOCALE, o);
const fDM = fmt({ day: "numeric", month: "long" }), fDMY = fmt({ day: "numeric", month: "long", year: "numeric" }),
  fMY = fmt({ month: "long", year: "numeric" }), fWD = fmt({ weekday: "long" }), fMS = fmt({ month: "short" }), fWDs = fmt({ weekday: "short" }),
  fM = fmt({ month: "long" }), fT = fmt({ hour: "2-digit", minute: "2-digit" });
W.dayLabel = d => fDM.format(d);
W.dateLong = d => fDMY.format(d);
W.monthYear = d => W.cap(fMY.format(d));
W.monthName = d => fM.format(d);
W.weekday = d => fWD.format(d);
W.monShort = d => fMS.format(d).replace(".", "").toUpperCase();
W.time = d => fT.format(d);
W.dowShort = () => [1,2,3,4,5,6,0].map(i => fWDs.format(new Date(2024, 0, 7 + i)));  // P…Sv (pirmdiena pirmā)
W.range = (a, b) => { try { return fmt({ day: "numeric", month: "short", year: "numeric" }).formatRange(a, b); } catch(e) { return fDMY.format(a) + " – " + fDMY.format(b); } };
W.daysUntil = d => Math.round((W.day0(d) - W.day0(new Date())) / 864e5);
W.relDays = n => n === 0 ? W.t("js.today") : n === 1 ? W.t("js.tomorrow") : W.tp("js.inDays", n);
W.num = n => new Intl.NumberFormat(LOCALE).format(n);
W.eur = n => new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/* ---------- name days (Latvijas kalendārs) ---------- */
W.names = d => {
  const k = typeof d === "string" ? d : W.mmdd(d);
  const v = (window.NAMEDAYS || {})[k] || [[],[]];
  return { main: v[0], ext: v[1] };
};
W.findName = q => {
  q = q.trim().toLocaleLowerCase("lv"); if (!q) return [];
  const out = [], N = window.NAMEDAYS || {};
  for (const [k,[a,b]] of Object.entries(N)) {
    for (const n of a) if (n.toLocaleLowerCase("lv") === q) out.push({k, n, ext:false});
    for (const n of b) if (n.toLocaleLowerCase("lv") === q) out.push({k, n, ext:true});
  }
  if (!out.length) for (const [k,[a,b]] of Object.entries(N)) for (const n of [...a,...b]) if (n.toLocaleLowerCase("lv").startsWith(q) && n.length < 30) out.push({k, n, ext: !a.includes(n)});
  return out.slice(0, 8);
};

/* ---------- special days ---------- */
function easter(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
  i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
  return new Date(y, mo-1, da);
}
const addD = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const nthDow = (y, m, dow, n) => { const f = new Date(y, m, 1); return new Date(y, m, 1 + (dow - f.getDay() + 7) % 7 + 7*(n-1)); };
const cache = {};
W.specialDays = function(y){
  if (cache[y]) return cache[y];
  const L = [];
  const add = (d, name, type, note) => L.push({ key: W.iso(d), date: d, name, type, note: note || "" });
  const H = k => W.t("hol." + k);
  const D2 = (m, d) => new Date(y, m-1, d);
  const e = easter(y);
  // valsts svētki
  add(D2(1,1), H("newyear"), "valsts");
  add(addD(e,-2), H("goodfriday"), "valsts");
  add(e, H("easter"), "valsts");
  add(addD(e,1), H("easter2"), "valsts");
  add(D2(5,1), H("may1"), "valsts");
  add(D2(5,4), H("may4"), "valsts", H("may4note"));
  add(D2(6,23), H("ligo"), "valsts");
  add(D2(6,24), H("jani"), "valsts");
  add(D2(11,18), H("nov18"), "valsts");
  add(D2(12,24), H("xmaseve"), "valsts");
  add(D2(12,25), H("xmas1"), "valsts");
  add(D2(12,26), H("xmas2"), "valsts");
  add(D2(12,31), H("nye"), "valsts");
  // piemiņas dienas
  add(D2(1,20), H("barricades"), "atceres");
  add(D2(3,25), H("deport1"), "atceres");
  add(D2(5,8), H("may8"), "atceres");
  add(D2(6,14), H("deport2"), "atceres");
  add(D2(6,17), H("occupation"), "atceres");
  add(D2(6,22), H("heroes"), "atceres", H("heroesnote"));
  add(D2(7,4), H("holocaust"), "atceres");
  add(D2(8,23), H("balticway"), "atceres", H("balticwaynote"));
  add(D2(9,22), H("baltunity"), "atceres");
  add(D2(11,11), H("lacplesis"), "atceres");
  // tradīcijas
  add(nthDow(y,4,0,2), H("mothers"), "tradicija");
  add(addD(e,49), H("pentecost"), "tradicija");
  add(nthDow(y,8,0,2), H("fathers"), "tradicija");
  // moto dienas
  add(D2(6,21), H("motoday"), "moto");
  add(nthDow(y,5,1,3), H("ridetowork"), "moto", H("ridetoworknote"));
  add(nthDow(y,10,0,3), H("roadvictims"), "moto", H("roadvictimsnote"));
  // klubs
  const C = window.CLUB || {};
  if (C.founded && C.founded.date) { const [m,d] = C.founded.date.split("-").map(Number); add(D2(m,d), H("clubday") + (C.founded.year ? ` — ${y - C.founded.year}.` : ""), "klubs"); }
  if (C.legal && C.legal.registered) { const r = W.parseISO(C.legal.registered); if (y > r.getFullYear()) add(D2(r.getMonth()+1, r.getDate()), W.t("hol.regday", { n: y - r.getFullYear() }), "klubs"); }
  (window.EVENTS || []).forEach(ev => { if (ev.date.startsWith(String(y))) add(W.parseISO(ev.date), W.L(ev.title), "klubs", W.L(ev.place)); });
  return cache[y] = L;
};
W.typeLabel = t => W.t("type." + t);
W.clearSpecial = () => { for (const k in cache) delete cache[k]; };
W.nextSpecial = from => {
  const t0 = W.day0(from);
  return [...W.specialDays(t0.getFullYear()), ...W.specialDays(t0.getFullYear()+1)].filter(x => x.date > t0 && x.type !== "tradicija").sort((a,b) => a.date - b.date)[0];
};

/* ---------- weather ---------- */
W.wmo = code => W.t("wmo." + code) || "";
W.rideIndex = ({ rain=0, temp=15, gust=0, code=0, precip=0 }) => {
  let s = 100;
  s -= rain * 0.55; s -= Math.min(precip, 5) * 6;
  if (temp < 14) s -= (14 - temp) * 3.2; if (temp > 29) s -= (temp - 29) * 3; if (temp < 3) s -= 25;
  if (gust > 30) s -= (gust - 30) * 1.1;
  if ([95,96,99].includes(code)) s -= 35;
  if ([56,57,66,67,71,73,75,77,85,86].includes(code)) s -= 50;
  if ([45,48].includes(code)) s -= 12;
  return Math.max(0, Math.min(100, Math.round(s)));
};
W.rideVerdict = i => W.t(i >= 80 ? "js.ride.great" : i >= 60 ? "js.ride.good" : i >= 40 ? "js.ride.careful" : "js.ride.garage");
W.dir16 = deg => W.t("js.compass").split(",")[Math.round(((deg%360)/22.5))%16];

/* ---------- rocker headings (signature) ---------- */
let rid = 0;
W.rocker = el => {
  const text = el.dataset.rocker; if (!text) return;
  const down = el.dataset.dir === "down", id = "rk" + (rid++);
  // koncentriski loki — īsta uzšuves "rocker" forma
  const n = [...text].length, fs = Math.min(58, 1450 / Math.max(n, 6));
  // teksta bāzes līnija pusē zem joslas vidus, lai lielie burti stāv tieši centrā
  const Ro = 1080, Ri = 990, Rt = 1035 + (down ? 1 : -1) * 0.34 * fs, th = Math.asin(470 / Ro), cx = 500, cy = down ? -880 : 1100, sg = down ? 1 : -1;
  const P = (r, s) => [(cx + s * r * Math.sin(th)).toFixed(1), (cy + sg * r * Math.cos(th)).toFixed(1)];
  const [oL, oR, iL, iR, tL, tR] = [P(Ro, -1), P(Ro, 1), P(Ri, -1), P(Ri, 1), P(Rt, -1), P(Rt, 1)];
  const shape = down
    ? `M ${oL} A ${Ro} ${Ro} 0 0 0 ${oR} L ${iR} A ${Ri} ${Ri} 0 0 1 ${iL} Z`
    : `M ${oL} A ${Ro} ${Ro} 0 0 1 ${oR} L ${iR} A ${Ri} ${Ri} 0 0 0 ${iL} Z`;
  const tp = `M ${tL} A ${Rt} ${Rt} 0 0 ${down ? 0 : 1} ${tR}`;
  const vb = down ? "0 0 1000 214" : "0 8 1000 214";
  el.innerHTML = `<span class="sr-only">${W.esc(el.textContent.trim() || text)}</span>
  <svg viewBox="${vb}" aria-hidden="true" focusable="false">
    <defs><path id="${id}" d="${tp}"/></defs>
    <path class="r-shape" d="${shape}"/>
    <text font-size="${fs}" text-anchor="middle"><textPath href="#${id}" startOffset="50%">${W.esc(text)}</textPath></text>
  </svg>`;
  const p = el.querySelector(".r-shape");
  try { el.style.setProperty("--len", Math.ceil(p.getTotalLength())); } catch(e) { el.style.setProperty("--len", 3000); }
};
/* ---------- ikonas (vienots līniju stils) ---------- */
const IC = {
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
  jacket: '<path d="M8 3l4 3 4-3 4 3-2 5h-2v10H8V11H6L4 6z"/><path d="M12 6v15"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  fire: '<path d="M12 22c4 0 7-2.8 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4.2 3 7 7 7z"/><path d="M12 22c-1.7 0-3-1.3-3-3 0-2 3-4 3-4s3 2 3 4c0 1.7-1.3 3-3 3z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  sos: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  warn: '<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  hands: '<path d="M2 12l5-5 4 2 3-2 4 1 4 4-3 3"/><path d="M7 7l-1 6 4 4 3-2 3 2 3-2-5-5-3 2-3-2"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  nav: '<path d="M3 11l18-8-8 18-2-8z"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>'
};
W.icon = (n, cls = "") => `<svg class="ico-svg ${cls}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

/* ---------- parādīšanās animācija (vienreiz, ievēro reduced-motion) ---------- */
W.initReveal = (root = document) => {
  const els = W.$$("[data-reveal]", root).filter(e => !e.classList.contains("rv-in"));
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return els.forEach(e => e.classList.add("rv-in"));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("rv-in"); io.unobserve(e.target); } }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  els.forEach((e, i) => { e.style.setProperty("--rv-d", (+(e.dataset.reveal || 0)) * 70 + "ms"); io.observe(e); });
};
W.cap = s => s ? s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1) : s;
W.initRockers = () => {
  const els = W.$$("[data-rocker]").filter(e => !e.dataset.rk); els.forEach(e => { e.dataset.rk = "1"; W.rocker(e); });
  if (!("IntersectionObserver" in window)) return els.forEach(e => e.classList.add("in"));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .4 });
  els.forEach(el => io.observe(el));
};

/* ---------- galvene: valodas izvēle, ☰ izvēlne, konta stāvoklis ---------- */
W.initNav = () => {
  const nav = W.$("#nav"); if (!nav || nav.dataset.init) return; nav.dataset.init = "1";
  const bar = W.$("#navProgress");
  const onScroll = () => {
    nav.classList.toggle("scrolled", scrollY > 8);
    if (bar) { const h = document.documentElement.scrollHeight - innerHeight; bar.style.setProperty("--p", (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + "%"); }
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  // valodas izvēle saglabājas nākamajām sesijām (2. sadaļa)
  W.$$("a[data-lang]").forEach(a => a.addEventListener("click", () => { try { localStorage.setItem("wb-lang", a.dataset.lang); } catch (e) {} }));
  const lb = W.$("#langBtn"), lm = W.$("#lang");
  if (lb) {
    const close = () => { lm.classList.remove("open"); lb.setAttribute("aria-expanded", "false"); };
    lb.addEventListener("click", e => { e.stopPropagation(); const o = lm.classList.toggle("open"); lb.setAttribute("aria-expanded", o); if (o) { const c = W.$("#langMenu [aria-current]") || W.$("#langMenu a"); c && c.focus(); } });
    document.addEventListener("click", e => { if (!lm.contains(e.target)) close(); });
    addEventListener("keydown", e => { if (e.key === "Escape" && lm.classList.contains("open")) { close(); lb.focus(); } });
  }
  // ☰ izvēlne
  const dr = W.$("#drawer"), mb = W.$("#menuBtn");
  if (dr && mb) {
    let last = null;
    const open = () => { last = document.activeElement; dr.classList.add("open"); document.body.classList.add("locked"); mb.setAttribute("aria-expanded", "true"); requestAnimationFrame(() => { dr.classList.add("on"); const f = W.$(".drawer-nav a", dr); f && f.focus(); }); };
    const shut = () => { dr.classList.remove("on"); mb.setAttribute("aria-expanded", "false"); document.body.classList.remove("locked"); setTimeout(() => dr.classList.remove("open"), 320); last && last.focus && last.focus(); };
    mb.addEventListener("click", open);
    W.$$("[data-close]", dr).forEach(x => x.addEventListener("click", shut));
    dr.addEventListener("keydown", e => {
      if (e.key === "Escape") return shut();
      if (e.key !== "Tab") return;
      const f = W.$$("a,button", dr).filter(x => x.offsetParent !== null); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }
  // pirmā apmeklējuma ieteikums pēc pārlūka valodas — bez piespiedu pārvirzes, bez ģeolokācijas
  try {
    if (!localStorage.getItem("wb-lang") && !document.body.classList.contains("app")) {
      const pref = (navigator.languages || [navigator.language || ""]).map(x => x.slice(0, 2).toLowerCase()).map(x => x === "nb" || x === "nn" ? "no" : x)[0];
      if (pref && pref !== LANG && ["lv", "en", "ru", "de", "lt", "et", "no", "fr"].includes(pref)) {
        const a = W.$(`#langMenu a[data-lang="${pref}"]`);
        if (a) {
          const hint = document.createElement("div"); hint.className = "lang-hint"; hint.setAttribute("role", "status");
          hint.innerHTML = `<span lang="${pref}">${W.esc(a.textContent.trim().slice(2))}?</span><a class="btn small" href="${a.getAttribute("href")}" data-lang="${pref}">${pref.toUpperCase()}</a><button class="icon-btn" aria-label="${W.esc(W.t("a11y.close"))}">${W.icon("close")}</button>`;
          hint.querySelector("a").addEventListener("click", () => { try { localStorage.setItem("wb-lang", pref); } catch (e) {} });
          hint.querySelector("button").onclick = () => { hint.remove(); try { localStorage.setItem("wb-lang", LANG); } catch (e) {} };
          document.body.appendChild(hint);
        }
      }
    }
  } catch (e) {}
  W.session().then(W.paintAccount);
  W.applyOverrides();
};

/* ---------- API klients (HttpOnly sesijas sīkdatne + CSRF galvene) ---------- */
W.api = () => "/api";
W.wsUrl = path => (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/api" + path;
W.ApiError = class extends Error { constructor(status, body){ super((body && body.error) || "HTTP " + status); this.status = status; this.code = body && body.code; this.body = body; } };
W.req = async (path, opt = {}) => {
  const o = { method: opt.method || (opt.body !== undefined ? "POST" : "GET"), headers: { "X-WBMC": "1" }, credentials: "same-origin" };
  if (opt.body !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(opt.body); }
  let r;
  try { r = await fetch("/api" + path, o); } catch (e) { throw new W.ApiError(0, { error: W.t("api.offline"), code: "offline" }); }
  if (opt.raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new W.ApiError(r.status, j);
    // administrācijas darbībām vajag svaigu MFA kodu → jautājam un atkārtojam vienreiz
    if (err.code === "mfa_stepup" && !opt._retry) { if (await W.stepUp()) return W.req(path, { ...opt, _retry: true }); }
    throw err;
  }
  return j;
};
W.upload = async (file, context, contextId) => {
  const r = await fetch("/api/files", { method: "POST", credentials: "same-origin", headers: { "X-WBMC": "1", "X-Context": context, "X-Context-Id": contextId || "", "X-Name": encodeURIComponent(file.name || "file") }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new W.ApiError(r.status, j);
  return j;
};
/* attēlu saspiešana pirms augšupielādes (≤ 1600 px, JPEG) */
W.shrinkImage = (file, max = 1600, q = .82) => new Promise((res, rej) => {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error(W.t("api.badtype")));
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    c.toBlob(b => b ? res(new File([b], (file.name || "image").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })) : rej(new Error("image")), "image/jpeg", q);
  };
  img.onerror = () => rej(new Error(W.t("api.badtype")));
  img.src = url;
});
let _sess = null;
W.session = (force) => {
  if (_sess && !force) return _sess;
  return _sess = W.req("/me").then(j => (W.me = j.user ? { ...j.user, perms: j.perms || {}, stepupFresh: j.stepupFresh } : null)).catch(() => (W.me = null));
};
W.can = (module, action = "v") => !!(W.me && W.me.status === "active" && (W.me.role === "admin" || (W.me.perms[module] || "").includes(action)));
W.paintAccount = me => {
  const acc = W.$("#accountBtn"), comms = W.$("#commsBtn");
  if (!acc) return;
  const active = me && me.status === "active";
  W.$$("[data-need]").forEach(el => { const n = el.dataset.need; el.hidden = !(active && (n === "member" || (n === "admin" && (me.role === "admin" || Object.keys(me.perms || {}).some(m => ["users", "roles", "invites", "audit", "security", "settings", "i18n"].includes(m) || /[eda]/.test(me.perms[m] || "")))))); });
  if (comms) { comms.hidden = !active; if (active) W.pollUnread(); }
  if (me) {
    acc.href = "profils.html";
    acc.innerHTML = `<span class="av">${W.esc((me.name || "?").trim()[0].toUpperCase())}</span><span class="account-label">${W.esc(me.status === "pending" ? W.t("acc.pending") : me.name)}</span>`;
    acc.setAttribute("aria-label", W.t("acc.profile"));
  }
};
/* nelasīto ziņu punkts galvenē (Saziņa): reizi minūtē, tikai kad cilne redzama */
let _unreadT = null;
W.setUnread = n => { const d = W.$("#commsDot"), b = W.$("#commsBtn"); if (d) d.hidden = !(n > 0); if (b) b.setAttribute("aria-label", n > 0 ? `${W.t("nav.comms")} (${n})` : W.t("nav.comms")); };
W.pollUnread = () => {
  if (_unreadT) return;
  const tick = async () => {
    if (document.visibilityState === "visible") { try { const j = await W.req("/comms/unread"); W.setUnread(j.total || 0); } catch (e) { if (e && (e.status === 401 || e.status === 403 || e.status === 404)) { clearInterval(_unreadT); return; } } }
  };
  tick(); _unreadT = setInterval(tick, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
};
W.logout = async () => { try { await W.req("/auth/logout", { body: {} }); } catch (e) {} try { sessionStorage.clear(); } catch (e) {} location.href = W.base || "./"; };

/* ---------- paziņojumi, dialogi ---------- */
let toastEl;
W.toast = (msg, bad) => {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.toggle("bad", !!bad); toastEl.classList.add("show");
  clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("show"), bad ? 4200 : 2600);
};
W.errMsg = e => (e && e.code && W.t("err." + e.code) !== "err." + e.code ? W.t("err." + e.code) : (e && e.message) || W.t("err.generic"));
/* modālais dialogs: W.modal({ title, body (HTML), actions:[{label, value, primary, danger}] }) → Promise<value|null> */
W.modal = ({ title, body, actions = [], onOpen, wide }) => new Promise(resolve => {
  const d = document.createElement("dialog"); d.className = "modal"; if (wide) d.style.width = "min(820px, calc(100% - 24px))";
  d.innerHTML = `<form method="dialog"><div class="modal-head"><h2>${W.esc(title)}</h2><button class="icon-btn" value="" aria-label="${W.esc(W.t("a11y.close"))}">${W.icon("close")}</button></div><div class="modal-body">${body || ""}</div>${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn small ${a.primary ? "" : a.danger ? "danger" : "ghost"}" value="${W.esc(a.value ?? i)}">${W.esc(a.label)}</button>`).join("")}</div>` : ""}</form>`;
  document.body.appendChild(d);
  d.addEventListener("close", () => { const v = d.returnValue; W.lastModalData = Object.fromEntries(new FormData(d.querySelector("form"))); d.remove(); resolve(v === "" ? null : v); });
  d.showModal(); onOpen && onOpen(d);
});
/* forma dialogā: atgriež lauku vērtības vai null */
W.prompt = (title, body, okLabel) => W.modal({ title, body: `<div class="form">${body}</div>`, actions: [{ label: W.t("btn.cancel"), value: "" }, { label: okLabel || W.t("btn.save"), value: "ok", primary: true }],
  onOpen: d => { const f = d.querySelector("input,select,textarea"); f && f.focus(); } }).then(v => v === "ok" ? W.lastModalData : null);
W.confirm = (title, text, label, danger = true) => W.modal({ title, body: `<p>${W.esc(text)}</p>`, actions: [{ label: W.t("btn.cancel"), value: "" }, { label, value: "ok", danger, primary: !danger }] }).then(v => v === "ok");
/* svaigs MFA apstiprinājums administrācijas darbībām */
W.stepUp = () => new Promise(resolve => {
  W.modal({ title: W.t("mfa.stepupTitle"), body: `<p class="muted">${W.esc(W.t("mfa.stepupText"))}</p><label class="field"><span>${W.esc(W.t("mfa.code"))}</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required></label><p class="form-err" id="suErr"></p>`,
    actions: [{ label: W.t("btn.cancel"), value: "" }, { label: W.t("mfa.confirm"), value: "ok", primary: true }],
    onOpen: d => {
      const f = d.querySelector("form"), inp = d.querySelector("input[name=code]"); inp.focus();
      f.addEventListener("submit", async e => {
        if (e.submitter && e.submitter.value !== "ok") return;
        e.preventDefault();
        try { await W.req("/auth/stepup", { body: { code: inp.value }, _retry: true }); d.close("ok"); resolve(true); }
        catch (x) { d.querySelector("#suErr").textContent = W.errMsg(x); inp.select(); }
      });
    } }).then(v => { if (v !== "ok") resolve(false); });
});
/* biedru zonas vārti: atgriež lietotāju vai parāda paziņojumu elementā */
W.gate = async (el, { module, action = "v" } = {}) => {
  const me = await W.session();
  const box = (h, p, btns) => { el.innerHTML = `<div class="gate"><h2>${W.esc(h)}</h2><p>${W.esc(p)}</p><div class="btn-row">${btns}</div></div>`; return null; };
  if (!me) return box(W.t("gate.loginTitle"), W.t("gate.loginText"), `<a class="btn" href="pieslegties.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search + location.hash)}">${W.esc(W.t("nav.login"))}</a>`);
  if (me.status === "pending") return box(W.t("gate.pendingTitle"), W.t("gate.pendingText"), `<a class="btn ghost" href="profils.html">${W.esc(W.t("acc.profile"))}</a>`);
  if (me.status !== "active") return box(W.t("gate.inactiveTitle"), W.t("gate.inactiveText"), "");
  if (module && !W.can(module, action)) return box(W.t("gate.noAccessTitle"), W.t("gate.noAccessText"), `<a class="btn ghost" href="./">${W.esc(W.t("nav.home"))}</a>`);
  return me;
};

/* ---------- administratora tulkojumu pārrakstīšana (izpildlaikā) ---------- */
W.applyOverrides = () => {
  const key = "wb-i18n-" + LANG;
  const apply = map => {
    if (!map || !Object.keys(map).length) return;
    Object.assign(D, map);
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT);
    let c; const marks = [];
    while ((c = it.nextNode())) if (c.data.startsWith("t:")) marks.push(c);
    for (const m of marks) {
      const k = m.data.slice(2); if (!(k in map)) continue;
      const nodes = []; let n = m.nextSibling;
      while (n && !(n.nodeType === 8 && n.data === "/t")) { nodes.push(n); n = n.nextSibling; }
      nodes.forEach(x => x.remove());
      const span = document.createElement("template");
      span.innerHTML = W.esc(map[k]).replace(/&lt;(\/?)(b|i|br)&gt;/g, "<$1$2>");
      m.after(span.content);
    }
  };
  try { apply(JSON.parse(localStorage.getItem(key) || "null")); } catch (e) {}
  fetch("/api/i18n/" + LANG, { credentials: "same-origin" }).then(r => r.ok ? r.json() : null).then(map => {
    if (!map) return;
    try { const prev = localStorage.getItem(key); localStorage.setItem(key, JSON.stringify(map)); if (prev !== JSON.stringify(map)) apply(map); } catch (e) { apply(map); }
  }).catch(() => {});
};

/* ---------- maps (shared) ---------- */
// OpenStreetMap flīzes (bez API atslēgas) + CSS tumšais filtrs — iederas melnajā dizainā
W.darkTiles = () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, className: "tiles-dark",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});
W.osrm = async pts => {
  const coords = pts.map(p => `${(+p[1]).toFixed(5)},${(+p[0]).toFixed(5)}`).join(";");
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&annotations=duration,distance`);
  if (!r.ok) throw new Error("route");
  const j = await r.json(); if (j.code !== "Ok") throw new Error("route");
  return j.routes[0];
};
W.hav = (a, b) => { const R = 6371, t = x => x * Math.PI / 180, dLa = t(b[0]-a[0]), dLo = t(b[1]-a[1]);
  const h = Math.sin(dLa/2)**2 + Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };

document.addEventListener("DOMContentLoaded", () => { W.initNav(); W.initRockers(); W.initReveal(); });
})();
