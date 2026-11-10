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
  ["design", "Dizaina redaktors"],
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
    await ({ overview, texts, data: dataView, design, layout, forum, moderation, accounts, files, backup, audit }[sec] || overview)(arg);
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

/* ================= DIZAINA REDAKTORS (vizuāls, tieši lapā) + AI palīgs ================= */
const D_PAGES = [["index", "Sākumlapa"], ["eiropa", "Eiropa"], ["karte", "Ride HQ"], ["brali", "Brāļi"], ["404", "Kļūdas lapa"]];
const D_DEV = [["desk", "Dators", 0], ["tab", "Planšete", 820], ["mob", "Telefons", 390]];
const D_SCOPE = [["all", "Visām ierīcēm"], ["mobile", "Tikai telefonā"], ["desktop", "Tikai datorā"]];
const D_PROPS = new Set(["color", "background-color", "background-image", "background-size", "background-position", "font-size", "font-weight", "font-style", "font-family",
  "letter-spacing", "line-height", "text-transform", "text-align", "text-decoration", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "border", "border-color", "border-width", "border-style", "border-radius", "box-shadow",
  "opacity", "display", "width", "max-width", "min-width", "height", "min-height", "max-height", "gap", "filter", "transform", "object-fit", "aspect-ratio", "text-shadow", "justify-content", "align-items", "flex-direction", "grid-template-columns", "order"]);
const D_PROP_LV = { "color": "Teksta krāsa", "background-color": "Fona krāsa", "background-image": "Fona attēls", "font-size": "Burtu izmērs", "font-weight": "Biezums", "font-family": "Fonts", "font-style": "Slīpraksts",
  "letter-spacing": "Burtu atstarpe", "line-height": "Rindas augstums", "text-transform": "Burti", "text-align": "Līdzinājums", "border-radius": "Stūru noapaļojums", "border": "Rāmis", "box-shadow": "Ēna",
  "opacity": "Caurspīdīgums", "display": "Redzamība", "width": "Platums", "max-width": "Maks. platums", "min-height": "Min. augstums", "gap": "Atstarpe starp elementiem" };
