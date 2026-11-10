/* WBMC Saziņa — slēgtā biedru saziņa: norīkojumi, kanāli pēc pakāpes, grupas, privātās sarunas, idejas, Riders Help Riders.
   Visas piekļuves pārbaudes notiek serverī; šeit tikai attēlojums. Teksts vienmēr caur WB.esc; saites — tikai https ar rel="noopener noreferrer nofollow". */
(function(){
const { $, $$, esc, t, tp } = WB;
const app = $("#app"), side = $("#szSide"), main = $("#szMain"), info = $("#szInfo");
const MQ_MOBILE = matchMedia("(max-width: 900px)"), MQ_WIDE = matchMedia("(min-width: 1280px)");
const LS = { get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} } };
const S = { rooms: [], data: null, cur: null, ws: null, poll: null, lastTotal: null, sound: LS.get("wb-comms-sound", "0") === "1", members: null, roles: null };

/* ---------- ikonas (vienots līniju stils ar WB.icon) ---------- */
const P = {
  hash: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  orders: '<path d="M7 3h10l3 3v15H4V3z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .8 3.5 2.8 3.5 5.7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  hands: '<path d="M12 21s-7.5-4.6-9.3-9.2C1.5 8.6 3.5 5 7 5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.5 0 5.5 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  clip: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1L13 4.3a3.4 3.4 0 0 1 4.8 4.8l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4L14.5 7.6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  sos: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
};
const ic = (n, cls = "") => `<svg class="ico-svg ${cls}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

/* ---------- palīgi ---------- */
const L = v => WB.L(v) || "";
const initial = n => esc(((n || "?").trim()[0] || "?").toUpperCase());
const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); };
const dayLabel = ts => { const d = WB.day0(new Date(ts)), n = WB.day0(new Date()), diff = Math.round((n - d) / 864e5); return diff === 0 ? t("comms.today") : diff === 1 ? t("comms.yesterday") : WB.dateLong(d); };
const clock = ts => WB.time(new Date(ts));
const when = ts => { const d = new Date(ts); return dayKey(ts) === dayKey(Date.now()) ? clock(ts) : `${WB.dayLabel(d)} ${clock(ts)}`; };
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? t("comms.justNow") : m < 60 ? t("comms.minAgo", { n: m }) : m < 24 * 60 ? t("comms.hAgo", { n: Math.round(m / 60) }) : when(ts); };
const fullTime = ts => new Date(ts).toLocaleString(WB.locale, { dateStyle: "long", timeStyle: "short" });
const size = n => n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
const dur = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + WB.pad(s % 60); };
/* teksts → droša HTML: escape, tad tikai https saites */
const linkify = s => esc(s).replace(/https:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<])+/g, u => {
  const m = u.match(/^(.*?)([.,;:!?)\]]+)?$/); const href = m[1], tail = m[2] || "";
  return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${href}</a>${tail}`;
});
const roomName = r => !r ? "" : r.kind === "dm" ? (r.other ? r.other.name : "—") : L(r.name);
const roomIcon = r => r.kind === "dm" ? "user" : r.kind === "group" ? "users" : r.topic === "rhr" ? "hands" : r.locked ? "lock" : "hash";
const roomHref = r => r.kind === "dm" ? `#dm/${r.other ? r.other.id : ""}` : r.kind === "group" ? `#g/${r.id}` : r.id === "rhr" ? "#rhr" : `#${r.id}`;
const byId = id => S.rooms.find(r => r.id === id);
const mine = m => m.author === WB.me.id;
const toastErr = e => WB.toast(WB.errMsg(e), true);
const busy = (b, on) => { if (b) { b.disabled = on; b.classList.toggle("dis", on); } };
const isMobile = () => MQ_MOBILE.matches;

/* ---------- skaņa (WebAudio, bez failiem; pēc noklusējuma izslēgta) ---------- */
let actx = null;
function ping(){
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const tt = actx.currentTime;
    [[660, 0], [880, .12]].forEach(([f, d]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, tt + d); g.gain.linearRampToValueAtTime(.08, tt + d + .02); g.gain.exponentialRampToValueAtTime(.0001, tt + d + .22);
      o.connect(g).connect(actx.destination); o.start(tt + d); o.stop(tt + d + .25);
    });
  } catch (e) {}
}

/* ---------- nelasītie: galvenes punkts, cilnes virsraksts ---------- */
const baseTitle = document.title;
function paintUnread(){
  const total = S.rooms.filter(r => !r.muted && r.id !== (S.cur && S.cur.roomId)).reduce((a, r) => a + r.unread, 0) + ((S.data && S.data.orders && S.data.orders.unread) || 0);
  const dot = $("#commsDot"); if (dot) dot.hidden = !total;
  if (WB.setUnread) WB.setUnread(total);
  document.title = total ? `(${total > 99 ? "99+" : total}) ${baseTitle}` : baseTitle;
  if (S.lastTotal !== null && total > S.lastTotal) ping();
  S.lastTotal = total;
}

/* ---------- sānjosla ---------- */
async function loadRooms(){
  const d = await WB.req("/comms/rooms");
  S.data = d; S.rooms = d.rooms;
  renderSide(); paintUnread();
  return d;
}
const countBadge = (n, muted) => n ? `<span class="sz-count${muted ? " muted" : ""}" aria-label="${esc(tp("comms.unread", n))}">${n > 99 ? "99+" : n}</span>` : "";
function itemHTML(r, href, label, icon, extra = "", sub = ""){
  const cur = S.cur && S.cur.key === href;
  return `<li><a class="sz-item${cur ? " on" : ""}${sub ? " two" : ""}" href="${href}"${cur ? ' aria-current="page"' : ""}>
    <span class="sz-ico">${ic(icon)}</span><span class="sz-label"><span class="sz-name">${esc(label)}</span>${sub ? `<span class="sz-sub">${sub}</span>` : ""}</span>${extra}</a></li>`;
}
function lastLine(r){
  const m = r.last; if (!m) return "";
  const who = m.author === WB.me.id ? t("comms.you") + ": " : r.kind === "group" ? esc(m.authorName.split(" ")[0]) + ": " : "";
  const txt = m.deleted ? t("comms.deleted") : m.kind === "voice" ? t("comms.voiceMsg") : m.kind === "image" ? t("comms.image") : m.kind === "file" ? (m.fileName || t("comms.file")) : m.kind === "system" ? sysText(m, true) : m.snippet;
  return who + esc(txt);
}
function renderSide(){
  const d = S.data || {}, rooms = S.rooms;
  const chans = rooms.filter(r => r.kind === "channel" && r.id !== "rhr");
  const groups = rooms.filter(r => r.kind === "group").sort((a, b) => b.lastAt - a.lastAt);
  const dms = rooms.filter(r => r.kind === "dm").sort((a, b) => b.lastAt - a.lastAt);
  const rhr = rooms.find(r => r.id === "rhr");
  const q = S.cur && S.cur.type === "search" ? S.cur.q : "";
  const canGroup = d.me && d.me.canGroup;
  side.innerHTML = `<div class="sz-side-head"><a class="sz-brand" href="#" aria-label="${esc(t("nav.comms"))}"><span class="rocker sz-rocker" data-rocker="${esc(t("comms.brand"))}"></span></a>
      <form class="sz-search" role="search"><label class="sr-only" for="szQ">${esc(t("comms.search"))}</label>${ic("search")}<input type="search" id="szQ" name="q" placeholder="${esc(t("comms.searchPh"))}" value="${esc(q)}" minlength="2" maxlength="100" autocomplete="off" enterkeyhint="search"></form></div>
    <nav class="sz-nav" aria-label="${esc(t("comms.sections"))}">
      ${d.orders ? `<ul class="sz-list">${itemHTML(null, "#orders", t("comms.orders"), "orders", countBadge(d.orders.unread))}</ul>` : ""}
      ${chans.length ? `<h2 class="sz-h">${esc(t("comms.channels"))}</h2><ul class="sz-list">${chans.map(r => itemHTML(r, roomHref(r), roomName(r), roomIcon(r), `${r.locked && r.minRole ? `<span class="sz-rank" title="${esc(t("comms.accessFrom", { role: r.minRole }))}">${esc(t("comms.rankPlus", { role: r.minRole }))}</span>` : ""}${countBadge(r.unread, r.muted)}`)).join("")}</ul>` : ""}
      <h2 class="sz-h">${esc(t("comms.groups"))}${canGroup ? `<button class="sz-add" type="button" data-act="newGroup" aria-label="${esc(t("comms.newGroup"))}" title="${esc(t("comms.newGroup"))}">${ic("plus")}</button>` : ""}</h2>
      ${groups.length ? `<ul class="sz-list">${groups.map(r => itemHTML(r, roomHref(r), roomName(r), "users", countBadge(r.unread, r.muted), lastLine(r))).join("")}</ul>` : `<p class="sz-none">${esc(t("comms.noGroups"))}</p>`}
      <h2 class="sz-h">${esc(t("comms.dms"))}${canGroup ? `<button class="sz-add" type="button" data-act="newDm" aria-label="${esc(t("comms.newDm"))}" title="${esc(t("comms.newDm"))}">${ic("plus")}</button>` : ""}</h2>
      ${dms.length ? `<ul class="sz-list">${dms.map(r => itemHTML(r, roomHref(r), roomName(r), "user", countBadge(r.unread, r.muted), lastLine(r))).join("")}</ul>` : `<p class="sz-none">${esc(t("comms.noDms"))}</p>`}
      ${d.ideas || rhr ? `<ul class="sz-list sz-list-end">
        ${d.ideas ? itemHTML(null, "#ideas", t("comms.ideas"), "idea", countBadge(d.ideas.unread)) : ""}
        ${rhr ? itemHTML(rhr, "#rhr", t("comms.rhr"), "hands", `${d.sos ? `<span class="sz-sos" aria-label="SOS ${d.sos}"><span class="pulse-dot" aria-hidden="true"></span>SOS ${d.sos}</span>` : ""}${countBadge(rhr.unread, rhr.muted)}`) : ""}</ul>` : ""}
    </nav>
    <div class="sz-side-foot"><span class="sz-me"><span class="sz-av small">${initial(WB.me.name)}</span>${esc(WB.me.name)}</span>
      <button class="sz-sound${S.sound ? " on" : ""}" type="button" data-act="sound" aria-pressed="${S.sound}" title="${esc(t("comms.sound"))}">${ic("sound")}<span class="sr-only">${esc(t("comms.sound"))}</span></button></div>`;
  const rk = $(".sz-rocker", side); if (rk) { WB.rocker(rk); rk.classList.add("in"); }
}
side.addEventListener("submit", e => { e.preventDefault(); const v = e.target.q.value.trim(); if (v.length < 2) return WB.toast(t("err.short"), true); location.hash = "search/" + encodeURIComponent(v); });
side.addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  if (a.dataset.act === "newGroup") groupDialog();
  if (a.dataset.act === "newDm") dmDialog();
  if (a.dataset.act === "sound") toggleSound();
});
function toggleSound(){
  S.sound = !S.sound; LS.set("wb-comms-sound", S.sound ? "1" : "0");
  if (S.sound) ping();
  WB.toast(t(S.sound ? "comms.soundOn" : "comms.soundOff"));
  renderSide(); if (S.cur && S.cur.roomId) renderInfo();
}

