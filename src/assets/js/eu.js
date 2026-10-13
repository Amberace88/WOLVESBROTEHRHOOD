/* WOLVES BROTHERHOOD MC — Eiropas moto pasākumu kalendārs */
(function(){
const { $, $$, esc, t, tp, L: TL } = WB;
WB.initNav(); WB.initRockers();
const HOME = [(window.CLUB && CLUB.homeBase.lat) || 56.9496, (window.CLUB && CLUB.homeBase.lon) || 24.1052];
const NEAR_CC = ["LV","LT","EE","FI","SE","NO","PL","DK"];
const TYPES = ["rally","festival","expo","race","ride","custom-show","season"];
const flag = cc => cc === "EU" ? "🇪🇺" : cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : "";
const country = (cc, fallback) => { try { return cc === "EU" ? t("eu.worldwide") : new Intl.DisplayNames([WB.locale], { type: "region" }).of(cc); } catch (e) { return fallback; } };
const today = WB.day0(new Date());
const ALL = (window.EU_EVENTS || []).map(e => ({ ...e, s: WB.parseISO(e.start), e2: WB.parseISO(e.end), dist: WB.hav(HOME, [e.lat, e.lon]) }))
  .filter(e => e.e2 >= today).sort((a, b) => a.s - b.s);
let saved = new Set(); try { saved = new Set(JSON.parse(localStorage.getItem("wb-eu-saved") || "[]")); } catch (e) {}
const persist = () => { try { localStorage.setItem("wb-eu-saved", JSON.stringify([...saved])); } catch (e) {} };
const state = { type: "all", q: "", cc: "", sort: "date", near: false, mine: false, view: "list" };
const isLive = e => e.s <= today && e.e2 >= today;

/* ---------- live + next ---------- */
(function now(){
  const live = ALL.filter(isLive);
  $("#euLive").innerHTML = live.length
    ? `<h2 class="now-h"><span class="live">${esc(t("js.live"))}</span> ${esc(t("eu.happening"))}</h2><ul>${live.map(e => `<li><a href="#${esc(e.id)}">${flag(e.cc)} <b>${esc(e.name)}</b> <span class="muted">${esc(e.city)} · ${esc(t("eu.untilDay", { d: WB.dayLabel(e.e2) }))}</span></a></li>`).join("")}</ul>`
    : `<h2 class="now-h">${esc(t("eu.noLive"))}</h2><p class="muted">${esc(t("eu.noLiveSub"))}</p>`;
  const soon = ALL.filter(e => e.s > today && WB.daysUntil(e.s) <= 45).slice(0, 4);
  if (soon.length) $("#euLive").insertAdjacentHTML("beforeend", `<h3 class="soon-h">${esc(t("eu.soon"))}</h3><ul class="soon">${soon.map(e => `<li><a href="#${esc(e.id)}"><span class="eu-d"><b>${e.s.getDate()}</b>${esc(WB.monShort(e.s))}</span><span>${flag(e.cc)} <b>${esc(e.name)}</b><small class="muted">${esc(e.city)} · ${esc(t("eu.type." + e.type))}</small></span><span class="muted small">${esc(WB.relDays(WB.daysUntil(e.s)))}</span></a></li>`).join("")}</ul>`);
  const nx = ALL.find(e => e.s > today);
  if (!nx) return;
  const box = $("#euNext");
  const target = new Date(nx.s.getFullYear(), nx.s.getMonth(), nx.s.getDate(), 9);
  box.innerHTML = `<span class="muted">${esc(t("eu.nextUp"))}</span><a href="#${esc(nx.id)}" class="nx-name">${flag(nx.cc)} ${esc(nx.name)}</a><span class="muted">${esc(nx.city)}, ${esc(country(nx.cc, nx.country))} · ${esc(WB.range(nx.s, nx.e2))}</span><div class="clock" id="clock"></div>`;
  const tick = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    $("#clock").innerHTML = [[d, t("eu.cd.d")], [h, t("eu.cd.h")], [m, t("eu.cd.m")], [s, t("eu.cd.s")]].map(([v, l]) => `<span><b>${String(v).padStart(2, "0")}</b><small>${esc(l)}</small></span>`).join("");
  };
  tick(); setInterval(tick, 1000);
})();

/* ---------- filters ---------- */
const counts = TYPES.reduce((o, k) => (o[k] = ALL.filter(e => e.type === k).length, o), {});
$("#typeChips").innerHTML = [`<button class="chip on" data-t="all">${esc(t("eu.all"))} <i>${ALL.length}</i></button>`, ...TYPES.filter(k => counts[k]).map(k => `<button class="chip" data-t="${k}"><span class="dot t-${k}"></span>${esc(t("eu.type." + k))} <i>${counts[k]}</i></button>`)].join("");
const ccs = [...new Set(ALL.map(e => e.cc))].sort((a, b) => country(a, a).localeCompare(country(b, b), WB.locale));
$("#euCountry").innerHTML = `<option value="">${esc(t("eu.allCountries"))}</option>` + ccs.map(c => `<option value="${c}">${flag(c)} ${esc(country(c, c))}</option>`).join("");
$("#typeChips").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; state.type = b.dataset.t; $$("#typeChips .chip").forEach(x => x.classList.toggle("on", x === b)); render(); });
$("#euSearch").addEventListener("input", e => { state.q = e.target.value.trim().toLowerCase(); render(); });
$("#euCountry").addEventListener("change", e => { state.cc = e.target.value; render(); });
$("#euSort").addEventListener("change", e => { state.sort = e.target.value; render(); });
$("#euNear").addEventListener("change", e => { state.near = e.target.checked; render(); });
$("#euMine").addEventListener("change", e => { state.mine = e.target.checked; render(); });
$$(".views button").forEach(b => b.addEventListener("click", () => {
  state.view = b.dataset.view; $$(".views button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
  $("#vList").hidden = state.view !== "list"; $("#vMap").hidden = state.view !== "map"; $("#vTime").hidden = state.view !== "time";
  render();
}));
const filtered = () => {
  let L2 = ALL.filter(e => (state.type === "all" || e.type === state.type) && (!state.cc || e.cc === state.cc) && (!state.near || NEAR_CC.includes(e.cc)) && (!state.mine || saved.has(e.id))
    && (!state.q || [e.name, e.city, e.country, TL(e.desc), e.venue].join(" ").toLowerCase().includes(state.q)));
  if (state.sort === "dist") L2 = [...L2].sort((a, b) => a.dist - b.dist);
  return L2;
};

/* ---------- list view ---------- */
const card = e => {
  const days = WB.daysUntil(e.s), dur = Math.round((e.e2 - e.s) / 864e5) + 1, live = isLive(e);
  const gm = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((e.venue ? e.venue + ", " : "") + e.city)}`;
  return `<article class="ev-card ${live ? "is-live" : ""}" id="${esc(e.id)}" data-id="${esc(e.id)}" data-reveal="0">
    <div class="ec-date"><b>${e.s.getDate()}</b><span>${esc(WB.monShort(e.s))}</span>${dur > 1 ? `<small>${esc(tp("eu.days", dur))}</small>` : ""}</div>
    <div class="ec-main">
      <div class="ec-tags"><span class="ttag t-${e.type}">${esc(t("eu.type." + e.type))}</span>${e.status === "estimated" ? `<span class="tag sample" title="${esc(e.note || "")}">${esc(t("eu.estimated"))}</span>` : `<span class="tag">${esc(t("eu.confirmed"))}</span>`}${live ? `<span class="live">${esc(t("js.live"))}</span>` : ""}</div>
      <h3>${esc(e.name)}</h3>
      <p class="ec-where">${flag(e.cc)} ${esc(e.city)}, ${esc(country(e.cc, e.country))}${e.venue ? " · " + esc(e.venue) : ""}</p>
      <p class="ec-desc">${esc(TL(e.desc))}</p>
      <dl class="ec-facts">
        <div><dt>${esc(t("eu.when"))}</dt><dd>${esc(WB.range(e.s, e.e2))}</dd></div>
        <div><dt>${esc(t("eu.entry"))}</dt><dd>${esc(TL(e.entry))}</dd></div>
        <div><dt>${esc(t("eu.fromRiga"))}</dt><dd>${e.cc === "EU" ? "—" : "~" + WB.num(Math.round(e.dist * 1.25 / 10) * 10) + " km"}</dd></div>
      </dl>
      <div class="ec-actions">
        ${e.url ? `<a class="btn small" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(t("eu.site"))}${WB.icon("ext")}</a>` : ""}
        ${e.cc !== "EU" ? `<a class="btn small ghost" href="karte.html?to=${e.lat},${e.lon}&name=${encodeURIComponent(e.city)}">${WB.icon("route")}${esc(t("eu.plan"))}</a>` : ""}
        <span class="ec-tools">
          <button class="tool" data-ics title="${esc(t("js.addCal"))}" aria-label="${esc(t("js.addCal"))}">${WB.icon("cal")}</button>
          ${e.cc !== "EU" ? `<a class="tool" href="${gm}" target="_blank" rel="noopener" title="${esc(t("eu.mapLink"))}" aria-label="${esc(t("eu.mapLink"))}">${WB.icon("pin")}</a>` : ""}
          <button class="tool save ${saved.has(e.id) ? "on" : ""}" data-save aria-pressed="${saved.has(e.id)}" title="${esc(t(saved.has(e.id) ? "eu.saved" : "eu.save"))}" aria-label="${esc(t(saved.has(e.id) ? "eu.saved" : "eu.save"))}">${WB.icon("star")}</button>
          <button class="tool" data-share title="${esc(t("map.share"))}" aria-label="${esc(t("map.share"))}">${WB.icon("share")}</button>
        </span>
      </div>
    </div>
    <div class="ec-count">${live ? "" : `<b>${days}</b><small>${esc(tp("eu.daysLeft", days))}</small>`}</div>
  </article>`;
};
function renderList(L2){
  requestAnimationFrame(() => WB.initReveal($("#vList")));
  if (!L2.length) { $("#vList").innerHTML = `<div class="empty-state"><h3>${esc(t("eu.empty"))}</h3><p class="muted">${esc(t("eu.emptySub"))}</p></div>`; return; }
  if (state.sort === "dist") { $("#vList").innerHTML = L2.map(card).join(""); return; }
  let h = "", cur = "";
  L2.forEach(e => { const m = WB.monthYear(e.s); if (m !== cur) { cur = m; h += `<h2 class="month-h">${esc(m)}</h2>`; } h += card(e); });
  $("#vList").innerHTML = h;
}
$("#vList").addEventListener("click", async ev => {
  const c = ev.target.closest(".ev-card"); if (!c) return; const e = ALL.find(x => x.id === c.dataset.id);
  if (ev.target.closest("[data-ics]")) WB.ics ? WB.ics(e.name, e.s, e.e2, `${e.venue ? e.venue + ", " : ""}${e.city}, ${e.country}`, TL(e.desc) + " " + (e.url || ""), true) : null;
  if (ev.target.closest("[data-save]")) { const was = saved.has(e.id); was ? saved.delete(e.id) : saved.add(e.id); persist(); render(); toastEu(t(was ? "eu.save" : "eu.saved") + (was ? "" : " ★")); }
  if (ev.target.closest("[data-share]")) { const u = location.href.split("#")[0] + "#" + e.id; try { navigator.share ? await navigator.share({ title: e.name, url: u }) : (await navigator.clipboard.writeText(u), toastEu(t("map.linkCopied"))); } catch (x) {} }
});
function toastEu(msg){ let el = document.getElementById("euToast"); if (!el) { el = document.createElement("div"); el.id = "euToast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); } el.textContent = msg; el.classList.add("show"); clearTimeout(toastEu.t); toastEu.t = setTimeout(() => el.classList.remove("show"), 2200); }
// .ics helper (same as home)
WB.ics = WB.ics || ((title, start, end, place, text, allDay) => {
  const fd = d => WB.iso(d).replace(/-/g, ""), now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Wolves Brotherhood MC//EN","BEGIN:VEVENT",`UID:${fd(start)}-${Math.random().toString(36).slice(2)}@wolvesbrotherhoodmc.com`,`DTSTAMP:${now}`,`DTSTART;VALUE=DATE:${fd(start)}`,`DTEND;VALUE=DATE:${fd(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))}`,`SUMMARY:${title}`,`LOCATION:${place}`,`DESCRIPTION:${text}`,"END:VEVENT","END:VCALENDAR"];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" })); a.download = "event-" + fd(start) + ".ics"; a.click();
});

/* ---------- map view ---------- */
let map, mLayer;
function renderMap(L2){
  if (!window.L) return;
  if (!map) {
    map = window.L.map("euMap", { zoomControl: true, scrollWheelZoom: true }).setView([54, 15], 4);
    WB.darkTiles().addTo(map); mLayer = window.L.layerGroup().addTo(map);
    window.L.marker(HOME, { icon: window.L.divIcon({ className: "pin start", html: "<i></i>", iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map).bindTooltip("Wolves MC · Rīga");
  }
  mLayer.clearLayers();
  L2.filter(e => e.cc !== "EU").forEach(e => {
    window.L.marker([e.lat, e.lon], { icon: window.L.divIcon({ className: "eu-pin t-" + e.type + (isLive(e) ? " is-live" : ""), html: `<i></i><b>${e.s.getDate()}.${e.s.getMonth() + 1}</b>`, iconSize: [20, 20], iconAnchor: [10, 10] }) })
      .addTo(mLayer).bindPopup(`<b>${esc(e.name)}</b><br>${flag(e.cc)} ${esc(e.city)} · ${esc(WB.range(e.s, e.e2))}<br><span class="muted">${esc(t("eu.type." + e.type))}</span><br><a href="#${esc(e.id)}" data-goto="${esc(e.id)}">${esc(t("eu.details"))}</a> · <a href="karte.html?to=${e.lat},${e.lon}&name=${encodeURIComponent(e.city)}">${esc(t("eu.plan"))}</a>`);
  });
  setTimeout(() => map.invalidateSize(), 50);
}
document.addEventListener("click", e => { const a = e.target.closest("[data-goto]"); if (!a) return; e.preventDefault(); $$('.views button')[0].click(); setTimeout(() => focusCard(a.dataset.goto), 50); });

/* ---------- timeline view ---------- */
function renderTime(L2){
  if (!L2.length) { $("#vTime").innerHTML = ""; return; }
  const start = new Date(today.getFullYear(), today.getMonth(), 1), last = L2.reduce((m, e) => e.e2 > m ? e.e2 : m, today);
  const months = []; for (let d = new Date(start); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(new Date(d));
  const end = new Date(months[months.length - 1].getFullYear(), months[months.length - 1].getMonth() + 1, 1), span = end - start;
  const pct = d => ((d - start) / span * 100).toFixed(3);
  $("#vTime").innerHTML = `<div class="tl" style="--cols:${months.length}">
    <div class="tl-head">${months.map(m => `<span>${esc(WB.monShort(m))}<small>${m.getMonth() === 0 || m === months[0] ? m.getFullYear() : ""}</small></span>`).join("")}</div>
    <div class="tl-today" style="left:${pct(today)}%"></div>
    ${[...L2].sort((a, b) => a.s - b.s).map(e => `<a class="tl-row" href="#${esc(e.id)}" data-goto="${esc(e.id)}"><span class="tl-bar t-${e.type}" style="left:${pct(e.s)}%;width:max(6px,${(((e.e2 - e.s) + 864e5) / span * 100).toFixed(3)}%)"></span><span class="tl-label" style="left:${pct(e.s)}%">${flag(e.cc)} ${esc(e.name)}</span></a>`).join("")}
  </div>`;
}

/* ---------- render ---------- */
function render(){
  const L2 = filtered();
  $("#euCount").textContent = tp("eu.count", L2.length);
  if (state.view === "list") renderList(L2); else if (state.view === "map") renderMap(L2); else renderTime(L2);
}
function focusCard(id){
  const el = document.getElementById(id); if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2200);
}
render();
if (location.hash.length > 1) setTimeout(() => focusCard(decodeURIComponent(location.hash.slice(1))), 300);
addEventListener("hashchange", () => focusCard(decodeURIComponent(location.hash.slice(1))));
})();
