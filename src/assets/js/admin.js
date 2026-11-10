/* Wolves Brotherhood MC — administrācijas panelis
   Pieejams tikai galvenajam administratoram un izstrādātājam (pārbaude arī serverī katrā pieprasījumā).
   Visi labojumi glabājas kā pārrakstījumi virs noklusējuma satura — jebkuru var atcelt vai atjaunot no vēstures. */
(function(){
const { $, $$, esc } = WB;
WB.initNav && WB.initNav();
const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];
const LANG_NAMES = { lv: "Latviešu", en: "English", ru: "Русский", de: "Deutsch", lt: "Lietuvių", et: "Eesti", no: "Norsk", fr: "Français" };
const RANK = { rider: 1, member: 2, officer: 3, admin: 4, developer: 5 };
const ROLE_LV = { rider: "Bez piekļuves", member: "Biedrs", officer: "Valde", admin: "Galvenais administrators", developer: "Izstrādātājs" };
const view = $("#admView");
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const fmt = ts => ts ? new Date(ts).toLocaleString("lv-LV", { dateStyle: "short", timeStyle: "short" }) : "—";
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

/* ---------------- API ---------------- */
const LS = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
let token = LS.get("wb-token");
async function api(path, opt = {}){
  const headers = { ...(token ? { Authorization: "Bearer " + token } : {}), ...(opt.headers || {}) };
  let body = opt.body;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
  const r = await fetch("/api" + path, { method: opt.method || (body !== undefined ? "POST" : "GET"), headers, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "HTTP " + r.status); e.status = r.status; throw e; }
  return j;
}

/* ---------------- UI palīgi ---------------- */
let toastT;
function toast(msg, bad){ const t = $("#admToast"); t.textContent = msg; t.className = "adm-toast on" + (bad ? " bad" : ""); clearTimeout(toastT); toastT = setTimeout(() => t.className = "adm-toast", 3200); }
function head(title, sub, act = ""){ $("#admTitle").textContent = title; $("#admSub").textContent = sub || ""; $("#admAct").innerHTML = act; document.title = title + " · Administrācija"; }
function dialog(html){ $("#admDlgBody").innerHTML = html; const d = $("#admDlg"); d.showModal(); return d; }
const confirmBox = msg => window.confirm(msg);
let dirty = false;
addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------------- dati ---------------- */
let me = null, cms = {}, cmsMeta = {};
async function loadCms(){
  const j = await api("/admin/cms");
  cms = {}; cmsMeta = {};
  for (const e of j.entries) { cms[e.key] = e.value; cmsMeta[e.key] = { updated: e.updated, by: e.by }; }
}
async function saveCms(key, value){ await api("/admin/cms", { body: { key, value } }); cms[key] = clone(value); cmsMeta[key] = { updated: Date.now(), by: me.name }; dirty = false; }
async function resetCms(key){ await api("/admin/cms/" + encodeURIComponent(key), { method: "DELETE" }); delete cms[key]; delete cmsMeta[key]; dirty = false; }

const DATASETS = [
  ["CLUB", "Kluba informācija", "Nosaukums, kontakti, rekvizīti, sociālie tīkli, bāzes atrašanās vieta"],
  ["EVENTS", "Kluba pasākumi", "Sākumlapas pasākumi un kalendārs"],
  ["HISTORY", "Hronika", "Kluba vēstures laika līnija"],
  ["DIARY", "Dienasgrāmata", "Brauciena stāsti grāmatas skatā"],
  ["ROUTES", "Maršruti", "Ieteiktie maršruti sākumlapā un Ride HQ"],
  ["GALLERY", "Galerija", "Albumi un fotogrāfijas"],
  ["MEMBERS", "Biedri sākumlapā", "Publiski redzamie kluba amati un vārdi"],
  ["MERCH", "Merch", "Produkti, cenas, attēli"],
  ["DONATE", "Atbalsts", "Ziedojumu mērķi, līmeņi, atbalstītāji"],
  ["EU_EVENTS", "Eiropas pasākumi", "Lapa „Eiropa”: moto pasākumi Eiropā"]
];
const defaultsOf = k => k === "EU_EVENTS" ? clone(window.EU_EVENTS_DEFAULT || []) : clone((window.__DEFAULTS || {})[k]);

/* ---------------- navigācija ---------------- */
const SECTIONS = [
  ["overview", "Pārskats"],
  ["texts", "Teksti visās valodās"],
  ["data", "Saturs"],
  ["layout", "Sākumlapa un izskats"],
  ["forum", "Foruma kategorijas"],
  ["moderation", "Moderācija"],
  ["accounts", "Konti un ielūgumi"],
  ["files", "Attēli un faili"],
  ["backup", "Vēsture un rezerves kopijas"],
  ["audit", "Darbību žurnāls"]
];
function renderNav(){
  const h = (location.hash.slice(1) || "overview").split("/")[0];
  $("#admNav").innerHTML = SECTIONS.map(([id, label]) => `<a href="#${id}" class="${h === id ? "on" : ""}">${esc(label)}</a>`).join("") +
    `<hr><a href="./">← Uz lapu</a><a href="brali.html">Brāļi</a><button class="link-btn" id="admOut">Iziet</button>`;
  $("#admOut").addEventListener("click", async () => { try { await api("/auth/logout", { body: {} }); } catch (e) {} token = null; LS.set("wb-token", null); location.reload(); });
}
$("#admMenu").addEventListener("click", () => $("#adm").classList.toggle("side-open"));
$("#admSide").addEventListener("click", e => { if (e.target.closest("a")) $("#adm").classList.remove("side-open"); });

/* ---------------- pieeja ---------------- */
function loginView(msg){
  $("#adm").classList.add("locked");
  head("Administrācija", "Tikai galvenajam administratoram un izstrādātājam");
  $("#admNav").innerHTML = "";
  view.innerHTML = `<form class="form adm-login" id="lf">
    ${msg ? `<p class="form-err">${esc(msg)}</p>` : ""}
    <label>E-pasts<input name="email" type="email" required autocomplete="email"></label>
    <label>Parole<input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn wide">Ienākt</button>
    <p class="small muted">Jāienāk ar to pašu kontu, ar ko Brāļu sadaļā.</p>
  </form>`;
  $("#lf").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target;
    try { const j = await api("/auth/login", { body: { email: f.email.value.trim(), password: f.password.value } }); token = j.token; LS.set("wb-token", token); start(); }
    catch (x) { loginView(x.message === "Wrong email or password" ? "Nepareizs e-pasts vai parole" : x.message); }
  });
}
async function start(){
  if (!token) return loginView();
  try { me = (await api("/me")).user; } catch (e) { token = null; LS.set("wb-token", null); return loginView(); }
  if ((RANK[me.role] || 0) < RANK.admin) {
    $("#adm").classList.add("locked"); $("#admNav").innerHTML = "";
    head("Nav piekļuves", "");
    view.innerHTML = `<div class="adm-empty"><p>Administrācijas panelis pieejams tikai galvenajam administratoram un lapas izstrādātājam.</p><p class="muted">Tu esi ienācis kā <b>${esc(me.name)}</b> (${esc(ROLE_LV[me.role] || me.role)}).</p><a class="btn ghost" href="brali.html">Uz Brāļiem</a></div>`;
    return;
  }
  $("#adm").classList.remove("locked");
  $("#admWho").textContent = `${me.name} · ${ROLE_LV[me.role]}`;
  await loadCms();
  route();
}
let lastHash = location.hash;
async function route(){
  if (dirty && location.hash !== lastHash && !confirmBox("Ir nesaglabātas izmaiņas. Pamest tās?")) { history.replaceState(null, "", lastHash || "#overview"); renderNav(); return; }
  dirty = false; lastHash = location.hash;
  renderNav();
  const [sec, arg] = (location.hash.slice(1) || "overview").split("/");
  view.innerHTML = `<p class="muted">Ielādē…</p>`;
  try {
    await ({ overview, texts, data: dataView, layout, forum, moderation, accounts, files, backup, audit }[sec] || overview)(arg);
  } catch (e) {
    if (e.status === 401 || e.status === 403) return start();
    view.innerHTML = `<div class="adm-empty"><p class="form-err">Neizdevās ielādēt: ${esc(e.message)}</p><button class="btn ghost" onclick="location.reload()">Mēģināt vēlreiz</button></div>`;
  }
  $("#admMain").scrollTop = 0; scrollTo(0, 0);
}
addEventListener("hashchange", () => me && RANK[me.role] >= RANK.admin && route());

