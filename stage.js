// 상영 화면: 배경 입자 + 글자가 한 자씩 나타나는 메시지 슬라이드
export const THEMES = ["blossom", "night", "chalk", "sky", "grad"];
export const THEME_NAMES = { blossom: "벚꽃", night: "밤하늘", chalk: "칠판", sky: "종이비행기", grad: "졸업 축하" };
export const THEME_DOT = { blossom: "#F08FB1", night: "#3A3A86", chalk: "#2E5A47", sky: "#7FC4F0", grad: "#E8B64A" };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// 메시지 한 장의 시간 계산 (k: 속도 배율, 1 = 보통, 클수록 느림)
export function msgTiming(text, k = 1) {
  const len = Array.from(String(text || "")).length;
  const start = .9;
  const reveal = Math.min(4.8, Math.max(1.2, len * .055)) * k;
  const read = Math.min(9, Math.max(3.2, len * .085)) * k;
  return { len, start, reveal, fromAt: start + reveal + .3, dur: Math.round((start + reveal + 1.2 + read) * 1000) };
}
export const GROUP_STAGGER = .7; // 여러 장을 함께 보여 줄 때 카드끼리 시작 간격(초)
// 한 화면에 여러 장이 함께 나올 때의 시간: 가장 늦게 끝나는 카드 + 함께 읽을 여유
export function groupDuration(items, k = 1) {
  if (items.length === 1) return msgTiming(items[0].text, k).dur;
  let mx = 0;
  items.forEach((m, i) => { mx = Math.max(mx, i * GROUP_STAGGER * 1000 + msgTiming(m.text, k).dur); });
  return Math.round(mx + (items.length - 1) * 2000 * k);
}

