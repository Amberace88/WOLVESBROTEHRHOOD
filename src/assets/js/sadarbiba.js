/* WBMC — Sadarbība un reklāma: izvēlētie formāti → e-pasta pieprasījums (cenas un auditorija netiek publicētas) */
(function(){
const { $, $$, esc, t } = WB;
const EMAIL = "wolvesmc@inbox.lv";
const boxes = $$("#sdList .sd-pick input"), mail = $("#sdMail"), picked = $("#sdPicked");
const title = v => t(`cm.ad.${v}.title`);
function update(){
  const sel = boxes.filter(b => b.checked).map(b => b.value);
  boxes.forEach(b => b.closest(".sd-item").classList.toggle("on", b.checked));
  picked.innerHTML = sel.length ? `${esc(t("cm.ad.picked"))}: <b>${sel.map(v => esc(title(v))).join(", ")}</b>` : esc(t("cm.ad.pickHint"));
  const body = [
    t("cm.ad.mHello"), "",
    `${t("cm.ad.mFormats")}: ${sel.length ? sel.map(title).join(", ") : "—"}`,
    `${t("cm.ad.mCompany")}: `, `${t("cm.ad.mContact")}: `, `${t("cm.ad.mPeriod")}: `, `${t("cm.ad.mIdea")}: `, ""
  ].join("\n");
  mail.href = `mailto:${EMAIL}?subject=${encodeURIComponent(t("cm.ad.mSubject"))}&body=${encodeURIComponent(body)}`;
}
boxes.forEach(b => b.addEventListener("change", update));
update();
})();
