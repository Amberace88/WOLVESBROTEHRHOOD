/* WOLVES BROTHERHOOD MC — ziedojumi */
(function(){
const { $, $$, esc, t, L: TL } = WB;
const D = window.DONATE || { goals: [], tiers: [], supporters: [] };
const C = window.CLUB || {}, LG = C.legal || {};
const eur = WB.eur;
const reqText = `${LG.name}, ${t("foot.reg")} ${LG.regNo}, ${LG.address}`;
$("#legalLine").textContent = t("don.recipient") + ": " + reqText + ".";

/* ---------- tanks (jerrycans) ---------- */
const can = (pct, i) => `<svg viewBox="0 0 100 130" aria-hidden="true">
    <defs><clipPath id="cc${i}"><path d="M14 22 H70 L86 38 V122 Q86 126 82 126 H18 Q14 126 14 122 Z"/></clipPath></defs>
    <path d="M30 6 H62 Q66 6 66 10 V20 H58 V14 H34 V20 H26 V10 Q26 6 30 6Z" fill="#1c1c1b" stroke="#A3A098" stroke-width="2"/>
    <rect x="72" y="14" width="10" height="14" rx="2" fill="#1c1c1b" stroke="#A3A098" stroke-width="2" transform="rotate(35 77 21)"/>
    <g clip-path="url(#cc${i})"><rect width="100" height="130" fill="#0b0b0b"/>
      <g class="level" style="transform:translateY(${118 - 104 * pct}px)"><path class="wave" d="M0 4 Q10 0 20 4 T40 4 T60 4 T80 4 T100 4 T120 4 T140 4 V140 H0Z" fill="#ECE8DF" opacity=".92"/></g>
      <path d="M22 40 L78 104 M78 40 L22 104" stroke="rgba(0,0,0,.35)" stroke-width="6"/></g>
    <path d="M14 22 H70 L86 38 V122 Q86 126 82 126 H18 Q14 126 14 122 Z" fill="none" stroke="#ECE8DF" stroke-width="3"/></svg>`;
let goalId = (D.goals[0] || {}).id;
const pctOf = g => g.target ? Math.min(1, g.raised / g.target) : 0;
$("#tanks").innerHTML = D.goals.map((g, i) => `<button type="button" class="tank ${g.id === goalId ? "on" : ""}" data-g="${esc(g.id)}" aria-pressed="${g.id === goalId}">
    ${can(0, i)}<div><h3>${esc(TL(g.name))}</h3><p>${esc(TL(g.text))}</p>
    <div class="nums">${eur(g.raised)} <span>${esc(t("don.of"))} ${eur(g.target)}</span></div>
    <div class="muted" style="font-size:.92rem">${g.raised > 0 ? esc(t("don.filled", { n: Math.round(pctOf(g) * 100) })) : esc(t("don.empty"))}</div></div></button>`).join("");
const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect();
  requestAnimationFrame(() => D.goals.forEach((g, i) => { const lv = $$("#tanks .level")[i]; if (lv) lv.style.transform = `translateY(${118 - 104 * pctOf(g)}px)`; })); } }, { threshold: .3 });
io.observe($("#tanks"));

const sel = $("#goalSel");
sel.innerHTML = D.goals.map(g => `<option value="${esc(g.id)}">${esc(TL(g.name))}</option>`).join("") + `<option value="club">${esc(t("don.growth"))}</option>`;
const syncTanks = () => $$("#tanks .tank").forEach(x => { const on = x.dataset.g === goalId; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
$("#tanks").addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (!b) return; goalId = sel.value = b.dataset.g; syncTanks(); update(); });
sel.addEventListener("change", () => { goalId = sel.value; syncTanks(); update(); });

/* ---------- form ---------- */
let mode = "once", tier = 1;
const f = $("#donateForm");
const amount = () => {
  if (mode === "monthly") return (D.tiers[tier] || {}).price || 0;
  const c = +f.custom.value; if (c >= 2) return c;
  const r = f.querySelector('input[name="amt"]:checked'); return r ? +r.value : 0;
};
const goalName = () => { const g = D.goals.find(x => x.id === sel.value); return g ? TL(g.name) : t("don.growth"); };
function update(){
  const a = amount();
  $("#donateBtn").textContent = mode === "monthly" ? t("don.giveMonthly", { a: eur(a) }) : t("don.giveOnce", { a: eur(a) });
  $("#fuelNote").innerHTML = t("don.liters", { n: `<b>${Math.round(a / 1.7)}</b>`, goal: esc(goalName()) });
}
f.addEventListener("input", e => { if (e.target.name === "custom" && e.target.value) f.querySelectorAll('input[name="amt"]').forEach(r => r.checked = false); if (e.target.name === "amt") f.custom.value = ""; update(); });
$$(".seg button").forEach(b => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  $$(".seg button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
  $("#onceBox").hidden = mode !== "once"; $("#monthlyBox").hidden = mode !== "monthly"; $("#payPanel").hidden = true; update();
}));
$("#tiers").innerHTML = D.tiers.map((x, i) => `<button type="button" class="tier ${i === tier ? "on" : ""}" data-t="${i}"><b>${esc(t("don.tier." + x.id))}</b><span class="p">${eur(x.price)}<small class="muted" style="font-size:.9rem">${esc(t("don.perMonth"))}</small></span><ul>${t("don.tier." + x.id + ".perks").split("|").map(p => `<li>${esc(p)}</li>`).join("")}</ul></button>`).join("");
$("#tiers").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; tier = +b.dataset.t; $$("#tiers .tier").forEach(x => x.classList.toggle("on", x === b)); update(); });

