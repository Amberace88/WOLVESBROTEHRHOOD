/* WBMC — konts: statuss, MFA (TOTP) iestatīšana, rezerves kodi, sesijas, paroles maiņa */
(function(){
const { $, esc, t } = WB;
const fmt = ts => ts ? new Date(ts).toLocaleString(WB.locale, { dateStyle: "medium", timeStyle: "short" }) : "—";
const uaShort = ua => { if (!ua) return "—"; const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser"; const o = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : ""; return [b, o].filter(Boolean).join(" · "); };

async function boot(){
  const me = await WB.session(true);
  if (!me) { location.href = "pieslegties.html?next=profils.html"; return; }
  $("#accLead").textContent = `${me.name} · ${me.roleName || me.role}`;
  const st = $("#statusBox");
  if (me.status === "pending") { st.hidden = false; st.innerHTML = `<h2>${esc(t("gate.pendingTitle"))}</h2><p class="muted">${esc(t("gate.pendingText"))}</p>`; }
  else if (me.mfaRequired && !me.mfaEnabled) { st.hidden = false; st.classList.add("warn-box"); st.innerHTML = `<h2>${esc(t("mfa.requiredTitle"))}</h2><p class="muted">${esc(t("mfa.requiredText"))}</p>`; }
  mfa(me); sessions();
}

function mfa(me){
  const box = $("#mfaBox");
  if (me.mfaEnabled) {
    box.innerHTML = `<p><span class="badge ok">${esc(t("mfa.on"))}</span></p><div class="btn-row"><button class="btn ghost small" id="regen">${esc(t("mfa.regen"))}</button><button class="link-btn" id="disableReq">${esc(t("mfa.disableReq"))}</button></div>`;
    $("#regen").onclick = async () => {
      const code = await askCode(t("mfa.regen")); if (!code) return;
      try { const r = await WB.req("/me/mfa/recovery", { body: { code } }); showCodes(r.recovery); } catch (e) { WB.toast(WB.errMsg(e), true); }
    };
    $("#disableReq").onclick = async () => {
      const d = await WB.prompt(t("mfa.disableReq"), `<p class="muted">${esc(t("mfa.disableText"))}</p><label class="field"><span>${esc(t("mfa.code"))}</span><input name="code" inputmode="numeric" maxlength="7"></label><label class="field"><span>${esc(t("mfa.reason"))}</span><textarea name="reason" maxlength="300"></textarea></label>`, t("mfa.sendReq"));
      if (!d) return;
      try { await WB.req("/me/mfa/disable-request", { body: d }); WB.toast(t("mfa.reqSent")); } catch (e) { WB.toast(WB.errMsg(e), true); }
    };
    return;
  }
  box.innerHTML = `<p><span class="badge warn">${esc(t("mfa.off"))}</span></p><button class="btn small" id="mfaStart">${esc(t("mfa.start"))}</button>`;
  $("#mfaStart").onclick = async () => {
    let s; try { s = await WB.req("/me/mfa/setup", { body: {} }); } catch (e) { return WB.toast(WB.errMsg(e), true); }
    let qr = "";
    try { const q = qrcode(0, "M"); q.addData(s.uri); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } catch (e) {}
    box.innerHTML = `<ol class="mfa-steps">
      <li>${esc(t("mfa.step1"))}</li>
      <li>${esc(t("mfa.step2"))}<div class="mfa-qr" aria-label="QR">${qr}</div><p class="small muted">${esc(t("mfa.manual"))} <code class="secret">${esc(s.secret.replace(/(.{4})/g, "$1 ").trim())}</code></p></li>
      <li>${esc(t("mfa.step3"))}<form class="form inline-form" id="mfaEnable"><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required aria-label="${esc(t("mfa.code"))}"><button class="btn small">${esc(t("mfa.enable"))}</button></form><p class="form-err" role="alert"></p></li></ol>`;
    $("#mfaEnable").addEventListener("submit", async e => {
      e.preventDefault();
      try { const r = await WB.req("/me/mfa/enable", { body: { code: e.target.code.value } }); await WB.session(true); showCodes(r.recovery); mfa(WB.me); }
      catch (x) { box.querySelector(".form-err").textContent = WB.errMsg(x); }
    });
  };
}
function showCodes(codes){
  WB.modal({ title: t("mfa.codesTitle"), body: `<p class="muted">${esc(t("mfa.codesText"))}</p><ol class="codes">${codes.map(c => `<li><code>${esc(c)}</code></li>`).join("")}</ol><button class="btn ghost small" id="copyCodes">${esc(t("btn.copy"))}</button>`,
    actions: [{ label: t("mfa.codesSaved"), value: "ok", primary: true }],
    onOpen: d => d.querySelector("#copyCodes").addEventListener("click", e => { e.preventDefault(); navigator.clipboard.writeText(codes.join("\n")).then(() => WB.toast(t("btn.copied"))); }) });
}
function askCode(title){
  return WB.prompt(title, `<label class="field"><span>${esc(t("mfa.code"))}</span><input name="code" inputmode="numeric" maxlength="7"></label>`, t("mfa.confirm")).then(d => d && d.code);
}
async function sessions(){
  try {
    const r = await WB.req("/me/sessions");
    $("#sessions").innerHTML = r.sessions.map(s => `<li class="session"><div><b>${esc(uaShort(s.ua))}</b>${s.current ? ` <span class="badge solid">${esc(t("acc.thisDevice"))}</span>` : ""}<br><span class="small muted">${esc(t("acc.lastSeen"))}: ${esc(fmt(s.lastSeen))} · IP ${esc(s.ip || "—")}</span></div>${s.current ? "" : `<button class="btn ghost small" data-revoke="${esc(s.id)}">${esc(t("acc.revoke"))}</button>`}</li>`).join("");
  } catch (e) { $("#sessions").innerHTML = `<li class="muted">${esc(WB.errMsg(e))}</li>`; }
}
$("#sessions").addEventListener("click", async e => { const b = e.target.closest("[data-revoke]"); if (!b) return; await WB.req(`/me/sessions/${b.dataset.revoke}/revoke`, { body: {} }).catch(x => WB.toast(WB.errMsg(x), true)); sessions(); });
$("#revokeOthers").addEventListener("click", async () => { if (!(await WB.confirm(t("acc.revokeOthers"), t("acc.revokeOthersText"), t("acc.revokeOthers")))) return; await WB.req("/me/sessions/revoke-others", { body: {} }); WB.toast(t("acc.revoked")); sessions(); });
$("#pwForm").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target; f.querySelector(".form-err").textContent = "";
  if (!f.reportValidity()) return;
  try { await WB.req("/me/password", { body: { current: f.current.value, next: f.next.value } }); f.reset(); WB.toast(t("acc.pwChanged")); sessions(); }
  catch (x) { f.querySelector(".form-err").textContent = WB.errMsg(x); }
});
$("#logoutBtn").addEventListener("click", WB.logout);
boot();
})();
