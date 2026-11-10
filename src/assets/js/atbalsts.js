/* WBMC — Atbalsts: saņēmējs, mērķi (bez summām), bankas rekvizīti ar kopēšanu un EPC/SEPA QR (EPC069-12).
   Tiešsaistes maksājumi šajā vietnē netiek pieņemti; karšu dati netiek prasīti. */
(function(){
const { $, $$, esc, t, L: TL } = WB;
const D = window.DONATE || { goals: [] }, C = window.CLUB || {}, LG = C.legal || {};
const EMAIL = C.email || "wolvesmc@inbox.lv";
const iban = String(D.iban || "").replace(/\s+/g, "");
const ibanPretty = iban.replace(/(.{4})/g, "$1 ").trim();
const goalSel = $("#spGoal"), amountIn = $("#spAmount");

$$("a[data-mail]").forEach(a => { a.href = `mailto:${EMAIL}?subject=${encodeURIComponent(t(a.dataset.mail))}`; });

/* ---------- saņēmējs ---------- */
$("#spRecipient").innerHTML = `<b>${esc(D.recipient || LG.name || "")}</b>${LG.regNo ? `<span>${esc(t("foot.reg"))} ${esc(LG.regNo)}</span>` : ""}${LG.address ? `<span>${esc(LG.address)}</span>` : ""}`;

/* ---------- mērķi: vienkārši apraksti ---------- */
$("#spGoals").innerHTML = D.goals.map(g => `<li><div><h3>${esc(TL(g.name))}</h3><p>${esc(TL(g.text))}</p></div><button type="button" class="link-btn" data-goal="${esc(g.id)}">${esc(t("cm.sup.pickGoal"))}</button></li>`).join("")
  + `<li><div><h3>${esc(t("cm.sup.general"))}</h3><p>${esc(t("cm.sup.generalText"))}</p></div><button type="button" class="link-btn" data-goal="club">${esc(t("cm.sup.pickGoal"))}</button></li>`;
goalSel.innerHTML = D.goals.map(g => `<option value="${esc(g.id)}">${esc(TL(g.name))}</option>`).join("") + `<option value="club">${esc(t("cm.sup.general"))}</option>`;
const q = new URLSearchParams(location.search).get("goal");
if (q && [...goalSel.options].some(o => o.value === q)) goalSel.value = q;
$("#spGoals").addEventListener("click", e => {
  const b = e.target.closest("[data-goal]"); if (!b) return;
  goalSel.value = b.dataset.goal; update();
  const card = $("#bank"); card.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
  setTimeout(() => goalSel.focus({ preventScroll: true }), 400);
});

/* ---------- maksājuma mērķis (latviski — vienots kasierim) un summa ---------- */
const purpose = () => {
  const g = D.goals.find(x => x.id === goalSel.value);
  /* SEPA rakstzīmju kopai droša defise (nevis domuzīme) */
  return `Ziedojums WBMC - ${g ? (g.name.lv || TL(g.name)) : "kluba darbība"}`.slice(0, 140);
};
const parseAmount = () => {
  const s = amountIn.value.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return { v: null };
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return { err: t("cm.sup.amountErr") };
  const v = +s; if (v < 0.01 || v > 999999999.99) return { err: t("cm.sup.amountErr") };
  return { v };
};
/* EPC069-12 v002: BCD · 002 · 1 (UTF-8) · SCT · BIC · vārds · IBAN · summa (nav obligāta) · mērķa kods · strukturēta atsauce · brīvs teksts */
const epc = amount => ["BCD", "002", "1", "SCT", D.bic || "", (D.recipient || "").slice(0, 70), iban, amount ? "EUR" + amount.toFixed(2) : "", "", "", purpose()].join("\n");

const eurFmt = n => new Intl.NumberFormat(WB.locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
const copyBtn = (label, value) => `<button type="button" class="sp-copy" data-copy="${esc(value)}" aria-label="${esc(t("cm.sup.copyX", { x: label }))}">${esc(t("cm.sup.copy"))}</button>`;
function fields(amount){
  const rows = [
    [t("cm.sup.fRecipient"), D.recipient, D.recipient],
    ["IBAN", ibanPretty, iban, "mono"],
    ["SWIFT / BIC", D.bic, D.bic, "mono"],
    [t("cm.sup.fBank"), D.bank, D.bank],
    [t("cm.sup.fBankAddr"), D.bankAddress, D.bankAddress],
    ...(amount ? [[t("cm.sup.amount"), eurFmt(amount), amount.toFixed(2).replace(".", ","), "num"]] : []),
    [t("cm.sup.fPurpose"), purpose(), purpose()]
  ].filter(r => r[1]);
  $("#spFields").innerHTML = rows.map(([k, v, c, cls]) => `<div><dt>${esc(k)}</dt><dd><span class="${cls || ""}">${esc(v)}</span>${copyBtn(k, c)}</dd></div>`).join("");
}

function drawQR(amount){
  const box = $("#spQr");
  const draw = () => {
    try {
      if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
      const qr = qrcode(0, "M"); qr.addData(epc(amount), "Byte"); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
      const svg = box.querySelector("svg"); if (svg) { svg.setAttribute("aria-hidden", "true"); svg.removeAttribute("width"); svg.removeAttribute("height"); }
    } catch (e) { box.innerHTML = `<p class="small">${esc(t("cm.sup.qrFail"))}</p>`; }
  };
  if (window.qrcode) draw(); else addEventListener("load", draw, { once: true });
}
function update(){
  const a = parseAmount();
  $("#spErr").textContent = a.err || "";
  amountIn.setAttribute("aria-invalid", a.err ? "true" : "false");
  fields(a.v); drawQR(a.v);
}
goalSel.addEventListener("change", update);
let tm; amountIn.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(update, 180); });
$("#spForm").addEventListener("submit", e => { e.preventDefault(); update(); });

/* ---------- kopēšana ---------- */
async function copy(text){
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (x) {} ta.remove(); return ok;
  }
}
$("#spFields").addEventListener("click", async e => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  if (await copy(b.dataset.copy)) { b.textContent = t("cm.sup.copied"); b.classList.add("ok"); WB.toast(t("cm.sup.copiedX", { x: b.closest("div").querySelector("dt").textContent })); setTimeout(() => { b.textContent = t("cm.sup.copy"); b.classList.remove("ok"); }, 1600); }
  else WB.toast(t("cm.sup.copyFail"), true);
});

/* ---------- rekvizītu apstiprinājums (tikai pēc administratora atzīmes un ja IBAN sakrīt) ---------- */
const verify = $("#spVerify");
const notVerified = () => { verify.className = "sp-verify"; verify.innerHTML = `${esc(t("cm.sup.checkFirst"))} <a href="mailto:${EMAIL}?subject=${encodeURIComponent(t("cm.sup.contactSubject"))}">${EMAIL}</a>`; };
notVerified();
WB.req("/support").then(j => {
  if (j && j.bankVerified && j.iban === iban) {
    verify.className = "sp-verify ok";
    verify.innerHTML = `<span class="badge ok">${esc(t("cm.sup.verifiedBadge"))}</span> ${esc(t("cm.sup.verified", { date: WB.dateLong(WB.parseISO(j.bankVerified)) }))}`;
  }
}).catch(() => {});

update();
})();
