/* WBMC administrācija — kodols: sadaļu reģistrs, palīgi, konti, lomas, ielūgumi, audits, Security Center, iestatījumi, tulkojumi.
   Moduļi pievieno sadaļas: WBAdmin.register({ id, title, need: ["events","v"], order, render(el) }) */
(function(){
const { $, $$, esc, t } = WB;
const A = window.WBAdmin = { sections: [], register(s){ this.sections.push(s); } };
const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];

/* ---------- palīgi moduļiem ---------- */
A.fmt = ts => ts ? new Date(ts).toLocaleString(WB.locale, { dateStyle: "medium", timeStyle: "short" }) : "—";
A.fmtDate = s => s ? new Date(s + (s.length === 10 ? "T12:00" : "")).toLocaleDateString(WB.locale, { dateStyle: "medium" }) : "—";
A.ago = ts => { if (!ts) return "—"; const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? t("adm.justNow") : m < 60 ? t("adm.minAgo", { n: m }) : m < 1440 ? t("adm.hAgo", { n: Math.round(m / 60) }) : A.fmtDate(new Date(ts).toISOString().slice(0, 10)); };
const STATUS_CLS = { published: "ok", active: "ok", approved: "ok", open: "ok", draft: "", review: "warn", pending: "warn", cancelled: "bad", suspended: "bad", revoked: "bad", ended: "", archived: "", expired: "", used: "" };
A.badge = s => `<span class="badge ${STATUS_CLS[s] ?? ""}">${esc(t("status." + s) !== "status." + s ? t("status." + s) : s)}</span>`;
A.err = (el, e) => { el.innerHTML = `<div class="empty"><p>${esc(WB.errMsg(e))}</p></div>`; };
A.loading = el => { el.innerHTML = `<p class="muted adm-loading">${esc(t("adm.loading"))}</p>`; };
/* daudzvalodu lauks: ievade katrai valodai, LV obligāta */
A.mlField = (name, label, value = {}, { textarea = false, max = 200, required = false, rows = 4 } = {}) => {
  const id = "ml-" + name + "-" + Math.random().toString(36).slice(2, 7);
  return `<fieldset class="ml" data-ml="${esc(name)}"><legend>${esc(label)}${required ? " *" : ""}</legend>
    <div class="ml-tabs" role="tablist">${LANGS.map((l, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-l="${l}" class="${value && value[l] ? "has" : ""}">${l.toUpperCase()}</button>`).join("")}</div>
    ${LANGS.map((l, i) => textarea
      ? `<textarea name="${esc(name)}.${l}" id="${id}-${l}" maxlength="${max}" rows="${rows}" lang="${l}"${i ? " hidden" : ""}${required && !i ? " required" : ""}>${esc((value && value[l]) || "")}</textarea>`
      : `<input name="${esc(name)}.${l}" id="${id}-${l}" maxlength="${max}" lang="${l}" value="${esc((value && value[l]) || "")}"${i ? " hidden" : ""}${required && !i ? " required" : ""}>`).join("")}
    <small class="hint">${esc(t("adm.mlHint"))}</small></fieldset>`;
};
A.readML = (form, name) => { const o = {}; for (const l of LANGS) { const el = form.elements[`${name}.${l}`]; if (el && el.value.trim()) o[l] = el.value.trim(); } return o; };
document.addEventListener("click", e => {
  const b = e.target.closest(".ml-tabs button"); if (!b) return;
  const fs = b.closest(".ml"); $$(".ml-tabs button", fs).forEach(x => x.setAttribute("aria-selected", x === b));
  $$("input,textarea", fs).forEach(x => { x.hidden = x.lang !== b.dataset.l; });
  const f = $(`[lang="${b.dataset.l}"]`, fs); f && f.focus();
});
document.addEventListener("input", e => { const fs = e.target.closest(".ml"); if (!fs) return; const b = $(`.ml-tabs [data-l="${e.target.lang}"]`, fs); b && b.classList.toggle("has", !!e.target.value.trim()); });
/* attēla lauks: saspiež un augšupielādē; slēptajā laukā glabā faila id */
A.imageField = (name, label, current, context) => `<div class="field img-field" data-img="${esc(name)}" data-ctx="${esc(context)}"><span>${esc(label)}</span>
  <div class="img-row"><div class="img-prev">${current ? `<img src="${esc(current)}" alt="">` : ""}</div><label class="btn ghost small"><input type="file" accept="image/jpeg,image/png,image/webp" hidden>${esc(t("adm.chooseImage"))}</label><button type="button" class="link-btn" data-clear${current ? "" : " hidden"}>${esc(t("adm.remove"))}</button></div>
  <input type="hidden" name="${esc(name)}" value="${esc(current ? (current.match(/files\/([0-9a-z]{20})/) || [])[1] || "" : "")}"><small class="hint">${esc(t("adm.imageHint"))}</small></div>`;
document.addEventListener("change", async e => {
  const inp = e.target; if (!inp.matches(".img-field input[type=file]") || !inp.files[0]) return;
  const box = inp.closest(".img-field"), hid = $(`input[type=hidden]`, box);
  try {
    box.classList.add("busy");
    const f = await WB.shrinkImage(inp.files[0], 1600), r = await WB.upload(f, box.dataset.ctx);
    hid.value = r.id; $(".img-prev", box).innerHTML = `<img src="${esc(r.url)}" alt="">`; $("[data-clear]", box).hidden = false;
  } catch (x) { WB.toast(WB.errMsg(x), true); } finally { box.classList.remove("busy"); inp.value = ""; }
});
document.addEventListener("click", e => { const b = e.target.closest(".img-field [data-clear]"); if (!b) return; const box = b.closest(".img-field"); $("input[type=hidden]", box).value = ""; $(".img-prev", box).innerHTML = ""; b.hidden = true; });
/* vienkārša tabula */
A.table = (cols, rows, empty) => rows.length ? `<div class="table-wrap"><table class="table"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>` : `<div class="empty"><p>${esc(empty || t("adm.empty"))}</p></div>`;
/* sānu redaktors (dialogs) */
A.editor = ({ title, body, onSave, saveLabel, danger, onOpen }) => new Promise(resolve => {
  WB.modal({ title, wide: true, body: `<div class="form adm-form">${body}</div><p class="form-err" role="alert"></p>`,
    actions: [...(danger ? [{ label: danger.label, value: "danger", danger: true }] : []), { label: t("btn.cancel"), value: "" }, { label: saveLabel || t("btn.save"), value: "ok", primary: true }],
    onOpen: d => {
      onOpen && onOpen(d);
      const form = d.querySelector("form");
      form.addEventListener("submit", async e => {
        const v = e.submitter && e.submitter.value;
        if (v === "ok" || v === "danger") {
          e.preventDefault();
          if (v === "ok" && !form.reportValidity()) return;
          try { const r = v === "danger" ? await danger.onClick() : await onSave(form); if (r === false) return; d.close("ok"); resolve(true); }
          catch (x) { d.querySelector(".form-err").textContent = WB.errMsg(x); }
        }
      });
    } }).then(v => { if (v !== "ok") resolve(false); });
});
A.go = id => { location.hash = id; };

/* ---------- kodola sadaļas ---------- */
A.register({ id: "overview", title: t("adm.overview"), order: 0, need: null, render: async el => {
  A.loading(el);
  try {
    const o = await WB.req("/admin/overview");
    const tiles = [];
    if (o.mfaSetupNeeded) tiles.push(`<a class="tile warn" href="profils.html"><b>MFA</b><span>${esc(t("adm.mfaSetupNeeded"))}</span></a>`);
    if (o.pendingUsers !== undefined) tiles.push(`<a class="tile${o.pendingUsers ? " warn" : ""}" href="#users"><b class="num">${o.pendingUsers}</b><span>${esc(t("adm.pendingUsers"))}</span></a>`, `<a class="tile" href="#users"><b class="num">${o.activeUsers}</b><span>${esc(t("adm.activeUsers"))}</span></a>`);
    if (o.openInvites !== undefined) tiles.push(`<a class="tile" href="#invites"><b class="num">${o.openInvites}</b><span>${esc(t("adm.openInvites"))}</span></a>`);
    if (o.highEvents24h !== undefined) tiles.push(`<a class="tile${o.highEvents24h ? " bad" : ""}" href="#security"><b class="num">${o.highEvents24h}</b><span>${esc(t("adm.highEvents"))}</span></a>`, `<a class="tile" href="#security"><b class="num">${o.failedLogins24h}</b><span>${esc(t("adm.failedLogins"))}</span></a>`);
    el.innerHTML = `<h2>${esc(t("adm.overview"))}</h2><p class="muted">${esc(t("adm.hello", { name: WB.me.name }))}</p><div class="tiles">${tiles.join("")}</div>
      <h3 class="adm-sub">${esc(t("adm.sections"))}</h3><ul class="adm-links">${visible().filter(s => s.id !== "overview").map(s => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join("")}</ul>`;
  } catch (e) { A.err(el, e); }
} });

A.register({ id: "users", title: t("adm.users"), order: 10, need: ["users", "v"], render: async el => {
  A.loading(el);
  let data, roles;
  try { [data, roles] = await Promise.all([WB.req("/admin/users"), WB.req("/admin/roles")]); } catch (e) { return A.err(el, e); }
  const canE = WB.can("users", "e"), canA = WB.can("users", "a");
  const roleOpts = sel => roles.roles.filter(r => WB.me.role === "admin" || r.level < WB.me.level).map(r => `<option value="${esc(r.id)}"${r.id === sel ? " selected" : ""}>${esc(r.name)}</option>`).join("");
  const pending = data.users.filter(u => u.status === "pending");
  el.innerHTML = `<h2>${esc(t("adm.users"))}</h2><p class="muted">${esc(t("adm.usersText"))}</p>
    ${pending.length ? `<h3 class="adm-sub">${esc(t("adm.pendingUsers"))}</h3><ul class="rows approve">${pending.map(u => `<li><div><b>${esc(u.name)}</b> <span class="small muted">${esc(u.email || "")}</span><br><span class="small muted">${esc(t("adm.registered"))} ${esc(A.fmt(u.created))}${u.invite ? ` · ${esc(t("adm.invite"))} ${esc(u.invite)}` : ""}</span></div>${canA ? `<div class="btn-row"><select data-role="${u.id}" aria-label="${esc(t("adm.role"))}">${roleOpts(u.role)}</select><button class="btn small" data-approve="${u.id}">${esc(t("adm.approve"))}</button><button class="btn ghost small" data-reject="${u.id}">${esc(t("adm.reject"))}</button></div>` : ""}</li>`).join("")}</ul>` : ""}
    <h3 class="adm-sub">${esc(t("adm.allUsers"))}</h3>
    ${A.table([t("adm.name"), t("adm.role"), t("adm.status"), "MFA", t("adm.lastLogin"), ""], data.users.filter(u => u.status !== "pending").map(u => `<tr><td><b>${esc(u.name)}</b>${u.email ? `<br><span class="small muted">${esc(u.email)}</span>` : ""}</td><td>${esc(u.roleName || u.role)}</td><td>${A.badge(u.status)}</td><td>${u.mfa ? `<span class="badge ok">${esc(t("mfa.on"))}</span>` : `<span class="badge">${esc(t("mfa.off"))}</span>`}</td><td class="small">${esc(A.ago(u.lastLogin))}</td><td>${canE && u.id !== WB.me.id ? `<button class="btn ghost small" data-edit="${u.id}">${esc(t("adm.edit"))}</button>` : ""}</td></tr>`))}`;
  el.onclick = async e => {
    const ap = e.target.closest("[data-approve]"), rj = e.target.closest("[data-reject]"), ed = e.target.closest("[data-edit]");
    try {
      if (ap) { await WB.req(`/admin/users/${ap.dataset.approve}`, { body: { status: "active", role: $(`[data-role="${ap.dataset.approve}"]`, el).value } }); WB.toast(t("adm.approved")); A.show("users"); }
      if (rj && await WB.confirm(t("adm.reject"), t("adm.rejectText"), t("adm.reject"))) { await WB.req(`/admin/users/${rj.dataset.reject}`, { body: { status: "archived" } }); A.show("users"); }
      if (ed) {
        const u = data.users.find(x => x.id === ed.dataset.edit);
        await A.editor({ title: u.name, body: `<label class="field"><span>${esc(t("adm.name"))}</span><input name="name" value="${esc(u.name)}" maxlength="40" required></label>
          <div class="two"><label class="field"><span>${esc(t("adm.role"))}</span><select name="role">${roleOpts(u.role)}</select></label><label class="field"><span>${esc(t("adm.status"))}</span><select name="status">${["active", "suspended", "archived"].map(s => `<option value="${s}"${s === u.status ? " selected" : ""}>${esc(t("status." + s))}</option>`).join("")}</select></label></div>
          <p class="hint">${esc(t("adm.roleManual"))}</p>
          <div class="btn-row"><button type="button" class="btn ghost small" id="resetCode">${esc(t("adm.resetCode"))}</button><button type="button" class="btn ghost small" id="killSess">${esc(t("adm.killSessions"))}</button></div>`,
          onSave: async f => { await WB.req(`/admin/users/${u.id}`, { body: { name: f.name.value, role: f.role.value, status: f.status.value } }); WB.toast(t("adm.saved")); A.show("users"); },
          onOpen: d => {
            d.querySelector("#resetCode").addEventListener("click", async () => { try { const r = await WB.req(`/admin/users/${u.id}/reset`, { body: {} }); d.querySelector(".form-err").innerHTML = `<span class="reset-out">${esc(t("adm.resetCodeText"))} <code class="big-code">${esc(r.code)}</code></span>`; } catch (x) { WB.toast(WB.errMsg(x), true); } });
            d.querySelector("#killSess").addEventListener("click", async () => { try { await WB.req(`/admin/users/${u.id}/sessions/revoke`, { body: {} }); WB.toast(t("adm.sessionsKilled")); } catch (x) { WB.toast(WB.errMsg(x), true); } });
          } });
      }
    } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
} });

A.register({ id: "roles", title: t("adm.roles"), order: 20, need: ["roles", "v"], render: async el => {
  A.loading(el);
  let d; try { d = await WB.req("/admin/roles"); } catch (e) { return A.err(el, e); }
  const canE = WB.can("roles", "e");
  el.innerHTML = `<h2>${esc(t("adm.roles"))}</h2><p class="muted">${esc(t("adm.rolesText"))}</p>
    <div class="table-wrap"><table class="table perm-table"><thead><tr><th>${esc(t("adm.module"))}</th>${d.roles.map(r => `<th><b>${esc(r.name)}</b><br><span class="small muted">${esc(t("adm.level"))} ${r.level} · ${r.members}${r.mfaRequired ? " · MFA" : ""}</span></th>`).join("")}</tr></thead>
    <tbody>${d.modules.map(m => `<tr><th scope="row">${esc(t("mod." + m))}</th>${d.roles.map(r => `<td>${d.actions.map(a => { const on = (r.perms[m] || "").includes(a); return `<label class="perm" title="${esc(t("act." + a))}"><input type="checkbox" data-r="${esc(r.id)}" data-m="${m}" data-a="${a}"${on ? " checked" : ""}${!canE || r.id === "admin" ? " disabled" : ""}><span>${a.toUpperCase()}</span></label>`; }).join("")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="small muted">${d.actions.map(a => `${a.toUpperCase()} — ${esc(t("act." + a))}`).join(" · ")}</p>
    ${canE ? `<div class="btn-row"><button class="btn" id="savePerms">${esc(t("adm.savePerms"))}</button>${WB.can("roles", "c") ? `<button class="btn ghost" id="newRole">${esc(t("adm.newRole"))}</button>` : ""}</div>` : ""}
    <h3 class="adm-sub">${esc(t("adm.roleSettings"))}</h3>
    <ul class="rows">${d.roles.filter(r => r.id !== "admin").map(r => `<li class="role-row"><div><b>${esc(r.name)}</b> <span class="small muted">${esc(r.id)} · ${esc(t("adm.level"))} ${r.level}</span>${r.description ? `<br><span class="small muted">${esc(r.description)}</span>` : ""}</div>${canE ? `<button class="btn ghost small" data-role="${esc(r.id)}">${esc(t("adm.edit"))}</button>` : ""}</li>`).join("")}</ul>`;
  el.onclick = async e => {
    try {
      if (e.target.closest("#savePerms")) {
        for (const r of d.roles.filter(r => r.id !== "admin")) {
          const perms = {};
          $$(`input[data-r="${r.id}"]:checked`, el).forEach(c => { perms[c.dataset.m] = (perms[c.dataset.m] || "") + c.dataset.a; });
          if (JSON.stringify(perms) !== JSON.stringify(Object.fromEntries(Object.entries(r.perms).filter(([, v]) => v)))) await WB.req(`/admin/roles/${r.id}`, { body: { perms } });
        }
        WB.toast(t("adm.saved")); A.show("roles");
      }
      const rb = e.target.closest("[data-role]");
      const roleForm = r => `<div class="two"><label class="field"><span>${esc(t("adm.name"))}</span><input name="name" value="${esc(r ? r.name : "")}" required maxlength="40"></label><label class="field"><span>${esc(t("adm.level"))} (1–99)</span><input type="number" name="level" min="1" max="99" value="${r ? r.level : 40}" required></label></div>
        ${r ? "" : `<label class="field"><span>ID</span><input name="id" pattern="[a-z0-9_-]{3,24}" required></label>`}
        <label class="field"><span>${esc(t("adm.description"))}</span><input name="description" value="${esc(r ? r.description || "" : "")}" maxlength="200"></label>
        <label class="check"><input type="checkbox" name="mfa"${r && r.mfaRequired ? " checked" : ""}><span>${esc(t("adm.mfaRequired"))}</span></label>`;
      if (rb) {
        const r = d.roles.find(x => x.id === rb.dataset.role);
        await A.editor({ title: r.name, body: roleForm(r), onSave: async f => { await WB.req(`/admin/roles/${r.id}`, { body: { name: f.name.value, level: +f.level.value, description: f.description.value, mfaRequired: f.mfa.checked } }); A.show("roles"); },
          danger: !r.system && WB.can("roles", "d") ? { label: t("adm.delete"), onClick: async () => { await WB.req(`/admin/roles/${r.id}`, { method: "DELETE" }); A.show("roles"); } } : null });
      }
      if (e.target.closest("#newRole")) await A.editor({ title: t("adm.newRole"), body: roleForm(null), onSave: async f => { await WB.req("/admin/roles", { body: { id: f.id.value, name: f.name.value, level: +f.level.value, description: f.description.value, mfaRequired: f.mfa.checked } }); A.show("roles"); } });
    } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
} });

A.register({ id: "invites", title: t("adm.invites"), order: 30, need: ["invites", "v"], render: async el => {
  A.loading(el);
  let d, roles; try { [d, roles] = await Promise.all([WB.req("/admin/invites"), WB.req("/admin/roles")]); } catch (e) { return A.err(el, e); }
  const link = code => `${location.origin}${WB.base ? "/" + WB.lang : ""}/pieslegties.html?invite=${encodeURIComponent(code)}#register`;
  el.innerHTML = `<h2>${esc(t("adm.invites"))}</h2><p class="muted">${esc(t("adm.invitesText"))}</p>
    ${WB.can("invites", "c") ? `<form class="form inline-form adm-inv" id="invForm"><label class="field"><span>${esc(t("adm.role"))}</span><select name="role">${roles.roles.filter(r => r.id !== "admin" && (WB.me.role === "admin" || r.level < WB.me.level)).map(r => `<option value="${esc(r.id)}"${r.id === "member" ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
      <label class="field"><span>${esc(t("adm.validDays"))}</span><input type="number" name="days" min="1" max="90" value="14"></label><label class="field"><span>${esc(t("adm.uses"))}</span><input type="number" name="uses" min="1" max="20" value="1"></label>
      <label class="field grow"><span>${esc(t("adm.note"))}</span><input name="note" maxlength="140" placeholder="${esc(t("adm.notePh"))}"></label><button class="btn">${esc(t("adm.createInvite"))}</button></form>` : ""}
    ${A.table([t("adm.code"), t("adm.role"), t("adm.status"), t("adm.uses"), t("adm.expires"), t("adm.note"), ""], d.invites.map(i => `<tr><td><code>${esc(i.code)}</code></td><td>${esc(i.roleName || i.role)}</td><td>${A.badge(i.state)}</td><td class="num">${i.uses}/${i.maxUses}</td><td class="small">${esc(i.expires ? A.fmt(i.expires) : "—")}</td><td class="small">${esc(i.note || "")}${i.log.length ? `<details><summary>${esc(t("adm.log"))}</summary>${i.log.map(l => `<div class="small muted">${esc(A.fmt(l.at))} · ${esc(t("inv." + l.event))}${l.name ? " · " + esc(l.name) : ""}</div>`).join("")}</details>` : ""}</td><td>${i.state === "open" ? `<button class="link-btn" data-copy="${esc(link(i.code))}">${esc(t("adm.copyLink"))}</button> <button class="link-btn" data-revoke="${esc(i.code)}">${esc(t("adm.revoke"))}</button>` : ""}</td></tr>`))}`;
  const f = $("#invForm", el);
  f && f.addEventListener("submit", async e => {
    e.preventDefault();
    try { const r = await WB.req("/admin/invites", { body: { role: f.role.value, days: +f.days.value, uses: +f.uses.value, note: f.note.value } });
      await WB.modal({ title: t("adm.inviteCreated"), body: `<p class="muted">${esc(t("adm.inviteShare"))}</p><p class="big-code"><code>${esc(r.code)}</code></p><p class="small"><a href="${esc(link(r.code))}">${esc(link(r.code))}</a></p>`, actions: [{ label: t("btn.done"), value: "ok", primary: true }] });
      A.show("invites"); } catch (x) { WB.toast(WB.errMsg(x), true); }
  });
  el.onclick = async e => {
    const c = e.target.closest("[data-copy]"), r = e.target.closest("[data-revoke]");
    if (c) navigator.clipboard.writeText(c.dataset.copy).then(() => WB.toast(t("btn.copied")));
    if (r && await WB.confirm(t("adm.revoke"), t("adm.revokeText"), t("adm.revoke"))) { try { await WB.req(`/admin/invites/${r.dataset.revoke}/revoke`, { body: {} }); A.show("invites"); } catch (x) { WB.toast(WB.errMsg(x), true); } }
  };
} });

A.register({ id: "audit", title: t("adm.audit"), order: 80, need: ["audit", "v"], render: async el => {
  el.innerHTML = `<h2>${esc(t("adm.audit"))}</h2><p class="muted">${esc(t("adm.auditText"))}</p>
    <form class="form inline-form" id="auditQ"><label class="field grow"><span>${esc(t("adm.search"))}</span><input type="search" name="q"></label><button class="btn small">${esc(t("adm.search"))}</button>${WB.can("audit", "x") ? `<a class="btn ghost small" id="auditCsv" href="/api/admin/audit?format=csv" download>CSV</a>` : ""}</form><div id="auditList"></div>`;
  const load = async q => {
    const box = $("#auditList", el); A.loading(box);
    try { const r = await WB.req("/admin/audit" + (q ? "?q=" + encodeURIComponent(q) : ""));
      box.innerHTML = A.table([t("adm.time"), t("adm.who"), t("adm.action"), t("adm.target"), t("adm.details")], r.entries.map(x => `<tr><td class="small nowrap">${esc(A.fmt(x.at))}</td><td>${esc(x.actor || "—")}</td><td><code>${esc(x.action)}</code></td><td class="small">${esc([x.targetType, x.targetId].filter(Boolean).join(" · "))}</td><td class="small mono-wrap">${x.details ? `<details><summary>${esc(t("adm.show"))}</summary><pre>${esc(JSON.stringify(x.details, null, 1))}</pre></details>` : ""}</td></tr>`));
    } catch (e) { A.err(box, e); }
  };
  $("#auditQ", el).addEventListener("submit", e => { e.preventDefault(); load(e.target.q.value); });
  const csv = $("#auditCsv", el);
  csv && csv.addEventListener("click", async e => { e.preventDefault(); try { const r = await WB.req("/admin/audit?format=csv", { raw: true }); if (r.status === 403) { const j = await r.json(); if (j.code === "mfa_stepup" && await WB.stepUp()) return csv.click(); throw new WB.ApiError(403, j); } const b = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `wbmc-audit-${WB.iso(new Date())}.csv`; a.click(); } catch (x) { WB.toast(WB.errMsg(x), true); } });
  load("");
} });

A.register({ id: "security", title: "Security Center", order: 90, need: ["security", "v"], render: async el => {
  A.loading(el);
  let s, reqs = null;
  try { s = await WB.req("/admin/security"); if (WB.can("security", "a")) reqs = await WB.req("/admin/mfa-requests").catch(() => null); } catch (e) { return A.err(el, e); }
  const ev = list => list.length ? `<ul class="rows ev-list">${list.map(x => `<li><span class="badge ${x.severity === "CRITICAL" || x.severity === "HIGH" ? "bad" : x.severity === "MEDIUM" ? "warn" : ""}">${esc(x.severity)}</span> <b>${esc(t("sec." + x.type) !== "sec." + x.type ? t("sec." + x.type) : x.type)}</b> <span class="small muted">${esc(x.name || "")} · ${esc(A.fmt(x.at))} · IP ${esc(x.ip || "—")}${x.country ? " (" + esc(x.country) + ")" : ""}</span></li>`).join("")}</ul>` : `<p class="muted small">${esc(t("adm.noData"))}</p>`;
  const mfaOff = s.mfa.filter(u => !u.enabled);
  el.innerHTML = `<h2>Security Center</h2><p class="muted">${esc(t("sc.text"))}</p>
    <div class="tiles">
      <div class="tile${mfaOff.length ? " bad" : ""}"><b class="num">${s.mfa.length - mfaOff.length}/${s.mfa.length}</b><span>${esc(t("sc.mfaElevated"))}</span></div>
      <div class="tile"><b class="num">${s.sessions.length}</b><span>${esc(t("sc.activeSessions"))}</span></div>
      <div class="tile${s.failures.length ? " warn" : ""}"><b class="num">${s.failures.length}</b><span>${esc(t("sc.failures7d"))}</span></div>
      <div class="tile${s.alerts.length ? " warn" : ""}"><b class="num">${s.alerts.length}</b><span>${esc(t("sc.alerts"))}</span></div>
    </div>
    <div class="sc-grid">
      <section><h3 class="adm-sub">${esc(t("sc.mfa"))}</h3><ul class="rows">${s.mfa.map(u => `<li><b>${esc(u.name)}</b> <span class="small muted">${esc(u.role)}</span> ${u.enabled ? `<span class="badge ok">${esc(t("mfa.on"))}</span>` : `<span class="badge bad">${esc(t("mfa.off"))}</span>`}</li>`).join("")}</ul></section>
      <section><h3 class="adm-sub">${esc(t("sc.status"))}</h3><ul class="rows sc-status">
        <li><span>${esc(t("sc.backup"))}</span><b>${s.backup ? esc(A.fmt(s.backup.at || s.backup)) : `<span class="badge warn">${esc(t("sc.noBackup"))}</span>`}</b></li>
        <li><span>${esc(t("sc.webhook"))}</span><b>${s.webhook ? `<span class="badge ok">${esc(t("sc.configured"))}</span>` : `<span class="badge warn">${esc(t("sc.notConfigured"))}</span>`}</b></li>
        <li><span>${esc(t("sc.bot"))}</span><b>${s.turnstile ? `<span class="badge ok">${esc(t("sc.configured"))}</span>` : `<span class="badge">${esc(t("sc.notConfigured"))}</span>`}</b></li>
        <li><span>${esc(t("sc.ids"))}</span><b><span class="badge">${esc(t("sc.notConnected"))}</span></b></li>
        <li><span>${esc(t("sc.vuln"))}</span><b><span class="badge">${esc(t("sc.notConnected"))}</span></b></li>
        <li><span>${esc(t("sc.migrations"))}</span><b class="small">${s.migrations.length}</b></li></ul></section>
    </div>
    ${reqs && reqs.requests.filter(r => r.status === "pending").length ? `<h3 class="adm-sub">${esc(t("sc.mfaRequests"))}</h3><ul class="rows">${reqs.requests.filter(r => r.status === "pending").map(r => `<li><div><b>${esc(r.name)}</b> <span class="small muted">${esc(A.fmt(r.created))}</span><br><span class="small">${esc(r.reason || "")}</span></div><div class="btn-row"><button class="btn danger small" data-mfa="${r.id}" data-act="approve">${esc(t("sc.approveDisable"))}</button><button class="btn ghost small" data-mfa="${r.id}" data-act="deny">${esc(t("sc.deny"))}</button></div></li>`).join("")}</ul>` : ""}
    <h3 class="adm-sub">${esc(t("sc.alertsTitle"))}</h3>${ev(s.alerts)}
    <h3 class="adm-sub">${esc(t("sc.logins"))}</h3>${ev(s.logins)}
    <h3 class="adm-sub">${esc(t("sc.failuresTitle"))}</h3>${ev(s.failures)}
    ${s.topFailingIps.length ? `<p class="small muted">${esc(t("sc.topIps"))}: ${s.topFailingIps.map(x => `${esc(x.ip)} (${x.n})`).join(", ")}</p>` : ""}
    <h3 class="adm-sub">${esc(t("sc.newDevices"))}</h3>${ev(s.newDevices)}
    <h3 class="adm-sub">${esc(t("sc.activeSessions"))}</h3>
    ${A.table([t("adm.name"), t("adm.lastSeen"), "IP", "MFA", ""], s.sessions.map(x => `<tr><td>${esc(x.name)} <span class="small muted">${esc(x.role)}</span></td><td class="small">${esc(A.ago(x.lastSeen))}</td><td class="small">${esc(x.ip || "—")}</td><td>${x.mfa ? "✓" : "—"}</td><td>${WB.can("security", "e") ? `<button class="link-btn" data-sess="${esc(x.id)}">${esc(t("acc.revoke"))}</button>` : ""}</td></tr>`))}`;
  el.onclick = async e => {
    const m = e.target.closest("[data-mfa]"), ss = e.target.closest("[data-sess]");
    try {
      if (m && await WB.confirm(t("sc.mfaRequests"), t(m.dataset.act === "approve" ? "sc.approveText" : "sc.denyText"), t(m.dataset.act === "approve" ? "sc.approveDisable" : "sc.deny"), m.dataset.act === "approve")) { await WB.req(`/admin/mfa-requests/${m.dataset.mfa}/${m.dataset.act}`, { body: {} }); A.show("security"); }
      if (ss) { await WB.req(`/admin/security/sessions/${ss.dataset.sess}/revoke`, { body: {} }); A.show("security"); }
    } catch (x) { WB.toast(WB.errMsg(x), true); }
  };
} });

A.register({ id: "settings", title: t("adm.settings"), order: 95, need: ["settings", "v"], render: async el => {
  A.loading(el);
  let s; try { s = (await WB.req("/admin/settings")).settings; } catch (e) { return A.err(el, e); }
  const qr = (s.qr_target && s.qr_target.value) || "/";
  el.innerHTML = `<h2>${esc(t("adm.settings"))}</h2>
    <section class="panel"><h3>${esc(t("set.qrTitle"))}</h3><p class="muted">${esc(t("set.qrText"))}</p>
      <form class="form inline-form" id="qrForm"><label class="field grow"><span>${esc(t("set.qrTarget"))}</span><input name="target" value="${esc(qr)}" required></label><button class="btn small"${WB.can("settings", "e") ? "" : " disabled"}>${esc(t("btn.save"))}</button></form>
      <p class="small muted">${esc(t("set.qrCode"))}: <code>https://wolvesbrotherhoodmc.com/qr</code></p></section>`;
  $("#qrForm", el).addEventListener("submit", async e => { e.preventDefault(); try { await WB.req("/admin/settings", { body: { qr_target: e.target.target.value } }); WB.toast(t("adm.saved")); } catch (x) { WB.toast(WB.errMsg(x), true); } });
} });

A.register({ id: "i18n", title: t("adm.i18n"), order: 96, need: ["i18n", "v"], render: async el => {
  A.loading(el);
  let o; try { o = await WB.req("/admin/i18n"); } catch (e) { return A.err(el, e); }
  const keys = Object.keys(window.I18N || {}).sort();
  el.innerHTML = `<h2>${esc(t("adm.i18n"))}</h2><p class="muted">${esc(t("adm.i18nText"))}</p>
    <form class="form adm-i18n" id="i18nForm"><div class="two"><label class="field"><span>${esc(t("adm.lang"))}</span><select name="lang">${LANGS.map(l => `<option${l === WB.lang ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>${esc(t("adm.key"))}</span><input name="key" list="i18nKeys" required autocomplete="off"><datalist id="i18nKeys">${keys.map(k => `<option value="${esc(k)}">`).join("")}</datalist></label></div>
      <p class="small muted" id="i18nCur"></p>
      <label class="field"><span>${esc(t("adm.value"))}</span><textarea name="value" rows="3" maxlength="2000"></textarea><small class="hint">${esc(t("adm.i18nEmpty"))}</small></label>
      <button class="btn small"${WB.can("i18n", "e") ? "" : " disabled"}>${esc(t("btn.save"))}</button></form>
    <h3 class="adm-sub">${esc(t("adm.overrides"))}</h3>
    ${A.table([t("adm.lang"), t("adm.key"), t("adm.value"), t("adm.who")], o.overrides.map(x => `<tr><td>${esc(x.lang)}</td><td><code>${esc(x.key)}</code></td><td>${esc(x.value)}</td><td class="small">${esc(x.by || "")} · ${esc(A.ago(x.updated))}</td></tr>`))}`;
  const f = $("#i18nForm", el);
  f.key.addEventListener("change", () => { $("#i18nCur", el).textContent = (window.I18N || {})[f.key.value] ? `${t("adm.current")} (${WB.lang}): ${window.I18N[f.key.value]}` : ""; });
  f.addEventListener("submit", async e => { e.preventDefault(); try { await WB.req("/admin/i18n", { body: { lang: f.lang.value, key: f.key.value, value: f.value.value } }); WB.toast(t("adm.saved")); A.show("i18n"); } catch (x) { WB.toast(WB.errMsg(x), true); } });
} });

/* ---------- čaula ---------- */
const visible = () => A.sections.filter(s => !s.need || WB.can(s.need[0], s.need[1])).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
A.show = async id => {
  const list = visible(), s = list.find(x => x.id === id) || list[0];
  if (!s) return;
  $$("#admNav a").forEach(a => a.setAttribute("aria-current", a.dataset.id === s.id ? "page" : "false"));
  $("#admSelect").value = s.id;
  const main = $("#admMain"); main.innerHTML = ""; main.onclick = null;
  const el = document.createElement("div"); el.className = "adm-sec"; main.appendChild(el);
  try { await s.render(el); } catch (e) { A.err(el, e); }
};
async function boot(){
  const me = await WB.gate($("#admGate"));
  if (!me) return;
  const list = visible().filter(s => s.need);
  if (!list.length) { $("#admGate").innerHTML = `<div class="gate"><h2>${esc(t("gate.noAccessTitle"))}</h2><p>${esc(t("gate.noAccessText"))}</p></div>`; return; }
  if (me.mfaRequired && !me.mfaEnabled) { $("#admGate").innerHTML = `<div class="gate"><h2>${esc(t("mfa.requiredTitle"))}</h2><p>${esc(t("mfa.requiredText"))}</p><div class="btn-row"><a class="btn" href="profils.html">${esc(t("mfa.start"))}</a></div></div>`; return; }
  $("#adm").hidden = false;
  $("#admNav").innerHTML = visible().map(s => `<li><a href="#${s.id}" data-id="${s.id}">${esc(s.title)}</a></li>`).join("");
  $("#admSelect").innerHTML = visible().map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join("");
  $("#admSelect").addEventListener("change", e => A.go(e.target.value));
  addEventListener("hashchange", () => A.show(location.hash.slice(1)));
  A.show(location.hash.slice(1) || "overview");
}
document.addEventListener("DOMContentLoaded", boot);
})();
