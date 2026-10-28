import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll, perkCount } from '../state.js';

const RATE = 0.14;
const MAX_CRASH = 1000;
const INK = '#0e0e14';

const ROCKET = `
  <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
    <path class="flame" d="M14 36 L2 32 L14 28 L8 32z" fill="#ffc83d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 22 L40 22 C52 22 60 28 62 32 C60 36 52 42 40 42 L14 42z" fill="#f6f1e7" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M50 26 C56 28 60 30 62 32 C60 34 56 36 50 38z" fill="#e5484d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="34" cy="32" r="6" fill="#4fd1ff" stroke="${INK}" stroke-width="3"/>
    <path d="M18 22 L10 10 L26 22z M18 42 L10 54 L26 42z" fill="#e5484d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;

function drawCrashPoint() {
  const u = Math.random();
  const x = (0.97 * (1 + 0.06 * perkCount('crash'))) / (1 - u);
  return x < 1 ? 1 : Math.min(MAX_CRASH, Math.floor(x * 100) / 100);
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage crash-stage">
        <canvas class="crash-canvas"></canvas>
        <div class="crash-rocket">${ROCKET}</div>
        <div class="crash-mult" data-mult>1.00×</div>
        <div class="crash-note" data-note>Place a bet and launch</div>
        <div class="crash-history"></div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <span class="label">Auto cash out (optional)</span>
          <label class="bet-input auto-input"><input type="number" min="1.01" step="0.01" placeholder="off" aria-label="Auto cash out multiplier" />×</label>
          <button class="btn big loss" data-act="launch">Launch</button>
          <button class="btn big win" data-act="cash" hidden>Cash out</button>
          <span class="hint">Space to launch / cash out</span>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const canvas = q('canvas');
  const g = canvas.getContext('2d');
  const rocket = q('.crash-rocket');
  const multEl = q('[data-mult]');
  const note = q('[data-note]');
  const history = q('.crash-history');
  const launchBtn = q('[data-act=launch]');
  const cashBtn = q('[data-act=cash]');
  const autoInput = q('.auto-input input');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let phase = 'idle';
  let flying = false;
  let stake = 0;
  let crashAt = 1;
  let t0 = 0;
  let m = 1;
  let raf = 0;
  let lastEngine = 0;
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(flying ? (performance.now() - t0) / 1000 : 0);
  }

  const PAD = { l: 50, r: 70, t: 90, b: 40 };
  function scale(t) {
    const tMax = Math.max(8, t * 1.15);
    const mMax = Math.max(2, Math.exp(RATE * t) * 1.25);
    const x = (tt) => PAD.l + (tt / tMax) * (W - PAD.l - PAD.r);
    const y = (mm) => H - PAD.b - ((mm - 1) / (mMax - 1)) * (H - PAD.t - PAD.b);
    return { x, y, tMax, mMax };
  }

  function draw(t, crashed = false) {
    if (!W) return;
    g.clearRect(0, 0, W, H);
    const { x, y, mMax } = scale(t);

    g.font = "13px 'Lilita One', sans-serif";
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    const steps = [1.5, 2, 3, 5, 10, 20, 50, 100, 250, 500, 1000].filter((v) => v < mMax);
    for (const v of [1, ...steps.filter((_, i) => i % Math.ceil(steps.length / 5) === 0)]) {
      g.strokeStyle = '#2a2a38';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(PAD.l, y(v));
      g.lineTo(W - PAD.r + 30, y(v));
      g.stroke();
      g.fillStyle = '#6d6b80';
      g.fillText(`${v}×`, PAD.l - 8, y(v));
    }
    if (t <= 0) return;

    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const tt = (t * i) / 60;
      const px = x(tt);
      const py = y(Math.exp(RATE * tt));
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.stroke();
    g.strokeStyle = crashed ? '#e5484d' : '#ffc83d';
    g.lineWidth = 6;
    g.stroke();

    const tipX = x(t);
    const tipY = y(Math.exp(RATE * t));
    const dt = 0.05;
    const ang = Math.atan2(y(Math.exp(RATE * (t + dt))) - tipY, x(t + dt) - tipX);
    rocket.style.transform = `translate(${tipX - 32}px, ${tipY - 32}px) rotate(${ang}rad)`;
  }

  function sync() {
    const live = phase === 'flying';
    bet.setDisabled(phase !== 'idle');
    autoInput.disabled = phase !== 'idle';
    launchBtn.hidden = live;
    launchBtn.disabled = phase !== 'idle';
    launchBtn.textContent = phase === 'watching' ? 'Waiting for crash…' : `Launch ${money(bet.value || 0)}`;
    cashBtn.hidden = !live;
    cashBtn.textContent = `Cash out ${money(Math.floor(stake * m * 100) / 100)}`;
  }

  function launch() {
    if (phase !== 'idle' || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    crashAt = drawCrashPoint();
    if (luckyReroll()) crashAt = Math.max(crashAt, drawCrashPoint());
    phase = 'flying';
    flying = true;
    m = 1;
    t0 = performance.now();
    stage.classList.remove('crashed');
    stage.classList.add('flying');
    multEl.className = 'crash-mult';
    note.textContent = '';
    sfx.whoosh();
    sync();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      m = Math.floor(Math.exp(RATE * t) * 100) / 100;
      const auto = Number(autoInput.value);
      if (phase === 'flying' && auto > 1 && m >= auto && auto < crashAt) cashOut(auto);
      if (m >= crashAt) {
        explode(crashAt, Math.log(crashAt) / RATE);
        return;
      }
      multEl.textContent = `${m.toFixed(2)}×`;
      multEl.classList.toggle('hot', m >= 2);
      draw(t);
      if (now - lastEngine > 220) {
        sfx.engine(m);
        lastEngine = now;
      }
      if (phase === 'flying') cashBtn.textContent = `Cash out ${money(Math.floor(stake * m * 100) / 100)}`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function cashOut(at = m) {
    if (phase !== 'flying') return;
    const amount = Math.floor(stake * at * 100) / 100;
    phase = 'watching';
    ctx.payout(amount, stake);
    juice.bankWin(cashBtn, amount, stake);
    note.textContent = `You cashed out at ${at.toFixed(2)}×`;
    note.className = 'crash-note good';
    ctx.roundSettled();
    sync();
  }

  function explode(at, t) {
    flying = false;
    const lost = phase === 'flying';
    multEl.textContent = `${at.toFixed(2)}×`;
    multEl.className = 'crash-mult crashed';
    stage.classList.remove('flying');
    stage.classList.add('crashed');
    draw(t, true);
    sfx.boom();
    fx.ring(rocket, '#ff9f43', 120);
    fx.dust(rocket, 14);
    fx.shake(stage, true);
    history.prepend(h(`<span class="${at >= 2 ? 'hi' : ''}">${at.toFixed(2)}×</span>`));
    while (history.children.length > 8) history.lastElementChild.remove();
    if (lost) {
      note.textContent = `Crashed at ${at.toFixed(2)}×`;
      note.className = 'crash-note bad';
      juice.flash();
      ctx.roundSettled();
    } else {
      note.textContent += ` · it crashed at ${at.toFixed(2)}×`;
    }
    phase = 'idle';
    sync();
  }

  launchBtn.addEventListener('click', launch);
  cashBtn.addEventListener('click', () => cashOut());
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      phase === 'flying' ? cashOut() : launch();
    }
  };
  addEventListener('keydown', onKey);
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (phase === 'flying') {
      ctx.payout(Math.floor(stake * m * 100) / 100, stake);
      ctx.roundSettled();
    }
  };
}
