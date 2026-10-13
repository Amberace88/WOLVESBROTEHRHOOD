/* WOLVES BROTHERHOOD MC — šaha dzinējs
   Pilni FIDE noteikumi (rokāde, en passant, transformācija, šahs/mats/pats, 50 gājieni,
   trīskārtēja atkārtošanās, nepietiekams materiāls), SAN/UCI/FEN/PGN un meklēšana
   (alfa-beta + PVS, transpozīciju tabula, nulles gājiens, LMR, kvieskence).
   Strādā pārlūkā, Web Worker un Cloudflare Worker (servera puses gājienu pārbaude). */
(function(G){
"use strict";
const WHITE = 8, BLACK = 16;
const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const CAP = 1, EP = 2, CASTLE = 4, DOUBLE = 8;
const WK = 1, WQ = 2, BK = 4, BQ = 8;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = "abcdefgh";
const N_OFF = [-33, -31, -18, -14, 14, 18, 31, 33], K_OFF = [-17, -16, -15, -1, 1, 15, 16, 17];
const DIAG = [-17, -15, 15, 17], ORTH = [-16, -1, 1, 16];
const alg = sq => FILES[sq & 7] + (8 - (sq >> 4));
const sqOf = s => (8 - +s[1]) * 16 + FILES.indexOf(s[0]);
const mFrom = m => m & 127, mTo = m => (m >> 7) & 127, mFl = m => (m >> 14) & 63, mPr = m => (m >> 20) & 7;
const mk = (f, t, fl, pr) => f | (t << 7) | (fl << 14) | ((pr || 0) << 20);

/* castling-rights masks */
const CR = new Uint8Array(128).fill(15);
CR[112] = 15 & ~WQ; CR[119] = 15 & ~WK; CR[116] = 15 & ~(WK | WQ);
CR[0] = 15 & ~BQ; CR[7] = 15 & ~BK; CR[4] = 15 & ~(BK | BQ);

/* Zobrist (deterministic xorshift) */
let seed = 0x2545F491;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
const ZL = new Int32Array(23 * 128), ZH = new Int32Array(23 * 128);
for (let i = 0; i < ZL.length; i++) { ZL[i] = rnd(); ZH[i] = rnd(); }
const ZSL = rnd(), ZSH = rnd();
const ZCL = new Int32Array(16), ZCH = new Int32Array(16); for (let i = 0; i < 16; i++) { ZCL[i] = rnd(); ZCH[i] = rnd(); }
const ZEL = new Int32Array(8), ZEH = new Int32Array(8); for (let i = 0; i < 8; i++) { ZEL[i] = rnd(); ZEH[i] = rnd(); }

class Position {
  constructor(fen){ this.load(fen || START); }
  load(fen){
    const b = this.board = new Int8Array(128);
    const [pl, side, cas, ep, half, full] = fen.trim().split(/\s+/);
    let r = 0, f = 0;
    for (const ch of pl) {
      if (ch === "/") { r++; f = 0; continue; }
      if (/\d/.test(ch)) { f += +ch; continue; }
      const lower = ch.toLowerCase(), t = " pnbrqk".indexOf(lower);
      if (t < 1 || r > 7 || f > 7) throw new Error("bad fen");
      b[r * 16 + f] = t | (ch === lower ? BLACK : WHITE); f++;
    }
    this.turn = side === "b" ? BLACK : WHITE;
    this.castle = (cas || "").split("").reduce((a, c) => a | ({ K: WK, Q: WQ, k: BK, q: BQ }[c] || 0), 0);
    this.ep = ep && ep !== "-" ? sqOf(ep) : -1;
    this.half = +half || 0; this.full = +full || 1;
    this.kings = { [WHITE]: -1, [BLACK]: -1 };
    for (let s = 0; s < 128; s++) if (!(s & 0x88) && (b[s] & 7) === KING) this.kings[b[s] & 24] = s;
    if (this.kings[WHITE] < 0 || this.kings[BLACK] < 0) throw new Error("bad fen");
    this.stack = []; this.rehash();
    return this;
  }
  rehash(){
    let lo = 0, hi = 0; const b = this.board;
    for (let s = 0; s < 128; s++) if (!(s & 0x88) && b[s]) { lo ^= ZL[b[s] * 128 + s]; hi ^= ZH[b[s] * 128 + s]; }
    if (this.turn === BLACK) { lo ^= ZSL; hi ^= ZSH; }
    lo ^= ZCL[this.castle]; hi ^= ZCH[this.castle];
    if (this.ep >= 0) { lo ^= ZEL[this.ep & 7]; hi ^= ZEH[this.ep & 7]; }
    this.lo = lo; this.hi = hi;
  }
  fen(){
    const b = this.board; let out = "";
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let f = 0; f < 8; f++) { const p = b[r * 16 + f]; if (!p) { e++; continue; } if (e) { out += e; e = 0; } const c = " pnbrqk"[p & 7]; out += p & WHITE ? c.toUpperCase() : c; }
      if (e) out += e; if (r < 7) out += "/";
    }
    const c = (this.castle & WK ? "K" : "") + (this.castle & WQ ? "Q" : "") + (this.castle & BK ? "k" : "") + (this.castle & BQ ? "q" : "");
    return `${out} ${this.turn === WHITE ? "w" : "b"} ${c || "-"} ${this.ep >= 0 ? alg(this.ep) : "-"} ${this.half} ${this.full}`;
  }
  attacked(sq, by){
    const b = this.board; let s;
    if (by === WHITE) { s = sq + 15; if (!(s & 0x88) && b[s] === (PAWN | WHITE)) return true; s = sq + 17; if (!(s & 0x88) && b[s] === (PAWN | WHITE)) return true; }
    else { s = sq - 15; if (!(s & 0x88) && b[s] === (PAWN | BLACK)) return true; s = sq - 17; if (!(s & 0x88) && b[s] === (PAWN | BLACK)) return true; }
    for (let i = 0; i < 8; i++) { s = sq + N_OFF[i]; if (!(s & 0x88) && b[s] === (KNIGHT | by)) return true; s = sq + K_OFF[i]; if (!(s & 0x88) && b[s] === (KING | by)) return true; }
    for (let i = 0; i < 4; i++) {
      let d = DIAG[i]; s = sq + d;
      while (!(s & 0x88)) { const q = b[s]; if (q) { if ((q & by) && ((q & 7) === BISHOP || (q & 7) === QUEEN)) return true; break; } s += d; }
      d = ORTH[i]; s = sq + d;
      while (!(s & 0x88)) { const q = b[s]; if (q) { if ((q & by) && ((q & 7) === ROOK || (q & 7) === QUEEN)) return true; break; } s += d; }
    }
    return false;
  }
  inCheck(color){ color = color || this.turn; return this.attacked(this.kings[color], color ^ 24); }
  gen(capsOnly){
    const b = this.board, us = this.turn, them = us ^ 24, out = [];
    const promos = (f, t, fl) => { out.push(mk(f, t, fl, QUEEN)); if (!capsOnly) { out.push(mk(f, t, fl, KNIGHT)); out.push(mk(f, t, fl, ROOK)); out.push(mk(f, t, fl, BISHOP)); } };
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq]; if (!p || !(p & us)) continue;
      const t = p & 7;
      if (t === PAWN) {
        const dir = us === WHITE ? -16 : 16, startRow = us === WHITE ? 6 : 1, promoRow = us === WHITE ? 0 : 7;
        const one = sq + dir;
        if (!(one & 0x88) && !b[one]) {
          if ((one >> 4) === promoRow) promos(sq, one, 0);
          else if (!capsOnly) { out.push(mk(sq, one, 0)); const two = one + dir; if ((sq >> 4) === startRow && !b[two]) out.push(mk(sq, two, DOUBLE)); }
        }
        for (const c of [dir - 1, dir + 1]) {
          const to = sq + c; if (to & 0x88) continue;
          if (b[to] & them) { if ((to >> 4) === promoRow) promos(sq, to, CAP); else out.push(mk(sq, to, CAP)); }
          else if (to === this.ep) out.push(mk(sq, to, CAP | EP));
        }
      } else if (t === KNIGHT || t === KING) {
        const offs = t === KNIGHT ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) { const to = sq + offs[i]; if (to & 0x88) continue; const q = b[to]; if (!q) { if (!capsOnly) out.push(mk(sq, to, 0)); } else if (q & them) out.push(mk(sq, to, CAP)); }
        if (t === KING && !capsOnly) {
          if (us === WHITE && sq === 116) {
            if ((this.castle & WK) && b[119] === (ROOK | WHITE) && !b[117] && !b[118] && !this.attacked(116, them) && !this.attacked(117, them)) out.push(mk(116, 118, CASTLE));
            if ((this.castle & WQ) && b[112] === (ROOK | WHITE) && !b[115] && !b[114] && !b[113] && !this.attacked(116, them) && !this.attacked(115, them)) out.push(mk(116, 114, CASTLE));
          } else if (us === BLACK && sq === 4) {
            if ((this.castle & BK) && b[7] === (ROOK | BLACK) && !b[5] && !b[6] && !this.attacked(4, them) && !this.attacked(5, them)) out.push(mk(4, 6, CASTLE));
            if ((this.castle & BQ) && b[0] === (ROOK | BLACK) && !b[3] && !b[2] && !b[1] && !this.attacked(4, them) && !this.attacked(3, them)) out.push(mk(4, 2, CASTLE));
          }
        }
      } else {
        const dirs = t === BISHOP ? DIAG : t === ROOK ? ORTH : K_OFF;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i]; let to = sq + d;
          while (!(to & 0x88)) { const q = b[to]; if (!q) { if (!capsOnly) out.push(mk(sq, to, 0)); } else { if (q & them) out.push(mk(sq, to, CAP)); break; } to += d; }
        }
      }
    }
    return out;
  }
  xp(p, s){ this.lo ^= ZL[p * 128 + s]; this.hi ^= ZH[p * 128 + s]; }
  make(m){
    const b = this.board, from = mFrom(m), to = mTo(m), fl = mFl(m), pr = mPr(m), us = this.turn, them = us ^ 24;
    const p = b[from]; let capSq = to;
    if (fl & EP) capSq = to + (us === WHITE ? 16 : -16);
    const cap = b[capSq];
    this.stack.push({ m, cap, capSq, castle: this.castle, ep: this.ep, half: this.half, lo: this.lo, hi: this.hi });
    this.xp(p, from); b[from] = 0;
    if (cap) { this.xp(cap, capSq); b[capSq] = 0; }
    const np = pr ? (pr | us) : p; b[to] = np; this.xp(np, to);
    if (fl & CASTLE) { const rf = to > from ? to + 1 : to - 2, rt = to > from ? to - 1 : to + 1, r = b[rf]; b[rf] = 0; b[rt] = r; this.xp(r, rf); this.xp(r, rt); }
    if ((p & 7) === KING) this.kings[us] = to;
    this.lo ^= ZCL[this.castle]; this.hi ^= ZCH[this.castle];
    this.castle &= CR[from] & CR[to];
    this.lo ^= ZCL[this.castle]; this.hi ^= ZCH[this.castle];
    if (this.ep >= 0) { this.lo ^= ZEL[this.ep & 7]; this.hi ^= ZEH[this.ep & 7]; }
    this.ep = -1;
    if (fl & DOUBLE) {
      const l = to - 1, r = to + 1, ep = (from + to) >> 1;
      if ((!(l & 0x88) && b[l] === (PAWN | them)) || (!(r & 0x88) && b[r] === (PAWN | them))) { this.ep = ep; this.lo ^= ZEL[ep & 7]; this.hi ^= ZEH[ep & 7]; }
    }
    this.half = (p & 7) === PAWN || cap ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.turn = them; this.lo ^= ZSL; this.hi ^= ZSH;
  }
  unmake(){
    const u = this.stack.pop(), b = this.board;
    this.turn ^= 24; const us = this.turn;
    if (u.m === 0) { this.ep = u.ep; this.lo = u.lo; this.hi = u.hi; return; }
    const m = u.m, from = mFrom(m), to = mTo(m), fl = mFl(m), pr = mPr(m);
    const p = pr ? (PAWN | us) : b[to];
    b[to] = 0; b[from] = p;
    if (u.cap) b[u.capSq] = u.cap;
    if (fl & CASTLE) { const rf = to > from ? to + 1 : to - 2, rt = to > from ? to - 1 : to + 1; b[rf] = b[rt]; b[rt] = 0; }
    if ((p & 7) === KING) this.kings[us] = from;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.lo = u.lo; this.hi = u.hi;
    if (us === BLACK) this.full--;
  }
  makeNull(){
    this.stack.push({ m: 0, ep: this.ep, lo: this.lo, hi: this.hi });
    if (this.ep >= 0) { this.lo ^= ZEL[this.ep & 7]; this.hi ^= ZEH[this.ep & 7]; this.ep = -1; }
    this.turn ^= 24; this.lo ^= ZSL; this.hi ^= ZSH;
  }
  /* makes a pseudo-legal move; returns false (and undoes it) if it leaves own king in check */
  play(m){ this.make(m); if (this.attacked(this.kings[this.turn ^ 24], this.turn)) { this.unmake(); return false; } return true; }
  legal(){ const out = []; for (const m of this.gen(false)) if (this.play(m)) { this.unmake(); out.push(m); } return out; }
  repetitions(){
    let n = 1;
    for (let i = this.stack.length - 1, k = 1; i >= 0 && k <= this.half; i--, k++) { const u = this.stack[i]; if (u.m === 0) break; if (u.lo === this.lo && u.hi === this.hi) n++; }
    return n;
  }
  material(color){
    const b = this.board, c = { p: 0, n: 0, b: 0, r: 0, q: 0, bl: 0, bd: 0 };
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if (!p || !(p & color)) continue; const t = " pnbrqk"[p & 7]; if (t === "k") continue; c[t]++; if (t === "b") ((s >> 4) + (s & 7)) & 1 ? c.bd++ : c.bl++; }
    return c;
  }
  insufficient(){
    const w = this.material(WHITE), k = this.material(BLACK);
    if (w.p || w.r || w.q || k.p || k.r || k.q) return false;
    const minors = w.n + w.b + k.n + k.b;
    if (minors <= 1) return true;
    if (!w.n && !k.n && ((w.bl + k.bl === 0) || (w.bd + k.bd === 0))) return true;
    return false;
  }
  /* can `color` possibly deliver mate (used when the opponent flags) */
  canMate(color){
    const c = this.material(color), o = this.material(color ^ 24);
    if (c.p || c.r || c.q) return true;
    const minors = c.n + c.b;
    if (minors >= 2) return !(c.n === 0 && (c.bl === 0 || c.bd === 0) && !(o.p + o.n + o.b + o.r + o.q));
    if (minors === 1) return o.p + o.n + o.b + o.r + o.q > 0;
    return false;
  }
  status(){
    const moves = this.legal();
    if (!moves.length) return this.inCheck() ? { over: true, result: this.turn === WHITE ? "0-1" : "1-0", reason: "checkmate" } : { over: true, result: "1/2-1/2", reason: "stalemate" };
    if (this.insufficient()) return { over: true, result: "1/2-1/2", reason: "material" };
    if (this.repetitions() >= 3) return { over: true, result: "1/2-1/2", reason: "repetition" };
    if (this.half >= 100) return { over: true, result: "1/2-1/2", reason: "fifty" };
    return { over: false, check: this.inCheck(), moves };
  }
  uci(m){ return alg(mFrom(m)) + alg(mTo(m)) + (mPr(m) ? " pnbrqk"[mPr(m)] : ""); }
  fromUci(u, legal){
    if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(u || "")) return 0;
    const f = sqOf(u.slice(0, 2)), t = sqOf(u.slice(2, 4)), pr = u[4] ? " pnbrqk".indexOf(u[4]) : 0;
    for (const m of legal || this.legal()) if (mFrom(m) === f && mTo(m) === t && mPr(m) === pr) return m;
    return 0;
  }
  san(m, legal){
    legal = legal || this.legal();
    const b = this.board, from = mFrom(m), to = mTo(m), fl = mFl(m), pr = mPr(m), p = b[from], t = p & 7;
    let s;
    if (fl & CASTLE) s = to > from ? "O-O" : "O-O-O";
    else if (t === PAWN) { s = (fl & CAP ? FILES[from & 7] + "x" : "") + alg(to); if (pr) s += "=" + " PNBRQK"[pr]; }
    else {
      s = " PNBRQK"[t];
      const others = legal.filter(o => o !== m && mTo(o) === to && b[mFrom(o)] === p);
      if (others.length) {
        const sameFile = others.some(o => (mFrom(o) & 7) === (from & 7)), sameRank = others.some(o => (mFrom(o) >> 4) === (from >> 4));
        s += !sameFile ? FILES[from & 7] : !sameRank ? String(8 - (from >> 4)) : alg(from);
      }
      if (fl & CAP) s += "x"; s += alg(to);
    }
    this.make(m);
    if (this.inCheck()) s += this.legal().length ? "+" : "#";
    this.unmake();
    return s;
  }
  fromSan(san, legal){
    legal = legal || this.legal();
    const clean = x => x.replace(/[+#?!]+$/, "").replace(/0/g, "O");
    for (const m of legal) if (clean(this.san(m, legal)) === clean(san)) return m;
    return 0;
  }
  pieces(){ const out = []; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = this.board[s]; if (p) out.push({ sq: alg(s), c: p & WHITE ? "w" : "b", t: " pnbrqk"[p & 7] }); } return out; }
  pieceAt(a){ const p = this.board[sqOf(a)]; return p ? { c: p & WHITE ? "w" : "b", t: " pnbrqk"[p & 7] } : null; }
}

