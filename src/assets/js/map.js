/* WOLVES BROTHERHOOD MC — Ride HQ karte
   Maršruti (OSRM), laikapstākļi pa ceļam (Open-Meteo), radars (RainViewer),
   vēja bultas, DUS/servisi/kafejnīcas/fotoradari (Overpass), bars (live), SOS. */
(function(){
const { $, $$, esc, t, tp, L: TL } = WB;
WB.initNav();
const C = window.CLUB || {};
const isMobile = () => matchMedia("(max-width:860px)").matches;

/* ---------- map ---------- */
const map = L.map("map", { zoomControl: false, preferCanvas: true }).setView([56.95, 24.6], 8);
WB.darkTiles().addTo(map);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
const routeLayer = L.layerGroup().addTo(map), fuelRouteLayer = L.layerGroup().addTo(map);
const toast = (msg, ms = 3500) => { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); };
const icon = (cls, html = "") => L.divIcon({ className: "pin " + cls, html, iconSize: [26, 26], iconAnchor: [13, 13] });

/* ---------- tabs + bottom sheet ---------- */
const tabs = $$(".tabs [data-tab]");
const showTab = name => {
  tabs.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
  $$(".tab-pane").forEach(p => p.hidden = p.dataset.pane !== name);
  if (isMobile()) $("#panel").classList.add("up");
};
tabs.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
$("#grip").addEventListener("click", () => $("#panel").classList.toggle("up"));

/* ---------- club routes ---------- */
const R = window.ROUTES || [];
$("#hqRoutes").innerHTML = R.map(r => `<li><button data-id="${r.id}"><b>${esc(TL(r.name))}</b><span class="rk">~${r.km} km</span><small>${esc(r.region)} · ${esc(t("route.level." + r.level))}</small><small class="muted">${esc(TL(r.text))}</small></button></li>`).join("");
$("#hqRoutes").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) loadClubRoute(b.dataset.id); });
function loadClubRoute(id){
  const r = R.find(x => x.id === id); if (!r) return;
  $$("#hqRoutes button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
  analyse(r.pts, TL(r.name), r.region);
}

/* ---------- geocoding (Photon) ---------- */
const PH_LANG = ["en", "de", "fr"].includes(WB.lang) ? WB.lang : "en";
function geoField(input, list){
  let timer, items = [];
  input.addEventListener("input", () => {
    input.dataset.lat = ""; clearTimeout(timer);
    const q = input.value.trim(); if (q.length < 3) { list.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try {
        const c = map.getCenter();
        const j = await (await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=${PH_LANG}&lat=${c.lat}&lon=${c.lng}`)).json();
        items = j.features.map(f => ({ name: [f.properties.name, f.properties.city || f.properties.county, f.properties.country].filter((v, i, a) => v && a.indexOf(v) === i).join(", "), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
        list.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}">${esc(it.name)}</li>`).join("");
      } catch (e) { list.innerHTML = ""; }
    }, 280);
  });
  list.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (!li) return; e.preventDefault(); const it = items[+li.dataset.i]; setGeo(input, it.name, it.lat, it.lon); list.innerHTML = ""; });
  input.addEventListener("blur", () => setTimeout(() => list.innerHTML = "", 150));
  input.addEventListener("keydown", e => { if (e.key === "Enter" && items.length && !input.dataset.lat) { e.preventDefault(); const it = items[0]; setGeo(input, it.name, it.lat, it.lon); list.innerHTML = ""; } });
}
const setGeo = (input, name, lat, lon) => { input.value = name; input.dataset.lat = lat; input.dataset.lon = lon; };
geoField($("#from"), $("#fromSugg")); geoField($("#to"), $("#toSugg"));
let viaN = 0;
$("#addVia").addEventListener("click", () => {
  if (viaN >= 3) return; viaN++;
  const w = document.createElement("div"); w.className = "geo-field via";
  w.innerHTML = `<label>${esc(t("map.via"))}</label><div class="geo-wrap"><input placeholder="${esc(t("map.viaPh"))}"><button type="button" class="icon-btn mini" aria-label="×">×</button></div><ul class="sugg"></ul>`;
  $("#vias").appendChild(w); geoField(w.querySelector("input"), w.querySelector(".sugg"));
  w.querySelector("button").onclick = () => { w.remove(); viaN--; };
  w.querySelector("input").focus();
});
$("#swap").addEventListener("click", () => {
  const a = $("#from"), b = $("#to"); const tmp = [a.value, a.dataset.lat, a.dataset.lon];
  setGeo(a, b.value, b.dataset.lat || "", b.dataset.lon || ""); setGeo(b, tmp[0], tmp[1] || "", tmp[2] || "");
});
const dep = $("#dep");
const setDepNow = () => { const d = new Date(Date.now() + 15 * 6e4); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); dep.value = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
setDepNow();
let me = null, meMarker = null;
const locateMe = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error("geo"));
  navigator.geolocation.getCurrentPosition(p => {
    me = [p.coords.latitude, p.coords.longitude];
    meMarker ? meMarker.setLatLng(me) : (meMarker = L.marker(me, { icon: icon("me", "<i></i>"), zIndexOffset: 1000 }).addTo(map));
    res(me);
  }, e => rej(e), { enableHighAccuracy: true, timeout: 12000 });
});
$("#useMe").addEventListener("click", async () => { try { const p = await locateMe(); setGeo($("#from"), t("map.myLocation"), p[0], p[1]); } catch (e) { toast(t("map.noGeo")); } });
$("#locate").addEventListener("click", async () => { try { const p = await locateMe(); map.flyTo(p, 13); } catch (e) { toast(t("map.noGeo")); } });

