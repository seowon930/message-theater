// 상영 화면: 배경 입자 + 글자가 한 자씩 나타나는 메시지 슬라이드
export const THEMES = ["blossom", "night", "chalk", "sky"];
export const THEME_NAMES = { blossom: "벚꽃", night: "밤하늘", chalk: "칠판", sky: "종이비행기" };
export const THEME_DOT = { blossom: "#F08FB1", night: "#3A3A86", chalk: "#2E5A47", sky: "#7FC4F0" };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

class Particles {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext("2d"); this.p = []; this.theme = null; this.t = 0; this.last = 0;
    this.w = 1; this.h = 1; this.dead = false;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    this.resize();
    requestAnimationFrame((ts) => this.frame(ts));
  }
  destroy() { this.dead = true; this.ro.disconnect(); }
  resize() {
    const r = this.c.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width < 2 || r.height < 2) return;
    const changed = Math.abs(r.width - this.w) > 40 || Math.abs(r.height - this.h) > 40;
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d);
    this.x.setTransform(d, 0, 0, d, 0, 0);
    if (this.theme && changed) { this.p = []; this.seed(this.theme, false); }
  }
  setTheme(t) {
    if (t === this.theme) return;
    this.p.forEach((p) => (p.dying = true));
    this.theme = t; this.seed(t, true);
  }
  seed(t, fade) {
    const { w, h } = this, area = w * h, k = Math.min(w, h) / 600, R = Math.random;
    const add = (o) => this.p.push(Object.assign({ a: fade ? 0 : 1, dying: false }, o));
    if (t === "blossom") {
      const n = Math.round(Math.min(70, area / 14000)), cols = ["#F7A8C4", "#FBC9DA", "#F28DB2", "#FFDCE7"];
      for (let i = 0; i < n; i++) add({ k: "petal", x: R() * w, y: R() * h, s: (6 + R() * 8) * k + 2, r: R() * 6, vr: (R() - .5) * .04, vy: .35 + R() * .7, vx: .2 + R() * .4, ph: R() * 6, col: cols[i % 4] });
    } else if (t === "night") {
      const n = Math.round(Math.min(220, area / 3500));
      for (let i = 0; i < n; i++) add({ k: "star", x: R() * w, y: R() * h * .85, r: (.4 + R() * 1.5) * Math.max(k, .6), ph: R() * 6, sp: .8 + R() * 2 });
    } else if (t === "chalk") {
      const n = Math.round(Math.min(90, area / 9000));
      for (let i = 0; i < n; i++) add({ k: "dust", x: R() * w, y: R() * h, r: (.5 + R() * 1.4) * Math.max(k, .6), vy: -(.05 + R() * .2), vx: (R() - .5) * .15, o: .15 + R() * .35 });
    } else if (t === "sky") {
      for (let i = 0; i < 6; i++) add({ k: "cloud", x: R() * w, y: h * (.08 + R() * .7), s: (40 + R() * 50) * k + 12, vx: .08 + R() * .18 });
      for (let i = 0; i < 4; i++) add(this.plane(R() * w));
    }
  }
  plane(x0) {
    const k = Math.min(this.w, this.h) / 600, R = Math.random;
    return { k: "plane", x: x0 ?? -40, y: this.h * (.25 + R() * .6), s: (14 + R() * 10) * k + 4, vx: .7 + R() * .8, vy: -(.12 + R() * .25), ph: R() * 6 };
  }
  frame(ts) {
    if (this.dead) return;
    const dt = Math.min(.05, (ts - (this.last || ts)) / 1000); this.last = ts; this.t += dt;
    const f = reduceMotion ? 0 : dt * 60, { x, w, h, t } = this;
    x.clearRect(0, 0, w, h);
    if (this.theme === "night" && !reduceMotion && Math.random() < dt * .18) this.p.push({ k: "shoot", x: w * (.2 + Math.random() * .7), y: h * Math.random() * .4, vx: -6, vy: 3, life: 1, a: 1, dying: false });
    for (const p of this.p) {
      p.a += (p.dying ? -1 : 1) * dt * .9; if (p.a > 1) p.a = 1;
      x.globalAlpha = Math.max(0, p.a);
      if (p.k === "petal") {
        p.y += p.vy * f; p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * .6) * f; p.r += p.vr * f;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; } if (p.x > w + 20) p.x = -20;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, .55 + .45 * Math.sin(t * 2 + p.ph));
        const s = p.s; x.beginPath(); x.moveTo(0, -s); x.bezierCurveTo(s, -s * .6, s * .7, s * .6, 0, s); x.bezierCurveTo(-s * .7, s * .6, -s, -s * .6, 0, -s);
        x.fillStyle = p.col; x.fill(); x.restore();
      } else if (p.k === "star") {
        x.globalAlpha = Math.max(0, p.a) * (.45 + .55 * (.5 + .5 * Math.sin(t * p.sp + p.ph)));
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283); x.fillStyle = "#FFF7E0"; x.fill();
      } else if (p.k === "shoot") {
        p.x += p.vx * f; p.y += p.vy * f; p.life -= dt * .9; if (p.life <= 0) { p.dying = true; p.a = 0; }
        const g = x.createLinearGradient(p.x, p.y, p.x - p.vx * 14, p.y - p.vy * 14);
        g.addColorStop(0, "rgba(255,247,224,.9)"); g.addColorStop(1, "rgba(255,247,224,0)");
        x.strokeStyle = g; x.lineWidth = 1.6; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 14, p.y - p.vy * 14); x.stroke();
      } else if (p.k === "dust") {
        p.y += p.vy * f; p.x += p.vx * f; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
        x.globalAlpha = Math.max(0, p.a) * p.o; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283); x.fillStyle = "#F3F1E6"; x.fill();
      } else if (p.k === "cloud") {
        p.x += p.vx * f; if (p.x - p.s * 2 > w) p.x = -p.s * 2;
        x.globalAlpha = Math.max(0, p.a) * .7; x.fillStyle = "#FFFFFF"; x.beginPath();
        x.arc(p.x, p.y, p.s * .55, 0, 6.283); x.arc(p.x + p.s * .5, p.y - p.s * .25, p.s * .6, 0, 6.283); x.arc(p.x + p.s * 1.05, p.y, p.s * .5, 0, 6.283); x.arc(p.x + p.s * .5, p.y + p.s * .1, p.s * .5, 0, 6.283); x.fill();
      } else if (p.k === "plane") {
        p.x += p.vx * f; p.y += (p.vy + Math.sin(t * 1.5 + p.ph) * .25) * f;
        if (!p.dying && (p.x > w + 40 || p.y < -40)) Object.assign(p, this.plane(-40));
        const s = p.s, ang = Math.atan2(p.vy, p.vx);
        x.save(); x.translate(p.x, p.y); x.rotate(ang);
        x.beginPath(); x.moveTo(s, 0); x.lineTo(-s, -s * .55); x.lineTo(-s * .55, 0); x.closePath(); x.fillStyle = "#FFFFFF"; x.fill();
        x.beginPath(); x.moveTo(s, 0); x.lineTo(-s * .55, 0); x.lineTo(-s * .8, s * .45); x.closePath(); x.fillStyle = "#D7E9F7"; x.fill();
        x.strokeStyle = "rgba(19,48,90,.35)"; x.lineWidth = 1; x.beginPath(); x.moveTo(s, 0); x.lineTo(-s, -s * .55); x.lineTo(-s * .55, 0); x.lineTo(-s * .8, s * .45); x.closePath(); x.stroke();
        x.restore();
      }
    }
    x.globalAlpha = 1;
    this.p = this.p.filter((p) => !(p.dying && p.a <= 0));
    requestAnimationFrame((n) => this.frame(n));
  }
}

