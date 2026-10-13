/* WOLVES BROTHERHOOD MC — Riders Help Riders UI */
(function(){
const { $, $$, esc, t, tp, L: TL } = WB;
WB.initNav();
document.querySelectorAll("[data-ico]").forEach(e => e.innerHTML = WB.icon(e.dataset.ico));
const R = window.RHR, view = $("#view");
let user = null, unsub = null, mainMap = null;
const rtf = new Intl.RelativeTimeFormat(WB.locale, { numeric: "auto" });
const ago = ms => { const s = (ms - Date.now()) / 1000, a = Math.abs(s);
  return a < 60 ? rtf.format(Math.round(s), "second") : a < 3600 ? rtf.format(Math.round(s / 60), "minute") : a < 86400 ? rtf.format(Math.round(s / 3600), "hour") : a < 2592000 ? rtf.format(Math.round(s / 86400), "day") : WB.dateLong(new Date(ms)); };
const fmtBody = s => esc(s).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>');
const roleTag = r => r && r !== "rider" ? `<span class="role r-${r}">${esc(t("rhr.role." + r))}</span>` : "";
const KINDS_SOS = ["tyre", "battery", "fuel", "crash", "breakdown", "other"];
const KINDS_HAZ = ["gravel", "potholes", "oil", "roadworks", "animals", "police", "other"].filter(k => k !== "police");
const OFFERS = ["tools", "garage", "trailer", "bed", "parts", "tow"];


/* ---------- sidebar ---------- */
function renderSide(){
  $("#catList").innerHTML = [`<li><a href="#forum/all" data-view="forum/all"><span class="ico">${WB.icon("list")}</span>${esc(t("rhr.latest"))}</a></li>`, ...R.CATS.map(c => `<li><a href="#forum/${c.id}" data-view="forum/${c.id}"><span class="ico">${WB.icon(c.icon)}</span>${esc(t("rhr.cat." + c.id))}</a></li>`)].join("");
  $("#roomList").innerHTML = R.ROOMS.map(r => { const ok = R.can(user, r.minRole); return `<li><a href="#chat/${r.id}" data-view="chat/${r.id}" class="${ok ? "" : "locked"}"><span class="ico">${WB.icon("hash")}</span>${esc(t("rhr.room." + r.id))}${ok ? "" : ` <span class="lock">${WB.icon("lock")}</span>`}</a></li>`; }).join("");
  $("#meBox").innerHTML = user
    ? `<div class="me"><span class="avatar">${esc(user.name.slice(0, 1).toUpperCase())}</span><div><b>${esc(user.name)}</b>${roleTag(user.role) || `<span class="role">${esc(t("rhr.role.rider"))}</span>`}</div><button class="link-btn" id="logout">${esc(t("rhr.logout"))}</button></div>
       ${R.can(user, "officer") ? `<button class="btn ghost small wide" id="mkInvite">${esc(t("rhr.makeInvite"))}</button><p class="small muted" id="inviteOut"></p>` : ""}`
    : `<p class="small muted">${esc(t("rhr.guest"))}</p><button class="btn small wide" id="loginBtn">${esc(t("rhr.auth.login"))} / ${esc(t("rhr.auth.register"))}</button>`;
  const lo = $("#logout"); lo && lo.addEventListener("click", async () => { await R.logout(); user = null; renderSide(); route(); });
  const li = $("#loginBtn"); li && li.addEventListener("click", openAuth);
  const mi = $("#mkInvite"); mi && mi.addEventListener("click", async () => { const j = await R.invite(); $("#inviteOut").innerHTML = `${esc(t("rhr.inviteCode"))}: <b>${esc(j.code)}</b>`; });
  highlight();
}
const highlight = () => { const h = location.hash.slice(1) || "forum/all"; $$(".rhr-nav a").forEach(a => a.classList.toggle("on", h.startsWith(a.dataset.view) || (h.startsWith("t/") && a.dataset.view === "forum/" + (window._curCat || "all")))); };
$("#rhrBack").addEventListener("click", () => { if (location.hash.startsWith("#t/")) history.back(); else $("#rhr").classList.toggle("side-open"); });
$("#rhrSide").addEventListener("click", e => { if (e.target.closest("a")) $("#rhr").classList.remove("side-open"); });

/* ---------- auth ---------- */
const authDlg = $("#authDlg"); let authMode = "login";
function openAuth(){ $("#authErr").textContent = ""; authDlg.showModal(); }
$$("[data-auth]").forEach(b => b.addEventListener("click", () => {
  authMode = b.dataset.auth; $$("[data-auth]").forEach(x => x.classList.toggle("on", x === b));
  $$("#authForm [data-reg]").forEach(x => x.hidden = authMode !== "register");
  $("#authBtn").textContent = t(authMode === "login" ? "rhr.auth.login" : "rhr.auth.register");
  $("#authForm").password.autocomplete = authMode === "login" ? "current-password" : "new-password";
}));
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target; $("#authErr").textContent = "";
  try {
    user = authMode === "login" ? await R.login(f.email.value, f.password.value) : await R.register({ name: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value, invite: f.invite.value.trim() });
    authDlg.close(); renderSide(); route();
  } catch (err) { $("#authErr").textContent = err.message || t("rhr.err.generic"); }
});
const needUser = () => { if (!user) { openAuth(); return false; } return true; };

