/* WBMC administrācija — Brāļi (profili, saraksti, lauku redzamība) un Memorials (kartītes, piekrišana, publicēšana, vārdu moderēšana).
   Katra darbība serverī tiek ierakstīta audita žurnālā; pakāpe un statuss mainās tikai šeit, manuāli. */
(function(){
const A = window.WBAdmin; if (!A) return;
const { $, $$, esc, t, L } = WB;
/* moduļa stils (people.css satur arī .pa-* administrācijas klases) */
if (!document.querySelector('link[data-people-css]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = (WB.base || "") + "assets/css/people.css"; l.dataset.peopleCss = "1"; document.head.appendChild(l); }

const nameIn = (list, id) => { const x = (list || []).find(r => r.id === id); return x ? L(x.name) : (id || ""); };
const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const listOpts = (list, sel, empty) => (empty ? opt("", empty, sel) : "") + (list || []).map(r => opt(r.id, L(r.name), sel)).join("") + (sel && !(list || []).some(r => r.id === sel) ? opt(sel, sel + " " + t("pa.notInList"), sel) : "");
const thumb = (url, alt) => url ? `<img class="pa-thumb" src="${esc(url)}" alt="${esc(alt || "")}" loading="lazy">` : `<span class="pa-thumb pa-thumb-empty" aria-hidden="true"></span>`;
const FIELD_LABEL = { photo: "br.photo", rank: "br.rank", position: "br.position", status: "br.status", bio: "br.bio", joined_year: "br.joined", bike: "br.bike", city: "br.city", real_name: "br.realName", phone: "br.phone", email: "br.email" };
const lvlOpts = (S, sel, withDefault, dflt) => (withDefault ? opt("", t("pa.visDefault", { v: lvlName(S, dflt) }), sel) : "")
  + S.roles.filter(r => r.id !== "admin").map(r => opt(r.level, t("pa.visFrom", { role: r.name, n: r.level }), sel)).join("") + opt(S.editorsOnly, t("pa.visEditors"), sel);
const lvlName = (S, lv) => { if (+lv >= S.editorsOnly) return t("pa.visEditors"); const r = [...S.roles].reverse().find(x => x.level >= +lv && x.id !== "admin"); return r ? t("pa.visFrom", { role: r.name, n: r.level }) : String(lv); };
const tabsHtml = (cur, items) => `<div class="tabs pa-tabs" role="tablist">${items.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join("")}</div>`;

/* =================== BRĀĻI =================== */
let peopleTab = "profiles", showArchived = false;
A.register({ id: "people", title: t("pa.people"), need: ["members", "e"], order: 45, render: async el => {
  A.loading(el);
  let D, S, users = null;
  try {
    [D, S] = await Promise.all([WB.req("/people?archived=1"), WB.req("/admin/people-settings")]);
    if (WB.can("users", "v")) users = (await WB.req("/admin/users").catch(() => null));
  } catch (e) { return A.err(el, e); }
  const canA = WB.can("members", "a");
  el.innerHTML = `<h2>${esc(t("pa.people"))}</h2><p class="muted">${esc(t("pa.peopleText"))}</p>
    ${tabsHtml(peopleTab, [["profiles", t("pa.tabProfiles")], ["lists", t("pa.tabLists")], ["visibility", t("pa.tabVisibility")]])}<div class="pa-pane" id="paPane"></div>`;
  const pane = $("#paPane", el);
  $$(".pa-tabs [data-tab]", el).forEach(b => b.addEventListener("click", () => { peopleTab = b.dataset.tab; A.show("people"); }));

  /* ---- profili ---- */
  if (peopleTab === "profiles") {
    const list = D.profiles.filter(p => showArchived || !p.archived);
    const nArch = D.profiles.filter(p => p.archived).length;
    pane.innerHTML = `<div class="pa-bar">${D.canCreate ? `<button class="btn small" id="paNew">${esc(t("pa.newProfile"))}</button>` : ""}
        ${nArch ? `<label class="check small"><input type="checkbox" id="paArch"${showArchived ? " checked" : ""}><span>${esc(t("pa.showArchived", { n: nArch }))}</span></label>` : ""}</div>
      ${D.profiles.length ? A.table(["", t("br.nickname"), t("br.rank"), t("br.position"), t("br.status"), t("pa.account"), ""], list.map(p => `<tr${p.archived ? ' class="pa-arch"' : ""}>
          <td>${thumb(p.photo, p.nickname)}</td><td><b>${esc(p.nickname)}</b>${p.realName ? `<br><span class="small muted">${esc(p.realName)}</span>` : ""}${p.archived ? ` ${A.badge("archived")}` : ""}</td>
          <td>${esc(nameIn(D.ranks, p.rank) || "—")}</td><td>${esc(nameIn(D.positions, p.position) || "—")}</td><td>${esc(nameIn(D.statuses, p.status) || "—")}</td>
          <td class="small">${p.account ? `${esc(p.account.name)} ${p.account.status !== "active" ? A.badge(p.account.status) : ""}` : `<span class="dim">—</span>`}</td>
          <td><button class="btn ghost small" data-edit="${esc(p.id)}">${esc(t("adm.edit"))}</button></td></tr>`))
        : `<div class="empty"><p>${esc(t("pa.noProfiles"))}</p></div>`}
      <p class="hint pa-foot">${esc(t("pa.rankManual"))}</p>`;
    const ar = $("#paArch", pane); ar && ar.addEventListener("change", () => { showArchived = ar.checked; A.show("people"); });
    const nw = $("#paNew", pane); nw && nw.addEventListener("click", () => editProfile(null));
    pane.onclick = e => { const b = e.target.closest("[data-edit]"); if (b) editProfile(D.profiles.find(p => p.id === b.dataset.edit)); };
  }

  async function editProfile(p){
    const isNew = !p; p = p || { fieldVisibility: {}, bio: {} };
    const linkedElsewhere = new Set(D.profiles.filter(x => x.account && x.id !== p.id).map(x => x.account.id));
    const accountField = users
      ? `<label class="field"><span>${esc(t("pa.account"))}</span><select name="userId">${opt("", t("pa.noAccount"), p.account && p.account.id)}${users.users.filter(u => !linkedElsewhere.has(u.id) && u.status !== "archived").map(u => opt(u.id, `${u.name}${u.status !== "active" ? " (" + t("status." + u.status) + ")" : ""}`, p.account && p.account.id)).join("")}</select><small class="hint">${esc(t("pa.accountHint"))}</small></label>`
      : `<div class="field"><span>${esc(t("pa.account"))}</span><p class="small">${p.account ? esc(p.account.name) : `<span class="dim">${esc(t("pa.noAccount"))}</span>`}</p><small class="hint">${esc(t("pa.accountNoPerm"))}</small></div>`;
    const visRows = S.fields.map(f => `<label class="field"><span>${esc(t(FIELD_LABEL[f]))}</span><select name="vis.${f}"${canA ? "" : " disabled"}>${lvlOpts(S, p.fieldVisibility[f] ?? "", true, S.visibility[f])}</select></label>`).join("");
    const body = `${A.imageField("photo", t("br.photo"), p.photo || "", "profile")}
      <p class="hint">${esc(t("pa.photoConsent"))}</p>
      <div class="two"><label class="field"><span>${esc(t("br.nickname"))} *</span><input type="text" name="nickname" value="${esc(p.nickname || "")}" maxlength="40" required></label>
        <label class="field"><span>${esc(t("br.realName"))}</span><input type="text" name="realName" value="${esc(p.realName || "")}" maxlength="80"></label></div>
      <div class="two"><label class="field"><span>${esc(t("br.rank"))}</span><select name="rank">${listOpts(D.ranks, p.rank, t("pa.none"))}</select></label>
        <label class="field"><span>${esc(t("br.position"))}</span><select name="position">${listOpts(D.positions, p.position, t("pa.none"))}</select></label></div>
      <div class="two"><label class="field"><span>${esc(t("br.status"))}</span><select name="status">${listOpts(D.statuses, p.status || (D.statuses[0] && D.statuses[0].id))}</select></label>
        <label class="field"><span>${esc(t("br.joined"))}</span><input type="number" name="joinedYear" min="1900" max="${new Date().getFullYear()}" value="${esc(p.joinedYear || "")}"></label></div>
      <p class="hint">${esc(t("pa.rankManual"))}</p>
      <div class="two"><label class="field"><span>${esc(t("br.city"))}</span><input type="text" name="city" value="${esc(p.city || "")}" maxlength="60"></label>
        <label class="field"><span>${esc(t("br.bike"))}</span><input type="text" name="bike" value="${esc(p.bike || "")}" maxlength="80"></label></div>
      <div class="two"><label class="field"><span>${esc(t("br.phone"))}</span><input type="tel" name="phone" value="${esc(p.phone || "")}" maxlength="40"></label>
        <label class="field"><span>${esc(t("br.email"))}</span><input type="email" name="email" value="${esc(p.email || "")}" maxlength="120"></label></div>
      ${A.mlField("bio", t("br.bio"), p.bio || {}, { textarea: true, max: 1500, rows: 4 })}
      <p class="hint">${esc(t("pa.factsOnly"))}</p>
      ${accountField}
      <details class="pa-vis"><summary>${esc(t("pa.visOverride"))}</summary><p class="hint">${esc(canA ? t("pa.visOverrideText") : t("pa.visNeedA"))}</p><div class="pa-vis-grid">${visRows}</div></details>`;
    await A.editor({ title: isNew ? t("pa.newProfile") : p.nickname, body,
      saveLabel: t("pa.saveProfile"),
      onSave: async f => {
        const v = { nickname: f.nickname.value, realName: f.realName.value, photo: f.photo.value, rank: f.rank.value, position: f.position.value, status: f.status.value,
          joinedYear: f.joinedYear.value, city: f.city.value, bike: f.bike.value, phone: f.phone.value, email: f.email.value, bio: A.readML(f, "bio") };
        if (f.userId) v.userId = f.userId.value;
        if (canA) { v.fieldVisibility = {}; for (const fl of S.fields) { const s = f.elements["vis." + fl]; if (s && s.value !== "") v.fieldVisibility[fl] = +s.value; } }
        if (!isNew && (v.rank !== (p.rank || "") || v.status !== (p.status || ""))) {
          const ch = [v.rank !== (p.rank || "") ? `${t("br.rank")}: ${nameIn(D.ranks, p.rank) || "—"} → ${nameIn(D.ranks, v.rank) || "—"}` : "", v.status !== (p.status || "") ? `${t("br.status")}: ${nameIn(D.statuses, p.status) || "—"} → ${nameIn(D.statuses, v.status) || "—"}` : ""].filter(Boolean).join("; ");
          if (!(await WB.confirm(t("pa.rankConfirmTitle"), `${ch}. ${t("pa.rankConfirmText")}`, t("pa.rankConfirm"), false))) return false;
        }
        if (isNew) await WB.req("/admin/people", { body: v }); else await WB.req(`/admin/people/${p.id}`, { body: v });
        WB.toast(t("adm.saved")); A.show("people");
      },
      danger: isNew ? null : { label: p.archived ? t("pa.restore") : t("pa.archive"), onClick: async () => {
        if (!p.archived && !(await WB.confirm(t("pa.archive"), t("pa.archiveText"), t("pa.archive")))) return false;
        await WB.req(`/admin/people/${p.id}/archive`, { body: { archived: !p.archived } }); WB.toast(t("adm.saved")); A.show("people");
      } } });
  }

  /* ---- saraksti: pakāpes, amati, statusi ---- */
  if (peopleTab === "lists") {
    const block = (key, label, list, isDefault) => `<section class="pa-list" data-list="${key}"><h3 class="adm-sub">${esc(label)} ${isDefault ? `<span class="badge warn">${esc(t("pa.defaultList"))}</span>` : ""}</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>LV</th><th>EN</th><th class="sr-only">${esc(t("pa.order"))}</th></tr></thead><tbody>${list.map(r => row(r, false)).join("")}</tbody></table></div>
      <button type="button" class="link-btn" data-add>${esc(t("pa.addItem"))}</button></section>`;
    const row = (r, fresh) => `<tr data-extra="${esc(JSON.stringify(r.name || {}))}"><td><input type="text" aria-label="ID" name="id" value="${esc(r.id || "")}" maxlength="40" pattern="[a-z0-9-]+"${fresh ? "" : " readonly"}></td>
      <td><input type="text" aria-label="LV" name="lv" value="${esc((r.name || {}).lv || "")}" maxlength="60" required></td><td><input type="text" aria-label="EN" name="en" value="${esc((r.name || {}).en || "")}" maxlength="60"></td>
      <td class="nowrap"><button type="button" class="icon-btn pa-mini" data-up aria-label="${esc(t("pa.up"))}">↑</button><button type="button" class="icon-btn pa-mini" data-down aria-label="${esc(t("pa.down"))}">↓</button><button type="button" class="icon-btn pa-mini" data-del aria-label="${esc(t("adm.remove"))}">${WB.icon("close")}</button></td></tr>`;
    pane.innerHTML = `<p class="muted">${esc(t("pa.listsText"))}</p><form id="paLists" class="pa-lists">
      ${block("ranks", t("pa.ranks"), S.ranks, S.defaults.ranks)}${block("positions", t("pa.positions"), S.positions, S.defaults.positions)}${block("statuses", t("pa.statuses"), S.statuses, S.defaults.statuses)}
      <div class="btn-row"><button class="btn small">${esc(t("pa.saveLists"))}</button></div></form>`;
    const f = $("#paLists", pane);
    f.addEventListener("click", e => {
      const tr = e.target.closest("tr");
      if (e.target.closest("[data-add]")) { const tb = $("tbody", e.target.closest(".pa-list")); tb.insertAdjacentHTML("beforeend", row({}, true)); $("tr:last-child [name=lv]", tb).focus(); }
      if (e.target.closest("[data-del]")) tr.remove();
      if (e.target.closest("[data-up]") && tr.previousElementSibling) tr.parentNode.insertBefore(tr, tr.previousElementSibling);
      if (e.target.closest("[data-down]") && tr.nextElementSibling) tr.parentNode.insertBefore(tr.nextElementSibling, tr);
    });
    f.addEventListener("submit", async e => {
      e.preventDefault(); if (!f.reportValidity()) return;
      const read = key => $$(`[data-list="${key}"] tbody tr`, f).map(tr => { const extra = JSON.parse(tr.dataset.extra || "{}"); const lv = $("[name=lv]", tr).value.trim(), en = $("[name=en]", tr).value.trim();
        const name = { ...extra, lv }; if (en) name.en = en; else delete name.en; return { id: $("[name=id]", tr).value.trim() || undefined, name }; });
      try { await WB.req("/admin/people-settings", { body: { ranks: read("ranks"), positions: read("positions"), statuses: read("statuses") } }); WB.toast(t("adm.saved")); A.show("people"); }
      catch (x) { WB.toast(WB.errMsg(x), true); }
    });
  }

  /* ---- lauku redzamība (globālie noklusējumi) ---- */
  if (peopleTab === "visibility") {
    pane.innerHTML = `<p class="muted">${esc(t("pa.visText"))}</p>${S.defaults.visibility ? `<p><span class="badge warn">${esc(t("pa.defaultList"))}</span></p>` : ""}
      <form id="paVis" class="form pa-visform"><div class="table-wrap"><table class="table"><thead><tr><th>${esc(t("pa.field"))}</th><th>${esc(t("pa.whoSees"))}</th></tr></thead><tbody>
      <tr><td>${esc(t("br.nickname"))}</td><td class="small muted">${esc(t("pa.visAlways"))}</td></tr>
      ${S.fields.map(f => `<tr><td><label for="vis-${f}">${esc(t(FIELD_LABEL[f]))}</label></td><td><select id="vis-${f}" name="${f}"${canA ? "" : " disabled"}>${lvlOpts(S, S.visibility[f], false)}</select></td></tr>`).join("")}</tbody></table></div>
      <p class="hint">${esc(t("pa.visEditorsNote"))}</p>
      ${canA ? `<div class="btn-row"><button class="btn small">${esc(t("pa.saveVis"))}</button></div>` : `<p class="hint">${esc(t("pa.visNeedA"))}</p>`}</form>`;
    const f = $("#paVis", pane);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const v = Object.fromEntries(S.fields.map(fl => [fl, +f.elements[fl].value]));
      try { await WB.req("/admin/people-settings", { body: { visibility: v } }); WB.toast(t("adm.saved")); A.show("people"); } catch (x) { WB.toast(WB.errMsg(x), true); }
    });
  }
} });

/* =================== MEMORIALS =================== */
A.register({ id: "memorials", title: t("pa.memorials"), need: ["memorials", "e"], order: 46, render: async el => {
  A.loading(el);
  let D; try { D = await WB.req("/admin/memorials"); } catch (e) { return A.err(el, e); }
  const canA = D.canApprove;
  const years = m => (m.born || m.died) ? `${(m.born || "…").slice(0, 4)}–${(m.died || "…").slice(0, 4)}` : "—";
  const nextActs = m => {
    const b = [];
    if (m.status === "draft") b.push(["review", t("pa.toReview")]);
    if (m.status === "review") b.push(["draft", t("pa.toDraft")]);
    if (canA && (m.status === "draft" || m.status === "review" || m.status === "archived")) b.push(["published", t("pa.publish")]);
    if (canA && m.status === "published") b.push(["draft", t("pa.unpublish")]);
    if (m.status === "draft" || m.status === "review") b.push(["archived", t("pa.archive")]);
    if (m.status === "archived") b.push(["draft", t("pa.toDraft")]);
    return b;
  };
  const pend = D.memorials.reduce((n, m) => n + (m.pendingWords || 0), 0);
  el.innerHTML = `<h2>${esc(t("pa.memorials"))}</h2><p class="muted">${esc(t("pa.memText"))}</p>
    <ul class="pa-rules small">${["pa.rule1", "pa.rule2", "pa.rule3", "pa.rule4"].map(k => `<li>${esc(t(k))}</li>`).join("")}</ul>
    <div class="pa-bar"><button class="btn small" id="mNew">${esc(t("pa.newMemorial"))}</button>${pend && WB.can("memorials", "a") ? `<a class="btn ghost small" href="#memorial-words">${esc(t("pa.pendingWords", { n: pend }))}</a>` : ""}</div>
    ${D.memorials.length ? A.table(["", t("mm.name"), t("pa.years"), t("adm.status"), t("pa.consent"), ""], D.memorials.map(m => `<tr>
        <td>${thumb(m.photo, m.nickname || m.name)}</td>
        <td><b>${esc(m.nickname || m.name)}</b>${m.nickname && m.name ? `<br><span class="small muted">${esc(m.name)}</span>` : ""}${m.pendingWords ? `<br><span class="small">${esc(t("pa.pendingWords", { n: m.pendingWords }))}</span>` : ""}</td>
        <td class="num small">${esc(years(m))}</td><td>${A.badge(m.status)}${m.approvedBy && m.status === "published" ? `<br><span class="small muted">${esc(m.approvedBy)} · ${esc(A.fmt(m.approvedAt))}</span>` : ""}</td>
        <td>${m.consentFamily && m.consentBy ? `<span class="badge ok">${esc(t("pa.consentOk"))}</span><br><span class="small muted">${esc(m.consentBy)}</span>` : `<span class="badge warn">${esc(t("pa.consentMissing"))}</span>`}</td>
        <td><div class="pa-acts"><button class="btn ghost small" data-edit="${esc(m.id)}">${esc(t("adm.edit"))}</button><a class="link-btn" href="memorials.html#m-${esc(m.slug)}" target="_blank" rel="noopener">${esc(t("pa.preview"))}</a>
          ${nextActs(m).map(([s, l]) => `<button class="link-btn" data-st="${s}" data-id="${esc(m.id)}">${esc(l)}</button>`).join("")}</div></td></tr>`))
      : `<div class="empty"><p>${esc(t("pa.noMemorials"))}</p></div>`}`;
  $("#mNew", el).addEventListener("click", () => editMemorial(null));
  el.onclick = async e => {
    const ed = e.target.closest("[data-edit]"), st = e.target.closest("[data-st]");
    if (ed) return editMemorial(D.memorials.find(m => m.id === ed.dataset.edit));
    if (st) {
      const m = D.memorials.find(x => x.id === st.dataset.id), to = st.dataset.st;
      try {
        if (to === "published") {
          if (!m.consentFamily || !m.consentBy) return WB.toast(t("err.consent_required"), true);
          if (!(await WB.confirm(t("pa.publish"), t("pa.publishConfirm", { who: m.consentBy }), t("pa.publish"), false))) return;
        }
        if (m.status === "published" && !(await WB.confirm(t("pa.unpublish"), t("pa.unpublishConfirm"), t("pa.unpublish")))) return;
        await WB.req(`/admin/memorials/${m.id}/status`, { body: { status: to } }); WB.toast(t("adm.saved")); A.show("memorials");
      } catch (x) { WB.toast(WB.errMsg(x), true); }
    }
  };

  async function editMemorial(m){
    const isNew = !m; m = m || { text: D.defaultText, story: {}, contribution: {} };
    const locked = m.status === "published" && !canA;
    const body = `${m.status === "published" ? `<p class="badge ${canA ? "warn" : "bad"} pa-pubnote">${esc(t(canA ? "pa.editPublished" : "pa.lockedPublished"))}</p>` : ""}
      ${A.imageField("photo", t("mm.photo"), m.photo || "", "memorial")}
      <div class="two"><label class="field"><span>${esc(t("mm.name"))}</span><input type="text" name="name" value="${esc(m.name || "")}" maxlength="80"></label>
        <label class="field"><span>${esc(t("mm.nickname"))}</span><input type="text" name="nickname" value="${esc(m.nickname || "")}" maxlength="40"></label></div>
      <p class="hint">${esc(t("pa.nameHint"))}</p>
      <div class="two"><label class="field"><span>${esc(t("mm.born"))}</span><input type="text" name="born" value="${esc(m.born || "")}" placeholder="1970 / 1970-05-21" pattern="\\d{4}(-\\d{2}-\\d{2})?" maxlength="10"></label>
        <label class="field"><span>${esc(t("mm.died"))}</span><input type="text" name="died" value="${esc(m.died || "")}" placeholder="2020 / 2020-09-14" pattern="\\d{4}(-\\d{2}-\\d{2})?" maxlength="10"></label></div>
      <div class="two"><label class="field"><span>${esc(t("mm.clubFrom"))}</span><input type="number" name="clubFrom" min="1900" max="${new Date().getFullYear()}" value="${esc(m.clubFrom || "")}"></label>
        <label class="field"><span>${esc(t("mm.clubTo"))}</span><input type="number" name="clubTo" min="1900" max="${new Date().getFullYear()}" value="${esc(m.clubTo || "")}"></label></div>
      ${A.mlField("text", t("mm.text"), m.text || {}, { textarea: true, max: 3000, rows: 5 })}
      <p class="hint">${esc(t("pa.textHint"))}</p>
      ${A.mlField("story", t("mm.story"), m.story || {}, { textarea: true, max: 6000, rows: 6 })}
      ${A.mlField("contribution", t("mm.contribution"), m.contribution || {}, { textarea: true, max: 4000, rows: 4 })}
      <p class="hint">${esc(t("pa.factsOnly"))}</p>
      <fieldset class="pa-consent"><legend>${esc(t("pa.consentTitle"))}</legend>
        <label class="check"><input type="checkbox" name="consentFamily"${m.consentFamily ? " checked" : ""}><span>${esc(t("pa.consentFamily"))}</span></label>
        <label class="field"><span>${esc(t("pa.consentBy"))}</span><input type="text" name="consentBy" value="${esc(m.consentBy || "")}" maxlength="160" placeholder="${esc(t("pa.consentByPh"))}"></label>
        <label class="field"><span>${esc(t("pa.consentNote"))}</span><textarea name="consentNote" rows="3" maxlength="1000" placeholder="${esc(t("pa.consentNotePh"))}">${esc(m.consentNote || "")}</textarea></label>
        ${m.consentAt ? `<p class="small muted">${esc(t("pa.consentAt"))}: ${esc(A.fmt(m.consentAt))}</p>` : ""}
      </fieldset>
      ${isNew ? "" : `<label class="field"><span>${esc(t("pa.slug"))}</span><input type="text" name="slug" value="${esc(m.slug || "")}" maxlength="60" pattern="[a-z0-9-]+"><small class="hint">${esc(t("pa.slugHint"))}</small></label>`}`;
    await A.editor({ title: isNew ? t("pa.newMemorial") : (m.nickname || m.name), body, saveLabel: t("pa.saveMemorial"),
      onOpen: d => { if (locked) $$("input,textarea,select", d.querySelector(".adm-form")).forEach(x => { x.disabled = true; }); },
      onSave: async f => {
        if (locked) return false;
        const v = { name: f.name.value, nickname: f.nickname.value, born: f.born.value, died: f.died.value, clubFrom: f.clubFrom.value, clubTo: f.clubTo.value, photo: f.photo.value,
          text: A.readML(f, "text"), story: A.readML(f, "story"), contribution: A.readML(f, "contribution"), consentFamily: f.consentFamily.checked, consentBy: f.consentBy.value, consentNote: f.consentNote.value };
        if (!v.name.trim() && !v.nickname.trim()) throw new Error(t("pa.nameHint"));
        if (f.slug) v.slug = f.slug.value;
        if (isNew) await WB.req("/admin/memorials", { body: v }); else await WB.req(`/admin/memorials/${m.id}`, { body: v });
        WB.toast(t("adm.saved")); A.show("memorials");
      } });
  }
} });

/* =================== VĀRDI NO BRĀĻIEM (moderēšana) =================== */
let wordsTab = "pending";
A.register({ id: "memorial-words", title: t("pa.words"), need: ["memorials", "a"], order: 47, render: async el => {
  A.loading(el);
  let D; try { D = await WB.req("/admin/memorial-words?status=" + wordsTab); } catch (e) { return A.err(el, e); }
  el.innerHTML = `<h2>${esc(t("pa.words"))}</h2><p class="muted">${esc(t("pa.wordsText"))}</p>
    ${tabsHtml(wordsTab, [["pending", t("status.pending")], ["published", t("status.published")], ["hidden", t("pa.hidden")]])}
    ${D.words.length ? `<ul class="rows pa-words">${D.words.map(w => `<li>
        <div class="pa-wmeta small muted"><a href="memorials.html#m-${esc(w.slug)}" target="_blank" rel="noopener"><b>${esc(w.memorial || "—")}</b></a> · ${esc(w.author || "—")}${w.showName ? "" : ` · <span class="badge">${esc(t("pa.nameHidden"))}</span>`} · ${esc(A.fmt(w.created))}${w.moderatedBy ? ` · ${esc(t("pa.moderatedBy", { name: w.moderatedBy }))}` : ""}</div>
        <blockquote class="book pa-wbody">${esc(w.body).replace(/\n/g, "<br>")}</blockquote>
        <div class="btn-row">${w.status !== "published" ? `<button class="btn small" data-w="${esc(w.id)}" data-s="published">${esc(t("pa.publish"))}</button>` : ""}${w.status !== "hidden" ? `<button class="btn ghost small" data-w="${esc(w.id)}" data-s="hidden">${esc(t("pa.hide"))}</button>` : ""}</div></li>`).join("")}</ul>`
      : `<div class="empty"><p>${esc(t("pa.noWords"))}</p></div>`}`;
  $$(".pa-tabs [data-tab]", el).forEach(b => b.addEventListener("click", () => { wordsTab = b.dataset.tab; A.show("memorial-words"); }));
  el.onclick = async e => {
    const b = e.target.closest("[data-w]"); if (!b) return;
    try { await WB.req(`/admin/memorial-words/${b.dataset.w}`, { body: { status: b.dataset.s } }); WB.toast(t("adm.saved")); A.show("memorial-words"); } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
} });
})();
