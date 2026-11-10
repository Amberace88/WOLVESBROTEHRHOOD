/* WBMC — Merch: katalogs un produkta lapa (merch.html#p-<slug>).
   Maksājumi šajā vietnē netiek pieņemti: „Pirkt” ved uz ārēju veikalu (Shopify / Printful / Stripe),
   citādi „Pieteikt pasūtījumu” atver e-pastu ar aizpildītu produktu, krāsu un izmēru. */
(function(){
const { $, $$, esc, t, L: TL } = WB;
const EMAIL = "wolvesmc@inbox.lv";
const app = $("#app"), head = $("#merchHead"), howto = $("#howto");
const baseTitle = document.title;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let products = null, ad = null, cat = "all", fromGrid = false, gridScroll = 0;

const money = (n, c) => n == null ? "" : new Intl.NumberFormat(WB.locale, { style: "currency", currency: c || "EUR", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
const availLabel = a => t("cm.avail." + a);
const nl2br = s => esc(s).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
const PROVIDER = { shopify: "Shopify", printful: "Printful", stripe: "Stripe" };
/* tukšs attēls: kluba zīme uz melna, nevis izdomāta produkta bilde */
const placeholder = `<span class="cm-ph" aria-hidden="true"><img src="${WB.base}assets/img/logo-600.png" alt="" width="120" height="120"></span>`;

/* ---------------- ielāde un maršrutēšana ---------------- */
async function load(){
  try { products = (await WB.req("/products")).products || []; } catch (e) { products = null; }
  WB.req("/ads?placement=merch").then(j => { ad = (j && j.ads || [])[0] || null; paintAd(); }).catch(() => {});
  route();
}
function route(){
  const m = location.hash.match(/^#p-([a-z0-9-]+)$/);
  if (m && products) {
    const p = products.find(x => x.slug === m[1]);
    if (p) return detail(p);
    WB.toast(t("cm.merch.notFound"), true);
  }
  grid();
}
addEventListener("hashchange", route);
const toGrid = () => {
  if (fromGrid && history.length > 1) { history.back(); return; }
  history.pushState(null, "", location.pathname + location.search); route();
};

/* ---------------- katalogs ---------------- */
function grid(){
  document.title = baseTitle; head.hidden = false; document.body.classList.remove("cm-pd-open");
  if (products === null) {
    howto.hidden = true;
    app.innerHTML = `<div class="empty"><p>${esc(t("cm.loadFail"))}</p><button class="btn ghost small" id="retry">${esc(t("cm.retry"))}</button></div>`;
    $("#retry").onclick = () => { app.innerHTML = `<p class="muted cm-loading">${esc(t("cm.loading"))}</p>`; load(); };
    return;
  }
  if (!products.length) {
    howto.hidden = true;
    app.innerHTML = `<div class="cm-empty">
      <h2>${esc(t("cm.merch.emptyTitle"))}</h2><p>${esc(t("cm.merch.emptyText"))}</p>
      <div class="btn-row"><a class="btn" href="atbalsts.html">${esc(t("cm.merch.emptySupport"))}</a><a class="btn ghost" href="mailto:${EMAIL}?subject=${encodeURIComponent(t("cm.merch.interestSubject"))}">${esc(t("cm.merch.emptyNotify"))}</a></div></div>`;
    return;
  }
  const cats = [...new Set(products.map(p => p.category))];
  if (!cats.includes(cat)) cat = "all";
  const list = products.filter(p => cat === "all" || p.category === cat);
  app.innerHTML = `${cats.length > 1 ? `<div class="chips cm-filter" role="group" aria-label="${esc(t("cm.merch.filter"))}">
      <button class="chip" aria-pressed="${cat === "all"}" data-cat="all">${esc(t("cm.merch.all"))}</button>
      ${cats.map(c => `<button class="chip" aria-pressed="${cat === c}" data-cat="${esc(c)}">${esc(t("cm.cat." + c))}</button>`).join("")}</div>` : ""}
    <ul class="cm-grid">${list.map((p, i) => `<li data-reveal="${i % 3}">
      <a class="cm-card" href="#p-${esc(p.slug)}">
        <span class="cm-card-img">${p.image ? `<img src="${esc(p.image)}" alt="" loading="${i < 6 ? "eager" : "lazy"}" width="800" height="800">` : placeholder}</span>
        <span class="cm-card-body"><b>${esc(TL(p.name))}</b>
          <span class="cm-card-meta">${p.price != null ? `<span class="num">${esc(money(p.price, p.currency))}</span>` : `<span class="dim">${esc(t("cm.merch.priceTbd"))}</span>`}${p.availability !== "in_stock" ? `<span class="cm-av av-${esc(p.availability)}">${esc(availLabel(p.availability))}</span>` : ""}</span></span>
      </a></li>`).join("")}</ul>
    <div id="adSlot"></div>`;
  howto.hidden = false;
  $$(".cm-filter [data-cat]", app).forEach(b => b.onclick = () => { cat = b.dataset.cat; grid(); });
  $$(".cm-card", app).forEach(a => a.addEventListener("click", () => { fromGrid = true; gridScroll = scrollY; }));
  paintAd();
  WB.initReveal(app);
  if (gridScroll) { scrollTo(0, gridScroll); gridScroll = 0; }
}
function paintAd(){
  const slot = $("#adSlot"); if (!slot || !ad) return;
  slot.innerHTML = `<aside class="cm-ad" aria-label="${esc(t("ads.sponsored"))}"><span class="badge">${esc(ad.label || t("ads.sponsored"))}</span>
    ${ad.url ? `<a href="${esc(ad.url)}" target="_blank" rel="noopener noreferrer sponsored">` : "<div>"}${ad.image ? `<img src="${esc(ad.image)}" alt="${esc(ad.title)}" loading="lazy">` : `<b>${esc(ad.title)}</b>`}${ad.url ? "</a>" : "</div>"}
    ${ad.partner ? `<small class="dim">${esc(ad.partner)}</small>` : ""}</aside>`;
}

/* ---------------- produkta lapa ---------------- */
function detail(p){
  head.hidden = true; howto.hidden = true; document.body.classList.add("cm-pd-open");
  document.title = `${TL(p.name)} — WBMC Merch`;
  const st = { color: p.colors.length ? 0 : -1, size: null, qty: 1, img: 0, mode: "photo" };
  const avail = p.sizes.filter(s => s.available);
  if (p.sizes.length && avail.length === 1) st.size = avail[0].code;
  const imgs = () => { const c = p.colors[st.color]; return c && c.images.length ? c.images : p.images; };
  const others = products.filter(x => x.slug !== p.slug).slice(0, 3);
  const acc = (k, v, open) => `<details class="pd-acc"${open ? " open" : ""}><summary>${esc(t("cm.pd." + k))}</summary><div class="prose"><p>${v}</p></div></details>`;
  const shipping = TL(p.shipping), returns = TL(p.returns);

  app.innerHTML = `<article class="pd" aria-labelledby="pdTitle">
    <nav class="pd-crumbs" aria-label="${esc(t("cm.pd.crumbs"))}"><a href="merch.html" id="pdBack">${WB.icon("back")}${esc(t("cm.pd.back"))}</a></nav>
    <div class="pd-grid">
      <div class="pd-gallery" id="pdGallery"></div>
      <div class="pd-info">
        <h1 class="pd-title" id="pdTitle">${esc(TL(p.name))}</h1>
        <p class="pd-price">${p.price != null ? `<span class="num">${esc(money(p.price, p.currency))}</span>` : `<span class="muted">${esc(t("cm.merch.priceTbd"))}</span>`}</p>
        <p class="pd-avail av-${esc(p.availability)}"><i aria-hidden="true"></i>${esc(availLabel(p.availability))}</p>
        <form class="pd-form" id="pdForm" novalidate>
          ${p.colors.length ? `<fieldset class="pd-opt"><legend>${esc(t("cm.pd.color"))}: <b id="pdColorName">${esc(TL(p.colors[0].name))}</b></legend>
            <div class="pd-swatches">${p.colors.map((c, i) => `<label title="${esc(TL(c.name))}"><input type="radio" name="color" value="${i}"${i === 0 ? " checked" : ""}><span style="--c:${esc(c.hex)}"></span><b class="sr-only">${esc(TL(c.name))}</b></label>`).join("")}</div></fieldset>` : ""}
          ${p.sizes.length ? `<fieldset class="pd-opt"><legend>${esc(t("cm.pd.size"))}${st.size ? `: <b>${esc(p.sizes.find(s => s.code === st.size).label)}</b>` : ""}</legend>
            <div class="pd-sizes">${p.sizes.map(s => `<label${s.available ? "" : ` title="${esc(t("cm.pd.sizeNa"))}"`}><input type="radio" name="size" value="${esc(s.code)}"${s.available ? "" : " disabled"}${st.size === s.code ? " checked" : ""}><span>${esc(s.label)}${s.available ? "" : `<small class="sr-only"> — ${esc(t("cm.pd.sizeNa"))}</small>`}</span></label>`).join("")}</div>
            <p class="form-err" id="sizeErr" role="alert"></p></fieldset>` : ""}
          <div class="pd-cta" id="pdCta"></div>
        </form>
        ${TL(p.description) ? `<div class="prose pd-desc"><p>${nl2br(TL(p.description))}</p></div>` : ""}
        <div class="pd-accs">
          ${TL(p.material) ? acc("material", nl2br(TL(p.material)), true) : ""}
          ${TL(p.care) ? acc("care", nl2br(TL(p.care))) : ""}
          ${acc("shipping", shipping ? nl2br(shipping) : esc(t("cm.pd.shippingDefault")))}
          ${acc("returns", returns ? nl2br(returns) : esc(t("cm.pd.returnsDefault")))}
        </div>
      </div>
    </div>
    ${others.length ? `<section class="pd-more"><h2>${esc(t("cm.pd.more"))}</h2><ul class="cm-grid small">${others.map(o => `<li><a class="cm-card" href="#p-${esc(o.slug)}"><span class="cm-card-img">${o.image ? `<img src="${esc(o.image)}" alt="" loading="lazy" width="600" height="600">` : placeholder}</span><span class="cm-card-body"><b>${esc(TL(o.name))}</b><span class="cm-card-meta">${o.price != null ? `<span class="num">${esc(money(o.price, o.currency))}</span>` : ""}</span></span></a></li>`).join("")}</ul></section>` : ""}
  </article>`;
  scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  $("#pdBack").addEventListener("click", e => { e.preventDefault(); toGrid(); });
  $$(".pd-more .cm-card", app).forEach(a => a.addEventListener("click", () => { fromGrid = false; }));

  const form = $("#pdForm");
  form.addEventListener("change", e => {
    if (e.target.name === "color") { st.color = +e.target.value; st.img = 0; $("#pdColorName").textContent = TL(p.colors[st.color].name); gallery(); }
    if (e.target.name === "size") { st.size = e.target.value; $("#sizeErr").textContent = ""; const lg = e.target.closest("fieldset").querySelector("legend"); lg.innerHTML = `${esc(t("cm.pd.size"))}: <b>${esc(p.sizes.find(s => s.code === st.size).label)}</b>`; }
  });
  form.addEventListener("submit", e => e.preventDefault());
  cta();
  gallery();

  /* ---- pirkšana / pieteikums ---- */
  function cta(){
    const box = $("#pdCta");
    const subject = t("cm.pd.orderSubject", { name: TL(p.name) });
    if (p.availability === "sold_out") {
      box.innerHTML = `<button class="btn wide" type="button" disabled>${esc(t("cm.avail.sold_out"))}</button>
        <p class="pd-note"><a href="mailto:${EMAIL}?subject=${encodeURIComponent(t("cm.pd.restockSubject", { name: TL(p.name) }))}">${esc(t("cm.pd.askRestock"))}</a></p>`;
      return;
    }
    if (p.buyUrl && p.availability !== "coming") {
      const prov = PROVIDER[p.provider];
      box.innerHTML = `<a class="btn wide" href="${esc(p.buyUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("cm.pd.buy"))}${WB.icon("ext")}</a>
        <p class="pd-note">${esc(prov ? t("cm.pd.extNote", { provider: prov }) : t("cm.pd.extNoteGeneric"))}</p>`;
      return;
    }
    const label = p.availability === "preorder" ? t("cm.pd.preorder") : p.availability === "coming" ? t("cm.pd.interest") : t("cm.pd.order");
    box.innerHTML = `${p.availability !== "coming" ? `<div class="pd-qty"><span id="qtyL">${esc(t("cm.pd.qty"))}</span><div class="pd-stepper" role="group" aria-labelledby="qtyL">
        <button type="button" class="icon-btn" data-q="-1" aria-label="${esc(t("cm.pd.qtyLess"))}">−</button><output id="qtyV" class="num" aria-live="polite">1</output><button type="button" class="icon-btn" data-q="1" aria-label="${esc(t("cm.pd.qtyMore"))}">+</button></div></div>` : ""}
      <button class="btn wide" type="button" id="orderBtn">${esc(label)}</button>
      <p class="pd-note">${esc(t("cm.pd.manualNote"))} <a href="mailto:${EMAIL}?subject=${encodeURIComponent(subject)}">${EMAIL}</a></p>`;
    $$("[data-q]", box).forEach(b => b.onclick = () => { st.qty = Math.max(1, Math.min(10, st.qty + +b.dataset.q)); $("#qtyV").textContent = st.qty; });
    $("#orderBtn").onclick = () => {
      if (p.sizes.length && !st.size && p.availability !== "coming") {
        $("#sizeErr").textContent = t("cm.pd.pickSize");
        const f = $(".pd-sizes input:not([disabled])", form); f && f.focus();
        return;
      }
      const c = p.colors[st.color], s = p.sizes.find(x => x.code === st.size);
      const lines = [
        `${t("cm.pd.mProduct")}: ${TL(p.name)}`,
        c ? `${t("cm.pd.color")}: ${TL(c.name)}` : null,
        s ? `${t("cm.pd.size")}: ${s.label}` : null,
        p.availability !== "coming" ? `${t("cm.pd.qty")}: ${st.qty}` : null,
        p.price != null ? `${t("cm.pd.mPrice")}: ${money(p.price, p.currency)}` : null,
        `${t("cm.pd.mLink")}: ${location.origin}${location.pathname}#p-${p.slug}`,
        "", `${t("cm.pd.mName")}: `, `${t("cm.pd.mDelivery")}: `, `${t("cm.pd.mPhone")}: `, "", t("cm.pd.mFoot")
      ].filter(x => x !== null);
      const subj = p.availability === "coming" ? t("cm.pd.interestSubject", { name: TL(p.name) }) : p.availability === "preorder" ? t("cm.pd.preorderSubject", { name: TL(p.name) }) : subject;
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(lines.join("\n"))}`;
    };
  }

  /* ---- galerija: pārvelkama josla, sīktēli, palielinājums, 360° tikai ar kadru failiem ---- */
  function gallery(){
    const g = $("#pdGallery"), list = imgs(), n = list.length;
    const name = TL(p.name);
    if (st.mode === "360" && p.model360) return viewer360(g);
    g.innerHTML = `<div class="pd-stage${n ? "" : " empty"}">
        ${n ? `<ul class="pd-track" id="pdTrack" tabindex="0" aria-label="${esc(t("cm.pd.gallery"))}">${list.map((src, i) => `<li><button type="button" class="pd-zoom" data-i="${i}" aria-label="${esc(t("cm.pd.zoom", { i: i + 1, n }))}"><img src="${esc(src)}" alt="${esc(t("cm.pd.imgAlt", { name, i: i + 1, n }))}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="1200" height="1200"></button></li>`).join("")}</ul>` : placeholder}
        ${n > 1 ? `<button type="button" class="pd-nav prev" aria-label="${esc(t("cm.pd.prev"))}">${WB.icon("back")}</button><button type="button" class="pd-nav next" aria-label="${esc(t("cm.pd.next"))}">${WB.icon("back")}</button><span class="pd-count num" aria-hidden="true"><b>1</b> / ${n}</span>` : ""}
        ${p.model360 ? `<button type="button" class="pd-360-btn" id="to360">360°</button>` : ""}
      </div>
      ${n > 1 ? `<ul class="pd-thumbs">${list.map((src, i) => `<li><button type="button" data-t="${i}" aria-label="${esc(t("cm.pd.show", { i: i + 1 }))}" aria-current="${i === 0}"><img src="${esc(src)}" alt="" loading="lazy" width="160" height="160"></button></li>`).join("")}</ul>` : ""}`;
    if (p.model360) $("#to360", g).onclick = () => { st.mode = "360"; gallery(); };
    if (!n) return;
    const track = $("#pdTrack", g);
    const go = (i, smooth = true) => { st.img = (i + n) % n; track.scrollTo({ left: st.img * track.clientWidth, behavior: smooth && !reduce ? "smooth" : "auto" }); mark(); };
    const mark = () => {
      $$(".pd-thumbs button", g).forEach((b, i) => b.setAttribute("aria-current", i === st.img));
      const c = $(".pd-count b", g); if (c) c.textContent = st.img + 1;
    };
    let raf; track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== st.img) { st.img = i; mark(); } }); }, { passive: true });
    track.addEventListener("keydown", e => { if (e.key === "ArrowRight") { e.preventDefault(); go(st.img + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(st.img - 1); } });
    $$(".pd-thumbs button", g).forEach(b => b.onclick = () => go(+b.dataset.t));
    const pv = $(".pd-nav.prev", g), nx = $(".pd-nav.next", g);
    if (pv) { pv.onclick = () => go(st.img - 1); nx.onclick = () => go(st.img + 1); }
    $$(".pd-zoom", g).forEach(b => b.onclick = () => lightbox(list, +b.dataset.i, name));
    if (st.img) go(st.img, false);
  }

  function viewer360(g){
    const fr = p.model360, n = fr.length;
    g.innerHTML = `<div class="pd-stage pd-360" tabindex="0" role="slider" aria-label="${esc(t("cm.pd.rotate"))}" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="1" aria-valuetext="${esc(t("cm.pd.frame", { i: 1, n }))}">
        <img src="${esc(fr[0])}" alt="${esc(t("cm.pd.alt360", { name: TL(p.name) }))}" draggable="false" width="1200" height="1200">
        <span class="pd-360-hint">${WB.icon("swap")} ${esc(t("cm.pd.dragHint"))}</span>
        <span class="pd-360-load" hidden></span>
        <button type="button" class="pd-360-btn on" id="toPhoto">${esc(t("cm.pd.photos"))}</button>
      </div>`;
    const stage = $(".pd-360", g), im = $("img", stage), load = $(".pd-360-load", stage);
    let k = 0, loaded = 0;
    load.hidden = false; load.textContent = `0 / ${n}`;
    fr.forEach(src => { const x = new Image(); x.onload = x.onerror = () => { loaded++; load.textContent = `${loaded} / ${n}`; if (loaded >= n) load.hidden = true; }; x.src = src; });
    const set = i => { k = ((i % n) + n) % n; im.src = fr[k]; stage.setAttribute("aria-valuenow", k + 1); stage.setAttribute("aria-valuetext", t("cm.pd.frame", { i: k + 1, n })); };
    let x0 = null, k0 = 0;
    stage.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; x0 = e.clientX; k0 = k; stage.setPointerCapture(e.pointerId); stage.classList.add("drag"); });
    stage.addEventListener("pointermove", e => { if (x0 === null) return; const step = stage.clientWidth / n / 1.2; set(k0 + Math.round((x0 - e.clientX) / step)); });
    const up = () => { x0 = null; stage.classList.remove("drag"); };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("keydown", e => { if (e.key === "ArrowRight") { e.preventDefault(); set(k + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); set(k - 1); } });
    $("#toPhoto", g).onclick = () => { st.mode = "photo"; gallery(); };
  }
}

/* ---------------- palielinājums (dialogs) ---------------- */
function lightbox(list, i0, name){
  const d = document.createElement("dialog"); d.className = "pd-lightbox";
  let i = i0, zoom = false;
  d.innerHTML = `<div class="lb-scroll"><img alt=""></div>
    <div class="lb-bar"><span class="num lb-n"></span><span class="lb-hint">${esc(t("cm.pd.zoomHint"))}</span>
    ${list.length > 1 ? `<button type="button" class="icon-btn" data-d="-1" aria-label="${esc(t("cm.pd.prev"))}">${WB.icon("back")}</button><button type="button" class="icon-btn lb-next" data-d="1" aria-label="${esc(t("cm.pd.next"))}">${WB.icon("back")}</button>` : ""}
    <button type="button" class="icon-btn" data-x aria-label="${esc(t("a11y.close"))}">${WB.icon("close")}</button></div>`;
  document.body.appendChild(d);
  const sc = $(".lb-scroll", d), im = $("img", d);
  const show = () => { zoom = false; d.classList.remove("zoomed"); im.src = list[i]; im.alt = t("cm.pd.imgAlt", { name, i: i + 1, n: list.length }); $(".lb-n", d).textContent = `${i + 1} / ${list.length}`; };
  im.addEventListener("click", e => {
    const r = im.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    zoom = !zoom; d.classList.toggle("zoomed", zoom);
    if (zoom) requestAnimationFrame(() => { sc.scrollLeft = fx * sc.scrollWidth - sc.clientWidth / 2; sc.scrollTop = fy * sc.scrollHeight - sc.clientHeight / 2; });
  });
  sc.addEventListener("pointermove", e => {
    if (!zoom || e.pointerType !== "mouse") return;
    const r = sc.getBoundingClientRect();
    sc.scrollLeft = ((e.clientX - r.left) / r.width) * (sc.scrollWidth - sc.clientWidth);
    sc.scrollTop = ((e.clientY - r.top) / r.height) * (sc.scrollHeight - sc.clientHeight);
  });
  $$("[data-d]", d).forEach(b => b.onclick = () => { i = (i + +b.dataset.d + list.length) % list.length; show(); });
  $("[data-x]", d).onclick = () => d.close();
  d.addEventListener("keydown", e => { if (list.length > 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { i = (i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length; show(); } });
  d.addEventListener("click", e => { if (e.target === d || e.target === sc) d.close(); });
  d.addEventListener("close", () => d.remove());
  show(); d.showModal(); $("[data-x]", d).focus();
}

load();
})();
