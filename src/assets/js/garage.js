/* WOLVES BROTHERHOOD MC — garāža: dūmi, motors, skaņa, logo kustība */
(function(){
const { $ } = WB;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- smoke particle system ---------- */
function makeSprite(){
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, "rgba(210,208,202,.55)"); r.addColorStop(.45, "rgba(170,168,162,.22)"); r.addColorStop(1, "rgba(150,150,150,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return c;
}
const SPRITE = makeSprite();
class Smoke {
  constructor(canvas){ this.c = canvas; this.g = canvas.getContext("2d"); this.p = []; this.running = false; this.emitters = []; this.resize(); addEventListener("resize", () => this.resize()); }
  resize(){ const r = this.c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); this.c.width = r.width * d; this.c.height = r.height * d; this.d = d; this.w = r.width; this.h = r.height; }
  puff(x, y, o = {}){
    if (this.p.length > 420) return;
    this.p.push({ x, y, vx: o.vx ?? (Math.random() - .5) * .4, vy: o.vy ?? -(.2 + Math.random() * .5), s: o.s ?? (8 + Math.random() * 10), gs: o.gs ?? (.35 + Math.random() * .4),
      a: o.a ?? .5, life: 0, max: o.max ?? (140 + Math.random() * 120), rot: Math.random() * 6.28, vr: (Math.random() - .5) * .02 });
  }
  start(){ if (this.running || reduce) return; this.running = true; const loop = () => { if (!this.running) return; this.step(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop(){ this.running = false; }
  step(){
    this.emitters.forEach(f => f(this));
    const g = this.g; g.setTransform(this.d, 0, 0, this.d, 0, 0); g.clearRect(0, 0, this.w, this.h);
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i]; q.life++; q.x += q.vx; q.y += q.vy; q.vx *= .995; q.vy *= .997; q.s += q.gs; q.rot += q.vr;
      const t = q.life / q.max; if (t >= 1) { this.p.splice(i, 1); continue; }
      g.globalAlpha = q.a * (t < .12 ? t / .12 : 1 - (t - .12) / .88);
      g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.drawImage(SPRITE, -q.s, -q.s, q.s * 2, q.s * 2); g.restore();
    }
    g.globalAlpha = 1;
  }
}
WB.Smoke = Smoke;
const whenVisible = (el, on, off) => {
  if (!("IntersectionObserver" in window)) return on();
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? on() : off()), { threshold: .05 }).observe(el);
};

/* ---------- hero: patch tilt + ambient smoke ---------- */
(function hero(){
  const patch = $("#patch"), hero = $(".hero"); if (!patch) return;
  patch.addEventListener("animationend", e => { if (e.animationName === "patchin") patch.classList.add("ready"); });
  setTimeout(() => patch.classList.add("ready"), 3200);
  if (!reduce && matchMedia("(pointer:fine)").matches) {
    hero.addEventListener("pointermove", e => {
      if (!patch.classList.contains("ready")) return;
      const r = hero.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      patch.classList.add("tilt"); patch.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
    });
    hero.addEventListener("pointerleave", () => { patch.style.transform = ""; });
  }
  const cv = $("#heroSmoke"); if (!cv) return;
  const sm = new Smoke(cv);
  sm.emitters.push(s => { if (Math.random() < .35) s.puff(Math.random() * s.w, s.h + 20, { vx: .15 + Math.random() * .25, vy: -(.15 + Math.random() * .35), s: 30 + Math.random() * 40, gs: .3, a: .22, max: 360 }); });
  whenVisible(hero, () => sm.start(), () => sm.stop());
})();

/* ---------- divider tire tracks roll in ---------- */
(function tracks(){
  const hrs = [...document.querySelectorAll("hr.stitch")];
  if (!("IntersectionObserver" in window)) return hrs.forEach(h => h.classList.add("in"));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 1 });
  hrs.forEach(h => io.observe(h));
})();

/* ---------- garage ---------- */
const garage = $("#garage"); if (!garage) return;
// spokes
const spokes = (id, cx, cy, r1, r2, n) => {
  let h = ""; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = a + (i % 2 ? .35 : -.35);
    h += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(b) * r2).toFixed(1)}" y2="${(cy + Math.sin(b) * r2).toFixed(1)}"/>`; }
  $("#" + id).innerHTML = h;
};
spokes("spokesR", 200, 338, 14, 60, 24); spokes("spokesF", 700, 342, 12, 60, 24);

