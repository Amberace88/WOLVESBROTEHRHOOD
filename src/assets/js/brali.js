/* WBMC — Brāļi: kluba biedru profili (tikai biedriem). Lauki tiek filtrēti servera pusē pēc lomas līmeņa. */
(function(){
const { $, $$, esc, t, L } = WB;
const app = $("#app");
let D = null;
const F = { q: "", rank: "", position: "", status: "" };

const nameIn = (list, id) => { const x = (list || []).find(r => r.id === id); return x ? L(x.name) : id; };
const orderIn = (list, id) => { const i = (list || []).findIndex(r => r.id === id); return i < 0 ? 999 : i; };
const initials = s => ((String(s || "").match(/\p{L}/u) || ["?"])[0]).toLocaleUpperCase(WB.locale);

/* uzšuves cilne (patch tab): melns audums, kaula baltā mala un iekšējā šuve */
const tab = (txt, cls = "") => {
  const s = String(txt || "").toLocaleUpperCase(WB.locale), fs = Math.min(21, 300 / Math.max([...s].length, 6));
  return `<span class="br-tab ${cls}"><svg viewBox="0 0 220 44" aria-hidden="true" focusable="false"><rect x="2" y="2" width="216" height="40" rx="7" class="t-edge"/><rect x="7.5" y="7.5" width="205" height="29" rx="4" class="t-stitch"/><text x="110" y="23" text-anchor="middle" dominant-baseline="central" font-size="${fs.toFixed(1)}">${esc(s)}</text></svg><span class="sr-only">${esc(txt)}</span></span>`;
};
const photo = (p, big) => p.photo
  ? `<img src="${esc(p.photo)}" alt="${esc(t("br.photoOf", { name: p.nickname }))}" loading="lazy" decoding="async">`
  : `<span class="br-mono${big ? " big" : ""}" aria-hidden="true">${esc(initials(p.nickname))}</span>`;

const sortKey = p => [p.position ? orderIn(D.positions, p.position) : 999, p.rank ? orderIn(D.ranks, p.rank) : 999, (p.nickname || "").toLocaleLowerCase(WB.locale)];
const cmp = (a, b) => { const x = sortKey(a), y = sortKey(b); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], WB.locale); };

function card(p){
  const patch = p.position ? nameIn(D.positions, p.position) : p.rank ? nameIn(D.ranks, p.rank) : "";
  const meta = [p.position && p.rank ? nameIn(D.ranks, p.rank) : "", p.status ? nameIn(D.statuses, p.status) : ""].filter(Boolean);
  return `<li><button type="button" class="br-card${p.position ? " officer" : ""}${p.archived ? " is-archived" : ""}" data-id="${esc(p.id)}" aria-haspopup="dialog">
    <span class="br-photo">${photo(p)}</span>
    <span class="br-body">
      <span class="br-name">${esc(p.nickname)}</span>
      ${patch ? tab(patch) : ""}
      ${meta.length ? `<span class="br-meta">${meta.map(esc).join(" · ")}</span>` : ""}
      ${p.archived ? `<span class="badge">${esc(t("status.archived"))}</span>` : ""}
    </span></button></li>`;
}

function filtered(){
  const q = F.q.trim().toLocaleLowerCase(WB.locale);
  return D.profiles.filter(p => (!F.rank || p.rank === F.rank) && (!F.position || p.position === F.position) && (!F.status || p.status === F.status)
    && (!q || [p.nickname, p.realName, p.city, p.bike, p.rank && nameIn(D.ranks, p.rank), p.position && nameIn(D.positions, p.position)].filter(Boolean).join(" ").toLocaleLowerCase(WB.locale).includes(q))).sort(cmp);
}

function renderList(){
  const box = $("#brList"), list = filtered(), any = F.q || F.rank || F.position || F.status;
  $("#brCount").textContent = t("br.count", { n: list.length, total: D.profiles.length });
  if (!list.length) { box.innerHTML = `<div class="empty"><p>${esc(t("br.noMatch"))}</p><button class="btn ghost small" id="brReset" type="button">${esc(t("br.reset"))}</button></div>`; return; }
  const officers = any ? [] : list.filter(p => p.position), rest = any ? list : list.filter(p => !p.position);
  box.innerHTML = (officers.length ? `<section class="br-group" aria-labelledby="brG1"><h2 id="brG1" class="br-gh">${esc(t("br.officers"))}</h2><ul class="br-grid">${officers.map(card).join("")}</ul></section>` : "")
    + (rest.length ? `<section class="br-group" aria-labelledby="brG2">${officers.length ? `<h2 id="brG2" class="br-gh">${esc(t("br.brothers"))}</h2>` : `<h2 id="brG2" class="sr-only">${esc(t("br.brothers"))}</h2>`}<ul class="br-grid">${rest.map(card).join("")}</ul></section>` : "");
}

