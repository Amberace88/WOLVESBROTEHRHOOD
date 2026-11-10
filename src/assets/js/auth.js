/* WBMC — pieteikšanās: ielūguma reģistrācija, MFA, paroles atjaunošana ar administratora kodu */
(function(){
const { $, $$, t } = WB;
const Q = new URLSearchParams(location.search);
const next = () => { const n = Q.get("next") || ""; return /^[\w./?=&#%-]*$/.test(n) && !n.includes("//") && n ? n : null; };
const go = status => { location.href = next() || (status === "active" ? "sazina.html" : "profils.html"); };

const tabs = $$('[role="tab"]');
const show = name => {
  tabs.forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
  $$(".auth-pane").forEach(p => p.hidden = p.id !== "p-" + name);
  history.replaceState(null, "", name === "login" ? location.pathname + location.search : "#" + name);
};
tabs.forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
if (/^#(register|reset)$/.test(location.hash)) show(location.hash.slice(1));
if (Q.get("invite")) { show("register"); $('#registerForm [name=invite]').value = Q.get("invite"); }

WB.session().then(me => { if (me) go(me.status); });

/* botu aizsardzība (Cloudflare Turnstile) — tikai ja serverī iestatītas atslēgas */
const human = {};
WB.req("/config").then(c => {
  if (!c || !c.turnstile) return;
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
  s.onload = () => ["loginForm", "registerForm"].forEach(id => {
    const f = $("#" + id), box = document.createElement("div"); box.className = "ts-box";
    f.querySelector(".form-err").before(box);
    human[id] = window.turnstile.render(box, { sitekey: c.turnstile, theme: "dark", language: document.documentElement.lang || "auto" });
  });
  document.head.appendChild(s);
}).catch(() => {});
const token = id => (human[id] !== undefined && window.turnstile ? window.turnstile.getResponse(human[id]) : undefined);
const resetHuman = id => { if (human[id] !== undefined && window.turnstile) window.turnstile.reset(human[id]); };

const busy = (f, on) => { const b = f.querySelector("button.btn"); b.disabled = on; b.classList.toggle("dis", on); };
const error = (f, e) => { f.querySelector(".form-err").textContent = e ? WB.errMsg(e) : ""; };
async function submit(f, fn){
  error(f, null);
  if (!f.reportValidity()) return;
  busy(f, true);
  try { await fn(new FormData(f)); } catch (e) { error(f, e); } finally { busy(f, false); }
}

$("#loginForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, async d => {
  let r;
  try { r = await WB.req("/auth/login", { body: { email: d.get("email"), password: d.get("password"), turnstile: token("loginForm") } }); }
  finally { resetHuman("loginForm"); }
  if (r.mfa) { e.target.hidden = true; $("#mfaForm").hidden = false; $('#mfaForm [name=code]').focus(); return; }
  go(r.status);
}); });
$("#mfaForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, async d => {
  const rec = (d.get("recovery") || "").trim();
  const r = await WB.req("/auth/mfa", { body: rec ? { recovery: rec } : { code: d.get("code") } });
  go(r.status);
}).catch(() => {}); });
$("#registerForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, async d => {
  let r;
  try { r = await WB.req("/auth/register", { body: { invite: d.get("invite"), name: d.get("name"), email: d.get("email"), password: d.get("password"), turnstile: token("registerForm") } }); }
  finally { resetHuman("registerForm"); }
  go(r.status);
}); });
$("#resetForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, async d => {
  await WB.req("/auth/reset", { body: { code: d.get("code"), password: d.get("password") } });
  WB.toast(t("auth.resetDone")); e.target.reset(); show("login");
}); });
})();