async function resolve(input){
  if (input.dataset.lat) return [+input.dataset.lat, +input.dataset.lon];
  const q = input.value.trim(); if (!q) return null;
  const j = await (await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=${PH_LANG}`)).json();
  if (!j.features.length) return null;
  const c = j.features[0].geometry.coordinates; setGeo(input, input.value, c[1], c[0]); return [c[1], c[0]];
}
$("#planForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#planBtn"); btn.disabled = true; btn.textContent = t("map.calcing");
  try {
    const pts = [];
    const a = await resolve($("#from")); if (!a) throw new Error(t("map.errFrom"));
    pts.push(a);
    for (const v of $$("#vias input")) { const p = await resolve(v); if (p) pts.push(p); }
    const b = await resolve($("#to")); if (!b) throw new Error(t("map.errTo"));
    pts.push(b);
    await analyse(pts, `${$("#from").value.split(",")[0]} → ${$("#to").value.split(",")[0]}`, "");
  } catch (err) { toast(err.message || t("map.errRoute")); }
  btn.disabled = false; btn.textContent = t("map.calc");
});

/* ---------- route analysis ---------- */
let current = null;
const bearing = (a, b) => { const r = x => x * Math.PI / 180, y = Math.sin(r(b[1] - a[1])) * Math.cos(r(b[0])), x = Math.cos(r(a[0])) * Math.sin(r(b[0])) - Math.sin(r(a[0])) * Math.cos(r(b[0])) * Math.cos(r(b[1] - a[1])); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
const rainColor = p => p >= 60 ? "#E3120B" : p >= 30 ? "#d6a23c" : "#ECE8DF";
const fmtDur = s => { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };

async function analyse(pts, name, sub){
  $("#result").hidden = false; $("#resName").textContent = name; $("#resSub").textContent = t("map.calcing");
  ["#kDist", "#kTime", "#kRain", "#kScore"].forEach(s => $(s).textContent = "…");
  $("#segments").innerHTML = ""; $("#rainbar").innerHTML = ""; $("#alerts").innerHTML = ""; $("#fuelList").innerHTML = `<li class="muted">${esc(t("map.fuelLoading"))}</li>`;
  routeLayer.clearLayers(); fuelRouteLayer.clearLayers();
  if (isMobile()) $("#panel").classList.add("up");
  let route;
  try { route = await WB.osrm(pts); } catch (e) { toast(t("map.errRoute")); $("#resSub").textContent = t("map.errRoute"); return; }
  const geo = route.geometry.coordinates.map(c => [c[1], c[0]]);
  // cumulative distance
  const cum = [0]; for (let i = 1; i < geo.length; i++) cum.push(cum[i - 1] + WB.hav(geo[i - 1], geo[i]));
  const total = cum[cum.length - 1], dur = route.duration;
  const depT = new Date(dep.value || Date.now());
  // base line + endpoints
  L.polyline(geo, { color: "#000", weight: 9, opacity: .9 }).addTo(routeLayer);
  const base = L.polyline(geo, { color: "#ECE8DF", weight: 4, opacity: .35 }).addTo(routeLayer);
  L.marker(geo[0], { icon: icon("start", "<i></i>") }).addTo(routeLayer);
  L.marker(geo[geo.length - 1], { icon: icon("end", "<i></i>") }).addTo(routeLayer);
  pts.slice(1, -1).forEach(p => L.marker(p, { icon: icon("via", "<i></i>") }).addTo(routeLayer));
  map.fitBounds(base.getBounds(), { padding: isMobile() ? [30, 30] : [60, 60], paddingTopLeft: isMobile() ? [20, 20] : [440, 40] });
  $("#kDist").textContent = Math.round(total) + " km";
  $("#kTime").textContent = fmtDur(dur);
  const eta = new Date(depT.getTime() + dur * 1000);
  $("#resSub").textContent = `${sub ? sub + " · " : ""}${t("map.arrive")} ${WB.time(eta)}${WB.iso(eta) !== WB.iso(depT) ? " (" + WB.dayLabel(eta) + ")" : ""}`;
  // samples
  const step = Math.max(8, total / 32);
  const samples = [];
  for (let d = 0; d <= total; d += step) { let i = cum.findIndex(c => c >= d); if (i < 0) i = geo.length - 1; samples.push(i); }
  if (samples[samples.length - 1] !== geo.length - 1) samples.push(geo.length - 1);
  const S = samples.map((gi, k) => {
    const prev = geo[samples[Math.max(0, k - 1)]], next = geo[samples[Math.min(samples.length - 1, k + 1)]];
    return { gi, p: geo[gi], km: cum[gi], t: new Date(depT.getTime() + dur * 1000 * (cum[gi] / total)), brg: bearing(prev, next === prev ? geo[Math.min(geo.length - 1, gi + 1)] : next) };
  });
  // weather (one multi-location call)
  let W;
  try {
    const qs = `latitude=${S.map(s => s.p[0].toFixed(3)).join(",")}&longitude=${S.map(s => s.p[1].toFixed(3)).join(",")}&hourly=precipitation_probability,precipitation,temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code&daily=sunset&forecast_days=7&timeformat=unixtime&timezone=GMT`;
    W = await (await fetch("https://api.open-meteo.com/v1/forecast?" + qs)).json();
    if (!Array.isArray(W)) W = [W];
  } catch (e) { W = null; }
  let maxRain = 0, maxRainKm = 0, maxCross = 0, maxCrossKm = 0, tMin = 99, tMax = -99, scores = [], outOfRange = false;
  S.forEach((s, k) => {
    if (!W || !W[k] || !W[k].hourly) return;
    const h = W[k].hourly, ts = s.t.getTime() / 1000;
    let i = h.time.findIndex(x => x > ts - 1800); if (i < 0) { i = h.time.length - 1; outOfRange = true; }
    s.rain = h.precipitation_probability[i] ?? 0; s.mm = h.precipitation[i] ?? 0; s.temp = h.temperature_2m[i]; s.wind = h.wind_speed_10m[i]; s.gust = h.wind_gusts_10m[i]; s.wdir = h.wind_direction_10m[i]; s.code = h.weather_code[i];
    s.cross = Math.abs(Math.sin((s.wdir - s.brg) * Math.PI / 180)) * s.gust;
    if (s.rain > maxRain) { maxRain = s.rain; maxRainKm = s.km; }
    if (s.cross > maxCross) { maxCross = s.cross; maxCrossKm = s.km; }
    tMin = Math.min(tMin, s.temp); tMax = Math.max(tMax, s.temp);
    s.score = WB.rideIndex({ rain: s.rain, temp: s.temp, gust: s.gust, code: s.code, precip: s.mm }); scores.push(s.score);
  });
  // coloured segments by rain
  for (let k = 0; k < S.length - 1; k++) {
    const seg = geo.slice(S[k].gi, S[k + 1].gi + 1); if (seg.length < 2) continue;
    L.polyline(seg, { color: rainColor(Math.max(S[k].rain ?? 0, S[k + 1].rain ?? 0)), weight: 5, opacity: .95 }).addTo(routeLayer)
      .bindTooltip(`${Math.round(S[k].km)} km · ${WB.time(S[k].t)} · ☂ ${S[k].rain ?? "—"}% · ${S[k].temp != null ? Math.round(S[k].temp) + "°" : ""}`, { sticky: true, className: "tt" });
  }
  // wind arrows on route every ~4th sample
  S.forEach((s, k) => { if (k % 4 || s.wdir == null) return;
    L.marker(s.p, { icon: L.divIcon({ className: "wind-pin", html: `<i style="transform:rotate(${s.wdir + 180}deg)"></i><b>${Math.round(s.gust)}</b>`, iconSize: [34, 34], iconAnchor: [17, 17] }), interactive: false }).addTo(routeLayer); });
  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  $("#kRain").textContent = W ? maxRain + "%" : "—";
  $("#kRain").style.color = rainColor(maxRain);
  $("#kScore").textContent = score != null ? score + "/100" : "—";
  // alerts
  const A = [];
  if (!W) A.push(["warn", t("map.a.noWx")]);
  if (outOfRange) A.push(["warn", t("map.a.range")]);
  if (maxRain >= 50) A.push(["bad", t("map.a.rain", { p: maxRain, km: Math.round(maxRainKm) })]);
  else if (maxRain >= 25) A.push(["warn", t("map.a.showers", { p: maxRain, km: Math.round(maxRainKm) })]);
  if (maxCross >= 45) A.push(["bad", t("map.a.cross", { v: Math.round(maxCross), km: Math.round(maxCrossKm) })]);
  else if (maxCross >= 30) A.push(["warn", t("map.a.cross", { v: Math.round(maxCross), km: Math.round(maxCrossKm) })]);
  if (tMin < 6 && tMin !== 99) A.push(["warn", t("map.a.cold", { v: Math.round(tMin) })]);
  if (tMin < 2 && tMin !== 99) A.push(["bad", t("map.a.ice")]);
  if (S.some(s => [95, 96, 99].includes(s.code))) A.push(["bad", t("map.a.storm")]);
  if (W && W[W.length - 1] && W[W.length - 1].daily) {
    const ss = W[W.length - 1].daily.sunset.map(x => x * 1000).find(x => WB.iso(new Date(x)) === WB.iso(eta));
    if (ss && eta.getTime() > ss) A.push(["warn", t("map.a.dark", { time: WB.time(new Date(ss)) })]);
  }
  if (tMax > -99) A.push(["ok", t("map.a.temp", { a: Math.round(tMin), b: Math.round(tMax) }) + " " + gearTip(tMin, maxRain)]);
  $("#alerts").innerHTML = A.map(([k, m]) => `<p class="al ${k}">${esc(m)}</p>`).join("");
  // rain bar chart
  $("#rainbar").innerHTML = S.map(s => `<i style="height:${Math.max(4, s.rain ?? 0)}%;background:${rainColor(s.rain ?? 0)}" title="${Math.round(s.km)} km · ${WB.time(s.t)} · ${s.rain ?? "—"}%"></i>`).join("");
  $("#rbEnd").textContent = Math.round(total) + " km";
  // road ahead: steps grouped by road
  const roads = []; let acc = 0;
  route.legs.forEach(leg => leg.steps.forEach(st => {
    const label = st.ref ? st.ref.split(";")[0] + (st.name ? " " + st.name : "") : st.name;
    acc += st.distance;
    if (!label) return;
    const last = roads[roads.length - 1];
    if (last && last.label === label) { last.dist += st.distance; last.end = acc; }
    else roads.push({ label, dist: st.distance, start: acc - st.distance, end: acc });
  }));
  const segs = roads.filter(r => r.dist > 4000).slice(0, 14);
  $("#segments").innerHTML = segs.map(r => {
    const midKm = (r.start + r.end) / 2000, s = S.reduce((a, b) => Math.abs(b.km - midKm) < Math.abs(a.km - midKm) ? b : a, S[0]);
    return `<li><span class="sg-road">${esc(r.label)}</span><span class="sg-km">${Math.round(r.start / 1000)}–${Math.round(r.end / 1000)} km</span>
      <span class="sg-wx">${WB.time(s.t)} · <b style="color:${rainColor(s.rain ?? 0)}">☂ ${s.rain ?? "—"}%</b> · ${s.temp != null ? Math.round(s.temp) + "°" : ""} · ${s.gust != null ? "↯ " + Math.round(s.gust) + " km/h" : ""}${s.cross >= 30 ? ` · <b class="warn-t">${esc(t("map.crossShort"))}</b>` : ""}</span></li>`;
  }).join("") || `<li class="muted">—</li>`;
  current = { pts, geo, cum, total, name, route };
  exportLinks(pts, geo, name);
  fuelAlong(geo, cum);
}
const gearTip = (tMin, rain) => tMin < 10 ? t("map.gear.cold") : rain >= 40 ? t("map.gear.rain") : tMin > 25 ? t("map.gear.hot") : t("map.gear.ok");
$("#resClose").addEventListener("click", () => { $("#result").hidden = true; routeLayer.clearLayers(); fuelRouteLayer.clearLayers(); current = null; $$("#hqRoutes button").forEach(b => b.classList.remove("on")); });

/* ---------- export ---------- */
function exportLinks(pts, geo, name){
  const f = p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const g = new URL("https://www.google.com/maps/dir/"); g.searchParams.set("api", "1"); g.searchParams.set("origin", f(pts[0])); g.searchParams.set("destination", f(pts[pts.length - 1])); g.searchParams.set("travelmode", "driving");
  if (pts.length > 2) g.searchParams.set("waypoints", pts.slice(1, -1).map(f).join("|"));
  $("#exGmaps").href = g.toString();
  $("#exWaze").href = `https://waze.com/ul?ll=${f(pts[pts.length - 1])}&navigate=yes`;
  $("#exGpx").onclick = () => {
    const step = Math.max(1, Math.floor(geo.length / 2500));
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Wolves Brotherhood MC" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${esc(name)}</name></metadata>\n${pts.map((p, i) => `<wpt lat="${p[0]}" lon="${p[1]}"><name>${i === 0 ? "Start" : i === pts.length - 1 ? "Finish" : "Via " + i}</name></wpt>`).join("\n")}\n<trk><name>${esc(name)}</name><trkseg>${geo.filter((_, i) => i % step === 0 || i === geo.length - 1).map(p => `<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"/>`).join("")}</trkseg></trk></gpx>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" })); a.download = name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() + ".gpx"; a.click();
  };
  $("#exShare").onclick = async () => {
    const u = new URL(location.href); u.search = ""; u.searchParams.set("pts", pts.map(f).join(";")); u.searchParams.set("name", name);
    try { if (navigator.share) await navigator.share({ title: name, url: u.toString() }); else { await navigator.clipboard.writeText(u.toString()); toast(t("map.linkCopied")); } } catch (e) {}
  };
}

/* ---------- Overpass POIs ---------- */
const OVERPASS = "https://overpass-api.de/api/interpreter";
const poiQ = {
  fuel: `nwr["amenity"="fuel"]`,
  moto: `nwr["shop"="motorcycle"];nwr["shop"="motorcycle_repair"];nwr["craft"="motorcycle_repair"]`,
  food: `nwr["amenity"~"^(cafe|fast_food|restaurant)$"]["name"]`,
  cams: `node["highway"="speed_camera"]`
};
async function overpass(q, b){
  const bb = `${b.getSouth().toFixed(4)},${b.getWest().toFixed(4)},${b.getNorth().toFixed(4)},${b.getEast().toFixed(4)}`;
  const body = `[out:json][timeout:25];(${q.split(";").map(x => x + `(${bb});`).join("")});out center 300;`;
  const r = await fetch(OVERPASS, { method: "POST", body: "data=" + encodeURIComponent(body), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  if (!r.ok) throw new Error("overpass");
  return (await r.json()).elements.map(e => ({ id: e.id, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags || {} })).filter(e => e.lat);
}
async function fuelAlong(geo, cum){
  try {
    const line = L.polyline(geo), b = line.getBounds().pad(.02);
    const st = await overpass(poiQ.fuel, b);
    // densify check every ~1 km
    const probe = []; let last = -1; for (let i = 0; i < geo.length; i++) if (cum[i] - last >= 1) { probe.push(i); last = cum[i]; }
    const near = [];
    for (const s of st) { let best = 1e9, bi = 0; for (const i of probe) { const d = WB.hav([s.lat, s.lon], geo[i]); if (d < best) { best = d; bi = i; } } if (best <= 1.2) near.push({ ...s, km: cum[bi], off: best }); }
    near.sort((a, b) => a.km - b.km);
    const uniq = near.filter((s, i) => !i || s.km - near[i - 1].km > .3);
    uniq.forEach(s => L.marker([s.lat, s.lon], { icon: icon("fuel", "⛽") }).addTo(fuelRouteLayer).bindPopup(`<b>${esc(s.tags.brand || s.tags.name || t("map.fuel"))}</b><br>${Math.round(s.km)} km${s.tags.opening_hours ? "<br>" + esc(s.tags.opening_hours) : ""}`));
    // gaps
    let gap = 0, gapAt = 0, prev = 0; for (const s of [...uniq, { km: cum[cum.length - 1] }]) { if (s.km - prev > gap) { gap = s.km - prev; gapAt = prev; } prev = s.km; }
    $("#fuelList").innerHTML = (uniq.length ? uniq.slice(0, 12).map(s => `<li><b>${Math.round(s.km)} km</b> ${esc(s.tags.brand || s.tags.name || t("map.fuel"))}${s.tags.opening_hours === "24/7" ? ' <span class="tag">24/7</span>' : ""}</li>`).join("") + (uniq.length > 12 ? `<li class="muted">+${uniq.length - 12}</li>` : "") : `<li class="muted">${esc(t("map.noFuel"))}</li>`)
      + (gap > 120 ? `<li class="al warn">${esc(t("map.fuelGap", { km: Math.round(gap), at: Math.round(gapAt) }))}</li>` : "");
  } catch (e) { $("#fuelList").innerHTML = `<li class="muted">${esc(t("map.fuelErr"))}</li>`; }
}
const poiLayers = {}, poiOn = {};
const poiIcon = { fuel: "⛽", moto: "🔧", food: "☕", cams: "📷" };
async function refreshPOI(kind){
  if (!poiOn[kind]) return;
  if (map.getZoom() < 10) { toast(t("map.zoomIn")); return; }
  try {
    const els = await overpass(poiQ[kind], map.getBounds());
    poiLayers[kind].clearLayers();
    els.forEach(e => L.marker([e.lat, e.lon], { icon: icon("poi " + kind, poiIcon[kind]) }).addTo(poiLayers[kind])
      .bindPopup(`<b>${esc(e.tags.name || e.tags.brand || t("map.l." + kind))}</b>${e.tags.opening_hours ? "<br>" + esc(e.tags.opening_hours) : ""}${e.tags.phone ? `<br><a href="tel:${esc(e.tags.phone)}">${esc(e.tags.phone)}</a>` : ""}${e.tags.maxspeed ? "<br>" + esc(e.tags.maxspeed) + " km/h" : ""}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lon}" target="_blank" rel="noopener">${esc(t("map.navigate"))}</a>`));
    if (!els.length) toast(t("map.nothingHere"));
  } catch (e) { toast(t("map.poiErr")); }
}

