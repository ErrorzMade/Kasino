import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll } from '../state.js';

const ROWS = 12;
const RISKS = {
  low: [8, 3, 1.5, 1.3, 1.1, 1, 0.4, 1, 1.1, 1.3, 1.5, 3, 8],
  medium: [25, 8, 3.5, 2, 1.2, 0.6, 0.25, 0.6, 1.2, 2, 3.5, 8, 25],
  high: [140, 24, 8, 2, 0.6, 0.2, 0.2, 0.2, 0.6, 2, 8, 24, 140],
};
const INK = '#0e0e14';
const HOP_MS = 120;

function bucketColor(m) {
  if (m >= 10) return '#e5484d';
  if (m >= 3) return '#ff9f43';
  if (m > 1) return '#ffc83d';
  if (m === 1) return '#3bd497';
  return '#40405a';
}

function rollPath() {
  const steps = Array.from({ length: ROWS }, () => (Math.random() < 0.5 ? 1 : 0));
  return { steps, bucket: steps.reduce((a, b) => a + b, 0) };
}

const anchorAt = (x, y) => ({ getBoundingClientRect: () => ({ left: x, top: y, width: 0, height: 0, right: x, bottom: y }) });

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage plinko-stage">
        <div class="result-banner"></div>
        <canvas class="plinko-canvas"></canvas>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <span class="label">Risk</span>
          <div class="seg seg3" role="group" aria-label="Risk">
            <button data-risk="low">Low</button><button data-risk="medium" class="on">Medium</button><button data-risk="high">High</button>
          </div>
          <button class="btn big gold" data-act="drop">Drop ball</button>
          <span class="hint">Space to drop · drop as many as you like</span>
        </div>
        <div class="panel">
          <div class="stat-list">
            <div class="stat"><span>In play</span><b data-live>0</b></div>
            <div class="stat"><span>Best hit</span><b data-best>—</b></div>
          </div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const canvas = q('canvas');
  const g = canvas.getContext('2d');
  const banner = q('.result-banner');
  const dropBtn = q('[data-act=drop]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let risk = 'medium';
  let balls = [];
  let flashes = new Map();
  let bumps = new Array(ROWS + 1).fill(0);
  let best = 0;
  let raf = 0;
  let L = null;

  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.min(stage.clientWidth - 32, 620);
    const H = Math.round(W * 0.92);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = W / (ROWS + 3);
    const top = sx * 1.2;
    const sy = (H - top - sx * 1.6) / ROWS;
    L = { W, H, sx, sy, top, cx: W / 2, pegR: Math.max(4, sx * 0.15), ballR: Math.max(7, sx * 0.27) };
    draw();
  }

  const pegPos = (r, i) => ({ x: L.cx + (i - (r + 2) / 2) * L.sx, y: L.top + r * L.sy });
  const bucketX = (k) => L.cx + (k - ROWS / 2) * L.sx;
  const bucketY = () => L.top + ROWS * L.sy + L.sx * 0.15;

  function contact(r, k) {
    if (r === ROWS) return { x: bucketX(k), y: bucketY() + L.sx * 0.25 };
    const p = pegPos(r, k + 1);
    return { x: p.x, y: p.y - L.pegR - L.ballR };
  }

  function ballPos(b) {
    const k0 = b.path.steps.slice(0, b.seg).reduce((a, s) => a + s, 0);
    const from = b.seg === 0 ? { x: L.cx, y: L.top - L.sy * 1.2 } : contact(b.seg - 1, k0 - b.path.steps[b.seg - 1]);
    const to = contact(b.seg, k0);
    const t = b.t;
    const hop = b.seg === 0 ? 0 : L.sy * 0.45;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t * t - hop * 4 * t * (1 - t) };
  }

  function draw() {
    if (!L) return;
    g.clearRect(0, 0, L.W, L.H);

    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < r + 3; i++) {
        const { x, y } = pegPos(r, i);
        const lit = flashes.get(`${r},${i}`) > 0;
        g.beginPath();
        g.arc(x, y, L.pegR * (lit ? 1.35 : 1), 0, Math.PI * 2);
        g.fillStyle = lit ? '#ffffff' : '#a4a2b4';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = INK;
        g.stroke();
      }
    }

    const mults = RISKS[risk];
    const bw = L.sx * 0.9;
    const bh = L.sx * 0.75;
    for (let k = 0; k <= ROWS; k++) {
      const x = bucketX(k) - bw / 2;
      const y = bucketY() + bumps[k] * 8;
      g.beginPath();
      g.roundRect(x, y, bw, bh, 6);
      g.fillStyle = bucketColor(mults[k]);
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.stroke();
      const label = mults[k] >= 100 ? `${mults[k]}` : `${mults[k]}×`;
      g.font = `${Math.max(9, Math.min(14, bw * 0.3))}px 'Lilita One', sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.strokeText(label, x + bw / 2, y + bh / 2 + 1);
      g.fillStyle = '#fff';
      g.fillText(label, x + bw / 2, y + bh / 2 + 1);
    }

    for (const b of balls) {
      const p = ballPos(b);
      g.beginPath();
      g.arc(p.x, p.y, L.ballR, 0, Math.PI * 2);
      g.fillStyle = '#ffc83d';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.arc(p.x - L.ballR * 0.3, p.y - L.ballR * 0.3, L.ballR * 0.25, 0, Math.PI * 2);
      g.fillStyle = '#fff3c4';
      g.fill();
    }
  }

  function loop() {
    let last = performance.now();
    const frame = (now) => {
      const dt = now - last;
      last = now;
      for (const [k, v] of flashes) v - dt <= 0 ? flashes.delete(k) : flashes.set(k, v - dt);
      bumps = bumps.map((v) => Math.max(0, v - dt / 220));
      for (const b of [...balls]) {
        b.t += dt / (b.seg === 0 ? HOP_MS * 1.6 : HOP_MS);
        while (b.t >= 1) {
          b.t -= 1;
          if (b.seg < ROWS) {
            const k0 = b.path.steps.slice(0, b.seg).reduce((a, s) => a + s, 0);
            flashes.set(`${b.seg},${k0 + 1}`, 140);
            sfx.peg();
          }
          b.seg += 1;
          if (b.seg > ROWS) {
            land(b);
            break;
          }
        }
      }
      draw();
      if (balls.length || flashes.size || bumps.some((v) => v > 0)) raf = requestAnimationFrame(frame);
      else raf = 0;
    };
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function sync() {
    bet.setDisabled(false);
    el.querySelectorAll('[data-risk]').forEach((b) => {
      b.classList.toggle('on', b.dataset.risk === risk);
      b.disabled = balls.length > 0;
    });
    dropBtn.textContent = `Drop ${money(bet.value || 0)}`;
    q('[data-live]').textContent = balls.length;
    q('[data-best]').textContent = best ? `${best}×` : '—';
  }

  function drop() {
    if (ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    let path = rollPath();
    let lucky = false;
    if (RISKS[risk][path.bucket] < 1 && luckyReroll()) {
      path = rollPath();
      lucky = RISKS[risk][path.bucket] > 1;
    }
    balls.push({ path, seg: 0, t: 0, stake, mult: RISKS[risk][path.bucket], lucky });
    sfx.chip();
    sync();
    loop();
  }

  function land(b) {
    balls = balls.filter((x) => x !== b);
    const k = b.path.bucket;
    bumps[k] = 1;
    const amount = Math.round(b.mult * b.stake * 100) / 100;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / L.W;
    const anchor = anchorAt(rect.left + bucketX(k) * scale, rect.top + bucketY() * scale);
    if (amount > 0) ctx.payout(amount, b.stake);
    best = Math.max(best, b.mult);
    if (b.mult >= 2) {
      const level = juice.bankWin(anchor, amount, b.stake);
      if (b.lucky) juice.lucky(anchor);
      if (level >= 3) showBanner(b.mult >= 20 ? 'JACKPOT!' : 'BIG HIT!', 'win');
    } else if (b.mult > 1) {
      sfx.plink(3);
      fx.popText(anchor, `${b.mult}×`, { size: 24, color: '#ffc83d', dy: -20, rise: 60 });
    } else {
      sfx.thunk();
      fx.popText(anchor, `${b.mult}×`, { size: 20, color: '#a4a2b4', dy: -20, rise: 40 });
    }

    if (!balls.length) {
      ctx.roundSettled();
    }
    sync();
  }

  el.addEventListener('click', (e) => {
    const r = e.target.closest('[data-risk]');
    if (r && !balls.length) {
      risk = r.dataset.risk;
      sfx.click();
      sync();
      draw();
    }
  });
  dropBtn.addEventListener('click', drop);
  canvas.addEventListener('click', drop);
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      drop();
    }
  };
  addEventListener('keydown', onKey);
  const ro = new ResizeObserver(layout);
  ro.observe(stage);
  layout();
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (balls.length) {
      for (const b of balls) ctx.payout(Math.round(b.mult * b.stake * 100) / 100, b.stake);
      balls = [];
      ctx.roundSettled();
    }
  };
}