function selectFor(key, list, label){
  const used = new Set(D.profiles.map(p => p[key]).filter(Boolean));
  const opts = (list || []).filter(r => used.has(r.id));
  if (opts.length < 2) return "";
  return `<label class="field br-sel"><span>${esc(label)}</span><select data-f="${key}"><option value="">${esc(t("br.all"))}</option>${opts.map(r => `<option value="${esc(r.id)}">${esc(L(r.name))}</option>`).join("")}</select></label>`;
}

function render(){
  if (!D.profiles.length) {
    app.innerHTML = D.canCreate
      ? `<div class="empty br-empty"><p>${esc(t("br.emptyAdmin"))}</p><a class="btn" href="admin.html#people">${esc(t("br.openAdmin"))}</a></div>`
      : `<div class="empty br-empty"><p>${esc(t("br.empty"))}</p></div>`;
    return;
  }
  app.innerHTML = `<div class="br-tools" role="search">
      <label class="field br-q"><span>${esc(t("br.search"))}</span><input type="search" id="brQ" placeholder="${esc(t("br.searchPh"))}" autocomplete="off"></label>
      ${selectFor("rank", D.ranks, t("br.rank"))}${selectFor("position", D.positions, t("br.position"))}${selectFor("status", D.statuses, t("br.status"))}
      <p class="br-count small muted" id="brCount" aria-live="polite"></p>
    </div>
    <div id="brList"></div>
    <p class="br-note small dim">${esc(t("br.privacy"))}${D.canEdit ? ` <a href="admin.html#people">${esc(t("br.manage"))}</a>` : ""}</p>`;
  $("#brQ").addEventListener("input", e => { F.q = e.target.value; renderList(); });
  $$(".br-tools select").forEach(s => s.addEventListener("change", e => { F[e.target.dataset.f] = e.target.value; renderList(); }));
  app.addEventListener("click", e => {
    const c = e.target.closest(".br-card"); if (c) return open(c.dataset.id);
    if (e.target.closest("#brReset")) { Object.assign(F, { q: "", rank: "", position: "", status: "" }); $("#brQ").value = ""; $$(".br-tools select").forEach(s => { s.value = ""; }); renderList(); }
  });
  renderList();
}

/* profila detaļas: tikai lauki, ko serveris atdeva */
function open(id){
  const p = D.profiles.find(x => x.id === id); if (!p) return;
  const row = (k, v) => v ? `<div><dt>${esc(t(k))}</dt><dd>${v}</dd></div>` : "";
  const bio = L(p.bio || {});
  const dl = [
    row("br.rank", p.rank && esc(nameIn(D.ranks, p.rank))), row("br.position", p.position && esc(nameIn(D.positions, p.position))),
    row("br.status", p.status && esc(nameIn(D.statuses, p.status))), row("br.joined", p.joinedYear && `<span class="num">${esc(p.joinedYear)}</span>`),
    row("br.realName", p.realName && esc(p.realName)), row("br.city", p.city && esc(p.city)), row("br.bike", p.bike && esc(p.bike)),
    row("br.phone", p.phone && `<a href="tel:${esc(p.phone.replace(/[^+0-9]/g, ""))}">${esc(p.phone)}</a>`), row("br.email", p.email && `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`)
  ].join("");
  const patch = p.position ? nameIn(D.positions, p.position) : p.rank ? nameIn(D.ranks, p.rank) : "";
  const canDm = p.userId && WB.me && p.userId !== WB.me.id;
  const prev = location.hash;
  history.replaceState(null, "", "#p-" + p.id);
  WB.modal({ title: p.nickname, wide: true, body: `<div class="br-detail">
      <div class="br-dphoto">${photo(p, true)}</div>
      <div class="br-dinfo">
        ${patch ? tab(patch, "lg") : ""}
        ${dl ? `<dl class="br-dl">${dl}</dl>` : `<p class="muted">${esc(t("br.noFields"))}</p>`}
        ${bio ? `<div class="br-bio prose">${bio.split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("")}</div>` : ""}
        <div class="btn-row">${canDm ? `<a class="btn" href="sazina.html#dm/${encodeURIComponent(p.userId)}">${esc(t("br.write"))}</a>` : ""}${p.mine ? `<span class="badge">${esc(t("br.yourProfile"))}</span>` : ""}${D.canEdit ? `<a class="btn ghost small" href="admin.html#people">${esc(t("br.editAdmin"))}</a>` : ""}</div>
      </div></div>` }).then(() => { history.replaceState(null, "", prev && !prev.startsWith("#p-") ? prev : location.pathname + location.search); const b = $(`.br-card[data-id="${CSS.escape(p.id)}"]`); b && b.focus(); });
}

async function boot(){
  const me = await WB.gate(app, { module: "members", action: "v" });
  if (!me) return;
  app.innerHTML = `<p class="muted br-loading">${esc(t("br.loading"))}</p>`;
  try { D = await WB.req("/people"); }
  catch (e) { app.innerHTML = `<div class="empty"><p>${esc(WB.errMsg(e))}</p></div>`; return; }
  render();
  const m = location.hash.match(/^#p-([0-9a-z]{16})$/);
  if (m) open(m[1]);
}
document.addEventListener("DOMContentLoaded", boot);
})();
