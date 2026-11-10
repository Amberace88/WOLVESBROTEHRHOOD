/* WBMC — Ride HQ: maršrutu un brauciena informācijas centrs
   Maršruti (OSRM), laikapstākļi pa ceļam (Open-Meteo), radars (RainViewer), OSM vietas (Overpass), adreses (Photon),
   kluba pieturas un biedru ceļa brīdinājumi (WBMC API), degvielas cenas (EK Weekly Oil Bulletin, SSB), bars (WebSocket), SOS.
   Princips: katram datu veidam — avots un laiks; ja avots nav pieejams, rāda kļūdu ar „Mēģināt vēlreiz”, nekad izdomātus datus. */
(function(){
const { $, $$, esc, t, L: TL } = WB;
WB.initNav();
const C = window.CLUB || {};
const LANG = WB.lang;
const mq = matchMedia("(max-width:860px)");
const isMobile = () => mq.matches;
const ls = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

/* ---------- formatēšana ---------- */
const nf = (min, max) => new Intl.NumberFormat(WB.locale, { minimumFractionDigits: min, maximumFractionDigits: max });
const N0 = nf(0, 0), N1 = nf(0, 1), N3 = nf(3, 3), N2 = nf(2, 2);
const fDT = new Intl.DateTimeFormat(WB.locale, { dateStyle: "medium", timeStyle: "short" });
const fD = new Intl.DateTimeFormat(WB.locale, { dateStyle: "long" });
const fMonth = new Intl.DateTimeFormat(WB.locale, { month: "long", year: "numeric" });
const rtf = new Intl.RelativeTimeFormat(WB.locale, { numeric: "auto" });
let regionNames; try { regionNames = new Intl.DisplayNames([LANG === "no" ? "nb" : LANG], { type: "region" }); } catch (e) { regionNames = null; }
const country = cc => (regionNames && regionNames.of(cc)) || cc;
const ago = ts => { const m = Math.round((ts - Date.now()) / 6e4); return Math.abs(m) < 60 ? rtf.format(m, "minute") : Math.abs(m) < 48 * 60 ? rtf.format(Math.round(m / 60), "hour") : rtf.format(Math.round(m / 1440), "day"); };
const fNum = new Intl.DateTimeFormat(WB.locale, { day: "2-digit", month: "2-digit", year: "numeric" });
const isoDate = s => fNum.format(new Date(s + "T12:00:00"));
const fmtDur = s => { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? t("hq.dur.hm", { h, m }) : t("hq.dur.m", { m }); };
const km = v => N0.format(Math.round(v)) + " km";
const now = () => WB.time(new Date());

/* ---------- ārējie servisi: taimauts + saprotamas kļūdas ---------- */
class SvcError extends Error { constructor(svc, reason, status){ super(reason); this.svc = svc; this.reason = reason; this.status = status || 0; } }
async function getJSON(svc, url, opt = {}, ms = 15000){
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), ms);
  if (opt.signal) opt.signal.addEventListener("abort", () => ac.abort());
  let r;
  try { r = await fetch(url, { ...opt, signal: ac.signal }); }
  catch (e) { throw new SvcError(svc, opt.signal && opt.signal.aborted ? "aborted" : e.name === "AbortError" ? "timeout" : "network"); }
  finally { clearTimeout(tm); }
  if (!r.ok) throw new SvcError(svc, r.status === 429 ? "rate" : r.status === 504 || r.status === 408 ? "timeout" : "http", r.status);
  try { return await r.json(); } catch (e) { throw new SvcError(svc, "parse", r.status); }
}
const errText = e => e instanceof SvcError ? `${t("hq.err." + e.svc)} ${t("hq.err.r." + e.reason, { s: e.status })}` : WB.errMsg(e);
function errBox(el, e, retry){
  el.innerHTML = `<div class="svc-err" role="alert"><p>${esc(errText(e))}</p>${retry ? `<button type="button" class="btn ghost small">${esc(t("hq.retry"))}</button>` : ""}</div>`;
  if (retry) el.querySelector("button").onclick = retry;
}
const kindBadge = k => `<span class="kb kb-${k}">${esc(t("hq.kind." + k))}</span>`;

/* ---------- karte ---------- */
const map = L.map("map", { zoomControl: false, preferCanvas: true, attributionControl: true }).setView([56.95, 24.6], 8);
WB.darkTiles().addTo(map);
map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
const routeLayer = L.layerGroup().addTo(map), alongLayer = L.layerGroup().addTo(map), planLayer = L.layerGroup().addTo(map);
const GLYPH = {
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M7 7h4"/>',
  rest: '<path d="M3 10h18M6 10v9M18 10v9M5 15h14M8 10V6h8v4"/>',
  food: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 3v2M11 3v2M15 3v2"/>',
  lodging: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
  moto: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  places: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  hazards: '<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  cams: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  radar: '<path d="M7 15a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 9a4 4 0 0 1-1 7.9"/><path d="M9 19l-1 2M13 19l-1 2"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  meeting: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  viewpoint: '<path d="M2 20l7-11 4 6 3-4 6 9z"/>'
};
const svg = (k, cls = "") => `<svg class="gl ${cls}" viewBox="0 0 24 24" aria-hidden="true">${GLYPH[k] || GLYPH.places}</svg>`;
const pin = (cls, html = "", size = 28) => L.divIcon({ className: "pin " + cls, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
const PLACE_GLYPH = { cafe: "food", fuel: "fuel", service: "moto", rest: "rest", lodging: "lodging", meeting: "meeting", viewpoint: "viewpoint", other: "places" };
const navLink = (lat, lon) => `<a class="pop-nav" href="https://www.google.com/maps/dir/?api=1&destination=${(+lat).toFixed(5)},${(+lon).toFixed(5)}" target="_blank" rel="noopener noreferrer">${esc(t("hq.navigate"))}</a>`;

/* ---------- apakšējā lapa (mobilajā) + cilnes ---------- */
const side = $("#side"), grip = $("#grip");
let sheet = "peek";
function setSheet(s){
  sheet = s; side.classList.remove("sheet-peek", "sheet-half", "sheet-full"); side.classList.add("sheet-" + s);
  grip.setAttribute("aria-expanded", s !== "peek");
}
grip.addEventListener("click", () => { if (grip._dragged) return; setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "peek"); });
grip.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); grip.click(); } });
(() => {
  let y0 = null, ty0 = 0;
  const ty = () => { try { return new DOMMatrix(getComputedStyle(side).transform).m42; } catch (e) { return 0; } };
  grip.addEventListener("pointerdown", e => { if (!isMobile()) return; y0 = e.clientY; ty0 = ty(); grip._dragged = false; grip.setPointerCapture(e.pointerId); side.classList.add("dragging"); });
  grip.addEventListener("pointermove", e => { if (y0 === null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 6) grip._dragged = true; if (grip._dragged) side.style.transform = `translateY(${Math.max(0, ty0 + dy)}px)`; });
  const end = e => {
    if (y0 === null) return;
    const frac = Math.max(0, ty0 + e.clientY - y0) / side.offsetHeight;
    y0 = null; side.classList.remove("dragging"); side.style.transform = "";
    if (!grip._dragged) return;
    setSheet(frac > .68 ? "peek" : frac > .25 ? "half" : "full");
    setTimeout(() => { grip._dragged = false; }, 60);
  };
  grip.addEventListener("pointerup", end); grip.addEventListener("pointercancel", end);
})();
const tabs = $$("#tabs [data-tab]");
let tab = "routes";
function showTab(name, focus){
  tab = name;
  tabs.forEach(b => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  $$(".pane").forEach(p => p.hidden = p.dataset.pane !== name);
  if (!$("#result").hidden) closeResult(true);
  if (isMobile() && sheet === "peek") setSheet("half");
  $("#hqBody").scrollTop = 0;
  $("#mapHint").hidden = name !== "plan";
  if (name === "fuel") loadFuelTab();
  if (name === "pack") packGate();
  if (name === "sos") sosClub();
  if (name === "routes") renderSaved();
}
tabs.forEach((b, i) => {
  b.addEventListener("click", () => showTab(b.dataset.tab));
  b.addEventListener("keydown", e => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { e.preventDefault(); showTab(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true); } });
});
document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) showTab(g.dataset.goto); });
/* kartes atstarpe, lai maršruts nebūtu zem paneļa/lapas */
function fitTo(bounds){
  if (!isMobile()) return map.fitBounds(bounds, { padding: [48, 48] });
  // lapa var vēl kustēties — mērām pēc pārejas beigām
  setTimeout(() => { const mw = $("#mapWrap").getBoundingClientRect(), top = side.getBoundingClientRect().top;
    map.fitBounds(bounds, { paddingTopLeft: [24, 64], paddingBottomRight: [24, Math.max(40, mw.bottom - top + 16)] }); }, 380);
}
mq.addEventListener("change", () => setTimeout(() => map.invalidateSize(), 50));

/* =====================================================================
   SLĀŅI
   ===================================================================== */
