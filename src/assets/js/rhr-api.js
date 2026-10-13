/* WOLVES BROTHERHOOD MC — Riders Help Riders klients
   Live režīms: Cloudflare Worker API (CLUB.api). Demo režīms: dati tikai šajā pārlūkā. */
(function(){
const API = (window.CLUB && CLUB.api || "").replace(/\/$/, "");
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => Date.now();
const CATS = [
  { id: "roadhelp", icon: "wrench" }, { id: "tech", icon: "gear" }, { id: "routes", icon: "route" },
  { id: "gear", icon: "jacket" }, { id: "market", icon: "swap" }, { id: "general", icon: "fire" }
];
const ROOMS = [
  { id: "club", minRole: "member" }, { id: "rides", minRole: "member" }, { id: "officers", minRole: "officer" }
];
const RANK = { rider: 1, member: 2, officer: 3 };
const can = (u, role) => !!u && RANK[u.role] >= RANK[role];

/* ---------------- LIVE ---------------- */
let token = LS.get("wb-token", null);
async function req(path, opt = {}){
  const r = await fetch(API + path, { ...opt, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...(opt.headers || {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
  return j;
}
const live = {
  async init(){ if (!token) return null; try { return (await req("/me")).user; } catch (e) { token = null; LS.set("wb-token", null); return null; } },
  async login(email, password){ const j = await req("/auth/login", { method: "POST", body: { email, password } }); token = j.token; LS.set("wb-token", token); return j.user; },
  async register(d){ const j = await req("/auth/register", { method: "POST", body: d }); token = j.token; LS.set("wb-token", token); return j.user; },
  async logout(){ try { await req("/auth/logout", { method: "POST" }); } catch (e) {} token = null; LS.set("wb-token", null); },
  threads: cat => req("/forum/threads?cat=" + encodeURIComponent(cat)).then(j => j.threads),
  thread: id => req("/forum/threads/" + id),
  newThread: d => req("/forum/threads", { method: "POST", body: d }),
  reply: (id, body) => req(`/forum/threads/${id}/posts`, { method: "POST", body: { body } }),
  solve: id => req(`/forum/threads/${id}/solve`, { method: "POST" }),
  like: pid => req(`/forum/posts/${pid}/like`, { method: "POST" }),
  messages: room => req(`/chat/${room}/messages`).then(j => j.messages),
  send: (room, body) => req(`/chat/${room}/messages`, { method: "POST", body: { body } }),
  subscribe(room, cb){
    let ws, closed = false, retry = 1000;
    const open = () => { ws = new WebSocket(WB.wsUrl(`/chat/${room}/ws?token=${encodeURIComponent(token)}`));
      ws.onmessage = m => { try { cb(JSON.parse(m.data)); } catch (e) {} };
      ws.onclose = () => { if (!closed) setTimeout(open, retry = Math.min(retry * 2, 15000)); }; ws.onopen = () => retry = 1000; };
    open(); return () => { closed = true; ws && ws.close(); };
  },
  sos: () => req("/sos").then(j => j.items),
  newSos: d => req("/sos", { method: "POST", body: d }),
  respond: id => req(`/sos/${id}/respond`, { method: "POST" }),
  resolveSos: id => req(`/sos/${id}/resolve`, { method: "POST" }),
  hazards: () => req("/hazards").then(j => j.items),
  newHazard: d => req("/hazards", { method: "POST", body: d }),
  helpers: () => req("/helpers").then(j => j.items),
  saveHelper: d => req("/helpers", { method: "POST", body: d }),
  invite: () => req("/admin/invites", { method: "POST", body: { role: "member" } })
};

/* ---------------- DEMO ---------------- */
const db = LS.get("wb-demo-db", null) || seed();
const save = () => LS.set("wb-demo-db", db);
function seed(){
  const h = 36e5, d = 864e5;
  const s = {
    users: { u1: { id: "u1", name: "Road Captain", role: "officer" }, u2: { id: "u2", name: "Vilks", role: "member" }, u3: { id: "u3", name: "Kaspars (Kuldīga)", role: "rider" }, u4: { id: "u4", name: "Bārda", role: "member" } },
    threads: [
      { id: "t1", cat: "roadhelp", title: { lv: "Pārdurta riepa uz A2 pie Siguldas — kas tuvumā?", en: "Puncture on the A2 near Sigulda — anyone close?", ru: "Прокол на A2 у Сигулды — кто рядом?" }, author: "u3", created: now() - 5 * h, lastAt: now() - 4 * h, solved: true },
      { id: "t2", cat: "tech", title: { lv: "Harley Softail 2018 — akumulators izlādējas ziemā", en: "2018 Softail — battery drains over winter", ru: "Softail 2018 — аккумулятор садится зимой" }, author: "u2", created: now() - 2 * d, lastAt: now() - 1 * d },
      { id: "t3", cat: "routes", title: { lv: "Labākie līkumi Latgalē? Plānojam maija braucienu", en: "Best curves in Latgale? Planning a May ride", ru: "Лучшие повороты в Латгалии? Планируем поездку в мае" }, author: "u1", created: now() - 6 * d, lastAt: now() - 3 * d },
      { id: "t4", cat: "market", title: { lv: "Maina: Givi bagāžnieks pret sānu somām", en: "Swap: Givi top rack for side bags", ru: "Обмен: багажник Givi на боковые сумки" }, author: "u4", created: now() - 3 * d, lastAt: now() - 3 * d },
      { id: "t5", cat: "gear", title: { lv: "Ziemas cimdi ar apsildi — pieredze?", en: "Heated winter gloves — experiences?", ru: "Зимние перчатки с подогревом — опыт?" }, author: "u3", created: now() - 9 * d, lastAt: now() - 8 * d }
    ],
    posts: [
      { id: "p1", thread: "t1", author: "u3", created: now() - 5 * h, likes: [], body: { lv: "Stāvu pie Siguldas pagrieziena, aizmugurē nagla. Ir kāds ar remkomplektu un kompresoru tuvumā?", en: "Standing at the Sigulda turn-off, nail in the rear. Anyone nearby with a plug kit and compressor?", ru: "Стою у поворота на Сигулду, гвоздь в заднем колесе. Есть кто рядом с ремкомплектом и компрессором?" } },
      { id: "p2", thread: "t1", author: "u2", created: now() - 4.7 * h, likes: ["u3"], body: { lv: "Esmu Inčukalnā, būšu pēc 15 min. Komplekts ir.", en: "I'm in Inčukalns, there in 15 min. Got the kit.", ru: "Я в Инчукалнсе, буду через 15 минут. Комплект есть." } },
      { id: "p3", thread: "t1", author: "u3", created: now() - 4 * h, likes: [], body: { lv: "Salāpīts, braucu tālāk. Paldies, brāli!", en: "Plugged, riding on. Thanks, brother!", ru: "Заклеили, еду дальше. Спасибо, брат!" } },
      { id: "p4", thread: "t2", author: "u2", created: now() - 2 * d, likes: [], body: { lv: "Pēc 3 nedēļām garāžā akumulators tukšs. Kas palīdz — uzturlādētājs vai atvienot?", en: "After 3 weeks in the garage the battery is flat. What works — a maintainer or disconnecting?", ru: "Через 3 недели в гараже аккумулятор пуст. Что лучше — поддерживающая зарядка или отключить?" } },
      { id: "p5", thread: "t2", author: "u1", created: now() - 1 * d, likes: ["u2", "u4"], body: { lv: "Uzturlādētājs (piem., Optimate) visu ziemu. Un pārbaudi noplūdes strāvu — virs 30 mA meklē vainīgo.", en: "A maintainer (e.g. Optimate) all winter. And check the parasitic draw — above 30 mA, hunt for the culprit.", ru: "Поддерживающее зарядное (например, Optimate) всю зиму. И проверь ток утечки — если выше 30 мА, ищи виновника." } },
      { id: "p6", thread: "t3", author: "u1", created: now() - 6 * d, likes: [], body: { lv: "Domājam par Krāslavu–Dagdu–Rāznu. Ieteikumi par ceļu segumu?", en: "Thinking Krāslava–Dagda–Rāzna. Any tips on road surfaces?", ru: "Думаем про Краславу–Дагду–Резну. Советы по покрытию дорог?" } },
      { id: "p7", thread: "t4", author: "u4", created: now() - 3 * d, likes: [], body: { lv: "Givi Monolock bagāžnieks, labā stāvoklī. Mainu pret mīkstajām sānu somām.", en: "Givi Monolock rack, good condition. Swapping for soft side bags.", ru: "Багажник Givi Monolock, в хорошем состоянии. Меняю на мягкие боковые сумки." } },
      { id: "p8", thread: "t5", author: "u3", created: now() - 9 * d, likes: [], body: { lv: "Kas brauc ar apsildāmiem cimdiem? Akumulatora vai pieslēgtie pie moča?", en: "Who rides with heated gloves? Battery ones or wired to the bike?", ru: "Кто ездит в перчатках с подогревом? На батарейках или от мотоцикла?" } }
    ],
    messages: { club: [
      { id: "m1", author: "u1", created: now() - 26 * h, body: { lv: "Sestdien sezonas noslēgums. Starts 11:00 no kluba mājām.", en: "Season closing on Saturday. Start 11:00 from the clubhouse.", ru: "В субботу закрытие сезона. Старт в 11:00 от клуба." } },
      { id: "m2", author: "u2", created: now() - 25 * h, body: { lv: "Būšu. Ņemšu līdzi kafiju.", en: "I'll be there. Bringing coffee.", ru: "Буду. Возьму кофе." } }
    ], rides: [
      { id: "m3", author: "u4", created: now() - 3 * h, body: { lv: "Kurš brauc uz Cēsīm? Varu paņemt pa ceļam Siguldā.", en: "Who's riding to Cēsis? I can pick you up in Sigulda.", ru: "Кто едет в Цесис? Могу подхватить в Сигулде." } }
    ], officers: [] },
    sos: [ { id: "s1", kind: "battery", note: { lv: "Nestartē pie Jūrmalas apļa, vajag kabeļus", en: "Won't start at the Jūrmala roundabout, need jump leads", ru: "Не заводится у Юрмальского круга, нужны провода" }, lat: 56.9465, lon: 23.9800, author: "u3", created: now() - 40 * 6e4, responders: ["u2"], resolved: false } ],
    hazards: [
      { id: "h1", kind: "gravel", note: { lv: "Grants pagriezienā pēc tilta", en: "Gravel in the bend after the bridge", ru: "Гравий в повороте после моста" }, lat: 57.2365, lon: 25.0302, by: "Vilks", created: now() - 2 * d },
      { id: "h2", kind: "roadworks", note: { lv: "Remontdarbi, luksofors, ~10 min", en: "Roadworks, traffic light, ~10 min", ru: "Ремонт, светофор, ~10 мин" }, lat: 56.6650, lon: 23.7400, by: "Bārda", created: now() - 1 * d },
      { id: "h3", kind: "oil", note: { lv: "Eļļa uz ceļa pie DUS izbrauktuves", en: "Oil on the road at the fuel station exit", ru: "Масло на дороге у выезда с заправки" }, lat: 56.9800, lon: 24.2400, by: "Road Captain", created: now() - 5 * h }
    ],
    helpers: [
      { id: "x1", name: "Vilks", city: "Inčukalns", lat: 57.098, lon: 24.686, offers: ["tools", "garage"], note: { lv: "Garāža ar pacēlāju, zvani jebkurā laikā", en: "Garage with a lift, call any time", ru: "Гараж с подъёмником, звони в любое время" } },
      { id: "x2", name: "Bārda", city: "Jelgava", lat: 56.651, lon: 23.72, offers: ["trailer", "bed"], note: { lv: "Piekabe vienam motociklam + gulta brālim", en: "Trailer for one bike + a bed for a brother", ru: "Прицеп на один мотоцикл + кровать для брата" } },
      { id: "x3", name: "Kaspars", city: "Kuldīga", lat: 56.968, lon: 21.968, offers: ["tools", "parts"], note: { lv: "Ķēdes, spuldzes, drošinātāji", en: "Chains, bulbs, fuses", ru: "Цепи, лампы, предохранители" } }
    ],
    me: null
  };
  LS.set("wb-demo-db", s); return s;
}
const bc = "BroadcastChannel" in window ? new BroadcastChannel("wb-demo") : null;
const nameOf = id => (db.users[id] || {}).name || "?";
const L = v => WB.L(v);
const demo = {
  async init(){ return db.me ? db.users[db.me] : null; },
  async login(email){ const u = Object.values(db.users).find(x => x.email === email.toLowerCase()); if (!u) throw new Error(WB.t("rhr.err.nouser")); db.me = u.id; save(); return u; },
  async register({ name, email, invite }){
    const id = uid(); const role = /^WOLF-OFFICER$/i.test(invite) ? "officer" : /^WOLF-/i.test(invite || "") ? "member" : "rider";
    db.users[id] = { id, name: name || email.split("@")[0], email: email.toLowerCase(), role }; db.me = id; save(); return db.users[id];
  },
  async logout(){ db.me = null; save(); },
  async threads(cat){
    return db.threads.filter(x => cat === "all" || x.cat === cat).sort((a, b) => b.lastAt - a.lastAt).map(x => ({ ...x, title: L(x.title), author: nameOf(x.author), replies: db.posts.filter(p => p.thread === x.id).length - 1 }));
  },
  async thread(id){
    const th = db.threads.find(x => x.id === id); if (!th) throw new Error("404");
    return { thread: { ...th, title: L(th.title), authorId: th.author, author: nameOf(th.author) },
      posts: db.posts.filter(p => p.thread === id).sort((a, b) => a.created - b.created).map(p => ({ ...p, body: L(p.body), authorName: nameOf(p.author), role: (db.users[p.author] || {}).role, likeCount: p.likes.length, liked: p.likes.includes(db.me) })) };
  },
  async newThread({ cat, title, body }){ const id = uid(); db.threads.push({ id, cat, title, author: db.me, created: now(), lastAt: now() }); db.posts.push({ id: uid(), thread: id, author: db.me, created: now(), likes: [], body }); save(); return { id }; },
  async reply(id, body){ db.posts.push({ id: uid(), thread: id, author: db.me, created: now(), likes: [], body }); db.threads.find(x => x.id === id).lastAt = now(); save(); },
  async solve(id){ const th = db.threads.find(x => x.id === id); th.solved = !th.solved; save(); },
  async like(pid){ const p = db.posts.find(x => x.id === pid); const i = p.likes.indexOf(db.me); i < 0 ? p.likes.push(db.me) : p.likes.splice(i, 1); save(); },
  async messages(room){ return (db.messages[room] || []).map(m => ({ ...m, body: L(m.body), authorName: nameOf(m.author), mine: m.author === db.me })); },
  async send(room, body){ const m = { id: uid(), author: db.me, created: now(), body }; (db.messages[room] = db.messages[room] || []).push(m); save(); const out = { ...m, authorName: nameOf(db.me), room }; bc && bc.postMessage(out); return out; },
  subscribe(room, cb){ if (!bc) return () => {}; const h = e => { if (e.data.room === room) cb({ ...e.data, mine: false }); }; bc.addEventListener("message", h); return () => bc.removeEventListener("message", h); },
  async sos(){ return db.sos.filter(s => !s.resolved || now() - s.created < 6 * 36e5).sort((a, b) => b.created - a.created).map(s => ({ ...s, note: L(s.note), authorName: nameOf(s.author), mine: s.author === db.me, responding: s.responders.includes(db.me) })); },
  async newSos(d){ db.sos.push({ id: uid(), ...d, author: db.me, created: now(), responders: [], resolved: false }); save(); },
  async respond(id){ const s = db.sos.find(x => x.id === id); const i = s.responders.indexOf(db.me); i < 0 ? s.responders.push(db.me) : s.responders.splice(i, 1); save(); },
  async resolveSos(id){ db.sos.find(x => x.id === id).resolved = true; save(); },
  async hazards(){ return db.hazards.filter(h => now() - h.created < 7 * 864e5).map(h => ({ ...h, note: L(h.note) })); },
  async newHazard(d){ db.hazards.push({ id: uid(), ...d, by: nameOf(db.me) || "Rider", created: now() }); save(); },
  async helpers(){ return db.helpers.map(h => ({ ...h, note: L(h.note) })); },
  async saveHelper(d){ const i = db.helpers.findIndex(h => h.uid === db.me); const rec = { id: uid(), uid: db.me, name: nameOf(db.me), ...d }; i < 0 ? db.helpers.push(rec) : db.helpers[i] = rec; save(); },
  async invite(){ return { code: "WOLF-" + Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase() }; }
};

/* ---------- izvēlas režīmu: ja API atbild — live, citādi demo ---------- */
let impl = demo, probed = null;
const probe = () => probed || (probed = (async () => {
  if (!API) return false;
  try { const r = await fetch(API + "/health", { cache: "no-store" }); const j = await r.json(); return r.ok && j.ok === true; } catch (e) { return false; }
})().then(ok => { impl = ok ? live : demo; window.RHR.mode = ok ? "live" : "demo"; return ok; }));
const R = window.RHR = { mode: "demo", CATS, ROOMS, can, probe };
for (const k of Object.keys(demo)) R[k] = async (...a) => { await probe(); return impl[k](...a); };
R.subscribe = (room, cb) => impl.subscribe(room, cb);
})();
