/* WOLVES BROTHERHOOD MC — kluba šaha galds
   Režīmi: pret datoru (4 līmeņi, Web Worker), divatā pie viena ekrāna, tiešsaistē ar brāli
   (Cloudflare Durable Object: servera pusē pārbaudīti gājieni, pulkstenis, Elo, skatītāji, revanšs). */
(function(){
const root = document.getElementById("chess");
if (!root || !window.WBChess) return;
const { t, esc } = WB;
const C = window.WBChess;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LS = { get(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const KEY = "wb-chess-v1";
const LEVELS = { 1: 600, 2: 1100, 3: 1600, 4: 2000 };
const TCS = [[0, 0], [3, 2], [5, 3], [10, 5], [15, 10], [30, 0]];
const tcLabel = tc => tc[0] ? `${tc[0]}+${tc[1]}` : "∞";
const other = c => c === "w" ? "b" : "w";
const now = () => performance.now();

/* ---------------- figūras (oriģināls zīmējums; zirdziņš — vilka galva) ---------------- */
const base = (x0, x1) => `<path d="M${x0 + 1.5} 39.5h${x1 - x0 - 3}a1.5 1.5 0 0 0 1.5-1.5v-1.2a2.8 2.8 0 0 0-2.8-2.8H${x0 + 2.8}A2.8 2.8 0 0 0 ${x0} 36.8V38a1.5 1.5 0 0 0 1.5 1.5z"/>`;
const SHAPES = {
  p: `<g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.35;stroke-linejoin:round">${base(12, 33)}<path d="M22.5 8a5 5 0 0 0-3.1 8.9C17.3 18 16 19.8 16 22h4c-.6 4.6-3.3 8.3-6.6 11.2h18.2c-3.3-2.9-6-6.6-6.6-11.2h4c0-2.2-1.3-4-3.4-5.1A5 5 0 0 0 22.5 8z"/></g>`,
  r: `<g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.35;stroke-linejoin:round">${base(10, 35)}<path d="M12.5 9h4v3.5h4V9h4v3.5h4V9h4v6.5l-3.5 3v10.5l3.5 3.5V34h-20v-1.5l3.5-3.5V18.5l-3.5-3z"/></g><path style="fill:none;stroke:var(--pd);stroke-width:1.15;stroke-linecap:round" d="M16 18.5h13M16 29h13"/>`,
  b: `<g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.35;stroke-linejoin:round">${base(10, 35)}<circle cx="22.5" cy="7.6" r="2.6"/><path d="M22.5 10.6c-4.6 3.4-7.2 7.3-7.2 11.2 0 3 1.6 5 3.6 6.2L16.6 34h11.8l-2.3-6c2-1.2 3.6-3.2 3.6-6.2 0-3.9-2.6-7.8-7.2-11.2z"/></g><path style="fill:none;stroke:var(--pd);stroke-width:1.15;stroke-linecap:round" d="M25.2 15.3l-4.6 5.6M18.6 29.6h7.8"/>`,
  q: `<g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.35;stroke-linejoin:round">${base(10, 35)}<path d="M12.5 34L9.5 15l4.5 9 1.8-11.5 3.8 9.8 2.9-11.5 2.9 11.5 3.8-9.8L31 24l4.5-9-3 19z"/><circle cx="9.5" cy="13.3" r="2.2"/><circle cx="15.8" cy="10.8" r="2.2"/><circle cx="22.5" cy="9" r="2.2"/><circle cx="29.2" cy="10.8" r="2.2"/><circle cx="35.5" cy="13.3" r="2.2"/></g><path style="fill:none;stroke:var(--pd);stroke-width:1.15;stroke-linecap:round" d="M13.6 29.2c6-1.7 11.8-1.7 17.8 0"/>`,
  k: `<g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.35;stroke-linejoin:round">${base(10, 35)}<path d="M22.5 13c-2 0-3.4 1.9-3.4 4.1 0 1.2.4 2.2.9 3-3.8-2.6-10.5-2.3-10.5 3.6 0 3.7 3 6.8 5.6 8.6V34h14.8v-1.7c2.6-1.8 5.6-4.9 5.6-8.6 0-5.9-6.7-6.2-10.5-3.6.5-.8.9-1.8.9-3 0-2.2-1.4-4.1-3.4-4.1z"/></g><path style="fill:none;stroke:var(--pd);stroke-width:1.15;stroke-linecap:round" d="M22.5 20.6v11M14.3 29.4c5.4-1.5 10.9-1.5 16.4 0"/><path style="fill:none;stroke:var(--ps);stroke-width:3.8;stroke-linecap:round" d="M22.5 4.2v7M19.2 7.4h6.6"/><path style="fill:none;stroke:var(--pc);stroke-width:1.5;stroke-linecap:round" d="M22.5 4.2v7M19.2 7.4h6.6"/>`,
  n: `<g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.35;stroke-linejoin:round">${base(10, 35)}<path d="M13.2 34c.3-4.8 2.6-8.6 5.4-11.3l-7.6-1.1-2.5-1.5-2.1-2.4.8-1.7 5.8-2.4 2.5-2.3 1.4-6.4 3 4.8 3.8-5.4 1.6 6.8c4.8 2 8.2 6.8 8.2 12.8l1.6 2.6-1.5.6 1 2.9-2.1.3.6 4.7z"/></g><path style="fill:none;stroke:var(--pd);stroke-width:1.15;stroke-linecap:round" d="M7.6 18.3l4.6.9M21.5 15.8l3 2.1M22.4 20.4l3.4 1.5M22.6 25l3.8.9"/><circle style="fill:#E3120B" cx="14.1" cy="15.2" r="1.05"/>`
};
(function sprite(){
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.setAttribute("aria-hidden", "true"); s.style.position = "absolute";
  s.innerHTML = `<defs>
    <linearGradient id="cpgW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF7"/><stop offset="1" stop-color="#D3CCBB"/></linearGradient>
    <linearGradient id="cpgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3a37"/><stop offset="1" stop-color="#0c0c0c"/></linearGradient>
    ${Object.entries(SHAPES).map(([k, v]) => `<symbol id="cp-${k}" viewBox="0 0 45 45">${v}</symbol>`).join("")}</defs>`;
  document.body.appendChild(s);
})();
const pieceSvg = (code, cls = "") => `<svg class="pc-svg ${code[0] === "w" ? "pw" : "pb"} ${cls}" viewBox="0 0 45 45" aria-hidden="true"><use href="#cp-${code[1]}"/></svg>`;

/* ---------------- skaņa (WebAudio, bez failiem) ---------------- */
const SND = { on: LS.get("wb-chess-snd", true), ac: null };
function snd(kind){
  if (!SND.on) return;
  try {
    const ac = SND.ac || (SND.ac = new (window.AudioContext || window.webkitAudioContext)());
    if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime, out = ac.createGain(); out.gain.value = .5; out.connect(ac.destination);
    const knock = (f, q, dur, g, at = 0) => {
      const n = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
      const src = ac.createBufferSource(); src.buffer = n; const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const gg = ac.createGain(); gg.gain.value = g; src.connect(bp); bp.connect(gg); gg.connect(out); src.start(t0 + at);
    };
    const tone = (f, dur, g, at = 0, type = "sine") => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const gg = ac.createGain();
      gg.gain.setValueAtTime(0, t0 + at); gg.gain.linearRampToValueAtTime(g, t0 + at + .01); gg.gain.exponentialRampToValueAtTime(.0005, t0 + at + dur);
      o.connect(gg); gg.connect(out); o.start(t0 + at); o.stop(t0 + at + dur + .05);
    };
    if (kind === "move") { knock(1500, 1.2, .05, 2.2); tone(190, .07, .18); }
    else if (kind === "capture") { knock(900, 1, .08, 2.8); knock(2200, 2, .03, 1.2, .012); tone(120, .1, .22); }
    else if (kind === "check") { knock(1500, 1.2, .05, 2); tone(880, .16, .12, .02, "triangle"); tone(1318, .2, .08, .07, "triangle"); }
    else if (kind === "end") { [196, 247, 294, 392].forEach((f, i) => tone(f, 1.1, .09, i * .07, "triangle")); }
    else if (kind === "tick") tone(1250, .04, .05);
    else if (kind === "notify") { tone(660, .12, .1); tone(990, .18, .08, .1); }
  } catch (e) {}
}

/* ---------------- dzinējs (Web Worker; rezerves variants — galvenajā pavedienā) ---------------- */
const ENGINE_SRC = (document.querySelector('script[src*="chess-engine"]') || {}).src;
let worker = null, reqId = 0; const pending = {};
try { if (ENGINE_SRC && window.Worker) { worker = new Worker(ENGINE_SRC); worker.onmessage = e => { const cb = pending[e.data.id]; delete pending[e.data.id]; cb && cb(e.data); }; worker.onerror = () => { worker = null; }; } } catch (e) { worker = null; }
function engine(level, cb){
  const job = { id: ++reqId, fen: S.game.start, moves: S.game.moves.slice(), level };
  if (worker) { pending[job.id] = cb; worker.postMessage(job); }
  else setTimeout(() => cb(C.bestMove(job.fen, job.moves, level) || {}), 30);
}

/* ---------------- stāvoklis ---------------- */
const saved = LS.get(KEY, null);
const S = {
  mode: "ai", setup: "ai", level: 2, myColor: "w", colorPref: "w", tc: [0, 0], orient: "w",
  game: new C.Game(), view: null, sel: null, targets: [], busy: false, over: null, token: 0,
  clk: { w: 0, b: 0, running: false, at: 0, elapsed: 0 }, hint: null, confirm: null,
  on: null, me: null, lobby: null, live: false, tab: "play", onlineTc: [10, 5], onlineColor: "r", rated: true
};
function persist(){
  if (S.mode === "online") return;
  LS.set(KEY, { mode: S.mode, level: S.level, myColor: S.myColor, tc: S.tc, moves: S.game.moves, orient: S.orient, clk: { w: S.clk.w, b: S.clk.b }, over: S.over });
}

/* ---------------- DOM ---------------- */
const MODES = [
  { id: "ai", ico: '<path d="M5 20h14M7 20l1-5h8l1 5M9 15V9l-2-3h10l-2 3v6"/>' },
  { id: "local", ico: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M11 20c0-3 2.2-5 5-5s5 2 5 5"/>' },
  { id: "online", ico: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z"/>' }
];
const ico = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  flip: '<path d="M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  draw: '<path d="M5 9h14M5 15h14"/>',
  pgn: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  snd: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  first: '<path d="M18 18l-6-6 6-6M7 6v12"/>', prev: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>', last: '<path d="M6 18l6-6-6-6M17 6v12"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>'
};

root.innerHTML = `
  <div class="cb-stage">
    <div class="cb-player" id="cbTop"></div>
    <div class="cb-frame">
      <div class="cb-board" id="cbBoard" tabindex="0" role="application" aria-label="${esc(t("chess.board"))}" aria-describedby="cbStatus">
        <div class="cb-squares"></div>
        <div class="cb-pieces"></div>
        <svg class="cb-arrows" viewBox="0 0 8 8" aria-hidden="true"><defs><marker id="cbArrowHead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.4" markerHeight="2.4" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill="currentColor"/></marker></defs><g></g></svg>
        <canvas class="cb-smoke" aria-hidden="true"></canvas>
        <div class="cb-promo" hidden></div>
        <div class="cb-over" hidden></div>
      </div>
    </div>
    <div class="cb-player" id="cbBot"></div>
  </div>
  <aside class="cb-side">
    <div class="cb-tabs" role="tablist">
      ${["play", "game", "club"].map(k => `<button role="tab" data-tab="${k}" aria-selected="false">${esc(t("chess.tab." + k))}</button>`).join("")}
    </div>
    <div class="cb-status" id="cbStatus" aria-live="polite"></div>
    <div class="cb-pane" data-pane="play"></div>
    <div class="cb-pane" data-pane="game">
      <div class="cb-banner" hidden></div>
      <ol class="cb-moves" aria-label="${esc(t("chess.moves"))}"></ol>
      <div class="cb-nav">
        ${["first", "prev", "next", "last"].map(k => `<button class="tool" data-nav="${k}" aria-label="${esc(t("chess.nav." + k))}" title="${esc(t("chess.nav." + k))}">${ico(I[k])}</button>`).join("")}
      </div>
      <div class="cb-actions"></div>
    </div>
    <div class="cb-pane" data-pane="club"></div>
  </aside>`;

const board = root.querySelector("#cbBoard"), sqLayer = board.querySelector(".cb-squares"), pcLayer = board.querySelector(".cb-pieces"),
  arrowG = board.querySelector(".cb-arrows g"), promoEl = board.querySelector(".cb-promo"), overEl = board.querySelector(".cb-over"),
  topBar = root.querySelector("#cbTop"), botBar = root.querySelector("#cbBot"), statusEl = root.querySelector("#cbStatus"),
  movesEl = root.querySelector(".cb-moves"), actionsEl = root.querySelector(".cb-actions"), bannerEl = root.querySelector(".cb-banner"),
  playPane = root.querySelector('[data-pane="play"]'), clubPane = root.querySelector('[data-pane="club"]');

/* ---------------- koordinātes ---------------- */
const fileOf = a => a.charCodeAt(0) - 97, rankOf = a => +a[1];
const toXY = a => S.orient === "w" ? [fileOf(a), 8 - rankOf(a)] : [7 - fileOf(a), rankOf(a) - 1];
const fromXY = (x, y) => S.orient === "w" ? "abcdefgh"[x] + (8 - y) : "abcdefgh"[7 - x] + (y + 1);
function buildSquares(){
  let h = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const a = fromXY(x, y), dark = (fileOf(a) + rankOf(a)) % 2 === 1;
    h += `<div class="sq ${dark ? "d" : "l"}" data-sq="${a}">${y === 7 ? `<i class="cf">${a[0]}</i>` : ""}${x === 0 ? `<i class="cr">${a[1]}</i>` : ""}</div>`;
  }
  sqLayer.innerHTML = h;
}
const sqEl = a => sqLayer.querySelector(`[data-sq="${a}"]`);

/* ---------------- figūru slānis (diff + animācija) ---------------- */
let pieceEls = new Map();
function place(el, a){ const [x, y] = toXY(a); el.style.transform = `translate(${x * 100}%,${y * 100}%)`; el.dataset.sq = a; }
function syncPieces(pos, animate){
  pcLayer.classList.toggle("noanim", !animate || reduce);
  const want = new Map(); pos.pieces().forEach(p => want.set(p.sq, p.c + p.t));
  const keep = new Map(), free = [];
  for (const [sq, el] of pieceEls) want.get(sq) === el.dataset.p ? keep.set(sq, el) : free.push([sq, el]);
  for (const [sq, code] of want) {
    if (keep.has(sq)) { place(keep.get(sq), sq); continue; }
    let bi = -1, bd = 99;
    free.forEach(([osq, el], i) => { if (el.dataset.p !== code) return; const d = Math.abs(fileOf(osq) - fileOf(sq)) + Math.abs(rankOf(osq) - rankOf(sq)); if (d < bd) { bd = d; bi = i; } });
    let el;
    if (bi >= 0) { el = free[bi][1]; free.splice(bi, 1); }
    else { el = document.createElement("div"); el.className = "pc" + (animate && !reduce ? " pop" : ""); el.dataset.p = code; el.innerHTML = pieceSvg(code); pcLayer.appendChild(el); }
    place(el, sq); keep.set(sq, el);
  }
  for (const [, el] of free) { el.classList.add("gone"); setTimeout(() => el.remove(), animate && !reduce ? 260 : 0); }
  pieceEls = keep;
}
function viewPos(){ const ply = S.view == null ? S.game.moves.length : S.view; return new C.Position(S.game.fens[ply]); }
const viewPly = () => S.view == null ? S.game.moves.length : S.view;

function marks(){
  sqLayer.querySelectorAll(".sq").forEach(e => e.classList.remove("last", "sel", "tgt", "cap", "chk", "hov", "pre"));
  const ply = viewPly();
  if (ply > 0) { const u = S.game.moves[ply - 1]; sqEl(u.slice(0, 2)).classList.add("last"); sqEl(u.slice(2, 4)).classList.add("last"); }
  const pos = viewPos();
  if (pos.inCheck()) { const k = pos.pieces().find(p => p.t === "k" && p.c === (pos.turn === 8 ? "w" : "b")); if (k) sqEl(k.sq).classList.add("chk"); }
  if (S.sel && S.view == null) {
    sqEl(S.sel).classList.add("sel");
    S.targets.forEach(u => { const e = sqEl(u.slice(2, 4)); e.classList.add("tgt"); if (pos.pieceAt(u.slice(2, 4)) || (pos.pieceAt(S.sel).t === "p" && u[0] !== u[2])) e.classList.add("cap"); });
  }
  drawArrows();
}
function drawArrows(){
  arrowG.innerHTML = "";
  if (!S.hint || S.view != null) return;
  const [x1, y1] = toXY(S.hint.slice(0, 2)), [x2, y2] = toXY(S.hint.slice(2, 4));
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ex = x2 + .5 - dx / L * .32, ey = y2 + .5 - dy / L * .32;
  arrowG.innerHTML = `<line x1="${x1 + .5}" y1="${y1 + .5}" x2="${ex}" y2="${ey}" stroke="currentColor" stroke-width=".17" stroke-linecap="round" marker-end="url(#cbArrowHead)"/>`;
}
function render(animate){ syncPieces(viewPos(), animate); marks(); bars(); renderMoves(); renderStatus(); renderActions(); board.classList.toggle("viewing", S.view != null); }

/* ---------------- spēlētāju joslas ---------------- */
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 }, VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
function captured(pos){
  const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  pos.pieces().forEach(p => { if (p.t !== "k") have[p.c][p.t]++; });
  const out = { w: [], b: [] }; let mat = 0;
  for (const c of ["w", "b"]) for (const k of ["q", "r", "b", "n", "p"]) {
    const miss = Math.max(0, START_COUNT[k] - have[c][k]); for (let i = 0; i < miss; i++) out[other(c)].push(c + k);
    mat += (c === "w" ? 1 : -1) * have[c][k] * VAL[k];
  }
  return { list: out, diff: mat };
}
function who(c){
  if (S.mode === "online" && S.on) {
    const p = c === "w" ? S.on.white : S.on.black;
    if (!p) return { name: t("chess.waitingShort"), sub: "", ava: "?", empty: true };
    const online = S.on.online ? S.on.online[c] : true;
    return { name: p.name, sub: `${p.elo}${S.on.rated ? "" : " · " + t("chess.casual")}`, ava: (p.name || "?").trim()[0].toUpperCase(), dot: online ? "on" : "off", me: S.on.you === c };
  }
  if (S.mode === "ai") {
    if (c !== S.myColor) return { name: `${t("chess.wolf")} · ${t("chess.lvl." + S.level)}`, sub: `≈ ${LEVELS[S.level]}`, ai: true };
    return { name: S.me ? S.me.name : t("chess.you"), sub: S.me && S.me.elo ? String(S.me.elo) : "", ava: ((S.me && S.me.name) || t("chess.you")).trim()[0].toUpperCase(), me: true };
  }
  return { name: t(c === "w" ? "chess.white" : "chess.black"), sub: "", ava: c === "w" ? "♙" : "♟", local: c };
}
function bars(){
  const pos = viewPos(), cap = captured(pos), turn = pos.turn === 8 ? "w" : "b";
  const bar = (el, c) => {
    const w = who(c), lead = (c === "w" ? cap.diff : -cap.diff);
    const ava = w.ai ? `<span class="cb-ava ai"><img src="${WB.base}assets/img/mark-256.png" alt=""></span>` : w.local ? `<span class="cb-ava piece">${pieceSvg(c + "k")}</span>` : `<span class="cb-ava ${c}${w.empty ? " empty" : ""}">${esc(w.ava)}</span>`;
    el.className = `cb-player ${c}${turn === c && !S.over && S.view == null ? " turn" : ""}${w.me ? " me" : ""}`;
    el.innerHTML = `${ava}<span class="cb-who"><b>${esc(w.name)}${w.dot ? `<i class="dot ${w.dot}" title="${esc(t(w.dot === "on" ? "chess.online" : "chess.offline"))}"></i>` : ""}</b>${w.sub ? `<small>${esc(w.sub)}</small>` : ""}</span>
      <span class="cb-caps">${cap.list[c].map(code => pieceSvg(code, "mini")).join("")}${lead > 0 ? `<em>+${lead}</em>` : ""}</span>
      <span class="cb-clock${hasClock() ? "" : " hide"}" data-c="${c}">${fmtClock(clockLeft(c))}</span>`;
  };
  const bottom = S.orient, top = other(bottom);
  bar(topBar, top); bar(botBar, bottom);
}

/* ---------------- pulkstenis ---------------- */
const hasClock = () => S.mode === "online" ? !!(S.on && S.on.tc && S.on.tc[0]) : !!S.tc[0];
function clockLeft(c){
  const k = S.clk; if (!hasClock()) return 0;
  const turn = S.game.turn;
  if (k.running && c === turn && !S.over) return Math.max(0, k[c] - k.elapsed - (now() - k.at));
  return Math.max(0, k[c]);
}
function fmtClock(ms){
  if (ms >= 3600e3) { const h = Math.floor(ms / 3600e3); return `${h}:${WB.pad(Math.floor(ms % 3600e3 / 60000))}:${WB.pad(Math.floor(ms % 60000 / 1000))}`; }
  if (ms < 10000) { const s = Math.floor(ms / 1000), ds = Math.floor(ms % 1000 / 100); return `0:${WB.pad(s)}.${ds}`; }
  const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${WB.pad(s % 60)}`;
}
let lastTick = 0;
function tickClocks(){
  if (hasClock()) {
    root.querySelectorAll(".cb-clock").forEach(el => {
      const c = el.dataset.c, ms = clockLeft(c), run = S.clk.running && c === S.game.turn && !S.over;
      el.textContent = fmtClock(ms); el.classList.toggle("run", run); el.classList.toggle("low", ms < 20000 && run);
    });
    if (S.mode !== "online" && S.clk.running && !S.over) {
      const turn = S.game.turn, ms = clockLeft(turn);
      if (ms <= 0) flagOffline(turn);
      else if (ms < 10000 && Math.floor(ms / 1000) !== lastTick) { lastTick = Math.floor(ms / 1000); if (S.mode === "local" || turn === S.myColor) snd("tick"); }
    }
  }
  requestAnimationFrame(tickClocks);
}
function clockAfterMove(mover, remote){
  if (!hasClock() || remote) return;
  const k = S.clk, plies = S.game.moves.length, inc = S.mode === "online" ? S.on.tc[1] * 1000 : S.tc[1] * 1000;
  if (k.running) { k[mover] = Math.max(0, k[mover] - k.elapsed - (now() - k.at)) + inc; }
  k.running = plies >= 2; k.at = now(); k.elapsed = 0;
}
function flagOffline(c){
  const pos = S.game.pos, win = other(c);
  S.clk[c] = 0; S.clk.running = false;
  endGame(pos.canMate(win === "w" ? 8 : 16) ? (win === "w" ? "1-0" : "0-1") : "1/2-1/2", "timeout");
}

/* ---------------- statuss, gājienu saraksts, darbības ---------------- */
function statusText(){
  if (S.mode === "online" && S.on && S.on.status === "open") return t("chess.waiting");
  if (S.over) return resultLine();
  const st = S.game.status(), turn = S.game.turn;
  if (S.mode === "ai" && S.busy) return t("chess.thinking");
  if (S.mode === "online" && S.on && !S.on.you) return t("chess.spectating") + " · " + t("chess.turn." + turn);
  const mine = (S.mode === "ai" && turn === S.myColor) || (S.mode === "online" && S.on && S.on.you === turn);
  let s = mine ? t("chess.yourTurn") : t("chess.turn." + turn);
  if (st.check) s = t("chess.check") + " " + s;
  if (!S.game.moves.length && (mine || S.mode === "local")) s = t("chess.firstMove");
  return s;
}
function resultLine(){
  const o = S.over; if (!o) return "";
  if (o.reason === "abort") return t("chess.res.aborted");
  return `${o.result.replace("1/2-1/2", "½–½").replace("-", "–")} · ${t("chess.why." + o.reason)}`;
}
function renderStatus(){ statusEl.textContent = statusText(); statusEl.classList.toggle("alert", !S.over && S.game.status().check); }
function renderMoves(){
  const sans = S.game.sans, cur = viewPly();
  if (!sans.length) { movesEl.innerHTML = `<li class="empty">${esc(t("chess.noMoves"))}</li>`; return; }
  let h = "";
  for (let i = 0; i < sans.length; i += 2) {
    h += `<li><span class="n">${i / 2 + 1}.</span>${[i, i + 1].map(j => j < sans.length ? `<button data-ply="${j + 1}" class="${cur === j + 1 ? "on" : ""}">${esc(sans[j])}</button>` : "<span></span>").join("")}</li>`;
  }
  if (S.over && S.over.reason !== "abort") h += `<li class="res">${esc(resultLine())}</li>`;
  movesEl.innerHTML = h;
  const on = movesEl.querySelector("button.on"); if (on && S.tab === "game") { const r = on.offsetTop - movesEl.clientHeight / 2; movesEl.scrollTop = Math.max(0, r); }
}
function renderActions(){
  const offline = S.mode !== "online", live = !S.over, n = S.game.moves.length;
  const btn = (id, icon, label, extra = "") => `<button class="cb-act ${extra}" data-act="${id}">${ico(icon, 17)}<span>${esc(label)}</span></button>`;
  let h = btn("flip", I.flip, t("chess.flip"));
  if (offline) {
    h += btn("undo", I.undo, t("chess.undo"), n ? "" : "dis");
    h += btn("hint", I.hint, t("chess.hint"), live && !S.busy ? "" : "dis");
    if (S.mode === "ai" && live && n) h += btn("resign", I.flag, S.confirm === "resign" ? t("chess.confirm") : t("chess.resign"), S.confirm === "resign" ? "warn" : "");
  } else if (S.on && S.on.you && S.on.status === "live") {
    if (n < 2) h += btn("abort", I.x, t("chess.abort"));
    else {
      h += btn("draw", I.draw, S.on.draw === S.on.you ? t("chess.drawSent") : t("chess.offerDraw"), S.on.draw === S.on.you ? "dis" : "");
      h += btn("resign", I.flag, S.confirm === "resign" ? t("chess.confirm") : t("chess.resign"), S.confirm === "resign" ? "warn" : "");
    }
  }
  if (S.mode === "online" && S.on) h += btn("link", I.link, t("chess.copyLink"));
  h += btn("pgn", I.pgn, t("chess.pgn"), n ? "" : "dis");
  h += btn("sound", SND.on ? I.snd : I.mute, t("chess.sound"), SND.on ? "" : "off");
  actionsEl.innerHTML = h;
  // izdevīgie piedāvājumi (neizšķirts / revanšs)
  const o = S.on, showDraw = S.mode === "online" && o && o.you && o.status === "live" && o.draw && o.draw !== o.you;
  bannerEl.hidden = !showDraw;
  if (showDraw) bannerEl.innerHTML = `<span>${esc(t("chess.drawOffered"))}</span><button class="btn small" data-act="draw">${esc(t("chess.yes"))}</button><button class="btn small ghost" data-act="decline">${esc(t("chess.no"))}</button>`;
}

/* ---------------- spēles gaita ---------------- */
function canMoveNow(){
  if (S.over || S.view != null || S.busy) return false;
  const turn = S.game.turn;
  if (S.mode === "ai") return turn === S.myColor;
  if (S.mode === "local") return true;
  return !!(S.on && S.on.status === "live" && S.on.you === turn);
}
function select(a){
  const pos = S.game.pos, p = pos.pieceAt(a);
  if (!p || p.c !== S.game.turn || !canMoveNow()) { S.sel = null; S.targets = []; marks(); return false; }
  S.sel = a; S.targets = S.game.targets(a); marks(); return true;
}
function tryMove(from, to){
  const opts = S.targets.filter(u => u.slice(0, 4) === from + to);
  if (!opts.length) return false;
  if (opts.length > 1) { askPromo(from, to); return true; }
  play(opts[0]); return true;
}
function askPromo(from, to){
  const c = S.game.turn, [x, y] = toXY(to), down = y === 0, pel = pieceEls.get(from);
  if (pel) { pel.classList.remove("drag"); place(pel, to); }
  promoEl.innerHTML = `<div class="cb-promo-col${down ? "" : " up"}" style="left:${x * 12.5}%;${down ? "top:0" : "bottom:0"}" role="dialog" aria-label="${esc(t("chess.promote"))}">${["q", "n", "r", "b"].map(k => `<button data-pr="${k}" aria-label="${k}">${pieceSvg(c + k)}</button>`).join("")}<button class="x" data-pr="" aria-label="${esc(t("chess.cancel"))}">${ico(I.x, 16)}</button></div>`;
  promoEl.hidden = false;
  promoEl.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    promoEl.hidden = true; promoEl.onclick = null;
    if (b.dataset.pr) play(from + to + b.dataset.pr); else { pieceEls.forEach((el, a) => place(el, a)); marks(); }
  };
  const first = promoEl.querySelector("button"); first && first.focus();
}
function play(uci, remote){
  const mover = S.game.turn, mv = S.game.move(uci);
  if (!mv) return null;
  S.sel = null; S.targets = []; S.view = null; S.hint = null; S.confirm = null;
  clockAfterMove(mover, remote);
  render(true);
  snd(mv.check ? "check" : mv.captured ? "capture" : "move");
  if (S.mode === "online" && !remote) net.send({ type: "move", uci, ply: S.game.moves.length - 1 });
  if (S.mode !== "online") {
    const st = S.game.status();
    if (st.over) endGame(st.result, st.reason);
    else if (S.mode === "ai" && S.game.turn !== S.myColor) aiMove();
    persist();
  }
  return mv;
}
function aiMove(){
  S.busy = true; renderStatus(); renderActions();
  board.classList.add("thinking");
  const tok = S.token, t0 = now();
  engine(S.level, r => {
    if (tok !== S.token) return;
    const wait = Math.max(0, (S.level <= 2 ? 650 : 380) - (now() - t0));
    setTimeout(() => {
      if (tok !== S.token) return;
      S.busy = false; board.classList.remove("thinking");
      if (r && r.uci) play(r.uci); else render(false);
    }, wait);
  });
}
function endGame(result, reason, diffs){
  S.over = { result, reason, diffs: diffs || null };
  S.clk.running = false; S.busy = false; S.sel = null; S.targets = [];
  board.classList.remove("thinking");
  render(false); snd("end");
  if (reason === "checkmate") smokeAt(S.game.pos);
  setTimeout(showOver, reason === "checkmate" && !reduce ? 650 : 120);
  persist();
}
function newGame(opt = {}){
  net.close(); S.on = null; S.token++;
  Object.assign(S, { mode: opt.mode || S.setup, game: new C.Game(), view: null, sel: null, targets: [], busy: false, over: null, hint: null, confirm: null });
  if (S.mode === "ai") {
    S.level = opt.level || S.level;
    const pref = opt.color || S.colorPref; S.myColor = pref === "r" ? (Math.random() < .5 ? "w" : "b") : pref;
    S.orient = S.myColor;
  } else S.orient = "w";
  S.tc = opt.tc || S.tc;
  S.clk = { w: S.tc[0] * 60000, b: S.tc[0] * 60000, running: false, at: now(), elapsed: 0 };
  overEl.hidden = true; promoEl.hidden = true; clearSmoke();
  if (location.hash.startsWith("#spele/g/")) history.replaceState(null, "", location.pathname + location.search + "#spele");
  buildSquares(); pieceEls.forEach(el => el.remove()); pieceEls = new Map();
  render(false); persist();
  if (S.mode === "ai" && S.myColor === "b") aiMove();
}
function undo(){
  if (S.mode === "online" || !S.game.moves.length) return;
  S.token++; S.busy = false; board.classList.remove("thinking");
  S.game.undo();
  if (S.mode === "ai" && S.game.turn !== S.myColor && S.game.moves.length) S.game.undo();
  S.over = null; overEl.hidden = true; S.hint = null; S.view = null; S.sel = null; S.targets = [];
  S.clk.running = hasClock() && S.game.moves.length >= 2; S.clk.at = now(); S.clk.elapsed = 0;
  render(true); persist();
  if (S.mode === "ai" && S.game.turn !== S.myColor) aiMove();
}
function setView(ply){
  const n = S.game.moves.length;
  ply = Math.max(0, Math.min(n, ply));
  S.view = ply === n ? null : ply; S.sel = null; S.targets = [];
  syncPieces(viewPos(), true); marks(); bars(); renderMoves(); board.classList.toggle("viewing", S.view != null);
}

/* ---------------- rezultāta kartīte ---------------- */
function showOver(){
  const o = S.over; if (!o) return;
  let me = S.mode === "ai" ? S.myColor : S.mode === "online" && S.on ? S.on.you : null;
  const win = o.result === "1-0" ? "w" : o.result === "0-1" ? "b" : null;
  let title, cls;
  if (o.reason === "abort") { title = t("chess.res.aborted"); cls = "draw"; }
  else if (!win) { title = t("chess.res.draw"); cls = "draw"; }
  else if (me) { title = t(win === me ? "chess.res.win" : "chess.res.loss"); cls = win === me ? "win" : "loss"; }
  else { title = t("chess.res." + win); cls = "win"; }
  let rating = "";
  if (o.diffs && me) { const d = o.diffs[me], e = me === "w" ? o.diffs.we : o.diffs.be; rating = `<p class="cb-elo">${esc(t("chess.elo"))} <b>${e}</b> <span class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : "−"}${Math.abs(d)}</span></p>`; }
  const rem = S.mode === "online" && S.on && S.on.you ? (S.on.rematch && S.on.rematch[S.on.you] ? `<button class="btn small dis" disabled>${esc(t("chess.rematchSent"))}</button>` : `<button class="btn small" data-over="rematch">${esc(t("chess.rematch"))}</button>`) : S.mode !== "online" ? `<button class="btn small" data-over="rematch">${esc(t("chess.rematch"))}</button>` : "";
  const askRem = S.mode === "online" && S.on && S.on.you && S.on.rematch && S.on.rematch[other(S.on.you)] && !S.on.rematch[S.on.you] ? `<p class="cb-ask">${esc(t("chess.rematchAsk", { name: (S.on.you === "w" ? S.on.black : S.on.white || {}).name || "" }))}</p>` : "";
  overEl.innerHTML = `<div class="cb-over-card ${cls}">
    <div class="cb-score">${esc(o.reason === "abort" ? "—" : o.result.replace("1/2-1/2", "½–½").replace("-", "–"))}</div>
    <h3>${esc(title)}</h3>
    <p class="why">${esc(t("chess.why." + o.reason))}</p>${rating}${askRem}
    <div class="cb-over-btns">${rem}<button class="btn small ghost" data-over="${S.mode === "online" ? "lobby" : "new"}">${esc(t(S.mode === "online" ? "chess.toLobby" : "chess.newGame"))}</button><button class="btn small ghost" data-over="review">${esc(t("chess.review"))}</button></div>
  </div>`;
  overEl.hidden = false;
}
function showWaiting(){
  const link = shareLink();
  overEl.innerHTML = `<div class="cb-over-card wait">
    <div class="cb-spin" aria-hidden="true"><img src="${WB.base}assets/img/mark-256.png" alt=""></div>
    <h3>${esc(t("chess.waiting"))}</h3>
    <p class="why">${esc(t("chess.share"))}</p>
    <div class="cb-link"><input readonly value="${esc(link)}" aria-label="${esc(t("chess.copyLink"))}"><button class="tool" data-over="copy" aria-label="${esc(t("chess.copyLink"))}" title="${esc(t("chess.copyLink"))}">${ico(I.link, 17)}</button></div>
    <div class="cb-over-btns"><button class="btn small ghost" data-over="cancel">${esc(t("chess.cancel"))}</button></div>
  </div>`;
  overEl.hidden = false;
}
overEl.addEventListener("click", e => {
  const b = e.target.closest("[data-over]"); if (!b) return;
  const a = b.dataset.over;
  if (a === "review") { overEl.hidden = true; switchTab("game"); }
  else if (a === "new") newGame({ mode: S.mode });
  else if (a === "rematch") {
    if (S.mode === "online") net.send({ type: "rematch" });
    else newGame({ mode: S.mode, color: S.mode === "ai" ? other(S.myColor) : undefined });
  }
  else if (a === "lobby") { overEl.hidden = true; switchTab("club"); loadLobby(); }
  else if (a === "copy") copy(shareLink());
  else if (a === "cancel") cancelOpen();
});

/* ---------------- dūmi pie matētā karaļa ---------------- */
let smoke = null;
function clearSmoke(){ if (!smoke) return; smoke.stop(); smoke.p.length = 0; smoke.emitters = []; smoke.g.setTransform(1, 0, 0, 1, 0, 0); smoke.g.clearRect(0, 0, smoke.c.width, smoke.c.height); }
function smokeAt(pos){
  if (reduce || !WB.Smoke) return;
  const cv = board.querySelector(".cb-smoke");
  if (!smoke) { smoke = new WB.Smoke(cv); }
  smoke.resize();
  const k = pos.pieces().find(p => p.t === "k" && p.c === (pos.turn === 8 ? "w" : "b")); if (!k) return;
  const [x, y] = toXY(k.sq), s = smoke.w / 8, cx = (x + .5) * s, cy = (y + .8) * s;
  let n = 0; const em = sm => { if (n++ > 50) return; for (let i = 0; i < 3; i++) sm.puff(cx + (Math.random() - .5) * s * .6, cy, { vx: (Math.random() - .5) * 1.6, vy: -(.4 + Math.random() * 1.2), s: s * (.18 + Math.random() * .2), gs: s * .012, a: .5, max: 110 + Math.random() * 70 }); };
  smoke.emitters = [em]; smoke.start(); setTimeout(() => smoke.stop(), 4200);
}

/* ---------------- ievade: vilkšana un klikšķi ---------------- */
let drag = null;
function pointSq(e){ const r = board.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8); return x >= 0 && x < 8 && y >= 0 && y < 8 ? fromXY(x, y) : null; }
board.addEventListener("pointerdown", e => {
  if (e.button > 0 || !promoEl.hidden || !overEl.hidden || e.target.closest(".cb-promo, .cb-over")) return;
  const a = pointSq(e); if (!a) return;
  if (S.view != null) { setView(S.game.moves.length); return; }
  if (S.sel && S.sel !== a && S.targets.some(u => u.slice(2, 4) === a)) { e.preventDefault(); tryMove(S.sel, a); return; }
  const was = S.sel === a;
  if (!select(a)) return;
  e.preventDefault();
  const el = pieceEls.get(a), r = board.getBoundingClientRect();
  drag = { from: a, el, was, x0: e.clientX, y0: e.clientY, moved: false, r, id: e.pointerId };
  board.setPointerCapture(e.pointerId);
});
board.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved) { drag.moved = true; drag.el && drag.el.classList.add("drag"); board.classList.add("dragging"); }
  const r = drag.r, s = r.width / 8;
  if (drag.el) drag.el.style.transform = `translate(${e.clientX - r.left - s / 2}px,${e.clientY - r.top - s / 2}px) scale(1.12)`;
  const a = pointSq(e);
  sqLayer.querySelectorAll(".hov").forEach(x => x.classList.remove("hov"));
  if (a && S.targets.some(u => u.slice(2, 4) === a)) sqEl(a).classList.add("hov");
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  board.classList.remove("dragging"); sqLayer.querySelectorAll(".hov").forEach(x => x.classList.remove("hov"));
  if (d.el) d.el.classList.remove("drag");
  const a = e.type === "pointerup" ? pointSq(e) : null;
  if (d.moved) {
    if (a && a !== d.from && tryMove(d.from, a)) return;
    if (d.el) { pcLayer.classList.add("noanim"); place(d.el, d.from); requestAnimationFrame(() => pcLayer.classList.remove("noanim")); }
  } else if (d.was) { S.sel = null; S.targets = []; marks(); }
};
board.addEventListener("pointerup", endDrag);
board.addEventListener("pointercancel", endDrag);
board.addEventListener("keydown", e => {
  if (e.target !== board) return;
  const n = S.game.moves.length, cur = viewPly();
  if (e.key === "ArrowLeft") { e.preventDefault(); setView(cur - 1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); setView(cur + 1); }
  else if (e.key === "Home") { e.preventDefault(); setView(0); }
  else if (e.key === "End") { e.preventDefault(); setView(n); }
  else if (e.key === "f") { flip(); }
  else if (e.key === "Escape") { S.sel = null; S.targets = []; marks(); }
});
function flip(){ S.orient = other(S.orient); buildSquares(); pieceEls.forEach((el, a) => place(el, a)); marks(); bars(); persist(); }

/* ---------------- sānu panelis ---------------- */
function switchTab(k){
  S.tab = k;
  root.querySelectorAll(".cb-tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === k));
  root.querySelectorAll(".cb-pane").forEach(p => p.classList.toggle("on", p.dataset.pane === k));
  if (k === "club") loadLobby();
  if (k === "play") renderPlay();
  if (k === "game") renderMoves();
}
root.querySelector(".cb-tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) switchTab(b.dataset.tab); });
root.querySelector(".cb-nav").addEventListener("click", e => {
  const b = e.target.closest("[data-nav]"); if (!b) return;
  const n = S.game.moves.length, cur = viewPly();
  setView({ first: 0, prev: cur - 1, next: cur + 1, last: n }[b.dataset.nav]);
});
movesEl.addEventListener("click", e => { const b = e.target.closest("[data-ply]"); if (b) setView(+b.dataset.ply); });
root.querySelector('[data-pane="game"]').addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b || b.classList.contains("dis")) return;
  const a = b.dataset.act;
  if (a === "flip") flip();
  else if (a === "undo") undo();
  else if (a === "hint") {
    if (S.over || S.busy || S.view != null) return;
    b.classList.add("dis");
    const tok = S.token; engine("hint", r => { if (tok !== S.token) return; S.hint = r && r.uci; marks(); renderActions(); });
  }
  else if (a === "resign") {
    if (S.confirm !== "resign") { S.confirm = "resign"; renderActions(); setTimeout(() => { if (S.confirm === "resign") { S.confirm = null; renderActions(); } }, 3500); return; }
    S.confirm = null;
    if (S.mode === "online") net.send({ type: "resign" });
    else endGame(S.myColor === "w" ? "0-1" : "1-0", "resign");
  }
  else if (a === "abort") net.send({ type: "abort" });
  else if (a === "draw") net.send({ type: "draw" });
  else if (a === "decline") net.send({ type: "decline" });
  else if (a === "link") copy(shareLink());
  else if (a === "pgn") {
    const W = who("w"), B = who("b");
    copy(S.game.pgn({ White: W.name, Black: B.name, ...(S.over ? { Result: S.over.result === "*" ? "*" : S.over.result } : {}), ...(hasClock() ? { TimeControl: S.mode === "online" ? `${S.on.tc[0] * 60}+${S.on.tc[1]}` : `${S.tc[0] * 60}+${S.tc[1]}` } : {}) }));
  }
  else if (a === "sound") { SND.on = !SND.on; LS.set("wb-chess-snd", SND.on); renderActions(); if (SND.on) snd("move"); }
});

/* ---- Spēlēt: jaunas partijas iestatījumi ---- */
function renderPlay(){
  const m = S.setup;
  const seg = `<div class="cb-modes" role="radiogroup" aria-label="${esc(t("chess.tab.play"))}">${MODES.map(x => `<button role="radio" aria-checked="${m === x.id}" data-mode="${x.id}">${ico(x.ico, 22)}<b>${esc(t("chess.mode." + x.id))}</b><small>${esc(t("chess.mode." + x.id + "D"))}</small></button>`).join("")}</div>`;
  const colors = (sel, attr) => `<div class="cb-colors" role="radiogroup" aria-label="${esc(t("chess.color"))}">${[["w", "chess.white"], ["r", "chess.random"], ["b", "chess.black"]].map(([c, k]) => `<button role="radio" aria-checked="${sel === c}" data-${attr}="${c}" title="${esc(t(k))}">${c === "r" ? `<span class="half">${pieceSvg("wk")}${pieceSvg("bk")}</span>` : pieceSvg(c + "k")}<small>${esc(t(k))}</small></button>`).join("")}</div>`;
  const tcs = (sel, attr, list) => `<div class="chips cb-tcs">${list.map(tc => `<button class="chip${sel[0] === tc[0] && sel[1] === tc[1] ? " on" : ""}" data-${attr}="${tc.join("+")}">${tc[0] ? tcLabel(tc) : esc(t("chess.noclock"))}</button>`).join("")}</div>`;
  let body = "";
  if (m === "ai") {
    body = `<h4>${esc(t("chess.level"))}</h4><div class="cb-levels">${[1, 2, 3, 4].map(l => `<button aria-pressed="${S.level === l}" data-level="${l}"><span class="paws">${"<i></i>".repeat(l)}</span><b>${esc(t("chess.lvl." + l))}</b><small>${esc(t("chess.lvl." + l + "d"))} · ≈${LEVELS[l]}</small></button>`).join("")}</div>
      <h4>${esc(t("chess.color"))}</h4>${colors(S.colorPref, "color")}
      <h4>${esc(t("chess.time"))}</h4>${tcs(S.tc, "tc", [[0, 0], [5, 3], [10, 5], [15, 10]])}
      <button class="btn cb-go" data-go="ai">${esc(t("chess.start"))}</button>`;
  } else if (m === "local") {
    body = `<p class="cb-note">${esc(t("chess.localNote"))}</p><h4>${esc(t("chess.time"))}</h4>${tcs(S.tc, "tc", [[0, 0], [3, 2], [5, 3], [10, 5], [15, 10]])}<button class="btn cb-go" data-go="local">${esc(t("chess.start"))}</button>`;
  } else {
    body = onlineSetup();
  }
  playPane.innerHTML = seg + `<div class="cb-setup">${body}</div>`;
}
function onlineSetup(){
  if (!S.live) return `<p class="cb-note">${esc(t("chess.offlineNote"))}</p>`;
  if (!S.me) return loginForm();
  const tcs = `<div class="chips cb-tcs">${TCS.map(tc => `<button class="chip${S.onlineTc[0] === tc[0] && S.onlineTc[1] === tc[1] ? " on" : ""}" data-otc="${tc.join("+")}">${tc[0] ? tcLabel(tc) : esc(t("chess.noclock"))}</button>`).join("")}</div>`;
  const colors = `<div class="cb-colors" role="radiogroup">${[["w", "chess.white"], ["r", "chess.random"], ["b", "chess.black"]].map(([c, k]) => `<button role="radio" aria-checked="${S.onlineColor === c}" data-ocolor="${c}">${c === "r" ? `<span class="half">${pieceSvg("wk")}${pieceSvg("bk")}</span>` : pieceSvg(c + "k")}<small>${esc(t(k))}</small></button>`).join("")}</div>`;
  const open = (S.lobby && S.lobby.open || []);
  return `<div class="cb-meline"><span class="cb-ava">${esc(S.me.name.trim()[0].toUpperCase())}</span><b>${esc(S.me.name)}</b><span class="tag">${esc(t("chess.elo"))} ${S.me.elo || 1200}</span></div>
    <h4>${esc(t("chess.time"))}</h4>${tcs}
    <h4>${esc(t("chess.color"))}</h4>${colors}
    <label class="cb-check"><input type="checkbox" data-rated ${S.rated ? "checked" : ""}> ${esc(t("chess.rated"))}</label>
    <button class="btn cb-go" data-go="create">${esc(t("chess.create"))}</button>
    <h4>${esc(t("chess.open"))}</h4>${gameList(open, "open")}`;
}
function loginForm(){
  return `<p class="cb-note">${esc(t("chess.login"))}</p>
    <form class="cb-login">
      <label class="field"><span>${esc(t("chess.email"))}</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>${esc(t("chess.pass"))}</span><input type="password" name="password" autocomplete="current-password" required minlength="8"></label>
      <p class="cb-err" hidden></p>
      <button class="btn">${esc(t("chess.signin"))}</button>
      <a class="cb-reg" href="${WB.base}${WB.lang === "lv" ? "" : WB.lang + "/"}brali.html?auth=register&back=chess">${esc(t("chess.register"))} →</a>
    </form>`;
}
playPane.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.mode) { S.setup = d.mode; renderPlay(); if (d.mode === "online") loadLobby(); return; }
  if (d.level) { S.level = +d.level; renderPlay(); return; }
  if (d.color) { S.colorPref = d.color; renderPlay(); return; }
  if (d.tc) { S.tc = d.tc.split("+").map(Number); renderPlay(); return; }
  if (d.otc) { S.onlineTc = d.otc.split("+").map(Number); renderPlay(); return; }
  if (d.ocolor) { S.onlineColor = d.ocolor; renderPlay(); return; }
  if (d.go === "ai" || d.go === "local") { newGame({ mode: d.go }); switchTab("game"); scrollToBoard(); return; }
  if (d.go === "create") { createGame(b); return; }
  if (d.join) { openGame(d.join); return; }
  if (d.cancelOpen) { cancelOpen(d.cancelOpen); return; }
});
playPane.addEventListener("change", e => { if (e.target.matches("[data-rated]")) S.rated = e.target.checked; });
playPane.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, err = f.querySelector(".cb-err"), btn = f.querySelector("button");
  btn.disabled = true; err.hidden = true;
  try { await window.RHR.login(f.email.value.trim(), f.password.value); await loadLobby(); renderPlay(); bars(); }
  catch (x) { err.textContent = x.message || "Error"; err.hidden = false; }
  btn.disabled = false;
});
const scrollToBoard = () => { if (matchMedia("(max-width:980px)").matches) board.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); };

/* ---- Klubs: reitings, notiekošās partijas ---- */
function gameList(list, kind){
  if (!list.length) return `<p class="cb-empty">${esc(t(kind === "open" ? "chess.noOpen" : kind === "live" ? "chess.noLive" : "chess.noRecent"))}</p>`;
  return `<ul class="cb-glist">${list.map(g => {
    const w = g.white, b = g.black, mine = S.me && ((w && w.id === S.me.id) || (b && b.id === S.me.id));
    const names = kind === "open" ? `<b>${esc((w || b).name)}</b> <small>${(w || b).elo}</small>` : `<b>${esc(w ? w.name : "?")}</b> <small>${w ? w.elo : ""}</small> <i>${kind === "recent" ? esc(g.result.replace("1/2-1/2", "½–½")) : t("chess.vs")}</i> <b>${esc(b ? b.name : "?")}</b> <small>${b ? b.elo : ""}</small>`;
    let act = "";
    if (kind === "open") act = mine ? `<button class="btn small ghost" data-cancel-open="${g.id}">${esc(t("chess.cancel"))}</button>` : `<button class="btn small" data-join="${g.id}">${esc(t("chess.accept"))}</button>`;
    else if (kind === "live") act = `<button class="btn small ${mine ? "" : "ghost"}" data-join="${g.id}">${esc(t(mine ? "chess.resume" : "chess.watch"))}</button>`;
    else act = `<button class="tool" data-join="${g.id}" aria-label="${esc(t("chess.review"))}" title="${esc(t("chess.review"))}">${ico(I.eye, 17)}</button>`;
    return `<li><span class="cb-tc">${esc(tcLabel(g.tc))}${g.rated ? "" : " · " + esc(t("chess.casual"))}</span><span class="cb-names">${names}</span>${act}</li>`;
  }).join("")}</ul>`;
}
function renderClub(){
  if (!S.live) { clubPane.innerHTML = `<p class="cb-note">${esc(t("chess.offlineNote"))}</p>`; return; }
  const L = S.lobby;
  if (!L) { clubPane.innerHTML = `<p class="cb-empty">…</p>`; return; }
  const me = L.me ? `<div class="cb-mecard"><div><small>${esc(t("chess.elo"))}</small><b>${L.me.elo}</b></div><div><small>${esc(t("chess.best"))}</small><b>${L.me.best}</b></div><div><small>${esc(t("chess.record"))}</small><b>${L.me.wins}–${L.me.losses}–${L.me.draws}</b></div></div>` : "";
  const top = L.top.length ? `<ol class="cb-ladder">${L.top.map((r, i) => `<li class="${S.me && r.id === S.me.id ? "me" : ""}"><span class="pos">${i + 1}</span><b>${esc(r.name)}</b><small>${r.wins}–${r.losses}–${r.draws}</small><span class="elo">${r.elo}</span></li>`).join("")}</ol>` : `<p class="cb-empty">${esc(t("chess.noLadder"))}</p>`;
  clubPane.innerHTML = `${me}<h4>${esc(t("chess.ladder"))}</h4>${top}<h4>${esc(t("chess.live"))}</h4>${gameList(L.live, "live")}<h4>${esc(t("chess.open"))}</h4>${gameList(L.open, "open")}<h4>${esc(t("chess.recent"))}</h4>${gameList(L.recent, "recent")}`;
}
clubPane.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.join) openGame(b.dataset.join); if (b.dataset.cancelOpen) cancelOpen(b.dataset.cancelOpen); });

/* ---------------- tīkls ---------------- */
const API = () => WB.api();
const token = () => LS.get("wb-token", null);
async function req(path, opt = {}){
  const tok = token();
  const r = await fetch(API() + path, { method: opt.body ? "POST" : opt.method || "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j;
}
let lobbyBusy = false, lobbyAt = 0;
async function loadLobby(){
  if (!S.live || lobbyBusy) return;
  lobbyBusy = true;
  try { S.lobby = await req("/chess/lobby"); S.me = S.lobby.me; lobbyAt = Date.now(); } catch (e) {}
  lobbyBusy = false;
  if (S.tab === "club") renderClub();
  if (S.tab === "play" && S.setup === "online") renderPlay();
  bars();
}
setInterval(() => { if (S.live && !document.hidden && (S.tab === "club" || (S.tab === "play" && S.setup === "online")) && inView && Date.now() - lobbyAt > 9000) loadLobby(); }, 3000);
async function createGame(btn){
  btn.disabled = true;
  try { const r = await req("/chess/games", { body: { tc: S.onlineTc.join("+"), color: S.onlineColor, rated: S.rated } }); openGame(r.id); }
  catch (e) { toast(e.message); }
  btn.disabled = false;
}
async function cancelOpen(id){
  id = id || (S.on && S.on.id); if (!id) return;
  try { await req(`/chess/games/${id}/cancel`, { body: {} }); } catch (e) {}
  if (S.on && S.on.id === id) { newGame({ mode: "ai" }); switchTab("play"); }
  loadLobby();
}
const shareLink = () => S.on ? `${location.origin}${location.pathname}#spele/g/${S.on.id}` : location.href;
function openGame(id){
  S.token++; S.busy = false; board.classList.remove("thinking");
  S.mode = "online"; S.on = { id, status: "connecting", tc: [0, 0] }; S.over = null; S.view = null; S.sel = null; S.targets = []; S.hint = null; S.game = new C.Game();
  S.clk = { w: 0, b: 0, running: false, at: now(), elapsed: 0 };
  overEl.hidden = true; clearSmoke();
  history.replaceState(null, "", `${location.pathname}${location.search}#spele/g/${id}`);
  net.connect(id);
  switchTab("game"); render(false); scrollToBoard();
}
const net = {
  ws: null, id: null, closed: true, retry: 800, firstState: true, ping: null,
  connect(id){ this.close(); this.id = id; this.closed = false; this.firstState = true; this.open(); },
  open(){
    const tok = token(), id = this.id;
    const ws = this.ws = new WebSocket(WB.wsUrl(`/chess/games/${id}/ws`) + (tok ? `?token=${encodeURIComponent(tok)}` : ""));
    ws.onopen = () => { this.retry = 800; root.classList.remove("cb-lost"); clearInterval(this.ping); this.ping = setInterval(() => this.send({ type: "ping", t: Date.now() }), 25000); };
    ws.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } if (id === this.id) onNet(d); };
    ws.onclose = () => { clearInterval(this.ping); if (this.closed || id !== this.id) return; root.classList.add("cb-lost"); setTimeout(() => { if (!this.closed && id === this.id) this.open(); }, this.retry = Math.min(this.retry * 1.8, 12000)); };
  },
  send(o){ try { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); else toast(t("chess.reconnecting")); } catch (e) {} },
  close(){ this.closed = true; this.id = null; clearInterval(this.ping); root.classList.remove("cb-lost"); if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; } }
};
function setClk(d){ S.clk = { w: d.clocks.w, b: d.clocks.b, running: !!d.running, at: now(), elapsed: d.elapsed || 0 }; }
function onNet(d){
  if (d.type === "state") {
    const prevLen = S.game.moves.length;
    const wasOpen = S.on && S.on.status === "open";
    S.on = { ...S.on, ...d, online: (S.on && S.on.online) || { w: true, b: true } };
    S.game = C.Game.from(d.moves);
    if (net.firstState) { S.orient = d.you === "b" ? "b" : "w"; buildSquares(); net.firstState = false; }
    setClk(d);
    S.over = d.status === "over" ? { result: d.result, reason: d.reason, diffs: d.diffs } : null;
    if (d.status === "cancelled") { toast(t("chess.cancelledMsg")); newGame({ mode: "ai" }); return; }
    render(prevLen !== d.moves.length && prevLen > 0);
    if (d.status === "open") showWaiting();
    else if (S.over) showOver();
    else { overEl.hidden = true; if (wasOpen) { snd("notify"); toast(t("chess.joined")); } }
    if (d.error === "illegal") toast(t("chess.illegal"));
  } else if (d.type === "move") {
    const n = S.game.moves.length;
    if (d.ply === n && S.game.moves[n - 1] === d.uci) { setClk(d); bars(); return; }
    if (d.ply === n + 1) { setClk(d); S.on.draw = d.draw; play(d.uci, true); return; }
    net.open();
  } else if (d.type === "end") {
    if (d.moves && d.moves.length !== S.game.moves.length) S.game = C.Game.from(d.moves);
    S.on.status = "over"; S.on.result = d.result; S.on.reason = d.reason; S.on.diffs = d.diffs; S.on.draw = null;
    S.clk = { ...S.clk, w: d.clocks.w, b: d.clocks.b, running: false };
    endGame(d.result, d.reason, d.diffs);
    setTimeout(loadLobby, 800);
  } else if (d.type === "draw") {
    S.on.draw = d.by; renderActions();
    if (d.by && d.by !== S.on.you) { snd("notify"); switchTab("game"); }
  } else if (d.type === "rematch") {
    if (d.next) { toast(t("chess.rematch")); openGame(d.next); return; }
    S.on.rematch = { ...(S.on.rematch || {}), [d.by]: true };
    if (d.by !== S.on.you) snd("notify");
    if (S.over) showOver();
  } else if (d.type === "presence") { S.on.online = d.online; S.on.watchers = d.watchers; bars(); }
  else if (d.type === "cancelled") { toast(t("chess.cancelledMsg")); newGame({ mode: "ai" }); }
  else if (d.type === "error" && d.error === "notfound") { toast(t("chess.notfound")); newGame({ mode: "ai" }); }
}