const LAYERS = [
  { id: "fuel", group: "road", osm: ['nwr["amenity"="fuel"]'], test: g => g.amenity === "fuel", src: "osm" },
  { id: "rest", group: "road", osm: ['nwr["highway"~"^(rest_area|services)$"]'], test: g => /^(rest_area|services)$/.test(g.highway || ""), src: "osm" },
  { id: "food", group: "road", osm: ['nwr["amenity"~"^(cafe|fast_food|restaurant)$"]["name"]'], test: g => /^(cafe|fast_food|restaurant)$/.test(g.amenity || "") && g.name, src: "osm" },
  { id: "lodging", group: "road", osm: ['nwr["tourism"~"^(hotel|motel|guest_house|camp_site|hostel)$"]'], test: g => /^(hotel|motel|guest_house|camp_site|hostel)$/.test(g.tourism || ""), src: "osm" },
  { id: "moto", group: "road", osm: ['nwr["shop"~"^(motorcycle|motorcycle_repair)$"]', 'nwr["craft"="motorcycle_repair"]'], test: g => /^(motorcycle|motorcycle_repair)$/.test(g.shop || "") || g.craft === "motorcycle_repair", src: "osm" },
  { id: "places", group: "road", src: "club" },
  { id: "hazards", group: "road", src: "user" },
  { id: "cams", group: "road", osm: ['node["highway"="speed_camera"]'], test: g => g.highway === "speed_camera", src: "osm" },
  { id: "radar", group: "wx", src: "rainviewer" },
  { id: "wind", group: "wx", src: "meteo" }
];
const LY = Object.fromEntries(LAYERS.map(l => [l.id, { ...l, on: false, group: l.group, layer: L.layerGroup() }]));
function renderLayerRows(){
  const groups = [["road", t("hq.layers.road")], ["wx", t("hq.layers.wx")]];
  $("#layerRows").innerHTML = groups.map(([g, title]) => `<h3>${esc(title)}</h3>` + LAYERS.filter(l => l.group === g).map(l => `
    <div class="lr" data-id="${l.id}">
      <label class="lr-main"><input type="checkbox" role="switch" data-layer="${l.id}"${LY[l.id].on ? " checked" : ""}><span class="sw" aria-hidden="true"></span>
        <span class="lr-ic ic-${l.id}">${svg(l.id)}</span><span class="lr-txt"><b>${esc(t("hq.l." + l.id))}</b><small>${esc(t("hq.src." + l.src))}</small></span></label>
      <span class="lr-st" aria-live="polite"></span>
    </div>`).join("")).join("");
  LAYERS.forEach(l => layerStatus(l.id));
}
function layerStatus(id, html){
  if (html !== undefined) LY[id].status = html;
  const el = $(`.lr[data-id="${id}"] .lr-st`); if (!el) return;
  el.innerHTML = LY[id].on ? (LY[id].status || "") : "";
  const n = Object.values(LY).filter(x => x.on).length; $("#layerCount").textContent = n; $("#layerCount").hidden = !n;
}
const stRetry = id => `<button type="button" class="st-err" data-retry="${id}" title="${esc(t("hq.retry"))}">${esc(t("hq.layers.err"))} ↻</button>`;
$("#layerRows").addEventListener("change", e => { const c = e.target.closest("[data-layer]"); if (c) toggleLayer(c.dataset.layer, c.checked); });
$("#layerRows").addEventListener("click", e => { const r = e.target.closest("[data-retry]"); if (r) refreshLayer(r.dataset.retry, true); const h = e.target.closest("#hazReport"); if (h) reportHazard(); });
$("#layersBtn").addEventListener("click", () => { const p = $("#layersPanel"); p.hidden = !p.hidden; $("#layersBtn").setAttribute("aria-expanded", !p.hidden); if (!p.hidden) p.querySelector("input").focus(); });
$("#layersClose").addEventListener("click", () => { $("#layersPanel").hidden = true; $("#layersBtn").setAttribute("aria-expanded", "false"); $("#layersBtn").focus(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#layersPanel").hidden) $("#layersClose").click(); });

function toggleLayer(id, on){
  const l = LY[id]; l.on = on;
  ls.set("wb-hq-layers", Object.keys(LY).filter(k => LY[k].on));
  if (on) { l.layer.addTo(map); refreshLayer(id, true); }
  else { map.removeLayer(l.layer); if (id === "radar") radarOff(); l.status = ""; }
  layerStatus(id);
  if (id === "hazards") hazReportBtn();
}
function refreshLayer(id, force){
  const l = LY[id]; if (!l.on) return;
  if (l.osm) return refreshOSM(force);
  if (id === "places") return loadPlaces(force).then(drawPlaces).catch(e => layerStatus(id, stRetry(id)));
  if (id === "hazards") return loadHazards(force).then(drawHazards).catch(e => layerStatus(id, stRetry(id)));
  if (id === "radar") return radarOn();
  if (id === "wind") return refreshWind();
}

/* ---- OSM vietas: viens apvienots Overpass pieprasījums aktīvajiem slāņiem ---- */
const OVERPASS = "https://overpass-api.de/api/interpreter";
let osmAbort = null, osmKey = "";
async function overpass(body, signal){
  return getJSON("overpass", OVERPASS, { method: "POST", body: "data=" + encodeURIComponent(body), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal }, 30000)
    .then(j => (j.elements || []).map(e => ({ id: e.type + e.id, lat: e.lat ?? (e.center && e.center.lat), lon: e.lon ?? (e.center && e.center.lon), tags: e.tags || {} })).filter(e => e.lat != null));
}
async function refreshOSM(force){
  const act = LAYERS.filter(l => l.osm && LY[l.id].on); if (!act.length) return;
  if (map.getZoom() < 10) { act.forEach(l => { LY[l.id].layer.clearLayers(); layerStatus(l.id, `<span class="st-zoom">${esc(t("hq.layers.zoom"))}</span>`); }); osmKey = ""; return; }
  const b = map.getBounds(), bb = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(x => x.toFixed(3)).join(",");
  const key = bb + act.map(l => l.id).join();
  if (!force && key === osmKey) return;
  osmKey = key; osmAbort && osmAbort.abort(); osmAbort = new AbortController();
  act.forEach(l => layerStatus(l.id, `<span class="st-load">…</span>`));
  try {
    const els = await overpass(`[out:json][timeout:25];(${act.flatMap(l => l.osm).map(q => `${q}(${bb});`).join("")});out center tags 500;`, osmAbort.signal);
    const at = now();
    act.forEach(l => {
      const lay = LY[l.id].layer; lay.clearLayers();
      const mine = els.filter(e => l.test(e.tags));
      mine.forEach(e => L.marker([e.lat, e.lon], { icon: pin("poi p-" + l.id, svg(l.id)), title: e.tags.name || e.tags.brand || t("hq.l." + l.id) }).addTo(lay).bindPopup(osmPopup(e, l.id)));
      layerStatus(l.id, `<span class="st-n" title="${esc(t("hq.loadedAt", { t: at }))}">${mine.length}</span>`);
    });
  } catch (e) { if (e.reason === "aborted") return; osmKey = ""; act.forEach(l => layerStatus(l.id, stRetry(l.id))); WB.toast(errText(e), true); }
}
function osmPopup(e, kind){
  const g = e.tags, name = g.name || g.brand || t("hq.l." + kind);
  const sub = kind === "lodging" ? t("hq.osm.tourism." + g.tourism) : kind === "food" ? t("hq.osm.amenity." + g.amenity) : t("hq.l." + kind);
  return `<div class="pop"><b>${esc(name)}</b><span class="pop-k">${esc(sub)}${g.brand && g.name ? " · " + esc(g.brand) : ""}</span>
    ${g.opening_hours ? `<span>${esc(t("hq.osm.hours"))}: ${esc(g.opening_hours)}</span>` : ""}
    ${g.phone ? `<a href="tel:${esc(g.phone.replace(/[^\d+]/g, ""))}">${esc(g.phone)}</a>` : ""}
    ${g.maxspeed ? `<span>${esc(g.maxspeed)} km/h</span>` : ""}
    ${navLink(e.lat, e.lon)}<small class="pop-src">© OpenStreetMap</small></div>`;
}
let mvT; map.on("moveend", () => { clearTimeout(mvT); mvT = setTimeout(() => { refreshOSM(false); refreshWind(); }, 500); });

/* ---- kluba pieturas ---- */
let placesCache = null;
async function loadPlaces(force){
  if (placesCache && !force) return placesCache;
  LY.places.on && layerStatus("places", `<span class="st-load">…</span>`);
  const j = await WB.req("/places");
  return placesCache = { items: j.items, at: Date.now() };
}
function placePopup(p){
  return `<div class="pop"><span class="kb kb-club">${esc(t("hq.kind.club"))}</span><b>${esc(p.name)}</b><span class="pop-k">${esc(t("hq.place." + p.kind))}</span>
    ${WB.L(p.description) ? `<span>${esc(WB.L(p.description))}</span>` : ""}${p.address ? `<span class="muted">${esc(p.address)}</span>` : ""}
    ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(p.url).host)}</a>` : ""}${navLink(p.lat, p.lng)}</div>`;
}
function drawPlaces(c){
  const lay = LY.places.layer; lay.clearLayers();
  c.items.forEach(p => L.marker([p.lat, p.lng], { icon: pin("club", svg(PLACE_GLYPH[p.kind]), 30), title: p.name, zIndexOffset: 500 }).addTo(lay).bindPopup(placePopup(p)));
  layerStatus("places", c.items.length ? `<span class="st-n">${c.items.length}</span>` : `<span class="st-zoom">${esc(t("hq.layers.none"))}</span>`);
}

/* ---- ceļa brīdinājumi (biedru ziņojumi) ---- */
let hazCache = null;
async function loadHazards(force){
  if (hazCache && !force && Date.now() - hazCache.at < 120e3) return hazCache;
  LY.hazards.on && layerStatus("hazards", `<span class="st-load">…</span>`);
  const j = await WB.req("/hazards");
  return hazCache = { items: j.items, at: Date.now() };
}
const hazPopup = h => `<div class="pop"><span class="kb kb-user">${esc(t("hq.kind.user"))}</span><b>${esc(t("hq.haz." + h.kind))}</b>${h.note ? `<span>${esc(h.note)}</span>` : ""}
  <span class="muted">${esc(t("hq.haz.reported", { ago: ago(h.created) }))}${h.by ? " · " + esc(h.by) : ""}</span><small class="pop-src">${esc(fDT.format(h.created))} · ${esc(t("hq.haz.unverified"))}</small></div>`;
function drawHazards(c){
  const lay = LY.hazards.layer; lay.clearLayers();
  c.items.forEach(h => L.marker([h.lat, h.lon], { icon: pin("haz", svg("hazards")), title: t("hq.haz." + h.kind), zIndexOffset: 600 }).addTo(lay).bindPopup(hazPopup(h)));
  layerStatus("hazards", `<span class="st-n" title="${esc(t("hq.loadedAt", { t: WB.time(new Date(c.at)) }))}">${c.items.length}</span>`);
  hazReportBtn();
}
setInterval(() => { if (LY.hazards.on) loadHazards(true).then(drawHazards).catch(() => {}); }, 300e3);
async function hazReportBtn(){
  const row = $(`.lr[data-id="hazards"]`); if (!row) return;
  let b = $("#hazReport", row);
  const me = await WB.session();
  if (LY.hazards.on && me && me.status === "active") { if (!b) row.insertAdjacentHTML("beforeend", `<button type="button" class="link-btn lr-act" id="hazReport">${esc(t("hq.haz.report"))}</button>`); }
  else if (b) b.remove();
}
async function reportHazard(){
  const c = map.getCenter();
  const v = await WB.prompt(t("hq.haz.report"), `<p class="hint">${esc(t("hq.haz.where", { c: `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` }))}</p>
    <label class="field"><span>${esc(t("hq.haz.kind"))}</span><select name="kind">${["gravel", "potholes", "oil", "roadworks", "animals", "other"].map(k => `<option value="${k}">${esc(t("hq.haz." + k))}</option>`).join("")}</select></label>
    <label class="field"><span>${esc(t("hq.haz.note"))}</span><input type="text" name="note" maxlength="200"></label>
    <label class="check"><input type="checkbox" name="me"><span>${esc(t("hq.haz.useMe"))}</span></label>`, t("hq.haz.send"));
  if (!v) return;
  try {
    let p = [c.lat, c.lng];
    if (v.me) p = await locateMe();
    await WB.req("/hazards", { body: { kind: v.kind, note: v.note, lat: p[0], lon: p[1] } });
    WB.toast(t("hq.haz.thanks")); drawHazards(await loadHazards(true));
  } catch (e) { WB.toast(e instanceof SvcError ? errText(e) : e && e.code === undefined && e.message === "geo" ? t("hq.noGeo") : WB.errMsg(e), true); }
}

/* ---- radars (RainViewer) ---- */
const radar = { frames: [], i: 0, layer: null, timer: null, host: "" };
async function radarOn(){
  layerStatus("radar", `<span class="st-load">…</span>`);
  try {
    const j = await getJSON("rainviewer", "https://api.rainviewer.com/public/weather-maps.json");
    radar.host = j.host; radar.frames = [...j.radar.past, ...(j.radar.nowcast || [])]; radar.i = j.radar.past.length - 1;
    if (!radar.frames.length) throw new SvcError("rainviewer", "parse");
    showFrame(); $("#radarCtrl").hidden = false;
    layerStatus("radar", `<span class="st-n">${esc(WB.time(new Date(j.radar.past[j.radar.past.length - 1].time * 1000)))}</span>`);
  } catch (e) { layerStatus("radar", stRetry("radar")); WB.toast(errText(e), true); }
}
function showFrame(){
  const f = radar.frames[radar.i]; if (!f || !LY.radar.on) return;
  const nl = L.tileLayer(`${radar.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, zIndex: 400, maxNativeZoom: 7, maxZoom: 19, attribution: '<a href="https://www.rainviewer.com/api.html" target="_blank" rel="noopener noreferrer">RainViewer</a>' }).addTo(LY.radar.layer);
  nl.on("load", () => { nl.setOpacity(.6); if (radar.layer && radar.layer !== nl) { const o = radar.layer; setTimeout(() => LY.radar.layer.removeLayer(o), 250); } radar.layer = nl; });
  const d = new Date(f.time * 1000); $("#radarTime").textContent = WB.time(d) + (f.time * 1000 > Date.now() ? " ▸" : "");
}
function radarOff(){ clearInterval(radar.timer); radar.timer = null; LY.radar.layer.clearLayers(); radar.layer = null; $("#radarCtrl").hidden = true; $("#radarPlay").setAttribute("aria-pressed", "false"); }
$("#radarPlay").addEventListener("click", () => {
  const b = $("#radarPlay");
  if (radar.timer) { clearInterval(radar.timer); radar.timer = null; b.setAttribute("aria-pressed", "false"); return; }
  b.setAttribute("aria-pressed", "true");
  radar.timer = setInterval(() => { radar.i = (radar.i + 1) % radar.frames.length; showFrame(); }, 700);
});

/* ---- vējš (Open-Meteo, režģis kartes skatā) ---- */
async function refreshWind(){
  if (!LY.wind.on) return;
  const b = map.getBounds(), nx = isMobile() ? 4 : 6, ny = isMobile() ? 5 : 4, lats = [], lons = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { lats.push((b.getSouth() + (y + .5) * (b.getNorth() - b.getSouth()) / ny).toFixed(3)); lons.push((b.getWest() + (x + .5) * (b.getEast() - b.getWest()) / nx).toFixed(3)); }
  layerStatus("wind", `<span class="st-load">…</span>`);
  try {
    let j = await getJSON("meteo", `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh`);
    if (!Array.isArray(j)) j = [j];
    LY.wind.layer.clearLayers();
    j.forEach((p, i) => { const c = p.current; if (!c) return; const sev = c.wind_gusts_10m >= 50 ? "bad" : c.wind_gusts_10m >= 35 ? "warn" : "";
      L.marker([+lats[i], +lons[i]], { icon: L.divIcon({ className: "wind-pin big " + sev, html: `<i style="transform:rotate(${c.wind_direction_10m + 180}deg)"></i><b>${Math.round(c.wind_speed_10m)}<small>/${Math.round(c.wind_gusts_10m)}</small></b>`, iconSize: [46, 46], iconAnchor: [23, 23] }), interactive: false }).addTo(LY.wind.layer); });
    layerStatus("wind", `<span class="st-n" title="km/h">${esc(now())}</span>`);
  } catch (e) { layerStatus("wind", stRetry("wind")); }
}

/* =====================================================================
   PLĀNOTĀJS: sākums, pieturas, galamērķis, aplis
   ===================================================================== */
const blank = () => ({ name: "", lat: null, lng: null });
let stops = [blank(), blank()];
const MAX_STOPS = 10;
const loopEl = $("#loop");
const fmtLL = (lat, lng) => `${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}`;
const parseLL = s => { const m = String(s).trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/); if (!m) return null; const a = +m[1], b = +m[2]; return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null; };
function stopRole(i){
  const last = stops.length - 1;
  if (i === 0) return { mark: "A", cls: "start", label: t("hq.plan.start"), ph: t("hq.plan.startPh") };
  if (i === last) return loopEl.checked ? { mark: "B", cls: "far", label: t("hq.plan.far"), ph: t("hq.plan.farPh") } : { mark: "B", cls: "end", label: t("hq.plan.end"), ph: t("hq.plan.endPh") };
  return { mark: String(i), cls: "via", label: t("hq.plan.via", { n: i }), ph: t("hq.plan.viaPh") };
}
const ICO = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>'
};
function renderStops(focusIdx){
  $("#stops").innerHTML = stops.map((s, i) => { const r = stopRole(i);
    return `<li class="stop" data-i="${i}" draggable="true">
      <span class="stop-mark ${r.cls}" aria-hidden="true">${r.mark}</span>
      <div class="stop-field"><label for="stop${i}">${esc(r.label)}</label>
        <input type="text" id="stop${i}" value="${esc(s.name)}" placeholder="${esc(r.ph)}" data-ok="${s.lat != null ? 1 : 0}" enterkeyhint="next" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugg${i}">
        <ul class="sugg" id="sugg${i}" role="listbox"></ul></div>
      <div class="stop-btns"><span class="drag-h" aria-hidden="true" title="${esc(t("hq.plan.drag"))}">${ICO.grip}</span>
        <button type="button" class="ib" data-act="up" aria-label="${esc(t("hq.plan.up", { n: r.label }))}"${i === 0 ? " disabled" : ""}>${ICO.up}</button>
        <button type="button" class="ib" data-act="down" aria-label="${esc(t("hq.plan.down", { n: r.label }))}"${i === stops.length - 1 ? " disabled" : ""}>${ICO.down}</button>
        <button type="button" class="ib" data-act="del" aria-label="${esc(t("hq.plan.remove", { n: r.label }))}">${ICO.del}</button></div></li>`; }).join("")
    + (loopEl.checked ? `<li class="stop stop-back" aria-hidden="true"><span class="stop-mark start">A</span><span class="back-txt">↺ ${esc(t("hq.plan.backToStart"))}</span></li>` : "");
  $("#addStop").disabled = stops.length >= MAX_STOPS;
  if (focusIdx != null) { const f = $("#stop" + focusIdx); f && f.focus(); }
  drawPlanMarkers();
}
function drawPlanMarkers(){
  planLayer.clearLayers();
  if (!$("#result").hidden) return;
  stops.forEach((s, i) => { if (s.lat == null) return; const r = stopRole(i);
    L.marker([s.lat, s.lng], { icon: pin("stop-pin " + r.cls, `<b>${r.mark}</b>`, 26), draggable: true, title: s.name, keyboard: false }).addTo(planLayer)
      .on("dragend", ev => { const p = ev.target.getLatLng(); setStop(i, fmtLL(p.lat, p.lng), p.lat, p.lng, true); reverseName(i); }); });
}
function setStop(i, name, lat, lng, rerender){
  stops[i] = { name, lat, lng };
  if (rerender) renderStops(); else { const inp = $("#stop" + i); if (inp) { inp.value = name; inp.dataset.ok = lat != null ? 1 : 0; } drawPlanMarkers(); }
}
async function reverseName(i){
  const s = stops[i]; if (!s || s.lat == null) return;
  try {
    const j = await getJSON("photon", `https://photon.komoot.io/reverse?lat=${s.lat}&lon=${s.lng}&limit=1&lang=${PH_LANG}`, {}, 8000);
    const f = j.features && j.features[0]; if (!f) return;
    const p = f.properties, nm = [p.name || p.street, p.city || p.county || p.state].filter((v, k, a) => v && a.indexOf(v) === k).join(", ");
    if (nm && stops[i] === s) setStop(i, nm, s.lat, s.lng);
  } catch (e) { /* koordinātas paliek kā nosaukums */ }
}
const PH_LANG = ["en", "de", "fr"].includes(LANG) ? LANG : "en";
const photonName = p => [p.name, p.street && p.housenumber ? p.street + " " + p.housenumber : p.street, p.city || p.county, p.country].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
let suggT, suggAbort, suggItems = [], suggActive = -1;
$("#stops").addEventListener("input", e => {
  const inp = e.target.closest("input"); if (!inp) return;
  const i = +inp.closest(".stop").dataset.i, q = inp.value.trim();
  const ll = parseLL(q);
  stops[i] = ll ? { name: q, lat: ll[0], lng: ll[1] } : { name: inp.value, lat: null, lng: null };
  inp.dataset.ok = ll ? 1 : 0; drawPlanMarkers();
  const list = $("#sugg" + i); clearTimeout(suggT); suggActive = -1;
  if (ll || q.length < 3) { list.innerHTML = ""; inp.setAttribute("aria-expanded", "false"); return; }
  suggT = setTimeout(async () => {
    suggAbort && suggAbort.abort(); suggAbort = new AbortController();
    const c = map.getCenter();
    try {
      const j = await getJSON("photon", `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=${PH_LANG}&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}`, { signal: suggAbort.signal }, 8000);
      suggItems = (j.features || []).map(f => ({ name: photonName(f.properties), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }));
      list.innerHTML = suggItems.length ? suggItems.map((it, k) => `<li role="option" id="sg${i}-${k}" data-k="${k}">${esc(it.name)}</li>`).join("") : `<li class="sugg-msg">${esc(t("hq.plan.noMatch"))}</li>`;
    } catch (err) {
      if (err.reason === "aborted") return;
      suggItems = []; list.innerHTML = `<li class="sugg-msg">${esc(errText(err))} ${esc(t("hq.plan.geoFallback"))}</li>`;
    }
    inp.setAttribute("aria-expanded", "true");
  }, 300);
});
function pickSugg(i, k){ const it = suggItems[k]; if (!it) return; setStop(i, it.name, it.lat, it.lng); $("#sugg" + i).innerHTML = ""; $("#stop" + i).setAttribute("aria-expanded", "false"); }
$("#stops").addEventListener("mousedown", e => { const li = e.target.closest(".sugg li[data-k]"); if (!li) return; e.preventDefault(); pickSugg(+li.closest(".stop").dataset.i, +li.dataset.k); });
$("#stops").addEventListener("keydown", e => {
  const inp = e.target.closest("input"); if (!inp) return;
  const i = +inp.closest(".stop").dataset.i, list = $("#sugg" + i), opts = $$("li[data-k]", list);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!opts.length) return; e.preventDefault(); suggActive = (suggActive + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, k) => o.setAttribute("aria-selected", k === suggActive)); inp.setAttribute("aria-activedescendant", opts[suggActive].id); }
  else if (e.key === "Enter" && opts.length && inp.dataset.ok !== "1") { e.preventDefault(); pickSugg(i, Math.max(0, suggActive)); const nx = $("#stop" + (i + 1)); nx && nx.focus(); }
  else if (e.key === "Escape") { list.innerHTML = ""; inp.setAttribute("aria-expanded", "false"); }
});
$("#stops").addEventListener("focusout", e => { const inp = e.target.closest("input"); if (inp) setTimeout(() => { const l = $("#sugg" + inp.closest(".stop").dataset.i); if (l && !l.contains(document.activeElement)) { l.innerHTML = ""; inp.setAttribute("aria-expanded", "false"); } }, 180); });
$("#stops").addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const i = +b.closest(".stop").dataset.i, act = b.dataset.act;
  if (act === "up" && i > 0) { [stops[i - 1], stops[i]] = [stops[i], stops[i - 1]]; renderStops(); $(`#stops .stop[data-i="${i - 1}"] [data-act="up"]`)?.focus(); }
  if (act === "down" && i < stops.length - 1) { [stops[i + 1], stops[i]] = [stops[i], stops[i + 1]]; renderStops(); $(`#stops .stop[data-i="${i + 1}"] [data-act="down"]`)?.focus(); }
  if (act === "del") { if (stops.length > 2) stops.splice(i, 1); else stops[i] = blank(); renderStops(Math.min(i, stops.length - 1)); }
});
/* vilkšana (pele); skārienekrānos — pogas ↑ ↓ */
let dragFrom = null;
$("#stops").addEventListener("dragstart", e => { const li = e.target.closest(".stop[data-i]"); if (!li || e.target.closest("input")) return e.preventDefault(); dragFrom = +li.dataset.i; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(dragFrom)); } catch (x) {} });
$("#stops").addEventListener("dragover", e => { if (dragFrom === null) return; const li = e.target.closest(".stop[data-i]"); if (!li) return; e.preventDefault(); $$("#stops .drop").forEach(x => x.classList.remove("drop")); li.classList.add("drop"); });
$("#stops").addEventListener("drop", e => { const li = e.target.closest(".stop[data-i]"); if (dragFrom === null || !li) return; e.preventDefault(); const to = +li.dataset.i; const [s] = stops.splice(dragFrom, 1); stops.splice(to, 0, s); dragFrom = null; renderStops(); });
$("#stops").addEventListener("dragend", () => { dragFrom = null; $$("#stops .dragging, #stops .drop").forEach(x => x.classList.remove("dragging", "drop")); });
$("#addStop").addEventListener("click", () => { if (stops.length >= MAX_STOPS) return; stops.splice(stops.length - 1, 0, blank()); renderStops(stops.length - 2); });
$("#reverse").addEventListener("click", () => { stops.reverse(); renderStops(); });
loopEl.addEventListener("change", () => { ls.set("wb-hq-loop", loopEl.checked); renderStops(); });
const dep = $("#dep");
const setDepNow = () => { const d = new Date(Date.now() + 15 * 6e4); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); dep.value = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
setDepNow();