/* ---------- maršrutēšana (#general, #g/<id>, #dm/<userId>, #m/<room>/<msg>, #orders[/id], #ideas[/id], #rhr[/sos|helpers], #search/<q>) ---------- */
async function route(){
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [a, b, c] = h.split("/");
  closeWs();
  if (!h) {
    if (!isMobile()) { const first = S.rooms.find(r => r.id === "general") || S.rooms.find(r => r.kind === "channel"); if (first) return location.replace(roomHref(first)); }
    S.cur = null; app.dataset.view = "list"; main.innerHTML = `<div class="sz-blank"><p class="muted">${esc(t("comms.selectConv"))}</p></div>`; info.hidden = true; renderSide(); return;
  }
  app.dataset.view = "main";
  try {
    if (a === "orders") await showOrders(b);
    else if (a === "ideas") await showIdeas(b);
    else if (a === "search") await showSearch(h.slice(7));
    else if (a === "rhr") await showRhr(b || "talk");
    else if (a === "dm") {
      let r = S.rooms.find(x => x.kind === "dm" && x.other && x.other.id === b);
      if (!r) { const j = await WB.req(`/comms/dm/${encodeURIComponent(b)}`, { body: {} }); await loadRooms(); r = byId(j.id); }
      await openRoom(r, { key: "#" + h });
    }
    else if (a === "g") await openRoom(byId(b) || await fetchRoom(b), { key: "#" + h });
    else if (a === "m") { const r = byId(b) || await fetchRoom(b); await openRoom(r, { key: roomHref(r), around: c }); }
    else if (byId(a)) await openRoom(byId(a), { key: "#" + a });
    else throw new WB.ApiError(403, { error: t("gate.noAccessText"), code: "forbidden" }); // kanālu saraksts no servera jau ir filtrēts pēc pakāpes
  } catch (e) { showError(e); }
  renderSide();
}
async function fetchRoom(id){ const j = await WB.req(`/comms/rooms/${encodeURIComponent(id)}`); return j.room; }
function showError(e){
  S.cur = { type: "error", key: location.hash };
  main.innerHTML = `${head(e && e.status === 403 ? t("gate.noAccessTitle") : t("err.generic"), "", "")}<div class="sz-blank"><div class="empty"><p>${esc(WB.errMsg(e))}</p><a class="btn ghost small" href="#">${esc(t("comms.back"))}</a></div></div>`;
  info.hidden = true;
}
function head(title, sub, actions, icon){
  return `<header class="sz-head"><a class="icon-btn sz-backbtn" href="#" aria-label="${esc(t("comms.back"))}">${ic("back")}</a>
    <div class="sz-head-t">${icon ? `<span class="sz-head-ico">${ic(icon)}</span>` : ""}<div><h2>${esc(title)}</h2>${sub ? `<p class="sz-head-sub">${sub}</p>` : ""}</div></div>
    <div class="sz-head-a">${actions || ""}</div></header>`;
}

/* ---------- saruna ---------- */
async function openRoom(room, { key, around, tabs } = {}){
  if (!room) throw new WB.ApiError(404, { error: t("comms.selectConv") });
  const C = S.cur = { type: "room", key: key || roomHref(room), roomId: room.id, room, msgs: [], hasMore: false, hasNewer: false, around: !!around, reply: null, editing: null, typing: {}, online: [], video: null, access: null };
  const sub = room.kind === "dm" ? esc(room.other && room.other.roleName || "") : room.kind === "group" ? esc(`${t("comms.members")}: ${(room.members || []).length}`) : esc(L(room.description));
  const acts = `<button class="icon-btn" type="button" data-act="video" aria-label="${esc(t("comms.videoStart"))}" title="${esc(t("comms.videoStart"))}">${ic("video")}</button>
    <button class="icon-btn sz-infobtn" type="button" data-act="info" aria-label="${esc(t("comms.info"))}" aria-expanded="${!info.hidden}" title="${esc(t("comms.info"))}">${ic("info")}</button>`;
  main.innerHTML = `${tabs ? tabs.head : head(roomName(room), sub, acts, roomIcon(room))}${tabs ? tabs.bar : ""}
    <div class="sz-conv">
      <div class="sz-status" id="szStatus" hidden></div>
      <div class="sz-msgs" id="szMsgs" tabindex="0" aria-label="${esc(roomName(room))}" role="log" aria-live="polite" aria-relevant="additions"><div class="sz-loading">${esc(t("comms.loading"))}</div></div>
      <button class="sz-jump" id="szJump" type="button" hidden>${ic("down")}<span>${esc(t("comms.newBelow"))}</span></button>
      <div class="sz-typing" id="szTyping" aria-live="polite"></div>
    </div>
    ${composerHTML(room)}`;
  wireComposer();
  setInfoOpen(!isMobile() && LS.get("wb-comms-info", MQ_WIDE.matches ? "1" : "0") === "1", false);
  try {
    const [j, ri] = await Promise.all([WB.req(`/comms/rooms/${room.id}/messages?limit=50${around ? "&around=" + encodeURIComponent(around) : ""}`), WB.req(`/comms/rooms/${room.id}`).catch(() => null)]);
    if (S.cur !== C) return;
    if (ri) { C.access = ri.access; C.video = ri.video; C.membersList = ri.members; if (ri.room) Object.assign(room, ri.room); }
    C.msgs = j.messages; C.hasMore = j.hasMore; C.hasNewer = !!j.hasNewer; C.lastRead = j.lastRead; C.muted = j.muted;
    if (C.access && !C.access.post) lockComposer();
    renderMsgs({ divider: true });
    if (around) { const el = $(`[data-id="${CSS.escape(around)}"]`, main); if (el) { el.classList.add("hl"); el.scrollIntoView({ block: "center" }); } }
    else scrollBottom();
    renderInfo();
    connectWs(C);
    markRead(C);
  } catch (e) { if (S.cur === C) showError(e); }
}
function composerHTML(room){
  return `<form class="sz-composer" id="szComposer" autocomplete="off">
    <div class="sz-chip" id="szChip" hidden></div>
    <div class="sz-rec" id="szRec" hidden><span class="sz-rec-dot" aria-hidden="true"></span><span>${esc(t("comms.recording"))}</span><b class="num" id="szRecT">0:00</b><span class="sz-rec-sp"></span>
      <button class="btn ghost small" type="button" data-act="recCancel">${esc(t("comms.cancelRec"))}</button><button class="btn small" type="button" data-act="recSend">${ic("send")}${esc(t("comms.stopSend"))}</button></div>
    <div class="sz-row" id="szRow">
      <input type="file" id="szFile" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
      <button class="icon-btn" type="button" data-act="attach" aria-label="${esc(t("comms.attach"))}" title="${esc(t("comms.attach"))}">${ic("clip")}</button>
      <label class="sr-only" for="szText">${esc(t("comms.composerLabel"))}</label>
      <textarea id="szText" rows="1" maxlength="4000" placeholder="${esc(t("comms.composerPh"))}" enterkeyhint="send"></textarea>
      <button class="icon-btn" type="button" data-act="rec" aria-label="${esc(t("comms.voice"))}" title="${esc(t("comms.voice"))}">${ic("mic")}</button>
      <button class="icon-btn sz-send" type="submit" aria-label="${esc(t("comms.send"))}" title="${esc(t("comms.send"))}">${ic("send")}</button>
    </div>
    <p class="sz-hint">${esc(t("comms.composerHint"))}</p>
  </form>`;
}
function lockComposer(){ const f = $("#szComposer"); if (f) f.outerHTML = `<p class="sz-ro">${esc(t("comms.composerRo"))}</p>`; }