/* ---------- radar (RainViewer) ---------- */
let radar = { frames: [], i: 0, layer: null, timer: null, host: "" };
async function radarOn(){
  try {
    const j = await (await fetch("https://api.rainviewer.com/public/weather-maps.json")).json();
    radar.host = j.host; radar.frames = [...j.radar.past, ...(j.radar.nowcast || [])]; radar.i = j.radar.past.length - 1;
    showFrame(); $("#radarCtrl").hidden = false;
  } catch (e) { toast(t("map.radarErr")); }
}
function showFrame(){
  const f = radar.frames[radar.i]; if (!f) return;
  const nl = L.tileLayer(`${radar.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, zIndex: 400, maxNativeZoom: 7, maxZoom: 19 }).addTo(map);
  nl.on("load", () => { nl.setOpacity(.65); if (radar.layer && radar.layer !== nl) { const o = radar.layer; setTimeout(() => map.removeLayer(o), 250); } radar.layer = nl; });
  const d = new Date(f.time * 1000); $("#radarTime").textContent = WB.time(d) + (f.time * 1000 > Date.now() ? " ▸" : "");
}
function radarOff(){ clearInterval(radar.timer); radar.timer = null; radar.layer && map.removeLayer(radar.layer); radar.layer = null; $("#radarCtrl").hidden = true; $("#radarPlay").classList.remove("on"); }
$("#radarPlay").addEventListener("click", () => {
  if (radar.timer) { clearInterval(radar.timer); radar.timer = null; $("#radarPlay").classList.remove("on"); return; }
  $("#radarPlay").classList.add("on");
  radar.timer = setInterval(() => { radar.i = (radar.i + 1) % radar.frames.length; showFrame(); }, 700);
});

/* ---------- wind arrows grid (Open-Meteo) ---------- */
const windLayer = L.layerGroup();
async function refreshWind(){
  if (!map.hasLayer(windLayer)) return;
  const b = map.getBounds(), nx = 7, ny = 5, lats = [], lons = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { lats.push((b.getSouth() + (y + .5) * (b.getNorth() - b.getSouth()) / ny).toFixed(3)); lons.push((b.getWest() + (x + .5) * (b.getEast() - b.getWest()) / nx).toFixed(3)); }
  try {
    let j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m`)).json();
    if (!Array.isArray(j)) j = [j];
    windLayer.clearLayers();
    j.forEach((p, i) => { const c = p.current; const sev = c.wind_gusts_10m >= 50 ? "bad" : c.wind_gusts_10m >= 35 ? "warn" : "";
      L.marker([+lats[i], +lons[i]], { icon: L.divIcon({ className: "wind-pin big " + sev, html: `<i style="transform:rotate(${c.wind_direction_10m + 180}deg)"></i><b>${Math.round(c.wind_speed_10m)}<small>/${Math.round(c.wind_gusts_10m)}</small></b>`, iconSize: [46, 46], iconAnchor: [23, 23] }), interactive: false }).addTo(windLayer); });
  } catch (e) { toast(t("map.windErr")); }
}