/* atrašanās vieta */
let me = null, meMarker = null;
const locateMe = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error("geo"));
  navigator.geolocation.getCurrentPosition(p => {
    me = [p.coords.latitude, p.coords.longitude];
    meMarker ? meMarker.setLatLng(me) : (meMarker = L.marker(me, { icon: pin("me", "<i></i>", 22), zIndexOffset: 1000, interactive: false }).addTo(map));
    res(me);
  }, () => rej(new Error("geo")), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
});
$("#useMe").addEventListener("click", async () => { try { const p = await locateMe(); setStop(0, t("hq.myLocation"), p[0], p[1], true); } catch (e) { WB.toast(t("hq.noGeo"), true); } });
$("#locate").addEventListener("click", async () => { try { const p = await locateMe(); map.flyTo(p, 13); } catch (e) { WB.toast(t("hq.noGeo"), true); } });

/* mobilajā: darbs ar karti sakļauj lapu */
map.on("dragstart", () => { if (isMobile() && sheet !== "peek") setSheet("peek"); });
/* klikšķis kartē (Plānot cilnē) → pievienot punktu */
map.on("click", e => {
  if (tab !== "plan" || !$("#result").hidden) { if (isMobile() && sheet !== "peek") setSheet("peek"); return; }
  const { lat, lng } = e.latlng;
  const html = `<div class="pop pick"><b>${esc(fmtLL(lat, lng))}</b><div class="pick-btns">
    <button type="button" class="btn small" data-pick="start">${esc(t("hq.pick.start"))}</button>
    <button type="button" class="btn ghost small" data-pick="via">${esc(t("hq.pick.via"))}</button>
    <button type="button" class="btn ghost small" data-pick="end">${esc(loopEl.checked ? t("hq.pick.far") : t("hq.pick.end"))}</button></div></div>`;
  const pop = L.popup({ closeButton: true, className: "pick-pop" }).setLatLng(e.latlng).setContent(html).openOn(map);
  pop.getElement().addEventListener("click", ev => {
    const b = ev.target.closest("[data-pick]"); if (!b) return;
    let i;
    if (b.dataset.pick === "start") i = 0;
    else if (b.dataset.pick === "end") i = stops.length - 1;
    else { const empty = stops.findIndex((s, k) => k > 0 && k < stops.length - 1 && s.lat == null); if (empty > 0) i = empty; else if (stops.length < MAX_STOPS) { stops.splice(stops.length - 1, 0, blank()); i = stops.length - 2; } else { WB.toast(t("hq.plan.max", { n: MAX_STOPS }), true); return; } }
    setStop(i, fmtLL(lat, lng), lat, lng, true); map.closePopup(); reverseName(i);
  });
});