const svg = garage.querySelector(".bike-scene");
const sm = new Smoke($("#smoke"));
const toPx = (vx, vy) => { const g = garage.getBoundingClientRect(), s = svg.getBoundingClientRect(); return [s.left - g.left + vx * s.width / 900, s.top - g.top + vy * s.height / 460, s.width / 900]; };
let on = false, burning = false, rpm = 0, target = 0, puffQueue = 0;
sm.emitters.push(s => {
  const [tx, ty, k] = toPx(200, 418);
  // rear tire: light smoulder always, heavy on burnout
  if (burning) for (let i = 0; i < 5; i++) s.puff(tx - 10 * k + Math.random() * 30 * k, ty - 6 * k, { vx: -(1 + Math.random() * 2.4) * k, vy: -(.3 + Math.random() * 1.1) * k, s: (18 + Math.random() * 18) * k, gs: .9 * k, a: .55, max: 170 + Math.random() * 90 });
  else if (Math.random() < .08) s.puff(tx + (Math.random() - .5) * 40 * k, ty, { vx: -.15 * k, vy: -.35 * k, s: 10 * k, gs: .25 * k, a: .25, max: 220 });
  // exhaust puffs on firing
  while (puffQueue > 0) { puffQueue--; const [ex, ey] = toPx(108, 386 + Math.random() * 10); s.puff(ex, ey, { vx: -(1.4 + rpm / 2500) * k, vy: -(.1 + Math.random() * .3) * k, s: 5 * k, gs: (.25 + rpm / 9000) * k, a: .3 + rpm / 14000, max: 70 + Math.random() * 40 }); }
  // rpm smoothing + tach
  rpm += (target - rpm) * (target > rpm ? .09 : .05);
  $("#rpm").textContent = Math.round(rpm / 50) * 50;
  $("#tachNeedle").style.transform = `rotate(${-90 + Math.min(rpm, 6000) / 6000 * 180}deg)`;
});
whenVisible(garage, () => sm.start(), () => { if (!on) sm.stop(); });

/* ---------- V-twin sound (WebAudio, only after user click) ---------- */
let ac, master, noiseBuf, timer, nextT = 0, phase = 0, muted = false;
function audioInit(){
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
  master = ac.createGain(); master.gain.value = muted ? 0 : .7; master.connect(comp); comp.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * .25, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = .97 * b + .03 * (Math.random() * 2 - 1); d[i] = b * 6; }
}
function fire(t){
  const n = ac.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = .7 + rpm / 9000;
  const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 180 + rpm * .12; f.Q.value = 4;
  const g = ac.createGain(); const dur = Math.max(.03, .075 - rpm / 120000);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.9, t + .004); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur + .02);
  const o = ac.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(70 + rpm / 60, t); o.frequency.exponentialRampToValueAtTime(38, t + dur);
  const og = ac.createGain(); og.gain.setValueAtTime(.55, t); og.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(og); og.connect(master); o.start(t); o.stop(t + dur + .02);
}
function scheduler(){
  // 45° V-twin: degadījumi pēc 315° un 405° kloķvārpstas
  while (nextT < ac.currentTime + .12) {
    const cyc = 120 / Math.max(rpm, 600); // 720° laiks sekundēs
    fire(nextT); puffQueue++;
    nextT += cyc * (phase ? 405 : 315) / 720 * (1 + (Math.random() - .5) * .06);
    phase ^= 1;
  }
}
const ignite = $("#ignite"), burnBtn = $("#burnout"), muteBtn = $("#mute");
function start(){
  on = true; garage.classList.add("on"); ignite.textContent = WB.t("gar.stop"); ignite.setAttribute("aria-pressed", "true"); burnBtn.disabled = false;
  sm.start();
  // starter crank → catch
  rpm = 250; target = 1400; setTimeout(() => { if (on && !burning) target = 900; }, 700);
  try { audioInit(); ac.resume(); nextT = ac.currentTime + .05; clearInterval(timer); timer = setInterval(scheduler, 40); } catch (e) {}
}
function stop(){
  on = false; burning = false; garage.classList.remove("on", "burn", "rev"); ignite.textContent = WB.t("gar.start"); ignite.setAttribute("aria-pressed", "false"); burnBtn.disabled = true;
  target = 0; clearInterval(timer);
}
ignite.addEventListener("click", () => on ? stop() : start());
const burnOn = () => { if (!on) return; burning = true; target = 5600; garage.classList.add("burn", "rev"); burnBtn.classList.add("holding"); };
const burnOff = () => { if (!burning) return; burning = false; target = 900; garage.classList.remove("burn", "rev"); burnBtn.classList.remove("holding"); };
burnBtn.addEventListener("pointerdown", e => { e.preventDefault(); burnOn(); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev => burnBtn.addEventListener(ev, burnOff));
burnBtn.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); burnOn(); } });
burnBtn.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") burnOff(); });
muteBtn.addEventListener("click", () => {
  muted = !muted; muteBtn.setAttribute("aria-pressed", muted); muteBtn.setAttribute("aria-label", WB.t(muted ? "gar.soundOff" : "gar.soundOn"));
  if (master) master.gain.setTargetAtTime(muted ? 0 : .7, ac.currentTime, .05);
});
document.addEventListener("visibilitychange", () => { if (document.hidden && on) stop(); });
})();