/* ---------------- palīgi ---------------- */
let toastEl;
function toast(msg){
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 2400);
}
async function copy(s){ try { await navigator.clipboard.writeText(s); toast(t("chess.copied")); } catch (e) { const ta = document.createElement("textarea"); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast(t("chess.copied")); } catch (x) {} ta.remove(); } }
let inView = false;
if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => inView = e.isIntersecting), { rootMargin: "200px" }).observe(root); else inView = true;
addEventListener("resize", () => { if (smoke) smoke.resize(); });

/* ---------------- starts ---------------- */
(function boot(){
  if (saved && Array.isArray(saved.moves) && saved.mode !== "online") {
    S.mode = S.setup = saved.mode === "local" ? "local" : "ai"; S.level = saved.level || 2; S.myColor = saved.myColor || "w"; S.colorPref = S.myColor;
    S.tc = saved.tc || [0, 0]; S.orient = saved.orient || S.myColor;
    S.game = C.Game.from(saved.moves);
    S.clk = { w: saved.clk ? saved.clk.w : S.tc[0] * 60000, b: saved.clk ? saved.clk.b : S.tc[0] * 60000, running: false, at: now(), elapsed: 0 };
    S.over = saved.over || null;
  }
  buildSquares(); render(false); switchTab(S.game.moves.length && !S.over ? "game" : "play");
  requestAnimationFrame(tickClocks);
  // pēc atjaunošanas: ja dators gājienā — lai domā; ja pulkstenis — atsāk pēc nākamā gājiena
  if (!S.over && S.mode === "ai" && S.game.turn !== S.myColor) aiMove();
  if (!S.over && hasClock() && S.game.moves.length >= 2) { S.clk.running = true; S.clk.at = now(); }
  const hashGame = () => { const m = location.hash.match(/^#spele\/g\/([\w]{6,32})$/); return m && m[1]; };
  const R = window.RHR;
  (R ? R.probe() : Promise.resolve(false)).then(async ok => {
    S.live = !!ok;
    if (ok) { await loadLobby(); const id = hashGame(); if (id) { root.closest("section").scrollIntoView(); openGame(id); } }
    if (S.tab === "play") renderPlay();
  });
  addEventListener("hashchange", () => { const id = hashGame(); if (id && S.live && (!S.on || S.on.id !== id)) openGame(id); });
})();
})();