/* ---------- header ---------- */
const head = (title, sub, act = "") => { $("#viewTitle").textContent = title; $("#viewSub").textContent = sub || ""; $("#viewAct").innerHTML = act; document.title = title + " · Riders Help Riders"; };
const killMap = () => { if (mainMap) { mainMap.remove(); mainMap = null; } };

/* ---------- forum ---------- */
async function showForum(cat){
  window._curCat = cat;
  head(cat === "all" ? t("rhr.latest") : t("rhr.cat." + cat), cat === "all" ? t("rhr.forumSub") : t("rhr.catSub." + cat), `<button class="btn small" id="newThread">${esc(t("rhr.newThread"))}</button>`);
  $("#newThread").onclick = () => needUser() && compose("thread", { cat: cat === "all" ? "roadhelp" : cat });
  view.innerHTML = `<div class="loading">…</div>`;
  const list = await R.threads(cat);
  view.innerHTML = list.length ? `<ul class="threads">${list.map(x => `<li><a href="#t/${esc(x.id)}">
      <span class="th-cat">${WB.icon((R.CATS.find(c => c.id === x.cat) || {}).icon || "list")}</span>
      <span class="th-main"><b>${x.solved ? `<span class="solved">✓ ${esc(t("rhr.solved"))}</span> ` : ""}${esc(x.title)}</b><small>${esc(x.author)} · ${esc(t("rhr.cat." + x.cat))} · ${esc(ago(x.lastAt))}</small></span>
      <span class="th-n">${x.replies}<small>${esc(tp("rhr.replies", x.replies))}</small></span></a></li>`).join("")}</ul>`
    : `<div class="empty-state"><h3>${esc(t("rhr.noThreads"))}</h3><p class="muted">${esc(t("rhr.noThreadsSub"))}</p></div>`;
}
async function showThread(id){
  let d; try { d = await R.thread(id); } catch (e) { view.innerHTML = `<div class="empty-state"><h3>${esc(t("rhr.err.notFound"))}</h3></div>`; return; }
  window._curCat = d.thread.cat;
  const mine = user && (d.thread.authorId === user.id || R.can(user, "officer"));
  head(d.thread.title, `${t("rhr.cat." + d.thread.cat)} · ${d.thread.author} · ${ago(d.thread.created)}`, mine ? `<button class="btn small ghost" id="solve">${esc(t(d.thread.solved ? "rhr.unsolve" : "rhr.markSolved"))}</button>` : "");
  const sv = $("#solve"); sv && (sv.onclick = async () => { await R.solve(id); showThread(id); });
  view.innerHTML = `<ol class="posts">${d.posts.map((p, i) => `<li class="post ${i === 0 ? "op" : ""}">
      <div class="post-h"><span class="avatar">${esc((p.authorName || "?").slice(0, 1))}</span><b>${esc(p.authorName)}</b>${roleTag(p.role)}<span class="muted small">${esc(ago(p.created))}</span></div>
      <div class="post-b">${fmtBody(p.body)}</div>
      <div class="post-f"><button class="like ${p.liked ? "on" : ""}" data-like="${esc(p.id)}" aria-pressed="${!!p.liked}">👍 ${esc(t("rhr.useful"))} <span>${p.likeCount || ""}</span></button></div></li>`).join("")}</ol>
    ${user ? `<form class="reply" id="replyForm"><label class="sr-only" for="replyBody">${esc(t("rhr.reply"))}</label><textarea id="replyBody" rows="3" maxlength="4000" required placeholder="${esc(t("rhr.replyPh"))}"></textarea><button class="btn" type="submit">${esc(t("rhr.send"))}</button></form>`
      : `<div class="reply-guest"><p class="muted">${esc(t("rhr.loginToReply"))}</p><button class="btn small" id="loginReply">${esc(t("rhr.auth.login"))}</button></div>`}`;
  view.querySelectorAll("[data-like]").forEach(b => b.onclick = async () => { if (!needUser()) return; await R.like(b.dataset.like); showThread(id); });
  const rf = $("#replyForm"); rf && rf.addEventListener("submit", async e => { e.preventDefault(); const v = $("#replyBody").value.trim(); if (!v) return; await R.reply(id, v); showThread(id); });
  const lr = $("#loginReply"); lr && (lr.onclick = openAuth);
}

