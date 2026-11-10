/* WBMC administrācija — Merch (katalogs), Partneri (ar piekrišanu), Reklāma (grafiks, „Sponsorēts”), Atbalsts (rekvizītu apstiprinājums).
   Visas darbības serverī pārbauda tiesības ar MFA un ieraksta auditā. */
(function(){
const A = window.WBAdmin; if (!A) return;
const { $, $$, esc, t } = WB;
const L = v => WB.L(v);
/* moduļa stili (vairāku attēlu lauks, priekšskatījums) */
if (!document.querySelector('link[data-cm]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = WB.base + "assets/css/commerce.css"; l.dataset.cm = "1"; document.head.appendChild(l); }

const FILE = id => `/api/files/${id}`;
const money = (n, c) => n == null ? "—" : new Intl.NumberFormat(WB.locale, { style: "currency", currency: c || "EUR", minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const opts = (list, cur, label) => list.map(v => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(label(v))}</option>`).join("");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga" }).format(new Date());
const fail = msg => { throw new Error(msg); };

/* ======================================================================
   Vairāku attēlu lauks ar secības maiņu (pārvilkt vai ← →)
   ====================================================================== */
const mItem = id => `<li draggable="true" data-id="${esc(id)}"><img src="${FILE(esc(id))}" alt="" loading="lazy"><span class="cm-mimg-n num"></span>
  <span class="cm-mimg-act"><button type="button" data-mv="-1" aria-label="${esc(t("cm.adm.moveLeft"))}">←</button><button type="button" data-mv="1" aria-label="${esc(t("cm.adm.moveRight"))}">→</button><button type="button" data-rm aria-label="${esc(t("adm.remove"))}">×</button></span></li>`;
const multiImage = (name, label, ids, ctx, { max = 12, hint = "", px = 1600 } = {}) => `<div class="field cm-mimg" data-mimg="${esc(name)}" data-ctx="${esc(ctx)}" data-max="${max}" data-px="${px}">
  <span>${esc(label)}</span>
  <ul class="cm-mimg-list">${(ids || []).map(mItem).join("")}</ul>
  <div class="cm-mimg-tools"><label class="btn ghost small"><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>${esc(t("cm.adm.addImages"))}</label><span class="cm-mimg-busy small muted" hidden>${esc(t("cm.adm.uploading"))}</span></div>
  ${hint ? `<small class="hint">${esc(hint)}</small>` : ""}
  <input type="hidden" name="${esc(name)}" value="${esc(JSON.stringify(ids || []))}"></div>`;
const syncM = box => {
  const ids = $$(".cm-mimg-list > li", box).map(li => li.dataset.id);
  $(`input[type=hidden]`, box).value = JSON.stringify(ids);
  $$(".cm-mimg-list > li", box).forEach((li, i) => { $(".cm-mimg-n", li).textContent = i + 1; });
  const full = ids.length >= +box.dataset.max; $(".cm-mimg-tools label", box).classList.toggle("dis", full);
};
const readM = (form, name) => { try { return JSON.parse(form.elements[name].value || "[]"); } catch (e) { return []; } };
const initM = root => $$(".cm-mimg", root).forEach(syncM);
document.addEventListener("change", async e => {
  const inp = e.target; if (!inp.matches(".cm-mimg input[type=file]") || !inp.files.length) return;
  const box = inp.closest(".cm-mimg"), list = $(".cm-mimg-list", box), busy = $(".cm-mimg-busy", box);
  const room = +box.dataset.max - list.children.length, files = [...inp.files].slice(0, Math.max(0, room));
  if (inp.files.length > files.length) WB.toast(t("cm.adm.tooMany", { n: box.dataset.max }), true);
  busy.hidden = false; box.classList.add("busy");
  try {
    for (const f of files) {
      const small = await WB.shrinkImage(f, +box.dataset.px || 1600), r = await WB.upload(small, box.dataset.ctx);
      list.insertAdjacentHTML("beforeend", mItem(r.id)); syncM(box);
    }
  } catch (x) { WB.toast(WB.errMsg(x), true); }
  finally { busy.hidden = true; box.classList.remove("busy"); inp.value = ""; }
});
document.addEventListener("click", e => {
  const b = e.target.closest(".cm-mimg [data-mv], .cm-mimg [data-rm]"); if (!b) return;
  const li = b.closest("li"), box = b.closest(".cm-mimg");
  if (b.hasAttribute("data-rm")) li.remove();
  else if (+b.dataset.mv < 0 && li.previousElementSibling) li.previousElementSibling.before(li);
  else if (+b.dataset.mv > 0 && li.nextElementSibling) li.nextElementSibling.after(li);
  syncM(box);
  const again = box.querySelector(`li[data-id="${li.dataset.id}"] [data-mv="${b.dataset.mv}"]`); again && again.focus();
});
let dragLi = null;
document.addEventListener("dragstart", e => { const li = e.target.closest && e.target.closest(".cm-mimg-list > li"); if (!li) return; dragLi = li; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", li.dataset.id); } catch (x) {} });
document.addEventListener("dragover", e => {
  if (!dragLi) return; const li = e.target.closest && e.target.closest(".cm-mimg-list > li");
  if (!li || li === dragLi || li.parentNode !== dragLi.parentNode) return;
  e.preventDefault(); const r = li.getBoundingClientRect(); (e.clientX - r.left > r.width / 2) ? li.after(dragLi) : li.before(dragLi);
});
document.addEventListener("dragend", () => { if (!dragLi) return; dragLi.classList.remove("dragging"); syncM(dragLi.closest(".cm-mimg")); dragLi = null; });
document.addEventListener("drop", e => { if (dragLi) e.preventDefault(); });

/* ======================================================================
   MERCH
   ====================================================================== */
const P_STATUS = ["draft", "published", "archived"], AVAIL = ["in_stock", "preorder", "sold_out", "coming"], PROV = ["manual", "shopify", "printful", "stripe"], CATS = ["apparel", "headwear", "accessories", "other"];
const sizeRow = (s = {}) => `<li class="cm-row"><label><span class="sr-only">${esc(t("cm.adm.sizeCode"))}</span><input type="text" name="sz_code" value="${esc(s.code || "")}" maxlength="12" placeholder="${esc(t("cm.adm.sizeCode"))}"></label>
  <label><span class="sr-only">${esc(t("cm.adm.sizeLabel"))}</span><input type="text" name="sz_label" value="${esc(s.label || "")}" maxlength="40" placeholder="${esc(t("cm.adm.sizeLabel"))}"></label>
  <label class="check"><input type="checkbox" name="sz_av"${s.available === false ? "" : " checked"}><span>${esc(t("cm.adm.available"))}</span></label>
  <button type="button" class="icon-btn" data-del aria-label="${esc(t("adm.remove"))}">${WB.icon("close")}</button></li>`;
let colorSeq = 0;
const colorRow = (c = { name: {}, hex: "#000000", images: [] }) => { const k = "c" + (colorSeq++); return `<li class="cm-color" data-k="${k}">
  <div class="cm-color-head"><input type="color" name="${k}_hex" value="${esc(c.hex || "#000000")}" aria-label="${esc(t("cm.adm.colorHex"))}">
    <label><span class="sr-only">${esc(t("cm.adm.colorName"))} LV</span><input type="text" name="${k}_lv" value="${esc((c.name || {}).lv || "")}" maxlength="40" placeholder="${esc(t("cm.adm.colorName"))} (LV)"></label>
    <label><span class="sr-only">${esc(t("cm.adm.colorName"))} EN</span><input type="text" name="${k}_en" value="${esc((c.name || {}).en || "")}" maxlength="40" placeholder="${esc(t("cm.adm.colorName"))} (EN)"></label>
    <button type="button" class="icon-btn" data-del aria-label="${esc(t("adm.remove"))}">${WB.icon("close")}</button></div>
  ${multiImage(k + "_img", t("cm.adm.colorImages"), c.images || [], "product", { max: 8, hint: t("cm.adm.colorImagesHint") })}</li>`; };

A.register({ id: "merch", title: t("cm.adm.merch"), need: ["merch", "v"], order: 60, render: async el => {
  A.loading(el);
  let list; try { list = (await WB.req("/admin/products")).products; } catch (e) { return A.err(el, e); }
  const canC = WB.can("merch", "c"), canE = WB.can("merch", "e");
  el.innerHTML = `<div class="cm-adm-head"><h2>${esc(t("cm.adm.merch"))}</h2>${canC ? `<button class="btn small" id="pNew">${esc(t("cm.adm.newProduct"))}</button>` : ""}</div>
    <p class="muted">${esc(t("cm.adm.merchText"))}</p>
    ${A.table(["", t("cm.adm.product"), t("cm.adm.price"), t("cm.adm.availability"), t("adm.status"), ""], list.map(p => `<tr>
      <td class="cm-thumb">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ""}</td>
      <td><b>${esc(L(p.name))}</b>${p.featured ? ` <span class="badge">${esc(t("cm.adm.featuredShort"))}</span>` : ""}<br><span class="small muted">${esc(p.slug)} · ${esc(t("cm.cat." + p.category))}${p.buyUrl ? ` · ${esc(t("cm.adm.extShop"))}` : ` · ${esc(t("cm.adm.mailOrder"))}`}</span></td>
      <td class="num">${esc(money(p.price, p.currency))}</td><td>${esc(t("cm.avail." + p.availability))}</td><td>${A.badge(p.status)}</td>
      <td class="cm-acts">${canE ? `<button class="btn ghost small" data-edit="${p.id}">${esc(t("adm.edit"))}</button>
        <button class="link-btn" data-st="${p.id}" data-to="${p.status === "published" ? "draft" : "published"}">${esc(t(p.status === "published" ? "cm.adm.unpublish" : "cm.adm.publish"))}</button>` : ""}
        ${p.status === "published" ? `<a class="link-btn" href="merch.html#p-${esc(p.slug)}" target="_blank" rel="noopener">${esc(t("cm.adm.view"))}</a>` : ""}</td></tr>`), t("cm.adm.noProducts"))}`;
  const nb = $("#pNew", el); if (nb) nb.onclick = () => productEditor(null);
  el.onclick = async e => {
    const ed = e.target.closest("[data-edit]"), sb = e.target.closest("[data-st]");
    if (ed) productEditor(list.find(p => p.id === ed.dataset.edit));
    if (sb) { try { await WB.req(`/admin/products/${sb.dataset.st}/status`, { body: { status: sb.dataset.to } }); WB.toast(t("adm.saved")); A.show("merch"); } catch (x) { WB.toast(WB.errMsg(x), true); } }
  };
} });

async function productEditor(p){
  const isNew = !p; p = p || { name: {}, description: {}, material: {}, care: {}, shipping: {}, returns: {}, imageIds: [], sizes: [], colors: [], model360Ids: [], availability: "in_stock", status: "draft", provider: "manual", currency: "EUR", category: "apparel", sort: 0 };
  const body = `<div class="cm-ed">
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.basics"))}</legend>
      ${A.mlField("name", t("cm.adm.name"), p.name, { max: 120, required: true })}
      <div class="two"><label class="field"><span>${esc(t("cm.adm.slug"))}</span><input type="text" name="slug" value="${esc(p.slug || "")}" maxlength="60" pattern="[a-z0-9-]*" placeholder="${esc(t("cm.adm.slugPh"))}"><small class="hint">${esc(t("cm.adm.slugHint"))}</small></label>
        <label class="field"><span>${esc(t("cm.adm.category"))}</span><select name="category">${opts(CATS, p.category, c => t("cm.cat." + c))}</select></label></div>
      <div class="two"><label class="field"><span>${esc(t("adm.status"))}</span><select name="status">${opts(P_STATUS, p.status, s => t("status." + s))}</select></label>
        <label class="field"><span>${esc(t("cm.adm.sort"))}</span><input type="text" name="sort" type="number" value="${esc(p.sort ?? 0)}" min="-9999" max="9999"><small class="hint">${esc(t("cm.adm.sortHint"))}</small></label></div>
      <label class="check"><input type="checkbox" name="featured"${p.featured ? " checked" : ""}><span>${esc(t("cm.adm.featured"))}</span></label>
    </fieldset>
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.priceAvail"))}</legend>
      <div class="two"><label class="field"><span>${esc(t("cm.adm.price"))}</span><input type="text" name="price" type="number" step="0.01" min="0" max="100000" value="${p.price ?? ""}" placeholder="${esc(t("cm.adm.pricePh"))}"><small class="hint">${esc(t("cm.adm.priceHint"))}</small></label>
        <label class="field"><span>${esc(t("cm.adm.currency"))}</span><input type="text" name="currency" value="${esc(p.currency || "EUR")}" maxlength="3" pattern="[A-Za-z]{3}"></label></div>
      <label class="field"><span>${esc(t("cm.adm.availability"))}</span><select name="availability">${opts(AVAIL, p.availability, a => t("cm.avail." + a))}</select></label>
    </fieldset>
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.images"))}</legend>
      ${multiImage("images", t("cm.adm.images"), p.imageIds, "product", { max: 12, hint: t("cm.adm.imagesHint") })}
    </fieldset>
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.colors"))}</legend>
      <p class="hint">${esc(t("cm.adm.colorsHint"))}</p>
      <ul class="cm-colors" id="cmColors">${p.colors.map(colorRow).join("")}</ul>
      <button type="button" class="btn ghost small" id="addColor">${esc(t("cm.adm.addColor"))}</button>
    </fieldset>
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.sizes"))}</legend>
      <ul class="cm-rows" id="cmSizes">${p.sizes.map(sizeRow).join("")}</ul>
      <div class="btn-row"><button type="button" class="btn ghost small" id="addSize">${esc(t("cm.adm.addSize"))}</button><button type="button" class="link-btn" id="sizePreset">${esc(t("cm.adm.sizePreset"))}</button><button type="button" class="link-btn" id="sizeOne">${esc(t("cm.adm.sizeOne"))}</button></div>
    </fieldset>
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.texts"))}</legend>
      ${A.mlField("description", t("cm.adm.description"), p.description, { textarea: true, max: 4000, rows: 5 })}
      ${A.mlField("material", t("cm.pd.material"), p.material, { textarea: true, max: 1000, rows: 3 })}
      ${A.mlField("care", t("cm.pd.care"), p.care, { textarea: true, max: 1000, rows: 3 })}
      ${A.mlField("shipping", t("cm.pd.shipping"), p.shipping, { textarea: true, max: 2000, rows: 3 })}
      ${A.mlField("returns", t("cm.pd.returns"), p.returns, { textarea: true, max: 2000, rows: 3 })}
      <small class="hint">${esc(t("cm.adm.shipHint"))}</small>
    </fieldset>
    <fieldset class="cm-fs"><legend>${esc(t("cm.adm.buying"))}</legend>
      <p class="hint">${esc(t("cm.adm.buyingHint"))}</p>
      <div class="two"><label class="field"><span>${esc(t("cm.adm.buyUrl"))}</span><input type="text" name="buyUrl" type="url" value="${esc(p.buyUrl || "")}" placeholder="https://…" pattern="https://.*"></label>
        <label class="field"><span>${esc(t("cm.adm.provider"))}</span><select name="provider">${opts(PROV, p.provider, v => t("cm.prov." + v))}</select></label></div>
    </fieldset>
    <fieldset class="cm-fs"><legend>360°</legend>
      ${multiImage("model360", t("cm.adm.frames"), p.model360Ids, "product", { max: 72, px: 1200, hint: t("cm.adm.framesHint") })}
    </fieldset></div>`;
  await A.editor({ title: isNew ? t("cm.adm.newProduct") : L(p.name), body, saveLabel: t("cm.adm.saveProduct"),
    danger: !isNew && WB.can("merch", "d") ? { label: t("cm.adm.delete"), onClick: async () => { if (!(await WB.confirm(t("cm.adm.delete"), t("cm.adm.deleteText", { name: L(p.name) }), t("cm.adm.delete")))) return false; await WB.req(`/admin/products/${p.id}`, { method: "DELETE" }); WB.toast(t("adm.saved")); A.show("merch"); } } : null,
    onOpen: d => {
      initM(d);
      const sz = $("#cmSizes", d), cl = $("#cmColors", d);
      $("#addSize", d).onclick = () => { sz.insertAdjacentHTML("beforeend", sizeRow()); $("li:last-child input", sz).focus(); };
      $("#sizePreset", d).onclick = () => { sz.innerHTML = ["XS", "S", "M", "L", "XL", "XXL"].map(c => sizeRow({ code: c, label: c, available: true })).join(""); };
      $("#sizeOne", d).onclick = () => { sz.innerHTML = sizeRow({ code: "OS", label: t("cm.adm.oneSize"), available: true }); };
      $("#addColor", d).onclick = () => { cl.insertAdjacentHTML("beforeend", colorRow()); initM(cl.lastElementChild); $("li:last-child input[type=text], li:last-child input:not([type])", cl)?.focus(); };
      d.addEventListener("click", e => { const x = e.target.closest("[data-del]"); if (x) x.closest("li").remove(); });
    },
    onSave: async form => {
      const sizes = $$("#cmSizes > li", form).map(li => ({ code: $("[name=sz_code]", li).value.trim(), label: $("[name=sz_label]", li).value.trim(), available: $("[name=sz_av]", li).checked })).filter(s => s.code);
      const colors = $$("#cmColors > li", form).map(li => { const k = li.dataset.k; return { name: { lv: form.elements[k + "_lv"].value.trim(), en: form.elements[k + "_en"].value.trim() }, hex: form.elements[k + "_hex"].value, images: readM(form, k + "_img") }; }).filter(c => c.name.lv || c.name.en);
      const frames = readM(form, "model360");
      if (frames.length && frames.length < 8) fail(t("cm.adm.framesMin"));
      const b = {
        name: A.readML(form, "name"), slug: form.slug.value.trim(), category: form.category.value, status: form.status.value, sort: form.sort.value, featured: form.featured.checked,
        price: form.price.value === "" ? null : form.price.value, currency: form.currency.value.trim().toUpperCase() || "EUR", availability: form.availability.value,
        images: readM(form, "images"), colors, sizes, description: A.readML(form, "description"), material: A.readML(form, "material"), care: A.readML(form, "care"),
        shipping: A.readML(form, "shipping"), returns: A.readML(form, "returns"), buyUrl: form.buyUrl.value.trim(), provider: form.provider.value, model360: frames
      };
      if (b.status === "published" && !b.images.length && !colors.some(c => c.images.length)) { if (!(await WB.confirm(t("cm.adm.noImgTitle"), t("cm.adm.noImgText"), t("cm.adm.publishAnyway"), false))) return false; }
      await WB.req(isNew ? "/admin/products" : `/admin/products/${p.id}`, { body: b });
      WB.toast(t("adm.saved")); A.show("merch");
    } });
}

/* ======================================================================
   PARTNERI
   ====================================================================== */
const PCATS = ["sponsor", "partner", "service", "media", "community"];
const linkRow = (l = {}) => `<li class="cm-row"><label><span class="sr-only">${esc(t("cm.adm.linkLabel"))}</span><input type="text" name="ln_label" value="${esc(l.label || "")}" maxlength="40" placeholder="${esc(t("cm.adm.linkLabel"))}"></label>
  <label class="grow"><span class="sr-only">URL</span><input type="text" name="ln_url" type="url" value="${esc(l.url || "")}" placeholder="https://…"></label>
  <button type="button" class="icon-btn" data-del aria-label="${esc(t("adm.remove"))}">${WB.icon("close")}</button></li>`;

A.register({ id: "partners", title: t("cm.adm.partners"), need: ["partners", "v"], order: 61, render: async el => {
  A.loading(el);
  let list; try { list = (await WB.req("/admin/partners")).partners; } catch (e) { return A.err(el, e); }
  const canC = WB.can("partners", "c"), canE = WB.can("partners", "e");
  el.innerHTML = `<div class="cm-adm-head"><h2>${esc(t("cm.adm.partners"))}</h2>${canC ? `<button class="btn small" id="ptNew">${esc(t("cm.adm.newPartner"))}</button>` : ""}</div>
    <p class="muted">${esc(t("cm.adm.partnersText"))}</p>
    ${A.table(["", t("cm.adm.partner"), t("cm.adm.category"), t("cm.adm.consent"), t("adm.status"), ""], list.map(p => `<tr>
      <td class="cm-thumb logo">${p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy">` : ""}</td>
      <td><b>${esc(p.name)}</b>${p.url ? `<br><span class="small muted">${esc(p.url)}</span>` : ""}</td>
      <td>${esc(t("cm.pcat." + p.category))}</td>
      <td>${p.consentBrand ? `<span class="badge ok">${esc(t("cm.adm.consentYes"))}</span><br><span class="small muted">${esc(A.fmt(p.consentAt))}${p.consentBy ? " · " + esc(p.consentBy) : ""}</span>` : `<span class="badge warn">${esc(t("cm.adm.consentNo"))}</span>`}</td>
      <td>${A.badge(p.status)}</td>
      <td class="cm-acts">${canE ? `<button class="btn ghost small" data-edit="${p.id}">${esc(t("adm.edit"))}</button>
        <button class="link-btn" data-st="${p.id}" data-to="${p.status === "published" ? "draft" : "published"}"${p.status !== "published" && !p.consentBrand ? ` disabled title="${esc(t("cm.adm.needConsent"))}"` : ""}>${esc(t(p.status === "published" ? "cm.adm.unpublish" : "cm.adm.publish"))}</button>` : ""}</td></tr>`), t("cm.adm.noPartners"))}`;
  const nb = $("#ptNew", el); if (nb) nb.onclick = () => partnerEditor(null);
  el.onclick = async e => {
    const ed = e.target.closest("[data-edit]"), sb = e.target.closest("[data-st]");
    if (ed) partnerEditor(list.find(p => p.id === ed.dataset.edit));
    if (sb && !sb.disabled) { try { await WB.req(`/admin/partners/${sb.dataset.st}/status`, { body: { status: sb.dataset.to } }); WB.toast(t("adm.saved")); A.show("partners"); } catch (x) { WB.toast(WB.errMsg(x), true); } }
  };
} });

async function partnerEditor(p){
  const isNew = !p; p = p || { name: "", description: {}, links: [], category: "partner", status: "draft", sort: 0, consentBrand: false, consentNote: "" };
  const body = `<div class="cm-ed">
    <div class="two"><label class="field"><span>${esc(t("cm.adm.name"))} *</span><input type="text" name="name" value="${esc(p.name)}" maxlength="80" required minlength="2"></label>
      <label class="field"><span>${esc(t("cm.adm.category"))}</span><select name="category">${opts(PCATS, p.category, c => t("cm.pcat." + c))}</select></label></div>
    ${A.imageField("logo", t("cm.adm.logo"), p.logo, "partner")}
    ${A.mlField("description", t("cm.adm.shortDesc"), p.description, { textarea: true, max: 600, rows: 3 })}
    <label class="field"><span>${esc(t("cm.adm.website"))}</span><input type="text" name="url" type="url" value="${esc(p.url || "")}" placeholder="https://…"></label>
    <div class="field"><span>${esc(t("cm.adm.links"))}</span><ul class="cm-rows" id="cmLinks">${(p.links || []).map(linkRow).join("")}</ul><div><button type="button" class="btn ghost small" id="addLink">${esc(t("cm.adm.addLink"))}</button></div></div>
    <div class="two"><label class="field"><span>${esc(t("cm.adm.sort"))}</span><input type="text" name="sort" type="number" value="${esc(p.sort ?? 0)}" min="-9999" max="9999"><small class="hint">${esc(t("cm.adm.sortHint"))}</small></label>
      <label class="field"><span>${esc(t("adm.status"))}</span><select name="status">${opts(P_STATUS, p.status, s => t("status." + s))}</select></label></div>
    <fieldset class="cm-fs cm-consent"><legend>${esc(t("cm.adm.consentTitle"))} *</legend>
      <label class="check"><input type="checkbox" name="consentBrand"${p.consentBrand ? " checked" : ""}><span>${esc(t("cm.adm.consentCheck"))}</span></label>
      <label class="field"><span>${esc(t("cm.adm.consentNote"))}</span><textarea name="consentNote" maxlength="500" rows="2" placeholder="${esc(t("cm.adm.consentPh"))}">${esc(p.consentNote || "")}</textarea></label>
      ${p.consentAt ? `<p class="small muted">${esc(t("cm.adm.consentRecorded", { at: A.fmt(p.consentAt), by: p.consentBy || "—" }))}</p>` : ""}
      <p class="hint">${esc(t("cm.adm.consentHint"))}</p>
    </fieldset></div>`;
  await A.editor({ title: isNew ? t("cm.adm.newPartner") : p.name, body, saveLabel: t("cm.adm.savePartner"),
    danger: !isNew && WB.can("partners", "d") ? { label: t("cm.adm.delete"), onClick: async () => { if (!(await WB.confirm(t("cm.adm.delete"), t("cm.adm.deleteText", { name: p.name }), t("cm.adm.delete")))) return false; await WB.req(`/admin/partners/${p.id}`, { method: "DELETE" }); WB.toast(t("adm.saved")); A.show("partners"); } } : null,
    onOpen: d => {
      const ln = $("#cmLinks", d);
      $("#addLink", d).onclick = () => { if (ln.children.length < 6) { ln.insertAdjacentHTML("beforeend", linkRow()); $("li:last-child input", ln).focus(); } };
      d.addEventListener("click", e => { const x = e.target.closest("[data-del]"); if (x) x.closest("li").remove(); });
    },
    onSave: async form => {
      const b = { name: form.elements.name.value.trim(), logo: form.logo.value || null, description: A.readML(form, "description"), url: form.url.value.trim(), category: form.category.value,
        links: $$("#cmLinks > li", form).map(li => ({ label: $("[name=ln_label]", li).value.trim(), url: $("[name=ln_url]", li).value.trim() })).filter(l => l.url),
        sort: form.sort.value, status: form.status.value, consentBrand: form.consentBrand.checked, consentNote: form.consentNote.value.trim() };
      if (b.status === "published" && !b.consentBrand) fail(t("cm.adm.needConsent"));
      if (b.consentBrand && b.consentNote.length < 5) fail(t("cm.adm.needConsentNote"));
      const r = await WB.req(isNew ? "/admin/partners" : `/admin/partners/${p.id}`, { body: b });
      WB.toast(r.status && r.status !== b.status ? t("cm.adm.unpublishedNoConsent") : t("adm.saved")); A.show("partners");
    } });
}

/* ======================================================================
   REKLĀMA
   ====================================================================== */
const AD_ST = ["draft", "scheduled", "active", "paused", "ended"], PLACES = ["home", "events", "ridehq", "merch"];
const adBadge = s => `<span class="badge ${s === "active" ? "ok" : s === "scheduled" ? "warn" : ""}">${esc(t("cm.adst." + s))}</span>`;
const adPreview = a => `<div class="cm-adprev"><span class="badge">${esc(a.label || t("ads.sponsored"))}</span>${a.image ? `<img src="${esc(a.image)}" alt="">` : `<b>${esc(a.title || t("cm.adm.adTitle"))}</b>`}</div>`;

A.register({ id: "ads", title: t("cm.adm.ads"), need: ["ads", "v"], order: 62, render: async el => {
  A.loading(el);
  let j; try { j = await WB.req("/admin/ads"); } catch (e) { return A.err(el, e); }
  const list = j.ads, canC = WB.can("ads", "c"), canE = WB.can("ads", "e");
  el.innerHTML = `<div class="cm-adm-head"><h2>${esc(t("cm.adm.ads"))}</h2>${canC ? `<button class="btn small" id="adNew">${esc(t("cm.adm.newAd"))}</button>` : ""}</div>
    <p class="muted">${esc(t("cm.adm.adsText"))}</p>
    ${A.table(["", t("cm.adm.adTitle"), t("cm.adm.placement"), t("cm.adm.period"), t("adm.status"), ""], list.map(a => `<tr>
      <td class="cm-thumb wide">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ""}</td>
      <td><b>${esc(a.title)}</b>${a.partner ? `<br><span class="small muted">${esc(a.partner)}</span>` : ""}</td>
      <td>${esc(t("cm.place." + a.placement))}</td>
      <td class="small">${esc(A.fmtDate(a.starts))} – ${esc(A.fmtDate(a.ends))}</td>
      <td>${adBadge(a.status)}${a.live ? `<br><span class="small cm-live">${esc(t("cm.adm.liveNow"))}</span>` : ""}</td>
      <td class="cm-acts">${canE ? `<button class="btn ghost small" data-edit="${a.id}">${esc(t("adm.edit"))}</button>
        ${["active", "scheduled"].includes(a.status) ? `<button class="link-btn" data-st="${a.id}" data-to="paused">${esc(t("cm.adm.pause"))}</button>` : a.status !== "ended" ? `<button class="link-btn" data-st="${a.id}" data-to="active">${esc(t("cm.adm.activate"))}</button>` : ""}` : ""}</td></tr>`), t("cm.adm.noAds"))}`;
  const nb = $("#adNew", el); if (nb) nb.onclick = () => adEditor(null);
  el.onclick = async e => {
    const ed = e.target.closest("[data-edit]"), sb = e.target.closest("[data-st]");
    if (ed) adEditor(list.find(a => a.id === ed.dataset.edit));
    if (sb) { try { await WB.req(`/admin/ads/${sb.dataset.st}/status`, { body: { status: sb.dataset.to } }); WB.toast(t("adm.saved")); A.show("ads"); } catch (x) { WB.toast(WB.errMsg(x), true); } }
  };
} });

async function adEditor(a){
  const isNew = !a; a = a || { title: "", placement: "home", status: "draft", label: t("ads.sponsored"), starts: today(), ends: "" };
  let partners = [];
  if (WB.can("partners", "v")) { try { partners = (await WB.req("/admin/partners")).partners; } catch (e) {} }
  const body = `<div class="cm-ed">
    <div class="cm-ad-ed">
      <div class="cm-ad-form">
        <label class="field"><span>${esc(t("cm.adm.adTitle"))} *</span><input type="text" name="title" value="${esc(a.title)}" maxlength="120" required minlength="2"><small class="hint">${esc(t("cm.adm.adTitleHint"))}</small></label>
        ${A.imageField("image", t("cm.adm.adImage"), a.image, "ad")}
        <label class="field"><span>${esc(t("cm.adm.adUrl"))}</span><input type="text" name="url" type="url" value="${esc(a.url || "")}" placeholder="https://…"></label>
        <div class="two"><label class="field"><span>${esc(t("cm.adm.placement"))}</span><select name="placement">${opts(PLACES, a.placement, v => t("cm.place." + v))}</select></label>
          <label class="field"><span>${esc(t("cm.adm.partner"))}</span><select name="partnerId"><option value="">—</option>${partners.map(p => `<option value="${esc(p.id)}"${p.id === a.partnerId ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>
        <div class="two"><label class="field"><span>${esc(t("cm.adm.starts"))}</span><input type="text" name="starts" type="date" value="${esc(a.starts || "")}"></label>
          <label class="field"><span>${esc(t("cm.adm.ends"))}</span><input type="text" name="ends" type="date" value="${esc(a.ends || "")}"></label></div>
        <div class="two"><label class="field"><span>${esc(t("adm.status"))}</span><select name="status">${opts(AD_ST, a.status, s => t("cm.adst." + s))}</select><small class="hint">${esc(t("cm.adm.adStatusHint"))}</small></label>
          <label class="field"><span>${esc(t("cm.adm.label"))} *</span><input type="text" name="label" value="${esc(a.label || t("ads.sponsored"))}" maxlength="30" required><small class="hint">${esc(t("cm.adm.labelHint"))}</small></label></div>
      </div>
      <div class="cm-ad-side"><span class="small muted">${esc(t("cm.adm.preview"))}</span><div id="adPrev">${adPreview(a)}</div><p class="hint">${esc(t("cm.adm.adRules"))}</p></div>
    </div></div>`;
  await A.editor({ title: isNew ? t("cm.adm.newAd") : a.title, body, saveLabel: t("cm.adm.saveAd"),
    danger: !isNew && WB.can("ads", "d") ? { label: t("cm.adm.delete"), onClick: async () => { if (!(await WB.confirm(t("cm.adm.delete"), t("cm.adm.deleteText", { name: a.title }), t("cm.adm.delete")))) return false; await WB.req(`/admin/ads/${a.id}`, { method: "DELETE" }); WB.toast(t("adm.saved")); A.show("ads"); } } : null,
    onOpen: d => {
      const f = $("form", d), prev = $("#adPrev", d);
      const paint = () => { const id = f.elements.image.value; prev.innerHTML = adPreview({ title: f.elements.title.value, label: f.elements.label.value.trim() || t("ads.sponsored"), image: id ? FILE(id) : null }); };
      f.addEventListener("input", paint);
      new MutationObserver(paint).observe($(".img-prev", d), { childList: true, subtree: true });
    },
    onSave: async form => {
      const b = { title: form.elements.title.value.trim(), image: form.image.value || null, url: form.url.value.trim(), placement: form.placement.value, partnerId: form.partnerId.value || null,
        starts: form.starts.value, ends: form.ends.value, status: form.status.value, label: form.elements.label.value.trim() };
      if (["active", "scheduled"].includes(b.status) && (!b.starts || !b.ends)) fail(t("cm.adm.needDates"));
      if (b.starts && b.ends && b.ends < b.starts) fail(t("cm.adm.badDates"));
      if (!b.label) fail(t("cm.adm.labelHint"));
      await WB.req(isNew ? "/admin/ads" : `/admin/ads/${a.id}`, { body: b });
      WB.toast(t("adm.saved")); A.show("ads");
    } });
}

/* ======================================================================
   ATBALSTS: rekvizītu apstiprinājums
   ====================================================================== */
const ibanOk = s => { const v = String(s || "").replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false; const r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55)); let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97; return m === 1; };
const loadData = () => window.DONATE ? Promise.resolve() : new Promise(res => { const s = document.createElement("script"); s.src = WB.base + "assets/js/data.js"; s.onload = s.onerror = () => res(); document.head.appendChild(s); });

A.register({ id: "support", title: t("cm.adm.support"), need: ["settings", "v"], order: 63, render: async el => {
  A.loading(el);
  let v; try { [v] = await Promise.all([WB.req("/admin/support").then(j => j.verified), loadData()]); } catch (e) { return A.err(el, e); }
  const D = window.DONATE || {}, iban = String(D.iban || "").replace(/\s+/g, ""), canE = WB.can("settings", "e");
  const stale = v && v.iban !== iban;
  const rows = [[t("cm.sup.fRecipient"), D.recipient], ["IBAN", iban.replace(/(.{4})/g, "$1 ").trim()], ["SWIFT / BIC", D.bic], [t("cm.sup.fBank"), D.bank], [t("cm.sup.fBankAddr"), D.bankAddress]];
  el.innerHTML = `<h2>${esc(t("cm.adm.support"))}</h2><p class="muted">${esc(t("cm.adm.supportText"))}</p>
    <section class="panel"><h3>${esc(t("cm.adm.bankDetails"))}</h3>
      <dl class="cm-dl">${rows.map(([k, x]) => `<div><dt>${esc(k)}</dt><dd>${esc(x || "—")}</dd></div>`).join("")}
        <div><dt>${esc(t("cm.adm.ibanCheck"))}</dt><dd>${ibanOk(iban) ? `<span class="badge ok">${esc(t("cm.adm.ibanValid"))}</span>` : `<span class="badge bad">${esc(t("cm.adm.ibanInvalid"))}</span>`}</dd></div></dl>
      <p class="small dim">${esc(t("cm.adm.bankSource"))}</p></section>
    <section class="panel"><h3>${esc(t("cm.adm.verifyTitle"))}</h3>
      ${v ? `<p>${stale ? `<span class="badge warn">${esc(t("cm.adm.verifyStale"))}</span>` : `<span class="badge ok">${esc(t("cm.sup.verifiedBadge"))}</span>`} ${esc(t("cm.adm.verifiedOn", { date: A.fmtDate(v.date), by: v.byName || "—" }))}</p><p class="small muted">${esc(t("cm.adm.verifySource"))}: ${esc(v.note || "")}</p>`
        : `<p><span class="badge warn">${esc(t("cm.adm.notVerified"))}</span> ${esc(t("cm.adm.notVerifiedText"))}</p>`}
      ${canE ? `<div class="btn-row"><button class="btn small" id="spVerify"${ibanOk(iban) ? "" : " disabled"}>${esc(t("cm.adm.markVerified"))}</button>${v ? `<button class="btn ghost small" id="spUnverify">${esc(t("cm.adm.unverify"))}</button>` : ""}</div>` : ""}
    </section>`;
  const vb = $("#spVerify", el), ub = $("#spUnverify", el);
  if (vb) vb.onclick = async () => {
    const r = await WB.prompt(t("cm.adm.markVerified"), `<p class="muted">${esc(t("cm.adm.verifyIntro", { iban }))}</p>
      <label class="field"><span>${esc(t("cm.adm.verifyDate"))}</span><input type="text" name="date" type="date" value="${today()}" max="${today()}" required></label>
      <label class="field"><span>${esc(t("cm.adm.verifySource"))}</span><textarea name="note" rows="3" maxlength="300" minlength="5" required placeholder="${esc(t("cm.adm.verifyPh"))}"></textarea></label>`, t("cm.adm.markVerified"));
    if (!r) return;
    try { await WB.req("/admin/support/verify", { body: { verified: true, iban, date: r.date, note: r.note } }); WB.toast(t("adm.saved")); A.show("support"); } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
  if (ub) ub.onclick = async () => {
    if (!(await WB.confirm(t("cm.adm.unverify"), t("cm.adm.unverifyText"), t("cm.adm.unverify")))) return;
    try { await WB.req("/admin/support/verify", { body: { verified: false } }); WB.toast(t("adm.saved")); A.show("support"); } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
} });
})();
