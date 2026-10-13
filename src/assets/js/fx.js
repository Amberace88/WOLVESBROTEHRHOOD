/* WOLVES BROTHERHOOD MC — efekti: dūmu daļiņas (WB.Smoke), logo kustība, riepu sliedes */
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
})();