/* ---------- chat ---------- */
async function showChat(room){
  const def = R.ROOMS.find(r => r.id === room); if (!def) return showForum("all");
  head("# " + t("rhr.room." + room), t("rhr.roomSub." + room));
  if (!R.can(user, def.minRole)) {
    view.innerHTML = `<div class="empty-state locked-state"><div class="big-lock">🔒</div><h3>${esc(t("rhr.membersOnly"))}</h3><p class="muted">${esc(t(user ? "rhr.needInvite" : "rhr.loginMembers"))}</p>${user ? "" : `<button class="btn" id="lg">${esc(t("rhr.auth.login"))}</button>`}</div>`;
    const lg = $("#lg"); lg && (lg.onclick = openAuth); return;
  }
  view.innerHTML = `<div class="chat"><ol class="msgs" id="msgs" aria-live="polite"></ol>
    <form class="chat-in" id="chatForm"><label class="sr-only" for="chatBody">${esc(t("rhr.message"))}</label><textarea id="chatBody" rows="1" maxlength="2000" placeholder="${esc(t("rhr.messagePh"))}"></textarea><button class="btn" type="submit" aria-label="${esc(t("rhr.send"))}">➤</button></form></div>`;
  const box = $("#msgs");
  const add = m => { const li = document.createElement("li"); li.className = "msg" + (m.mine || (user && m.author === user.id) ? " mine" : "");
    li.innerHTML = `<b>${esc(m.authorName)}</b><span class="muted small">${esc(WB.time(new Date(m.created)))}</span><p>${fmtBody(m.body)}</p>`; box.appendChild(li); box.scrollTop = box.scrollHeight; };
  (await R.messages(room)).forEach(add);
  unsub = R.subscribe(room, m => add(m));
  const ta = $("#chatBody");
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); } });
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; });
  $("#chatForm").addEventListener("submit", async e => { e.preventDefault(); const v = ta.value.trim(); if (!v) return; ta.value = ""; ta.style.height = ""; const m = await R.send(room, v); if (R.mode === "demo") add({ ...m, mine: true }); });
}