/* ziņu attēlojums */
function sysText(m, plain){
  const e = m.meta || {}, who = m.author === WB.me.id ? t("comms.you") : m.authorName, names = (e.names || []).join(", ");
  const kind = e.sosKind ? t("comms.sosKind." + e.sosKind) : "";
  const map = { created: "comms.sys.created", added: "comms.sys.added", removed: "comms.sys.removed", left: "comms.sys.left", renamed: "comms.sys.renamed", video: "comms.sys.video", sos: "comms.sys.sos", sos_resolved: "comms.sys.sosResolved" };
  return t(map[e.event] || "comms.sys.video", { who, names, name: e.name || "", kind });
}
function msgHTML(m, prev, divider){
  const day = !prev || dayKey(prev.created) !== dayKey(m.created);
  const sep = day ? `<div class="sz-day" role="separator"><span>${esc(dayLabel(m.created))}</span></div>` : "";
  const div = divider ? `<div class="sz-new" role="separator" id="szNewDiv"><span>${esc(t("comms.newMessages"))}</span></div>` : "";
  if (m.kind === "system") {
    const e = m.meta || {};
    if (e.event === "sos" && !m.deleted) return `${sep}${div}<div class="sz-sys sz-sos-card" data-id="${esc(m.id)}"><div class="sz-sos-h"><span class="live">SOS</span><b>${esc(t("comms.sosKind." + (e.sosKind || "other")))}</b><span class="dim small">${esc(m.authorName)} · <time datetime="${new Date(m.created).toISOString()}" title="${esc(fullTime(m.created))}">${esc(clock(m.created))}</time></span></div>${m.body ? `<p>${linkify(m.body)}</p>` : ""}<a class="link-btn" href="#rhr/sos">${esc(t("comms.sys.sosOpen"))}</a></div>`;
    return `${sep}${div}<div class="sz-sys" data-id="${esc(m.id)}"><span>${esc(sysText(m))} · <time datetime="${new Date(m.created).toISOString()}" title="${esc(fullTime(m.created))}">${esc(clock(m.created))}</time></span>${e.event === "video" ? ` <button class="link-btn" type="button" data-act="video">${esc(t("comms.sys.joinVideo"))}</button>` : ""}</div>`;
  }
  const grouped = !day && !divider && prev && prev.kind !== "system" && prev.author === m.author && m.created - prev.created < 5 * 60e3 && !m.reply;
  const canEdit = mine(m) && !m.deleted && Date.now() - m.created < (S.data ? S.data.editWindow : 9e5);
  const canDel = !m.deleted && (mine(m) || (S.cur && S.cur.access && S.cur.access.mod));
  const iso = new Date(m.created).toISOString();
  let body = "";
  if (m.deleted) body = `<p class="sz-deleted">${esc(t("comms.deleted"))}</p>`;
  else {
    if (m.meta && m.meta.title) body += `<p class="sz-thread"><b>${esc(m.meta.title)}</b> <span class="tag">${esc(t("comms.fromForum"))}</span></p>`;
    if (m.file && m.kind === "image") { const ar = m.meta && m.meta.w ? ` style="aspect-ratio:${m.meta.w}/${m.meta.h}"` : ""; body += `<button class="sz-img" type="button" data-full="${esc(m.file.url)}" aria-label="${esc(t("comms.enlarge"))}"${ar}><img src="${esc(m.file.url)}" alt="${esc(m.body || m.file.name || t("comms.image"))}" loading="lazy" decoding="async"></button>`; }
    if (m.file && m.kind === "voice") body += `<div class="sz-voice" data-src="${esc(m.file.url)}"><button class="sz-vplay" type="button" aria-label="${esc(t("comms.play"))}">${ic("play")}</button><input class="sz-vseek" type="range" min="0" max="1000" value="0" step="1" aria-label="${esc(t("comms.seek"))}"><span class="sz-vt num">${esc(dur(m.meta && m.meta.dur))}</span></div>`;
    if (m.file && m.kind === "file") body += `<a class="sz-filechip" href="${esc(m.file.url)}" download="${esc(m.file.name || "file")}">${ic("file")}<span><b>${esc(m.file.name || t("comms.file"))}</b><small>${esc(size(m.file.size))} · ${esc(t("comms.download"))}</small></span></a>`;
    if (m.body) body += `<p class="sz-text">${linkify(m.body)}</p>`;
  }
  const reply = m.reply ? `<a class="sz-quote" href="#" data-goto="${esc(m.reply.id)}"><b>${esc(m.reply.authorName)}</b><span>${esc(m.reply.deleted ? t("comms.deleted") : m.reply.snippet || (m.reply.kind === "voice" ? t("comms.voiceMsg") : m.reply.kind === "image" ? t("comms.image") : t("comms.file")))}</span></a>` : "";
  const acts = m.deleted ? "" : `<div class="sz-acts" role="toolbar" aria-label="${esc(t("comms.msgActions"))}">
      ${S.cur && S.cur.access && S.cur.access.post ? `<button type="button" data-act="reply" aria-label="${esc(t("comms.reply"))}" title="${esc(t("comms.reply"))}">${ic("reply")}</button>` : ""}
      ${canEdit && m.kind !== "voice" ? `<button type="button" data-act="edit" aria-label="${esc(t("comms.edit"))}" title="${esc(t("comms.edit"))}">${ic("edit")}</button>` : ""}
      ${canDel ? `<button type="button" data-act="del" aria-label="${esc(t("comms.delete"))}" title="${esc(t("comms.delete"))}">${ic("trash")}</button>` : ""}</div>`;
  return `${sep}${div}<article class="sz-msg${grouped ? " grp" : ""}${mine(m) ? " me" : ""}" data-id="${esc(m.id)}" data-author="${esc(m.author)}">
    <span class="sz-av" aria-hidden="true">${grouped ? "" : initial(m.authorName)}</span>
    <div class="sz-bodywrap">${grouped ? "" : `<header class="sz-mh"><b>${esc(m.authorName)}</b>${m.authorRole ? `<span class="sz-role">${esc(m.authorRole)}</span>` : ""}<time datetime="${iso}" title="${esc(fullTime(m.created))}">${esc(clock(m.created))}</time></header>`}
      ${reply}${body}${m.editedAt && !m.deleted ? `<span class="sz-edited" title="${esc(fullTime(m.editedAt))}">${esc(t("comms.edited"))}</span>` : ""}</div>
    ${grouped ? `<time class="sz-gt" datetime="${iso}" title="${esc(fullTime(m.created))}">${esc(clock(m.created))}</time>` : ""}${acts}</article>`;
}
function renderMsgs({ divider = false, keep = false } = {}){
  const C = S.cur, box = $("#szMsgs"); if (!box || !C) return;
  const fromBottom = box.scrollHeight - box.scrollTop;
  let divId = null;
  if (divider && C.lastRead) { const f = C.msgs.find(m => m.created > C.lastRead && !mine(m)); if (f) divId = f.id; }
  C.divId = divider ? divId : C.divId;
  const html = C.msgs.map((m, i) => msgHTML(m, C.msgs[i - 1], m.id === C.divId)).join("");
  box.innerHTML = (C.hasMore ? `<div class="sz-older"><button class="btn ghost small" type="button" data-act="older">${esc(t("comms.loadOlder"))}</button></div>` : "") +
    (C.msgs.length ? html : `<div class="sz-emptyroom"><p>${esc(t("comms.emptyRoom"))}</p></div>`) +
    (C.hasNewer ? `<div class="sz-older"><button class="btn ghost small" type="button" data-act="latest">${esc(t("comms.jumpLatest"))}</button></div>` : "");
  if (keep) box.scrollTop = box.scrollHeight - fromBottom;
}
const atBottom = () => { const b = $("#szMsgs"); return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 80; };
function scrollBottom(){
  const b = $("#szMsgs"); if (!b) return;
  const d = $("#szNewDiv", b);
  // ar „jaunas ziņas” atdalītāju: rāda to augšdaļā (lai redz jaunās ziņas), citādi — pašas beigas
  if (d && S.cur && S.cur.divId) b.scrollTop = Math.min(b.scrollHeight, b.scrollTop + d.getBoundingClientRect().top - b.getBoundingClientRect().top - 72);
  else b.scrollTop = b.scrollHeight;
  $("#szJump").hidden = atBottom();
}
function addMsg(m){
  const C = S.cur; if (!C || C.type !== "room" || m.room !== C.roomId || C.hasNewer) return;
  if (C.msgs.some(x => x.id === m.id)) return replaceMsg(m);
  const box = $("#szMsgs"), was = atBottom();
  const prev = C.msgs[C.msgs.length - 1];
  C.msgs.push(m);
  const empty = $(".sz-emptyroom", box); if (empty) empty.remove();
  box.insertAdjacentHTML("beforeend", msgHTML(m, prev, false));
  if (was || mine(m)) box.scrollTop = box.scrollHeight;
  else $("#szJump").hidden = false;
  delete C.typing[m.author]; paintTyping();
}
function replaceMsg(m){
  const C = S.cur; if (!C) return;
  const i = C.msgs.findIndex(x => x.id === m.id); if (i < 0) return;
  C.msgs[i] = m;
  const el = $(`.sz-msg[data-id="${CSS.escape(m.id)}"]`, main) || $(`.sz-sys[data-id="${CSS.escape(m.id)}"]`, main); if (!el) return;
  const tmp = document.createElement("div"); tmp.innerHTML = msgHTML(m, C.msgs[i - 1], false);
  const node = tmp.querySelector(".sz-msg, .sz-sys"); if (node) el.replaceWith(node);
  // atbildes uz šo ziņu: atjauno citātu
  C.msgs.forEach((x, k) => { if (x.reply && x.reply.id === m.id) { x.reply = { ...x.reply, deleted: m.deleted, snippet: m.deleted ? "" : (m.body || "").replace(/\s+/g, " ").slice(0, 140) }; replaceMsg(x); } });
}
async function loadOlder(){
  const C = S.cur; if (!C || !C.hasMore || C.loadingOlder) return;
  C.loadingOlder = true;
  try {
    const j = await WB.req(`/comms/rooms/${C.roomId}/messages?limit=50&before=${C.msgs[0].created}`);
    if (S.cur !== C) return;
    C.msgs = [...j.messages.filter(m => !C.msgs.some(x => x.id === m.id)), ...C.msgs]; C.hasMore = j.hasMore;
    renderMsgs({ keep: true });
  } catch (e) { toastErr(e); } finally { C.loadingOlder = false; }
}
function paintTyping(){
  const C = S.cur, el = $("#szTyping"); if (!el || !C) return;
  const now = Date.now(); for (const k in C.typing) if (now - C.typing[k].t > 4000) delete C.typing[k];
  const names = Object.values(C.typing).map(x => x.name);
  el.textContent = names.length === 1 ? t("comms.typing", { name: names[0] }) : names.length > 1 ? t("comms.typingMany") : "";
}

/* lasīšanas atzīme (tikai, ja saruna redzama un apakšā) */
let readT = null;
function markRead(C){
  clearTimeout(readT);
  readT = setTimeout(async () => {
    if (S.cur !== C || document.hidden || !atBottom()) return;
    const r = byId(C.roomId);
    if (r && !r.unread) return;
    try { await WB.req(`/comms/rooms/${C.roomId}/read`, { body: {} }); if (r) { r.unread = 0; renderSide(); paintUnread(); } } catch (e) {}
  }, 700);
}

