/* WBMC administrācija — Moto pasākumi: pārbaudes rinda, redaktors, oficiālais apstiprinājums, arhīvs, „gaidāmie bez datuma” */
(function(){
const { $, $$, esc, t } = WB;
const A = window.WBAdmin;
const CATS = ["lv-moto", "eu-moto", "lv-other", "eu-other"];
const TYPES = ["rally", "festival", "expo", "race", "ride", "custom-show", "season", "show", "other"];
const STATUSES = ["draft", "review", "published", "cancelled", "ended"];
const LV_REGIONS = ["Rīga", "Vidzeme", "Kurzeme", "Zemgale", "Latgale"];
document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="${WB.base}assets/css/admin-events.css">`);
let DN; try { DN = new Intl.DisplayNames([WB.locale], { type: "region" }); } catch (e) {}
const country = cc => !cc ? "" : cc === "EU" ? t("events.worldwide") : (DN && DN.of(cc)) || cc;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u || ""; } };
const opt = (v, l, sel) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(l)}</option>`;
const range = e => e.start === e.end ? A.fmtDate(e.start) : WB.range(WB.parseISO(e.start), WB.parseISO(e.end));
const pageUrl = id => `${WB.base}pasakumi.html#e-${encodeURIComponent(id)}`;
let filter = null, query = "";

function preview(e){
  const L = WB.L;
  WB.modal({ title: t("events.adm.preview"), wide: true, body: `<article class="eva-prev">
    <p class="eva-prev-date">${esc(range(e))}${e.startTime ? ` · ${esc(e.startTime)}` : ""}</p>
    <div class="eva-prev-tags">${A.badge(e.status)} <span class="muted small">${esc(t("events.catName." + e.category))} · ${esc(t("events.type." + e.type))}</span>${e.official ? ` <span class="badge official">${esc(t("ev.official"))}</span>` : ""}</div>
    <h3>${esc(L(e.title))}</h3>
    <p class="muted">${esc([e.venue, e.city, e.region, country(e.country)].filter(Boolean).join(", "))}</p>
    <p>${esc(L(e.description)) || `<span class="dim">${esc(t("events.adm.noDesc"))}</span>`}</p>
    <dl class="eva-dl"><dt>${esc(t("events.organizer"))}</dt><dd>${esc(e.organizer || "—")}</dd>
      <dt>${esc(t("events.f.officialUrl"))}</dt><dd>${e.officialUrl ? `<a href="${esc(e.officialUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.officialUrl)}</a>` : "—"}</dd>
      <dt>${esc(t("events.f.sourceUrl"))}</dt><dd>${e.sourceUrl ? `<a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.sourceUrl)}</a>` : "—"}</dd>
      ${e.sourceNote ? `<dt>${esc(t("events.f.sourceNote"))}</dt><dd class="eva-note">${esc(e.sourceNote)}</dd>` : ""}</dl>
    ${["published", "ended", "cancelled"].includes(e.status) && e.publishedAt ? `<p><a class="btn ghost small" href="${esc(pageUrl(e.id))}" target="_blank" rel="noopener">${esc(t("events.adm.openPublic"))}${WB.icon("ext")}</a></p>` : `<p class="hint">${esc(t("events.adm.notPublic"))}</p>`}
  </article>`, actions: [{ label: t("btn.close"), value: "" }] });
}

async function edit(e, done, prefill){
  const canA = WB.can("events", "a"), canE = WB.can("events", "e"), canD = WB.can("events", "d");
  const v = e || { category: "lv-moto", type: "rally", title: {}, description: {}, status: canA ? "draft" : "review", country: "LV", ...(prefill || {}) };
  const st = v.rawStatus || v.status;
  const statusOpts = STATUSES.filter(s => canA || s === st || ((s === "draft" || s === "review") && ["draft", "review"].includes(st)));
  const body = `${A.mlField("title", t("events.f.title"), v.title, { max: 200, required: true })}
    <div class="two"><label class="field"><span>${esc(t("events.f.category"))}</span><select name="category">${CATS.map(c => opt(c, t("events.catName." + c), v.category)).join("")}</select></label>
      <label class="field"><span>${esc(t("events.type"))}</span><select name="type">${TYPES.map(x => opt(x, t("events.type." + x), v.type)).join("")}</select></label></div>
    <div class="eva-3"><label class="field"><span>${esc(t("events.f.start"))} *</span><input type="date" name="start" value="${esc(v.start || "")}" required></label>
      <label class="field"><span>${esc(t("events.f.end"))}</span><input type="date" name="end" value="${esc(v.end || "")}"></label>
      <label class="field"><span>${esc(t("events.startTime"))}</span><input type="time" name="startTime" value="${esc(v.startTime || "")}"></label></div>
    <div class="eva-3"><label class="field"><span>${esc(t("events.f.country"))} *</span><input type="text" name="country" value="${esc(v.country || "")}" maxlength="2" pattern="[A-Za-z]{2}" required autocapitalize="characters"></label>
      <label class="field"><span>${esc(t("events.region"))}</span><input type="text" name="region" value="${esc(v.region || "")}" maxlength="60" list="evaRegions"><datalist id="evaRegions">${LV_REGIONS.map(r => `<option value="${esc(r)}">`).join("")}</datalist></label>
      <label class="field"><span>${esc(t("events.f.city"))}</span><input type="text" name="city" value="${esc(v.city || "")}" maxlength="80"></label></div>
    <label class="field"><span>${esc(t("events.f.venue"))}</span><input type="text" name="venue" value="${esc(v.venue || "")}" maxlength="160"></label>
    <div class="two"><label class="field"><span>${esc(t("events.adm.lat"))}</span><input type="text" name="lat" inputmode="decimal" value="${v.lat ?? ""}"></label>
      <label class="field"><span>${esc(t("events.adm.lng"))}</span><input type="text" name="lng" inputmode="decimal" value="${v.lng ?? ""}"></label></div>
    <label class="field"><span>${esc(t("events.organizer"))}</span><input type="text" name="organizer" value="${esc(v.organizer || "")}" maxlength="160"></label>
    <div class="two"><label class="field"><span>${esc(t("events.f.officialUrl"))}</span><input type="url" name="officialUrl" value="${esc(v.officialUrl || "")}" maxlength="600" placeholder="https://"></label>
      <label class="field"><span>${esc(t("events.f.sourceUrl"))}</span><input type="url" name="sourceUrl" value="${esc(v.sourceUrl || "")}" maxlength="600" placeholder="https://"></label></div>
    <label class="field"><span>${esc(t("events.f.sourceNote"))}</span><textarea name="sourceNote" maxlength="1500" rows="3">${esc(v.sourceNote || "")}</textarea><small class="hint">${esc(t("events.adm.sourceNoteHint"))}</small></label>
    ${A.mlField("description", t("events.f.desc"), v.description, { textarea: true, max: 1500, rows: 4 })}
    ${canE ? A.imageField("image", t("events.adm.image"), v.image, "event") : ""}
    <div class="two"><label class="field"><span>${esc(t("adm.status"))}</span><select name="status"${statusOpts.length < 2 ? " disabled" : ""}>${statusOpts.map(s => opt(s, t("status." + s), st)).join("")}</select></label>
      ${canA ? `<label class="check eva-off"><input type="checkbox" name="official"${v.official ? " checked" : ""}><span><b>${esc(t("ev.official"))}</b><br><small class="hint">${esc(t("events.adm.officialHint"))}</small></span></label>` : ""}</div>
    <p class="hint">${esc(t(canA ? "events.adm.publishRule" : "events.adm.proposeRule"))}</p>
    ${e ? `<p class="small muted">${esc(t("events.adm.meta", { c: A.fmt(e.created), by: e.createdByName || "WBMC", u: A.fmt(e.updated), uby: e.updatedByName || "WBMC" }))}</p>` : ""}`;
  return A.editor({ title: e ? WB.L(e.title) : t("events.adm.new"), body, saveLabel: t("events.adm.save"),
    danger: e && canD && !e.archived ? { label: t("events.adm.archive"), onClick: async () => {
      if (!(await WB.confirm(t("events.adm.archive"), t("events.adm.archiveText"), t("events.adm.archive")))) return false;
      await WB.req(`/admin/events/${encodeURIComponent(e.id)}`, { method: "DELETE" }); WB.toast(t("events.adm.archived")); done && done(); } } : null,
    onOpen: d => {
      const f = d.querySelector("form");
      f.category.addEventListener("change", () => { if (f.category.value.startsWith("lv")) f.country.value = "LV"; else if (f.country.value.toUpperCase() === "LV") f.country.value = ""; });
      f.start.addEventListener("change", () => { if (!f.end.value || f.end.value < f.start.value) f.end.value = f.start.value; });
    },
    onSave: async f => {
      const num = x => x.value.trim() === "" ? null : Number(x.value.replace(",", "."));
      const b = { title: A.readML(f, "title"), description: A.readML(f, "description"), category: f.category.value, type: f.type.value, start: f.start.value, end: f.end.value || f.start.value,
        startTime: f.startTime.value, country: f.country.value.toUpperCase(), region: f.region.value, city: f.city.value, venue: f.venue.value, lat: num(f.lat), lng: num(f.lng),
        organizer: f.organizer.value, officialUrl: f.officialUrl.value, sourceUrl: f.sourceUrl.value, sourceNote: f.sourceNote.value };
      if (!f.status.disabled) b.status = f.status.value;
      if (f.official) b.official = f.official.checked;
      if (f.image) b.image = f.image.value;
      const r = e ? await WB.req(`/admin/events/${encodeURIComponent(e.id)}`, { body: b }) : await WB.req("/admin/events", { body: b });
      WB.toast(t(r.status === "review" && !canA ? "events.proposeDone" : "adm.saved"));
      done && done(r);
    } });
}

async function watchSection(el, refresh){
  const box = $("#evaWatch", el); if (!box) return;
  let d; try { d = await WB.req("/admin/events/watch"); } catch (x) { box.innerHTML = `<p class="muted">${esc(WB.errMsg(x))}</p>`; return; }
  const open = d.items.filter(w => w.status === "open"), rest = d.items.filter(w => w.status !== "open");
  const rowH = w => `<li class="eva-w${w.status !== "open" ? " done" : ""}" data-w="${esc(w.id)}">
    <div><b>${esc(WB.L(w.title))}</b> ${w.status !== "open" ? A.badge(w.status === "added" ? "approved" : "archived") : ""}
      <p class="small muted">${esc([t("events.catName." + w.category), w.city, w.typicalMonth ? t("events.adm.usually", { m: w.typicalMonth }) : "", w.lastEdition ? t("events.adm.lastEdition", { d: A.fmtDate(w.lastEdition) }) : ""].filter(Boolean).join(" · "))}</p>
      ${w.organizer ? `<p class="small">${esc(t("events.organizer"))}: ${esc(w.organizer)}</p>` : ""}
      ${w.note ? `<p class="small eva-note">${esc(w.note)}</p>` : ""}
      ${w.sourceUrl ? `<a class="small" href="${esc(w.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("events.source"))}: ${esc(host(w.sourceUrl))}</a>` : ""}</div>
    <div class="btn-row">${w.status === "open" ? `<button class="btn small" data-wadd="${esc(w.id)}">${esc(t("events.adm.watchAdd"))}</button><button class="btn ghost small" data-wdis="${esc(w.id)}">${esc(t("events.adm.watchDismiss"))}</button>` : `<button class="btn ghost small" data-wopen="${esc(w.id)}">${esc(t("events.adm.watchReopen"))}</button>`}</div></li>`;
  box.innerHTML = `<h3 class="adm-sub">${esc(t("events.adm.watchTitle"))} <span class="muted">${open.length}</span></h3><p class="muted small">${esc(t("events.adm.watchText"))}</p>
    ${open.length ? `<ul class="rows eva-watch">${open.map(rowH).join("")}</ul>` : `<div class="empty"><p>${esc(t("events.adm.watchEmpty"))}</p></div>`}
    ${rest.length ? `<details class="eva-more"><summary>${esc(t("events.adm.watchDone", { n: rest.length }))}</summary><ul class="rows eva-watch">${rest.map(rowH).join("")}</ul></details>` : ""}`;
  box.onclick = async ev => {
    const a = ev.target.closest("[data-wadd]"), x = ev.target.closest("[data-wdis]"), o = ev.target.closest("[data-wopen]");
    try {
      if (a) {
        const w = d.items.find(i => i.id === a.dataset.wadd);
        await edit(null, async r => { if (r && r.id) await WB.req(`/admin/events/watch/${encodeURIComponent(w.id)}`, { body: { status: "added", eventId: r.id } }); refresh(); },
          { category: w.category, country: w.category.startsWith("lv") ? "LV" : "", title: w.title, city: w.city, organizer: /^not (stated|formally)/i.test(w.organizer || "") ? "" : w.organizer, sourceUrl: w.sourceUrl, status: "draft", sourceNote: [w.note, w.sourceUrl ? `${t("events.source")}: ${w.sourceUrl}` : ""].filter(Boolean).join("\n") });
      }
      if (x) { await WB.req(`/admin/events/watch/${encodeURIComponent(x.dataset.wdis)}`, { body: { status: "dismissed" } }); refresh(); }
      if (o) { await WB.req(`/admin/events/watch/${encodeURIComponent(o.dataset.wopen)}`, { body: { status: "open" } }); refresh(); }
    } catch (y) { WB.toast(WB.errMsg(y), true); }
  };
}

A.register({ id: "events", title: t("events.adm.title"), need: ["events", "v"], order: 40, render: async el => {
  A.loading(el);
  const archived = filter === "archived";
  let d;
  try { d = await WB.req(`/admin/events${archived ? "?archived=1" : ""}`); } catch (x) { return A.err(el, x); }
  if (filter === null) filter = d.counts.review ? "review" : "all";
  const canA = WB.can("events", "a"), canC = WB.can("events", "c"), canE = WB.can("events", "e"), canD = WB.can("events", "d");
  const refresh = () => A.show("events");
  const chips = ["review", "draft", "published", "cancelled", "ended", "all", ...(canD || canE ? ["archived"] : [])];
  const total = Object.entries(d.counts).filter(([k]) => k !== "archived").reduce((s, [, n]) => s + n, 0);
  const listFor = () => { const q = query.toLocaleLowerCase(WB.locale); return d.events.filter(e => (archived || filter === "all" || e.status === filter)
    && (!q || [WB.L(e.title), e.city, e.organizer, e.country, country(e.country)].join(" ").toLocaleLowerCase(WB.locale).includes(q))); };
  const list = listFor();
  const rowH = e => `<tr data-id="${esc(e.id)}">
    <td class="nowrap num">${esc(range(e))}</td>
    <td><b>${esc(WB.L(e.title))}</b><br><span class="small muted">${esc([e.city, country(e.country)].filter(Boolean).join(", "))} · ${esc(t("events.catName." + e.category))}</span>${e.createdBy && e.status === "review" && e.createdByName && e.createdByName !== "WBMC" ? `<br><span class="small dim">${esc(t("events.adm.proposedBy", { n: e.createdByName }))}</span>` : ""}</td>
    <td>${A.badge(e.status)}${e.official ? `<br><span class="badge official">${esc(t("ev.official"))}</span>` : ""}</td>
    <td class="small">${e.officialUrl || e.sourceUrl ? `<span class="eva-src ok">${esc(host(e.officialUrl || e.sourceUrl))}</span>` : `<span class="eva-src no">${esc(t("events.adm.noSource"))}</span>`}</td>
    <td class="small nowrap">${esc(A.ago(e.updated))}</td>
    <td><div class="btn-row eva-actions">
      ${e.archived ? (canD ? `<button class="btn ghost small" data-restore>${esc(t("events.adm.restore"))}</button>` : "") : `
      ${canE || canA || (e.status === "review" || e.status === "draft") ? `<button class="btn ghost small" data-edit>${esc(t("adm.edit"))}</button>` : ""}
      ${canA && e.status === "review" ? `<button class="btn small" data-publish${e.officialUrl || e.sourceUrl ? "" : " disabled title=\"" + esc(t("err.ev_source")) + "\""}>${esc(t("events.adm.publish"))}</button>` : ""}
      ${canA && e.status === "published" ? `<button class="link-btn" data-official>${esc(t(e.official ? "events.adm.unofficial" : "events.adm.markOfficial"))}</button>` : ""}`}
      <button class="link-btn" data-preview>${esc(t("events.adm.preview"))}</button></div></td></tr>`;
  el.innerHTML = `<div class="eva-head"><div><h2>${esc(t("events.adm.title"))}</h2><p class="muted">${esc(t(d.own ? "events.adm.textOwn" : "events.adm.text"))}</p></div>
      <div class="btn-row">${canC ? `<button class="btn small" id="evaNew">${esc(t(canA ? "events.adm.new" : "events.propose"))}</button>` : ""}<a class="btn ghost small" href="${WB.base}pasakumi.html" target="_blank" rel="noopener">${esc(t("events.adm.publicPage"))}${WB.icon("ext")}</a></div></div>
    <div class="eva-bar"><div class="chips" role="group" aria-label="${esc(t("adm.status"))}">${chips.map(s => `<button class="chip${s === filter ? " on" : ""}" data-f="${s}" aria-pressed="${s === filter}">${esc(s === "all" ? t("events.adm.all") : s === "archived" ? t("status.archived") : t("status." + s))} <i class="num">${s === "all" ? total : d.counts[s] || 0}</i></button>`).join("")}</div>
      <label class="eva-q"><span class="sr-only">${esc(t("events.search"))}</span><input type="search" id="evaQ" placeholder="${esc(t("events.searchPh"))}" value="${esc(query)}"></label></div>
    ${filter === "review" && list.length ? `<p class="hint eva-rq">${esc(t("events.adm.reviewHint"))}</p>` : ""}
    <div id="evaTable"></div>
    <p class="small muted eva-ical">${esc(t("events.subscribe"))} <a href="/api/events.ics" target="_blank" rel="noopener">/api/events.ics</a></p>
    ${canE ? `<section id="evaWatch" class="eva-watchbox"></section>` : ""}`;
  const draw = () => { $("#evaTable", el).innerHTML = A.table([t("events.adm.date"), t("events.adm.event"), t("adm.status"), t("events.source"), t("events.adm.updated"), ""], listFor().map(rowH), t(query ? "events.emptyFilter" : "events.adm.empty")); };
  draw();
  $("#evaQ", el).addEventListener("input", ev => { query = ev.target.value; draw(); });
  el.onclick = async ev => {
    const c = ev.target.closest("[data-f]"); if (c) { filter = c.dataset.f; return refresh(); }
    if (ev.target.closest("#evaNew")) return edit(null, refresh);
    const tr = ev.target.closest("tr[data-id]"); if (!tr) return;
    const e = d.events.find(x => x.id === tr.dataset.id);
    try {
      if (ev.target.closest("[data-preview]")) return preview(e);
      if (ev.target.closest("[data-edit]")) return edit(e, refresh);
      if (ev.target.closest("[data-publish]")) {
        if (!(await WB.confirm(t("events.adm.publish"), t("events.adm.publishConfirm", { n: WB.L(e.title), d: range(e) }), t("events.adm.publish"), false))) return;
        await WB.req(`/admin/events/${encodeURIComponent(e.id)}`, { body: { status: "published" } }); WB.toast(t("events.adm.published")); return refresh();
      }
      if (ev.target.closest("[data-official]")) { await WB.req(`/admin/events/${encodeURIComponent(e.id)}/official`, { body: { official: !e.official } }); WB.toast(t("adm.saved")); return refresh(); }
      if (ev.target.closest("[data-restore]")) { await WB.req(`/admin/events/${encodeURIComponent(e.id)}/restore`, { body: {} }); WB.toast(t("events.adm.restored")); return refresh(); }
    } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
  if (canE) watchSection(el, refresh);
} });
})();