/* aprēķins */
async function geocodeOne(q){
  const j = await getJSON("photon", `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=${PH_LANG}`, {}, 8000);
  const f = j.features && j.features[0]; if (!f) return null;
  return { name: q, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
}
$("#planForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("#planErr"), btn = $("#planBtn"); err.textContent = "";
  btn.disabled = true; btn.textContent = t("hq.plan.calcing");
  try {
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (s.lat == null && s.name.trim()) { const g = await geocodeOne(s.name.trim()); if (!g) throw new Error(t("hq.plan.notFound", { q: s.name.trim() })); setStop(i, s.name.trim(), g.lat, g.lng); }
    }
    const used = stops.filter(s => s.lat != null);
    if (stops[0].lat == null) throw new Error(t("hq.plan.needStart"));
    if (!loopEl.checked && stops[stops.length - 1].lat == null) throw new Error(t("hq.plan.needEnd"));
    if (used.length < 2) throw new Error(t(loopEl.checked ? "hq.plan.needLoop" : "hq.plan.needEnd"));
    const nm = s => (s.name || "").split(",")[0].trim() || "?";
    const name = loopEl.checked ? t("hq.loopName", { a: nm(used[0]), b: nm(used[used.length - 1]) }) : `${nm(used[0])} → ${nm(used[used.length - 1])}`;
    analyse({ stops: used, loop: loopEl.checked, name });
  } catch (x) { err.textContent = x instanceof SvcError ? errText(x) + " " + t("hq.plan.geoFallback") : x.message; }
  btn.disabled = false; btn.textContent = t("hq.plan.calc");
});

/* =====================================================================
   MARŠRUTA ANALĪZE
   ===================================================================== */