/* ---------------- evaluation ---------------- */
const VAL = [0, 100, 320, 330, 500, 900, 0];
const PST = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
};
const PHASE = [0, 0, 1, 1, 2, 4, 0];
const PASSED = [0, 120, 80, 50, 30, 15, 10, 0]; // by row distance to promotion (row index for white)
const wMin = new Int8Array(8), wMax = new Int8Array(8), bMin = new Int8Array(8), bMax = new Int8Array(8);
function evaluate(pos){
  const b = pos.board; let mg = 0, eg = 0, phase = 0, wb = 0, bb = 0, wk = 0, bk = 0;
  wMin.fill(9); bMin.fill(9); wMax.fill(-1); bMax.fill(-1);
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if (!p) continue;
    const t = p & 7, r = s >> 4, f = s & 7, white = p & WHITE;
    const idx = white ? r * 8 + f : (7 - r) * 8 + f, sign = white ? 1 : -1;
    if (t === KING) { if (white) wk = idx; else bk = idx; continue; }
    const v = VAL[t] + PST[t][idx];
    mg += sign * v; eg += sign * v; phase += PHASE[t];
    if (t === BISHOP) white ? wb++ : bb++;
    if (t === PAWN) { if (white) { if (r < wMin[f]) wMin[f] = r; if (r > wMax[f]) wMax[f] = r; } else { if (r < bMin[f]) bMin[f] = r; if (r > bMax[f]) bMax[f] = r; } }
  }
  mg += PST[6][wk] - PST[6][bk]; eg += PST[7][wk] - PST[7][bk];
  if (wb >= 2) { mg += 30; eg += 40; } if (bb >= 2) { mg -= 30; eg -= 40; }
  // pawn structure: passed, doubled, isolated; rooks on open files
  for (let f = 0; f < 8; f++) {
    if (wMax[f] >= 0) {
      const l = f > 0 && wMax[f - 1] >= 0, rr = f < 7 && wMax[f + 1] >= 0; if (!l && !rr) { mg -= 10; eg -= 12; }
      if (wMin[f] !== wMax[f]) { mg -= 10; eg -= 18; }
      const r = wMin[f]; let passed = true;
      for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1); g++) if (bMin[g] < 9 && bMin[g] < r) { passed = false; break; }
      if (passed) { mg += PASSED[r] >> 1; eg += PASSED[r]; }
    }
    if (bMax[f] >= 0) {
      const l = f > 0 && bMax[f - 1] >= 0, rr = f < 7 && bMax[f + 1] >= 0; if (!l && !rr) { mg += 10; eg += 12; }
      if (bMin[f] !== bMax[f]) { mg += 10; eg += 18; }
      const r = bMax[f]; let passed = true;
      for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1); g++) if (wMax[g] >= 0 && wMax[g] > r) { passed = false; break; }
      if (passed) { mg -= PASSED[7 - r] >> 1; eg -= PASSED[7 - r]; }
    }
  }
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s]; if ((p & 7) !== ROOK) continue; const f = s & 7;
    if (p & WHITE) { if (wMax[f] < 0) { const v = bMax[f] < 0 ? 18 : 9; mg += v; eg += v >> 1; } }
    else if (bMax[f] < 0) { const v = wMax[f] < 0 ? 18 : 9; mg -= v; eg -= v >> 1; }
  }
  if (phase > 24) phase = 24;
  let score = ((mg * phase) + (eg * (24 - phase))) / 24;
  // drive the lone king to the edge in won endgames
  if (phase <= 6) {
    const lead = score; if (Math.abs(lead) > 250) {
      const weak = lead > 0 ? pos.kings[BLACK] : pos.kings[WHITE], strong = lead > 0 ? pos.kings[WHITE] : pos.kings[BLACK];
      const wr = weak >> 4, wf = weak & 7, cd = Math.max(3 - wr, wr - 4) + Math.max(3 - wf, wf - 4);
      const dist = Math.abs((weak >> 4) - (strong >> 4)) + Math.abs((weak & 7) - (strong & 7));
      score += (lead > 0 ? 1 : -1) * (cd * 10 + (14 - dist) * 4);
    }
  }
  score = Math.round(score);
  return (pos.turn === WHITE ? score : -score) + 10;
}

