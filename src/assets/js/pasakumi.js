/* WBMC — Moto pasākumi: vienots kalendārs (Latvija → Eiropa → citi transporta pasākumi).
   Dati no /api/events (tikai publicēti); ja API nav sasniedzams — saglabātais Eiropas kalendārs (tikai apstiprinātie datumi). */
(function(){
const { $, $$, esc, t, tp } = WB;
const TL = WB.L;
const today = WB.day0(new Date());
const TODAY = WB.iso(today);
const HOME = [56.9496, 24.1052];
const CAT = { lv: ["lv-moto"], eu: ["eu-moto"], other: ["lv-other", "eu-other"] };
const LV_REGIONS = ["Rīga", "Vidzeme", "Kurzeme", "Zemgale", "Latgale"];
/* Eiropas makroreģioni (ja pasākumam nav norādīts reģions) */
const MACRO = { baltics: "LV LT EE", nordics: "FI SE NO DK IS", central: "DE PL CZ SK AT CH HU SI", west: "FR NL BE LU GB IE IM", south: "ES PT IT HR GR MT SM", east: "RO BG RS UA MD", world: "EU" };
const macroOf = cc => Object.keys(MACRO).find(k => MACRO[k].split(" ").includes(cc)) || "other";
const regionOf = e => e.region || (e.country === "LV" ? "" : "mr:" + macroOf(e.country));
const regionLabel = r => r.startsWith("mr:") ? t("events.mr." + r.slice(3)) : r;
let DN; try { DN = new Intl.DisplayNames([WB.locale], { type: "region" }); } catch (e) { DN = null; }
const country = cc => !cc ? "" : cc === "EU" ? t("events.worldwide") : (DN && DN.of(cc)) || cc;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
const groupOf = e => Object.keys(CAT).find(k => CAT[k].includes(e.category)) || "eu";

/* ---------- stāvoklis ---------- */
const saved = new Set();
try { JSON.parse(localStorage.getItem("wb-ev-saved") || "[]").forEach(x => saved.add(x)); JSON.parse(localStorage.getItem("wb-eu-saved") || "[]").forEach(x => saved.add(x)); } catch (e) {}
const persist = () => { try { localStorage.setItem("wb-ev-saved", JSON.stringify([...saved])); } catch (e) {} };
let view = "list"; try { view = ["list", "cal", "map", "time"].includes(localStorage.getItem("wb-ev-view")) ? localStorage.getItem("wb-ev-view") : "list"; } catch (e) {}
const S = { cat: "lv", q: "", country: "", region: "", type: "", org: "", from: TODAY, to: "", saved: false };
let ALL = [], offline = false, calMonth = null, map = null, mLayer = null, tick = null;

const norm = e => ({ ...e, s: WB.parseISO(e.start), e2: WB.parseISO(e.end || e.start), name: TL(e.title), desc: TL(e.description) });
const isLive = e => e.status !== "cancelled" && e.s <= today && e.e2 >= today;
const isPast = e => e.e2 < today;

async function load(){
  const from = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  try {
    const j = await WB.req(`/events?from=${WB.iso(from)}&limit=500&includeCancelled=1`);
    ALL = (j.events || []).map(norm);
  } catch (e) {
    offline = true;
    /* rezerves dati: tikai organizatora apstiprinātie datumi, bez provizoriskiem kalendāriem */
    ALL = (window.EU_EVENTS || []).filter(x => x.status === "confirmed" && !/provisional/i.test(x.note || "")).map(x => norm({
      id: x.id, slug: x.id, category: x.cc === "LV" ? "lv-moto" : "eu-moto", type: x.type, title: { en: x.name }, description: x.desc, start: x.start, end: x.end,
      country: x.cc, city: x.city, venue: x.venue, lat: x.lat, lng: x.lon, organizer: null, officialUrl: x.url, sourceUrl: x.source, official: false, status: x.end < TODAY ? "ended" : "published"
    }));
  }
  ALL.sort((a, b) => a.s - b.s || a.e2 - b.e2);
}

/* ---------- filtri ---------- */
const inCat = e => CAT[S.cat].includes(e.category);
const upcomingIn = k => ALL.filter(e => CAT[k].includes(e.category) && !isPast(e) && e.status !== "cancelled").length;
function filtered(){
  const q = S.q.toLocaleLowerCase(WB.locale);
  return ALL.filter(e => inCat(e)
    && e.end >= (S.from || "0000") && (!S.to || e.start <= S.to)
    && (!S.country || e.country === S.country) && (!S.region || regionOf(e) === S.region)
    && (!S.type || e.type === S.type) && (!S.org || e.organizer === S.org) && (!S.saved || saved.has(e.id))
    && (!q || [e.name, e.desc, e.city, e.venue, e.organizer, country(e.country)].join(" ").toLocaleLowerCase(WB.locale).includes(q)));
}
const activeFilters = () => ["q", "country", "region", "type", "org", "to", "saved"].filter(k => S[k]).length + (S.from !== TODAY ? 1 : 0);
const opt = (v, label, sel) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(label)}</option>`;
function fillSelects(){
  const f = $("#evFilters"), list = ALL.filter(inCat);
  const uniq = arr => [...new Set(arr.filter(Boolean))];
  const ccs = uniq(list.map(e => e.country)).sort((a, b) => country(a).localeCompare(country(b), WB.locale));
  f.country.innerHTML = opt("", t("events.allCountries"), S.country) + ccs.map(c => opt(c, country(c), S.country)).join("");
  f.country.closest(".ev-f").hidden = ccs.length < 2;
  let regs = uniq(list.map(regionOf));
  regs.sort((a, b) => { const ia = LV_REGIONS.indexOf(a), ib = LV_REGIONS.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || regionLabel(a).localeCompare(regionLabel(b), WB.locale); });
  f.region.innerHTML = opt("", t("events.allRegions"), S.region) + regs.map(r => opt(r, regionLabel(r), S.region)).join("");
  f.region.closest(".ev-f").hidden = regs.length < 2;
  const types = uniq(list.map(e => e.type));
  f.type.innerHTML = opt("", t("events.allTypes"), S.type) + types.map(x => opt(x, t("events.type." + x), S.type)).join("");
  f.type.closest(".ev-f").hidden = types.length < 2;
  const orgs = uniq(list.map(e => e.organizer)).sort((a, b) => a.localeCompare(b, WB.locale));
  f.org.innerHTML = opt("", t("events.allOrganizers"), S.org) + orgs.map(o => `<option value="${esc(o)}"${o === S.org ? " selected" : ""}>${esc(o.length > 60 ? o.slice(0, 58) + "…" : o)}</option>`).join("");
  f.org.closest(".ev-f").hidden = !orgs.length;
  f.from.value = S.from; f.to.value = S.to; f.q.value = S.q; f.saved.checked = S.saved;
}
function syncFilterUi(){
  const n = activeFilters();
  $("#evReset").hidden = !n;
  $("#evFCount").textContent = n ? ` · ${n}` : "";
}

/* ---------- kopsavilkums: tagad / nākamais ---------- */
function summary(){
  clearInterval(tick);
  const box = $("#evSummary"), list = ALL.filter(e => inCat(e) && e.status !== "cancelled");
  const live = list.filter(isLive), next = list.find(e => e.s > today);
  const propose = WB.can("events", "c") ? `<button type="button" class="btn ghost small" id="evPropose">${WB.icon("cal")}${esc(t("events.propose"))}</button>` : "";
  const note = offline ? `<p class="ev-offline">${esc(t("events.offline"))}</p>` : "";
  let main = "";
  if (live.length) {
    main = `<div class="ev-sum-main"><p class="ev-sum-k"><span class="live">${esc(t("events.liveNow"))}</span></p>
      <ul class="ev-sum-live">${live.slice(0, 3).map(e => `<li><a href="#e-${esc(e.id)}">${esc(e.name)}</a> <span class="muted">${esc([e.city, country(e.country)].filter(Boolean).join(", "))} · ${esc(t("events.until", { d: WB.dayLabel(e.e2) }))}</span></li>`).join("")}</ul>
      ${next ? `<p class="ev-sum-after small muted">${esc(t("events.thenNext"))} <a href="#e-${esc(next.id)}">${esc(next.name)}</a> · ${esc(WB.range(next.s, next.e2))}</p>` : ""}</div>`;
  } else if (next) {
    main = `<div class="ev-sum-main"><p class="ev-sum-k">${esc(t("events.nextUp"))}</p>
      <a class="ev-sum-name" href="#e-${esc(next.id)}">${esc(next.name)}</a>
      <p class="ev-sum-meta">${esc(WB.range(next.s, next.e2))} · ${esc([next.city, country(next.country)].filter(Boolean).join(", "))}</p></div>
      <div class="ev-clock" id="evClock" aria-label="${esc(t("events.countdown"))}"></div>`;
  } else {
    main = `<div class="ev-sum-main"><p class="ev-sum-k">${esc(t("events.nextUp"))}</p><p class="ev-sum-meta">${esc(t("events.noUpcoming"))}</p></div>`;
  }
  box.innerHTML = `${main}${propose ? `<div class="ev-sum-side">${propose}</div>` : ""}${note}`;
  if (next && !live.length) {
    const target = new Date(next.s.getFullYear(), next.s.getMonth(), next.s.getDate(), next.startTime ? +next.startTime.slice(0, 2) : 9, next.startTime ? +next.startTime.slice(3, 5) : 0);
    const paint = () => {
      let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60);
      const c = $("#evClock"); if (!c) return clearInterval(tick);
      c.innerHTML = [[d, tp("events.cd.d", d)], [h, tp("events.cd.h", h)], [m, tp("events.cd.m", m)]].map(([v, l]) => `<span><b class="num">${v}</b><small>${esc(l)}</small></span>`).join("");
    };
    paint(); tick = setInterval(paint, 30000);
  }
  const pb = $("#evPropose"); pb && pb.addEventListener("click", propose_);
}

/* ---------- saites ---------- */
const lang = WB.lang;
const icsUrl = e => `/api/events/${encodeURIComponent(e.id)}.ics?lang=${lang}`;
const ymd = d => WB.iso(d).replace(/-/g, "");
const gcal = e => {
  const end = new Date(e.e2.getFullYear(), e.e2.getMonth(), e.e2.getDate() + 1);
  const det = [e.desc, e.organizer ? `${t("events.organizer")}: ${e.organizer}` : "", e.officialUrl || "", pageLink(e)].filter(Boolean).join("\n\n");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.name)}&dates=${ymd(e.s)}/${ymd(end)}&details=${encodeURIComponent(det)}&location=${encodeURIComponent([e.venue, e.city, country(e.country)].filter(Boolean).join(", "))}`;
};
const pageLink = e => location.origin + location.pathname + "#e-" + e.id;
const plan = e => e.lat != null && e.country !== "EU" ? `karte.html?to=${e.lat},${e.lng}&name=${encodeURIComponent(e.city || e.name)}` : "";
const where = e => [e.venue, [e.city, country(e.country)].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
const dateBlock = e => {
  const same = e.start === e.end, sm = e.s.getMonth() === e.e2.getMonth() && e.s.getFullYear() === e.e2.getFullYear();
  const wd = d => new Intl.DateTimeFormat(WB.locale, { weekday: "short" }).format(d).replace(".", "");
  return `<div class="ev-date" aria-hidden="true"><b class="num">${same ? e.s.getDate() : sm ? `${e.s.getDate()}–${e.e2.getDate()}` : `${e.s.getDate()}<i>–</i>${e.e2.getDate()}`}</b>
    <span>${esc(sm ? WB.monShort(e.s) : `${WB.monShort(e.s)} – ${WB.monShort(e.e2)}`)}</span><small>${esc(same ? wd(e.s) : `${wd(e.s)} – ${wd(e.e2)}`)}</small></div>`;
};
const badges = e => [
  `<span class="ev-type">${esc(t("events.type." + e.type))}</span>`,
  e.official ? `<span class="badge official">${esc(t("ev.official"))}</span>` : "",
  e.status === "cancelled" ? `<span class="badge bad">${esc(t("status.cancelled"))}</span>` : "",
  isLive(e) ? `<span class="live">${esc(t("events.liveNow"))}</span>` : "",
  e.status !== "cancelled" && isPast(e) ? `<span class="badge">${esc(t("status.ended"))}</span>` : ""
].join("");
const until = e => {
  if (e.status === "cancelled" || isPast(e) || isLive(e)) return "";
  const n = WB.daysUntil(e.s);
  return `<div class="ev-until"><b class="num">${n}</b><small>${esc(tp("events.daysLeft", n))}</small></div>`;
};
function row(e){
  const on = saved.has(e.id), p = plan(e);
  return `<li class="ev${e.status === "cancelled" ? " is-cancelled" : ""}${isLive(e) ? " is-live" : ""}${isPast(e) ? " is-past" : ""}" id="e-${esc(e.id)}" data-id="${esc(e.id)}">
    ${dateBlock(e)}
    <div class="ev-body">
      <div class="ev-tags">${badges(e)}</div>
      <h3 class="ev-title"><span class="sr-only">${esc(WB.range(e.s, e.e2))}: </span>${esc(e.name)}</h3>
      <p class="ev-where">${WB.icon("pin")}<span>${esc(where(e))}</span></p>
      ${e.desc ? `<p class="ev-desc">${esc(e.desc)}</p>` : ""}
      <dl class="ev-meta">
        <div><dt>${esc(t("events.organizer"))}</dt><dd>${e.organizer ? esc(e.organizer) : `<span class="dim">${esc(t("events.orgUnknown"))}</span>`}</dd></div>
        <div><dt>${esc(t("events.source"))}</dt><dd>${e.sourceUrl ? `<a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(host(e.sourceUrl))}</a>` : `<span class="dim">—</span>`}</dd></div>
        ${e.startTime ? `<div><dt>${esc(t("events.startTime"))}</dt><dd class="num">${esc(e.startTime)}</dd></div>` : ""}
      </dl>
      <div class="ev-act">
        ${e.officialUrl ? `<a class="btn small" href="${esc(e.officialUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("events.official"))}${WB.icon("ext")}</a>` : ""}
        ${!isPast(e) && e.status !== "cancelled" ? `${offline ? "" : `<a class="btn ghost small" href="${esc(icsUrl(e))}" download title="${esc(t("events.remindHint"))}">${WB.icon("cal")}${esc(t("events.addCal"))}</a>`}
        <a class="ev-link" href="${esc(gcal(e))}" target="_blank" rel="noopener noreferrer">${esc(t("events.gcal"))}</a>` : ""}
        ${p && !isPast(e) ? `<a class="ev-link" href="${esc(p)}">${esc(t("events.plan"))}</a>` : ""}
        <span class="ev-tools">
          <button type="button" class="icon-btn" data-share aria-label="${esc(t("events.share"))}" title="${esc(t("events.share"))}">${WB.icon("share")}</button>
          <button type="button" class="icon-btn ev-save${on ? " on" : ""}" data-save aria-pressed="${on}" aria-label="${esc(t(on ? "events.saved" : "events.save"))}" title="${esc(t(on ? "events.saved" : "events.save"))}">${WB.icon("star")}</button>
        </span>
      </div>
    </div>
    ${until(e)}
  </li>`;
}

/* ---------- skati ---------- */
function emptyState(){
  if (activeFilters()) return `<div class="empty"><p>${esc(t("events.emptyFilter"))}</p><button type="button" class="btn ghost small" data-reset>${esc(t("events.reset"))}</button></div>`;
  const k = S.cat;
  const alt = k === "lv" ? ["eu", "events.seeEurope"] : k === "eu" ? ["lv", "events.seeLatvia"] : ["lv", "events.seeLatvia"];
  return `<div class="empty"><p>${esc(t("events.empty." + k))}</p>${WB.can("events", "c") ? `<p class="small">${esc(t("events.emptyPropose"))}</p>` : ""}<button type="button" class="btn ghost small" data-cat-go="${alt[0]}">${esc(t(alt[1]))}</button></div>`;
}
function renderList(L){
  const box = $("#vList");
  if (!L.length) { box.innerHTML = emptyState(); return; }
  let h = "", cur = "", items = [];
  const flush = () => { if (cur) h += `<section class="ev-month"><h2>${esc(cur)}<small>${esc(tp("events.count", items.length))}</small></h2><ol class="ev-rows">${items.join("")}</ol></section>`; };
  for (const e of L) { const m = WB.monthYear(e.s); if (m !== cur) { flush(); cur = m; items = []; } items.push(row(e)); }
  flush();
  box.innerHTML = h;
}
function renderCal(L){
  const box = $("#vCal");
  if (!calMonth) { const f = L.find(e => !isPast(e)) || L[0]; calMonth = f ? new Date(Math.max(f.s, new Date(today.getFullYear(), today.getMonth(), 1)) ) : new Date(today); calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1); }
  const y = calMonth.getFullYear(), m = calMonth.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const off = (first.getDay() + 6) % 7, start = new Date(y, m, 1 - off);
  const inMonth = L.filter(e => e.s <= last && e.e2 >= first);
  let cells = WB.dowShort().map(d => `<div class="cal-dow" aria-hidden="true">${esc(d)}</div>`).join("");
  for (let k = 0; k < 42; k++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
    if (k >= 35 && d.getMonth() !== m) break;
    const evs = inMonth.filter(e => e.s <= d && e.e2 >= d);
    const cls = ["cal-day", d.getMonth() !== m && "out", WB.iso(d) === TODAY && "today", evs.length && "has"].filter(Boolean).join(" ");
    cells += `<div class="${cls}"><span class="cal-n">${d.getDate()}</span>${evs.slice(0, 3).map(e => `<a class="cal-ev${e.status === "cancelled" ? " x" : ""}" href="#e-${esc(e.id)}" data-goto="${esc(e.id)}" title="${esc(e.name)}">${esc(e.name)}</a>`).join("")}${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3}</span>` : ""}${evs.length ? `<span class="cal-dots" aria-hidden="true">${evs.slice(0, 4).map(() => "<i></i>").join("")}</span>` : ""}</div>`;
  }
  box.innerHTML = `<div class="cal-head"><button type="button" class="icon-btn" data-cal="-1" aria-label="${esc(t("events.prevMonth"))}">${WB.icon("back")}</button><h2>${esc(WB.monthYear(first))}</h2><button type="button" class="icon-btn cal-nx" data-cal="1" aria-label="${esc(t("events.nextMonth"))}">${WB.icon("back")}</button></div>
    <div class="cal-grid" role="presentation">${cells}</div>
    <h3 class="cal-sub">${esc(tp("events.count", inMonth.length))} · ${esc(WB.monthYear(first))}</h3>
    ${inMonth.length ? `<ol class="cal-list">${inMonth.map(e => `<li><a href="#e-${esc(e.id)}" data-goto="${esc(e.id)}"><span class="num">${esc(WB.range(e.s, e.e2))}</span><b>${esc(e.name)}</b><small>${esc([e.city, country(e.country)].filter(Boolean).join(", "))}</small></a></li>`).join("")}</ol>` : `<p class="muted small">${esc(t("events.calEmpty"))}</p>`}`;
}
function renderMap(L){
  if (!window.L) { $("#vMap").innerHTML = `<div class="empty"><p>${esc(t("events.mapUnavailable"))}</p></div>`; return; }
  if (!map) {
    map = window.L.map("evMap", { zoomControl: true, scrollWheelZoom: false }).setView([56.9, 24.6], 7);
    WB.darkTiles().addTo(map); mLayer = window.L.layerGroup().addTo(map);
    window.L.marker(HOME, { icon: window.L.divIcon({ className: "ev-home", html: "<i></i>", iconSize: [14, 14], iconAnchor: [7, 7] }), keyboard: false }).addTo(map).bindTooltip("WBMC · Rīga");
  }
  mLayer.clearLayers();
  const pts = L.filter(e => e.lat != null && e.lng != null && e.country !== "EU");
  pts.forEach(e => {
    const p = plan(e);
    window.L.marker([e.lat, e.lng], { title: e.name, icon: window.L.divIcon({ className: "ev-pin" + (isLive(e) ? " is-live" : "") + (e.status === "cancelled" ? " x" : ""), html: `<b>${e.s.getDate()}.${e.s.getMonth() + 1}.</b>`, iconSize: null, iconAnchor: [22, 30] }) })
      .addTo(mLayer).bindPopup(`<div class="ev-pop"><b>${esc(e.name)}</b><span>${esc(WB.range(e.s, e.e2))}</span><span class="muted">${esc(where(e))}</span><span><a href="#e-${esc(e.id)}" data-goto="${esc(e.id)}">${esc(t("events.details"))}</a>${p ? ` · <a href="${esc(p)}">${esc(t("events.plan"))}</a>` : ""}</span></div>`);
  });
  setTimeout(() => {
    map.invalidateSize();
    if (pts.length) map.fitBounds(window.L.latLngBounds(pts.map(e => [e.lat, e.lng])).pad(0.15), { maxZoom: S.cat === "lv" ? 9 : 7 });
    else map.setView(S.cat === "lv" ? [56.9, 24.6] : [52, 12], S.cat === "lv" ? 7 : 4);
  }, 60);
  const off = L.length - pts.length;
  $("#evCount").textContent = tp("events.count", L.length) + (off ? ` · ${t("events.notOnMap", { n: off })}` : "");
}
function renderTime(L){
  const box = $("#vTime");
  if (!L.length) { box.innerHTML = emptyState(); return; }
  const first = L[0].s < today && S.from < TODAY ? L[0].s : today;
  const start = new Date(first.getFullYear(), first.getMonth(), 1), lastD = L.reduce((x, e) => e.e2 > x ? e.e2 : x, today);
  const months = []; for (let d = new Date(start); d <= lastD; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(new Date(d));
  const end = new Date(months[months.length - 1].getFullYear(), months[months.length - 1].getMonth() + 1, 1), span = end - start;
  const pct = d => ((d - start) / span * 100).toFixed(3);
  box.innerHTML = `<div class="tl-scroll"><div class="tl" style="--cols:${months.length}">
    <div class="tl-head">${months.map((m, i) => `<span>${esc(WB.monShort(m))}${m.getMonth() === 0 || i === 0 ? `<small>${m.getFullYear()}</small>` : ""}</span>`).join("")}</div>
    ${today >= start && today < end ? `<div class="tl-today" style="left:${pct(today)}%"><span>${esc(t("js.today"))}</span></div>` : ""}
    <ol class="tl-rows">${L.map(e => `<li><a class="tl-row${e.status === "cancelled" ? " x" : ""}${isLive(e) ? " is-live" : ""}" href="#e-${esc(e.id)}" data-goto="${esc(e.id)}"><span class="tl-bar" style="left:${pct(e.s)}%;width:max(6px,${(((e.e2 - e.s) + 864e5) / span * 100).toFixed(3)}%)"></span><span class="tl-label${(e.s - start) / span > .55 ? " rev" : ""}" style="${(e.s - start) / span > .55 ? `right:${(100 - +pct(new Date(e.e2.getFullYear(), e.e2.getMonth(), e.e2.getDate() + 1))).toFixed(3)}%` : `left:${pct(e.s)}%`}"><b>${esc(e.name)}</b> <small>${esc(WB.range(e.s, e.e2))}</small></span></a></li>`).join("")}</ol>
  </div></div>`;
}

/* ---------- kopējā zīmēšana ---------- */
function render(){
  const L = filtered();
  $$("#evCats [data-cat]").forEach(b => { const on = b.dataset.cat === S.cat; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; $(".n", b).textContent = upcomingIn(b.dataset.cat) ? " " + upcomingIn(b.dataset.cat) : ""; });
  $("#evResults").setAttribute("aria-labelledby", "tab-" + S.cat);
  $$("#evViews [data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === view));
  ["list", "cal", "map", "time"].forEach(v => { $("#v" + v[0].toUpperCase() + v.slice(1)).hidden = v !== view; });
  $("#evCount").textContent = tp("events.count", L.length) + (S.from === TODAY && !S.to ? " · " + t("events.fromToday") : "");
  syncFilterUi();
  if (view === "list") renderList(L); else if (view === "cal") renderCal(L); else if (view === "map") renderMap(L); else renderTime(L);
}
function setCat(k, keep){
  if (S.cat === k && keep) return;
  S.cat = k; calMonth = null;
  if (!keep) Object.assign(S, { country: "", region: "", type: "", org: "" });
  fillSelects(); summary(); render();
}
function setView(v){ view = v; try { localStorage.setItem("wb-ev-view", v); } catch (e) {} render(); }
function resetFilters(){ Object.assign(S, { q: "", country: "", region: "", type: "", org: "", from: TODAY, to: "", saved: false }); fillSelects(); render(); }

/* atvērt konkrētu pasākumu (#e-<id>): pārslēdz kategoriju, notīra filtrus, ritina un iezīmē */
function focusEvent(id, smooth = true){
  const e = ALL.find(x => x.id === id || x.slug === id);
  if (!e) return;
  const g = groupOf(e);
  let need = g !== S.cat || view !== "list" || !filtered().includes(e);
  if (need) {
    S.cat = g; calMonth = null; view = "list";
    Object.assign(S, { q: "", country: "", region: "", type: "", org: "", to: "", saved: false, from: e.end < TODAY ? WB.iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())) : TODAY });
    fillSelects(); summary(); render();
  }
  const el = document.getElementById("e-" + e.id); if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto", block: "center" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 2400);
  });
}