/* ================= PĀRSKATS ================= */
async function overview(){
  head("Pārskats", "Lapas stāvoklis un ātrās saites");
  const s = await api("/admin/stats");
  const r = s.roles || {};
  const card = (n, l, href) => `<a class="adm-card" href="${href}"><b>${n}</b><span>${esc(l)}</span></a>`;
  view.innerHTML = `
    <div class="adm-cards">
      ${card((r.member || 0) + (r.officer || 0) + (r.admin || 0) + (r.developer || 0), "kluba konti", "#accounts")}
      ${card(r.rider || 0, "konti bez piekļuves", "#accounts")}
      ${card(s.invitesOpen, "neizmantoti ielūgumi", "#accounts")}
      ${card(s.threads, "foruma tēmas", "#moderation")}
      ${card(s.posts, "foruma ieraksti", "#moderation")}
      ${card(s.sosOpen, "aktīvi SOS", "#moderation")}
      ${card(s.hazards, "ceļa brīdinājumi (7 d.)", "#moderation")}
      ${card(s.cms, "satura labojumi", "#backup")}
      ${card(s.files, "augšupielādēti faili", "#files")}
    </div>
    <h3>Ko te var mainīt</h3>
    <ul class="adm-list">
      <li><a href="#texts">Teksti visās valodās</a> — jebkurš lapas teksts, virsraksts, poga un SEO apraksts (8 valodas).</li>
      <li><a href="#data">Saturs</a> — pasākumi, hronika, dienasgrāmata, maršruti, galerija, merch, biedri, atbalsts, Eiropas pasākumi, kluba informācija.</li>
      <li><a href="#layout">Sākumlapa un izskats</a> — sadaļu secība un redzamība, paziņojuma josla, krāsas, papildu CSS.</li>
      <li><a href="#forum">Foruma kategorijas</a> — pārdēvēt, paslēpt, pārkārtot, pievienot jaunas.</li>
      <li><a href="#moderation">Moderācija</a> — dzēst foruma tēmas, ierakstus, SOS, brīdinājumus, palīdzības punktus.</li>
      <li><a href="#accounts">Konti un ielūgumi</a> — lomas, piekļuve, ielūgumu kodi.</li>
      <li><a href="#files">Attēli un faili</a> — augšupielāde un saites izmantošanai saturā.</li>
      <li><a href="#backup">Vēsture un rezerves kopijas</a> — katra labojuma iepriekšējā versija, eksports un imports.</li>
    </ul>
    <p class="small muted">Izmaiņas lapā parādās uzreiz (līdz 15 sekundēm), jauna izvietošana nav vajadzīga.</p>`;
}