/* ---------------- search ---------------- */
const MATE = 29000, INF = 30000, TTBITS = 19, TTSIZE = 1 << TTBITS, TTMASK = TTSIZE - 1;
let ttHi, ttMove, ttScore, ttDepth, ttFlag;
function ttInit(){ if (ttHi) return; ttHi = new Int32Array(TTSIZE); ttMove = new Int32Array(TTSIZE); ttScore = new Int16Array(TTSIZE); ttDepth = new Int8Array(TTSIZE).fill(-1); ttFlag = new Int8Array(TTSIZE); }

function think(pos, opt){
  ttInit();
  opt = opt || {};
  const deadline = Date.now() + (opt.time || 1000), maxDepth = opt.depth || 64;
  let nodes = 0, stop = false;
  const killers = [], history = new Int32Array(23 * 128);
  for (let i = 0; i < 128; i++) killers.push([0, 0]);
  const b = pos.board;
  const order = (moves, ttm, ply) => {
    const sc = new Int32Array(moves.length);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m === ttm) { sc[i] = 2e6; continue; }
      const fl = mFl(m);
      if (fl & CAP) { const v = fl & EP ? PAWN : b[mTo(m)] & 7; sc[i] = 1e6 + v * 10 - (b[mFrom(m)] & 7); }
      else if (mPr(m)) sc[i] = 9e5 + mPr(m);
      else if (m === killers[ply][0]) sc[i] = 8e5; else if (m === killers[ply][1]) sc[i] = 7e5;
      else sc[i] = history[b[mFrom(m)] * 128 + mTo(m)];
    }
    return sc;
  };
  const pick = (moves, sc, i) => { let bi = i; for (let j = i + 1; j < moves.length; j++) if (sc[j] > sc[bi]) bi = j; if (bi !== i) { const t = moves[i]; moves[i] = moves[bi]; moves[bi] = t; const u = sc[i]; sc[i] = sc[bi]; sc[bi] = u; } return moves[i]; };
  const repeated = () => { for (let i = pos.stack.length - 2, k = 2; i >= 0 && k <= pos.half; i -= 2, k += 2) { const u = pos.stack[i]; if (u.m === 0 || pos.stack[i + 1].m === 0) break; if (u.lo === pos.lo && u.hi === pos.hi) return true; } return false; };
  const nonPawn = c => { for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if ((p & c) && (p & 7) > 1 && (p & 7) < 6) return true; } return false; };

  function qs(alpha, beta, ply){
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    const stand = evaluate(pos);
    if (ply > 60) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const moves = pos.gen(true), sc = order(moves, 0, Math.min(ply, 127));
    for (let i = 0; i < moves.length; i++) {
      const m = pick(moves, sc, i), fl = mFl(m);
      if (!mPr(m)) { const v = fl & EP ? 100 : VAL[b[mTo(m)] & 7]; if (stand + v + 200 < alpha) continue; }
      if (!pos.play(m)) continue;
      const s = -qs(-beta, -alpha, ply + 1);
      pos.unmake();
      if (stop) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  let rootBest = 0, rootScore = 0;
  function search(depth, alpha, beta, ply, nullOk){
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
    if (stop) return 0;
    if (ply > 0) {
      if (pos.half >= 100 || repeated()) return 0;
      alpha = Math.max(alpha, -MATE + ply); beta = Math.min(beta, MATE - ply - 1); if (alpha >= beta) return alpha;
    }
    const check = pos.inCheck();
    if (check) depth++;
    if (depth <= 0) return qs(alpha, beta, ply);
    if (ply > 100) return evaluate(pos);
    const idx = pos.lo & TTMASK; let ttm = 0;
    if (ttHi[idx] === pos.hi && ttDepth[idx] >= 0) {
      ttm = ttMove[idx];
      if (ply > 0 && ttDepth[idx] >= depth) {
        let s = ttScore[idx]; if (s > MATE - 200) s -= ply; else if (s < -MATE + 200) s += ply;
        const f = ttFlag[idx];
        if (f === 0 || (f === 1 && s >= beta) || (f === 2 && s <= alpha)) return s;
      }
    }
    const pv = beta - alpha > 1;
    if (nullOk && !pv && !check && depth >= 3 && ply > 0 && nonPawn(pos.turn) && evaluate(pos) >= beta) {
      pos.makeNull();
      const s = -search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmake();
      if (stop) return 0;
      if (s >= beta) return beta;
    }
    const moves = pos.gen(false), sc = order(moves, ttm, Math.min(ply, 127));
    let legal = 0, best = -INF, bestM = 0; const a0 = alpha;
    for (let i = 0; i < moves.length; i++) {
      const m = pick(moves, sc, i);
      if (!pos.play(m)) continue;
      legal++;
      const quiet = !(mFl(m) & CAP) && !mPr(m);
      let s;
      if (legal === 1) s = -search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        let r = 0;
        if (depth >= 3 && legal > 3 && quiet && !check && !pos.inCheck()) r = legal > 10 ? 2 : 1;
        s = -search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && (r || s < beta) && !stop) s = -search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (stop) return 0;
      if (s > best) { best = s; bestM = m; if (ply === 0) { rootBest = m; rootScore = s; } }
      if (s > alpha) {
        alpha = s;
        if (alpha >= beta) {
          if (quiet) { const k = killers[Math.min(ply, 127)]; if (k[0] !== m) { k[1] = k[0]; k[0] = m; } history[b[mFrom(m)] * 128 + mTo(m)] += depth * depth; }
          break;
        }
      }
    }
    if (!legal) return check ? -MATE + ply : 0;
    let st = best; if (st > MATE - 200) st += ply; else if (st < -MATE + 200) st -= ply;
    ttHi[idx] = pos.hi; ttMove[idx] = bestM; ttScore[idx] = st; ttDepth[idx] = depth; ttFlag[idx] = best <= a0 ? 2 : best >= beta ? 1 : 0;
    return best;
  }

  const rootMoves = pos.legal();
  if (!rootMoves.length) return null;
  if (rootMoves.length === 1 && !opt.multi) return { move: rootMoves[0], uci: pos.uci(rootMoves[0]), score: 0, depth: 0, nodes: 0 };

  // weak levels: score every root move shallowly, add noise
  if (opt.multi) {
    const scored = [];
    for (const m of rootMoves) { pos.play(m); const s = -search((opt.multi | 0) - 1, -INF, INF, 1, true); pos.unmake(); scored.push({ m, s: s + (opt.noise ? gauss() * opt.noise : 0) }); }
    scored.sort((x, y) => y.s - x.s);
    const m = scored[0].m; return { move: m, uci: pos.uci(m), score: Math.round(scored[0].s), depth: opt.multi, nodes };
  }

  let best = rootMoves[0], bestScore = 0, done = 0;
  for (let d = 1; d <= maxDepth; d++) {
    rootBest = 0;
    const s = search(d, -INF, INF, 0, false);
    if (stop) { if (rootBest && rootScore > bestScore - 30 && d > 1) best = rootBest; break; }
    if (rootBest) { best = rootBest; bestScore = s; done = d; }
    if (Math.abs(s) > MATE - 200) break;
    if (Date.now() > deadline - (opt.time || 1000) * 0.45) break; // next iteration would not finish
  }
  return { move: best, uci: pos.uci(best), score: bestScore, depth: done, nodes };
}
function gauss(){ let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* tiny opening book keyed by the UCI move sequence from the start position */
const BOOK = {
  "": "e2e4 d2d4 c2c4 g1f3", "e2e4": "e7e5 c7c5 e7e6 c7c6", "d2d4": "d7d5 g8f6", "c2c4": "e7e5 g8f6 c7c5", "g1f3": "d7d5 g8f6",
  "e2e4 e7e5": "g1f3", "e2e4 e7e5 g1f3": "b8c6", "e2e4 e7e5 g1f3 b8c6": "f1b5 f1c4 d2d4", "e2e4 e7e5 g1f3 b8c6 f1b5": "a7a6 g8f6",
  "e2e4 e7e5 g1f3 b8c6 f1c4": "f8c5 g8f6", "e2e4 c7c5": "g1f3 b1c3", "e2e4 c7c5 g1f3": "d7d6 b8c6 e7e6", "e2e4 e7e6": "d2d4", "e2e4 e7e6 d2d4": "d7d5",
  "e2e4 c7c6": "d2d4", "e2e4 c7c6 d2d4": "d7d5", "d2d4 d7d5": "c2c4 g1f3", "d2d4 d7d5 c2c4": "e7e6 c7c6", "d2d4 g8f6": "c2c4 g1f3",
  "d2d4 g8f6 c2c4": "e7e6 g7g6", "d2d4 g8f6 c2c4 e7e6": "b1c3 g1f3", "d2d4 g8f6 c2c4 g7g6": "b1c3", "c2c4 e7e5": "b1c3 g2g3", "c2c4 g8f6": "b1c3 g1f3", "g1f3 d7d5": "d2d4 g2g3", "g1f3 g8f6": "c2c4 d2d4"
};
const LEVELS = {
  1: { multi: 1, noise: 140, blunder: .14 },
  2: { multi: 3, noise: 35, blunder: .03 },
  3: { time: 700, depth: 7, book: true },
  4: { time: 2200, book: true },
  hint: { time: 900 }
};
function bestMove(fen, moves, level){
  const pos = new Position(fen || START), legalSeq = [];
  for (const u of moves || []) { const m = pos.fromUci(u); if (!m) break; pos.play(m); legalSeq.push(u); }
  const L = LEVELS[level] || LEVELS[3];
  if (L.book && (!fen || fen === START)) {
    const opts = BOOK[legalSeq.join(" ")];
    if (opts) { const list = opts.split(" "); const u = list[Math.floor(Math.random() * list.length)]; if (pos.fromUci(u)) return { uci: u, score: 0, depth: 0, book: true }; }
  }
  if (L.blunder && Math.random() < L.blunder) { const lm = pos.legal(); const m = lm[Math.floor(Math.random() * lm.length)]; if (m) return { uci: pos.uci(m), score: 0, depth: 0 }; }
  const r = think(pos, L);
  return r ? { uci: r.uci, score: r.score, depth: r.depth, nodes: r.nodes } : null;
}

/* ---------------- game wrapper (UI + server) ---------------- */
class Game {
  constructor(fen){ this.start = fen || START; this.pos = new Position(this.start); this.moves = []; this.sans = []; this.fens = [this.pos.fen()]; this.caps = []; this._st = null; }
  get turn(){ return this.pos.turn === WHITE ? "w" : "b"; }
  status(){ return this._st || (this._st = this.pos.status()); }
  legalUci(){ const st = this.status(); return st.over ? [] : st.moves.map(m => this.pos.uci(m)); }
  targets(sq){ return this.legalUci().filter(u => u.slice(0, 2) === sq); }
  move(u){
    const st = this.status(); if (st.over) return null;
    const m = this.pos.fromUci(u, st.moves); if (!m) return null;
    const san = this.pos.san(m, st.moves), from = alg(mFrom(m)), to = alg(mTo(m)), fl = mFl(m);
    const capSq = fl & EP ? alg(mTo(m) + (this.pos.turn === WHITE ? 16 : -16)) : to;
    const captured = fl & CAP ? this.pos.pieceAt(capSq) : null;
    this.pos.play(m); this._st = null;
    this.moves.push(u); this.sans.push(san); this.fens.push(this.pos.fen()); this.caps.push(captured);
    return { uci: u, san, from, to, captured, castle: !!(fl & CASTLE), ep: !!(fl & EP), promo: mPr(m) ? " pnbrqk"[mPr(m)] : null, check: san.endsWith("+") || san.endsWith("#") };
  }
  undo(){ if (!this.moves.length) return null; this.pos.unmake(); this._st = null; this.fens.pop(); this.sans.pop(); this.caps.pop(); return this.moves.pop(); }
  static from(moves, fen){ const g = new Game(fen); for (const u of moves || []) if (!g.move(u)) break; return g; }
  pgn(h){
    h = h || {}; const st = this.status(); const res = h.Result || (st.over ? st.result : "*");
    const head = { Event: "Wolves Brotherhood MC — club table", Site: "wolvesbrotherhoodmc.com", Date: new Date().toISOString().slice(0, 10).replace(/-/g, "."), White: "?", Black: "?", ...h, Result: res };
    if (this.start !== START) { head.SetUp = "1"; head.FEN = this.start; }
    let body = "", n = +this.start.split(" ")[5] || 1, black = this.start.split(" ")[1] === "b";
    this.sans.forEach((s, i) => { if (!black) body += n + ". "; else if (i === 0) body += n + "... "; body += s + " "; if (black) n++; black = !black; });
    return Object.entries(head).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join("\n") + "\n\n" + (body + res).replace(/(.{1,78})(\s|$)/g, "$1\n").trim() + "\n";
  }
}

/* perft (tests) */
function perft(pos, d){ if (d === 0) return 1; let n = 0; for (const m of pos.gen(false)) { if (!pos.play(m)) continue; n += d === 1 ? 1 : perft(pos, d - 1); pos.unmake(); } return n; }

const API = { Position, Game, START, think, bestMove, perft, evaluate, alg, LEVELS };
G.WBChess = API;

/* Web Worker mode: { id, fen, moves, level } → { id, uci, score, depth } */
if (typeof importScripts === "function" && typeof document === "undefined" && typeof self !== "undefined") {
  self.onmessage = e => { const d = e.data || {}; let r = null; try { r = bestMove(d.fen, d.moves, d.level); } catch (err) { r = null; } self.postMessage({ id: d.id, ...(r || { uci: null }) }); };
}
})(typeof globalThis !== "undefined" ? globalThis : this);