/* ---------- WebSocket ---------- */
function closeWs(){ if (S.ws) { S.ws._closed = true; try { S.ws.close(); } catch (e) {} S.ws = null; } clearTimeout(S.wsRetry); clearInterval(S.wsPing); }
function connectWs(C, attempt = 0){
  if (S.cur !== C || !("WebSocket" in window)) return;
  const ws = new WebSocket(WB.wsUrl(`/comms/rooms/${C.roomId}/ws`)); S.ws = ws;
  const status = $("#szStatus");
  ws.onopen = () => {
    if (status) status.hidden = true;
    clearInterval(S.wsPing); S.wsPing = setInterval(() => { try { ws.send(JSON.stringify({ type: "ping", t: Date.now() })); } catch (e) {} }, 25000);
    if (attempt > 0) refreshLatest(C);
    attempt = 0;
  };
  ws.onmessage = ev => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    if (S.cur !== C) return;
    if (d.type === "message") {
      addMsg(d.message);
      if (!mine(d.message)) { if (document.hidden) ping(); markRead(C); }
    } else if (d.type === "edit") replaceMsg(d.message);
    else if (d.type === "delete") { const m = C.msgs.find(x => x.id === d.id); if (m) replaceMsg({ ...m, deleted: true, body: "", file: null, meta: {} }); }
    else if (d.type === "typing" && d.user && d.user.id !== WB.me.id) { C.typing[d.user.id] = { name: d.user.name, t: Date.now() }; paintTyping(); setTimeout(paintTyping, 4200); }
    else if (d.type === "hello" || d.type === "presence") { C.online = (d.online || []).filter(u => u.id !== WB.me.id); paintOnline(); }
    else if (d.type === "sos") { if (C.onSos) C.onSos(); loadRooms().catch(() => {}); }
    else if (d.type === "removed") { WB.toast(t("comms.removedFrom"), true); loadRooms().then(() => { location.hash = ""; }); }
  };
  ws.onclose = () => {
    clearInterval(S.wsPing);
    if (ws._closed || S.cur !== C) return;
    if (status) { status.hidden = false; status.textContent = t("comms.reconnecting"); }
    S.wsRetry = setTimeout(() => connectWs(C, attempt + 1), [1000, 2000, 5000, 10000, 20000][Math.min(attempt, 4)]);
  };
}
async function refreshLatest(C){
  if (C.around) return;
  try { const j = await WB.req(`/comms/rooms/${C.roomId}/messages?limit=50`); if (S.cur !== C) return; C.msgs = j.messages; C.hasMore = j.hasMore; const was = atBottom(); renderMsgs({ keep: !was }); if (was) scrollBottom(); } catch (e) {}
}