/* ---------- ieteikt pasākumu (biedri ar events:c → „pārbaudē”) ---------- */
function propose_(){
  const cats = ["lv-moto", "eu-moto", "lv-other", "eu-other"], types = ["rally", "festival", "expo", "race", "ride", "custom-show", "season", "show", "other"];
  const defCat = CAT[S.cat][0];
  const body = `<p class="muted small">${esc(t("events.proposeText"))}</p>
    <label class="field"><span>${esc(t("events.f.title"))} *</span><input type="text" name="title" maxlength="200" required></label>
    <div class="two"><label class="field"><span>${esc(t("events.f.category"))}</span><select name="category">${cats.map(c => opt(c, t("events.catName." + c), defCat)).join("")}</select></label>
      <label class="field"><span>${esc(t("events.type"))}</span><select name="type">${types.map(x => opt(x, t("events.type." + x), "rally")).join("")}</select></label></div>
    <div class="two"><label class="field"><span>${esc(t("events.f.start"))} *</span><input type="date" name="start" required min="${TODAY}"></label>
      <label class="field"><span>${esc(t("events.f.end"))}</span><input type="date" name="end" min="${TODAY}"></label></div>
    <div class="two"><label class="field"><span>${esc(t("events.f.city"))}</span><input type="text" name="city" maxlength="80"></label>
      <label class="field"><span>${esc(t("events.f.country"))}</span><input type="text" name="country" maxlength="2" value="${defCat.startsWith("lv") ? "LV" : ""}" placeholder="LV" pattern="[A-Za-z]{2}" autocapitalize="characters"></label></div>
    <label class="field"><span>${esc(t("events.f.venue"))}</span><input type="text" name="venue" maxlength="160"></label>
    <label class="field"><span>${esc(t("events.organizer"))}</span><input type="text" name="organizer" maxlength="160"></label>
    <label class="field"><span>${esc(t("events.f.officialUrl"))}</span><input type="url" name="officialUrl" maxlength="600" placeholder="https://"></label>
    <label class="field"><span>${esc(t("events.f.sourceUrl"))}</span><input type="url" name="sourceUrl" maxlength="600" placeholder="https://"></label>
    <label class="field"><span>${esc(t("events.f.desc"))}</span><textarea name="description" maxlength="1500" rows="3"></textarea></label>
    <p class="hint">${esc(t("events.proposeHint"))}</p><p class="form-err" role="alert"></p>`;
  WB.modal({ title: t("events.propose"), wide: true, body: `<div class="form">${body}</div>`, actions: [{ label: t("btn.cancel"), value: "" }, { label: t("events.proposeSend"), value: "ok", primary: true }],
    onOpen: d => {
      const f = d.querySelector("form"); f.noValidate = true; f.title.focus();
      f.category.addEventListener("change", () => { if (f.category.value.startsWith("lv")) f.country.value = "LV"; else if (f.country.value.toUpperCase() === "LV") f.country.value = ""; });
      f.addEventListener("submit", async ev => {
        if (!ev.submitter || ev.submitter.value !== "ok") return;
        ev.preventDefault();
        if (!f.reportValidity()) return;
        try {
          await WB.req("/admin/events", { body: { title: { [lang === "lv" ? "lv" : "en"]: f.title.value.trim() }, category: f.category.value, type: f.type.value, start: f.start.value, end: f.end.value || f.start.value,
            city: f.city.value, country: f.country.value.toUpperCase(), venue: f.venue.value, organizer: f.organizer.value, officialUrl: f.officialUrl.value, sourceUrl: f.sourceUrl.value,
            description: f.description.value.trim() ? { [lang === "lv" ? "lv" : "en"]: f.description.value.trim() } : {} } });
          d.close("ok"); WB.toast(t("events.proposeDone"));
        } catch (x) { d.querySelector(".form-err").textContent = WB.errMsg(x); }
      });
    } });
}