const copyBtn = v => `<button type="button" class="copy" data-copy="${esc(v)}">${esc(t("don.copy"))}</button>`;
function bankPanel(a){
  const purpose = (mode === "monthly" ? t("don.purposeMonthly") : t("don.purposeOnce")) + ": " + goalName() + (f.who.value ? " — " + f.who.value : "");
  const p = $("#payPanel"); p.hidden = false;
  if (!D.iban) {
    p.innerHTML = `<b>${esc(t("don.ibanSoon"))}</b><span class="muted">${esc(t("don.ibanSoon2"))} <a href="mailto:${esc(C.email)}?subject=${encodeURIComponent(purpose)}">${esc(C.email)}</a></span>`;
    return;
  }
  p.innerHTML = `
    <div class="row"><span>${esc(t("don.recipient"))}</span><b>${esc(LG.name)}${copyBtn(LG.name)}</b></div>
    <div class="row"><span>${esc(t("foot.reg"))}</span><b>${esc(LG.regNo)}</b></div>
    <div class="row"><span>IBAN</span><b>${esc(D.iban)}${copyBtn(D.iban)}</b></div>
    ${D.bank ? `<div class="row"><span>${esc(t("don.bank"))}</span><b>${esc(D.bank)}${D.bic ? " · " + esc(D.bic) : ""}</b></div>` : ""}
    <div class="row"><span>${esc(t("don.amount"))}</span><b>${eur(a)}</b></div>
    <div class="row"><span>${esc(t("don.purpose"))}</span><b>${esc(purpose)}${copyBtn(purpose)}</b></div>
    ${mode === "monthly" ? `<span class="muted">${esc(t("don.standing"))}</span>` : `<div class="qr" id="qr"></div><span class="muted" style="text-align:center">${esc(t("don.scan"))}</span>`}`;
  if (mode !== "monthly") {
    const epc = ["BCD","002","1","SCT", D.bic || "", (LG.name || "").slice(0,70), D.iban.replace(/\s/g,""), "EUR" + a.toFixed(2), "", "", purpose.slice(0,140)].join("\n");
    const draw = () => { qrcode.stringToBytes = qrcode.stringToBytesFuncs ? qrcode.stringToBytesFuncs["UTF-8"] : qrcode.stringToBytes; const q = qrcode(0, "M"); q.addData(epc, "Byte"); q.make(); $("#qr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 0 }); };
    if (window.qrcode) draw(); else { const s = document.createElement("script"); s.src = WB.base + "assets/vendor/qrcode.js"; s.onload = draw; document.head.appendChild(s); }
  }
}
$("#payPanel").addEventListener("click", e => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = t("don.copied"); setTimeout(() => b.textContent = t("don.copy"), 1500); });
});
f.addEventListener("submit", e => {
  e.preventDefault();
  const a = amount(); if (!a) return;
  const link = mode === "monthly" ? D.stripeMonthly : D.stripeLink;
  if (link) { const u = new URL(link); u.searchParams.set("client_reference_id", (sel.value || "club") + "-" + mode); window.open(u, "_blank", "noopener"); }
  bankPanel(a);
  if (D.paypal) $("#payPanel").insertAdjacentHTML("beforeend", `<a class="btn ghost small" href="${esc(D.paypal)}/${a}EUR" target="_blank" rel="noopener">PayPal</a>`);
});
update();

$("#wall").innerHTML = D.supporters.length
  ? `<h3>${esc(t("don.wall"))}</h3><ul>${D.supporters.map(s => `<li>${esc(s.name)}<i>${esc(t("don.tier." + s.tier))}</i></li>`).join("")}</ul>`
  : `<p class="muted">${esc(t("don.wallEmpty"))}</p>`;
})();