/* ================= TEKSTI ================= */
const dictCache = {};
async function dict(l){ if (!dictCache[l]) dictCache[l] = await fetch(`${WB.base}assets/i18n/${l}.json`).then(r => r.json()); return dictCache[l]; }
const TEXT_GROUPS = { meta: "SEO (lapu nosaukumi un apraksti)", nav: "Izvēlne", hero: "Sākumlapas galvene", today: "Šodiena", club: "Klubs", hist: "Hronika", diary: "Dienasgrāmata", ev: "Pasākumi", cal: "Kalendārs", ride: "Maršruti", gal: "Galerija", mem: "Biedri", merch: "Merch", don: "Atbalsts", join: "Pievienoties", foot: "Kājene", eu: "Eiropa", map: "Ride HQ", rhr: "Brāļi", chess: "Šahs", a11y: "Pieejamība" };
async function texts(){
  const st = { lang: LS.get("adm-tl") || "lv", q: "", group: "", onlyEdited: false, page: 0, edits: {} };
  const draw = async () => {
    const [D, LV] = await Promise.all([dict(st.lang), dict("lv")]);
    const ov = cms["i18n:" + st.lang] || {};
    const keys = Object.keys(LV).filter(k => !/\.(zero|one|two|few|many)$/.test(k) || true);
    const groups = [...new Set(keys.map(k => k.split(".")[0]))].sort();
    const q = st.q.toLowerCase();
    const list = keys.filter(k => (!st.group || k.split(".")[0] === st.group) && (!st.onlyEdited || ov[k] !== undefined || st.edits[k] !== undefined) &&
      (!q || k.toLowerCase().includes(q) || String(D[k] ?? "").toLowerCase().includes(q) || String(ov[k] ?? "").toLowerCase().includes(q) || String(LV[k] ?? "").toLowerCase().includes(q)));
    const PER = 40, pages = Math.max(1, Math.ceil(list.length / PER)); st.page = Math.min(st.page, pages - 1);
    const n = Object.keys(st.edits).length;
    head("Teksti visās valodās", `${keys.length} teksti · ${Object.keys(ov).length} laboti valodā ${LANG_NAMES[st.lang]}`,
      `<button class="btn small" id="tSave"${n ? "" : " disabled"}>Saglabāt izmaiņas${n ? ` (${n})` : ""}</button>`);
    view.innerHTML = `
      <div class="adm-filters">
        <select id="tLang">${LANGS.map(l => `<option value="${l}"${l === st.lang ? " selected" : ""}>${LANG_NAMES[l]}</option>`).join("")}</select>
        <select id="tGroup"><option value="">Visas sadaļas</option>${groups.map(g => `<option value="${g}"${g === st.group ? " selected" : ""}>${esc(TEXT_GROUPS[g] || g)}</option>`).join("")}</select>
        <input id="tQ" type="search" placeholder="Meklēt tekstu vai atslēgu…" value="${esc(st.q)}">
        <label class="adm-chk"><input type="checkbox" id="tOnly"${st.onlyEdited ? " checked" : ""}> Tikai labotie</label>
      </div>
      <p class="small muted">Atļauts <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;br&gt;</code>. Teksts <code>{n}</code> vai <code>{name}</code> ir mainīgais — atstāj to. Tukšs lauks = noklusējuma teksts.</p>
      <div class="adm-texts">${list.slice(st.page * PER, st.page * PER + PER).map(k => {
        const val = st.edits[k] !== undefined ? st.edits[k] : (ov[k] !== undefined ? ov[k] : (D[k] ?? ""));
        const edited = st.edits[k] !== undefined || ov[k] !== undefined;
        const long = String(val).length > 70 || String(D[k] ?? "").length > 70;
        return `<div class="adm-text${edited ? " edited" : ""}" data-k="${esc(k)}">
          <div class="adm-text-h"><code>${esc(k)}</code>${edited ? `<span class="adm-tag">labots</span><button class="link-btn" data-reset="${esc(k)}">atjaunot noklusējumu</button>` : ""}</div>
          ${st.lang !== "lv" ? `<div class="adm-ref"><span>LV</span> ${esc(LV[k] ?? "")}</div>` : ""}
          ${long ? `<textarea rows="3" data-in="${esc(k)}">${esc(val)}</textarea>` : `<input data-in="${esc(k)}" value="${esc(val)}">`}
          ${edited ? `<div class="adm-ref small"><span>Noklusējums</span> ${esc(D[k] ?? "")}</div>` : ""}
        </div>`; }).join("") || `<p class="muted">Nekas nav atrasts.</p>`}</div>
      ${pages > 1 ? `<div class="adm-pager"><button class="btn ghost small" id="pPrev"${st.page ? "" : " disabled"}>←</button><span>${st.page + 1} / ${pages}</span><button class="btn ghost small" id="pNext"${st.page < pages - 1 ? "" : " disabled"}>→</button></div>` : ""}`;
    $("#tLang").addEventListener("change", e => { if (Object.keys(st.edits).length && !confirmBox("Pārslēdzot valodu, nesaglabātās izmaiņas pazudīs. Turpināt?")) { e.target.value = st.lang; return; } st.lang = e.target.value; LS.set("adm-tl", st.lang); st.edits = {}; dirty = false; st.page = 0; draw(); });
    $("#tGroup").addEventListener("change", e => { st.group = e.target.value; st.page = 0; draw(); });
    let qt; $("#tQ").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value; st.page = 0; draw().then(() => { const i = $("#tQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 250); });
    $("#tOnly").addEventListener("change", e => { st.onlyEdited = e.target.checked; st.page = 0; draw(); });
    $$("[data-in]").forEach(i => i.addEventListener("input", () => {
      const k = i.dataset.in; st.edits[k] = i.value; dirty = true;
      i.closest(".adm-text").classList.add("edited");
      const b = $("#tSave"); b.disabled = false; b.textContent = `Saglabāt izmaiņas (${Object.keys(st.edits).length})`;
    }));
    $$("[data-reset]").forEach(b => b.addEventListener("click", () => { st.edits[b.dataset.reset] = null; dirty = true; save(); }));
    const pp = $("#pPrev"), pn = $("#pNext");
    pp && pp.addEventListener("click", () => { st.page--; draw(); }); pn && pn.addEventListener("click", () => { st.page++; draw(); });
    $("#tSave").addEventListener("click", save);
  };
  const save = async () => {
    const D = await dict(st.lang);
    const ov = { ...(cms["i18n:" + st.lang] || {}) };
    for (const [k, v] of Object.entries(st.edits)) { if (v === null || v === "" || v === D[k]) delete ov[k]; else ov[k] = v; }
    try {
      if (Object.keys(ov).length) await saveCms("i18n:" + st.lang, ov); else await resetCms("i18n:" + st.lang);
      st.edits = {}; toast("Teksti saglabāti — lapā redzami uzreiz"); draw();
    } catch (e) { toast("Neizdevās saglabāt: " + e.message, true); }
  };
  await draw();
}

/* ================= SATURS (datu kopas) ================= */
const isML = o => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length > 0 && Object.keys(o).every(k => LANGS.includes(k));
const isMediaKey = k => /(^|_)(img|image|src|photo|cover|logo|thumb|pic|file|pdf)$/i.test(k) || /img|image|photo|cover|logo|thumb/i.test(k);
function blank(v){
  if (Array.isArray(v)) return [];
  if (v === null) return null;
  if (typeof v === "object") { if (isML(v)) return Object.fromEntries(LANGS.map(l => [l, ""])); return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])); }
  if (typeof v === "number") return 0;
  if (typeof v === "boolean") return false;
  return "";
}
const txt = v => v == null ? "" : isML(v) ? (v.lv || v.en || Object.values(v).find(Boolean) || "") : typeof v === "object" ? "" : String(v);
const itemTitle = (it, i) => {
  if (!it || typeof it !== "object") return String(it);
  for (const k of ["title", "name", "road", "label", "id", "date", "year", "city"]) {
    const main = txt(it[k]); if (!main) continue;
    const extra = k !== "date" && txt(it.date) ? txt(it.date) : k !== "year" && txt(it.year) ? txt(it.year) : "";
    return main + (extra ? " · " + extra : "");
  }
  return "Ieraksts " + (i + 1);
};
const getAt = (o, path) => path.reduce((a, k) => a == null ? a : a[k], o);
const setAt = (o, path, v) => { const last = path[path.length - 1]; const p = getAt(o, path.slice(0, -1)); p[last] = v; };