/* ---------- notikumi ---------- */
function bind(){
  const f = $("#evFilters");
  f.addEventListener("submit", e => e.preventDefault());
  f.q.addEventListener("input", () => { S.q = f.q.value.trim(); render(); });
  ["country", "region", "type", "org"].forEach(k => f[k].addEventListener("change", () => { S[k] = f[k].value; calMonth = null; render(); }));
  f.from.addEventListener("change", () => { S.from = f.from.value || TODAY; calMonth = null; render(); });
  f.to.addEventListener("change", () => { S.to = f.to.value; render(); });
  f.saved.addEventListener("change", () => { S.saved = f.saved.checked; render(); });
  $("#evReset").addEventListener("click", resetFilters);
  $("#evFToggle").addEventListener("click", () => { const o = f.classList.toggle("open"); $("#evFToggle").setAttribute("aria-expanded", o); });
  const tabs = $$("#evCats [data-cat]");
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => setCat(b.dataset.cat));
    b.addEventListener("keydown", e => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setCat(n.dataset.cat); });
  });
  $$("#evViews [data-view]").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#app").addEventListener("click", async ev => {
    const go = ev.target.closest("[data-goto]");
    if (go) { ev.preventDefault(); if (map) map.closePopup(); history.replaceState(null, "", "#e-" + go.dataset.goto); focusEvent(go.dataset.goto); return; }
    if (ev.target.closest("[data-reset]")) return resetFilters();
    const cg = ev.target.closest("[data-cat-go]"); if (cg) { setCat(cg.dataset.catGo); $("#tab-" + cg.dataset.catGo).focus(); return; }
    const cal = ev.target.closest("[data-cal]"); if (cal) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + +cal.dataset.cal, 1); render(); $(`[data-cal="${cal.dataset.cal}"]`).focus(); return; }
    const li = ev.target.closest(".ev[data-id]"); if (!li) return;
    const e = ALL.find(x => x.id === li.dataset.id);
    if (ev.target.closest("[data-save]")) {
      const was = saved.has(e.id); was ? saved.delete(e.id) : saved.add(e.id); persist();
      const b = ev.target.closest("[data-save]"); b.classList.toggle("on", !was); b.setAttribute("aria-pressed", !was); b.setAttribute("aria-label", t(was ? "events.save" : "events.saved")); b.title = t(was ? "events.save" : "events.saved");
      WB.toast(t(was ? "events.unsavedToast" : "events.savedToast"));
      if (S.saved) render();
    }
    if (ev.target.closest("[data-share]")) {
      const u = pageLink(e);
      try { if (navigator.share) await navigator.share({ title: e.name, text: `${e.name} · ${WB.range(e.s, e.e2)}`, url: u }); else { await navigator.clipboard.writeText(u); WB.toast(t("events.linkCopied")); } }
      catch (x) { if (x && x.name !== "AbortError") WB.toast(u); }
    }
  });
  const ical = location.origin + "/api/events.ics?lang=" + lang;
  $("#evIcal").href = ical;
  $("#evIcalCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(ical); WB.toast(t("events.linkCopied")); } catch (e) { WB.toast(ical); } });
  addEventListener("hashchange", () => { const m = location.hash.match(/^#e-(.+)$/); if (m) focusEvent(decodeURIComponent(m[1])); });
}

document.addEventListener("DOMContentLoaded", async () => {
  bind();
  $("#vList").innerHTML = `<p class="muted ev-loading">${esc(t("events.loading"))}</p>`;
  await Promise.all([load(), WB.session()]);
  const m = location.hash.match(/^#e-(.+)$/);
  fillSelects(); summary(); render();
  if (m) setTimeout(() => focusEvent(decodeURIComponent(m[1]), false), 120);
});
})();