/* ---------- rakstīšana: Enter sūta, Shift+Enter jauna rinda, atbilde, labošana, pielikumi, balss ---------- */
function wireComposer(){
  const f = $("#szComposer"); if (!f) return;
  const ta = $("#szText", f);
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px"; };
  let lastTyping = 0;
  ta.addEventListener("input", () => { grow(); if (S.ws && S.ws.readyState === 1 && Date.now() - lastTyping > 2500 && ta.value.trim()) { lastTyping = Date.now(); try { S.ws.send('{"type":"typing"}'); } catch (e) {} } });
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isMobile()) { e.preventDefault(); f.requestSubmit(); }
    else if (e.key === "Escape") { if (S.cur.editing || S.cur.reply) { e.preventDefault(); clearChip(); } }
    else if (e.key === "ArrowUp" && !ta.value) {
      const last = [...S.cur.msgs].reverse().find(m => mine(m) && !m.deleted && m.kind !== "system" && m.kind !== "voice");
      if (last && Date.now() - last.created < S.data.editWindow) { e.preventDefault(); startEdit(last); }
    }
  });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const C = S.cur, body = ta.value.trim();
    if (!body) return;
    if (body.length > 4000) return WB.toast(t("err.too_long"), true);
    const btn = $(".sz-send", f); busy(btn, true);
    try {
      if (C.editing) { const j = await WB.req(`/comms/messages/${C.editing.id}`, { body: { body } }); replaceMsg(j.message); }
      else { const j = await WB.req(`/comms/rooms/${C.roomId}/messages`, { body: { body, replyTo: C.reply ? C.reply.id : undefined } }); addMsg(j.message); }
      ta.value = ""; grow(); clearChip();
    } catch (x) { toastErr(x); } finally { busy(btn, false); ta.focus(); }
  });
  f.addEventListener("click", e => {
    const a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "attach") $("#szFile", f).click();
    if (a.dataset.act === "rec") startRec();
    if (a.dataset.act === "recCancel") stopRec(false);
    if (a.dataset.act === "recSend") stopRec(true);
    if (a.dataset.act === "chipX") clearChip();
  });
  $("#szFile", f).addEventListener("change", async e => { const file = e.target.files[0]; e.target.value = ""; if (file) sendFile(file); });
  // ielīmēts attēls
  ta.addEventListener("paste", e => { const it = [...(e.clipboardData && e.clipboardData.files || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); sendFile(it); } });
}
function setChip(html){ const c = $("#szChip"); if (!c) return; c.innerHTML = `${html}<button class="icon-btn" type="button" data-act="chipX" aria-label="${esc(t("btn.cancel"))}">${ic("close")}</button>`; c.hidden = false; }
function clearChip(){ const C = S.cur; if (!C) return; const wasEdit = !!C.editing; C.reply = null; C.editing = null; const c = $("#szChip"); if (c) { c.hidden = true; c.innerHTML = ""; } if (wasEdit) { const ta = $("#szText"); if (ta) { ta.value = ""; ta.style.height = "auto"; } } }
function startReply(m){ const C = S.cur; C.editing = null; C.reply = m; setChip(`${ic("reply")}<span><b>${esc(t("comms.replyingTo", { name: m.authorName }))}</b><span class="dim">${esc((m.body || (m.kind === "voice" ? t("comms.voiceMsg") : m.kind === "image" ? t("comms.image") : t("comms.file"))).slice(0, 120))}</span></span>`); $("#szText").focus(); }
function startEdit(m){ const C = S.cur; C.reply = null; C.editing = m; setChip(`${ic("edit")}<span><b>${esc(t("comms.editing"))}</b><span class="dim">${esc(t("err.edit_window"))}</span></span>`); const ta = $("#szText"); ta.value = m.body; ta.dispatchEvent(new Event("input")); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
async function sendFile(file){
  const C = S.cur; if (!C || C.type !== "room") return;
  const isImg = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (!isImg && file.type !== "application/pdf") return WB.toast(t("err.type"), true);
  WB.toast(t("comms.uploading"));
  try {
    let f = file, w, h;
    if (isImg) { f = await WB.shrinkImage(file, 1600); [w, h] = await imgSize(f); }
    const up = await WB.upload(f, "chat", C.roomId);
    const ta = $("#szText"), body = ta ? ta.value.trim().slice(0, 4000) : "";
    const j = await WB.req(`/comms/rooms/${C.roomId}/messages`, { body: { body, fileId: up.id, w, h, replyTo: C.reply ? C.reply.id : undefined } });
    if (ta) { ta.value = ""; ta.style.height = "auto"; } clearChip();
    addMsg(j.message);
  } catch (e) { toastErr(e); }
}
const imgSize = f => new Promise(res => { const i = new Image(), u = URL.createObjectURL(f); i.onload = () => { res([i.naturalWidth, i.naturalHeight]); URL.revokeObjectURL(u); }; i.onerror = () => res([undefined, undefined]); i.src = u; });

/* balss ziņa: MediaRecorder (Opus WebM; Safari — MP4/AAC), līdz 2 min, bez automātiskas atskaņošanas */
const REC = { mr: null, chunks: [], t0: 0, timer: null, stream: null, mime: "" };
async function startRec(){
  if (!window.MediaRecorder || !navigator.mediaDevices) return WB.toast(t("comms.voiceUnsupported"), true);
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
  try { REC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { return WB.toast(t("comms.micDenied"), true); }
  REC.chunks = []; REC.mime = mime;
  REC.mr = new MediaRecorder(REC.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
  REC.mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.mr.start(1000); REC.t0 = Date.now();
  $("#szRec").hidden = false; $("#szRow").hidden = true;
  const tick = () => { const s = (Date.now() - REC.t0) / 1000; const el = $("#szRecT"); if (el) el.textContent = dur(s); if (s >= 120) { WB.toast(t("comms.voiceMax")); stopRec(true); } };
  REC.timer = setInterval(tick, 250); tick();
}
function stopRec(send){
  if (!REC.mr) return;
  clearInterval(REC.timer);
  const secs = (Date.now() - REC.t0) / 1000, C = S.cur, mr = REC.mr;
  REC.mr = null;
  mr.onstop = async () => {
    REC.stream.getTracks().forEach(tr => tr.stop());
    const rec = $("#szRec"), row = $("#szRow"); if (rec) rec.hidden = true; if (row) row.hidden = false;
    if (!send || secs < .6 || S.cur !== C) return;
    const type = (mr.mimeType || REC.mime || "audio/webm").split(";")[0];
    const blob = new Blob(REC.chunks, { type });
    const file = new File([blob], `balss-${Date.now()}.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`, { type });
    WB.toast(t("comms.uploading"));
    try {
      const up = await WB.upload(file, "chat", C.roomId);
      const j = await WB.req(`/comms/rooms/${C.roomId}/messages`, { body: { body: "", fileId: up.id, duration: Math.min(120, secs), replyTo: C.reply ? C.reply.id : undefined } });
      clearChip(); addMsg(j.message);
    } catch (e) { toastErr(e); }
  };
  try { mr.stop(); } catch (e) {}
}

/* balss atskaņotājs (minimāls, bez automātiskas atskaņošanas) */
let playing = null;
function voice(el){
  let a = el._a;
  if (!a) {
    a = el._a = new Audio(); a.preload = "metadata"; a.src = el.dataset.src;
    const seek = $(".sz-vseek", el), tm = $(".sz-vt", el), btn = $(".sz-vplay", el), total = tm.textContent;
    a.addEventListener("timeupdate", () => { const d = isFinite(a.duration) ? a.duration : 0; if (d) seek.value = Math.round(a.currentTime / d * 1000); tm.textContent = dur(a.currentTime); });
    a.addEventListener("play", () => { btn.innerHTML = ic("pause"); btn.setAttribute("aria-label", t("comms.pause")); el.classList.add("on"); });
    const reset = () => { btn.innerHTML = ic("play"); btn.setAttribute("aria-label", t("comms.play")); el.classList.remove("on"); };
    a.addEventListener("pause", reset);
    a.addEventListener("ended", () => { reset(); seek.value = 0; tm.textContent = total; });
    seek.addEventListener("input", () => { const d = isFinite(a.duration) ? a.duration : 0; if (d) a.currentTime = seek.value / 1000 * d; });
  }
  return a;
}

/* klikšķi sarunā */
main.addEventListener("click", async e => {
  const C = S.cur;
  if (e.target.closest("[data-ract=sos]")) return sosDialog();
  const vp = e.target.closest(".sz-vplay");
  if (vp) { const el = vp.closest(".sz-voice"), a = voice(el); if (a.paused) { if (playing && playing !== a) playing.pause(); playing = a; a.play().catch(() => WB.toast(t("err.generic"), true)); } else a.pause(); return; }
  const img = e.target.closest(".sz-img");
  if (img) { WB.modal({ title: t("comms.image"), wide: true, body: `<img class="sz-full" src="${esc(img.dataset.full)}" alt="${esc(img.querySelector("img").alt)}">`, actions: [{ label: t("comms.download"), value: "dl" }, { label: t("btn.close"), value: "", primary: true }] }).then(v => { if (v === "dl") { const a = document.createElement("a"); a.href = img.dataset.full; a.download = ""; a.click(); } }); return; }
  const q = e.target.closest("[data-goto]");
  if (q) { e.preventDefault(); const el = $(`[data-id="${CSS.escape(q.dataset.goto)}"]`, main); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl"); } else location.hash = `m/${C.roomId}/${q.dataset.goto}`; return; }
  const a = e.target.closest("[data-act]");
  // skārienekrāni: pieskāriens ziņai parāda tās darbības
  if (!a && matchMedia("(hover: none)").matches) { const msg = e.target.closest(".sz-msg"); $$(".sz-msg.tap", main).forEach(x => x !== msg && x.classList.remove("tap")); if (msg && !e.target.closest("a,button,input")) msg.classList.toggle("tap"); }
  if (!a || !C) return;
  const act = a.dataset.act, mel = a.closest("[data-id]"), m = mel && C.msgs ? C.msgs.find(x => x.id === mel.dataset.id) : null;
  if (act === "older") return loadOlder();
  if (act === "latest") { location.hash = C.key.replace(/^#/, ""); return route(); }
  if (act === "info") return setInfoOpen(info.hidden, true);
  if (act === "video") return startVideo(a);
  if (act === "reply" && m) return startReply(m);
  if (act === "edit" && m) return startEdit(m);
  if (act === "del" && m) {
    const mod = !mine(m);
    if (!(await WB.confirm(t("comms.confirmDelete"), mod ? t("comms.confirmModDelete") : t("comms.confirmDeleteText"), t("comms.delete")))) return;
    try { await WB.req(`/comms/messages/${m.id}`, { method: "DELETE" }); replaceMsg({ ...m, deleted: true, body: "", file: null, meta: {} }); } catch (x) { toastErr(x); }
  }
});
main.addEventListener("scroll", e => {
  if (e.target.id !== "szMsgs") return;
  if (e.target.scrollTop < 60 && S.cur && S.cur.hasMore) loadOlder();
  if (atBottom()) { $("#szJump").hidden = true; if (S.cur) markRead(S.cur); }
}, true);
main.addEventListener("click", e => { if (e.target.closest("#szJump")) { const b = $("#szMsgs"); b.scrollTop = b.scrollHeight; } });

/* ---------- videozvans ---------- */
async function startVideo(btn){
  const C = S.cur; if (!C || !C.roomId) return;
  // logs tiek atvērts uzreiz (lai pārlūks nebloķētu), saite — pēc servera atbildes
  const w = C.video ? null : window.open("", "_blank");
  try {
    busy(btn, true);
    const j = await WB.req(`/comms/rooms/${C.roomId}/video`, { body: {} });
    C.video = j.url;
    if (w) { try { w.opener = null; w.location.href = j.url; } catch (e) { window.open(j.url, "_blank", "noopener"); } }
    else window.open(j.url, "_blank", "noopener");
    renderInfo();
  } catch (e) { if (w) w.close(); toastErr(e); } finally { busy(btn, false); }
}

/* ---------- informācijas panelis ---------- */
function setInfoOpen(open, remember){
  info.hidden = !open; app.classList.toggle("info-open", open);
  const b = $(".sz-infobtn", main); if (b) b.setAttribute("aria-expanded", open);
  if (remember && !isMobile()) LS.set("wb-comms-info", open ? "1" : "0");
  if (open) renderInfo();
}
function paintOnline(){
  const el = $("#szOnline"); if (!el || !S.cur) return;
  const on = S.cur.online || [];
  el.innerHTML = on.length ? on.map(u => `<li><span class="sz-av small">${initial(u.name)}</span>${esc(u.name)}<span class="sz-on" aria-hidden="true"></span></li>`).join("") : `<li class="dim small">${esc(t("comms.nobodyOnline"))}</li>`;
}
function renderInfo(){
  const C = S.cur; if (info.hidden || !C || !C.room) return;
  const r = byId(C.roomId) || C.room, a = C.access || {};
  const members = C.membersList || r.members || [];
  const canPost = a.post;
  info.innerHTML = `<div class="sz-info-head"><h2>${esc(t("comms.about"))}</h2><button class="icon-btn" type="button" data-act="closeInfo" aria-label="${esc(t("comms.closeInfo"))}">${ic("close")}</button></div>
    <div class="sz-info-body">
      <section><h3 class="sz-ih">${esc(roomName(r))}</h3>${L(r.description) ? `<p class="small muted">${esc(L(r.description))}</p>` : ""}
        <p class="small"><span class="sz-ilabel">${esc(t("comms.access"))}</span> ${r.kind === "channel" ? `${r.locked ? ic("lock") + " " : ""}${esc(r.minRole ? t("comms.accessFrom", { role: r.minRole }) : "")}` : esc(t("comms.accessPrivate"))}</p></section>
      ${canPost ? `<section><h3 class="sz-ih">${esc(t("comms.video"))}</h3><p class="small muted">${esc(t("comms.videoText"))}</p>
        <div class="btn-row"><button class="btn small" type="button" data-act="video">${ic("video")}${esc(C.video ? t("comms.videoJoin") : t("comms.videoStart"))}</button>${C.video ? `<button class="btn ghost small" type="button" data-act="copyVideo">${esc(t("comms.videoCopy"))}</button>` : ""}</div>
        <p class="hint">${esc(t("comms.videoNote"))}</p></section>` : ""}
      <section><h3 class="sz-ih">${esc(t("comms.notify"))}</h3>
        <label class="check"><input type="checkbox" data-act="mute"${r.muted ? " checked" : ""}><span>${esc(t("comms.muteRoom"))}</span></label><p class="hint">${esc(t("comms.muteHint"))}</p>
        <label class="check"><input type="checkbox" data-act="soundBox"${S.sound ? " checked" : ""}><span>${esc(t("comms.sound"))}</span></label><p class="hint">${esc(t("comms.soundHint"))}</p></section>
      ${r.kind !== "channel" ? `<section><h3 class="sz-ih">${esc(t("comms.members"))} <span class="dim">${members.length}</span></h3><ul class="sz-people">${members.map(m => `<li><span class="sz-av small">${initial(m.name)}</span><span><span>${esc(m.name)}${m.id === WB.me.id ? ` <span class="dim">(${esc(t("comms.youShort"))})</span>` : ""}</span><small>${esc(m.roleName || "")}${m.owner ? " · " + esc(t("comms.owner")) : ""}</small></span>${r.kind === "group" && a.owner && m.id !== WB.me.id ? `<button class="link-btn small" type="button" data-act="kick" data-user="${esc(m.id)}" data-name="${esc(m.name)}">${esc(t("comms.remove"))}</button>` : ""}</li>`).join("")}</ul>
        ${r.kind === "group" ? `<div class="btn-row">${a.owner ? `<button class="btn ghost small" type="button" data-act="addMembers">${ic("plus")}${esc(t("comms.addMembers"))}</button><button class="btn ghost small" type="button" data-act="rename">${esc(t("comms.rename"))}</button>` : ""}<button class="btn ghost small" type="button" data-act="leave">${esc(t("comms.leave"))}</button></div>` : ""}</section>` : ""}
      <section><h3 class="sz-ih">${esc(t("comms.onlineNow"))}</h3><ul class="sz-people" id="szOnline"></ul></section>
    </div>`;
  paintOnline();
}
info.addEventListener("click", async e => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  const C = S.cur, act = a.dataset.act;
  try {
    if (act === "closeInfo") setInfoOpen(false, true);
    if (act === "video") startVideo(a);
    if (act === "copyVideo" && C.video) { await navigator.clipboard.writeText(C.video); WB.toast(t("comms.copied")); }
    if (act === "leave") { const r = byId(C.roomId); if (await WB.confirm(t("comms.leave"), t("comms.leaveConfirm", { name: roomName(r) }), t("comms.leave"))) { await WB.req(`/comms/rooms/${C.roomId}/leave`, { body: {} }); await loadRooms(); location.hash = ""; } }
    if (act === "kick" && await WB.confirm(t("comms.remove"), t("comms.removeConfirm", { name: a.dataset.name }), t("comms.remove"))) { await WB.req(`/comms/rooms/${C.roomId}/members`, { body: { remove: [a.dataset.user] } }); await reloadRoomInfo(); }
    if (act === "addMembers") groupDialog(byId(C.roomId));
    if (act === "rename") { const r = byId(C.roomId); const v = await WB.prompt(t("comms.rename"), `<label class="field"><span>${esc(t("comms.groupName"))}</span><input type="text" name="name" maxlength="60" minlength="2" required value="${esc(roomName(r))}"></label>`, t("btn.save")); if (v && v.name.trim()) { await WB.req(`/comms/rooms/${C.roomId}`, { body: { name: v.name.trim() } }); await loadRooms(); route(); } }
  } catch (x) { toastErr(x); }
});
info.addEventListener("change", async e => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  if (a.dataset.act === "soundBox") { if (a.checked !== S.sound) toggleSound(); }
  if (a.dataset.act === "mute") {
    try { await WB.req(`/comms/rooms/${S.cur.roomId}/mute`, { body: { muted: a.checked } }); const r = byId(S.cur.roomId); if (r) r.muted = a.checked; renderSide(); paintUnread(); WB.toast(t("comms.saved")); } catch (x) { a.checked = !a.checked; toastErr(x); }
  }
});
async function reloadRoomInfo(){ const C = S.cur; const ri = await WB.req(`/comms/rooms/${C.roomId}`); C.membersList = ri.members; await loadRooms(); renderInfo(); }

/* ---------- grupas un privātās sarunas ---------- */
async function members(){ if (!S.members) S.members = (await WB.req("/comms/members")).members; return S.members; }
function memberPicker(list, { multi, exclude = [] }){
  return `<label class="field"><span>${esc(t("comms.findMember"))}</span><input type="search" data-filter autocomplete="off"></label>
    <ul class="sz-pick" role="list">${list.filter(m => !m.me && !exclude.includes(m.id)).map(m => `<li data-name="${esc(m.name.toLowerCase())}"><label class="${multi ? "check" : "sz-pick-one"}">${multi ? `<input type="checkbox" name="m" value="${esc(m.id)}">` : `<input type="radio" name="m" value="${esc(m.id)}">`}<span class="sz-av small">${initial(m.name)}</span><span>${esc(m.name)} <small class="dim">${esc(m.roleName || "")}</small></span></label></li>`).join("")}</ul>
    <p class="sz-none" data-none hidden>${esc(t("comms.noMembers"))}</p>`;
}
const wirePicker = d => { const f = d.querySelector("[data-filter]"); f && f.addEventListener("input", () => { const v = f.value.trim().toLowerCase(); let n = 0; d.querySelectorAll(".sz-pick li").forEach(li => { const s = li.dataset.name.includes(v); li.hidden = !s; if (s) n++; }); d.querySelector("[data-none]").hidden = n > 0; }); f && f.focus(); };
async function dmDialog(){
  try {
    const list = await members();
    const v = await WB.modal({ title: t("comms.newDm"), body: `<div class="form">${memberPicker(list, { multi: false })}</div>`, actions: [{ label: t("btn.cancel"), value: "" }, { label: t("comms.startDm"), value: "ok", primary: true }], onOpen: wirePicker });
    if (v !== "ok") return;
    const id = WB.lastModalData.m; if (!id) return WB.toast(t("comms.pickOne"), true);
    location.hash = "dm/" + id;
  } catch (e) { toastErr(e); }
}
async function groupDialog(existing){
  try {
    const list = await members();
    const ex = existing ? (S.cur.membersList || []).map(m => m.id) : [];
    const body = `<div class="form">${existing ? "" : `<label class="field"><span>${esc(t("comms.groupName"))}</span><input type="text" name="name" maxlength="60" minlength="2" required></label>`}
      <p class="hint">${esc(t("comms.pickHint"))}</p>${memberPicker(list, { multi: true, exclude: ex })}</div>`;
    const v = await WB.modal({ title: existing ? t("comms.addMembers") : t("comms.newGroup"), body, actions: [{ label: t("btn.cancel"), value: "" }, { label: existing ? t("comms.saveGroup") : t("comms.createGroup"), value: "ok", primary: true }],
      onOpen: d => { wirePicker(d); const f = d.querySelector("form"); f.addEventListener("submit", ev => { if (ev.submitter && ev.submitter.value === "ok") { if (!f.reportValidity()) ev.preventDefault(); else W_ids = [...f.querySelectorAll("input[name=m]:checked")].map(x => x.value); } }); } });
    if (v !== "ok") return;
    const ids = W_ids || []; W_ids = null;
    if (!ids.length) return WB.toast(t("comms.pickOne"), true);
    if (existing) { await WB.req(`/comms/rooms/${existing.id}/members`, { body: { add: ids } }); await reloadRoomInfo(); }
    else { const j = await WB.req("/comms/rooms", { body: { name: WB.lastModalData.name, members: ids } }); await loadRooms(); location.hash = "g/" + j.id; }
  } catch (e) { toastErr(e); }
}
let W_ids = null;

/* ---------- meklēšana ---------- */
function hl(s, q){
  const txt = String(s || ""), lo = txt.toLocaleLowerCase(WB.locale), ql = q.toLocaleLowerCase(WB.locale);
  let out = "", i = 0, k;
  while (ql && (k = lo.indexOf(ql, i)) >= 0) { out += esc(txt.slice(i, k)) + "<mark>" + esc(txt.slice(k, k + q.length)) + "</mark>"; i = k + q.length; }
  return out + esc(txt.slice(i));
}
async function showSearch(qRaw){
  const q = decodeURIComponent(qRaw || "").trim();
  S.cur = { type: "search", key: "#search", q };
  info.hidden = true; app.classList.remove("info-open");
  main.innerHTML = `${head(t("comms.searchTitle", { q }), "", "", "search")}<div class="sz-scroll"><div class="sz-loading">${esc(t("comms.loading"))}</div></div>`;
  const j = await WB.req("/comms/search?q=" + encodeURIComponent(q));
  const box = $(".sz-scroll", main);
  box.innerHTML = j.results.length ? `<p class="small dim sz-pad">${esc(tp("comms.searchCount", j.results.length))}</p><ul class="rows sz-results">${j.results.map(r => {
    const name = r.roomKind === "dm" ? L(r.roomName) : "# " + L(r.roomName);
    const snippet = r.body.length > 220 ? (() => { const k = r.body.toLocaleLowerCase(WB.locale).indexOf(q.toLocaleLowerCase(WB.locale)); const s = Math.max(0, k - 80); return (s ? "…" : "") + r.body.slice(s, s + 220) + "…"; })() : r.body;
    return `<li><a href="#m/${esc(r.room)}/${esc(r.id)}"><span class="sz-res-h"><b>${esc(name)}</b><span class="dim small">${esc(r.authorName)} · ${esc(when(r.created))}</span></span><span class="sz-res-b">${r.file && !r.body ? esc(r.file.name) : hl(snippet, q)}</span></a></li>`;
  }).join("")}</ul>` : `<div class="sz-blank"><div class="empty"><p>${esc(t("comms.searchNone"))}</p></div></div>`;
}

/* ---------- norīkojumi ---------- */
async function rolesList(){ if (!S.roles) S.roles = (await WB.req("/admin/roles")).roles.filter(r => r.level <= (S.data.me.level || 0)).sort((a, b) => a.level - b.level); return S.roles; }
async function showOrders(id){
  info.hidden = true; app.classList.remove("info-open");
  const arch = id === "archive";
  S.cur = { type: "orders", key: "#orders" };
  const j = await WB.req("/comms/orders" + (arch ? "?status=archived" : ""));
  if (S.data.orders) S.data.orders.unread = 0; paintUnread();
  const sel = !arch && id ? j.orders.find(o => o.id === id) : null;
  if (id && !arch && !sel) { const one = await WB.req(`/comms/orders/${id}`); j.orders.push(one.order); return showOrderDetail(one.order, j); }
  if (sel) return showOrderDetail(sel, j);
  main.innerHTML = `${head(t("comms.orders"), esc(t("comms.ordersLead")), j.canCreate ? `<button class="btn small" type="button" data-oact="new">${ic("plus")}${esc(t("comms.newOrder"))}</button>` : "", "orders")}
    <div class="sz-scroll"><div class="sz-pad"><div class="tabs" role="tablist"><a href="#orders" role="tab" aria-selected="${!arch}">${esc(t("comms.showActive"))}</a><a href="#orders/archive" role="tab" aria-selected="${arch}">${esc(t("comms.showArchived"))}</a></div></div>
    ${j.orders.length ? `<ul class="rows sz-orders">${j.orders.map(o => `<li><a href="#orders/${esc(o.id)}"><span class="sz-o-t"><b>${esc(o.title)}</b>${o.status === "archived" ? `<span class="badge">${esc(t("comms.statusArchived"))}</span>` : ""}</span>
      <span class="sz-o-m"><span class="badge">${esc(t("comms.audienceFrom", { role: o.audienceRole || o.audienceMinLevel }))}</span><span class="dim small">${esc(t("comms.updatedBy", { name: o.updatedByName }))} · ${esc(when(o.updated))}</span></span>
      <span class="sz-o-b">${esc(o.body.replace(/\s+/g, " ").slice(0, 160))}</span></a></li>`).join("")}</ul>` : `<div class="sz-blank"><div class="empty"><p>${esc(t(arch ? "comms.noOrdersArchived" : "comms.noOrders"))}</p>${j.canCreate && !arch ? `<button class="btn small" type="button" data-oact="new">${esc(t("comms.newOrder"))}</button>` : ""}</div></div>`}</div>`;
  wireOrders(j);
}
function showOrderDetail(o, j){
  S.cur = { type: "orders", key: "#orders", order: o };
  main.innerHTML = `${head(t("comms.orders"), "", o.canEdit ? `<button class="btn ghost small" type="button" data-oact="edit">${ic("edit")}${esc(t("comms.edit"))}</button>` : "", "orders")}
    <div class="sz-scroll"><article class="sz-doc">
      <p class="sz-crumb"><a href="#orders">${esc(t("comms.orders"))}</a></p>
      <h3 class="sz-doc-t">${esc(o.title)}</h3>
      <p class="sz-doc-m"><span class="badge">${esc(t("comms.audienceFrom", { role: o.audienceRole || o.audienceMinLevel }))}</span>${o.status === "archived" ? `<span class="badge">${esc(t("comms.statusArchived"))}</span>` : `<span class="badge ok">${esc(t("comms.statusActive"))}</span>`}
        <span class="dim small">${esc(t("comms.createdBy", { name: o.createdByName }))} · ${esc(fullTime(o.created))}</span></p>
      <div class="sz-doc-b">${linkify(o.body)}</div>
      <section class="sz-hist"><h4>${ic("history")} ${esc(t("comms.history"))}</h4><ol class="sz-hist-l" id="szHist"><li class="dim small">${esc(t("comms.loading"))}</li></ol></section>
    </article></div>`;
  wireOrders(j);
  WB.req(`/comms/orders/${o.id}/history`).then(h => {
    const el = $("#szHist"); if (!el) return;
    el.innerHTML = h.history.map(x => `<li><span class="sz-hist-h"><b>${esc(x.byName)}</b> <span class="dim small">${esc(fullTime(x.at))}</span></span>
      <span class="small">${x.before ? esc(t("comms.historyChanged", { fields: Object.keys(x.after).map(k => t("comms.field." + k)).join(", ") })) : esc(t("comms.historyCreated"))}</span>
      ${x.before ? `<details><summary class="small">${esc(t("adm.show"))}</summary><dl class="sz-diff">${Object.keys(x.after).map(k => `<dt>${esc(t("comms.field." + k))}</dt><dd><del>${esc(fmtField(k, x.before[k]))}</del><ins>${esc(fmtField(k, x.after[k]))}</ins></dd>`).join("")}</dl></details>` : ""}</li>`).join("");
  }).catch(() => {});
}
const fmtField = (k, v) => k === "status" ? t(v === "archived" ? "comms.statusArchived" : "comms.statusActive") : k === "audience_min_level" ? ((S.roles || []).find(r => r.level >= v) || {}).name || String(v) : String(v ?? "");
function wireOrders(j){
  main.onclick = null;
  $$("[data-oact]", main).forEach(b => b.addEventListener("click", async () => {
    const o = b.dataset.oact === "edit" ? S.cur.order : null;
    try {
      const roles = await rolesList();
      const v = await WB.prompt(o ? t("comms.editOrder") : t("comms.newOrder"),
        `<label class="field"><span>${esc(t("comms.orderTitle"))}</span><input type="text" name="title" maxlength="160" minlength="3" required value="${esc(o ? o.title : "")}"></label>
         <label class="field"><span>${esc(t("comms.orderBody"))}</span><textarea name="body" rows="8" maxlength="8000" required>${esc(o ? o.body : "")}</textarea></label>
         <div class="two"><label class="field"><span>${esc(t("comms.audience"))}</span><select name="aud">${roles.map(r => `<option value="${r.level}"${(o ? o.audienceMinLevel : 50) === r.level ? " selected" : ""}>${esc(t("comms.audienceFrom", { role: r.name }))}</option>`).join("")}</select></label>
         <label class="field"><span>${esc(t("comms.status"))}</span><select name="status"><option value="active">${esc(t("comms.statusActive"))}</option><option value="archived"${o && o.status === "archived" ? " selected" : ""}>${esc(t("comms.statusArchived"))}</option></select></label></div>
         <p class="hint">${esc(t("comms.audienceHint"))}</p>`, t("comms.saveOrder"));
      if (!v) return;
      const body = { title: v.title, body: v.body, audienceMinLevel: +v.aud, status: v.status };
      if (o) { await WB.req(`/comms/orders/${o.id}`, { body }); WB.toast(t("comms.saved")); showOrders(o.id); }
      else { const r = await WB.req("/comms/orders", { body }); WB.toast(t("comms.saved")); location.hash = "orders/" + r.id; }
    } catch (x) { toastErr(x); }
  }));
}

/* ---------- idejas ---------- */
const IST = { new: "", reviewed: "warn", approved: "ok", archived: "" };
const istBadge = s => `<span class="badge sz-ist ${IST[s] || ""}">${esc(t("comms.ist." + s))}</span>`;
async function showIdeas(id){
  info.hidden = true; app.classList.remove("info-open");
  const filt = S.ideaFilter || "";
  S.cur = { type: "ideas", key: "#ideas" };
  if (id) return showIdea(id);
  const j = await WB.req("/comms/ideas" + (filt ? "?status=" + filt : ""));
  if (S.data.ideas) S.data.ideas.unread = 0; renderSide();
  main.innerHTML = `${head(t("comms.ideas"), esc(t("comms.ideasLead")), j.canCreate ? `<button class="btn small" type="button" data-iact="new">${ic("plus")}${esc(t("comms.newIdea"))}</button>` : "", "idea")}
    <div class="sz-scroll"><div class="sz-pad"><div class="chips" role="group" aria-label="${esc(t("comms.status"))}">${["", "new", "reviewed", "approved", "archived"].map(s => `<button class="chip${s === filt ? " on" : ""}" type="button" data-filt="${s}" aria-pressed="${s === filt}">${esc(t("comms.ist." + (s || "all")))}</button>`).join("")}</div></div>
    ${j.ideas.length ? `<ul class="rows sz-ideas">${j.ideas.map(i => `<li><a href="#ideas/${esc(i.id)}"><span class="sz-o-t"><b>${esc(i.title)}</b>${istBadge(i.status)}</span>
      <span class="sz-o-m"><span class="tag">${esc(t("comms.topic." + i.topic))}</span><span class="dim small">${esc(i.authorName)} · ${esc(when(i.created))} · ${esc(tp("comms.nComments", i.comments))}</span></span>
      <span class="sz-o-b">${esc(i.body.replace(/\s+/g, " ").slice(0, 160))}</span></a></li>`).join("")}</ul>` : `<div class="sz-blank"><div class="empty"><p>${esc(t(filt ? "comms.noIdeasFilter" : "comms.noIdeas"))}</p>${j.canCreate && !filt ? `<button class="btn small" type="button" data-iact="new">${esc(t("comms.newIdea"))}</button>` : ""}</div></div>`}</div>`;
  $$("[data-filt]", main).forEach(b => b.addEventListener("click", () => { S.ideaFilter = b.dataset.filt; showIdeas(); }));
  $$("[data-iact=new]", main).forEach(b => b.addEventListener("click", newIdea));
}
async function newIdea(){
  const v = await WB.prompt(t("comms.newIdea"), `<label class="field"><span>${esc(t("comms.ideaTitle"))}</span><input type="text" name="title" maxlength="160" minlength="3" required></label>
    <label class="field"><span>${esc(t("comms.topic"))}</span><select name="topic">${["idea", "plan", "suggestion", "visit"].map(x => `<option value="${x}">${esc(t("comms.topic." + x))}</option>`).join("")}</select></label>
    <label class="field"><span>${esc(t("comms.ideaBody"))}</span><textarea name="body" rows="6" maxlength="4000" required></textarea></label>`, t("comms.saveIdea"));
  if (!v) return;
  try { const r = await WB.req("/comms/ideas", { body: v }); location.hash = "ideas/" + r.id; } catch (x) { toastErr(x); }
}
async function showIdea(id){
  const [j, c] = await Promise.all([WB.req(`/comms/ideas/${id}`), WB.req(`/comms/ideas/${id}/comments`)]);
  const i = j.idea;
  S.cur = { type: "ideas", key: "#ideas", idea: i };
  main.innerHTML = `${head(t("comms.ideas"), "", "", "idea")}
    <div class="sz-scroll"><article class="sz-doc">
      <p class="sz-crumb"><a href="#ideas">${esc(t("comms.ideas"))}</a></p>
      <h3 class="sz-doc-t">${esc(i.title)}</h3>
      <p class="sz-doc-m">${istBadge(i.status)}<span class="tag">${esc(t("comms.topic." + i.topic))}</span><span class="dim small">${esc(i.authorName)} · ${esc(fullTime(i.created))}</span></p>
      <div class="sz-doc-b">${linkify(i.body)}</div>
      ${j.canStatus ? `<form class="sz-status-form" id="ideaStatus"><label class="field"><span>${esc(t("comms.changeStatus"))}</span><select name="status">${["new", "reviewed", "approved", "archived"].map(s => `<option value="${s}"${s === i.status ? " selected" : ""}>${esc(t("comms.ist." + s))}</option>`).join("")}</select></label>
        <label class="field grow"><span>${esc(t("comms.statusNote"))}</span><input type="text" name="note" maxlength="2000"></label><button class="btn small">${esc(t("btn.save"))}</button></form>` : ""}
      <section class="sz-comments"><h4>${esc(t("comms.comments"))}</h4>
        ${c.comments.length ? `<ol class="sz-cl">${c.comments.map(x => x.kind === "status" ? `<li class="sz-c-sys">${esc(t("comms.statusChanged", { who: x.authorName, from: t("comms.ist." + x.status.from), to: t("comms.ist." + x.status.to) }))}${x.status.note ? ` — „${esc(x.status.note)}”` : ""} <span class="dim">· ${esc(when(x.created))}</span></li>`
          : `<li><span class="sz-av small" aria-hidden="true">${initial(x.authorName)}</span><div><p class="sz-c-h"><b>${esc(x.authorName)}</b> <span class="dim small">${esc(when(x.created))}</span></p><p class="sz-text">${linkify(x.body)}</p></div></li>`).join("")}</ol>` : `<p class="dim small">${esc(t("comms.noComments"))}</p>`}
        ${j.canComment ? `<form class="form sz-cform" id="ideaComment"><label class="sr-only" for="ideaC">${esc(t("comms.addComment"))}</label><textarea id="ideaC" name="body" rows="3" maxlength="2000" required placeholder="${esc(t("comms.commentPh"))}"></textarea><div><button class="btn small">${esc(t("comms.addComment"))}</button></div></form>` : ""}
      </section></article></div>`;
  const sf = $("#ideaStatus"), cf = $("#ideaComment");
  sf && sf.addEventListener("submit", async e => { e.preventDefault(); try { await WB.req(`/comms/ideas/${id}/status`, { body: { status: sf.status.value, note: sf.note.value } }); WB.toast(t("comms.saved")); showIdea(id); } catch (x) { toastErr(x); } });
  cf && cf.addEventListener("submit", async e => { e.preventDefault(); try { await WB.req(`/comms/ideas/${id}/comments`, { body: { body: cf.body.value } }); showIdea(id); } catch (x) { toastErr(x); } });
}

/* ---------- Riders Help Riders: saruna + SOS dēlis + palīdzības punkti ---------- */
const OFFERS = ["tools", "garage", "trailer", "bed", "parts", "tow"];
const SOS_KINDS = ["tyre", "battery", "fuel", "crash", "breakdown", "other"];
let myPos = null;
const getPos = () => new Promise((res, rej) => { if (!navigator.geolocation) return rej(new Error("geo")); navigator.geolocation.getCurrentPosition(p => res(myPos = [p.coords.latitude, p.coords.longitude]), rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }); });
function rhrTabs(tab){
  const d = S.data || {};
  return { head: head(t("comms.rhr"), esc(t("comms.rhrLead")), `<button class="btn danger small" type="button" data-ract="sos" aria-label="${esc(t("comms.askHelp"))}">${ic("sos")}<span class="sz-hide-m">${esc(t("comms.askHelp"))}</span><span class="sz-show-m" aria-hidden="true">SOS</span></button>${tab === "talk" ? `<button class="icon-btn sz-infobtn" type="button" data-act="info" aria-label="${esc(t("comms.info"))}">${ic("info")}</button>` : ""}`, "hands"),
    bar: `<nav class="tabs sz-tabs" aria-label="${esc(t("comms.rhr"))}"><a href="#rhr"${tab === "talk" ? ' aria-current="page"' : ""}>${esc(t("comms.rhrTalk"))}</a><a href="#rhr/sos"${tab === "sos" ? ' aria-current="page"' : ""}>${esc(t("comms.sosBoard"))}${d.sos ? ` <span class="sz-sos-n">${d.sos}</span>` : ""}</a><a href="#rhr/helpers"${tab === "helpers" ? ' aria-current="page"' : ""}>${esc(t("comms.helpers"))}</a></nav>` };
}
async function showRhr(tab){
  const room = byId("rhr"); if (!room) throw new WB.ApiError(403, { error: t("err.forbidden"), code: "forbidden" });
  const tabs = rhrTabs(tab);
  if (tab === "talk") { await openRoom(room, { key: "#rhr", tabs }); S.cur.onSos = null; return; }
  info.hidden = true; app.classList.remove("info-open");
  const C = S.cur = { type: "rhr", key: "#rhr", tab, roomId: null };
  main.innerHTML = `${tabs.head}${tabs.bar}<div class="sz-scroll" id="rhrBody"><div class="sz-loading">${esc(t("comms.loading"))}</div></div>`;
  if (tab === "sos") { await paintSos(C); C.ws = connectRhrWs(C); }
  else await paintHelpers();
}
/* SOS dēlis klausās „rhr” kanāla notikumus, lai atjaunotos reāllaikā */
function connectRhrWs(C){
  const ws = new WebSocket(WB.wsUrl("/comms/rooms/rhr/ws")); S.ws = ws;
  ws.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; } if (S.cur === C && (d.type === "sos" || (d.type === "message" && d.message.kind === "system"))) { paintSos(C); loadRooms().catch(() => {}); } };
  return ws;
}
const mapUrl = (la, lo) => `https://www.openstreetmap.org/?mlat=${(+la).toFixed(5)}&mlon=${(+lo).toFixed(5)}#map=15/${(+la).toFixed(5)}/${(+lo).toFixed(5)}`;
const km = (la, lo) => myPos ? Math.round(WB.hav(myPos, [la, lo])) : null;
async function paintSos(C){
  const j = await WB.req("/sos"); if (S.cur !== C) return;
  const box = $("#rhrBody");
  const act = j.items.filter(i => !i.resolved), done = j.items.filter(i => i.resolved);
  box.innerHTML = `<div class="sz-pad"><p class="hint">${esc(t("comms.sos112"))}</p></div>
    ${act.length ? `<ul class="sz-sosl">${act.map(i => { const d = km(i.lat, i.lon); return `<li class="sz-sos-item">
      <div class="sz-sos-h"><span class="live">${esc(t("comms.sosActive"))}</span><b>${esc(t("comms.sosKind." + i.kind))}</b><span class="dim small">${esc(i.authorName)} · ${esc(ago(i.created))}${d !== null ? " · " + esc(t("comms.km", { n: d })) : ""}</span></div>
      ${i.note ? `<p>${linkify(i.note)}</p>` : ""}
      <p class="small muted">${esc(tp("comms.responders", i.responders))}${i.responderNames ? `: ${esc(i.responderNames)}` : ""}</p>
      <div class="btn-row">${!i.mine ? `<button class="btn small${i.responding ? " ghost" : ""}" type="button" data-sos="respond" data-id="${esc(i.id)}" aria-pressed="${i.responding}">${esc(t(i.responding ? "comms.imComing" : "comms.iCanHelp"))}</button>` : ""}
        ${i.phone ? `<a class="btn ghost small" href="tel:${esc(i.phone.replace(/[^\d+]/g, ""))}">${ic("phone")}${esc(t("comms.call"))}</a>` : ""}
        <a class="btn ghost small" href="${esc(mapUrl(i.lat, i.lon))}" target="_blank" rel="noopener noreferrer">${ic("pin")}${esc(t("comms.openMap"))}</a>
        ${i.canResolve ? `<button class="btn ghost small" type="button" data-sos="resolve" data-id="${esc(i.id)}">${esc(t("comms.markResolved"))}</button>` : ""}</div></li>`; }).join("")}</ul>`
      : `<div class="sz-blank"><div class="empty"><p>${esc(t("comms.sosNone"))}</p></div></div>`}
    ${done.length ? `<h4 class="sz-sub-h">${esc(t("comms.sosResolved"))}</h4><ul class="rows sz-sos-done">${done.map(i => `<li><span class="badge ok">${esc(t("comms.sosResolved"))}</span> <b>${esc(t("comms.sosKind." + i.kind))}</b> <span class="dim small">${esc(i.authorName)} · ${esc(ago(i.created))}</span></li>`).join("")}</ul>` : ""}`;
  box.onclick = async e => {
    const b = e.target.closest("[data-sos]"); if (!b) return;
    if (b.dataset.sos === "resolve" && !(await WB.confirm(t("comms.markResolved"), t("comms.resolveConfirm"), t("comms.markResolved"), false))) return;
    try { busy(b, true); await WB.req(`/sos/${b.dataset.id}/${b.dataset.sos}`, { body: {} }); await paintSos(C); loadRooms().catch(() => {}); } catch (x) { toastErr(x); busy(b, false); }
  };
  if (!myPos && navigator.permissions) navigator.permissions.query({ name: "geolocation" }).then(p => { if (p.state === "granted") getPos().then(() => S.cur === C && paintSos(C)).catch(() => {}); }).catch(() => {});
}
async function sosDialog(){
  const v = await WB.modal({ title: t("comms.askHelp"), body: `<div class="form"><p class="hint">${esc(t("comms.sos112"))}</p>
    <label class="field"><span>${esc(t("comms.whatHappened"))}</span><select name="kind">${SOS_KINDS.map(k => `<option value="${k}">${esc(t("comms.sosKind." + k))}</option>`).join("")}</select></label>
    <label class="field"><span>${esc(t("comms.sosNote"))}</span><textarea name="note" rows="3" maxlength="500"></textarea></label>
    <label class="field"><span>${esc(t("comms.phone"))}</span><input type="tel" name="phone" maxlength="30" autocomplete="tel"></label></div>`,
    actions: [{ label: t("btn.cancel"), value: "" }, { label: t("comms.sendSos"), value: "ok", danger: true }] });
  if (v !== "ok") return;
  const data = WB.lastModalData;
  WB.toast(t("comms.locating"));
  let pos; try { pos = await getPos(); } catch (e) { return WB.toast(t("comms.locNeeded"), true); }
  try { await WB.req("/sos", { body: { ...data, lat: pos[0], lon: pos[1] } }); WB.toast(t("comms.sosSent")); await loadRooms(); location.hash = "rhr/sos"; route(); } catch (x) { toastErr(x); }
}
async function paintHelpers(){
  const j = await WB.req("/helpers"), box = $("#rhrBody");
  const me = j.items.find(i => i.mine);
  box.innerHTML = `<div class="sz-pad sz-help-top"><p class="muted small">${esc(t("comms.helpersLead"))}</p><div class="btn-row"><button class="btn ghost small" type="button" data-h="edit">${ic(me ? "edit" : "plus")}${esc(t(me ? "comms.editMyPoint" : "comms.addMyPoint"))}</button>${me ? `<button class="link-btn small" type="button" data-h="remove">${esc(t("comms.removeMyPoint"))}</button>` : ""}</div></div>
    ${j.items.length ? `<ul class="rows sz-helpers">${j.items.map(h => { const d = km(h.lat, h.lon); return `<li><span class="sz-av" aria-hidden="true">${initial(h.name)}</span><div>
      <p class="sz-c-h"><b>${esc(h.name)}</b> <span class="dim small">${esc(h.city || "")}${d !== null ? " · " + esc(t("comms.km", { n: d })) : ""}</span></p>
      <p class="sz-offers">${h.offers.map(o => `<span class="tag">${esc(t("comms.offer." + o))}</span>`).join(" ")}</p>
      ${h.note ? `<p class="small">${esc(h.note)}</p>` : ""}${h.contact ? `<p class="small"><span class="dim">${esc(t("comms.contactShort"))}:</span> ${/^[+\d][\d\s-]{5,}$/.test(h.contact) ? `<a href="tel:${esc(h.contact.replace(/[^\d+]/g, ""))}">${esc(h.contact)}</a>` : esc(h.contact)}</p>` : ""}</div></li>`; }).join("")}</ul>`
      : `<div class="sz-blank"><div class="empty"><p>${esc(t("comms.noHelpers"))}</p></div></div>`}`;
  box.onclick = async e => {
    const b = e.target.closest("[data-h]"); if (!b) return;
    if (b.dataset.h === "remove") { if (await WB.confirm(t("comms.removeMyPoint"), t("comms.removePointConfirm"), t("comms.removeMyPoint"))) { try { await WB.req("/helpers", { method: "DELETE" }); paintHelpers(); } catch (x) { toastErr(x); } } return; }
    const v = await WB.prompt(t(me ? "comms.editMyPoint" : "comms.addMyPoint"), `<label class="field"><span>${esc(t("comms.city"))}</span><input type="text" name="city" maxlength="60" required value="${esc(me ? me.city || "" : "")}"></label>
      <fieldset class="sz-fs"><legend>${esc(t("comms.iOffer"))}</legend>${OFFERS.map(o => `<label class="check"><input type="checkbox" name="o_${o}"${me && me.offers.includes(o) ? " checked" : ""}><span>${esc(t("comms.offer." + o))}</span></label>`).join("")}</fieldset>
      <label class="field"><span>${esc(t("comms.helperNote"))}</span><input type="text" name="note" maxlength="200" value="${esc(me ? me.note || "" : "")}"></label>
      <label class="field"><span>${esc(t("comms.contact"))}</span><input type="text" name="contact" maxlength="80" value="${esc(me ? me.contact || "" : "")}"></label><p class="hint">${esc(t("comms.locHint"))}</p>`, t("btn.save"));
    if (!v) return;
    let pos = me ? [me.lat, me.lon] : null;
    try { pos = await getPos(); } catch (x) { if (!pos) return WB.toast(t("comms.locNeeded"), true); }
    try { await WB.req("/helpers", { body: { city: v.city, note: v.note, contact: v.contact, offers: OFFERS.filter(o => v["o_" + o]), lat: pos[0], lon: pos[1] } }); WB.toast(t("comms.saved")); paintHelpers(); } catch (x) { toastErr(x); }
  };
}

/* ---------- sākums ---------- */
async function init(){
  const me = await WB.gate($("#gate"), { module: "chat" });
  if (!me) return;
  $("#gate").hidden = true;
  document.body.classList.add("sz-active");
  app.hidden = false;
  try { await loadRooms(); } catch (e) { app.hidden = true; $("#gate").hidden = false; $("#gate").innerHTML = `<div class="gate"><h2>${esc(t("err.generic"))}</h2><p>${esc(WB.errMsg(e))}</p></div>`; return; }
  addEventListener("hashchange", route);
  await route();
  // nelasītie: aptauja ik pēc 30 s, kad cilne redzama
  S.poll = setInterval(() => { if (!document.hidden) loadRooms().catch(() => {}); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadRooms().catch(() => {}); if (S.cur && S.cur.roomId) markRead(S.cur); } });
  MQ_MOBILE.addEventListener && MQ_MOBILE.addEventListener("change", () => { if (!isMobile() && !location.hash) route(); });
}
document.addEventListener("DOMContentLoaded", init);
})();