/* ---------- hazards (Riders help riders) ---------- */
const hazLayer = L.layerGroup();
async function refreshHazards(){
  hazLayer.clearLayers();
  const list = window.RHR ? await RHR.hazards() : [];
  list.forEach(h => L.marker([h.lat, h.lon], { icon: icon("haz", "⚠") }).addTo(hazLayer).bindPopup(`<b>${esc(t("rhr.haz." + h.kind))}</b><br>${esc(h.note || "")}<br><small>${esc(h.by || "")}</small>`));
  if (!list.length) toast(t("map.noHazards"));
}

/* ---------- layer buttons ---------- */
$("#layers").addEventListener("click", async e => {
  const b = e.target.closest("[data-layer]"); if (!b) return;
  const k = b.dataset.layer, on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", on);
  if (k === "radar") on ? radarOn() : radarOff();
  else if (k === "wind") { if (on) { windLayer.addTo(map); refreshWind(); } else map.removeLayer(windLayer); }
  else if (k === "hazards") { if (on) { hazLayer.addTo(map); refreshHazards(); } else map.removeLayer(hazLayer); }
  else { poiOn[k] = on; poiLayers[k] = poiLayers[k] || L.layerGroup(); if (on) { poiLayers[k].addTo(map); refreshPOI(k); } else map.removeLayer(poiLayers[k]); }
});
let mvT; map.on("moveend", () => { clearTimeout(mvT); mvT = setTimeout(() => { refreshWind(); Object.keys(poiOn).forEach(refreshPOI); }, 600); });

