/* WBMC — sākumlapa: šodienas josla, tuvākie moto pasākumi (Latvija pirmā), Ride HQ ieskats, merch, partneri */
(function(){
const { $, $$, esc, t, L: TL } = WB;
const today = new Date(), t0 = WB.day0(today);

/* ---------- logo parādīšanās (viena orķestrēta kustība) ---------- */
const hero = $(".hero"), img = $(".hero-logo img");
const lit = () => requestAnimationFrame(() => hero.classList.add("lit"));
if (img.complete) lit(); else { img.addEventListener("load", lit); setTimeout(lit, 1200); }

/* ---------- šodiena: datums, vārda dienas, nākamā īpašā diena ---------- */
(function strip(){
  const n = WB.names(today), nx = WB.nextSpecial(today);
  const parts = [`<span><b>${esc(WB.dayLabel(today))}</b> ${esc(WB.weekday(today))}</span>`];
  parts.push(`<span>${esc(t("today.nameday"))}: <b>${esc(n.main.length ? n.main.join(", ") : t("js.noNames"))}</b></span>`);
  if (nx) parts.push(`<span>${esc(WB.relDays(WB.daysUntil(nx.date)))}: <b>${esc(nx.name)}</b></span>`);
  $("#todayStrip").innerHTML = `<div class="wrap">${parts.join("")}<a href="klubs.html#kalendars">${esc(t("home.calendar"))}</a></div>`;
})();

/* ---------- tuvākie moto pasākumi ---------- */
const evRow = (e, k) => {
  const s = WB.parseISO(e.start), en = e.end ? WB.parseISO(e.end) : s, live = s <= t0 && en >= t0;
  const days = WB.daysUntil(s);
  const place = [e.city, e.country && e.country !== "LV" ? (WB.countryName ? WB.countryName(e.country) : e.country) : ""].filter(Boolean).join(", ");
  return `<li class="ev-row${live ? " is-live" : ""}">
    <a href="pasakumi.html#e-${esc(e.id)}">
      <span class="ev-day"><b>${s.getDate()}</b><small>${esc(WB.monShort(s))}</small></span>
      <span class="ev-main"><b>${esc(TL(e.title) || e.name || "")}</b><small>${esc(place)}${e.official ? ` · <span class="badge official">${esc(t("ev.official"))}</span>` : ""}</small></span>
      <span class="ev-when">${live ? `<span class="live">${esc(t("js.live"))}</span>` : esc(WB.relDays(days))}</span>
    </a></li>`;
};
async function events(){
  const box = $("#homeEvents");
  let list = null;
  try { const j = await WB.req(`/events?from=${WB.iso(t0)}&limit=60`); list = j.events || []; } catch (e) { list = null; }
  if (!list) list = (window.EU_EVENTS || []).filter(e => e.status === "confirmed" && !/provisional/i.test(e.note || "")).map(x => ({ id: x.id, title: x.name, start: x.start, end: x.end, city: x.city, country: x.cc || x.country, category: x.cc === "LV" ? "lv-moto" : "eu-moto" }));
  list = list.filter(e => (e.end || e.start) >= WB.iso(t0)).sort((a, b) => a.start.localeCompare(b.start));
  const lv = list.filter(e => /^lv-/.test(e.category)).slice(0, 4), eu = list.filter(e => /^eu-/.test(e.category) && /moto/.test(e.category)).slice(0, 4);
  const group = (title, arr) => arr.length ? `<li class="ev-group"><h3>${esc(title)}</h3><ol>${arr.map(evRow).join("")}</ol></li>` : "";
  box.innerHTML = group(t("home.inLatvia"), lv) + group(t("home.inEurope"), eu) || `<li class="empty"><p>${esc(t("home.noEvents"))}</p><a class="btn ghost small" href="pasakumi.html">${esc(t("home.eventsAll"))}</a></li>`;
}
events();

/* ---------- Ride HQ ieskats ---------- */
(function ride(){
  const R = window.ROUTES || [];
  const pick = $("#routePick");
  pick.innerHTML = R.slice(0, 4).map((r, k) => `<li><button data-i="${k}" aria-pressed="${k === 0}">${esc(TL(r.name))}<small>~${r.km} km · ${esc(r.region)}</small></button></li>`).join("");
  let map, line; const gc = {};
  const show = async k => {
    $$("button", pick).forEach(b => b.setAttribute("aria-pressed", +b.dataset.i === k));
    const r = R[k]; if (!map || !r) return;
    line && line.remove();
    line = L.polyline(r.pts, { color: "#ECE8DF", weight: 2, opacity: .5, dashArray: "4 8" }).addTo(map);
    map.flyToBounds(line.getBounds(), { padding: [30, 30], duration: .7 });
    try { const g = gc[r.id] || (gc[r.id] = await WB.osrm(r.pts)); line.remove(); line = L.polyline(g.geometry.coordinates.map(c => [c[1], c[0]]), { color: "#ECE8DF", weight: 3.5 }).addTo(map); } catch (e) {}
  };
  pick.addEventListener("click", e => { const b = e.target.closest("button"); b && show(+b.dataset.i); });
  const boot = () => { if (!window.L) return; map = L.map("homeMap", { zoomControl: false, scrollWheelZoom: false, dragging: !matchMedia("(pointer:coarse)").matches, attributionControl: true }).setView([56.9, 24.6], 7); WB.darkTiles().addTo(map); show(0); };
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: "300px" });
  io.observe($("#homeMap"));
})();

/* ---------- merch (tikai ja ir publicēti produkti) ---------- */
WB.req("/products?featured=1&limit=3").then(j => {
  const P = (j && j.products) || []; if (!P.length) return;
  $("#merchRow").innerHTML = P.map(p => `<a class="merch-item" href="merch.html#p-${esc(p.slug)}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" width="600" height="600">` : ""}<b>${esc(TL(p.name))}</b><span>${p.price != null ? esc(new Intl.NumberFormat(WB.locale, { style: "currency", currency: p.currency || "EUR" }).format(p.price)) : ""}</span></a>`).join("");
  $("#homeMerch").hidden = false;
}).catch(() => {});

/* ---------- partneri + reklāma (vienmēr marķēta kā sponsorēta) ---------- */
Promise.all([WB.req("/partners").catch(() => null), WB.req("/ads?placement=home").catch(() => null)]).then(([p, a]) => {
  const P = (p && p.partners) || [], A = (a && a.ads) || [];
  const strip = $("#partnerStrip");
  const ad = A[0] ? `<a class="ad-slot" href="${esc(A[0].url)}" target="_blank" rel="noopener noreferrer sponsored"><span class="badge">${esc(t("ads.sponsored"))}</span>${A[0].image ? `<img src="${esc(A[0].image)}" alt="${esc(A[0].title || "")}" loading="lazy">` : `<b>${esc(A[0].title || "")}</b>`}</a>` : "";
  strip.innerHTML = (P.length ? `<ul class="logos">${P.slice(0, 8).map(x => `<li><a href="${esc(x.url || "partneri.html")}"${x.url ? ' target="_blank" rel="noopener noreferrer"' : ""} title="${esc(x.name)}">${x.logo ? `<img src="${esc(x.logo)}" alt="${esc(x.name)}" loading="lazy">` : `<span>${esc(x.name)}</span>`}</a></li>`).join("")}</ul>` : `<div class="partner-cta"><p>${esc(t("home.partnersEmpty"))}</p><a class="btn ghost small" href="sadarbiba.html">${esc(t("nav.advertise"))}</a></div>`) + ad;
});
})();