/* ---------- map helper ---------- */
function mapIn(el, items, kind){
  killMap();
  mainMap = L.map(el, { zoomControl: true, scrollWheelZoom: false }).setView([56.95, 24.6], 7);
  WB.darkTiles().addTo(mainMap);
  const g = L.featureGroup().addTo(mainMap);
  items.forEach(x => L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "pin " + (kind === "sos" ? "sosp" : kind === "haz" ? "haz" : "poi"), html: WB.icon(kind === "sos" ? "sos" : kind === "haz" ? "warn" : "hands"), iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(g)
    .bindPopup(`<b>${esc(x._title)}</b><br>${esc(x.note || "")}`));
  if (items.length) mainMap.fitBounds(g.getBounds().pad(.3), { maxZoom: 11 });
  setTimeout(() => mainMap && mainMap.invalidateSize(), 60);
}

/* ---------- SOS ---------- */
async function showSos(){
  head(t("rhr.sosBoard"), t("rhr.sosSub"), `<button class="btn small danger" id="newSos">${esc(t("rhr.askHelp"))}</button>`);
  $("#newSos").onclick = () => needUser() && compose("sos");
  const list = await R.sos();
  const active = list.filter(s => !s.resolved);
  const b = $("#sosBadge"); b.hidden = !active.length; b.textContent = active.length;
  view.innerHTML = `<div class="split"><div class="rhr-map" id="sosMap"></div><ul class="cards">${list.map(s => `<li class="card ${s.resolved ? "done" : "urgent"}">
      <div class="card-h"><span class="kind">${esc(t("rhr.sos." + s.kind))}</span>${s.resolved ? `<span class="tag">${esc(t("rhr.resolved"))}</span>` : `<span class="live">${esc(t("rhr.active"))}</span>`}<span class="muted small">${esc(ago(s.created))}</span></div>
      <p>${esc(s.note || "")}</p><p class="small muted">${esc(s.authorName)} · ${s.lat.toFixed(4)}, ${s.lon.toFixed(4)} · ${esc(tp("rhr.responders", s.responders.length))}${s.phone ? ` · <a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : ""}</p>
      <div class="card-a"><a class="btn small ghost" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">${esc(t("map.navigate"))}</a>
        ${!s.resolved && !s.mine ? `<button class="btn small ${s.responding ? "" : "ghost"}" data-resp="${esc(s.id)}">${esc(t(s.responding ? "rhr.imComing" : "rhr.iCanHelp"))}</button>` : ""}
        ${!s.resolved && s.mine ? `<button class="btn small" data-res="${esc(s.id)}">${esc(t("rhr.markResolved"))}</button>` : ""}</div></li>`).join("") || `<li class="muted">${esc(t("rhr.noSos"))}</li>`}</ul></div>`;
  mapIn($("#sosMap"), list.filter(s => !s.resolved).map(s => ({ ...s, _title: t("rhr.sos." + s.kind) })), "sos");
  view.querySelectorAll("[data-resp]").forEach(x => x.onclick = async () => { if (!needUser()) return; await R.respond(x.dataset.resp); showSos(); });
  view.querySelectorAll("[data-res]").forEach(x => x.onclick = async () => { await R.resolveSos(x.dataset.res); showSos(); });
}

/* ---------- hazards ---------- */
async function showHazards(){
  head(t("rhr.hazards"), t("rhr.hazSub"), `<button class="btn small" id="newHaz">${esc(t("rhr.report"))}</button><a class="btn small ghost" href="karte.html">Ride HQ</a>`);
  $("#newHaz").onclick = () => needUser() && compose("hazard");
  const list = await R.hazards();
  view.innerHTML = `<div class="split"><div class="rhr-map" id="hazMap"></div><ul class="cards">${list.map(h => `<li class="card"><div class="card-h"><span class="kind">⚠ ${esc(t("rhr.haz." + h.kind))}</span><span class="muted small">${esc(ago(h.created))}</span></div><p>${esc(h.note || "")}</p><p class="small muted">${esc(h.by || "")}</p></li>`).join("") || `<li class="muted">${esc(t("map.noHazards"))}</li>`}</ul></div>`;
  mapIn($("#hazMap"), list.map(h => ({ ...h, _title: t("rhr.haz." + h.kind) })), "haz");
}

/* ---------- helpers network ---------- */
async function showHelpers(){
  head(t("rhr.helpers"), t("rhr.helpSub"), `<button class="btn small" id="newHelp">${esc(t("rhr.addMyPoint"))}</button>`);
  $("#newHelp").onclick = () => needUser() && compose("helper");
  const list = await R.helpers();
  view.innerHTML = `<div class="split"><div class="rhr-map" id="helpMap"></div><ul class="cards">${list.map(h => `<li class="card"><div class="card-h"><b>${esc(h.name)}</b><span class="muted small">${esc(h.city)}</span></div>
    <div class="offers">${(h.offers || []).map(o => `<span class="tag">${esc(t("rhr.offer." + o))}</span>`).join("")}</div><p>${esc(h.note || "")}</p>
    ${user ? (h.contact ? `<p class="small"><a href="${/^\+?[\d\s]+$/.test(h.contact) ? "tel:" : "mailto:"}${esc(h.contact)}">${esc(h.contact)}</a></p>` : "") : `<p class="small muted">${esc(t("rhr.loginContact"))}</p>`}</li>`).join("")}</ul></div>`;
  mapIn($("#helpMap"), list.map(h => ({ ...h, _title: h.name + " · " + h.city })), "help");
}

/* ---------- composer ---------- */
const cDlg = $("#composeDlg"); let pickMap = null, pickPt = null;
function compose(type, opts = {}){
  const f = $("#composeForm");
  const sel = (name, arr, pre) => `<select name="${name}">${arr.map(k => `<option value="${k}">${esc(t(pre + k))}</option>`).join("")}</select>`;
  const locBlock = `<div class="pick"><div class="pick-map" id="pickMap"></div><div class="pick-row"><button type="button" class="btn small ghost" id="pickMe">${esc(t("map.useMe"))}</button><span class="muted small" id="pickTxt">${esc(t("rhr.pickHint"))}</span></div></div>`;
  let title = "", html = "";
  if (type === "thread") { title = t("rhr.newThread");
    html = `<label>${esc(t("rhr.category"))}<select name="cat">${R.CATS.map(c => `<option value="${c.id}" ${c.id === opts.cat ? "selected" : ""}>${esc(t("rhr.cat." + c.id))}</option>`).join("")}</select></label>
      <label>${esc(t("rhr.title"))}<input name="title" maxlength="140" required></label><label>${esc(t("rhr.text"))}<textarea name="body" rows="6" maxlength="8000" required></textarea></label>`; }
  if (type === "sos") { title = t("rhr.askHelp");
    html = `<label>${esc(t("rhr.whatHappened"))}${sel("kind", KINDS_SOS, "rhr.sos.")}</label><label>${esc(t("rhr.text"))}<textarea name="note" rows="3" maxlength="500"></textarea></label>
      <label>${esc(t("join.phone"))} <span class="muted">${esc(t("don.optional"))}</span><input name="phone" type="tel" autocomplete="tel"></label>${locBlock}<p class="hint">${esc(t("rhr.sos112"))}</p>`; }
  if (type === "hazard") { title = t("rhr.report");
    html = `<label>${esc(t("rhr.hazType"))}${sel("kind", KINDS_HAZ, "rhr.haz.")}</label><label>${esc(t("rhr.text"))}<input name="note" maxlength="200"></label>${locBlock}`; }
  if (type === "helper") { title = t("rhr.addMyPoint");
    html = `<label>${esc(t("rhr.city"))}<input name="city" maxlength="60" required></label>
      <fieldset class="offer-set"><legend>${esc(t("rhr.iOffer"))}</legend>${OFFERS.map(o => `<label class="toggle"><input type="checkbox" name="offers" value="${o}"><span>${esc(t("rhr.offer." + o))}</span></label>`).join("")}</fieldset>
      <label>${esc(t("rhr.text"))}<input name="note" maxlength="200"></label><label>${esc(t("rhr.contact"))}<input name="contact" maxlength="80" placeholder="+371 …"></label>${locBlock}<p class="hint">${esc(t("rhr.helperHint"))}</p>`; }
  $("#composeTitle").textContent = title;
  f.innerHTML = html + `<p class="form-err" id="cErr" role="alert"></p><button class="btn wide" type="submit">${esc(type === "sos" ? t("rhr.sendSos") : t("rhr.publish"))}</button>`;
  f.dataset.type = type; cDlg.showModal();
  if (f.querySelector("#pickMap")) {
    pickPt = null; pickMap && pickMap.remove();
    pickMap = L.map("pickMap", { zoomControl: true }).setView([56.95, 24.6], 7); WB.darkTiles().addTo(pickMap);
    let mk = null;
    const setPt = ll => { pickPt = [ll.lat, ll.lng]; mk ? mk.setLatLng(ll) : (mk = L.marker(ll, { draggable: true }).addTo(pickMap).on("dragend", e => setPt(e.target.getLatLng()))); $("#pickTxt").textContent = `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`; };
    pickMap.on("click", e => setPt(e.latlng));
    const me = () => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => { const ll = L.latLng(p.coords.latitude, p.coords.longitude); setPt(ll); pickMap.setView(ll, 13); }, () => $("#pickTxt").textContent = t("map.noGeo"), { enableHighAccuracy: true, timeout: 10000 });
    $("#pickMe").onclick = me; if (type === "sos") me();
    setTimeout(() => pickMap.invalidateSize(), 80);
  }
}
$("#composeForm").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target, type = f.dataset.type, err = $("#cErr"); err.textContent = "";
  try {
    if (["sos", "hazard", "helper"].includes(type) && !pickPt) throw new Error(t("rhr.err.noLoc"));
    if (type === "thread") { const r = await R.newThread({ cat: f.cat.value, title: f.title.value.trim(), body: f.body.value.trim() }); cDlg.close(); location.hash = "t/" + r.id; return; }
    if (type === "sos") await R.newSos({ kind: f.kind.value, note: f.note.value.trim(), phone: f.phone.value.trim(), lat: pickPt[0], lon: pickPt[1] });
    if (type === "hazard") await R.newHazard({ kind: f.kind.value, note: f.note.value.trim(), lat: pickPt[0], lon: pickPt[1] });
    if (type === "helper") await R.saveHelper({ city: f.city.value.trim(), offers: [...f.querySelectorAll('[name="offers"]:checked')].map(x => x.value), note: f.note.value.trim(), contact: f.contact.value.trim(), lat: +pickPt[0].toFixed(2), lon: +pickPt[1].toFixed(2) });
    cDlg.close(); route();
  } catch (x) { err.textContent = x.message || t("rhr.err.generic"); }
});

/* ---------- router ---------- */
async function route(){
  unsub && unsub(); unsub = null; killMap();
  const h = decodeURIComponent(location.hash.slice(1)) || "forum/all";
  $("#rhr").classList.toggle("in-thread", h.startsWith("t/"));
  highlight();
  try {
    if (h.startsWith("forum/")) await showForum(h.split("/")[1] || "all");
    else if (h.startsWith("t/")) await showThread(h.slice(2));
    else if (h.startsWith("chat/")) await showChat(h.split("/")[1]);
    else if (h === "sos") await showSos();
    else if (h === "hazards") await showHazards();
    else if (h === "helpers") await showHelpers();
    else await showForum("all");
  } catch (e) { view.innerHTML = `<div class="empty-state"><h3>${esc(t("rhr.err.generic"))}</h3><p class="muted">${esc(e.message)}</p></div>`; }
  $("#rhrMain").scrollTop = 0;
}
addEventListener("hashchange", route);
(async () => { await R.probe(); $("#rhrMode").textContent = R.mode === "live" ? t("rhr.modeLive") : t("rhr.modeDemo"); user = await R.init(); renderSide(); route();
  R.sos().then(l => { const n = l.filter(s => !s.resolved).length; const b = $("#sosBadge"); b.hidden = !n; b.textContent = n; }).catch(() => {}); })();
})();