/* ---------- pack (live riders) ---------- */
const pack = { ws: null, demo: null, riders: {}, markers: {}, watch: null, name: "", room: "" };
const packLayer = L.layerGroup().addTo(map);
const colors = ["#ECE8DF", "#d6a23c", "#8fb07a", "#7fb4d6", "#c58fd6", "#E3120B", "#b8b2a6"];
function upsertRider(r){
  pack.riders[r.id] = { ...pack.riders[r.id], ...r, seen: Date.now() };
  const R2 = pack.riders[r.id], col = colors[Math.abs([...R2.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length];
  if (!pack.markers[r.id]) pack.markers[r.id] = L.marker([r.lat, r.lon], { icon: L.divIcon({ className: "rider-pin", html: `<i style="background:${col}"></i><b>${esc(R2.name)}</b>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(packLayer);
  else pack.markers[r.id].setLatLng([r.lat, r.lon]);
  renderRiders();
}
function renderRiders(){
  const list = Object.values(pack.riders); const mine = list.find(r => r.me);
  const lead = list.reduce((a, b) => (b.prog ?? 0) > (a?.prog ?? -1) ? b : a, null);
  $("#riders").innerHTML = list.sort((a, b) => (b.prog ?? 0) - (a.prog ?? 0)).map(r => {
    const dist = mine && r !== mine ? WB.hav([mine.lat, mine.lon], [r.lat, r.lon]) : null;
    const stale = Date.now() - r.seen > 60000, stopped = (r.speed ?? 0) < 3;
    const behind = lead && r !== lead && WB.hav([lead.lat, lead.lon], [r.lat, r.lon]) > 3;
    return `<li class="${stale ? "stale" : ""}"><button data-id="${esc(r.id)}"><b>${esc(r.name)}${r.me ? " (" + esc(t("map.pack.you")) + ")" : ""}</b>
      <span>${r.speed != null ? Math.round(r.speed) + " km/h" : ""}${dist != null ? " · " + dist.toFixed(1) + " km" : ""}</span>
      <small>${stale ? esc(t("map.pack.lost")) : stopped ? esc(t("map.pack.stopped")) : behind ? esc(t("map.pack.behind")) : esc(t("map.pack.ok"))}</small></button></li>`;
  }).join("");
}
$("#riders").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b && pack.riders[b.dataset.id]) map.flyTo([pack.riders[b.dataset.id].lat, pack.riders[b.dataset.id].lon], 14); });
$("#packForm").addEventListener("submit", async e => {
  e.preventDefault();
  pack.room = $("#room").value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""); pack.name = $("#rider").value.trim().slice(0, 24);
  try { localStorage.setItem("wb-rider", pack.name); } catch (e) {}
  $("#packForm").hidden = true; $("#packLive").hidden = false; $("#packRoom").textContent = pack.room;
  const myId = "me-" + Math.random().toString(36).slice(2, 8);
  if (window.RHR && await RHR.probe()) {
    pack.ws = new WebSocket(WB.wsUrl("/pack/") + encodeURIComponent(pack.room) + "?name=" + encodeURIComponent(pack.name) + "&id=" + myId);
    pack.ws.onmessage = m => { const d = JSON.parse(m.data); if (d.type === "pos" && d.id !== myId) upsertRider(d); if (d.type === "leave") { pack.markers[d.id] && packLayer.removeLayer(pack.markers[d.id]); delete pack.riders[d.id]; delete pack.markers[d.id]; renderRiders(); } };
    pack.ws.onopen = () => $("#packMode").textContent = t("map.pack.liveMode");
    pack.ws.onclose = () => $("#packMode").textContent = t("map.pack.closed");
  } else { $("#packMode").textContent = t("map.pack.demoMode"); startDemo(); }
  if (navigator.geolocation) pack.watch = navigator.geolocation.watchPosition(p => {
    const r = { id: myId, name: pack.name, lat: p.coords.latitude, lon: p.coords.longitude, speed: (p.coords.speed ?? 0) * 3.6, me: true, prog: 0 };
    upsertRider(r); if (pack.ws && pack.ws.readyState === 1) pack.ws.send(JSON.stringify({ type: "pos", ...r, me: undefined }));
  }, () => toast(t("map.noGeo")), { enableHighAccuracy: true, maximumAge: 5000 });
});
$("#packLeave").addEventListener("click", () => {
  pack.ws && pack.ws.close(); pack.ws = null; clearInterval(pack.demo); pack.demo = null;
  pack.watch != null && navigator.geolocation.clearWatch(pack.watch); pack.watch = null;
  packLayer.clearLayers(); pack.riders = {}; pack.markers = {};
  $("#packForm").hidden = false; $("#packLive").hidden = true;
});
function startDemo(){
  const geo = current ? current.geo : R[0].pts.flatMap((p, i, a) => i ? Array.from({ length: 30 }, (_, k) => [a[i - 1][0] + (p[0] - a[i - 1][0]) * k / 30, a[i - 1][1] + (p[1] - a[i - 1][1]) * k / 30]) : []);
  const names = ["Road Captain", "Vilks", "Bārda", "Prospect"];
  const bots = names.map((n, i) => ({ id: "demo" + i, name: n, idx: Math.max(0, 40 - i * 9 - (i === 3 ? 25 : 0)) }));
  map.fitBounds(L.polyline(geo).getBounds(), { padding: [60, 60] });
  pack.demo = setInterval(() => bots.forEach((b, i) => {
    const stop = i === 2 && (Date.now() / 1000 % 40) < 12;
    if (!stop) b.idx = (b.idx + 1 + (i === 0 ? 1 : 0)) % geo.length;
    const p = geo[Math.floor(b.idx)];
    upsertRider({ id: b.id, name: b.name, lat: p[0], lon: p[1], speed: stop ? 0 : 70 + i * 8, prog: b.idx });
  }), 1000);
}
try { $("#rider").value = localStorage.getItem("wb-rider") || ""; } catch (e) {}

/* ---------- SOS ---------- */
$("#sosLocate").addEventListener("click", async () => {
  $("#sosLocate").classList.add("busy");
  try {
    const p = await locateMe(); map.flyTo(p, 15);
    const c = `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`, link = `https://maps.google.com/?q=${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    const msg = t("map.sos.msg", { link });
    $("#sosCoords").textContent = c; $("#sosOut").hidden = false;
    $("#sosSms").href = `sms:?&body=${encodeURIComponent(msg)}`;
    $("#sosWa").href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    $("#sosCopy").onclick = () => navigator.clipboard && navigator.clipboard.writeText(c + " " + link).then(() => toast(t("don.copied")));
    if (navigator.share) { $("#sosShare").hidden = false; $("#sosShare").onclick = () => navigator.share({ title: "SOS", text: msg }).catch(() => {}); }
  } catch (e) { toast(t("map.noGeo")); }
  $("#sosLocate").classList.remove("busy");
});

/* ---------- URL params ---------- */
const q = new URLSearchParams(location.search);
if (q.get("route")) loadClubRoute(q.get("route"));
else if (q.get("pts")) { const pts = q.get("pts").split(";").map(s => s.split(",").map(Number)).filter(p => p.length === 2 && !isNaN(p[0])); if (pts.length >= 2) analyse(pts, q.get("name") || "Ride", ""); }
else if (q.get("to")) {
  const [la, lo] = q.get("to").split(",").map(Number);
  showTab("plan"); setGeo($("#to"), q.get("name") || q.get("to"), la, lo);
  setGeo($("#from"), (C.homeBase && C.homeBase.name) || "Rīga", C.homeBase.lat, C.homeBase.lon);
  map.setView([la, lo], 6);
}
if (q.get("tab")) showTab(q.get("tab"));
})();