async function dataView(arg){
  if (!arg) {
    head("Saturs", "Izvēlies, ko labot");
    view.innerHTML = `<div class="adm-sets">${DATASETS.map(([k, label, desc]) => `<a class="adm-set" href="#data/${k}"><b>${esc(label)}</b><span>${esc(desc)}</span>${cms["data:" + k] !== undefined ? `<em class="adm-tag">labots ${esc(fmt(cmsMeta["data:" + k].updated))}</em>` : ""}</a>`).join("")}</div>`;
    return;
  }
  const meta = DATASETS.find(d => d[0] === arg); if (!meta) { location.hash = "data"; return; }
  const key = "data:" + arg, def = defaultsOf(arg);
  const st = { cur: clone(cms[key] !== undefined ? cms[key] : def), open: new Set(), json: false };
  const draw = () => {
    head(meta[1], meta[2], `<button class="btn ghost small" id="dJson">${st.json ? "Formas skats" : "JSON skats"}</button>
      <button class="btn ghost small" id="dHist">Vēsture</button>
      ${cms[key] !== undefined ? `<button class="btn ghost small" id="dReset">Atjaunot noklusējumu</button>` : ""}
      <button class="btn small" id="dSave">Saglabāt</button>`);
    if (st.json) {
      view.innerHTML = `<p class="small muted">Pilns saturs JSON formātā — pieredzējušiem lietotājiem. Pirms saglabāšanas tiek pārbaudīts, vai formāts ir pareizs.</p><textarea class="adm-json" id="dJ" spellcheck="false">${esc(JSON.stringify(st.cur, null, 2))}</textarea>`;
      $("#dJ").addEventListener("input", () => dirty = true);
    } else {
      view.innerHTML = `<div class="adm-ed">${edNode(st.cur, [], arg)}</div>`;
      bindEditor();
    }
    $("#dJson").addEventListener("click", () => { if (st.json) { try { st.cur = JSON.parse($("#dJ").value); } catch (e) { return toast("JSON kļūda: " + e.message, true); } } st.json = !st.json; draw(); });
    $("#dSave").addEventListener("click", async () => {
      if (st.json) { try { st.cur = JSON.parse($("#dJ").value); } catch (e) { return toast("JSON kļūda: " + e.message, true); } }
      try { await saveCms(key, st.cur); toast("Saglabāts — lapā redzams uzreiz"); draw(); } catch (e) { toast("Neizdevās saglabāt: " + e.message, true); }
    });
    const r = $("#dReset"); r && r.addEventListener("click", async () => { if (!confirmBox("Atjaunot sākotnējo saturu? Pašreizējā versija paliks vēsturē.")) return; await resetCms(key); st.cur = clone(def); toast("Atjaunots noklusējums"); draw(); });
    $("#dHist").addEventListener("click", () => historyDialog(key, () => { st.cur = clone(cms[key] !== undefined ? cms[key] : def); draw(); }));
  };
  function edNode(v, path, label){
    if (Array.isArray(v)) {
      if (v.every(x => x === null || typeof x !== "object")) {
        const nums = v.length && v.every(x => typeof x === "number");
        return `<label class="adm-f"><span>${esc(lbl(label))} <em class="muted">(katrs jaunā rindā)</em></span><textarea rows="${Math.min(8, v.length + 2)}" data-list="${esc(JSON.stringify(path))}" data-num="${nums ? 1 : 0}">${esc(v.join("\n"))}</textarea></label>`;
      }
      return `<div class="adm-arr" data-path="${esc(JSON.stringify(path))}">
        ${path.length ? `<div class="adm-arr-h">${esc(lbl(label))} <span class="muted">(${v.length})</span></div>` : `<div class="adm-arr-h">${v.length} ieraksti</div>`}
        ${v.map((it, i) => { const pid = JSON.stringify([...path, i]); const open = st.open.has(pid);
          return `<div class="adm-item${open ? " open" : ""}">
            <div class="adm-item-h"><button class="adm-item-t" data-toggle="${esc(pid)}">${esc(itemTitle(it, i))}</button>
              <span class="adm-item-a"><button class="icon-btn mini" title="Uz augšu" data-mv="${esc(pid)}" data-d="-1"${i ? "" : " disabled"}>↑</button><button class="icon-btn mini" title="Uz leju" data-mv="${esc(pid)}" data-d="1"${i < v.length - 1 ? "" : " disabled"}>↓</button><button class="icon-btn mini" title="Dublēt" data-dup="${esc(pid)}">⧉</button><button class="icon-btn mini danger" title="Dzēst" data-del="${esc(pid)}">×</button></span></div>
            ${open ? `<div class="adm-item-b">${edNode(it, [...path, i], "")}</div>` : ""}
          </div>`; }).join("")}
        <button class="btn ghost small" data-add="${esc(JSON.stringify(path))}">+ Pievienot</button>
      </div>`;
    }
    if (v && typeof v === "object") {
      if (isML(v)) return mlField(v, path, label);
      return `<div class="adm-obj">${Object.entries(v).map(([k, x]) => edNode(x, [...path, k], k)).join("")}</div>`;
    }
    return scalar(v, path, label);
  }
  const LBL = { title: "Nosaukums", name: "Vārds / nosaukums", date: "Datums", time: "Laiks", place: "Vieta", text: "Teksts", desc: "Apraksts", year: "Gads", img: "Attēls", src: "Attēls", url: "Saite", price: "Cena", city: "Pilsēta", road: "Iesauka", role: "Amats", km: "Km", from: "No", to: "Uz", lat: "Platums", lon: "Garums", email: "E-pasts", phone: "Tālrunis", tag: "Birka", id: "ID" };
  const lbl = k => k === "" ? "" : (LBL[k] || k);
  function mlField(v, path, label){
    const long = Object.values(v).some(x => String(x).length > 70);
    return `<fieldset class="adm-ml"><legend>${esc(lbl(label))} <em class="muted">· 8 valodas</em></legend>
      ${LANGS.map(l => `<label><span>${l.toUpperCase()}</span>${long ? `<textarea rows="3" data-p="${esc(JSON.stringify([...path, l]))}">${esc(v[l] ?? "")}</textarea>` : `<input data-p="${esc(JSON.stringify([...path, l]))}" value="${esc(v[l] ?? "")}">`}</label>`).join("")}
    </fieldset>`;
  }
  function scalar(v, path, label){
    const p = esc(JSON.stringify(path));
    if (typeof v === "boolean") return `<label class="adm-chk"><input type="checkbox" data-p="${p}" data-t="bool"${v ? " checked" : ""}> ${esc(lbl(label))}</label>`;
    if (typeof v === "number") return `<label class="adm-f"><span>${esc(lbl(label))}</span><input type="number" step="any" data-p="${p}" data-t="num" value="${v}"></label>`;
    const s = v == null ? "" : String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || label === "date") return `<label class="adm-f"><span>${esc(lbl(label))}</span><input type="date" data-p="${p}" value="${esc(s)}"></label>`;
    if (/^#[0-9a-f]{6}$/i.test(s)) return `<label class="adm-f"><span>${esc(lbl(label))}</span><input type="color" data-p="${p}" value="${esc(s)}"></label>`;
    const media = isMediaKey(String(label));
    const long = s.length > 80 || s.includes("\n");
    return `<label class="adm-f${media ? " media" : ""}"><span>${esc(lbl(label))}</span>${long ? `<textarea rows="4" data-p="${p}">${esc(s)}</textarea>` : `<input data-p="${p}" value="${esc(s)}">`}
      ${media ? `<span class="adm-media">${s ? `<img src="${esc(s.startsWith("/") || /^https?:/.test(s) ? s : WB.base + s)}" alt="" loading="lazy">` : ""}<button type="button" class="btn ghost small" data-up="${p}">Augšupielādēt</button><button type="button" class="btn ghost small" data-pick="${p}">No failiem</button></span>` : ""}</label>`;
  }
  function bindEditor(){
    $$("[data-p]").forEach(i => i.addEventListener(i.type === "checkbox" ? "change" : "input", () => {
      const path = JSON.parse(i.dataset.p);
      const val = i.dataset.t === "bool" ? i.checked : i.dataset.t === "num" ? (i.value === "" ? 0 : Number(i.value)) : i.value;
      setAt(st.cur, path, val); dirty = true;
    }));
    $$("[data-list]").forEach(t => t.addEventListener("input", () => {
      const lines = t.value.split("\n").map(x => x.trim()).filter(Boolean);
      setAt(st.cur, JSON.parse(t.dataset.list), t.dataset.num === "1" ? lines.map(Number).filter(Number.isFinite) : lines); dirty = true;
    }));
    $$("[data-toggle]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.toggle; st.open.has(k) ? st.open.delete(k) : st.open.add(k); draw(); }));
    $$("[data-mv]").forEach(b => b.addEventListener("click", () => {
      const path = JSON.parse(b.dataset.mv), i = path.pop(), arr = getAt(st.cur, path), j = i + Number(b.dataset.d);
      [arr[i], arr[j]] = [arr[j], arr[i]]; dirty = true; st.open.clear(); draw();
    }));
    $$("[data-dup]").forEach(b => b.addEventListener("click", () => { const path = JSON.parse(b.dataset.dup), i = path.pop(), arr = getAt(st.cur, path); arr.splice(i + 1, 0, clone(arr[i])); dirty = true; st.open.clear(); st.open.add(JSON.stringify([...path, i + 1])); draw(); }));
    $$("[data-del]").forEach(b => b.addEventListener("click", () => { if (!confirmBox("Dzēst šo ierakstu?")) return; const path = JSON.parse(b.dataset.del), i = path.pop(); getAt(st.cur, path).splice(i, 1); dirty = true; st.open.clear(); draw(); }));
    $$("[data-add]").forEach(b => b.addEventListener("click", () => {
      const path = JSON.parse(b.dataset.add), arr = getAt(st.cur, path);
      const tpl = arr.length ? arr[0] : (getAt(def, path) || [])[0];
      arr.push(tpl !== undefined ? blank(tpl) : {}); dirty = true; st.open.clear(); st.open.add(JSON.stringify([...path, arr.length - 1])); draw();
    }));
    $$("[data-up]").forEach(b => b.addEventListener("click", () => pickUpload(url => { setAt(st.cur, JSON.parse(b.dataset.up), url); dirty = true; draw(); })));
    $$("[data-pick]").forEach(b => b.addEventListener("click", () => pickExisting(url => { setAt(st.cur, JSON.parse(b.dataset.pick), url); dirty = true; draw(); })));
  }
  draw();
}

/* ---------------- faili: augšupielāde un izvēle ---------------- */
async function uploadFile(file){
  const buf = await file.arrayBuffer();
  const r = await fetch("/api/admin/files", { method: "POST", headers: { Authorization: "Bearer " + token, "X-Name": encodeURIComponent(file.name).slice(0, 200) }, body: buf });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
  return j;
}
function pickUpload(cb){
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,application/pdf";
  i.addEventListener("change", async () => { const f = i.files[0]; if (!f) return; try { toast("Augšupielādē…"); const j = await uploadFile(f); toast("Augšupielādēts"); cb(j.url); } catch (e) { toast(e.message, true); } });
  i.click();
}
async function pickExisting(cb){
  const { files: list } = await api("/admin/files");
  const d = dialog(`<h2>Izvēlies failu</h2><div class="adm-files pick">${list.map(f => `<button class="adm-file" data-url="${esc(f.url)}">${f.type.startsWith("image/") ? `<img src="${esc(f.url)}" alt="" loading="lazy">` : `<span class="adm-pdf">PDF</span>`}<span>${esc(decodeURIComponent(f.name || ""))}</span></button>`).join("") || `<p class="muted">Vēl nav augšupielādētu failu.</p>`}</div>`);
  $$("#admDlgBody [data-url]").forEach(b => b.addEventListener("click", () => { d.close(); cb(b.dataset.url); }));
}

/* ---------------- vēsture vienam ierakstam ---------------- */
async function historyDialog(key, after){
  const { items } = await api("/admin/cms-history?key=" + encodeURIComponent(key));
  const d = dialog(`<h2>Vēsture</h2><p class="small muted"><code>${esc(key)}</code> — iepriekšējās versijas. Atjaunojot, pašreizējā versija arī saglabājas vēsturē.</p>
    <div class="adm-rows">${items.map(h => `<div class="adm-row"><span>${esc(fmt(h.at))} · ${esc(h.by_name || "")}</span><span class="muted small">${h.size ? kb(h.size) : "noklusējums"}</span><button class="btn ghost small" data-rs="${esc(h.id)}">Atjaunot šo</button></div>`).join("") || `<p class="muted">Vēstures vēl nav.</p>`}</div>`);
  $$("#admDlgBody [data-rs]").forEach(b => b.addEventListener("click", async () => {
    if (!confirmBox("Atjaunot šo versiju?")) return;
    try { await api("/admin/cms-restore", { body: { id: b.dataset.rs } }); await loadCms(); d.close(); toast("Versija atjaunota"); after && after(); } catch (e) { toast(e.message, true); }
  }));
}

/* ================= SĀKUMLAPA UN IZSKATS ================= */
async function layout(){
  const ui = clone(cms.ui) || {};
  ui.hidden = ui.hidden || []; ui.order = ui.order || []; ui.banner = ui.banner || { on: false, tone: "info", text: {}, link: "", linkText: {} }; ui.colors = ui.colors || {}; ui.css = ui.css || "";
  const html = await fetch(`${WB.base}index.html`, { cache: "no-store" }).then(r => r.text());
  const doc = new DOMParser().parseFromString(html, "text/html");
  const secs = [...doc.querySelectorAll("main > section[id], main > div[id].lightbox")].filter(s => s.tagName === "SECTION" && s.id !== "top")
    .map(s => ({ id: s.id, name: (s.querySelector("h2, h3")?.textContent || s.getAttribute("aria-label") || s.id).trim() }));
  const ids = secs.map(s => s.id);
  const order = [...ui.order.filter(id => ids.includes(id)), ...ids.filter(id => !ui.order.includes(id))];
  const css = await fetch(`${WB.base}assets/css/style.css`).then(r => r.text());
  const root = (css.match(/:root\s*\{([\s\S]*?)\}/) || [, ""])[1];
  const tokens = [...root.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})/g)].map(m => ({ k: m[1], v: m[2] }));
  const TOK = { "--black": "Fons", "--patch": "Ielāpa virsma", "--leather": "Virsma", "--leather-2": "Virsma 2", "--bone": "Galvenais teksts (kaula baltais)", "--silver": "Sekundārais teksts", "--steel": "Līnijas", "--steel-2": "Līnijas 2", "--eye": "Akcents (sarkanais)", "--carmine": "Karmīns", "--ok": "Labi", "--warn": "Brīdinājums" };
  const draw = () => {
    head("Sākumlapa un izskats", "Sadaļu secība, redzamība, paziņojuma josla, krāsas", `<button class="btn ghost small" id="lHist">Vēsture</button><button class="btn small" id="lSave">Saglabāt</button>`);
    view.innerHTML = `
      <h3>Sākumlapas sadaļas</h3>
      <p class="small muted">Secību maini ar bultām; noņem ķeksīti, lai sadaļu paslēptu. Galvene (logo) vienmēr paliek pirmā.</p>
      <div class="adm-rows" id="secList">${order.map((id, i) => { const s = secs.find(x => x.id === id); return `<div class="adm-row">
        <label class="adm-chk"><input type="checkbox" data-vis="${id}"${ui.hidden.includes(id) ? "" : " checked"}> <b>${esc(s.name)}</b> <code class="muted">#${esc(id)}</code></label>
        <span><button class="icon-btn mini" data-o="${i}" data-d="-1"${i ? "" : " disabled"}>↑</button><button class="icon-btn mini" data-o="${i}" data-d="1"${i < order.length - 1 ? "" : " disabled"}>↓</button></span></div>`; }).join("")}</div>

      <h3>Paziņojuma josla</h3>
      <label class="adm-chk"><input type="checkbox" id="bOn"${ui.banner.on ? " checked" : ""}> Rādīt paziņojumu visās lapās</label>
      <div class="adm-grid2">
        <label class="adm-f"><span>Tonis</span><select id="bTone">${[["info", "Informācija"], ["alert", "Svarīgi (sarkans)"], ["good", "Labas ziņas"]].map(([v, l]) => `<option value="${v}"${ui.banner.tone === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="adm-f"><span>Saite (pēc izvēles)</span><input id="bLink" value="${esc(ui.banner.link || "")}" placeholder="piem. #pasakumi vai https://…"></label>
      </div>
      <fieldset class="adm-ml"><legend>Teksts</legend>${LANGS.map(l => `<label><span>${l.toUpperCase()}</span><input data-bt="${l}" value="${esc((ui.banner.text || {})[l] || "")}"></label>`).join("")}</fieldset>
      <fieldset class="adm-ml"><legend>Saites teksts</legend>${LANGS.map(l => `<label><span>${l.toUpperCase()}</span><input data-bl="${l}" value="${esc((ui.banner.linkText || {})[l] || "")}"></label>`).join("")}</fieldset>

      <h3>Krāsas</h3>
      <div class="adm-colors">${tokens.map(t => `<label class="adm-color"><input type="color" data-c="${t.k}" value="${esc(normHex(ui.colors[t.k] || t.v))}"><span>${esc(TOK[t.k] || t.k)}<br><code class="muted">${esc(t.k)}</code></span>${ui.colors[t.k] ? `<button class="link-btn" data-cr="${t.k}">noklusējums</button>` : ""}</label>`).join("")}</div>

      <h3>Papildu CSS</h3>
      <p class="small muted">Pieredzējušiem — tiek pievienots visām lapām pēc galvenā stila.</p>
      <textarea class="adm-json" id="cssBox" rows="8" spellcheck="false">${esc(ui.css)}</textarea>`;
    $$("[data-vis]").forEach(c => c.addEventListener("change", () => { const id = c.dataset.vis; ui.hidden = c.checked ? ui.hidden.filter(x => x !== id) : [...ui.hidden, id]; dirty = true; }));
    $$("[data-o]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.o, j = i + +b.dataset.d; [order[i], order[j]] = [order[j], order[i]]; ui.order = [...order]; dirty = true; draw(); }));
    $("#bOn").addEventListener("change", e => { ui.banner.on = e.target.checked; dirty = true; });
    $("#bTone").addEventListener("change", e => { ui.banner.tone = e.target.value; dirty = true; });
    $("#bLink").addEventListener("input", e => { ui.banner.link = e.target.value.trim(); dirty = true; });
    $$("[data-bt]").forEach(i => i.addEventListener("input", () => { ui.banner.text = { ...(ui.banner.text || {}), [i.dataset.bt]: i.value }; dirty = true; }));
    $$("[data-bl]").forEach(i => i.addEventListener("input", () => { ui.banner.linkText = { ...(ui.banner.linkText || {}), [i.dataset.bl]: i.value }; dirty = true; }));
    $$("[data-c]").forEach(i => i.addEventListener("input", () => { ui.colors[i.dataset.c] = i.value; document.documentElement.style.setProperty(i.dataset.c, i.value); dirty = true; }));
    $$("[data-cr]").forEach(b => b.addEventListener("click", () => { delete ui.colors[b.dataset.cr]; document.documentElement.style.removeProperty(b.dataset.cr); dirty = true; draw(); }));
    $("#cssBox").addEventListener("input", e => { ui.css = e.target.value; dirty = true; });
    $("#lSave").addEventListener("click", async () => { try { await saveCms("ui", ui); toast("Saglabāts — lapā redzams uzreiz"); } catch (e) { toast(e.message, true); } });
    $("#lHist").addEventListener("click", () => historyDialog("ui", () => layout()));
  };
  draw();
}
function normHex(h){ h = String(h); if (/^#[0-9a-f]{3}$/i.test(h)) return "#" + h.slice(1).split("").map(c => c + c).join(""); return h.slice(0, 7); }

/* ================= FORUMA KATEGORIJAS ================= */
const DEF_CATS = [["roadhelp", "wrench"], ["tech", "gear"], ["routes", "route"], ["gear", "jacket"], ["market", "swap"], ["general", "fire"]];
const ICONS = ["wrench", "gear", "route", "jacket", "swap", "fire", "list", "sos", "warn", "hands", "hash", "lock", "cal", "pin", "nav", "star", "share"];
async function forum(){
  const dicts = Object.fromEntries(await Promise.all(LANGS.map(async l => [l, await dict(l)])));
  let cats = clone(cms.forumCats) || DEF_CATS.map(([id, icon]) => ({ id, icon, name: Object.fromEntries(LANGS.map(l => [l, dicts[l]["rhr.cat." + id] || ""])), hidden: false }));
  const draw = () => {
    head("Foruma kategorijas", "Brāļu foruma sadaļas", `${cms.forumCats ? `<button class="btn ghost small" id="fReset">Atjaunot noklusējumu</button>` : ""}<button class="btn small" id="fSave">Saglabāt</button>`);
    view.innerHTML = `<div class="adm-rows">${cats.map((c, i) => `<div class="adm-cat">
        <div class="adm-cat-h"><span class="adm-ico">${WB.icon(c.icon)}</span><code>${esc(c.id)}</code>
          <select data-ic="${i}">${ICONS.map(x => `<option${x === c.icon ? " selected" : ""}>${x}</option>`).join("")}</select>
          <label class="adm-chk"><input type="checkbox" data-hid="${i}"${c.hidden ? " checked" : ""}> paslēpt</label>
          <span><button class="icon-btn mini" data-mv="${i}" data-d="-1"${i ? "" : " disabled"}>↑</button><button class="icon-btn mini" data-mv="${i}" data-d="1"${i < cats.length - 1 ? "" : " disabled"}>↓</button>${DEF_CATS.some(d => d[0] === c.id) ? "" : `<button class="icon-btn mini danger" data-rm="${i}">×</button>`}</span></div>
        <div class="adm-ml compact">${LANGS.map(l => `<label><span>${l.toUpperCase()}</span><input data-nm="${i}" data-l="${l}" value="${esc((c.name || {})[l] || "")}"></label>`).join("")}</div>
      </div>`).join("")}</div>
      <form class="adm-filters" id="fAdd"><input name="id" placeholder="jaunas kategorijas id, piem. pasakumi" pattern="[a-z0-9-]{2,24}" required><input name="lv" placeholder="Nosaukums latviski" required><button class="btn ghost small">+ Pievienot kategoriju</button></form>
      <p class="small muted">Paslēptā kategorija pazūd no izvēlnes; tēmas tajā saglabājas. Noklusējuma kategorijas nevar dzēst, tikai paslēpt.</p>`;
    $$("[data-ic]").forEach(s => s.addEventListener("change", () => { cats[+s.dataset.ic].icon = s.value; dirty = true; draw(); }));
    $$("[data-hid]").forEach(c => c.addEventListener("change", () => { cats[+c.dataset.hid].hidden = c.checked; dirty = true; }));
    $$("[data-nm]").forEach(i => i.addEventListener("input", () => { const c = cats[+i.dataset.nm]; c.name = { ...(c.name || {}), [i.dataset.l]: i.value }; dirty = true; }));
    $$("[data-mv]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.mv, j = i + +b.dataset.d; [cats[i], cats[j]] = [cats[j], cats[i]]; dirty = true; draw(); }));
    $$("[data-rm]").forEach(b => b.addEventListener("click", () => { if (!confirmBox("Noņemt kategoriju? Tēmas paliks datubāzē, bet nebūs redzamas.")) return; cats.splice(+b.dataset.rm, 1); dirty = true; draw(); }));
    $("#fAdd").addEventListener("submit", e => { e.preventDefault(); const f = e.target; const id = f.id.value.trim().toLowerCase(); if (cats.some(c => c.id === id)) return toast("Tāds id jau ir", true); cats.push({ id, icon: "fire", name: { lv: f.lv.value.trim() }, hidden: false }); dirty = true; draw(); });
    $("#fSave").addEventListener("click", async () => { try { await saveCms("forumCats", cats); toast("Kategorijas saglabātas"); draw(); } catch (e) { toast(e.message, true); } });
    const r = $("#fReset"); r && r.addEventListener("click", async () => { if (!confirmBox("Atjaunot sākotnējās kategorijas?")) return; await resetCms("forumCats"); forum(); });
  };
  draw();
}

/* ================= MODERĀCIJA ================= */
async function moderation(tab){
  tab = tab || "threads";
  const j = await api("/admin/moderation");
  const T = { threads: "Foruma tēmas", posts: "Foruma ieraksti", sos: "SOS", hazards: "Ceļa brīdinājumi", helpers: "Palīdzības punkti" };
  head("Moderācija", "Dzēšana ir neatgriezeniska");
  const rows = (j[tab] || []).map(x => `<div class="adm-row">
    <div><b>${esc(x.title || x.kind || x.city || (x.body || "").slice(0, 80) || "—")}</b>${x.note ? `<br><span class="small">${esc(x.note)}</span>` : ""}${tab === "posts" ? `<br><span class="small">${esc(x.body || "")}</span>` : ""}
      <br><span class="muted small">${esc(x.author || "—")} · ${esc(fmt(x.created))}${x.replies !== undefined ? ` · ${x.replies} atbildes` : ""}${x.resolved ? " · atrisināts" : ""}</span></div>
    <button class="btn ghost small danger" data-del="${esc(x.id)}">Dzēst</button></div>`).join("");
  view.innerHTML = `<div class="adm-tabs">${Object.entries(T).map(([k, l]) => `<a href="#moderation/${k}" class="${k === tab ? "on" : ""}">${l} <span class="muted">${(j[k] || []).length}</span></a>`).join("")}</div>
    <div class="adm-rows">${rows || `<p class="muted">Nav ierakstu.</p>`}</div>`;
  $$("[data-del]").forEach(b => b.addEventListener("click", async () => {
    if (!confirmBox("Dzēst neatgriezeniski?")) return;
    try { await api(`/admin/${tab}/${encodeURIComponent(b.dataset.del)}`, { method: "DELETE" }); toast("Dzēsts"); moderation(tab); } catch (e) { toast(e.message, true); }
  }));
}

/* ================= KONTI ================= */
async function accounts(){
  const { users } = await api("/admin/users");
  head("Konti un ielūgumi", "Galvenā administratora un izstrādātāja lomas ir piesaistītas e-pastiem servera iestatījumos — tās šeit piešķirt nevar");
  const mine = RANK[me.role];
  const grant = ["member", "officer"].filter(r => RANK[r] < mine);
  view.innerHTML = `<div class="adm-box"><h3>Jauns ielūgums</h3><p class="small muted">Kods derīgs vienai reģistrācijai Brāļu sadaļā.</p>
      <div class="adm-filters"><select id="iRole">${grant.map(r => `<option value="${r}">${ROLE_LV[r]}</option>`).join("")}</select><button class="btn small" id="iMake">Izveidot ielūgumu</button></div>
      <p class="adm-code" id="iOut" aria-live="polite"></p></div>
    <h3>Konti <span class="muted">(${users.length})</span></h3>
    <div class="adm-rows">${users.map(u => `<div class="adm-row">
      <div><b>${esc(u.name)}</b>${u.me ? ` <span class="muted small">(tu)</span>` : ""}<br><span class="muted small">${esc(u.email || "")} · ${esc(fmt(u.created))}</span></div>
      <span class="role r-${esc(u.role)}">${esc(ROLE_LV[u.role] || u.role)}</span>
      <div class="adm-act">${u.editable && !["admin", "developer"].includes(u.role) ? `<select data-role="${esc(u.id)}">${["rider", "member", "officer"].filter(r => RANK[r] < mine).map(r => `<option value="${r}"${r === u.role ? " selected" : ""}>${ROLE_LV[r]}</option>`).join("")}</select><button class="link-btn" data-rm="${esc(u.id)}">Atņemt piekļuvi</button>` : `<span class="muted small">${u.me ? "tavs konts" : "nemaināms"}</span>`}</div>
    </div>`).join("")}</div>`;
  $("#iMake").addEventListener("click", async () => {
    try { const j = await api("/admin/invites", { body: { role: $("#iRole").value } }); const link = location.origin + "/brali.html";
      $("#iOut").innerHTML = `Kods: <b>${esc(j.code)}</b> (${esc(ROLE_LV[j.role])}) <button class="btn ghost small" id="iCopy">Kopēt ziņu</button>`;
      $("#iCopy").addEventListener("click", () => { navigator.clipboard.writeText(`Wolves Brotherhood MC ielūgums. Atver ${link} → Ienākt → Reģistrēties un ieraksti kodu: ${j.code}`).then(() => toast("Ziņa nokopēta")); });
    } catch (e) { toast(e.message, true); }
  });
  $$("[data-role]").forEach(s => s.addEventListener("change", async () => { try { await api("/admin/users/" + s.dataset.role, { body: { role: s.value } }); toast("Loma nomainīta"); } catch (e) { toast(e.message, true); } accounts(); }));
  $$("[data-rm]").forEach(b => b.addEventListener("click", async () => { if (!confirmBox("Atņemt piekļuvi Brāļu sadaļai? Konts tiks izrakstīts.")) return; try { await api("/admin/users/" + b.dataset.rm, { body: { remove: true } }); toast("Piekļuve atņemta"); } catch (e) { toast(e.message, true); } accounts(); }));
}

/* ================= FAILI ================= */
async function files(){
  const { files: list } = await api("/admin/files");
  head("Attēli un faili", "JPG, PNG, WebP, GIF, AVIF vai PDF līdz 6 MB. Saiti var ielikt jebkurā satura laukā.", `<button class="btn small" id="fUp">Augšupielādēt</button>`);
  view.innerHTML = `<div class="adm-drop" id="drop">Ievelc failus šeit vai spied „Augšupielādēt”</div>
    <div class="adm-files">${list.map(f => `<div class="adm-file">${f.type.startsWith("image/") ? `<img src="${esc(f.url)}" alt="" loading="lazy">` : `<span class="adm-pdf">PDF</span>`}
      <span class="small">${esc(decodeURIComponent(f.name || ""))}</span><span class="muted small">${kb(f.size)} · ${esc(fmt(f.created))}</span>
      <span><button class="btn ghost small" data-cp="${esc(f.url)}">Kopēt saiti</button><button class="btn ghost small danger" data-del="${esc(f.id)}">Dzēst</button></span></div>`).join("") || `<p class="muted">Vēl nav failu.</p>`}</div>`;
  const up = async fl => { for (const f of fl) { try { toast("Augšupielādē " + f.name + "…"); await uploadFile(f); } catch (e) { toast(f.name + ": " + e.message, true); } } files(); };
  $("#fUp").addEventListener("click", () => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = "image/*,application/pdf"; i.addEventListener("change", () => up([...i.files])); i.click(); });
  const dz = $("#drop");
  ["dragenter", "dragover"].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add("on"); }));
  ["dragleave", "drop"].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove("on"); }));
  dz.addEventListener("drop", ev => up([...ev.dataTransfer.files]));
  $$("[data-cp]").forEach(b => b.addEventListener("click", () => navigator.clipboard.writeText(b.dataset.cp).then(() => toast("Saite nokopēta: " + b.dataset.cp))));
  $$("[data-del]").forEach(b => b.addEventListener("click", async () => { if (!confirmBox("Dzēst failu? Ja tas izmantots saturā, attēls tur pazudīs.")) return; await api("/admin/files/" + b.dataset.del, { method: "DELETE" }); toast("Dzēsts"); files(); }));
}

/* ================= VĒSTURE UN REZERVES KOPIJAS ================= */
async function backup(){
  await loadCms();
  head("Vēsture un rezerves kopijas", "Katram labojumam saglabājas iepriekšējā versija");
  const label = k => { if (k.startsWith("i18n:")) return "Teksti — " + LANG_NAMES[k.slice(5)]; if (k.startsWith("data:")) return "Saturs — " + ((DATASETS.find(d => d[0] === k.slice(5)) || [])[1] || k); return { ui: "Sākumlapa un izskats", forumCats: "Foruma kategorijas" }[k] || k; };
  view.innerHTML = `<div class="adm-box"><h3>Rezerves kopija</h3><p class="small muted">Lejupielādē visus satura labojumus vienā failā vai ielādē iepriekš saglabātu failu. (Konti un foruma ieraksti ir datubāzē — tos kopē izvietošanas skripts.)</p>
      <div class="adm-filters"><button class="btn small" id="bExp">Lejupielādēt</button><label class="btn ghost small">Ielādēt failu<input type="file" accept="application/json" id="bImp" hidden></label></div></div>
    <h3>Labotās daļas</h3>
    <div class="adm-rows">${Object.keys(cms).sort().map(k => `<div class="adm-row"><div><b>${esc(label(k))}</b><br><span class="muted small">${esc(fmt(cmsMeta[k].updated))} · ${esc(cmsMeta[k].by || "")}</span></div><span><button class="btn ghost small" data-h="${esc(k)}">Vēsture</button><button class="btn ghost small danger" data-r="${esc(k)}">Atjaunot noklusējumu</button></span></div>`).join("") || `<p class="muted">Nekas vēl nav labots — visa lapa rāda sākotnējo saturu.</p>`}</div>`;
  $("#bExp").addEventListener("click", async () => {
    const j = await api("/admin/export");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: "application/json" })); a.download = `wbmc-saturs-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  });
  $("#bImp").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    let j; try { j = JSON.parse(await f.text()); } catch (x) { return toast("Fails nav derīgs JSON", true); }
    if (!confirmBox(`Ielādēt ${Object.keys(j.entries || {}).length} daļas? Pašreizējās versijas saglabāsies vēsturē.`)) return;
    try { const r = await api("/admin/import", { body: j }); toast(`Ielādētas ${r.imported} daļas`); backup(); } catch (x) { toast(x.message, true); }
  });
  $$("[data-h]").forEach(b => b.addEventListener("click", () => historyDialog(b.dataset.h, backup)));
  $$("[data-r]").forEach(b => b.addEventListener("click", async () => { if (!confirmBox("Atjaunot noklusējumu? Pašreizējā versija paliks vēsturē.")) return; await resetCms(b.dataset.r); toast("Atjaunots"); backup(); }));
}

/* ================= ŽURNĀLS ================= */
async function audit(){
  const { items } = await api("/admin/audit");
  const A = { "cms.save": "Saglabāja saturu", "cms.reset": "Atjaunoja noklusējumu", "cms.restore": "Atjaunoja versiju", "cms.export": "Lejupielādēja kopiju", "cms.import": "Ielādēja kopiju", "file.upload": "Augšupielādēja failu", "file.delete": "Dzēsa failu", "moderate.delete": "Dzēsa ierakstu", "invite.create": "Izveidoja ielūgumu", "user.role": "Nomainīja lomu", "user.remove": "Atņēma piekļuvi" };
  head("Darbību žurnāls", "Pēdējās 300 administrācijas darbības");
  view.innerHTML = `<div class="adm-rows">${items.map(a => `<div class="adm-row"><div><b>${esc(A[a.action] || a.action)}</b> <code class="muted small">${esc(a.target || "")}</code><br><span class="muted small">${esc(a.user_name || "—")} · ${esc(fmt(a.at))}${a.detail ? " · " + esc(a.detail) : ""}</span></div></div>`).join("") || `<p class="muted">Vēl nav ierakstu.</p>`}</div>`;
}

start();
})();