/* ---------- 메모지 ---------- */
// edges: [위, 오른쪽, 아래, 왼쪽] 가장자리 모양 (s 반듯, t 찢김, z 지그재그)
const NOTE_SPEC = {
  whiteTorn:  { edges: "ssts", tapes: ["top lav"] },
  beigeTorn:  { edges: "ssts", tapes: ["top coral"] },
  lavFold:    { fold: true, tapes: ["top mint"] },
  sticky:     { fold: true, tapes: ["top blue wide"] },
  lined:      { tapes: ["tl navy", "tr navy"] },
  grid:       { tapes: ["top terra small"] },
  pinkLined:  { tapes: ["tl orange", "tr orange"] },
  skyHoles:   { clip: true },
  zigzag:     { edges: "zszs", tapes: ["top mint"] },
  kraftTorn:  { edges: "ssts", tapes: ["tl milk"] },
  dotCream:   { tapes: ["tl pink", "br pink"] },
  mintRound:  { tapes: ["top yellow"] },
};
const ALL_NOTES = Object.keys(NOTE_SPEC);
// 학생이 고른 분위기에 어울리는 메모지 묶음
const NOTE_FAMILY = {
  blossom: ["pinkLined", "zigzag", "beigeTorn", "whiteTorn"],
  sky: ["skyHoles", "grid", "whiteTorn", "mintRound"],
  chalk: ["lined", "dotCream", "kraftTorn", "grid"],
  night: ["lavFold", "sticky", "dotCream", "mintRound"],
  grad: ["sticky", "whiteTorn", "beigeTorn", "lined"],
};
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function edgeClip(edges, rnd) {
  const pts = [];
  const side = (kind, along) => {
    // along(p, f): p = 0..100 진행, f = 안쪽으로 들어간 깊이(%)
    if (kind === "s") { along(0, 0); return; }
    let p = 0, up = false;
    while (p < 100) {
      const f = kind === "z" ? (up ? 0 : 2.2) : rnd() * 2.4 + (rnd() < .15 ? 1.4 : 0);
      along(p, f); up = !up;
      p += kind === "z" ? 2.2 : 1.2 + rnd() * 2.6;
    }
  };
  side(edges[0], (p, f) => pts.push([p, f]));
  side(edges[1], (p, f) => pts.push([100 - f, p]));
  side(edges[2], (p, f) => pts.push([100 - p, 100 - f]));
  side(edges[3], (p, f) => pts.push([f, 100 - p]));
  return "polygon(" + pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",") + ")";
}
function tapeClip(rnd) {
  // 테이프 양 끝을 톱니처럼
  const L = [], R = [];
  for (let y = 0; y <= 100; y += 20) { L.push([(rnd() * 5).toFixed(1), y]); R.push([(95 + rnd() * 5).toFixed(1), 100 - y]); }
  return "polygon(" + [...L, ...R].map(([x, y]) => `${x}% ${y}%`).join(",") + ")";
}
const STICKERS = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.2 1.7-2 3.1-3.2 5.3-3.2 3.8 0 5.8 4.1 4.3 7.4C19.5 16.4 12 21 12 21z" fill="#F7A1BC"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c.9 5.6 3.5 8.6 10.5 10.5-7 1.9-9.6 4.9-10.5 10.5-.9-5.6-3.5-8.6-10.5-10.5 7-1.9 9.6-4.9 10.5-10.5z" fill="#AFC6F6"/></svg>',
  smile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#FCE38A"/><circle cx="8.6" cy="10.2" r="1.1" fill="#E07C95"/><circle cx="15.4" cy="10.2" r="1.1" fill="#E07C95"/><path d="M8.3 14c1.9 2.4 5.5 2.4 7.4 0" stroke="#E07C95" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  clover: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="#C7E480"><circle cx="12" cy="6.5" r="5"/><circle cx="17.5" cy="12" r="5"/><circle cx="12" cy="17.5" r="5"/><circle cx="6.5" cy="12" r="5"/></g></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17.1l-6.1 3.4 1.4-6.7-5-4.6 6.8-.8z" fill="#F9D978" stroke="#F9D978" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  loop: '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M2 18c5-1 8-5 8-9s-4-5-5-2 3 7 8 7 7-3 6-6-5-2-4 2 5 7 15 6" stroke="#B5D5F6" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
  clip: '<svg viewBox="0 0 24 48" aria-hidden="true"><path d="M16 14v22a6 6 0 0 1-12 0V10a4 4 0 0 1 8 0v24a2 2 0 0 1-4 0V14" stroke="#F07C9A" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
};

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
    } else if (t === "grad") {
      // 하늘로 던진 학사모 + 금색 꽃가루
      const nc = Math.round(Math.min(10, Math.max(5, w / 160)));
      for (let i = 0; i < nc; i++) add(this.cap(i / nc));
      const n = Math.round(Math.min(90, area / 9000));
      const cols = ["#FFD36E", "#FFE9A8", "#FFFFFF", "#9CC9FF", "#FF9EC4", "#F2B84B"];
      for (let i = 0; i < n; i++) add({ k: "conf", x: R() * w, y: R() * h, cw: (3 + R() * 3) * Math.max(k, .6), ch: (7 + R() * 6) * Math.max(k, .6), vy: .5 + R() * 1.1, ph: R() * 6, r: R() * 6, vr: (R() - .5) * .08, col: cols[i % cols.length] });
    }
  }
  cap(spread) {
    // 아래에서 위로 던져졌다가 중력으로 떨어짐 (spread: 처음 화면에 골고루 흩어 두기)
    const k = Math.min(this.w, this.h) / 600, R = Math.random;
    const c = { k: "cap", x: this.w * (.08 + R() * .84), y: this.h + 40, vx: (R() - .5) * 1.6, vy: -(7.5 + R() * 3.5) * Math.max(Math.sqrt(this.h / 600), .55), g: .11 * Math.max(Math.sqrt(this.h / 600), .55),
      s: (36 + R() * 22) * Math.max(k, .45), r: (R() - .5) * .6, vr: (R() - .5) * .07, wait: 0 };
    if (spread != null) { // 처음엔 이미 날아가는 중인 것처럼
      const steps = Math.floor(spread * 160 + R() * 40);
      for (let i = 0; i < steps; i++) { c.x += c.vx; c.y += c.vy; c.vy += c.g; c.r += c.vr; }
    }
    return c;
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
      } else if (p.k === "cap") {
        if (p.wait > 0) { p.wait -= f; continue; }
        p.x += p.vx * f; p.y += p.vy * f; p.vy += p.g * f; p.r += p.vr * f;
        if (p.vy > 0 && p.y > h + 60) { if (!p.dying) Object.assign(p, this.cap(), { wait: Math.random() * 90 }); continue; }
        const s = p.s; x.save(); x.translate(p.x, p.y); x.rotate(p.r);
        // 모자 아래 부분
        x.beginPath(); x.moveTo(-s * .52, s * .05); x.lineTo(s * .52, s * .05); x.lineTo(s * .44, s * .55); x.quadraticCurveTo(0, s * .7, -s * .44, s * .55); x.closePath();
        x.fillStyle = "#1E2340"; x.fill(); x.strokeStyle = "rgba(255,214,120,.45)"; x.lineWidth = Math.max(1, s * .035); x.stroke();
        // 사각 판 (살짝 기울어진 마름모)
        x.beginPath(); x.moveTo(0, -s * .42); x.lineTo(s, 0); x.lineTo(0, s * .42); x.lineTo(-s, 0); x.closePath();
        const bg = x.createLinearGradient(-s, -s * .4, s, s * .4); bg.addColorStop(0, "#3A4170"); bg.addColorStop(1, "#11152A");
        x.fillStyle = bg; x.fill(); x.strokeStyle = "rgba(255,220,140,.8)"; x.lineWidth = Math.max(1.2, s * .05); x.stroke();
        // 단추와 술
        x.fillStyle = "#FFCF5A"; x.beginPath(); x.arc(0, 0, s * .07, 0, 6.283); x.fill();
        const sw = Math.sin(t * 3 + p.x * .01) * s * .08;
        x.strokeStyle = "#FFCF5A"; x.lineWidth = Math.max(1.2, s * .06); x.lineCap = "round";
        x.beginPath(); x.moveTo(0, 0); x.lineTo(s * .62, s * .14); x.lineTo(s * .62 + sw, s * .72); x.stroke();
        x.fillStyle = "#FFCF5A"; x.fillRect(s * .62 + sw - s * .06, s * .68, s * .12, s * .2);
        x.restore();
      } else if (p.k === "conf") {
        p.y += p.vy * f; p.x += Math.sin(t * 1.6 + p.ph) * .5 * f; p.r += p.vr * f;
        if (p.y > h + 12) { p.y = -12; p.x = Math.random() * w; }
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(t * 3 + p.ph));
        x.fillStyle = p.col; x.fillRect(-p.cw / 2, -p.ch / 2, p.cw, p.ch); x.restore();
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
    let theme = slide.theme;
    if (slide.kind === "group") {
      // 메모지들 중 가장 많이 고른 배경을 뒤에 깔기 (같으면 첫 메시지 것)
      const cnt = {}; slide.items.forEach((m) => (cnt[m.theme] = (cnt[m.theme] || 0) + 1));
      theme = slide.items.map((m) => m.theme).sort((a, b) => cnt[b] - cnt[a])[0];
    }
    theme = THEMES.includes(theme) ? theme : "night";
    this.root.dataset.theme = theme;
    this.particles.setTheme(theme);
    if (this.current) {
      const old = this.current;
      if (opts.instant) old.remove(); else { old.classList.add("out"); setTimeout(() => old.remove(), 900); }
    }
    const [node, dur] = slide.kind === "msg" ? this.msgSlide(slide) : slide.kind === "group" ? this.groupSlide(slide) : this.introSlide(slide);
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
    this.fillMsg(node, m, m.k || 1, 0, 1);
    return [node, msgTiming(m.text, m.k || 1).dur];
  }
  // 여러 장: 고른 배경 위에 메모지처럼 붙이기
  groupSlide(s) {
    const k = s.k || 1, n = s.items.length;
    const node = el("div", "slide group");
    node.style.setProperty("--n", n);
    const used = new Set();
    s.items.forEach((m, i) => {
      const rnd = seeded(hashStr(m.id || m.text || String(i)));
      const fam = NOTE_FAMILY[m.theme] || NOTE_FAMILY.blossom;
      let style = fam[Math.floor(rnd() * fam.length)];
      if (used.has(style)) style = fam.find((x) => !used.has(x)) || ALL_NOTES.find((x) => !used.has(x)) || style;
      used.add(style);
      const card = el("div", "mcard note n-" + style);
      const off = i * GROUP_STAGGER;
      card.style.setProperty("--d", off.toFixed(2) + "s");
      card.style.setProperty("--rot", ((rnd() - .5) * 5).toFixed(2) + "deg");
      card.style.setProperty("--ty", ((rnd() - .5) * 4).toFixed(2) + "cqh");
      const paper = el("div", "paper");
      const spec = NOTE_SPEC[style];
      if (spec.edges) paper.style.clipPath = edgeClip(spec.edges, rnd);
      card.appendChild(paper);
      if (spec.fold) card.appendChild(el("i", "fold"));
      (spec.tapes || []).forEach((t) => {
        const tape = el("i", "tape " + t);
        tape.style.setProperty("--tr", ((rnd() - .5) * 8).toFixed(1) + "deg");
        tape.style.clipPath = tapeClip(rnd);
        card.appendChild(tape);
      });
      if (spec.clip) { const c = el("span", "clip"); c.innerHTML = STICKERS.clip; card.appendChild(c); }
      const inner = el("div", "mc-in"); card.appendChild(inner);
      this.fillMsg(inner, m, k, off, n >= 3 ? 1.4 : 1.45, true);
      node.appendChild(card);
    });
    // 보드 가장자리에 작은 스티커 몇 개
    const rnd = seeded(hashStr(s.items.map((m) => m.id || "").join("|") || "board"));
    const spots = [[3, 4], [93, 5], [4, 88], [92, 86], [50, 3], [50, 92], [27, 94], [73, 2]].sort(() => rnd() - .5).slice(0, 5);
    const kinds = Object.keys(STICKERS).filter((x) => x !== "clip");
    spots.forEach(([x, y], i) => {
      const st = el("span", "sticker");
      st.innerHTML = STICKERS[kinds[Math.floor(rnd() * kinds.length)]];
      st.style.left = x + "%"; st.style.top = y + "%";
      st.style.setProperty("--rot", ((rnd() - .5) * 40).toFixed(0) + "deg");
      st.style.setProperty("--d", (.4 + i * .25 + n * GROUP_STAGGER).toFixed(2) + "s");
      st.style.setProperty("--sz", (4.5 + rnd() * 3).toFixed(1) + "cqmin");
      node.appendChild(st);
    });
    return [node, groupDuration(s.items, k)];
  }
  // 받는 사람 → 글자가 한 자씩 → 보내는 사람 순서로 채우기 (off: 시작 지연, mul: 글자 크기 배율)
  fillMsg(node, m, k, off, mul, note) {
    const T = msgTiming(m.text, k);
    const to = el("div", "s-to"); to.appendChild(el("small", null, "To.")); to.appendChild(document.createTextNode(m.to || "친구들"));
    to.style.setProperty("--d", (off + .25).toFixed(2) + "s");
    const p = el("p", "s-msg");
    const text = String(m.text || "");
    const len = T.len;
    let fs = len <= 16 ? 9 : len <= 40 ? 7.2 : len <= 80 ? 5.8 : len <= 130 ? 4.8 : 4.1;
    p.style.setProperty("--fs", (fs * mul).toFixed(2) + "cqmin");
    const reveal = T.reveal;
    const step = len ? reveal / len : 0, start = off + T.start;
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
    from.style.setProperty("--d", (off + T.fromAt).toFixed(2) + "s");
    node.append(to, p, from);
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
