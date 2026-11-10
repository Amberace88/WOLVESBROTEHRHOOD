/* WBMC — lapa „Klubs”: šodiena, hronika, dienasgrāmata, kalendārs (ar publicētajiem pasākumiem), galerija, saziņa */
(function(){
const { $, $$, esc, t, tp, L: TL } = WB;
const today = new Date();
const B = WB.base;

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
$("#timeline").innerHTML = (window.HISTORY || []).map((h, k) => `
  <li data-reveal="${k}"><div class="yr">${esc(TL(h.year))}</div><h3>${esc(TL(h.title))}</h3><p class="muted">${esc(TL(h.text))}</p>${h.sample ? `<span class="tag sample">${esc(t("js.sample"))}</span>` : ""}</li>`).join("");

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

/* ---------- .ics eksports (kopīgs) ---------- */
WB.ics = (title, start, end, place, text, allDay) => {
  const f = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const fd = d => WB.iso(d).replace(/-/g, "");
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Wolves Brotherhood MC//EN","BEGIN:VEVENT",`UID:${fd(start)}-${Math.random().toString(36).slice(2)}@wolvesbrotherhoodmc.com`,`DTSTAMP:${f(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${fd(start)}` : `DTSTART:${f(start)}`, allDay ? `DTEND;VALUE=DATE:${fd(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))}` : `DTEND:${f(end)}`,
    `SUMMARY:${title}`, `LOCATION:${place}`, `DESCRIPTION:${(text || "").replace(/\n/g, " ")}`, "END:VEVENT", "END:VCALENDAR"];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" })); a.download = "wolves-" + fd(start) + ".ics"; a.click();
};

/* publicētie pasākumi kalendārā (no API; ja nav — tikai valsts/piemiņas/moto dienas) */
WB.req("/events?from=" + (today.getFullYear()) + "-01-01&limit=300").then(j => {
  const evs = (j && j.events) || [];
  window.EVENTS = evs.filter(e => e.start).map(e => ({ date: e.start, title: e.title, place: { lv: [e.city, e.country].filter(Boolean).join(", ") } }));
  if (window.__calRender) window.__calRender();
}).catch(() => {});

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
  window.__calRender = () => { WB.clearSpecial(); render(); };
  render();
})();

/* ---------- gallery ---------- */
(function gallery(){
  const G = window.GALLERY || [];
  const albums = ["all", ...new Set(G.map(g => g.album))];
  let cur = "all";
  const render = () => {
    $("#albums").innerHTML = albums.map(a => `<button class="chip ${a === cur ? "on" : ""}" data-a="${esc(a)}">${esc(t("gal.album." + a))}</button>`).join("");
    $("#gallery").innerHTML = G.filter(g => cur === "all" || g.album === cur).map(g => `
      <figure tabindex="0" class="${g.patch ? "patch-tile" : ""} ${g.span ? "g-" + g.span : ""}" data-reveal="${G.indexOf(g) % 4}" data-src="${esc(B + g.src)}" data-alt="${esc(TL(g.alt))}"><img src="${esc(B + g.src)}" alt="${esc(TL(g.alt))}" width="${g.w || 900}" height="${g.h || 600}" loading="lazy" decoding="async"><figcaption>${esc(TL(g.alt))}</figcaption></figure>`).join("");
    if (!$("#galleryMore")) $("#gallery").insertAdjacentHTML("afterend", `<div id="galleryMore">` + `<div class="add-photo"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#A3A098" stroke-width="1.6"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg><span>${esc(t("js.morePhotos"))}</span></div>` + `</div>`);
  };
  $("#albums").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) { cur = b.dataset.a; render(); WB.initReveal($("#gallery")); } });
  const lb = $("#lightbox"); let idx = 0, last = null;
  const figs = () => $$("#gallery figure");
  const show = i => { const F = figs(); idx = (i + F.length) % F.length; const f = F[idx];
    const im = $("#lbImg"); im.classList.remove("in"); im.src = f.dataset.src; im.alt = f.dataset.alt; $("#lbCap").textContent = f.dataset.alt;
    im.onload = () => im.classList.add("in"); };
  const open = f => { last = f; show(figs().indexOf(f)); lb.classList.add("open"); document.body.style.overflow = "hidden"; $("#lbClose").focus(); };
  const close = () => { lb.classList.remove("open"); document.body.style.overflow = ""; last && last.focus(); };
  $("#gallery").addEventListener("click", e => { const f = e.target.closest("figure"); f && open(f); });
  $("#gallery").addEventListener("keydown", e => { if (e.key === "Enter") { const f = e.target.closest("figure"); f && open(f); } });
  $("#lbClose").addEventListener("click", close);
  $("#lbPrev").addEventListener("click", () => show(idx - 1));
  $("#lbNext").addEventListener("click", () => show(idx + 1));
  lb.addEventListener("click", e => { if (e.target === lb) close(); });
  addEventListener("keydown", e => { if (!lb.classList.contains("open")) return; if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); });
  let tx = null; lb.addEventListener("touchstart", e => tx = e.touches[0].clientX, { passive: true });
  lb.addEventListener("touchend", e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); tx = null; });
  render();
})();

/* ---------- join form ---------- */
$("#joinForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = new FormData(e.target), sel = e.target.topic;
  const body = `${t("join.name")}: ${f.get("name")}\n${t("join.phone")}: ${f.get("phone")}\n${t("join.email")}: ${f.get("email")}\n${t("join.bike")}: ${f.get("bike")}\n\n${f.get("msg")}`;
  location.href = `mailto:${"wolvesmc@inbox.lv"}?subject=${encodeURIComponent("[" + sel.options[sel.selectedIndex].text + "] " + f.get("name"))}&body=${encodeURIComponent(body)}`;
  $("#formOk").style.display = "block";
});
})();