export class Stage {
  constructor(root) {
    this.root = root; root.textContent = ""; root.dataset.theme = "night";
    THEMES.forEach((t) => root.appendChild(el("div", "bg bg-" + t)));
    const cv = el("canvas"); cv.setAttribute("aria-hidden", "true"); root.appendChild(cv);
    this.particles = new Particles(cv);
    this.particles.setTheme("night");
    this.tag = el("div", "tag", "방금 도착"); this.tag.hidden = true; root.appendChild(this.tag);
    this.corner = el("div", "corner"); this.corner.hidden = true; root.appendChild(this.corner);
    const bar = el("div", "bar"); this.barFill = el("i"); bar.appendChild(this.barFill); root.appendChild(bar);
    this.current = null;
  }
  destroy() { this.particles.destroy(); this.root.textContent = ""; }
  setCorner(join) {
    this.corner.textContent = "";
    if (!join) { this.corner.hidden = true; return; }
    if (join.qr) { const img = el("img"); img.src = join.qr; img.alt = "참여 QR 코드"; this.corner.appendChild(img); }
    const t = el("div"); t.appendChild(el("small", null, "반 코드")); t.appendChild(el("b", null, join.code));
    this.corner.appendChild(t);
    this.corner.hidden = false;
  }
  show(slide, opts = {}) {
    const theme = THEMES.includes(slide.theme) ? slide.theme : "night";
    this.root.dataset.theme = theme;
    this.particles.setTheme(theme);
    if (this.current) {
      const old = this.current;
      if (opts.instant) old.remove(); else { old.classList.add("out"); setTimeout(() => old.remove(), 900); }
    }
    const [node, dur] = slide.kind === "msg" ? this.msgSlide(slide) : this.introSlide(slide);
    if (opts.instant) node.classList.add("instant");
    this.root.appendChild(node); this.current = node;
    this.root.classList.toggle("on-intro", slide.kind !== "msg");
    this.tag.hidden = !opts.fresh;
    if (opts.fresh) { this.tag.style.animation = "none"; void this.tag.offsetWidth; this.tag.style.animation = ""; }
    this.barFill.classList.remove("run"); void this.barFill.offsetWidth;
    if (opts.bar) { this.barFill.style.setProperty("--dur", dur + "ms"); this.barFill.classList.add("run"); }
    return dur;
  }
  msgSlide(m) {
    const node = el("div", "slide");
    const to = el("div", "s-to"); to.appendChild(el("small", null, "To.")); to.appendChild(document.createTextNode(m.to || "친구들"));
    to.style.setProperty("--d", ".25s");
    const p = el("p", "s-msg");
    const text = String(m.text || "");
    const len = Array.from(text).length;
    let fs = len <= 16 ? 9 : len <= 40 ? 7.2 : len <= 80 ? 5.8 : len <= 130 ? 4.8 : 4.1;
    if (m.theme === "chalk") fs *= 1.28;
    p.style.setProperty("--fs", fs + "cqmin");
    const reveal = Math.min(4.8, Math.max(1.2, len * .055));
    const step = len ? reveal / len : 0, start = .9;
    let i = 0;
    text.split("\n").forEach((line, li) => {
      if (li) p.appendChild(el("br"));
      line.split(/( +)/).forEach((tok) => {
        if (!tok) return;
        if (/^ +$/.test(tok)) { p.appendChild(document.createTextNode(" ")); i += tok.length; return; }
        const w = el("span", "w");
        Array.from(tok).forEach((ch) => { const s = el("span", "c", ch); s.style.setProperty("--d", (start + i * step).toFixed(3) + "s"); w.appendChild(s); i++; });
        p.appendChild(w);
      });
      i++;
    });
    const from = el("div", "s-from"); from.appendChild(el("small", null, "From.")); from.appendChild(document.createTextNode(m.from || "익명"));
    from.style.setProperty("--d", (start + reveal + .3).toFixed(2) + "s");
    node.append(to, p, from);
    const read = Math.min(9, Math.max(3.2, len * .085));
    return [node, Math.round((start + reveal + 1.2 + read) * 1000)];
  }
  introSlide(s) {
    const node = el("div", "slide intro");
    const label = el("div", "s-label", s.label || "MESSAGES"); label.style.setProperty("--d", ".2s");
    const title = el("h2", "s-title", s.title || ""); title.style.setProperty("--d", ".6s");
    node.append(label, title);
    if (s.sub) { const sub = el("p", "s-sub", s.sub); sub.style.setProperty("--d", "1.3s"); node.appendChild(sub); }
    if (s.count) { const c = el("div", "s-count", s.count); c.style.setProperty("--d", "2s"); node.appendChild(c); }
    if (s.join) {
      const j = el("div", "s-join"); j.style.setProperty("--d", "2.4s");
      if (s.join.qr) { const img = el("img"); img.src = s.join.qr; img.alt = "참여 QR 코드"; j.appendChild(img); }
      const tx = el("div", "s-join-text");
      tx.appendChild(el("div", "s-join-how", "QR을 찍거나 아래 주소에서 반 코드를 입력하세요"));
      tx.appendChild(el("div", "s-join-code", s.join.code));
      tx.appendChild(el("div", "s-join-url", s.join.url));
      j.appendChild(tx); node.appendChild(j);
    }
    return [node, s.dur || 8000];
  }
  setPaused(v) { this.root.classList.toggle("paused", v); }
}
