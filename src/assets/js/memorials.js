/* WBMC — Memorials: brāļu piemiņas kartītes. Publiski redzamas tikai publicētās (ar kluba un ģimenes apstiprinājumu).
   Vārdi no brāļiem tiek publicēti tikai pēc moderēšanas. Dziļā saite: memorials.html#m-<slug> */
(function(){
const { $, $$, esc, t, L } = WB;
const app = $("#app");
let D = null, listScroll = 0;

const year = s => s ? String(s).slice(0, 4) : "";
const fullDate = s => s && s.length === 10 ? WB.dateLong(WB.parseISO(s)) : year(s);
const life = m => (m.born || m.died) ? `${year(m.born) || "…"} – ${year(m.died) || "…"}` : "";
const club = m => m.clubFrom || m.clubTo ? t("mm.inClub", { y: m.clubFrom && m.clubTo ? `${m.clubFrom}–${m.clubTo}` : (m.clubFrom || m.clubTo) }) : "";
const title = m => m.nickname || m.name;
const sub = m => m.nickname && m.name ? m.name : "";
const paras = (s, cls = "") => String(s || "").trim().split(/\n{2,}/).filter(Boolean).map(x => `<p${cls ? ` class="${cls}"` : ""}>${esc(x).replace(/\n/g, "<br>")}</p>`).join("");
/* redakcionālais teksts: ievada teikums lielajiem burtiem („BRĀLIS UZ MŪŽIEM.”) kļūst par klusu virsrindu */
const editorial = s => { const m = String(s || "").trim().match(/^((?:\p{Lu}|[\s'’-]){4,}[.!])\s+([\s\S]*)$/u); return m ? `<p class="mm-caps">${esc(m[1])}</p>${paras(m[2])}` : paras(s); };
const excerpt = m => { const s = (L(m.story) || L(m.contribution) || "").replace(/\s+/g, " ").trim(); if (!s) return ""; const one = (s.match(/^.{20,}?[.!?](\s|$)/) || [s])[0].trim(); return one.length > 150 ? one.slice(0, 147).replace(/\s+\S*$/, "") + "…" : one; };

/* svece — klusa līniju zīme, bez animācijas */
const candle = (cls = "") => `<svg class="mm-candle ${cls}" viewBox="0 0 40 96" aria-hidden="true" focusable="false">
  <path class="c-glow" d="M20 4c6 10 9 15 9 21a9 9 0 0 1-18 0c0-6 3-11 9-21z"/>
  <path class="c-flame" d="M20 10c3.6 6.6 5.4 10 5.4 14.2a5.4 5.4 0 0 1-10.8 0C14.6 20 16.4 16.6 20 10z"/>
  <path class="c-wick" d="M20 29v5"/>
  <rect class="c-body" x="12" y="34" width="16" height="54" rx="1.5"/>
  <path class="c-base" d="M6 90h28"/></svg>`;

const photo = (m, big) => m.photo
  ? `<img src="${esc(m.photo)}" alt="${esc(t("mm.photoOf", { name: title(m) }))}" loading="lazy" decoding="async">`
  : `<span class="mm-ph${big ? " big" : ""}" aria-hidden="true">${candle()}</span>`;

function intro(){
  return `<section class="mm-intro" aria-label="${esc(t("mm.introLabel"))}">${candle("lg")}<div class="mm-intro-text book">${editorial(t("mm.intro"))}</div></section>`;
}

function renderList(){
  document.title = t("meta.memorials.title");
  if (!D.memorials.length) {
    app.innerHTML = intro() + `<div class="empty mm-empty"><p>${esc(t("mm.empty"))}</p>${D.canEdit ? `<a class="btn ghost small" href="admin.html#memorials">${esc(t("mm.openAdmin"))}</a>` : ""}</div>`;
    return;
  }
  app.innerHTML = intro() + `<h2 class="sr-only">${esc(t("mm.cards"))}</h2><ul class="mm-grid">${D.memorials.map(m => `<li><a class="mm-card" href="#m-${esc(m.slug)}">
      <span class="mm-photo">${photo(m)}</span>
      <span class="mm-cbody">
        <span class="mm-name">${esc(title(m))}</span>
        ${sub(m) ? `<span class="mm-real">${esc(sub(m))}</span>` : ""}
        <span class="mm-years num">${esc([life(m), club(m)].filter(Boolean).join(" · "))}</span>
        ${excerpt(m) ? `<span class="mm-ex">${esc(excerpt(m))}</span>` : ""}
      </span></a></li>`).join("")}</ul>`;
  if (listScroll) { scrollTo(0, listScroll); listScroll = 0; }
}

async function renderDetail(slug){
  listScroll = listScroll || scrollY;
  app.innerHTML = `<p class="muted mm-loading">${esc(t("mm.loading"))}</p>`;
  let r;
  try { r = await WB.req("/memorials/" + encodeURIComponent(slug)); }
  catch (e) { app.innerHTML = `<div class="empty"><p>${esc(e.status === 404 ? t("mm.notFound") : WB.errMsg(e))}</p><a class="btn ghost small" href="#">${esc(t("mm.back"))}</a></div>`; return; }
  const m = r.memorial, txt = L(m.text) || t("mm.intro");
  document.title = `${title(m)} — ${t("meta.memorials.title")}`;
  const dates = (m.born || m.died) ? `<span class="num">${esc(fullDate(m.born) || "…")}</span> – <span class="num">${esc(fullDate(m.died) || "…")}</span>` : "";
  app.innerHTML = `<article class="mm-detail" aria-labelledby="mmTitle">
    <a class="mm-back link-btn" href="#">${WB.icon("back")}${esc(t("mm.back"))}</a>
    ${r.preview ? `<p class="mm-preview badge warn">${esc(t("mm.preview", { status: t("status." + m.status) }))}</p>` : ""}
    <header class="mm-head">
      <figure class="mm-portrait">${photo(m, true)}</figure>
      <div class="mm-hinfo">
        <h2 id="mmTitle" class="mm-dname">${esc(title(m))}</h2>
        ${sub(m) ? `<p class="mm-dreal">${esc(sub(m))}</p>` : ""}
        ${dates ? `<p class="mm-ddates">${dates}</p>` : ""}
        ${club(m) ? `<p class="mm-dclub small muted">${esc(club(m))}</p>` : ""}
        <blockquote class="mm-text book">${editorial(txt)}</blockquote>
      </div>
    </header>
    ${L(m.story) ? `<section class="mm-sec"><h3>${esc(t("mm.story"))}</h3><div class="book prose">${paras(L(m.story))}</div></section>` : ""}
    ${L(m.contribution) ? `<section class="mm-sec"><h3>${esc(t("mm.contribution"))}</h3><div class="book prose">${paras(L(m.contribution))}</div></section>` : ""}
    <section class="mm-sec mm-words" aria-labelledby="mmW"><h3 id="mmW">${esc(t("mm.words"))}</h3>
      ${r.words.length ? `<ul class="mm-wlist">${r.words.map(w => `<li><blockquote class="book">${paras(w.body)}</blockquote><p class="mm-wby small">— ${esc(w.author || t("mm.aBrother"))}</p></li>`).join("")}</ul>` : `<p class="muted">${esc(t("mm.noWords"))}</p>`}
      <div id="mmMine">${mine(r.myPending)}</div>
      ${wordsForm(r, m)}
    </section>
  </article>`;
  const f = $("#mmForm");
  if (f) {
    const ta = f.body, cnt = $("#mmCnt");
    const upd = () => { cnt.textContent = `${ta.value.length} / 1200`; };
    ta.addEventListener("input", upd); upd();
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        await WB.req(`/memorials/${m.id}/words`, { body: { body: ta.value, showName: f.showName.checked } });
        r.myPending = [{ body: ta.value, created: Date.now() }, ...(r.myPending || [])];
        $("#mmMine").innerHTML = mine(r.myPending); ta.value = ""; upd();
        WB.toast(t("mm.sent"));
      } catch (x) { $("#mmErr").textContent = WB.errMsg(x); }
      finally { btn.disabled = false; }
    });
  }
  const h = $("#mmTitle"); h && h.setAttribute("tabindex", "-1"); h && h.focus({ preventScroll: true });
  scrollTo(0, Math.max(0, app.getBoundingClientRect().top + scrollY - 90));
}
const mine = list => list && list.length ? `<div class="mm-mine"><p class="small muted">${esc(t("mm.minePending"))}</p>${list.map(w => `<blockquote class="book small">${paras(w.body)}</blockquote>`).join("")}</div>` : "";
function wordsForm(r, m){
  if (r.preview) return "";
  if (r.canSubmit) return `<form class="form mm-form" id="mmForm">
      <label class="field"><span>${esc(t("mm.yourWords"))}</span><textarea name="body" rows="5" maxlength="1200" minlength="2" required></textarea></label>
      <div class="mm-frow"><label class="check"><input type="checkbox" name="showName" checked><span>${esc(t("mm.showName"))}</span></label><span class="small dim num" id="mmCnt"></span></div>
      <p class="hint">${esc(t("mm.moderated"))}</p>
      <p class="form-err" id="mmErr" role="alert"></p>
      <div class="btn-row"><button class="btn" type="submit">${esc(t("mm.submit"))}</button></div></form>`;
  if (!WB.me) return `<p class="small muted mm-login">${esc(t("mm.membersOnly"))} <a href="pieslegties.html?next=${encodeURIComponent("memorials.html#m-" + m.slug)}">${esc(t("nav.login"))}</a></p>`;
  return "";
}

function route(){
  const m = location.hash.match(/^#m-([a-z0-9-]{1,64})$/);
  if (m) renderDetail(m[1]); else renderList();
}

async function boot(){
  app.innerHTML = `<p class="muted mm-loading">${esc(t("mm.loading"))}</p>`;
  await WB.session();
  try { D = await WB.req("/memorials"); }
  catch (e) { app.innerHTML = `<div class="empty"><p>${esc(WB.errMsg(e))}</p></div>`; return; }
  addEventListener("hashchange", route);
  route();
}
document.addEventListener("DOMContentLoaded", boot);
})();