let current = null, seq = 0;
const bearing = (a, b) => { const r = x => x * Math.PI / 180, y = Math.sin(r(b[1] - a[1])) * Math.cos(r(b[0])), x = Math.cos(r(a[0])) * Math.sin(r(b[0])) - Math.sin(r(a[0])) * Math.cos(r(b[0])) * Math.cos(r(b[1] - a[1])); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
const rainColor = p => p >= 60 ? "#E3120B" : p >= 30 ? "#d6a23c" : "#ECE8DF";
const sources = {};
function setSrc(key, kind, html){ sources[key] = { kind, html }; renderSrc(); }
function renderSrc(){
  const order = ["route", "wx", "osm", "countries", "fuel", "haz", "places", "traffic"];
  $("#srcList").innerHTML = order.filter(k => sources[k]).map(k => `<div><dt>${esc(t("hq.srcl." + k))}</dt><dd>${kindBadge(sources[k].kind)} ${sources[k].html}</dd></div>`).join("");
}
async function osrmRoute(pts){
  const coords = pts.map(p => `${(+p[1]).toFixed(5)},${(+p[0]).toFixed(5)}`).join(";");
  const j = await getJSON("osrm", `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`, {}, 20000);
  if (j.code !== "Ok" || !j.routes || !j.routes[0]) throw new SvcError("osrm", j.code === "NoRoute" ? "noroute" : "http");
  return j.routes[0];
}
function showResult(){
  $("#result").hidden = false; side.classList.add("has-result");
  $$(".pane").forEach(p => p.hidden = true); $("#hqBody").scrollTop = 0; $("#mapHint").hidden = true;
  planLayer.clearLayers(); map.closePopup();
  if (isMobile() && sheet === "peek") setSheet("half");
}
function closeResult(keepTab){
  $("#result").hidden = true; side.classList.remove("has-result");
  routeLayer.clearLayers(); alongLayer.clearLayers(); current = null; seq++;
  overview.addTo(map); $$("#clubRoutes [data-route]").forEach(b => b.classList.remove("on"));
  if (!keepTab) showTab(tab); else drawPlanMarkers();
}
$("#resClose").addEventListener("click", () => closeResult(false));
$("#resEdit").addEventListener("click", () => {
  if (!current) return;
  const st = current.stops.map(s => ({ ...s }));
  loopEl.checked = current.loop; stops = st.length >= 2 ? st : [...st, blank()];
  closeResult(true); showTab("plan"); renderStops();
});

async function analyse(opts){
  const my = ++seq;
  const { stops: st, loop, name, sub = "" } = opts;
  const pts = st.map(s => [s.lat, s.lng]); if (loop) pts.push(pts[0]);
  map.removeLayer(overview); showResult();
  for (const k in sources) delete sources[k];
  $("#resName").textContent = name; $("#resSub").textContent = t("hq.plan.calcing");
  $("#resBadges").innerHTML = loop ? `<span class="badge">${esc(t("hq.res.loopBadge"))}</span>` : "";
  ["#kDist", "#kTime", "#kStops", "#kRain"].forEach(s => { $(s).textContent = "…"; $(s).style.color = ""; });
  ["#segments", "#rainbar", "#alerts", "#itin", "#resErr", "#fuelRoute", "#fuelCountries", "#restRoute", "#traffic", "#wxSrc", "#rbEnd"].forEach(s => $(s).innerHTML = "");
  $("#fuelRoute").innerHTML = $("#restRoute").innerHTML = `<p class="muted small">${esc(t("hq.loading"))}</p>`;
  routeLayer.clearLayers(); alongLayer.clearLayers();
  current = { stops: st, loop, name, pts };
  exportLinks();
  let route;
  try { route = await osrmRoute(pts); }
  catch (e) {
    if (my !== seq) return;
    $("#resSub").textContent = ""; ["#kDist", "#kTime", "#kStops", "#kRain"].forEach(s => $(s).textContent = "—");
    $("#fuelRoute").innerHTML = $("#restRoute").innerHTML = "";
    errBox($("#resErr"), e, () => analyse(opts));
    setSrc("route", "api", `<span class="bad-t">${esc(errText(e))}</span>`);
    const draft = L.polyline(pts, { color: "#ECE8DF", weight: 2, opacity: .5, dashArray: "4 8" }).addTo(routeLayer);
    st.forEach((s, i) => L.marker([s.lat, s.lng], { icon: pin("stop-pin " + (i ? "via" : "start"), `<b>${i ? i : "A"}</b>`, 24) }).addTo(routeLayer));
    fitTo(draft.getBounds());
    return;
  }
  if (my !== seq) return;
  const calcAt = now();
  const geo = route.geometry.coordinates.map(c => [c[1], c[0]]);
  const cum = [0]; for (let i = 1; i < geo.length; i++) cum.push(cum[i - 1] + WB.hav(geo[i - 1], geo[i]));
  const total = Math.max(route.distance / 1000 || cum[cum.length - 1], 0.001), dur = Math.max(route.duration, 1);
  const cumN = cum.map(c => c * total / Math.max(cum[cum.length - 1], 0.001)); // normalizēts uz OSRM kopējo attālumu
  const depT = new Date(dep.value || Date.now());
  const eta = new Date(depT.getTime() + dur * 1000);
  current = { ...current, geo, cum: cumN, total, dur, route };
  // līnija: viss maršruts (arī apļa atpakaļceļš)
  L.polyline(geo, { color: "#000", weight: 10, opacity: .85, interactive: false }).addTo(routeLayer);
  const base = L.polyline(geo, { color: "#ECE8DF", weight: 5, opacity: .9 }).addTo(routeLayer);
  st.forEach((s, i) => { const r = i === 0 ? { cls: "start", mark: "A" } : i === st.length - 1 && !loop ? { cls: "end", mark: "B" } : { cls: "via", mark: String(i) };
    L.marker([s.lat, s.lng], { icon: pin("stop-pin " + r.cls, `<b>${r.mark}</b>`, 26), title: s.name, zIndexOffset: 800 }).addTo(routeLayer).bindTooltip(s.name || "", { className: "tt", direction: "top", offset: [0, -12] }); });
  fitTo(base.getBounds());
  $("#kDist").textContent = km(total);
  $("#kTime").textContent = fmtDur(dur);
  $("#kStops").textContent = String(loop ? st.length - 1 : st.length - 2);
  $("#resSub").textContent = `${sub ? sub + " · " : ""}${t("hq.res.depart")} ${WB.time(depT)} · ${t("hq.res.arrive")} ${WB.time(eta)}${WB.iso(eta) !== WB.iso(depT) ? " (" + WB.dayLabel(eta) + ")" : ""}`;
  $("#rbEnd").textContent = km(total);
  setSrc("route", "api", `${esc(t("hq.srcv.route"))} · ${esc(t("hq.calcAt", { t: calcAt }))}`);
  setSrc("traffic", "none", esc(t("hq.srcv.traffic")));
  // pieturu saraksts ar km un ierašanās laiku
  let accD = 0, accT = 0;
  const legs = route.legs || [];
  $("#itin").innerHTML = st.map((s, i) => {
    if (i > 0 && legs[i - 1]) { accD += legs[i - 1].distance; accT += legs[i - 1].duration; }
    const r = i === 0 ? "A" : i === st.length - 1 && !loop ? "B" : String(i);
    return `<li><span class="stop-mark ${i === 0 ? "start" : i === st.length - 1 && !loop ? "end" : "via"}">${r}</span><span class="it-name">${esc(s.name || fmtLL(s.lat, s.lng))}</span><span class="it-meta num">${i ? km(accD / 1000) + " · " : ""}${WB.time(new Date(depT.getTime() + accT * 1000))}</span></li>`;
  }).join("") + (loop && legs[st.length - 1] ? `<li><span class="stop-mark start">A</span><span class="it-name">↺ ${esc(st[0].name || t("hq.plan.start"))}</span><span class="it-meta num">${km(total)} · ${WB.time(eta)}</span></li>` : "");
  // ceļš priekšā (pēc ceļu numuriem)
  const roads = []; let acc = 0;
  legs.forEach(leg => (leg.steps || []).forEach(sx => {
    const label = sx.ref ? sx.ref.split(";")[0] + (sx.name ? " " + sx.name : "") : sx.name;
    acc += sx.distance; if (!label) return;
    const last = roads[roads.length - 1];
    if (last && last.label === label) { last.dist += sx.distance; last.end = acc; } else roads.push({ label, dist: sx.distance, start: acc - sx.distance, end: acc });
  }));
  const ctxR = { geo, cum: cumN, total, dur, depT, eta, st, loop, my, roads };
  weather(ctxR);
  alongRoute(ctxR);
  hazardsAlong(ctxR);
  countriesAlong(ctxR);
}

/* ---- laikapstākļi pa maršrutu ---- */
async function weather(c){
  const { geo, cum, total, dur, depT, eta, my } = c;
  const step = Math.max(8, total / 32), samples = [];
  for (let d = 0; d <= total; d += step) { let i = cum.findIndex(x => x >= d); if (i < 0) i = geo.length - 1; samples.push(i); }
  if (samples[samples.length - 1] !== geo.length - 1) samples.push(geo.length - 1);
  const S = samples.map((gi, k) => { const prev = geo[samples[Math.max(0, k - 1)]], next = geo[samples[Math.min(samples.length - 1, k + 1)]];
    return { gi, p: geo[gi], km: cum[gi], t: new Date(depT.getTime() + dur * 1000 * (cum[gi] / total)), brg: bearing(prev, next === prev ? geo[Math.min(geo.length - 1, gi + 1)] : next) }; });
  $("#wxSrc").innerHTML = ""; $("#kRain").textContent = "…";
  let W;
  try {
    const qs = `latitude=${S.map(s => s.p[0].toFixed(3)).join(",")}&longitude=${S.map(s => s.p[1].toFixed(3)).join(",")}&hourly=precipitation_probability,precipitation,temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code&daily=sunset&forecast_days=7&timeformat=unixtime&timezone=GMT`;
    W = await getJSON("meteo", "https://api.open-meteo.com/v1/forecast?" + qs, {}, 20000);
    if (!Array.isArray(W)) W = [W];
  } catch (e) {
    if (my !== seq) return;
    $("#kRain").textContent = "—"; $("#rainbar").closest(".res-sec").hidden = true;
    const box = document.createElement("div"); $("#alerts").prepend(box); errBox(box, e, () => { box.remove(); weather(c); });
    setSrc("wx", "api", `<span class="bad-t">${esc(errText(e))}</span>`);
    drawRainLine(c, S, false);
    return;
  }
  if (my !== seq) return;
  setSrc("wx", "api", `${esc(t("hq.srcv.wx"))} · ${esc(t("hq.loadedAt", { t: now() }))}`); $("#rainbar").closest(".res-sec").hidden = false;
  $("#wxSrc").textContent = `Open-Meteo · ${t("hq.loadedAt", { t: now() })}`;
  let maxRain = 0, maxRainKm = 0, maxCross = 0, maxCrossKm = 0, tMin = 99, tMax = -99, scores = [], outOfRange = false;
  S.forEach((s, k) => {
    if (!W[k] || !W[k].hourly) return;
    const h = W[k].hourly, ts = s.t.getTime() / 1000;
    let i = h.time.findIndex(x => x > ts - 1800); if (i < 0) { i = h.time.length - 1; outOfRange = true; }
    s.rain = h.precipitation_probability[i] ?? 0; s.mm = h.precipitation[i] ?? 0; s.temp = h.temperature_2m[i]; s.wind = h.wind_speed_10m[i]; s.gust = h.wind_gusts_10m[i]; s.wdir = h.wind_direction_10m[i]; s.code = h.weather_code[i];
    s.cross = Math.abs(Math.sin((s.wdir - s.brg) * Math.PI / 180)) * s.gust;
    if (s.rain > maxRain) { maxRain = s.rain; maxRainKm = s.km; }
    if (s.cross > maxCross) { maxCross = s.cross; maxCrossKm = s.km; }
    tMin = Math.min(tMin, s.temp); tMax = Math.max(tMax, s.temp);
    s.score = WB.rideIndex({ rain: s.rain, temp: s.temp, gust: s.gust, code: s.code, precip: s.mm }); scores.push(s.score);
  });
  drawRainLine(c, S, true);
  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  $("#kRain").textContent = maxRain + "%"; $("#kRain").style.color = rainColor(maxRain);
  const A = [];
  if (outOfRange) A.push(["warn", t("hq.a.range")]);
  if (maxRain >= 50) A.push(["warn", t("hq.a.rain", { p: maxRain, km: Math.round(maxRainKm) })]);
  else if (maxRain >= 25) A.push(["warn", t("hq.a.showers", { p: maxRain, km: Math.round(maxRainKm) })]);
  if (maxCross >= 45) A.push(["bad", t("hq.a.cross", { v: Math.round(maxCross), km: Math.round(maxCrossKm) })]);
  else if (maxCross >= 30) A.push(["warn", t("hq.a.cross", { v: Math.round(maxCross), km: Math.round(maxCrossKm) })]);
  if (tMin < 2 && tMin !== 99) A.push(["bad", t("hq.a.ice")]);
  else if (tMin < 6 && tMin !== 99) A.push(["warn", t("hq.a.cold", { v: Math.round(tMin) })]);
  if (S.some(s => [95, 96, 99].includes(s.code))) A.push(["bad", t("hq.a.storm")]);
  const lastW = W[W.length - 1];
  if (lastW && lastW.daily) { const ss = lastW.daily.sunset.map(x => x * 1000).find(x => WB.iso(new Date(x)) === WB.iso(eta)); if (ss && eta.getTime() > ss) A.push(["warn", t("hq.a.dark", { time: WB.time(new Date(ss)) })]); }
  if (tMax > -99) A.push(["ok", t("hq.a.temp", { a: Math.round(tMin), b: Math.round(tMax) }) + (score != null ? " " + t("hq.a.index", { n: score, v: WB.rideVerdict(score) }) : "") + " " + gearTip(tMin, maxRain)]);
  $("#alerts").insertAdjacentHTML("beforeend", A.map(([k, m]) => `<p class="al ${k}">${esc(m)}</p>`).join(""));
  $("#rainbar").innerHTML = S.map(s => `<i style="height:${Math.max(4, s.rain ?? 0)}%;background:${rainColor(s.rain ?? 0)}" title="${Math.round(s.km)} km · ${WB.time(s.t)} · ${s.rain ?? "—"}%"></i>`).join("");
  const segs = c.roads.filter(r => r.dist > 4000).slice(0, 14);
  $("#segments").innerHTML = segs.map(r => {
    const midKm = (r.start + r.end) / 2000, s = S.reduce((a, b) => Math.abs(b.km - midKm) < Math.abs(a.km - midKm) ? b : a, S[0]);
    return `<li><span class="sg-road">${esc(r.label)}</span><span class="sg-km num">${Math.round(r.start / 1000)}–${Math.round(r.end / 1000)} km</span>
      <span class="sg-wx">${WB.time(s.t)} · <b style="color:${rainColor(s.rain ?? 0)}">☂ ${s.rain ?? "—"}%</b>${s.temp != null ? " · " + Math.round(s.temp) + "°" : ""}${s.gust != null ? " · ↯ " + Math.round(s.gust) + " km/h" : ""}${s.cross >= 30 ? ` · <b class="warn-t">${esc(t("hq.crossShort"))}</b>` : ""}</span></li>`;
  }).join("") || `<li class="muted">—</li>`;
}
const gearTip = (tMin, rain) => tMin < 10 ? t("hq.gear.cold") : rain >= 40 ? t("hq.gear.rain") : tMin > 25 ? t("hq.gear.hot") : t("hq.gear.ok");
function drawRainLine(c, S, hasWx){
  const { geo } = c;
  if (hasWx) for (let k = 0; k < S.length - 1; k++) {
    const seg = geo.slice(S[k].gi, S[k + 1].gi + 1); if (seg.length < 2) continue;
    L.polyline(seg, { color: rainColor(Math.max(S[k].rain ?? 0, S[k + 1].rain ?? 0)), weight: 5, opacity: .95 }).addTo(routeLayer)
      .bindTooltip(`${Math.round(S[k].km)} km · ${WB.time(S[k].t)} · ☂ ${S[k].rain ?? "—"}%${S[k].temp != null ? " · " + Math.round(S[k].temp) + "°" : ""}`, { sticky: true, className: "tt" });
  }
  if (hasWx) S.forEach((s, k) => { if (k % 4 || s.wdir == null) return;
    L.marker(s.p, { icon: L.divIcon({ className: "wind-pin", html: `<i style="transform:rotate(${s.wdir + 180}deg)"></i><b>${Math.round(s.gust)}</b>`, iconSize: [34, 34], iconAnchor: [17, 17] }), interactive: false }).addTo(routeLayer); });
  // virziena bultiņas: apļa maršrutā redzams, kurā virzienā brauc
  const arrows = Math.min(10, Math.max(3, Math.round(c.total / 40)));
  for (let k = 1; k < arrows; k++) { const d = c.total * k / arrows; let i = c.cum.findIndex(x => x >= d); if (i <= 0 || i >= geo.length - 1) continue;
    L.marker(geo[i], { icon: L.divIcon({ className: "dir-pin", html: `<i style="transform:rotate(${bearing(geo[i - 1], geo[Math.min(geo.length - 1, i + 3)])}deg)"></i>`, iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(routeLayer); }
}

/* ---- gar maršrutu: DUS + atpūtas vietas (Overpass „around” ap līniju) + kluba pieturas ---- */
function probes(geo, cum, everyKm){ const out = []; let last = -1e9; for (let i = 0; i < geo.length; i++) if (cum[i] - last >= everyKm || i === geo.length - 1) { out.push(i); last = cum[i]; } return out; }
function nearest(pt, geo, idx){ let best = 1e9, bi = 0; for (const i of idx) { const d = WB.hav(pt, geo[i]); if (d < best) { best = d; bi = i; } } return { d: best, i: bi }; }
async function alongRoute(c){
  const { geo, cum, total, my } = c;
  const fine = probes(geo, cum, 1), coarse = probes(geo, cum, total > 600 ? 3 : 2);
  const line = coarse.map(i => `${geo[i][0].toFixed(4)},${geo[i][1].toFixed(4)}`).join(",");
  const q = `[out:json][timeout:40];(nwr["amenity"="fuel"](around:1200,${line});nwr["highway"~"^(rest_area|services)$"](around:1200,${line}););out center tags 800;`;
  let els;
  // kluba pieturas — neatkarīgi no Overpass
  const clubP = loadPlaces().then(pc => pc.items.map(p => ({ p, n: nearest([p.lat, p.lng], geo, fine) })).filter(x => x.n.d <= 3).map(x => ({ ...x.p, km: cum[x.n.i], off: x.n.d })).sort((a, b) => a.km - b.km)).catch(() => null);
  try { els = await overpass(q); }
  catch (e) {
    if (my !== seq) return;
    errBox($("#fuelRoute"), e, () => alongRoute(c));
    setSrc("osm", "api", `<span class="bad-t">${esc(errText(e))}</span>`);
    renderRest(c, [], await clubP, e);
    return;
  }
  if (my !== seq) return;
  setSrc("osm", "api", `${esc(t("hq.srcv.osm"))} · ${esc(t("hq.loadedAt", { t: now() }))}`);
  const near = [];
  for (const s of els) { const n = nearest([s.lat, s.lon], geo, fine); if (n.d <= 1.3) near.push({ ...s, km: cum[n.i], off: n.d }); }
  near.sort((a, b) => a.km - b.km);
  const fuel = near.filter(s => s.tags.amenity === "fuel").filter((s, i, a) => !i || s.km - a[i - 1].km > .3);
  const rest = near.filter(s => /^(rest_area|services)$/.test(s.tags.highway || "")).filter((s, i, a) => !i || s.km - a[i - 1].km > .5);
  fuel.forEach(s => L.marker([s.lat, s.lon], { icon: pin("poi p-fuel", svg("fuel"), 24), title: s.tags.brand || s.tags.name || t("hq.l.fuel") }).addTo(alongLayer).bindPopup(osmPopup(s, "fuel") ));
  rest.forEach(s => L.marker([s.lat, s.lon], { icon: pin("poi p-rest", svg("rest"), 24), title: s.tags.name || t("hq.l.rest") }).addTo(alongLayer).bindPopup(osmPopup(s, "rest")));
  let gap = 0, gapAt = 0, prev = 0; for (const s of [...fuel, { km: total }]) { if (s.km - prev > gap) { gap = s.km - prev; gapAt = prev; } prev = s.km; }
  const label = s => s.tags.brand || s.tags.name || t("hq.l.fuel");
  const fli = s => `<li><b class="num">${Math.round(s.km)} km</b><span>${esc(label(s))}</span>${s.tags.opening_hours === "24/7" ? '<span class="tag">24/7</span>' : "<span></span>"}</li>`;
  $("#fuelRoute").innerHTML = (fuel.length ? `<ul class="poi-list">${fuel.slice(0, 8).map(fli).join("")}</ul>${fuel.length > 8 ? `<details class="more-c"><summary>${esc(t("hq.more", { n: fuel.length - 8 }))}</summary><ul class="poi-list">${fuel.slice(8, 60).map(fli).join("")}</ul></details>` : ""}` : `<p class="muted small">${esc(t("hq.res.noFuel"))}</p>`)
    + (gap > 120 ? `<p class="al warn">${esc(t("hq.res.fuelGap", { km: Math.round(gap), at: Math.round(gapAt) }))}</p>` : "")
    + `<p class="src">${esc(t("hq.srcv.osmShort"))}</p>`;
  renderRest(c, rest, await clubP);
}
function renderRest(c, rest, club, err){
  if (c.my !== seq) return;
  const cl = club || [];
  if (club) { setSrc("places", "club", `${esc(t("hq.srcv.places"))} · ${esc(t("hq.loadedAt", { t: now() }))}`); cl.forEach(p => L.marker([p.lat, p.lng], { icon: pin("club", svg(PLACE_GLYPH[p.kind]), 28), title: p.name, zIndexOffset: 700 }).addTo(alongLayer).bindPopup(placePopup(p))); }
  $("#restRoute").innerHTML = (cl.length ? `<ul class="poi-list">${cl.map(p => `<li><b class="num">${Math.round(p.km)} km</b><span>${esc(p.name)} <span class="muted">${esc(t("hq.place." + p.kind))}</span></span>${kindBadge("club")}</li>`).join("")}</ul>` : "")
    + (err ? "" : rest.length ? `<ul class="poi-list">${rest.slice(0, 12).map(s => `<li><b class="num">${Math.round(s.km)} km</b><span>${esc(s.tags.name || t(s.tags.highway === "services" ? "hq.osm.services" : "hq.osm.rest_area"))}</span></li>`).join("")}</ul>` : `<p class="muted small">${esc(t("hq.res.noRest"))}</p>`)
    + (!cl.length && club ? `<p class="muted small">${esc(t("hq.res.noClub"))}</p>` : "");
}

/* ---- satiksme (godīgs paziņojums) + biedru ziņojumi gar maršrutu ---- */
const TRAFFIC_LINKS = { LV: ["Latvijas Valsts ceļi", "https://lvceli.lv"], LT: ["Eismoinfo (LAKD)", "https://eismoinfo.lt"], EE: ["Tark Tee (Transpordiamet)", "https://www.tarktee.ee"], FI: ["Fintraffic", "https://liikennetilanne.fintraffic.fi"] };
function extLinks(countries){
  let cc = (countries || []).filter(x => TRAFFIC_LINKS[x]); if (!cc.length) cc = ["LV", "LT", "EE"];
  return cc.map(x => `<li><span class="cc">${x}</span><a href="${TRAFFIC_LINKS[x][1]}" target="_blank" rel="noopener noreferrer">${esc(TRAFFIC_LINKS[x][0])}</a></li>`).join("");
}
function trafficBlock(countries){
  return `<div class="notice"><b>${esc(t("hq.traffic.title"))}</b><p>${esc(t("hq.traffic.text"))}</p>
    <ul class="ext-links" id="extLinks">${extLinks(countries)}</ul>
    <p class="src">${esc(t("hq.traffic.links"))}</p></div><h4 class="sub4">${esc(t("hq.traffic.reports"))}</h4><div id="hazRoute"><p class="muted small">${esc(t("hq.loading"))}</p></div>`;
}
async function hazardsAlong(c){
  $("#traffic").innerHTML = trafficBlock(null);
  try {
    const hc = await loadHazards(true);
    if (c.my !== seq) return;
    const idx = probes(c.geo, c.cum, 1);
    const near = hc.items.map(h => ({ h, n: nearest([h.lat, h.lon], c.geo, idx) })).filter(x => x.n.d <= 1).map(x => ({ ...x.h, km: c.cum[x.n.i] })).sort((a, b) => a.km - b.km);
    near.forEach(h => L.marker([h.lat, h.lon], { icon: pin("haz", svg("hazards"), 26), zIndexOffset: 900 }).addTo(alongLayer).bindPopup(hazPopup(h)));
    $("#hazRoute").innerHTML = (near.length ? `<ul class="poi-list haz-list">${near.map(h => `<li><b class="num">${Math.round(h.km)} km</b><span><b>${esc(t("hq.haz." + h.kind))}</b>${h.note ? " — " + esc(h.note) : ""}<small class="muted">${esc(t("hq.haz.reported", { ago: ago(h.created) }))} · ${esc(fDT.format(h.created))}</small></span>${kindBadge("user")}</li>`).join("")}</ul>`
      : `<p class="muted small">${esc(t("hq.haz.noneOnRoute"))}</p>`) + `<p class="src">${esc(t("hq.srcv.hazShort", { t: WB.time(new Date(hc.at)) }))}</p>`;
    setSrc("haz", "user", `${esc(t("hq.srcv.haz"))} · ${esc(t("hq.loadedAt", { t: WB.time(new Date(hc.at)) }))}`);
  } catch (e) {
    if (c.my !== seq) return;
    errBox($("#hazRoute"), e, () => hazardsAlong(c));
    setSrc("haz", "user", `<span class="bad-t">${esc(WB.errMsg(e))}</span>`);
  }
}

/* ---- valstis maršrutā (Photon reverse, ≤ 10 punkti) → vidējās degvielas cenas ---- */
async function countriesAlong(c){
  const { geo, cum, total, my } = c;
  const n = Math.min(10, Math.max(2, Math.ceil(total / 60) + 1)), idx = [];
  for (let k = 0; k < n; k++) { const d = total * k / (n - 1); let i = cum.findIndex(x => x >= d); idx.push(i < 0 ? geo.length - 1 : i); }
  const res = await Promise.all(idx.map(i => getJSON("photon", `https://photon.komoot.io/reverse?lat=${geo[i][0].toFixed(4)}&lon=${geo[i][1].toFixed(4)}&limit=1`, {}, 10000).then(j => j.features && j.features[0] && j.features[0].properties.countrycode).catch(() => undefined)));
  if (my !== seq) return;
  const ok = res.filter(x => x !== undefined);
  const list = [...new Set(res.filter(Boolean).map(x => x.toUpperCase()))];
  if (!ok.length) setSrc("countries", "api", `<span class="bad-t">${esc(t("hq.err.photon"))}</span>`);
  else setSrc("countries", "api", `${esc(t("hq.srcv.countries", { n: ok.length }))} · ${esc(t("hq.loadedAt", { t: now() }))}`);
  current.countries = list;
  if (list.length) { $("#resBadges").insertAdjacentHTML("beforeend", list.map(x => `<span class="badge" title="${esc(country(x))}">${x}</span>`).join("")); const tb = $("#extLinks"); if (tb) tb.innerHTML = extLinks(list); }
  try {
    const f = await loadFuel();
    if (my !== seq) return;
    $("#fuelCountries").innerHTML = routeFuelHtml(f, list.length ? list : null);
    if (f.available && f.ec) setSrc("fuel", "official", `${esc(t("hq.fuel.ecShort"))} · ${esc(t("hq.fuel.asOf", { d: isoDate(f.ec.date) }))}`);
    else setSrc("fuel", "official", esc(t("hq.fuel.none")));
  } catch (e) { if (my === seq) errBox($("#fuelCountries"), e, () => countriesAlong(c)); }
}

/* ---- eksports, saglabāšana, kopīgošana ---- */
const f5 = p => `${(+p[0]).toFixed(5)},${(+p[1]).toFixed(5)}`;
function shareUrl(){
  const u = new URL(location.href); u.search = ""; u.hash = "";
  u.searchParams.set("pts", current.stops.map(s => f5([s.lat, s.lng])).join(";"));
  if (current.loop) u.searchParams.set("loop", "1");
  u.searchParams.set("name", current.name);
  const labels = current.stops.map(s => (s.name || "").replace(/\|/g, "/").slice(0, 60));
  if (labels.some(Boolean)) u.searchParams.set("labels", labels.join("|"));
  return u.toString();
}
function exportLinks(){
  const pts = current.pts, g = new URL("https://www.google.com/maps/dir/");
  g.searchParams.set("api", "1"); g.searchParams.set("origin", f5(pts[0])); g.searchParams.set("destination", f5(pts[pts.length - 1])); g.searchParams.set("travelmode", "driving");
  if (pts.length > 2) g.searchParams.set("waypoints", pts.slice(1, -1).map(f5).join("|"));
  $("#exGmaps").href = g.toString();
  $("#exWaze").href = `https://waze.com/ul?ll=${f5(current.loop && pts.length > 2 ? pts[1] : pts[pts.length - 1])}&navigate=yes`;
}
$("#exGpx").addEventListener("click", () => {
  if (!current || !current.geo) return;
  const { geo, stops: st, name, loop } = current, step = Math.max(1, Math.floor(geo.length / 2500));
  const x = s => esc(s).replace(/&#39;/g, "&apos;");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="WBMC Ride HQ" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${x(name)}</name></metadata>\n${st.map((p, i) => `<wpt lat="${p.lat}" lon="${p.lng}"><name>${x(p.name || (i === 0 ? "Start" : "Via " + i))}</name></wpt>`).join("\n")}\n<rte><name>${x(name)}</name>${[...st, ...(loop ? [st[0]] : [])].map(p => `<rtept lat="${p.lat}" lon="${p.lng}"/>`).join("")}</rte>\n<trk><name>${x(name)}</name><trkseg>${geo.filter((_, i) => i % step === 0 || i === geo.length - 1).map(p => `<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"/>`).join("")}</trkseg></trk></gpx>`;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" })); a.download = (name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "route") + ".gpx"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$("#exShare").addEventListener("click", async () => {
  if (!current) return;
  const u = shareUrl();
  if (navigator.share && isMobile()) { try { await navigator.share({ title: current.name, url: u }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(u); WB.toast(t("hq.res.linkCopied")); }
  catch (e) { WB.modal({ title: t("hq.res.share"), body: `<label class="field"><span>${esc(t("hq.res.link"))}</span><input type="url" readonly value="${esc(u)}"></label>`, actions: [{ label: t("btn.done"), value: "ok", primary: true }], onOpen: d => { const i = d.querySelector("input"); i.focus(); i.select(); } }); }
});
const LOCAL_KEY = "wb-hq-routes";
$("#exSave").addEventListener("click", async () => {
  if (!current) return;
  const sess = await WB.session(), active = sess && sess.status === "active";
  const v = await WB.prompt(t("hq.save.title"), `<label class="field"><span>${esc(t("hq.save.name"))}</span><input type="text" name="name" maxlength="80" required value="${esc(current.name)}"></label>`
    + (active ? `<label class="field"><span>${esc(t("hq.save.vis"))}</span><select name="visibility"><option value="private">${esc(t("hq.save.private"))}</option>${WB.can("routes", "c") ? `<option value="club">${esc(t("hq.save.club"))}</option>` : ""}</select></label>`
      : `<p class="hint">${esc(t("hq.save.local"))} <a href="pieslegties.html?next=${encodeURIComponent("karte.html")}">${esc(t("hq.save.login"))}</a></p>`), t("hq.save.ok"));
  if (!v) return;
  const name = (v.name || current.name).trim().slice(0, 80) || current.name;
  const rec = { name, points: current.stops.map(s => ({ lat: +(+s.lat).toFixed(5), lng: +(+s.lng).toFixed(5), ...(s.name ? { name: s.name.slice(0, 80) } : {}) })), roundTrip: current.loop, distanceKm: current.total ? Math.round(current.total * 10) / 10 : null, durationMin: current.dur ? Math.round(current.dur / 60) : null };
  try {
    if (active) { await WB.req("/routes", { body: { ...rec, visibility: v.visibility || "private" } }); WB.toast(t(v.visibility === "club" ? "hq.save.doneClub" : "hq.save.done")); }
    else { const list = ls.get(LOCAL_KEY, []); list.unshift({ id: "l" + Date.now().toString(36), ...rec, created: Date.now() }); ls.set(LOCAL_KEY, list.slice(0, 30)); WB.toast(t("hq.save.doneLocal")); }
    savedCache = null;
  } catch (e) { WB.toast(WB.errMsg(e), true); }
});

/* =====================================================================
   MARŠRUTU CILNE
   ===================================================================== */
const R = window.ROUTES || [];
$("#clubRoutes").innerHTML = R.map(r => `<li><button type="button" class="rl" data-route="${esc(r.id)}"><span class="rl-t"><b>${esc(TL(r.name))}</b><span class="num">~${r.km} km</span></span><small>${esc(r.region)} · ${esc(t("route.level." + r.level))}</small><small class="muted">${esc(TL(r.text))}</small></button></li>`).join("");
$("#clubRoutes").addEventListener("click", e => { const b = e.target.closest("[data-route]"); if (b) loadClubRoute(b.dataset.route); });
const overview = L.layerGroup().addTo(map);
R.forEach(r => {
  const pl = L.polyline(r.pts, { color: "#ECE8DF", weight: 2, opacity: .4, dashArray: "4 8" }).addTo(overview)
    .bindTooltip(TL(r.name), { sticky: true, className: "tt" }).on("click", () => loadClubRoute(r.id));
  pl.on("mouseover", () => pl.setStyle({ opacity: .95, weight: 3 })).on("mouseout", () => pl.setStyle({ opacity: .4, weight: 2 }));
  L.circleMarker(r.pts[0], { radius: 4, color: "#ECE8DF", weight: 1.5, fillColor: "#000", fillOpacity: 1 }).addTo(overview);
});
function loadClubRoute(id){
  const r = R.find(x => x.id === id); if (!r) return;
  $$("#clubRoutes [data-route]").forEach(b => b.classList.toggle("on", b.dataset.route === id));
  const pts = r.pts, loop = pts.length > 2 && WB.hav(pts[0], pts[pts.length - 1]) < .3;
  const st = (loop ? pts.slice(0, -1) : pts).map((p, i) => ({ name: i === 0 && WB.hav(p, [C.homeBase.lat, C.homeBase.lon]) < 1 ? C.homeBase.name : fmtLL(p[0], p[1]), lat: p[0], lng: p[1] }));
  analyse({ stops: st, loop, name: TL(r.name), sub: r.region });
}
let savedCache = null;
async function renderSaved(){
  const box = $("#savedRoutes");
  const local = ls.get(LOCAL_KEY, []);
  const sess = await WB.session(), active = sess && sess.status === "active";
  let srv = null, err = null;
  if (active) { try { srv = savedCache || (savedCache = await WB.req("/routes")); } catch (e) { err = e; } }
  const row = (r, src, extra = "") => `<li><button type="button" class="rl" data-open="${src}:${esc(r.id)}"><span class="rl-t"><b>${esc(r.name)}</b><span class="num">${r.distanceKm != null ? km(r.distanceKm) : ""}</span></span>
    <small>${r.roundTrip ? esc(t("hq.res.loopBadge")) + " · " : ""}${esc(t("hq.routes.points", { n: r.points.length }))}${r.durationMin ? " · " + esc(fmtDur(r.durationMin * 60)) : ""}${extra}</small></button>
    ${src === "club" && !WB.can("routes", "d") ? "" : `<button type="button" class="ib" data-del="${src}:${esc(r.id)}" aria-label="${esc(t("hq.routes.delete", { n: r.name }))}">${ICO.del}</button>`}</li>`;
  let html = "";
  if (srv && srv.mine.length) html += `<ul class="route-list">${srv.mine.map(r => row(r, "srv", r.visibility === "club" ? " · " + esc(t("hq.save.clubShort")) : "")).join("")}</ul>`;
  if (err) html += `<div class="svc-err"><p>${esc(WB.errMsg(err))}</p></div>`;
  if (local.length) html += `${active ? `<h3 class="sub4">${esc(t("hq.routes.thisBrowser"))}</h3>` : ""}<ul class="route-list">${local.map(r => row(r, "loc")).join("")}</ul>`;
  if (!html) html = `<p class="empty-s">${esc(t("hq.routes.none"))}</p>`;
  if (!active) html += `<p class="hint">${esc(t("hq.routes.localHint"))} <a href="pieslegties.html?next=${encodeURIComponent("karte.html")}">${esc(t("hq.save.login"))}</a></p>`;
  box.innerHTML = html;
  const shared = srv ? srv.club : [];
  $("#sharedWrap").hidden = !shared.length;
  $("#sharedRoutes").innerHTML = shared.map(r => row(r, "club", r.ownerName ? " · " + esc(r.ownerName) : "")).join("");
}
document.getElementById("pane-routes").addEventListener("click", async e => {
  const o = e.target.closest("[data-open]"), d = e.target.closest("[data-del]");
  if (o) {
    const [src, id] = o.dataset.open.split(":");
    const r = src === "loc" ? ls.get(LOCAL_KEY, []).find(x => x.id === id) : [...(savedCache?.mine || []), ...(savedCache?.club || [])].find(x => x.id === id);
    if (r) analyse({ stops: r.points.map(p => ({ name: p.name || fmtLL(p.lat, p.lng), lat: p.lat, lng: p.lng })), loop: r.roundTrip, name: r.name, sub: r.ownerName || "" });
  }
  if (d) {
    const [src, id] = d.dataset.del.split(":");
    if (!(await WB.confirm(t("hq.routes.deleteTitle"), t("hq.routes.deleteText"), t("btn.delete")))) return;
    try {
      if (src === "loc") ls.set(LOCAL_KEY, ls.get(LOCAL_KEY, []).filter(x => x.id !== id));
      else await WB.req("/routes/" + id, { method: "DELETE" });
      savedCache = null; renderSaved();
    } catch (x) { WB.toast(WB.errMsg(x), true); }
  }
});

/* =====================================================================
   DEGVIELAS CENAS
   ===================================================================== */
const FIRST = ["LV", "LT", "EE", "PL", "FI", "SE", "DE"];
let fuelP = null, fuelType = ls.get("wb-hq-fuel", "e95");
const loadFuel = force => (fuelP && !force) ? fuelP : (fuelP = WB.req("/fuel").catch(e => { fuelP = null; throw e; }));
const eur = v => v == null ? "—" : N3.format(v);
function fuelRow(cc, v, eu, max, cls = ""){
  const p = v && v[fuelType]; const d = p != null && eu != null ? p - eu : null;
  return `<li class="fr ${cls}"><span class="cc">${cc === "EU27" ? "EU" : cc}</span><span class="fr-n">${esc(cc === "EU27" ? t("hq.fuel.eu") : country(cc))}</span>
    <span class="fr-bar" aria-hidden="true">${p != null ? `<i style="width:${Math.max(4, Math.min(100, p / max * 100)).toFixed(1)}%"></i>` : ""}</span>
    <span class="fr-p num">${p != null ? `${eur(p)}<small> €/l</small>` : `<small class="muted">${esc(t("hq.fuel.na"))}</small>`}</span>
    <span class="fr-d num ${d == null ? "" : d > 0.005 ? "up" : d < -0.005 ? "down" : ""}">${d == null || cc === "EU27" ? "" : (d > 0 ? "+" : d < 0 ? "−" : "±") + N3.format(Math.abs(d))}</span></li>`;
}
function noBlock(no){
  if (!no) return "";
  const p = no[fuelType];
  return `<div class="no-block"><div class="fb-head"><span class="kb kb-official">${esc(t("hq.fuel.noBadge"))}</span></div>
    <ul class="fuel-rows"><li class="fr"><span class="cc">NO</span><span class="fr-n">${esc(country("NO"))}</span><span class="fr-bar"></span><span class="fr-p num">${p != null ? `${N2.format(p)}<small> NOK/l</small>` : `<small class="muted">${esc(t("hq.fuel.na"))}</small>`}</span><span class="fr-d"></span></li></ul>
    <p class="src">${esc(t("hq.fuel.noSrc", { m: fMonth.format(new Date(no.period + "-15T12:00:00")), t: fDT.format(no.fetchedAt) }))} · <a href="${esc(no.sourceUrl)}" target="_blank" rel="noopener noreferrer">SSB 09654</a> · ${esc(no.license)}</p></div>`;
}
function ecMeta(ec, stale){
  return `<div class="fb-head"><span class="kb kb-official">${esc(t("hq.fuel.ecBadge"))}</span><span class="fb-date">${esc(t("hq.fuel.asOf", { d: isoDate(ec.date) }))}</span></div>
    ${stale ? `<p class="al warn">${esc(t("hq.fuel.stale"))}</p>` : ""}`;
}
const ecFoot = ec => `<p class="src">${esc(t("hq.fuel.ecSrc", { t: fDT.format(ec.fetchedAt) }))} · <a href="${esc(ec.sourceUrl)}" target="_blank" rel="noopener noreferrer">Weekly Oil Bulletin</a> · ${esc(ec.attribution)} · ${esc(ec.license)}${ec.via === "upload" ? " · " + esc(t("hq.fuel.viaUpload")) : ""}</p>`;
async function loadFuelTab(force){
  const box = $("#fuelBody");
  $$("#fuelType [data-f]").forEach(b => { const on = b.dataset.f === fuelType; b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1; });
  let f;
  try { f = await loadFuel(force); } catch (e) { return errBox(box, e, () => loadFuelTab(true)); }
  if (!f.available) { box.innerHTML = `<div class="empty-s"><p><b>${esc(t("hq.fuel.none"))}</b></p><p>${esc(t("hq.fuel.noneText"))}</p></div>${fuelNotes()}`; return; }
  let html = "";
  if (f.ec) {
    const ec = f.ec, all = Object.keys(ec.countries), vals = all.map(c => ec.countries[c][fuelType]).filter(v => v != null);
    const max = Math.max(0.5, ...vals, ec.eu27 && ec.eu27[fuelType] || 0) * 1.02, eu = ec.eu27 ? ec.eu27[fuelType] : null;
    const rest = all.filter(c => !FIRST.includes(c)).sort((a, b) => country(a).localeCompare(country(b), WB.locale));
    html += ecMeta(ec, f.stale)
      + `<ul class="fuel-rows">${FIRST.filter(c => ec.countries[c]).map(c => fuelRow(c, ec.countries[c], eu, max)).join("")}${ec.eu27 ? fuelRow("EU27", ec.eu27, eu, max, "eu") : ""}</ul>`
      + `<details class="more-c"><summary>${esc(t("hq.fuel.others", { n: rest.length }))}</summary><ul class="fuel-rows">${rest.map(c => fuelRow(c, ec.countries[c], eu, max)).join("")}</ul></details>`
      + `<p class="hint">${esc(t("hq.fuel.diffHint"))}</p>` + ecFoot(ec);
  }
  html += noBlock(f.no) + fuelNotes();
  box.innerHTML = html;
}
const fuelNotes = () => `<details class="notes"><summary>${esc(t("hq.fuel.aboutTitle"))}</summary><ul>
  <li>${kindBadge("official")} ${esc(t("hq.fuel.aboutOfficial"))}</li><li>${kindBadge("api")} ${esc(t("hq.fuel.aboutApi"))}</li><li>${kindBadge("user")} ${esc(t("hq.fuel.aboutUser"))}</li>
  <li>${esc(t("hq.fuel.aboutStations"))}</li></ul></details>`;
$("#fuelType").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; fuelType = b.dataset.f; ls.set("wb-hq-fuel", fuelType); loadFuelTab(); });
$("#fuelType").addEventListener("keydown", e => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return; e.preventDefault(); const bs = $$("#fuelType [data-f]"), i = bs.findIndex(b => b.dataset.f === fuelType); bs[(i + d + bs.length) % bs.length].click(); $("#fuelType [aria-checked=true]").focus(); });
function routeFuelHtml(f, list){
  if (!f.available) return `<p class="muted small">${esc(t("hq.fuel.none"))}</p>`;
  const ec = f.ec, ccs = list || [];
  if (!ccs.length) return `<p class="muted small">${esc(t("hq.fuel.noCountries"))}</p>`;
  const rows = ccs.map(cc => {
    if (cc === "NO" && f.no) return `<li><span class="cc">NO</span><span class="rf-n">${esc(country("NO"))}</span><span class="num">95: ${f.no.e95 != null ? N2.format(f.no.e95) : "—"} · D: ${f.no.diesel != null ? N2.format(f.no.diesel) : "—"} <small>NOK/l</small></span></li>`;
    const v = ec && ec.countries[cc];
    if (!v) return `<li><span class="cc">${cc}</span><span class="rf-n">${esc(country(cc))}</span><span class="muted small">${esc(t("hq.fuel.noOfficial"))}</span></li>`;
    return `<li><span class="cc">${cc}</span><span class="rf-n">${esc(country(cc))}</span><span class="num">95: ${eur(v.e95)} · D: ${eur(v.diesel)}${v.lpg != null ? " · LPG: " + eur(v.lpg) : ""} <small>€/l</small></span></li>`;
  }).join("");
  return `<h4 class="sub4">${esc(t("hq.fuel.routeAvg"))}</h4><ul class="rf-list">${rows}</ul>`
    + (ec ? `<p class="src">${kindBadge("official")} ${esc(t("hq.fuel.ecShort"))} · ${esc(t("hq.fuel.asOf", { d: isoDate(ec.date) }))}${f.stale ? " · " + esc(t("hq.fuel.staleShort")) : ""}${f.no && ccs.includes("NO") ? " · SSB (" + esc(f.no.period) + ")" : ""}</p>` : "");
}

/* =====================================================================
   BARS (reāllaika atrašanās vieta — tikai aktīviem kluba kontiem)
   ===================================================================== */
const pack = { ws: null, riders: {}, markers: {}, watch: null, room: "", me: null, opened: false, tries: 0, closing: false, timer: null };
const packLayer = L.layerGroup().addTo(map);
const colors = ["#ECE8DF", "#d6a23c", "#8fb07a", "#7fb4d6", "#c58fd6", "#b8b2a6"];
async function packGate(){
  const sess = await WB.session(), g = $("#packGate");
  if (pack.ws) { g.innerHTML = ""; return; }
  if (!sess) { g.innerHTML = gateBox(t("hq.pack.loginTitle"), t("hq.pack.loginText"), `<a class="btn small" href="pieslegties.html?next=${encodeURIComponent("karte.html?tab=pack")}">${esc(t("nav.login"))}</a>`); $("#packForm").hidden = true; return; }
  if (sess.status !== "active") { g.innerHTML = gateBox(t("gate.pendingTitle"), t("gate.pendingText"), ""); $("#packForm").hidden = true; return; }
  g.innerHTML = ""; $("#packForm").hidden = false; $("#packAs").textContent = t("hq.pack.as", { n: sess.name });
  try { $("#room").value = $("#room").value || localStorage.getItem("wb-pack-room") || ""; } catch (e) {}
}
const gateBox = (h, p, btn) => `<div class="mini-gate"><b>${esc(h)}</b><p>${esc(p)}</p>${btn}</div>`;
function upsertRider(r){
  pack.riders[r.id] = { ...pack.riders[r.id], ...r, seen: Date.now() };
  const R2 = pack.riders[r.id], col = colors[[...R2.id].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
  if (!pack.markers[r.id]) pack.markers[r.id] = L.marker([r.lat, r.lon], { icon: L.divIcon({ className: "rider-pin" + (r.me ? " me" : ""), html: `<i style="background:${col}"></i><b>${esc(R2.name)}</b>`, iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 900 }).addTo(packLayer);
  else pack.markers[r.id].setLatLng([r.lat, r.lon]);
  renderRiders();
}
function renderRiders(){
  const list = Object.values(pack.riders), mine = list.find(r => r.me);
  $("#riders").innerHTML = list.sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || a.name.localeCompare(b.name)).map(r => {
    const dist = mine && r !== mine ? WB.hav([mine.lat, mine.lon], [r.lat, r.lon]) : null;
    const stale = Date.now() - r.seen > 60000, stopped = (r.speed ?? 0) < 3;
    return `<li class="${stale ? "stale" : ""}"><button type="button" data-id="${esc(r.id)}"><b>${esc(r.name)}${r.me ? " (" + esc(t("hq.pack.you")) + ")" : ""}</b>
      <span class="num">${r.speed != null ? Math.round(r.speed) + " km/h" : ""}${dist != null ? " · " + N1.format(dist) + " km" : ""}</span>
      <small>${stale ? esc(t("hq.pack.lost")) : stopped ? esc(t("hq.pack.stopped")) : esc(t("hq.pack.ok"))} · ${esc(ago(r.seen))}</small></button></li>`;
  }).join("") || `<li class="muted small">${esc(t("hq.pack.alone"))}</li>`;
}
setInterval(() => { if (pack.ws) renderRiders(); }, 15000);
$("#riders").addEventListener("click", e => { const b = e.target.closest("[data-id]"); const r = b && pack.riders[b.dataset.id]; if (r) map.flyTo([r.lat, r.lon], 14); });
function packConnect(){
  const ws = pack.ws = new WebSocket(WB.wsUrl("/pack/" + encodeURIComponent(pack.room)));
  ws.onopen = () => { pack.opened = true; pack.tries = 0; $("#packMode").textContent = t("hq.pack.liveMode"); const m = Object.values(pack.riders).find(r => r.me); if (m) ws.send(JSON.stringify({ type: "pos", lat: m.lat, lon: m.lon, speed: m.speed })); };
  ws.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; }
    if (d.type === "pos" && d.id !== pack.me.id) upsertRider({ id: d.id, name: d.name, lat: d.lat, lon: d.lon, speed: d.speed });
    if (d.type === "leave" && pack.riders[d.id]) { packLayer.removeLayer(pack.markers[d.id]); delete pack.riders[d.id]; delete pack.markers[d.id]; renderRiders(); } };
  ws.onclose = () => {
    if (pack.closing || pack.ws !== ws) return;
    if (!pack.opened) { $("#packMode").textContent = t("hq.pack.denied"); return; }
    if (pack.tries++ < 6) { $("#packMode").textContent = t("hq.pack.closed"); pack.timer = setTimeout(packConnect, Math.min(30000, 1500 * 2 ** pack.tries)); }
    else $("#packMode").textContent = t("hq.pack.gaveUp");
  };
}
$("#packForm").addEventListener("submit", async e => {
  e.preventDefault();
  const sess = await WB.session(true); if (!sess || sess.status !== "active") return packGate();
  pack.room = $("#room").value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
  if (pack.room.length < 3) { $("#room").focus(); return; }
  try { localStorage.setItem("wb-pack-room", pack.room); } catch (x) {}
  pack.me = { id: sess.id, name: sess.name }; pack.closing = false; pack.opened = false; pack.tries = 0;
  $("#packForm").hidden = true; $("#packLive").hidden = false; $("#packRoom").textContent = pack.room; $("#packMode").textContent = t("hq.pack.connecting"); renderRiders();
  packConnect();
  if (navigator.geolocation) pack.watch = navigator.geolocation.watchPosition(p => {
    const r = { id: pack.me.id, name: pack.me.name, lat: p.coords.latitude, lon: p.coords.longitude, speed: (p.coords.speed ?? 0) * 3.6, me: true };
    upsertRider(r); if (pack.ws && pack.ws.readyState === 1) pack.ws.send(JSON.stringify({ type: "pos", lat: r.lat, lon: r.lon, speed: r.speed }));
  }, () => WB.toast(t("hq.noGeo"), true), { enableHighAccuracy: true, maximumAge: 5000 });
});
$("#packLeave").addEventListener("click", () => {
  pack.closing = true; clearTimeout(pack.timer); pack.ws && pack.ws.close(); pack.ws = null;
  pack.watch != null && navigator.geolocation.clearWatch(pack.watch); pack.watch = null;
  packLayer.clearLayers(); pack.riders = {}; pack.markers = {};
  $("#packLive").hidden = true; packGate();
});

/* =====================================================================
   SOS — 112, atrašanās vieta; kluba biedriem SOS uz Saziņu (POST /api/sos)
   ===================================================================== */
let sosPos = null;
$("#sosLocate").addEventListener("click", async () => {
  const b = $("#sosLocate"); b.disabled = true;
  try {
    const p = sosPos = await locateMe(); map.flyTo(p, 15);
    const c = `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`, link = `https://maps.google.com/?q=${p[0].toFixed(5)},${p[1].toFixed(5)}`, msg = t("hq.sos.msg", { link });
    $("#sosCoords").textContent = c; $("#sosOut").hidden = false;
    $("#sosSms").href = `sms:?&body=${encodeURIComponent(msg)}`;
    $("#sosWa").href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    $("#sosCopy").onclick = () => navigator.clipboard && navigator.clipboard.writeText(c + " " + link).then(() => WB.toast(t("btn.copied")));
    if (navigator.share) { $("#sosShare").hidden = false; $("#sosShare").onclick = () => navigator.share({ title: "SOS", text: msg }).catch(() => {}); }
    const pe = $("#sosPos"); if (pe) pe.textContent = c;
  } catch (e) { WB.toast(t("hq.noGeo"), true); }
  b.disabled = false;
});
const SOS_KINDS = ["crash", "breakdown", "tyre", "battery", "fuel", "other"];
async function sosClub(){
  const box = $("#sosClub"), sess = await WB.session();
  if (!sess || sess.status !== "active") {
    box.innerHTML = `<div class="mini-gate"><b>${esc(t("hq.sos.clubTitle"))}</b><p>${esc(t("hq.sos.clubOnly"))}</p><div class="btn-row">${sess ? "" : `<a class="btn small" href="pieslegties.html?next=${encodeURIComponent("karte.html?tab=sos")}">${esc(t("nav.login"))}</a>`}<a class="btn ghost small" href="sazina.html#rhr">${esc(t("hq.sos.toComms"))}</a></div></div>`;
    return;
  }
  if (box.dataset.ready) return; box.dataset.ready = "1";
  box.innerHTML = `<form class="form sos-form" id="sosForm"><h3>${esc(t("hq.sos.clubTitle"))}</h3><p class="hint">${esc(t("hq.sos.clubText"))}</p>
    <label class="field"><span>${esc(t("hq.sos.kind"))}</span><select name="kind">${SOS_KINDS.map(k => `<option value="${k}">${esc(t("hq.sos.k." + k))}</option>`).join("")}</select></label>
    <label class="field"><span>${esc(t("hq.sos.note"))}</span><textarea name="note" maxlength="500" rows="2"></textarea></label>
    <label class="field"><span>${esc(t("hq.sos.phone"))}</span><input name="phone" type="tel" maxlength="30" autocomplete="tel"></label>
    <p class="small muted">${esc(t("hq.sos.pos"))}: <b id="sosPos" class="num">${sosPos ? esc(`${sosPos[0].toFixed(5)}, ${sosPos[1].toFixed(5)}`) : "—"}</b></p>
    <p class="form-err" id="sosErr" role="alert"></p>
    <button class="btn danger wide" type="submit">${esc(t("hq.sos.send"))}</button><a class="link-btn" href="sazina.html#rhr">${esc(t("hq.sos.toComms"))}</a></form>`;
  $("#sosForm").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target, err = $("#sosErr"); err.textContent = "";
    try {
      const p = sosPos || (sosPos = await locateMe().catch(() => { throw new Error(t("hq.noGeo")); }));
      $("#sosPos").textContent = `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;
      if (!(await WB.confirm(t("hq.sos.confirmTitle"), t("hq.sos.confirmText"), t("hq.sos.send"), true))) return;
      await WB.req("/sos", { body: { kind: f.kind.value, note: f.note.value, phone: f.phone.value, lat: p[0], lon: p[1] } });
      f.outerHTML = `<div class="sos-sent" role="status"><b>${esc(t("hq.sos.sent", { t: now() }))}</b><p>${esc(t("hq.sos.sentText"))}</p><a class="btn small" href="sazina.html#rhr">${esc(t("hq.sos.toComms"))}</a></div>`;
    } catch (x) { err.textContent = x instanceof WB.ApiError ? WB.errMsg(x) : x.message; }
  });
}

/* =====================================================================
   SĀKUMS: URL parametri, saglabātie slāņi
   ===================================================================== */
renderLayerRows();
loopEl.checked = !!ls.get("wb-hq-loop", false);
const q = new URLSearchParams(location.search);
if (q.get("route")) loadClubRoute(q.get("route"));
else if (q.get("pts")) {
  const labels = (q.get("labels") || "").split("|");
  const st = q.get("pts").split(";").map(s => s.split(",").map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180).slice(0, MAX_STOPS)
    .map((p, i) => ({ name: (labels[i] || "").slice(0, 80) || fmtLL(p[0], p[1]), lat: p[0], lng: p[1] }));
  const loop = q.get("loop") === "1";
  if (st.length >= 2 || (loop && st.length >= 2)) { stops = st.map(s => ({ ...s })); loopEl.checked = loop; analyse({ stops: st, loop, name: (q.get("name") || "").slice(0, 80) || "Ride" }); }
}
else if (q.get("to")) {
  const [la, lo] = q.get("to").split(",").map(Number);
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    loopEl.checked = false;
    stops = [{ name: (C.homeBase && C.homeBase.name) || "Rīga", lat: C.homeBase.lat, lng: C.homeBase.lon }, { name: (q.get("name") || fmtLL(la, lo)).slice(0, 80), lat: la, lng: lo }];
    showTab("plan"); map.setView([la, lo], 7);
  }
}
renderStops();
if (q.get("tab") && $(`#tabs [data-tab="${q.get("tab")}"]`) && $("#result").hidden) showTab(q.get("tab"));
else if ($("#result").hidden) renderSaved();
ls.get("wb-hq-layers", []).forEach(id => { if (LY[id]) { LY[id].on = true; const c = $(`[data-layer="${id}"]`); if (c) c.checked = true; LY[id].layer.addTo(map); setTimeout(() => refreshLayer(id, true), 300); } });
LAYERS.forEach(l => layerStatus(l.id));
})();
