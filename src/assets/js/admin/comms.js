/* WBMC administrācija — Saziņa: kanāli un piekļuves pakāpes, moderācijas žurnāls, norīkojumi, idejas.
   Visas darbības pārbauda serveris (chat:e / chat:d / orders:c,e / ideas:a, ar svaigu MFA). */
(function(){
const { $, $$, esc, t } = WB;
const A = window.WBAdmin;
const TOPICS = ["general", "closed", "tech", "routes", "rhr", "other"];
let rolesCache = null;
const roles = async () => rolesCache || (rolesCache = (await WB.req("/admin/roles")).roles.sort((a, b) => a.level - b.level));
const roleFor = (list, lvl) => (list.find(r => r.level >= lvl) || {}).name || String(lvl);
const levelSelect = (list, name, sel, max = 100) => `<select name="${name}">${list.filter(r => r.level <= max).map(r => `<option value="${r.level}"${r.level === sel ? " selected" : ""}>${esc(r.name)} (${r.level})</option>`).join("")}</select>`;
const open = href => `<a class="link-btn" href="sazina.html${href}">${esc(t("comms.adm.open"))}</a>`;

/* ---------- Saziņa: kanāli + moderācija ---------- */
A.register({ id: "comms", title: t("comms.adm.title"), need: ["chat", "v"], order: 50, render: async el => {
  const canE = WB.can("chat", "e"), canLog = WB.can("chat", "d") || WB.can("audit", "v");
  el.innerHTML = `<h2>${esc(t("comms.adm.title"))}</h2><p class="muted">${esc(t("comms.adm.text"))}</p><div id="cmRooms"></div><div id="cmLog"></div>`;
  if (!canE && !canLog) { $("#cmRooms", el).innerHTML = `<div class="empty"><p>${esc(t("comms.adm.noRights"))}</p></div>`; return; }
  if (canE) {
    const box = $("#cmRooms", el); A.loading(box);
    try {
      const [d, rl] = await Promise.all([WB.req("/comms/admin/rooms"), roles()]);
      box.innerHTML = `<div class="section-head"><h3 class="adm-sub">${esc(t("comms.adm.channels"))}</h3><button class="btn small" id="cmNew">${esc(t("comms.adm.newChannel"))}</button></div>
        ${A.table([t("comms.adm.name"), t("comms.adm.topic"), t("comms.adm.minLevel"), t("adm.status"), t("comms.adm.messages"), t("comms.adm.lastActivity"), ""], d.rooms.map(r => `<tr>
          <td><b>${esc(WB.L(r.name))}</b><br><span class="small muted">${esc(r.id)}${WB.L(r.description) ? " · " + esc(WB.L(r.description)) : ""}</span></td>
          <td>${esc(t("comms.adm.topic." + r.topic))}</td><td>${esc(roleFor(rl, r.minLevel))} <span class="small muted">≥ ${r.minLevel}</span></td>
          <td>${A.badge(r.archived ? "archived" : "active")}</td><td class="num">${r.messages}</td><td class="small">${esc(A.ago(r.lastAt))}</td>
          <td class="nowrap"><button class="btn ghost small" data-edit="${esc(r.id)}">${esc(t("adm.edit"))}</button> ${r.archived ? "" : open("#" + (r.id === "rhr" ? "rhr" : r.id))}</td></tr>`))}
        <p class="small muted">${esc(t("comms.adm.privateStats", { g: d.groups, d: d.dms }))}</p>`;
      const form = r => `${A.mlField("name", t("comms.adm.name"), r ? r.name : {}, { max: 60, required: true })}
        ${A.mlField("description", t("comms.adm.description"), r ? r.description : {}, { max: 300, textarea: true, rows: 2 })}
        <div class="two"><label class="field"><span>${esc(t("comms.adm.minLevel"))}</span>${levelSelect(rl, "minLevel", r ? r.minLevel : 20, WB.me.role === "admin" ? 100 : WB.me.level)}</label>
        <label class="field"><span>${esc(t("comms.adm.topic"))}</span><select name="topic">${TOPICS.map(x => `<option value="${x}"${(r ? r.topic : "general") === x ? " selected" : ""}>${esc(t("comms.adm.topic." + x))}</option>`).join("")}</select></label></div>
        <p class="hint">${esc(t("comms.adm.minLevelHint"))}</p>
        <label class="field"><span>${esc(t("comms.adm.sort"))}</span><input type="number" name="sort" min="0" max="999" value="${r ? r.sort : 100}"></label>
        ${r ? `<p class="hint">${esc(t("comms.adm.archiveText"))}</p>` : ""}`;
      const read = f => ({ name: A.readML(f, "name"), description: A.readML(f, "description"), minLevel: +f.minLevel.value, topic: f.topic.value, sort: +f.sort.value });
      $("#cmNew", box).addEventListener("click", () => A.editor({ title: t("comms.adm.newChannel"), body: form(null), onSave: async f => { await WB.req("/comms/admin/rooms", { body: read(f) }); WB.toast(t("adm.saved")); A.show("comms"); } }));
      box.addEventListener("click", e => {
        const b = e.target.closest("[data-edit]"); if (!b) return;
        const r = d.rooms.find(x => x.id === b.dataset.edit);
        A.editor({ title: t("comms.adm.editChannel"), body: form(r), onSave: async f => { await WB.req(`/comms/admin/rooms/${r.id}`, { body: read(f) }); WB.toast(t("adm.saved")); A.show("comms"); },
          danger: { label: r.archived ? t("comms.adm.restore") : t("comms.adm.archive"), onClick: async () => { await WB.req(`/comms/admin/rooms/${r.id}`, { body: { archived: !r.archived } }); A.show("comms"); } } });
      });
    } catch (e) { A.err(box, e); }
  }
  if (canLog) {
    const box = $("#cmLog", el); A.loading(box);
    try {
      const d = await WB.req("/comms/admin/log");
      const label = a => t("comms.act." + a) !== "comms.act." + a ? t("comms.act." + a) : a;
      const detail = x => { const v = x.details || {}; if (x.action === "comms.message.delete") return `${esc(v.authorName || "—")} · # ${esc(v.roomName || v.room || "")}<br><span class="muted">„${esc(((v.before || {}).body || "").slice(0, 200))}”</span>`; return `<details><summary>${esc(t("adm.show"))}</summary><pre>${esc(JSON.stringify(v, null, 1))}</pre></details>`; };
      box.innerHTML = `<h3 class="adm-sub">${esc(t("comms.adm.modLog"))}</h3><p class="small muted">${esc(t("comms.adm.modLogText"))}</p>
        ${A.table([t("adm.time"), t("adm.who"), t("adm.action"), t("adm.details")], d.entries.map(x => `<tr><td class="small nowrap">${esc(A.fmt(x.at))}</td><td>${esc(x.actor || "—")}</td><td>${esc(label(x.action))}<br><code class="small">${esc(x.action)}</code></td><td class="small mono-wrap">${detail(x)}</td></tr>`))}`;
    } catch (e) { A.err(box, e); }
  }
} });

/* ---------- Norīkojumi ---------- */
A.register({ id: "comms-orders", title: t("comms.adm.orders"), need: ["orders", "v"], order: 51, render: async el => {
  A.loading(el);
  let d, rl; try { [d, rl] = await Promise.all([WB.req("/comms/orders?status=all"), roles()]); } catch (e) { return A.err(el, e); }
  const max = WB.me.role === "admin" ? 100 : WB.me.level;
  el.innerHTML = `<div class="section-head"><div><h2>${esc(t("comms.adm.orders"))}</h2><p class="muted">${esc(t("comms.adm.ordersText"))}</p></div>${d.canCreate ? `<button class="btn small" id="ordNew">${esc(t("comms.newOrder"))}</button>` : ""}</div>
    ${A.table([t("comms.orderTitle"), t("comms.audience"), t("adm.status"), t("comms.adm.updated"), ""], d.orders.map(o => `<tr><td><b>${esc(o.title)}</b><br><span class="small muted">${esc(t("comms.createdBy", { name: o.createdByName }))} · ${esc(A.fmt(o.created))}</span></td>
      <td>${esc(t("comms.audienceFrom", { role: o.audienceRole || o.audienceMinLevel }))}</td><td>${A.badge(o.status)}</td><td class="small">${esc(A.fmt(o.updated))}<br><span class="muted">${esc(o.updatedByName)}</span></td>
      <td class="nowrap">${d.canEdit ? `<button class="btn ghost small" data-edit="${esc(o.id)}">${esc(t("adm.edit"))}</button> ` : ""}<button class="link-btn" data-hist="${esc(o.id)}">${esc(t("comms.history"))}</button> ${open("#orders/" + o.id)}</td></tr>`), t("comms.noOrders"))}`;
  const form = o => `<label class="field"><span>${esc(t("comms.orderTitle"))}</span><input type="text" name="title" maxlength="160" minlength="3" required value="${esc(o ? o.title : "")}"></label>
    <label class="field"><span>${esc(t("comms.orderBody"))}</span><textarea name="body" rows="9" maxlength="8000" required>${esc(o ? o.body : "")}</textarea></label>
    <div class="two"><label class="field"><span>${esc(t("comms.audience"))}</span>${levelSelect(rl, "aud", o ? o.audienceMinLevel : 50, max)}</label>
    <label class="field"><span>${esc(t("comms.status"))}</span><select name="status"><option value="active">${esc(t("comms.statusActive"))}</option><option value="archived"${o && o.status === "archived" ? " selected" : ""}>${esc(t("comms.statusArchived"))}</option></select></label></div>
    <p class="hint">${esc(t("comms.audienceHint"))}</p>`;
  const read = f => ({ title: f.title.value, body: f.body.value, audienceMinLevel: +f.aud.value, status: f.status.value });
  const nb = $("#ordNew", el); nb && nb.addEventListener("click", () => A.editor({ title: t("comms.newOrder"), body: form(null), saveLabel: t("comms.saveOrder"), onSave: async f => { await WB.req("/comms/orders", { body: read(f) }); WB.toast(t("adm.saved")); A.show("comms-orders"); } }));
  el.onclick = async e => {
    const ed = e.target.closest("[data-edit]"), hi = e.target.closest("[data-hist]");
    if (ed) { const o = d.orders.find(x => x.id === ed.dataset.edit); A.editor({ title: t("comms.editOrder"), body: form(o), saveLabel: t("comms.saveOrder"), onSave: async f => { await WB.req(`/comms/orders/${o.id}`, { body: read(f) }); WB.toast(t("adm.saved")); A.show("comms-orders"); } }); }
    if (hi) {
      try {
        const h = await WB.req(`/comms/orders/${hi.dataset.hist}/history`);
        const val = (k, v) => k === "audience_min_level" ? roleFor(rl, v) : k === "status" ? t("status." + v) : String(v ?? "");
        await WB.modal({ title: t("comms.history"), wide: true, body: `<ol class="rows">${h.history.map(x => `<li style="padding:.6rem 0"><b>${esc(x.byName)}</b> <span class="small muted">${esc(A.fmt(x.at))}</span><br>${x.before ? Object.keys(x.after).map(k => `<div class="small"><span class="muted">${esc(t("comms.field." + k))}:</span> <s class="muted">${esc(val(k, x.before[k]).slice(0, 300))}</s> → ${esc(val(k, x.after[k]).slice(0, 300))}</div>`).join("") : `<span class="small">${esc(t("comms.historyCreated"))}</span>`}</li>`).join("")}</ol>`, actions: [{ label: t("btn.close"), value: "", primary: true }] });
      } catch (x) { WB.toast(WB.errMsg(x), true); }
    }
  };
} });

/* ---------- Idejas ---------- */
A.register({ id: "comms-ideas", title: t("comms.adm.ideas"), need: ["ideas", "v"], order: 52, render: async el => {
  A.loading(el);
  let d; try { d = await WB.req("/comms/ideas?status=all"); } catch (e) { return A.err(el, e); }
  const ST = ["new", "reviewed", "approved", "archived"];
  el.innerHTML = `<h2>${esc(t("comms.adm.ideas"))}</h2><p class="muted">${esc(t("comms.adm.ideasText"))}</p>
    ${A.table([t("comms.ideaTitle"), t("comms.topic"), t("comms.adm.author"), t("comms.status"), t("comms.comments"), ""], d.ideas.map(i => `<tr><td><b>${esc(i.title)}</b><br><span class="small muted">${esc(A.fmt(i.created))}</span></td>
      <td>${esc(t("comms.topic." + i.topic))}</td><td>${esc(i.authorName)}</td>
      <td>${d.canStatus ? `<select data-status="${esc(i.id)}" aria-label="${esc(t("comms.changeStatus"))}">${ST.map(s => `<option value="${s}"${s === i.status ? " selected" : ""}>${esc(t("comms.ist." + s))}</option>`).join("")}</select>` : esc(t("comms.ist." + i.status))}${i.statusBy ? `<br><span class="small muted">${esc(i.statusBy)}</span>` : ""}</td>
      <td class="num">${i.comments}</td><td>${open("#ideas/" + i.id)}</td></tr>`), t("comms.noIdeas"))}`;
  el.onchange = async e => {
    const s = e.target.closest("[data-status]"); if (!s) return;
    const prev = d.ideas.find(i => i.id === s.dataset.status).status;
    try { await WB.req(`/comms/ideas/${s.dataset.status}/status`, { body: { status: s.value } }); WB.toast(t("adm.saved")); A.show("comms-ideas"); }
    catch (x) { s.value = prev; WB.toast(WB.errMsg(x), true); }
  };
} });
})();
