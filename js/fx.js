const INK = '#0e0e14';
const COLORS = ['#ffc83d', '#3bd497', '#ff6fb5', '#4f8cff', '#9b6bff', '#f6f1e7', '#ff9f43'];

const canvas = document.getElementById('fx');
const g = canvas.getContext('2d');
let particles = [];
let running = false;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
resize();
addEventListener('resize', resize);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function start() {
  if (running) return;
  running = true;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter((p) => {
      p.age += dt;
      if (p.age < 0) return true;
      if (p.age >= p.life) {
        p.onDone?.();
        return false;
      }
      if (p.update) {
        if (p.update(p, dt) === false) return false;
      } else {
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.rot += p.spin * dt;
      p.draw(p, Math.min(1, (p.life - p.age) / p.fade));
      return true;
    });
    if (particles.length) requestAnimationFrame(frame);
    else {
      g.clearRect(0, 0, innerWidth, innerHeight);
      running = false;
    }
  };
  requestAnimationFrame(frame);
}

function add(p) {
  particles.push({ gravity: 900, drag: 0.995, spin: 0, rot: 0, fade: 0.4, age: -(p.delay || 0), vx: 0, vy: 0, ...p });
  start();
}

const center = (el) => {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const drawCoin = (p, a) => {
  g.save();
  g.globalAlpha = a;
  g.translate(p.x, p.y);
  g.scale(Math.max(0.15, Math.abs(Math.cos(p.rot))), 1);
  g.fillStyle = '#ffc83d';
  g.strokeStyle = INK;
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(0, 0, p.r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#c98f12';
  g.beginPath();
  g.arc(p.r * 0.2, p.r * 0.2, p.r * 0.45, 0, Math.PI * 2);
  g.fill();
  g.restore();
};

const drawConfetti = (p, a) => {
  g.save();
  g.globalAlpha = a;
  g.translate(p.x, p.y);
  g.rotate(p.rot);
  g.scale(1, Math.sin(p.rot * 2.3) || 0.1);
  g.fillStyle = p.color;
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  g.beginPath();
  if (p.round) g.arc(0, 0, p.w / 2, 0, Math.PI * 2);
  else g.rect(-p.w / 2, -p.h / 2, p.w, p.h);
  g.fill();
  g.stroke();
  g.restore();
};

function starPath(r) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.38;
    const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  g.closePath();
}

const drawStar = (p, a) => {

  const t = p.age / p.life;
  const s = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
  g.save();
  g.globalAlpha = a;
  g.translate(p.x, p.y);
  g.rotate(p.rot);
  g.scale(s, s);
  starPath(p.r);
  g.fillStyle = p.color;
  g.strokeStyle = INK;
  g.lineWidth = 2.5;
  g.lineJoin = 'round';
  g.fill();
  g.stroke();
  g.restore();
};

const drawRing = (p, a) => {
  const t = p.age / p.life;
  const r = p.r * (1 - Math.pow(1 - t, 3));
  const w = p.width * (1 - t) + 1;
  g.save();
  g.globalAlpha = a;
  g.beginPath();
  g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.strokeStyle = INK;
  g.lineWidth = w + 5;
  g.stroke();
  g.strokeStyle = p.color;
  g.lineWidth = w;
  g.stroke();
  g.restore();
};

const drawDust = (p, a) => {
  const t = p.age / p.life;
  g.save();
  g.globalAlpha = a * 0.9;
  g.fillStyle = p.color;
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(p.x, p.y, p.r * (0.6 + t * 0.8), 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
};

const drawText = (p, a) => {

  const t = Math.min(1, p.age / 0.28);
  const s = t < 1 ? 0.3 + 1.05 * Math.sin(t * Math.PI * 0.75) : 1;
  g.save();
  g.globalAlpha = a;
  g.translate(p.x, p.y);
  g.rotate(p.tilt);
  g.scale(s, s);
  g.font = `${p.size}px 'Lilita One', sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(6, p.size / 4);
  g.strokeStyle = INK;
  g.strokeText(p.text, 0, p.size * 0.08);
  g.strokeText(p.text, 0, 0);
  g.fillStyle = p.color;
  g.fillText(p.text, 0, 0);
  g.restore();
};

export const fx = {

  coinsTo(fromEl, toEl, count = 12, onArrive) {
    if (reduced) return;
    const from = center(fromEl);
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + rand(-1.3, 1.3);
      const speed = rand(250, 520);
      add({
        x: from.x, y: from.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        r: rand(8, 12), spin: rand(8, 16), rot: rand(0, 6), life: 3, fade: 0.1, delay: i * 0.025,
        draw: drawCoin,
        update(p, dt) {
          if (p.age < 0.38 || !toEl?.isConnected) {
            p.vy += 1100 * dt;
            p.vx *= 0.97;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return p.y < innerHeight + 40;
          }
          const to = center(toEl);
          const k = Math.min(1, dt * (4 + (p.age - 0.38) * 22));
          p.x += (to.x - p.x) * k;
          p.y += (to.y - p.y) * k;
          if (Math.hypot(to.x - p.x, to.y - p.y) < 14) {
            onArrive?.(i);
            return false;
          }
          return true;
        },
      });
    }
  },

  coinBurst(el, count = 24) {
    if (reduced) return;
    const { x, y } = center(el);
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + rand(-0.9, 0.9);
      const speed = rand(380, 820);
      add({
        x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        r: rand(7, 12), spin: rand(6, 16), rot: rand(0, 6), life: rand(1.4, 2), fade: 0.4, draw: drawCoin,
      });
    }
  },

  ring(el, color = '#f6f1e7', radius = 140) {
    if (reduced) return;
    const { x, y } = center(el);
    add({ x, y, r: radius, width: 14, color, life: 0.5, fade: 0.25, draw: drawRing, update: () => true });
  },

  stars(el, count = 10, spread = 140) {
    if (reduced) return;
    const { x, y } = center(el);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const dist = rand(spread * 0.5, spread);
      add({
        x: x + Math.cos(ang) * dist * 0.3, y: y + Math.sin(ang) * dist * 0.3,
        vx: Math.cos(ang) * dist * 1.6, vy: Math.sin(ang) * dist * 1.6,
        r: rand(9, 16), color: pick(['#ffc83d', '#f6f1e7', '#ffc83d']), spin: rand(-4, 4),
        gravity: 0, drag: 0.9, life: rand(0.55, 0.8), fade: 0.2, draw: drawStar, delay: rand(0, 0.08),
      });
    }
  },

  confettiBurst(el, count = 60) {
    if (reduced) return;
    const { x, y } = center(el);
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + rand(-1.1, 1.1);
      const speed = rand(400, 950);
      confettiPiece(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, i);
    }
  },

  confettiCannons(count = 120) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0;
      const ang = left ? rand(-1.25, -0.85) : Math.PI - rand(-1.25, -0.85);
      const speed = rand(1300, 2000) * Math.sqrt(innerHeight / 800);
      confettiPiece(left ? -10 : innerWidth + 10, innerHeight + 10, Math.cos(ang) * speed, Math.sin(ang) * speed, i, rand(0, 0.25), rand(2.8, 3.8), 0.993);
    }
  },

  confettiRain(count = 160) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      confettiPiece(rand(0, innerWidth), rand(-200, -10), rand(-60, 60), rand(50, 200), i, rand(0, 1.2), 3.5);
    }
  },

  dust(el, count = 10) {
    if (reduced) return;
    const r = el?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : innerWidth / 2;
    const y = r ? r.bottom - 6 : innerHeight / 2;
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      add({
        x: x + dir * rand(10, 40), y, vx: dir * rand(60, 200), vy: rand(-80, -20), r: rand(7, 13),
        color: pick(['#6d6b80', '#a4a2b4', '#40405a']), gravity: 40, drag: 0.92, life: rand(0.5, 0.8), fade: 0.35, draw: drawDust,
      });
    }
  },

  flakesAt(x, y, count = 2) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      add({
        x, y, vx: rand(-160, 160), vy: rand(-220, -60), w: rand(4, 8), h: rand(3, 6),
        color: pick(['#c7c9d6', '#a4a2b4', '#e4e5ee']), spin: rand(-14, 14), rot: rand(0, 6),
        gravity: 1100, drag: 0.98, life: rand(0.5, 0.9), fade: 0.3, draw: drawConfetti,
      });
    }
  },

  bubblesAt(x, y, count = 3) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      add({
        x: x + rand(-14, 14), y: y + rand(-8, 8), vx: rand(-50, 50), vy: rand(-140, -50), r: rand(4, 10),
        color: pick(['#f6f1e7', '#d9f3ff', '#ffffff']), gravity: -60, drag: 0.97, life: rand(0.5, 0.9), fade: 0.3, draw: drawDust,
      });
    }
  },

  popText(el, text, { color = '#3bd497', size = 40, dy = -60, rise = 70 } = {}) {
    const { x, y } = center(el);
    add({
      x, y: y + dy, vx: 0, vy: -rise, gravity: 0, drag: 0.97, text, color, size,
      tilt: rand(-0.12, 0.06), life: 1.5, fade: 0.45, draw: drawText,
    });
  },

  celebrate(el, level = 1) {
    fx.ring(el, level >= 3 ? '#ffc83d' : '#f6f1e7', 70 + level * 25);
    fx.stars(el, 6 + level * 4, 100 + level * 30);
    if (level >= 2) fx.confettiBurst(el, 30 + level * 20);
    if (level >= 3) {
      fx.confettiCannons(level >= 4 ? 200 : 110);
      fx.shake(document.getElementById('app'), level >= 4);
    }
    if (level >= 4) {
      fx.confettiRain(180);
      fx.coinBurst(el, 40);
    }
  },

  shake(el = document.getElementById('app'), strong = false) {
    if (reduced || !el) return;
    el.classList.remove('shake', 'shake-strong');
    void el.offsetWidth;
    const cls = strong ? 'shake-strong' : 'shake';
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  },

  thump(el) {
    if (reduced || !el) return;
    el.classList.remove('thump');
    void el.offsetWidth;
    el.classList.add('thump');
  },
};

function confettiPiece(x, y, vx, vy, i, delay = 0, life = rand(2.4, 3.6), drag = 0.982) {
  const w = rand(8, 14);
  add({
    x, y, vx, vy, w, h: w * rand(1.3, 1.8), round: Math.random() < 0.25,
    color: COLORS[i % COLORS.length], spin: rand(-12, 12), rot: rand(0, 6),
    gravity: 650, drag, life, fade: 0.7, delay, draw: drawConfetti,
    update(p, dt) {
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      if (p.vy > 220) p.vy = 220;
      p.x += (p.vx + Math.sin(p.age * 6 + i) * 40) * dt;
      p.y += p.vy * dt;
      return p.y < innerHeight + 60;
    },
  });
}
