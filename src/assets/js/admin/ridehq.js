/* WBMC administrācija — Ride HQ: kluba pieturas (places) un degvielas cenu avota stāvoklis */
(function(){
const { $, esc, t } = WB;
const A = window.WBAdmin;
const KINDS = ["cafe", "fuel", "service", "rest", "lodging", "meeting", "viewpoint", "other"];
const STATUSES = ["draft", "published", "archived"];

/* Leaflet ielāde tikai tad, kad atver redaktoru (CSP: tikai 'self') */
let leafletP = null;
const loadLeaflet = () => window.L ? Promise.resolve() : (leafletP = leafletP || new Promise((res, rej) => {
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = WB.base + "assets/vendor/leaflet/leaflet.css"; document.head.appendChild(css);
  const s = document.createElement("script"); s.src = WB.base + "assets/vendor/leaflet/leaflet.js"; s.onload = res; s.onerror = () => { leafletP = null; rej(new Error("leaflet")); }; document.head.appendChild(s);
}));

/* neapstrādāts augšupielādes pieprasījums ar MFA apstiprinājumu, ja vajag */
async function rawPost(path, body, type){
  for (let i = 0; i < 2; i++) {
    const r = await fetch("/api" + path, { method: "POST", credentials: "same-origin", headers: { "X-WBMC": "1", "Content-Type": type }, body });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const err = new WB.ApiError(r.status, j);
    if (err.code === "mfa_stepup" && i === 0 && await WB.stepUp()) continue;
    throw err;
  }
}

function placeForm(p){
  p = p || { name: "", kind: "cafe", status: "draft", description: {}, lat: "", lng: "", address: "", url: "" };
  return `<label class="field"><span>${esc(t("hq.adm.name"))} *</span><input type="text" name="name" required minlength="2" maxlength="120" value="${esc(p.name)}"></label>
    <div class="two"><label class="field"><span>${esc(t("hq.adm.kind"))}</span><select name="kind">${KINDS.map(k => `<option value="${k}"${k === p.kind ? " selected" : ""}>${esc(t("hq.place." + k))}</option>`).join("")}</select></label>
      <label class="field"><span>${esc(t("hq.adm.status"))}</span><select name="status">${STATUSES.map(s => `<option value="${s}"${s === p.status ? " selected" : ""}>${esc(t("status." + s))}</option>`).join("")}</select></label></div>
    ${A.mlField("description", t("hq.adm.desc"), p.description, { textarea: true, max: 600, rows: 3 })}
    <div class="field"><div id="plMap" style="height:280px;border:1px solid var(--line);border-radius:6px;background:#111" role="application" aria-label="${esc(t("hq.adm.pick"))}"></div><small class="hint" id="plMapHint">${esc(t("hq.adm.pick"))}</small></div>
    <div class="two"><label class="field"><span>${esc(t("hq.adm.lat"))} *</span><input type="number" name="lat" step="any" min="-90" max="90" required value="${esc(p.lat)}" inputmode="decimal"></label>
      <label class="field"><span>${esc(t("hq.adm.lng"))} *</span><input type="number" name="lng" step="any" min="-180" max="180" required value="${esc(p.lng)}" inputmode="decimal"></label></div>
    <label class="field"><span>${esc(t("hq.adm.address"))}</span><input type="text" name="address" maxlength="200" value="${esc(p.address)}"></label>
    <label class="field"><span>${esc(t("hq.adm.url"))}</span><input type="url" name="url" maxlength="600" value="${esc(p.url)}" placeholder="https://"></label>`;
}
async function initPicker(d){
  const f = d.querySelector("form"), box = d.querySelector("#plMap");
  try { await loadLeaflet(); } catch (e) { box.hidden = true; d.querySelector("#plMapHint").textContent = t("hq.adm.mapErr"); return; }
  const has = f.lat.value !== "" && f.lng.value !== "";
  const map = L.map(box, { zoomControl: true, attributionControl: true }).setView(has ? [+f.lat.value, +f.lng.value] : [56.95, 24.6], has ? 13 : 7);
  WB.darkTiles().addTo(map);
  let mk = null;
  const put = (lat, lng, pan) => {
    if (!mk) mk = L.marker([lat, lng], { draggable: true }).addTo(map).on("dragend", e => { const p = e.target.getLatLng(); f.lat.value = p.lat.toFixed(5); f.lng.value = p.lng.toFixed(5); });
    else mk.setLatLng([lat, lng]);
    if (pan) map.panTo([lat, lng]);
  };
  if (has) put(+f.lat.value, +f.lng.value);
  map.on("click", e => { f.lat.value = e.latlng.lat.toFixed(5); f.lng.value = e.latlng.lng.toFixed(5); put(e.latlng.lat, e.latlng.lng); });
  const sync = () => { const a = +f.lat.value, b = +f.lng.value; if (f.lat.value !== "" && f.lng.value !== "" && Math.abs(a) <= 90 && Math.abs(b) <= 180) put(a, b, true); };
  f.lat.addEventListener("change", sync); f.lng.addEventListener("change", sync);
  setTimeout(() => map.invalidateSize(), 60);
}
const readPlace = f => ({ name: f.name.value, kind: f.kind.value, status: f.status.value, description: A.readML(f, "description"), lat: +f.lat.value, lng: +f.lng.value, address: f.address.value, url: f.url.value });

function fuelBlock(fu){
  if (!fu || fu.error) return `<div class="empty"><p>${esc(WB.errMsg(fu && fu.error))}</p></div>`;
  const st = fu.status || {}, ec = fu.ec, no = fu.no;
  const attempt = s => s && s.attempt ? `${esc(A.fmt(s.attempt))} ${s.ok ? `<span class="badge ok">OK</span>` : s.ok === false ? `<span class="badge bad">${esc(t("hq.adm.fuelErr"))}</span>` : ""}` : "—";
  return `<ul class="rows sc-status">
      <li><span>${esc(t("hq.adm.fuelEc"))}</span><b>${ec ? `${esc(t("hq.adm.fuelPrices"))} ${esc(A.fmtDate(ec.date))} · ${ec.countries} ${esc(t("hq.adm.countries"))} · ${esc(t("hq.adm.fuelFetched"))} ${esc(A.fmt(ec.fetchedAt))}${ec.via === "upload" ? " · XLSX" : ""}` : `<span class="badge warn">${esc(t("hq.adm.fuelNever"))}</span>`}</b></li>
      <li><span>${esc(t("hq.adm.fuelLast"))} (EK)</span><b>${attempt(st.ec)}</b></li>
      ${st.ec && st.ec.ok === false && st.ec.error ? `<li><span>${esc(t("hq.adm.fuelErr"))}</span><b class="small mono-wrap">${esc(st.ec.error)}</b></li>` : ""}
      <li><span>${esc(t("hq.adm.fuelNo"))}</span><b>${no ? `${esc(no.period)} · ${esc(t("hq.adm.fuelFetched"))} ${esc(A.fmt(no.fetchedAt))}` : `<span class="badge warn">${esc(t("hq.adm.fuelNever"))}</span>`}</b></li>
      <li><span>${esc(t("hq.adm.fuelLast"))} (SSB)</span><b>${attempt(st.no)}</b></li>
      ${st.no && st.no.ok === false && st.no.error ? `<li><span>${esc(t("hq.adm.fuelErr"))}</span><b class="small mono-wrap">${esc(st.no.error)}</b></li>` : ""}
    </ul>
    <p class="small muted"><a href="${esc(fu.sources.ecPage)}" target="_blank" rel="noopener noreferrer">EC Weekly Oil Bulletin</a> · <a href="${esc(fu.sources.ssbPage)}" target="_blank" rel="noopener noreferrer">SSB 09654</a></p>
    ${WB.can("settings", "e") ? `<div class="btn-row"><button class="btn small" type="button" id="fuelRefresh">${esc(t("hq.adm.fuelRefresh"))}</button><label class="btn ghost small"><input type="file" id="fuelFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>${esc(t("hq.adm.fuelUpload"))}</label></div>` : ""}`;
}

A.register({ id: "places", title: t("hq.adm.title"), need: ["places", "v"], order: 50, render: async el => {
  A.loading(el);
  let d, fu;
  try { d = await WB.req("/admin/places"); } catch (e) { return A.err(el, e); }
  try { fu = await WB.req("/admin/fuel"); } catch (e) { fu = { error: e }; }
  const canC = WB.can("places", "c"), canE = WB.can("places", "e"), canD = WB.can("places", "d");
  el.innerHTML = `<h2>${esc(t("hq.adm.title"))}</h2><p class="muted">${esc(t("hq.adm.text"))}</p>
    <div class="btn-row">${canC ? `<button class="btn" type="button" id="plNew">${esc(t("hq.adm.new"))}</button>` : ""}<a class="btn ghost" href="karte.html">Ride HQ</a></div>
    <h3 class="adm-sub">${esc(t("hq.l.places"))} (${d.items.length})</h3>
    ${A.table([t("hq.adm.name"), t("hq.adm.kind"), t("hq.adm.status"), "lat, lng", t("hq.adm.updated"), ""], d.items.map(p => `<tr>
      <td><b>${esc(p.name)}</b>${p.address ? `<br><span class="small muted">${esc(p.address)}</span>` : ""}</td><td>${esc(t("hq.place." + p.kind))}</td><td>${A.badge(p.status)}</td>
      <td class="small num">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</td><td class="small">${esc(A.ago(p.updated))}${p.updatedBy ? `<br><span class="muted">${esc(p.updatedBy)}</span>` : ""}</td>
      <td>${canE || canD ? `<button class="btn ghost small" type="button" data-edit="${esc(p.id)}">${esc(t("adm.edit"))}</button>` : ""}</td></tr>`), t("hq.adm.empty"))}
    <section class="panel" style="margin-top:var(--s-6)"><h3>${esc(t("hq.adm.fuelTitle"))}</h3><p class="muted">${esc(t("hq.adm.fuelText"))}</p><div id="fuelState">${fuelBlock(fu)}</div></section>`;
  const open = p => A.editor({
    title: p ? t("hq.adm.edit") : t("hq.adm.new"), body: placeForm(p), onOpen: initPicker,
    onSave: async f => { const b = readPlace(f); if (p) await WB.req("/admin/places/" + p.id, { body: b }); else await WB.req("/admin/places", { body: b }); WB.toast(t("adm.saved")); A.show("places"); },
    danger: p && canD ? { label: t("adm.delete"), onClick: async () => { if (!(await WB.confirm(t("adm.delete"), t("hq.adm.deleteText"), t("adm.delete")))) return false; await WB.req("/admin/places/" + p.id, { method: "DELETE" }); WB.toast(t("adm.saved")); A.show("places"); } } : null
  });
  el.onclick = async e => {
    if (e.target.closest("#plNew")) open(null);
    const ed = e.target.closest("[data-edit]"); if (ed) open(d.items.find(x => x.id === ed.dataset.edit));
    if (e.target.closest("#fuelRefresh")) {
      const b = e.target.closest("#fuelRefresh"); b.disabled = true;
      try { const r = await WB.req("/admin/fuel/refresh", { body: {} }); const bad = [r.ec, r.no].filter(x => !x.ok).map(x => x.error);
        if (bad.length) WB.toast(t("hq.adm.fuelFail", { e: bad.join("; ") }), true); else WB.toast(t("hq.adm.fuelOk")); }
      catch (x) { WB.toast(WB.errMsg(x), true); }
      A.show("places");
    }
  };
  el.onchange = async e => {
    if (e.target.id !== "fuelFile" || !e.target.files[0]) return;
    try { const r = await rawPost("/admin/fuel/upload", e.target.files[0], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); WB.toast(t("hq.adm.fuelOk") + " · " + r.date); A.show("places"); }
    catch (x) { WB.toast(WB.errMsg(x), true); }
    e.target.value = "";
  };
} });
})();
