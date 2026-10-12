/* WOLVES BROTHERHOOD MC — sākumlapa */
(function(){
const { $, $$, esc, t, tp, L: TL } = WB;
const today = new Date();
const B = WB.base;

WB.initNav();
WB.initRockers();

/* ---------- hero ---------- */
const hero = $(".hero"), img = $("#patch img");
const light = () => requestAnimationFrame(() => hero.classList.add("lit"));
if (img.complete) light(); else { img.addEventListener("load", light); setTimeout(light, 1500); }

/* ---------- today cluster ---------- */
(function todayCluster(){
  $("#tDate").innerHTML = `${today.getDate()}<small>${esc(WB.monthName(today))}, ${esc(WB.weekday(today))}</small>`;
  const n = WB.names(today);
  $("#tNames").textContent = n.main.length ? n.main.join(", ") : t("js.noNames");
  if (n.ext.length) {
    const ext = $("#tNamesExt");
    ext.innerHTML = `${esc(t("js.also"))} ${esc(n.ext.slice(0, 4).join(", "))}${n.ext.length > 4 ? ` <button type="button">+${n.ext.length - 4}</button>` : ""}`;
    const b = ext.querySelector("button"); b && b.addEventListener("click", () => { ext.textContent = t("js.also") + " " + n.ext.join(", "); });
  }
  const nx = WB.nextSpecial(today);
  if (nx) {
    const days = WB.daysUntil(nx.date);
    $("#tNext").textContent = WB.relDays(days);
    $("#tNextWhat").innerHTML = `${esc(nx.name)}<br><span class="muted" style="font-size:.95rem">${esc(WB.dayLabel(nx.date))} · ${esc(WB.typeLabel(nx.type))}</span>`;
  }
  const H = (window.CLUB && CLUB.homeBase) || { lat: 56.9496, lon: 24.1052 };
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${H.lat}&longitude=${H.lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=precipitation_probability&daily=sunrise,sunset&timezone=Europe%2FRiga&forecast_days=2`)
    .then(r => r.json()).then(j => {
      const c = j.current;
      const i0 = Math.max(0, j.hourly.time.findIndex(x => x >= c.time.slice(0, 13)));
      const rain = Math.max(0, ...j.hourly.precipitation_probability.slice(i0, i0 + 6));
      const idx = WB.rideIndex({ rain, temp: c.temperature_2m, gust: c.wind_gusts_10m, code: c.weather_code, precip: c.precipitation });
      $("#tIdx").textContent = idx; $("#tIdxTxt").textContent = WB.rideVerdict(idx);
      $("#needle").style.transform = `rotate(${-90 + idx * 1.8}deg)`;
      $("#tWx").innerHTML = `<span><b>${Math.round(c.temperature_2m)}°</b> ${esc(WB.wmo(c.weather_code))}</span><span>${esc(t("js.rain6h"))} <b>${rain}%</b></span><span>${esc(t("js.wind"))} <b>${Math.round(c.wind_speed_10m)}</b> km/h, ${esc(t("js.gusts"))} <b>${Math.round(c.wind_gusts_10m)}</b> (${esc(WB.dir16(c.wind_direction_10m))})</span><span>${esc(t("js.sun"))} ${j.daily.sunrise[0].slice(11, 16)}–<b>${j.daily.sunset[0].slice(11, 16)}</b></span>`;
    }).catch(() => { $("#tIdxTxt").textContent = t("js.noWeather"); });
})();

/* ---------- chronicle ---------- */
$("#timeline").innerHTML = (window.HISTORY || []).map(h => `
  <li><div class="yr">${esc(TL(h.year))}</div><h3>${esc(TL(h.title))}</h3><p class="muted">${esc(TL(h.text))}</p>${h.sample ? `<span class="tag sample">${esc(t("js.sample"))}</span>` : ""}</li>`).join("");

/* ---------- diary ---------- */
(function diary(){
  const E = [...(window.DIARY || [])].sort((a, b) => b.date.localeCompare(a.date));
  const pL = $("#pL"), pR = $("#pR"), dots = $("#dots"), mq = matchMedia("(max-width:820px)");
  let i = 0;
  const per = () => mq.matches ? 1 : 2;
  const pageHTML = (e, n) => {
    if (!e) return `<div class="book muted" style="opacity:.6">${esc(t("js.emptyPage"))}</div><span class="folio">${n}</span>`;
    const d = WB.parseISO(e.date);
    return `<div class="meta"><span>${esc(WB.dateLong(d))}</span><span>${esc(TL(e.place))}</span>${e.km ? `<span>${e.km} km</span>` : ""}<span>${esc(e.author)}</span>${e.sample ? `<span class="tag sample">${esc(t("js.sample"))}</span>` : ""}</div>
      <h3>${esc(TL(e.title))}</h3><p class="book">${esc(TL(e.text))}</p><span class="folio">${n}</span>`;
  };
  const render = anim => {
    const p = per(), pages = Math.ceil(E.length / p);
    i = Math.max(0, Math.min(i, pages - 1));
    const set = () => { pL.innerHTML = pageHTML(E[i * p], i * p + 1); if (p === 2) pR.innerHTML = pageHTML(E[i * p + 1], i * p + 2); };
    if (anim) {
      [pL, pR].forEach(x => x.classList.add("flip-out"));
      setTimeout(() => { set(); [pL, pR].forEach(x => { x.classList.remove("flip-out"); x.classList.add("flip-in"); }); setTimeout(() => [pL, pR].forEach(x => x.classList.remove("flip-in")), 460); }, 300);
    } else set();
    dots.innerHTML = Array.from({ length: pages }, (_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    $("#prevPage").disabled = i === 0; $("#nextPage").disabled = i >= pages - 1;
  };
  $("#prevPage").addEventListener("click", () => { i--; render(true); });
  $("#nextPage").addEventListener("click", () => { i++; render(true); });
  mq.addEventListener("change", () => render(false));
  render(false);
})();

/* ---------- club events ---------- */
WB.ics = (title, start, end, place, text, allDay) => {
  const f = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const fd = d => WB.iso(d).replace(/-/g, "");
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Wolves Brotherhood MC//EN","BEGIN:VEVENT",`UID:${fd(start)}-${Math.random().toString(36).slice(2)}@wolvesbrotherhoodmc.com`,`DTSTAMP:${f(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${fd(start)}` : `DTSTART:${f(start)}`, allDay ? `DTEND;VALUE=DATE:${fd(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))}` : `DTEND:${f(end)}`,
    `SUMMARY:${title}`, `LOCATION:${place}`, `DESCRIPTION:${(text || "").replace(/\n/g, " ")}`, "END:VEVENT", "END:VCALENDAR"];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" })); a.download = "wolves-" + fd(start) + ".ics"; a.click();
};
(function events(){
  const t0 = WB.day0(today);
  const E = [...(window.EVENTS || [])].map(e => ({ ...e, d: new Date(e.date + "T" + (e.time || "12:00")) })).sort((a, b) => a.d - b.d);
  const up = E.filter(e => e.d >= t0), past = E.filter(e => e.d < t0).slice(-2).reverse();
  $("#events").innerHTML = [...up, ...past].map((e, k) => {
    const days = WB.daysUntil(e.d), isPast = e.d < t0;
    return `<li class="ev ${k === 0 && !isPast ? "next" : ""} ${isPast ? "past" : ""}">
      <div class="ev-date"><b>${e.d.getDate()}</b><span>${esc(WB.monShort(e.d))}</span></div>
      <div><h3>${esc(TL(e.title))}</h3><div class="where"><span>${esc(TL(e.place))}</span>${e.time ? `<span>${esc(t("js.start"))} ${esc(e.time)}</span>` : ""}${e.sample ? `<span class="tag sample">${esc(t("js.sample"))}</span>` : ""}</div>
        <p class="muted">${esc(TL(e.text))}</p>
        <div class="ev-actions">
          ${!isPast ? `<button class="btn ghost small" data-ics="${E.indexOf(e)}">${esc(t("js.addCal"))}</button>` : ""}
          ${e.route ? `<a class="btn ghost small" href="karte.html?route=${esc(e.route)}">${esc(t("js.seeRoute"))}</a>` : ""}
        </div></div>
      <div class="count">${isPast ? esc(t("js.happened")) : esc(WB.relDays(days))}</div>
    </li>`;
  }).join("") || `<li class="ev"><div></div><div><h3>${esc(t("js.noEvents"))}</h3></div></li>`;
  $("#events").addEventListener("click", ev => {
    const b = ev.target.closest("[data-ics]"); if (!b) return;
    const e = E[+b.dataset.ics];
    WB.ics(TL(e.title), e.d, new Date(e.d.getTime() + 4 * 36e5), TL(e.place), TL(e.text));
  });
  // Eiropas tuvākie pasākumi
  const EU = (window.EU_EVENTS || []).map(x => ({ ...x, s: WB.parseISO(x.start), e: WB.parseISO(x.end) })).filter(x => x.e >= t0).sort((a, b) => a.s - b.s).slice(0, 5);
  $("#euMini").innerHTML = EU.map(x => {
    const live = x.s <= t0 && x.e >= t0, d = WB.daysUntil(x.s);
    return `<li><a href="eiropa.html#${esc(x.id)}">
      <span class="eu-d"><b>${x.s.getDate()}</b>${esc(WB.monShort(x.s))}</span>
      <span class="eu-n"><b>${esc(x.name)}</b><small>${esc(x.city)}, ${esc(x.country)} · ${esc(t("eu.type." + x.type))}</small></span>
      <span class="eu-c">${live ? `<span class="live">${esc(t("js.live"))}</span>` : esc(WB.relDays(d))}</span></a></li>`;
  }).join("");
})();

/* ---------- calendar ---------- */
(function calendar(){
  let view = new Date(today.getFullYear(), today.getMonth(), 1), sel = WB.day0(today);
  const grid = $("#calGrid");
  const dows = WB.dowShort();
  const render = () => {
    const y = view.getFullYear(), m = view.getMonth();
    $("#calTitle").textContent = WB.monthYear(view);
    const off = (new Date(y, m, 1).getDay() + 6) % 7, start = new Date(y, m, 1 - off);
    let h = dows.map(d => `<div class="cal-dow">${esc(d)}</div>`).join("");
    for (let k = 0; k < 42; k++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
      if (k >= 35 && d.getMonth() !== m) break;
      const sp = WB.specialDays(d.getFullYear()).filter(x => x.key === WB.iso(d)), n = WB.names(d).main;
      const cls = ["day", d.getMonth() !== m && "out", WB.iso(d) === WB.iso(today) && "today", WB.iso(d) === WB.iso(sel) && "sel", (d.getDay() === 0 || d.getDay() === 6) && "wkend", sp.some(x => x.type === "valsts") && "holiday"].filter(Boolean).join(" ");
      h += `<button class="${cls}" data-d="${WB.iso(d)}" aria-label="${esc(WB.dayLabel(d))}${n.length ? ", " + esc(n.join(", ")) : ""}${sp.length ? ", " + esc(sp.map(x => x.name).join(", ")) : ""}">
        <span class="n">${d.getDate()}</span><span class="nm">${esc(n.join(", "))}</span><span class="marks">${[...new Set(sp.map(x => x.type))].map(x => `<i class="m-${x}"></i>`).join("")}</span></button>`;
    }
    grid.innerHTML = h; side();
  };
  const side = () => {
    const n = WB.names(sel);
    $("#sDate").textContent = `${WB.dayLabel(sel)}, ${WB.weekday(sel)}`;
    $("#sNames").textContent = n.main.length ? n.main.join(", ") : "—";
    $("#sExt").textContent = n.ext.length ? t("js.extended") + " " + n.ext.join(", ") : "";
    $("#sList").innerHTML = WB.specialDays(sel.getFullYear()).filter(x => x.key === WB.iso(sel)).map(x => `<li><i class="m-${x.type}"></i><span><b>${esc(x.name)}</b><br><span class="muted">${esc(WB.typeLabel(x.type))}${x.note ? " · " + esc(x.note) : ""}</span></span></li>`).join("");
  };
  grid.addEventListener("click", e => {
    const b = e.target.closest(".day"); if (!b) return;
    sel = WB.parseISO(b.dataset.d); if (sel.getMonth() !== view.getMonth()) view = new Date(sel.getFullYear(), sel.getMonth(), 1);
    render();
  });
  $("#calPrev").addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
  $("#calNext").addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
  $("#calToday").addEventListener("click", () => { view = new Date(today.getFullYear(), today.getMonth(), 1); sel = WB.day0(today); render(); });
  $("#nameSearch").addEventListener("submit", e => {
    e.preventDefault();
    const q = $("#nameQ").value, r = WB.findName(q), res = $("#nameRes");
    if (!q.trim()) { res.textContent = ""; return; }
    if (!r.length) { res.textContent = t("js.nameNotFound", { name: q }); return; }
    res.innerHTML = r.map(x => { const [mm, dd] = x.k.split("-").map(Number); return `<b>${esc(x.n)}</b>: <a href="#" data-k="${x.k}">${esc(WB.dayLabel(new Date(2024, mm - 1, dd)))}</a>${x.ext ? " " + esc(t("js.extShort")) : ""}`; }).join("<br>");
  });
  $("#nameRes").addEventListener("click", e => {
    const a = e.target.closest("[data-k]"); if (!a) return; e.preventDefault();
    const [mm, dd] = a.dataset.k.split("-").map(Number);
    let y = today.getFullYear(); if (new Date(y, mm - 1, dd) < WB.day0(today)) y++;
    sel = new Date(y, mm - 1, dd); view = new Date(y, mm - 1, 1); render();
  });
  render();
})();

/* ---------- ride HQ teaser ---------- */
(function teaser(){
  const R = window.ROUTES || [];
  $("#routeList").innerHTML = R.map((r, k) => `<li><button data-i="${k}"><span class="rn">${esc(TL(r.name))}</span><span class="rk">~${r.km} km</span><span class="rt">${esc(r.region)} · ${esc(t("route.level." + r.level))} — ${esc(TL(r.text))}</span></button></li>`).join("");
  let map, line, marks; const gc = {};
  const show = async k => {
    $$("#routeList button").forEach(b => b.classList.toggle("on", +b.dataset.i === k));
    const r = R[k]; $("#miniOpen").href = "karte.html?route=" + r.id; $("#miniInfo").textContent = `${TL(r.name)} · ${r.region}`;
    if (!map) return;
    line && line.remove(); marks && marks.remove();
    line = L.polyline(r.pts, { color: "#ECE8DF", weight: 3, opacity: .5, dashArray: "6 8" }).addTo(map);
    marks = L.layerGroup(r.pts.map((p, j) => L.circleMarker(p, { radius: j === 0 ? 6 : 4, color: "#ECE8DF", weight: 2, fillColor: j === 0 ? "#E3120B" : "#000", fillOpacity: 1 }))).addTo(map);
    map.flyToBounds(line.getBounds(), { padding: [40, 40], duration: .8 });
    try {
      const g = gc[r.id] || (gc[r.id] = await WB.osrm(r.pts));
      line.remove(); line = L.polyline(g.geometry.coordinates.map(c => [c[1], c[0]]), { color: "#ECE8DF", weight: 4, opacity: .95 }).addTo(map);
      $("#miniInfo").textContent = `${TL(r.name)} · ${Math.round(g.distance / 1000)} km · ~${Math.floor(g.duration / 3600)} h ${Math.round(g.duration % 3600 / 60)} min`;
    } catch (e) {}
  };
  $("#routeList").addEventListener("click", e => { const b = e.target.closest("button"); b && show(+b.dataset.i); });
  const boot = () => { if (!window.L) return; map = L.map("miniMap", { zoomControl: false, scrollWheelZoom: false }).setView([56.9, 24.6], 7); WB.darkTiles().addTo(map); show(0); };
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: "300px" });
  io.observe($("#miniMap"));
  if (R.length) $$("#routeList button")[0].classList.add("on");
})();

/* ---------- gallery ---------- */
(function gallery(){
  const G = window.GALLERY || [];
  const albums = ["all", ...new Set(G.map(g => g.album))];
  let cur = "all";
  const render = () => {
    $("#albums").innerHTML = albums.map(a => `<button class="chip ${a === cur ? "on" : ""}" data-a="${esc(a)}">${esc(t("gal.album." + a))}</button>`).join("");
    $("#gallery").innerHTML = G.filter(g => cur === "all" || g.album === cur).map(g => `
      <figure tabindex="0" class="${g.patch ? "patch-tile" : ""}" data-src="${esc(B + g.src)}" data-alt="${esc(TL(g.alt))}"><img src="${esc(B + g.src)}" alt="${esc(TL(g.alt))}" loading="lazy"><figcaption>${esc(TL(g.alt))}</figcaption></figure>`).join("")
      + `<div class="add-photo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#A3A098" stroke-width="1.6"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg><span>${esc(t("js.morePhotos"))}</span></div>`;
  };
  $("#albums").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) { cur = b.dataset.a; render(); } });
  const lb = $("#lightbox");
  const open = f => { $("#lbImg").src = f.dataset.src; $("#lbImg").alt = f.dataset.alt; $("#lbCap").textContent = f.dataset.alt; lb.classList.add("open"); $("#lbClose").focus(); };
  $("#gallery").addEventListener("click", e => { const f = e.target.closest("figure"); f && open(f); });
  $("#gallery").addEventListener("keydown", e => { if (e.key === "Enter") { const f = e.target.closest("figure"); f && open(f); } });
  const close = () => lb.classList.remove("open");
  $("#lbClose").addEventListener("click", close);
  lb.addEventListener("click", e => { if (e.target === lb) close(); });
  addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  render();
})();

/* ---------- members ---------- */
(function members(){
  const tab = txt => { const fs = Math.min(40, 340 / Math.max(txt.length, 5));
    return `<svg viewBox="0 0 240 70" aria-hidden="true"><rect x="3" y="3" width="234" height="64" rx="6" fill="#000" stroke="#ECE8DF" stroke-width="4"/><rect x="10" y="10" width="220" height="50" rx="3" fill="none" stroke="#ECE8DF" stroke-width="1.2" opacity=".5"/><text x="120" y="37" text-anchor="middle" dominant-baseline="middle" font-family="WB Display, Impact, sans-serif" font-weight="900" font-size="${fs}" fill="#ECE8DF" letter-spacing="1.5">${esc(txt.toUpperCase())}</text></svg>`; };
  const officers = ["President","Vice President","Sergeant at Arms","Road Captain","Secretary","Treasurer"];
  $("#roster").innerHTML = (window.MEMBERS || []).map(m => `
    <div class="member ${officers.includes(m.role) ? "officer" : ""}">${tab(m.role)}
      <div class="who">${m.road ? esc(m.road) : m.name ? esc(m.name) : `<span class="empty">${m.count ? esc(tp("js.brothers", m.count)) : esc(t("js.nameSoon"))}</span>`}</div>
      <div class="lvr">${esc(t("mem.role." + m.role.replace(/\s/g, "")))}</div></div>`).join("");
})();

/* ---------- merch ---------- */
(function merch(){
  const P = window.MERCH || [];
  const garment = {
    tee: `<path d="M95 40 L58 56 L18 96 L48 132 L76 113 L76 272 L224 272 L224 113 L252 132 L282 96 L242 56 L205 40 C196 62 176 74 150 74 C124 74 104 62 95 40 Z"/><path d="M95 40 C104 62 124 74 150 74 C176 74 196 62 205 40" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"/>`,
    hoodie: `<path d="M102 46 C108 14 192 14 198 46 L244 62 L286 228 L256 240 L228 132 L228 274 L72 274 L72 132 L44 240 L14 228 L56 62 Z"/><path d="M114 50 C120 82 180 82 186 50" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/><path d="M104 214 H196 L186 252 H114 Z" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2"/>`,
    cap: `<path d="M62 176 C58 92 242 92 238 176 Z"/><path d="M36 176 Q150 210 264 176 L266 190 Q150 232 34 190 Z" opacity=".85"/><circle cx="150" cy="96" r="6" opacity=".7"/>`,
    mug: `<rect x="70" y="78" width="140" height="168" rx="12"/><path d="M210 112 C262 112 262 210 210 210" fill="none" stroke-width="16" stroke="currentColor"/>`,
    flag: `<rect x="40" y="30" width="8" height="250" fill="#6b6862"/><path d="M48 44 C110 30 160 62 270 44 L270 194 C160 212 110 180 48 194 Z"/>`,
    sticker: `<circle cx="150" cy="150" r="116" fill="#ECE8DF"/><circle cx="150" cy="150" r="106"/>`
  };
  const pos = { tee: [110, 92, 80], hoodie: [108, 100, 84], cap: [124, 116, 52], mug: [94, 112, 92], flag: [96, 60, 120], sticker: [70, 70, 160] };
  const shot = (p, color) => {
    const light = color.toLowerCase() === "#e8e4dc", [x, y, w] = pos[p.type], tc = light ? "#111" : "#ECE8DF", ff = "WB Display,Impact,sans-serif";
    let art = `<image href="${B}assets/img/mark-256.png" x="${x}" y="${y}" width="${w}" height="${w}"${light ? ' style="filter:invert(1)"' : ""}/>`;
    if (p.design === "support" && p.type !== "sticker") art += `<text x="${x + w / 2}" y="${y + w + 16}" text-anchor="middle" font-family="${ff}" font-weight="900" font-size="${w / 6}" fill="${tc}" letter-spacing="1">SUPPORT</text><text x="${x + w / 2}" y="${y + w + 16 + w / 6.2}" text-anchor="middle" font-family="${ff}" font-weight="800" font-size="${w / 9}" fill="${tc}" letter-spacing="1">WOLVES BROTHERHOOD</text>`;
    if (p.design === "latvia") art += `<text x="${x + w / 2}" y="${y + w + 18}" text-anchor="middle" font-family="${ff}" font-weight="900" font-size="${w / 4.6}" fill="${tc}" letter-spacing="3">LATVIA RIDE</text>`;
    return `<svg viewBox="0 0 300 300" role="img" aria-label="${esc(TL(p.name))}"><g fill="${color}" stroke="${light ? "#bbb" : "#3a3936"}" stroke-width="1.5" color="${color}">${garment[p.type]}</g>${art}</svg>`;
  };
  $("#shelf").innerHTML = P.map(p => `
    <article class="product" data-id="${p.id}"><div class="shot">${shot(p, p.colors[0])}</div>
      <div class="info"><div class="pn">${esc(TL(p.name))}</div>
        <div class="swatches">${p.colors.map((c, k) => `<i role="button" tabindex="0" aria-label="${esc(t("js.color"))} ${k + 1}" data-c="${c}" style="background:${c}"></i>`).join("")}</div>
        <div class="row"><span class="price">${esc(WB.eur(p.price))}</span><button class="btn small" data-buy="${p.id}">${esc(t("js.soon"))}</button></div></div>
    </article>`).join("");
  $("#shelf").addEventListener("click", e => {
    const s = e.target.closest("[data-c]");
    if (s) { const card = s.closest(".product"); card.querySelector(".shot").innerHTML = shot(P.find(x => x.id === card.dataset.id), s.dataset.c); }
    const b = e.target.closest("[data-buy]");
    if (b) { b.textContent = t("js.notify"); location.hash = "pievienoties"; $("#joinForm select").value = "merch"; }
  });
  const shelf = $("#shelf");
  $("#shelfPrev").addEventListener("click", () => shelf.scrollBy({ left: -shelf.clientWidth * .8, behavior: "smooth" }));
  $("#shelfNext").addEventListener("click", () => shelf.scrollBy({ left: shelf.clientWidth * .8, behavior: "smooth" }));
})();

/* ---------- join form ---------- */
$("#joinForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = new FormData(e.target), sel = e.target.topic;
  const body = `${t("join.name")}: ${f.get("name")}\n${t("join.phone")}: ${f.get("phone")}\n${t("join.email")}: ${f.get("email")}\n${t("join.bike")}: ${f.get("bike")}\n\n${f.get("msg")}`;
  location.href = `mailto:${(window.CLUB && CLUB.email) || "info@wolvesbrotherhoodmc.com"}?subject=${encodeURIComponent("[" + sel.options[sel.selectedIndex].text + "] " + f.get("name"))}&body=${encodeURIComponent(body)}`;
  $("#formOk").style.display = "block";
});
})();
