/* WBMC — Partneri: publicētie partneri (tikai ar reģistrētu piekrišanu zīmola un logo lietošanai), grupēti pa kategorijām */
(function(){
const { $, $$, esc, t, L: TL } = WB;
$$("a[data-mail]").forEach(a => { a.href = `mailto:wolvesmc@inbox.lv?subject=${encodeURIComponent(t(a.dataset.mail))}`; });
const app = $("#app");
const ORDER = ["sponsor", "partner", "service", "media", "community"];
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };

async function load(){
  let list;
  try { list = (await WB.req("/partners")).partners || []; }
  catch (e) {
    app.innerHTML = `<div class="empty"><p>${esc(t("cm.loadFail"))}</p><button class="btn ghost small" id="retry">${esc(t("cm.retry"))}</button></div>`;
    $("#retry").onclick = () => { app.innerHTML = `<p class="muted cm-loading">${esc(t("cm.loading"))}</p>`; load(); };
    return;
  }
  if (!list.length) {
    app.innerHTML = `<div class="cm-empty"><h2>${esc(t("cm.partners.emptyTitle"))}</h2><p>${esc(t("cm.partners.emptyText"))}</p></div>`;
    return;
  }
  const groups = ORDER.map(c => [c, list.filter(p => p.category === c)]).filter(([, a]) => a.length);
  app.innerHTML = groups.map(([c, arr], gi) => `<section class="pt-group" aria-labelledby="pt-${c}">
      <h2 id="pt-${c}" data-reveal>${esc(t("cm.pcat." + c))}</h2>
      <ul class="rows pt-list">${arr.map(p => {
        const links = [p.url ? { label: host(p.url), url: p.url } : null, ...(p.links || [])].filter(Boolean);
        return `<li class="pt-row">
          <span class="pt-logo">${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="${gi ? "lazy" : "eager"}">` : `<b>${esc(p.name)}</b>`}</span>
          <div class="pt-body"><h3>${esc(p.name)}</h3>${TL(p.description) ? `<p>${esc(TL(p.description))}</p>` : ""}
            ${links.length ? `<ul class="pt-links">${links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}${WB.icon("ext")}</a></li>`).join("")}</ul>` : ""}</div>
        </li>`; }).join("")}</ul></section>`).join("");
  WB.initReveal(app);
}
load();
})();