const D_STATE = /^(on|active|open|is-|in$|show|sel|cur|visible|hidden|js-|reveal|wb-)/;
const D_SWATCH = ["--bone", "--silver", "--steel", "--black", "--leather", "--patch", "--eye", "--carmine", "--ok", "--warn"];
const dValOk = v => { v = String(v ?? "").trim(); if (!v || v.length > 300 || /[;{}<>\\]|expression|javascript:|@import/i.test(v)) return false;
  return (v.match(/url\([^)]*\)/gi) || []).every(u => /^url\(\s*["']?(\/api\/files\/[a-z0-9]{16}|\/?assets\/[\w./-]+)["']?\s*\)$/i.test(u)); };
const dSelOk = s => typeof s === "string" && s.length <= 400 && /^[#.\w\s>+~:()\-\[\]="',*À-ɏ]+$/.test(s) && !/[{};<]/.test(s);
function dRulesCss(rules){
  const block = set => Object.entries(set || {}).filter(([s]) => dSelOk(s)).map(([s, p]) => {
    const b = Object.entries(p || {}).filter(([k, v]) => D_PROPS.has(k) && dValOk(v)).map(([k, v]) => `${k}:${String(v).trim()} !important`).join(";");
    return b ? `${s}{${b}}` : ""; }).filter(Boolean).join("\n");
  const a = block(rules && rules.all), m = block(rules && rules.mobile), d = block(rules && rules.desktop);
  return [a, m ? `@media (max-width:760px){${m}}` : "", d ? `@media (min-width:761px){${d}}` : ""].filter(Boolean).join("\n");
}
function dFullStyle(ui, extra){
  const vars = Object.entries(ui.colors || {}).filter(([k, v]) => /^--[a-z0-9-]{1,30}$/.test(k) && /^#[0-9a-fA-F]{3,8}$/.test(String(v)));
  let s = vars.length ? `:root{${vars.map(([k, v]) => `${k}:${v}`).join(";")}}` : "";
  const rc = dRulesCss(ui.rules); if (rc) s += "\n" + rc;
  if (ui.css && ui.css.trim()) s += "\n" + ui.css;
  if (extra) s += "\n/* AI priekšskatījums */\n" + extra;
  return s;
}
const dPx = v => { v = String(v ?? "").trim(); return /^-?\d+(\.\d+)?$/.test(v) && v !== "0" ? v + "px" : v; };
const dHex = c => { const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (!m) return /^#/.test(c) ? normHex(c) : "#000000"; if (m[4] === "0") return ""; return "#" + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, "0")).join(""); };

async function design(){
  const ui = clone(cms.ui) || {};
  ui.rules = ui.rules || {}; for (const s of ["all", "mobile", "desktop"]) ui.rules[s] = ui.rules[s] || {};
  ui.attrs = ui.attrs || {}; ui.css = ui.css || ""; ui.colors = ui.colors || {};
  const st = { page: LS.get("wb-d-page") || "index", lang: LS.get("wb-d-lang") || "lv", dev: LS.get("wb-d-dev") || "desk", mode: "edit", scope: "all", target: "exact",
    tab: "el", el: null, exact: null, similar: null, key: null, keyVia: null, ai: null, aiPrompt: "", aiInfo: null };
  if (!D_PAGES.some(p => p[0] === st.page)) st.page = "index";
  const texts = {};                      // nesaglabātie teksti: { lv: { atslēga: teksts } }
  const undo = [], redo = [];
  let fdoc = null, hovBox = null, selBox = null, gesture = false;
  const cssText = await fetch(`${WB.base}assets/css/style.css`).then(r => r.text()).catch(() => "");
  const rootVars = (cssText.match(/:root\s*\{([\s\S]*?)\}/) || [, ""])[1].trim();

  const snap = () => JSON.stringify({ rules: ui.rules, attrs: ui.attrs, css: ui.css, texts });
  const push = () => { undo.push(snap()); if (undo.length > 150) undo.shift(); redo.length = 0; dirty = true; updBar(); };
  const restore = (s, from, to) => {
    to.push(snap()); const o = JSON.parse(s); const textsChanged = JSON.stringify(o.texts) !== JSON.stringify(texts);
    ui.rules = o.rules; ui.attrs = o.attrs; ui.css = o.css; for (const k of Object.keys(texts)) delete texts[k]; Object.assign(texts, o.texts);
    dirty = true; if (textsChanged) loadFrame(); else { applyLive(); reselect(); } updBar(); drawInsp();
  };
  const doUndo = () => undo.length && restore(undo.pop(), undo, redo);
  const doRedo = () => redo.length && restore(redo.pop(), redo, undo);
  const count = () => Object.values(ui.rules).reduce((n, set) => n + Object.values(set).reduce((m, p) => m + Object.keys(p).length, 0), 0) + Object.keys(ui.attrs).length + Object.values(texts).reduce((n, o) => n + Object.keys(o).length, 0);

  head("Dizaina redaktors", "Noklikšķini uz jebkura elementa lapā un maini to. Izmaiņas redzamas uzreiz; apmeklētājiem — pēc saglabāšanas.",
    `<button class="btn ghost small" id="dUndo" title="Atsaukt (Ctrl+Z)">Atsaukt</button><button class="btn ghost small" id="dRedo" title="Atkārtot (Ctrl+Shift+Z)">Atkārtot</button><button class="btn ghost small" id="dHist">Vēsture</button><button class="btn small" id="dSave">Saglabāt</button>`);
  $("#adm").classList.add("wide");
  view.innerHTML = `<div class="dz">
    <div class="dz-bar">
      <label class="adm-f"><span>Lapa</span><select id="dPage">${D_PAGES.map(([v, l]) => `<option value="${v}"${v === st.page ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="adm-f"><span>Valoda</span><select id="dLang">${LANGS.map(l => `<option value="${l}"${l === st.lang ? " selected" : ""}>${LANG_NAMES[l]}</option>`).join("")}</select></label>
      <div class="dz-seg" id="dDev" role="group" aria-label="Ierīce">${D_DEV.map(([v, l]) => `<button data-dev="${v}" aria-pressed="${v === st.dev}">${l}</button>`).join("")}</div>
      <div class="dz-seg" id="dMode" role="group" aria-label="Režīms"><button data-m="edit" aria-pressed="true">Rediģēt</button><button data-m="browse" aria-pressed="false">Pārlūkot</button></div>
      <span class="small muted" id="dCount"></span>
    </div>
    <div class="dz-grid">
      <div class="dz-stage" id="dStage"><div class="dz-frame" id="dBox"><iframe id="dFrame" title="Lapas priekšskatījums rediģēšanai"></iframe></div></div>
      <aside class="dz-insp" aria-label="Iestatījumi">
        <div class="dz-tabs" role="tablist">${[["el", "Elements"], ["ai", "AI palīgs"], ["list", "Visas izmaiņas"]].map(([v, l]) => `<button role="tab" data-tab="${v}" aria-selected="${v === st.tab}">${l}</button>`).join("")}</div>
        <div id="dInsp" class="dz-body"></div>
      </aside>
    </div></div>`;
  const frame = $("#dFrame");

  function updBar(){
    $("#dUndo").disabled = !undo.length; $("#dRedo").disabled = !redo.length;
    const n = count(); $("#dCount").textContent = n ? `${n} izmaiņas` : "Nav izmaiņu";
    const t = $('[data-tab="list"]'); if (t) t.textContent = `Visas izmaiņas${n ? " (" + n + ")" : ""}`;
  }
  function sizeFrame(){
    const w = (D_DEV.find(d => d[0] === st.dev) || D_DEV[0])[2];
    $("#dBox").style.width = w ? w + "px" : "100%"; $("#dBox").classList.toggle("device", !!w);
  }
  function src(){ return `/${st.lang === "lv" ? "" : st.lang + "/"}${st.page}.html?wbedit=1`; }
  function loadFrame(){ fdoc = null; frame.src = src(); }

  /* ---- lapas iekšpuse ---- */
  function cssPath(el){
    const parts = [];
    while (el && el.nodeType === 1 && el.tagName !== "HTML") {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && fdoc.querySelectorAll("#" + el.id).length === 1) { parts.unshift("#" + el.id); break; }
      if (el.tagName === "BODY") { parts.unshift("body"); break; }
      const tag = el.tagName.toLowerCase(), sib = [...el.parentElement.children].filter(c => c.tagName === el.tagName);
      parts.unshift(sib.length > 1 ? `${tag}:nth-of-type(${sib.indexOf(el) + 1})` : tag);
      el = el.parentElement;
    }
    return parts.join(" > ");
  }
  const cls = el => [...el.classList].filter(c => /^[A-Za-z][\w-]*$/.test(c) && !D_STATE.test(c));
  function similarSel(el){
    const tag = el.tagName.toLowerCase(), c = cls(el);
    let anc = el.parentElement; while (anc && !(anc.id && /^[A-Za-z][\w-]*$/.test(anc.id))) anc = anc.parentElement;
    const pre = anc && anc.tagName !== "BODY" ? "#" + anc.id + " " : "";
    if (c.length) return pre + tag + "." + c.slice(0, 2).join(".");
    const p = el.parentElement, pc = p ? cls(p) : [];
    return pc.length ? `${pre}${p.tagName.toLowerCase()}.${pc[0]} > ${tag}` : pre + tag;
  }
  const label = el => { const c = cls(el); return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (c.length ? "." + c.slice(0, 2).join(".") : ""); };
  function place(box, el){
    if (!box) return; if (!el || !el.isConnected) { box.style.display = "none"; return; }
    const r = el.getBoundingClientRect(); Object.assign(box.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    box.firstChild.textContent = label(el);
  }
  function markerKey(el){
    for (const n of el.childNodes) if (n.nodeType === 8) { const m = n.data.match(/^t:([\w.-]+)$/); if (m) return m[1]; }
    return null;
  }
  function setLiveText(key, val){
    if (!fdoc) return;
    const w = fdoc.createTreeWalker(fdoc.body, NodeFilter.SHOW_COMMENT); const hits = [];
    while (w.nextNode()) if (w.currentNode.data === "t:" + key) hits.push(w.currentNode);
    for (const c of hits) {
      let n = c.nextSibling; while (n && !(n.nodeType === 8 && n.data === "/t")) { const x = n.nextSibling; n.remove(); n = x; }
      c.after(fdoc.createTextNode(val));
    }
    if (!hits.length && st.el && st.keyVia === "match" && st.key === key) st.el.textContent = val;
  }
  function applyLive(){
    if (!fdoc) return;
    let s = fdoc.getElementById("cms-style"); if (!s) { s = fdoc.createElement("style"); s.id = "cms-style"; fdoc.head.appendChild(s); }
    s.textContent = dFullStyle(ui, st.ai && st.ai.css);
    for (const [sel, a] of Object.entries(ui.attrs)) { let els = []; try { els = fdoc.querySelectorAll(sel); } catch (e) {}
      els.forEach(el => { if (el.tagName !== "IMG") return; if (!el.dataset.wbOrig) el.dataset.wbOrig = el.getAttribute("src") || "";
        if (a.src) { el.src = a.src; el.removeAttribute("srcset"); el.closest("picture")?.querySelectorAll("source").forEach(x => x.remove()); } if (typeof a.alt === "string") el.alt = a.alt; }); }
    requestAnimationFrame(() => place(selBox, st.el));
  }
  function reselect(){ if (!fdoc || !st.exact) return; let el = null; try { el = fdoc.querySelector(st.exact); } catch (e) {} if (el) select(el, true); else { st.el = null; place(selBox, null); } }

  frame.addEventListener("load", () => {
    let d; try { d = frame.contentDocument; } catch (e) { return; }
    if (!d || !d.body || d.body.classList.contains("adm-body")) return;
    fdoc = d;
    const pg = (frame.contentWindow.location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
    if (D_PAGES.some(p => p[0] === pg) && pg !== st.page) { st.page = pg; $("#dPage").value = pg; }
    const style = d.createElement("style");
    style.textContent = `.wb-ed-box{position:fixed;pointer-events:none;z-index:2147483646;display:none;box-sizing:border-box}
      .wb-ed-box span{position:absolute;left:-1px;top:-20px;font:600 11px/18px system-ui,sans-serif;padding:0 6px;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
      .wb-ed-hov{outline:1px dashed #C9C9C9;background:rgba(236,232,223,.06)} .wb-ed-hov span{background:#2a2a2a;color:#ECE8DF}
      .wb-ed-sel{outline:2px solid #E3120B;z-index:2147483647} .wb-ed-sel span{background:#E3120B;color:#fff}
      html.wb-ed-on, html.wb-ed-on *{cursor:default!important}`;
    d.head.appendChild(style);
    const mk = c => { const b = d.createElement("div"); b.className = "wb-ed-box " + c; b.appendChild(d.createElement("span")); d.body.appendChild(b); return b; };
    hovBox = mk("wb-ed-hov"); selBox = mk("wb-ed-sel");
    d.documentElement.classList.toggle("wb-ed-on", st.mode === "edit");
    const isBox = el => el && el.classList && el.classList.contains("wb-ed-box");
    d.addEventListener("mousemove", e => { if (st.mode !== "edit" || isBox(e.target)) return; place(hovBox, e.target); }, true);
    d.addEventListener("mouseleave", () => place(hovBox, null));
    for (const ev of ["click", "submit", "auxclick"]) d.addEventListener(ev, e => {
      if (st.mode !== "edit") return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (ev === "click" && !isBox(e.target)) { let t = e.target; const svg = t.closest && t.closest("svg"); if (svg && svg.parentElement) t = svg.parentElement; select(t); }
    }, true);
    const rep = () => { place(selBox, st.el); place(hovBox, null); };
    d.addEventListener("scroll", rep, true); frame.contentWindow.addEventListener("resize", rep);
    d.addEventListener("keydown", keys);
    applyLive();
    for (const [k, v] of Object.entries(texts[st.lang] || {})) setLiveText(k, v);
    applyPendingRockers().then(reselect);
  });

  async function merged(l){ const dv = await dict(l).catch(() => ({})); return { ...dv, ...(cms["i18n:" + l] || {}) }; }
  const keyOf = (dv, t, f) => Object.keys(dv).find(k => dv[k] === t && (!f || f(k))) || null;
  function setRocker(el, val){
    const w = frame.contentWindow; el.dataset.rocker = val.toLocaleUpperCase(st.lang);
    if (w.WB && w.WB.rocker) { el.innerHTML = ""; w.WB.rocker(el); const sr = el.querySelector(".sr-only"); if (sr) sr.textContent = val; }
  }
  async function applyPendingRockers(){
    const pend = texts[st.lang] || {}; if (!fdoc || !Object.keys(pend).length) return;
    const dv = await merged(st.lang);
    fdoc.querySelectorAll("[data-rocker]").forEach(el => { const sr = el.querySelector(".sr-only"); const tk = sr && keyOf(dv, sr.textContent.trim(), k => !/rocker/i.test(k)); if (tk && pend[tk] != null) setRocker(el, pend[tk]); });
  }
  async function select(el, quiet){
    if (!el || el === fdoc.documentElement) return;
    st.el = el; st.exact = cssPath(el); st.similar = similarSel(el);
    st.key = markerKey(el); st.keyVia = st.key ? "marker" : null; st.key2 = null;
    if (!st.key && el.dataset.rocker) {
      const dv = await merged(st.lang); const sr = el.querySelector(".sr-only");
      const rk = keyOf(dv, el.dataset.rocker, k => /rocker/i.test(k)), tk = sr ? keyOf(dv, sr.textContent.trim(), k => !/rocker/i.test(k)) : null;
      if (rk || tk) { st.key = tk || rk; st.key2 = tk ? rk : null; st.keyVia = "rocker"; }
    } else if (!st.key && ![...el.children].some(c => !/^(BR|B|I|EM|STRONG|SPAN)$/.test(c.tagName))) {
      const t = el.textContent.trim();
      if (t.length > 1 && t.length < 600) { const k = keyOf(await merged(st.lang), t); if (k) { st.key = k; st.keyVia = "match"; } }
    }
    place(selBox, el);
    if (!quiet || st.tab === "el") { if (!quiet) st.tab = "el"; drawTabs(); drawInsp(); }
  }
  const curSel = () => st.target === "similar" ? st.similar : st.exact;
  const rule = () => (ui.rules[st.scope] || {})[curSel()] || {};
  function setProp(prop, val){
    const sel = curSel(); if (!sel) return;
    if (!gesture) { push(); gesture = true; }
    const set = ui.rules[st.scope]; const r = set[sel] = set[sel] || {};
    val = String(val ?? "").trim();
    if (val === "") delete r[prop]; else if (dValOk(val)) r[prop] = val; else return toast("Šo vērtību nevar izmantot", true);
    if (!Object.keys(r).length) delete set[sel];
    applyLive(); updBar();
  }
  const endGesture = () => { gesture = false; };

  /* ---- inspektors ---- */
  function drawTabs(){ $$("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === st.tab)); }
  function drawInsp(){ ({ el: inspEl, ai: inspAi, list: inspList }[st.tab] || inspEl)(); updBar(); }

  function inspEl(){
    const box = $("#dInsp");
    if (!fdoc || !st.el || !st.el.isConnected || st.el.ownerDocument !== fdoc) { box.innerHTML = `<div class="dz-empty"><p><b>Izvēlies elementu</b></p><p class="muted small">Režīmā „Rediģēt” noklikšķini uz jebkura virsraksta, teksta, pogas, attēla vai sadaļas lapā. Lai atvērtu izvēlnes vai pārslēgtu cilnes lapā, pārslēdz uz „Pārlūkot”.</p></div>`; return; }
    const el = st.el, cs = fdoc.defaultView.getComputedStyle(el), r = rule();
    const nSim = (() => { try { return fdoc.querySelectorAll(st.similar).length; } catch (e) { return 0; } })();
    const crumbs = []; for (let a = el, i = 0; a && a.tagName !== "BODY" && i < 5; a = a.parentElement, i++) crumbs.unshift(a);
    const v = p => esc(r[p] || "");
    const ph = p => esc(cs.getPropertyValue(p) || "");
    const num = p => { const x = parseFloat(r[p]); return isNaN(x) ? "" : x; };
    const colorRow = (p, name) => { const val = r[p] || ""; const hex = /^#/.test(val) ? normHex(val) : dHex(cs.getPropertyValue(p)) || "#000000";
      return `<div class="dz-row"><span class="dz-lbl">${name}</span><input type="color" data-color="${p}" value="${esc(hex)}" aria-label="${name}">
        <span class="dz-sw">${D_SWATCH.map(k => `<button class="dz-chip${val === `var(${k})` ? " on" : ""}" data-sw="${p}" data-v="var(${k})" title="${k}" style="background:var(${k})"></button>`).join("")}</span>
        ${val ? `<button class="link-btn" data-clr="${p}">noņemt</button>` : ""}</div>`; };
    const isImg = el.tagName === "IMG", at = ui.attrs[st.exact] || {};
    const txtVal = st.key ? ((texts[st.lang] || {})[st.key] ?? (cms["i18n:" + st.lang] || {})[st.key] ?? null) : null;
    box.innerHTML = `
      <div class="dz-crumbs">${crumbs.map((a, i) => `<button data-crumb="${i}" class="${a === el ? "on" : ""}">${esc(label(a))}</button>`).join("<span>›</span>")}</div>
      <div class="dz-target">
        <div class="dz-seg small" role="group" aria-label="Uz ko attiecas"><button data-tg="exact" aria-pressed="${st.target === "exact"}">Tikai šis</button><button data-tg="similar" aria-pressed="${st.target === "similar"}"${nSim > 1 ? "" : " disabled"}>Visi līdzīgie (${nSim})</button></div>
        <select id="dScope" aria-label="Ierīces">${D_SCOPE.map(([s, l]) => `<option value="${s}"${s === st.scope ? " selected" : ""}>${l}</option>`).join("")}</select>
      </div>

      ${st.key ? `<details class="dz-sec" open><summary>Teksts <span class="muted small">${LANG_NAMES[st.lang]}</span></summary>
        <textarea id="dText" rows="3" class="dz-txt">${esc(txtVal ?? (st.keyVia === "rocker" ? (el.querySelector(".sr-only")?.textContent || el.dataset.rocker || "") : el.textContent).trim())}</textarea>
        ${st.keyVia === "rocker" ? `<p class="small muted">Uzšuves virsraksts — lapā tiek rādīts lielajiem burtiem pa loku.</p>` : ""}
        <p class="small muted">Atslēga <code>${esc(st.key)}</code>. Citā valodā — pārslēdz valodu augšā.</p></details>`
      : (el.textContent.trim() && !isImg ? `<p class="small muted dz-note">Šis teksts nāk no satura sarakstiem (pasākumi, galerija, merch u.c.) — to maini sadaļā <a href="#data">Saturs</a>.</p>` : "")}

      ${isImg ? `<details class="dz-sec" open><summary>Attēls</summary>
        <img class="dz-prev" src="${esc(el.currentSrc || el.src)}" alt="">
        <div class="dz-btns"><button class="btn ghost small" id="dImgUp">Augšupielādēt jaunu</button><button class="btn ghost small" id="dImgPick">No failiem</button>${at.src || at.alt != null ? `<button class="link-btn" id="dImgReset">oriģināls</button>` : ""}</div>
        <label class="adm-f"><span>Apraksts (alt)</span><input id="dAlt" value="${esc(at.alt ?? el.alt ?? "")}"></label>
        <div class="dz-row"><span class="dz-lbl">Ietilpināt</span><select data-p="object-fit"><option value="">—</option>${["cover", "contain", "fill"].map(x => `<option${r["object-fit"] === x ? " selected" : ""}>${x}</option>`).join("")}</select></div></details>` : ""}

      <details class="dz-sec" open><summary>Teksta izskats</summary>
        <div class="dz-row"><span class="dz-lbl">Fonts</span><select data-p="font-family"><option value="">Noklusējums</option>${[["var(--f-display)", "Virsrakstu (WB Display)"], ["var(--f-ui)", "Teksta (WB Text)"], ["var(--f-book)", "Grāmatas (WB Book)"]].map(([x, l]) => `<option value="${x}"${r["font-family"] === x ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="dz-row"><span class="dz-lbl">Izmērs</span><input type="range" min="8" max="200" step="1" data-rng="font-size" value="${num("font-size") || parseFloat(cs.fontSize) || 16}"><input class="dz-n" data-p="font-size" data-unit="px" value="${num("font-size")}" placeholder="${parseFloat(cs.fontSize) || ""}"><span class="muted small">px</span></div>
        <div class="dz-row"><span class="dz-lbl">Biezums</span><select data-p="font-weight"><option value="">${esc(cs.fontWeight)}</option>${[300, 400, 500, 600, 700, 800, 900].map(x => `<option${r["font-weight"] == x ? " selected" : ""}>${x}</option>`).join("")}</select>
          <label class="adm-chk small"><input type="checkbox" data-tgl="font-style" data-on="italic"${r["font-style"] === "italic" ? " checked" : ""}> slīpi</label></div>
        <div class="dz-row"><span class="dz-lbl">Burti</span><select data-p="text-transform"><option value="">—</option>${[["none", "kā rakstīts"], ["uppercase", "LIELIE"], ["lowercase", "mazie"], ["capitalize", "Katrs Vārds"]].map(([x, l]) => `<option value="${x}"${r["text-transform"] === x ? " selected" : ""}>${l}</option>`).join("")}</select>
          <select data-p="text-align" aria-label="Līdzinājums"><option value="">līdzinājums</option>${[["left", "pa kreisi"], ["center", "centrā"], ["right", "pa labi"], ["justify", "abās malās"]].map(([x, l]) => `<option value="${x}"${r["text-align"] === x ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="dz-row"><span class="dz-lbl">Atstarpes</span><input class="dz-n" data-p="letter-spacing" data-unit="em" value="${num("letter-spacing")}" placeholder="burtu" title="Burtu atstarpe (em)"><input class="dz-n" data-p="line-height" value="${v("line-height")}" placeholder="rindu" title="Rindas augstums (piem. 1.4)"></div>
        ${colorRow("color", "Krāsa")}
      </details>

      <details class="dz-sec"><summary>Fons un forma</summary>
        ${colorRow("background-color", "Fona krāsa")}
        <div class="dz-row"><span class="dz-lbl">Fona attēls</span><button class="btn ghost small" id="dBgUp">Augšupielādēt</button><button class="btn ghost small" id="dBgPick">No failiem</button>${r["background-image"] ? `<button class="link-btn" data-clr="background-image">noņemt</button>` : ""}</div>
        <div class="dz-row"><span class="dz-lbl">Stūri</span><input type="range" min="0" max="60" data-rng="border-radius" value="${num("border-radius") || parseFloat(cs.borderTopLeftRadius) || 0}"><input class="dz-n" data-p="border-radius" data-unit="px" value="${num("border-radius")}" placeholder="${parseFloat(cs.borderTopLeftRadius) || 0}"></div>
        <div class="dz-row"><span class="dz-lbl">Rāmis</span><select data-p="border"><option value="">—</option>${[["none", "bez rāmja"], ["1px solid var(--steel)", "plāns pelēks"], ["1px solid var(--bone)", "plāns gaišs"], ["2px solid var(--eye)", "sarkans"], ["3px solid var(--bone)", "biezs gaišs"]].map(([x, l]) => `<option value="${x}"${r.border === x ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="dz-row"><span class="dz-lbl">Ēna</span><select data-p="box-shadow"><option value="">—</option>${[["none", "bez ēnas"], ["0 6px 18px rgba(0,0,0,.45)", "maiga"], ["0 18px 50px rgba(0,0,0,.7)", "dziļa"], ["0 0 0 1px var(--steel)", "kontūra"], ["0 0 24px rgba(227,18,11,.45)", "sarkans mirdzums"]].map(([x, l]) => `<option value="${esc(x)}"${r["box-shadow"] === x ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="dz-row"><span class="dz-lbl">Caurspīdīgums</span><input type="range" min="0" max="1" step=".05" data-rng="opacity" value="${r.opacity ?? cs.opacity}"><span class="small muted" id="dOp">${Math.round((r.opacity ?? cs.opacity) * 100)}%</span></div>
      </details>

      <details class="dz-sec"><summary>Atstarpes un izmērs</summary>
        <p class="small muted">Skaitlis = pikseļi. Var rakstīt arī <code>2rem</code>, <code>5%</code>, <code>auto</code>.</p>
        ${[["padding", "Iekšpusē"], ["margin", "Ārpusē"]].map(([p, l]) => `<div class="dz-row"><span class="dz-lbl">${l}</span>${["top", "right", "bottom", "left"].map((s, i) => `<input class="dz-n" data-p="${p}-${s}" value="${v(p + "-" + s)}" placeholder="${esc(parseFloat(cs.getPropertyValue(p + "-" + s)) || 0)}" title="${l}: ${["augšā", "pa labi", "apakšā", "pa kreisi"][i]}">`).join("")}</div>`).join("")}
        <div class="dz-row"><span class="dz-lbl">Platums</span><input class="dz-n w" data-p="width" value="${v("width")}" placeholder="${ph("width")}"><input class="dz-n w" data-p="max-width" value="${v("max-width")}" placeholder="maks."></div>
        <div class="dz-row"><span class="dz-lbl">Augstums</span><input class="dz-n w" data-p="min-height" value="${v("min-height")}" placeholder="min."><input class="dz-n w" data-p="gap" value="${v("gap")}" placeholder="starpa"></div>
      </details>

      <details class="dz-sec"><summary>Redzamība</summary>
        <label class="adm-chk"><input type="checkbox" data-tgl="display" data-on="none"${r.display === "none" ? " checked" : ""}> Paslēpt (${esc(D_SCOPE.find(s => s[0] === st.scope)[1].toLowerCase())})</label>
        <p class="small muted">Paslēpts elements redaktorā pazūd; to atkal parādīt var cilnē „Visas izmaiņas”.</p>
      </details>

      <div class="dz-foot"><code class="small muted" title="CSS selektors">${esc(curSel())}</code>
        ${Object.keys(r).length ? `<button class="btn ghost small" id="dClear">Noņemt šī elementa izmaiņas</button>` : ""}
        <button class="btn ghost small" id="dAskAi">Jautāt AI par šo elementu</button></div>`;

    $$("[data-crumb]").forEach(b => b.addEventListener("click", () => select(crumbs[+b.dataset.crumb])));
    $$("[data-tg]").forEach(b => b.addEventListener("click", () => { st.target = b.dataset.tg; inspEl(); }));
    $("#dScope").addEventListener("change", e => { st.scope = e.target.value; inspEl(); });
    $$("[data-p]").forEach(i => {
      const fire = () => { let val = i.value; if (i.dataset.unit && /^-?\d+(\.\d+)?$/.test(val.trim())) val = val.trim() + i.dataset.unit; else if (i.classList.contains("dz-n") && !i.dataset.unit && i.dataset.p !== "line-height") val = dPx(val);
        setProp(i.dataset.p, val); const rng = $(`[data-rng="${i.dataset.p}"]`); if (rng && parseFloat(val)) rng.value = parseFloat(val); };
      i.addEventListener(i.tagName === "SELECT" ? "change" : "input", fire); i.addEventListener("change", endGesture);
      if (i.tagName === "SELECT") i.addEventListener("change", endGesture);
    });
    $$("[data-rng]").forEach(i => {
      i.addEventListener("input", () => { const p = i.dataset.rng; const val = p === "opacity" ? i.value : i.value + "px"; setProp(p, val);
        const n = $(`[data-p="${p}"]`); if (n) n.value = i.value; if (p === "opacity") $("#dOp").textContent = Math.round(i.value * 100) + "%"; });
      i.addEventListener("change", endGesture);
    });
    $$("[data-color]").forEach(i => { i.addEventListener("input", () => setProp(i.dataset.color, i.value)); i.addEventListener("change", () => { endGesture(); inspEl(); }); });
    $$("[data-sw]").forEach(b => b.addEventListener("click", () => { setProp(b.dataset.sw, b.dataset.v); endGesture(); inspEl(); }));
    $$("[data-clr]").forEach(b => b.addEventListener("click", () => { setProp(b.dataset.clr, ""); endGesture(); inspEl(); }));
    $$("[data-tgl]").forEach(c => c.addEventListener("change", () => { setProp(c.dataset.tgl, c.checked ? c.dataset.on : ""); endGesture(); if (c.dataset.tgl === "display") place(selBox, st.el); }));
    const tx = $("#dText");
    if (tx) { tx.addEventListener("input", () => { if (!gesture) { push(); gesture = true; } const T = texts[st.lang] = texts[st.lang] || {}; T[st.key] = tx.value;
        if (st.keyVia === "rocker") { if (st.key2) T[st.key2] = tx.value.toLocaleUpperCase(st.lang); setRocker(st.el, tx.value); } else setLiveText(st.key, tx.value); place(selBox, st.el); updBar(); }); tx.addEventListener("change", endGesture); }
    const setImg = url => { push(); endGesture(); ui.attrs[st.exact] = { ...(ui.attrs[st.exact] || {}), src: url }; applyLive(); inspEl(); };
    $("#dImgUp")?.addEventListener("click", () => pickUpload(setImg));
    $("#dImgPick")?.addEventListener("click", () => pickExisting(setImg));
    $("#dImgReset")?.addEventListener("click", () => { push(); endGesture(); delete ui.attrs[st.exact]; if (el.dataset.wbOrig != null) el.src = el.dataset.wbOrig; applyLive(); inspEl(); });
    $("#dAlt")?.addEventListener("input", e => { if (!gesture) { push(); gesture = true; } ui.attrs[st.exact] = { ...(ui.attrs[st.exact] || {}), alt: e.target.value }; applyLive(); });
    $("#dAlt")?.addEventListener("change", endGesture);
    const setBg = url => { push(); const set = ui.rules[st.scope], s = curSel(); set[s] = { ...(set[s] || {}), "background-image": `url(${url})`, "background-size": "cover", "background-position": "center" }; endGesture(); applyLive(); inspEl(); };
    $("#dBgUp").addEventListener("click", () => pickUpload(setBg));
    $("#dBgPick").addEventListener("click", () => pickExisting(setBg));
    $("#dClear")?.addEventListener("click", () => { push(); endGesture(); delete ui.rules[st.scope][curSel()]; applyLive(); inspEl(); });
    $("#dAskAi").addEventListener("click", () => { st.tab = "ai"; drawTabs(); drawInsp(); $("#dAiQ")?.focus(); });
  }

  async function inspAi(){
    const box = $("#dInsp");
    if (!st.aiInfo) { box.innerHTML = `<p class="muted">Pārbauda AI…</p>`; try { st.aiInfo = await api("/admin/ai"); } catch (e) { st.aiInfo = { available: false }; } if (st.tab !== "ai") return; }
    if (!st.aiInfo.available) { box.innerHTML = `<div class="dz-empty"><p><b>AI palīgs vēl nav pieslēgts</b></p><p class="small muted">Izstrādātājam: Cloudflare Workers AI (bez maksas) ieslēdzas ar <code>"ai": { "binding": "AI" }</code> konfigurācijā un jaunu izvietošanu. Vai arī iestati noslēpumu <code>ANTHROPIC_API_KEY</code>, lai izmantotu Claude.</p></div>`; return; }
    const selInfo = fdoc && st.el && st.el.isConnected && st.el.ownerDocument === fdoc ? label(st.el) : null;
    box.innerHTML = `
      <p class="small muted">Uzraksti vārdiem, ko mainīt. AI sagatavo izmaiņas, tu tās redzi lapā un pats izlem — pieņemt vai atmest.</p>
      <textarea id="dAiQ" rows="4" class="dz-txt" placeholder="Piem.: padari sākumlapas virsrakstu lielāku un ar sarkanu apakšlīniju; telefonā samazini atstarpes starp sadaļām">${esc(st.aiPrompt)}</textarea>
      ${selInfo ? `<label class="adm-chk small"><input type="checkbox" id="dAiSel" checked> Attiecas uz izvēlēto: <code>${esc(selInfo)}</code></label>` : `<p class="small muted">Padoms: vispirms noklikšķini uz elementa lapā — AI zinās, par ko ir runa.</p>`}
      <div class="dz-btns"><button class="btn small" id="dAiGo">Sagatavot izmaiņas</button><span class="small muted">${st.aiInfo.engine === "claude" ? "Claude" : "Workers AI"}</span></div>
      <div id="dAiRes">${st.ai ? aiResHtml() : ""}</div>
      <div class="dz-ideas"><p class="small muted">Idejas:</p>${["Padari visus sadaļu virsrakstus lielākus un ciešākus", "Telefonā samazini atstarpes starp sadaļām", "Pogām pievieno sarkanu mirdzumu, uzbraucot ar peli", "Kājeni padari tumšāku ar plānu līniju augšā", "Uzlabo kontrastu sekundārajam tekstam"].map(x => `<button class="dz-idea">${esc(x)}</button>`).join("")}</div>`;
    $$(".dz-idea").forEach(b => b.addEventListener("click", () => { $("#dAiQ").value = b.textContent; $("#dAiQ").focus(); }));
    $("#dAiQ").addEventListener("input", e => st.aiPrompt = e.target.value);
    $("#dAiGo").addEventListener("click", aiRun);
    bindAiRes();
  }
  function aiResHtml(){
    const a = st.ai, tk = Object.keys(a.texts || {});
    return `<div class="dz-ai">
      <p><b>Priekšskatījums lapā</b></p>${a.explain ? `<p class="small">${esc(a.explain)}</p>` : ""}
      ${tk.length ? `<p class="small muted">Teksti: ${tk.map(k => `<code>${esc(k)}</code>`).join(", ")}</p>` : ""}
      <details><summary class="small">CSS kods</summary><pre class="adm-json small">${esc(a.css || "(nav)")}</pre></details>
      <div class="dz-btns"><button class="btn small" id="dAiOk">Pieņemt</button><button class="btn ghost small" id="dAiNo">Atmest</button></div></div>`;
  }
  function bindAiRes(){
    $("#dAiOk")?.addEventListener("click", () => {
      const a = st.ai; push(); endGesture();
      if (a.css && a.css.trim()) ui.css = (ui.css.trim() ? ui.css.trim() + "\n\n" : "") + `/* AI: ${st.aiPrompt.slice(0, 90).replace(/\*\//g, "").replace(/\n/g, " ")} */\n` + a.css.trim();
      for (const [k, v] of Object.entries(a.texts || {})) { (texts[st.lang] = texts[st.lang] || {})[k] = v; setLiveText(k, v); }
      st.ai = null; applyLive(); toast("Pieņemts — neaizmirsti saglabāt"); inspAi();
    });
    $("#dAiNo")?.addEventListener("click", () => { st.ai = null; applyLive(); inspAi(); });
  }
  async function aiRun(){
    const q = $("#dAiQ").value.trim(); if (q.length < 3) return toast("Uzraksti, ko mainīt", true);
    st.aiPrompt = q; const btn = $("#dAiGo"); btn.disabled = true; btn.textContent = "Domā…";
    const useSel = fdoc && $("#dAiSel")?.checked && st.el && st.el.isConnected && st.el.ownerDocument === fdoc;
    const structure = fdoc ? [...fdoc.querySelectorAll("body > header, main > section[id], main > div[id], body > footer, nav[id], header[id]")].slice(0, 40)
      .map(s => `${label(s)}: ${(s.querySelector("h1,h2,h3")?.textContent || "").trim().slice(0, 60)}`).join("\n") : "";
    let selected = null;
    if (useSel) { const cs = fdoc.defaultView.getComputedStyle(st.el);
      selected = { sel: curSel(), tag: st.el.tagName.toLowerCase(), key: st.key || "", text: st.el.textContent.trim().slice(0, 300), html: st.el.outerHTML.replace(/\s+/g, " ").slice(0, 2000),
        styles: Object.fromEntries(["color", "background-color", "font-size", "font-weight", "font-family", "letter-spacing", "line-height", "padding", "margin", "border-radius", "display", "width"].map(p => [p, cs.getPropertyValue(p)])) }; }
    try {
      const j = await api("/admin/ai", { body: { prompt: q, page: st.page, lang: st.lang, selected, cssVars: rootVars, structure, currentCss: [dRulesCss(ui.rules), ui.css].filter(Boolean).join("\n") } });
      st.ai = { css: j.css, texts: j.texts, explain: j.explain };
      applyLive(); for (const [k, v] of Object.entries(j.texts || {})) setLiveText(k, v);
      $("#dAiRes").innerHTML = aiResHtml(); bindAiRes();
    } catch (e) { toast(e.message, true); }
    btn.disabled = false; btn.textContent = "Sagatavot izmaiņas";
  }

  function inspList(){
    const box = $("#dInsp"); const rows = [];
    for (const [sc, set] of Object.entries(ui.rules)) for (const [sel, props] of Object.entries(set))
      rows.push(`<div class="dz-chg"><button class="link-btn dz-go" data-go="${esc(sel)}">${esc(sel)}</button> <span class="muted small">${esc(D_SCOPE.find(s => s[0] === sc)[1])}</span>
        <ul>${Object.entries(props).map(([p, v]) => `<li><span>${esc(D_PROP_LV[p] || p)}: <code>${esc(v)}</code></span><button class="icon-btn mini" data-rm="${esc(sc)}|${esc(sel)}|${esc(p)}" aria-label="Noņemt">×</button></li>`).join("")}</ul></div>`);
    for (const [sel, a] of Object.entries(ui.attrs)) rows.push(`<div class="dz-chg"><button class="link-btn dz-go" data-go="${esc(sel)}">${esc(sel)}</button> <span class="muted small">attēls</span><ul><li><span>${a.src ? "Jauns attēls" : ""}${a.alt != null ? " · alt" : ""}</span><button class="icon-btn mini" data-rma="${esc(sel)}" aria-label="Noņemt">×</button></li></ul></div>`);
    for (const [l, o] of Object.entries(texts)) for (const [k, v] of Object.entries(o)) rows.push(`<div class="dz-chg"><span><b>${l.toUpperCase()}</b> <code>${esc(k)}</code></span><ul><li><span>${esc(String(v).slice(0, 80))}</span><button class="icon-btn mini" data-rmt="${esc(l)}|${esc(k)}" aria-label="Noņemt">×</button></li></ul><span class="small muted">nesaglabāts teksts</span></div>`);
    box.innerHTML = (rows.length ? rows.join("") : `<div class="dz-empty"><p class="muted">Vēl nav dizaina izmaiņu.</p></div>`) +
      `<details class="dz-sec"><summary>Papildu CSS (arī AI pieņemtās izmaiņas)</summary><textarea id="dCss" class="adm-json" rows="10" spellcheck="false">${esc(ui.css)}</textarea></details>
      ${count() ? `<button class="btn ghost small" id="dAllClr">Noņemt visas dizaina izmaiņas</button>` : ""}`;
    $$("[data-go]").forEach(b => b.addEventListener("click", () => { let el = null; try { el = fdoc.querySelector(b.dataset.go); } catch (e) {} if (el) { el.scrollIntoView({ block: "center" }); select(el); } else toast("Šajā lapā tāda elementa nav", true); }));
    $$("[data-rm]").forEach(b => b.addEventListener("click", () => { const [sc, sel, p] = b.dataset.rm.split("|"); push(); endGesture(); delete ui.rules[sc][sel][p]; if (!Object.keys(ui.rules[sc][sel]).length) delete ui.rules[sc][sel]; applyLive(); inspList(); }));
    $$("[data-rma]").forEach(b => b.addEventListener("click", () => { push(); endGesture(); delete ui.attrs[b.dataset.rma]; loadFrame(); inspList(); }));
    $$("[data-rmt]").forEach(b => b.addEventListener("click", () => { const [l, k] = b.dataset.rmt.split("|"); push(); endGesture(); delete texts[l][k]; loadFrame(); inspList(); }));
    $("#dCss").addEventListener("input", e => { if (!gesture) { push(); gesture = true; } ui.css = e.target.value; applyLive(); });
    $("#dCss").addEventListener("change", endGesture);
    $("#dAllClr")?.addEventListener("click", () => { if (!confirmBox("Noņemt visas dizaina izmaiņas (stilus, attēlus, nesaglabātos tekstus)? Pēc saglabāšanas lapa atgriezīsies sākotnējā izskatā.")) return;
      push(); endGesture(); ui.rules = { all: {}, mobile: {}, desktop: {} }; ui.attrs = {}; ui.css = ""; for (const k of Object.keys(texts)) delete texts[k]; loadFrame(); inspList(); });
  }

  /* ---- vadība ---- */
  function keys(e){
    const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (typing || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") { if (e.key === "Escape" && !typing && st.el) { st.el = null; place(selBox, null); if (st.tab === "el") inspEl(); } return; }
    e.preventDefault(); e.shiftKey ? doRedo() : doUndo();
  }
  document.addEventListener("keydown", keys);
  const stop = () => { if (location.hash.split("/")[0] === "#design") return; document.removeEventListener("keydown", keys); $("#adm").classList.remove("wide"); removeEventListener("hashchange", stop); };
  addEventListener("hashchange", stop);
  $("#dUndo").addEventListener("click", doUndo); $("#dRedo").addEventListener("click", doRedo);
  $("#dPage").addEventListener("change", e => { st.page = e.target.value; LS.set("wb-d-page", st.page); st.el = null; st.exact = null; loadFrame(); drawInsp(); });
  $("#dLang").addEventListener("change", e => { st.lang = e.target.value; LS.set("wb-d-lang", st.lang); loadFrame(); setTimeout(drawInsp, 50); });
  $$("[data-dev]").forEach(b => b.addEventListener("click", () => { st.dev = b.dataset.dev; LS.set("wb-d-dev", st.dev); $$("[data-dev]").forEach(x => x.setAttribute("aria-pressed", x === b)); sizeFrame(); setTimeout(() => place(selBox, st.el), 350);
    if (st.dev === "mob" && st.scope === "desktop" || st.dev === "desk" && st.scope === "mobile") { st.scope = "all"; drawInsp(); } }));
  $$("[data-m]").forEach(b => b.addEventListener("click", () => { st.mode = b.dataset.m; $$("[data-m]").forEach(x => x.setAttribute("aria-pressed", x === b)); fdoc && fdoc.documentElement.classList.toggle("wb-ed-on", st.mode === "edit"); place(hovBox, null); }));
  $$("[data-tab]").forEach(b => b.addEventListener("click", () => { st.tab = b.dataset.tab; drawTabs(); drawInsp(); }));
  $("#dHist").addEventListener("click", () => historyDialog("ui", () => design()));
  $("#dSave").addEventListener("click", async () => {
    const btn = $("#dSave"); btn.disabled = true;
    try {
      for (const s of Object.keys(ui.rules)) for (const [sel, p] of Object.entries(ui.rules[s])) if (!Object.keys(p).length) delete ui.rules[s][sel];
      await saveCms("ui", ui);
      for (const [l, o] of Object.entries(texts)) if (Object.keys(o).length) { await saveCms("i18n:" + l, { ...(cms["i18n:" + l] || {}), ...o }); delete dictCache[l]; }
      for (const k of Object.keys(texts)) delete texts[k];
      dirty = false; updBar(); toast("Saglabāts — apmeklētāji to redz uzreiz");
    } catch (e) { toast(e.message, true); dirty = true; }
    btn.disabled = false;
  });
  sizeFrame(); updBar(); drawInsp(); loadFrame();
}

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
