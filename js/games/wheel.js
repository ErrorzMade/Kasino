import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { perkCount, subscribe, luckyReroll } from '../state.js';

const BASE_SLICES = [4.5, 0, 1.5, 0, 0.5, 1.5, 0, 2, 1.5, 0, 0.5, 1.5, 0, 1.5, 0, 2, 1.5, 0, 0.5, 0];
const GREASE_ORDER = [9, 19, 3, 14];

function currentSlices() {
  const slices = [...BASE_SLICES];
  GREASE_ORDER.slice(0, perkCount('wheel')).forEach((i) => (slices[i] = 1.5));
  return slices;
}
const STYLE = {
  0: { fill: '#2a2a38', label: 'BUST', text: '#e5484d' },
  0.5: { fill: '#4f8cff', label: '½', text: '#fff' },
  1.5: { fill: '#9b6bff', label: '1.5×', text: '#fff' },
  2: { fill: '#3bd497', label: '2×', text: '#fff' },
  4.5: { fill: '#ffc83d', label: '4.5×', text: '#fff' },
};
const N = BASE_SLICES.length;
const SEG = 360 / N;
const R = 180;
const SPIN_MS = 5600;

function wedge(i) {
  const a0 = ((i * SEG - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const p = (a) => `${(Math.cos(a) * R).toFixed(2)} ${(Math.sin(a) * R).toFixed(2)}`;
  return `M0 0 L${p(a0)} A${R} ${R} 0 0 1 ${p(a1)} Z`;
}

function wheelFace(SLICES) {
  const slices = SLICES.map((m, i) => {
    const s = STYLE[m];
    const mid = i * SEG + SEG / 2;
    return `
      <path class="slice" data-i="${i}" d="${wedge(i)}" fill="${s.fill}" stroke="#0e0e14" stroke-width="4" stroke-linejoin="round"/>
      <g transform="rotate(${mid})">
        <text x="0" y="-128" text-anchor="middle" dominant-baseline="middle"
          font-family="Lilita One, sans-serif" font-size="${m === 0 ? 17 : 24}" fill="${s.text}"
          stroke="#0e0e14" stroke-width="${m === 0 ? 0 : 6}" paint-order="stroke"
          transform="rotate(90 0 -128)">${s.label}</text>
      </g>`;
  }).join('');
  const pegs = SLICES.map((_, i) => {
    const a = ((i * SEG - 90) * Math.PI) / 180;
    return `<circle cx="${(Math.cos(a) * (R - 6)).toFixed(1)}" cy="${(Math.sin(a) * (R - 6)).toFixed(1)}" r="5" fill="#f6f1e7" stroke="#0e0e14" stroke-width="3"/>`;
  }).join('');
  return `${slices}${pegs}
        <circle r="38" fill="#ffc83d" stroke="#0e0e14" stroke-width="5"/>
        <circle r="26" fill="none" stroke="#c98f12" stroke-width="5"/>
        <text y="2" text-anchor="middle" dominant-baseline="middle" font-family="Lilita One, sans-serif" font-size="30" fill="#fff" stroke="#0e0e14" stroke-width="6" paint-order="stroke">K</text>`;
}

function wheelSvg(SLICES) {
  const bulbs = Array.from({ length: 24 }, (_, i) => {
    const a = ((i * 15) * Math.PI) / 180;
    return `<circle class="rim-bulb ${i % 2 ? 'b' : 'a'}" cx="${(Math.cos(a) * 196).toFixed(1)}" cy="${(Math.sin(a) * 196).toFixed(1)}" r="5" stroke="#0e0e14" stroke-width="2"/>`;
  }).join('');
  return `
    <svg class="wheel-svg" viewBox="-212 -212 424 424" aria-label="Prize wheel">
      <circle r="206" fill="#e5484d" stroke="#0e0e14" stroke-width="6"/>
      ${bulbs}
      <g class="wheel-rot">${wheelFace(SLICES)}</g>
    </svg>`;
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage wheel-stage">
        <div class="result-banner"></div>
        <div class="wheel-rig">
          <div class="flapper"></div>
          ${wheelSvg(currentSlices())}
          <div class="wheel-stand"></div>
        </div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <button class="btn big gold" data-act="spin">Spin</button>
          <span class="hint">Click the wheel · or press Space</span>
        </div>
        <div class="panel paytable">
          <span class="label">Slices (out of ${N})</span>
          <div data-slice-table></div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const rig = q('.wheel-rig');
  const svg = q('.wheel-svg');
  const rot = q('.wheel-rot');
  const flapper = q('.flapper');
  const banner = q('.result-banner');
  const spinBtn = q('[data-act=spin]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let slices = currentSlices();
  let angle = 0;
  let spinning = false;
  let raf = 0;
  let pending = null;

  function sync() {
    bet.setDisabled(spinning);
    spinBtn.disabled = spinning;
    spinBtn.textContent = spinning ? 'Spinning…' : `Spin ${money(bet.value || 0)}`;
    rig.classList.toggle('spinning', spinning);

    const fresh = currentSlices();
    if (!spinning && fresh.join() !== slices.join()) {
      slices = fresh;
      rot.innerHTML = wheelFace(slices);
    }
    q('[data-slice-table]').innerHTML = [4.5, 2, 1.5, 0.5, 0]
      .map((m) => {
        const s = STYLE[m];
        const label = m === 0 ? 'Bust' : m === 0.5 ? 'Half back' : `${m}× bet`;
        return `<div class="pay-row"><span><i class="swatch" style="background:${s.fill}"></i>${label}</span><b>${slices.filter((x) => x === m).length}</b></div>`;
      })
      .join('');
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  const sliceAt = (a) => Math.floor(((((-a) % 360) + 360) % 360) / SEG);

  function spin() {
    if (spinning || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    spinning = true;
    el.querySelectorAll('.slice.hit').forEach((s) => s.classList.remove('hit'));
    sync();

    let target = Math.floor(Math.random() * N);
    let lucky = false;
    if (slices[target] < 1 && luckyReroll()) {
      target = Math.floor(Math.random() * N);
      lucky = slices[target] > 1;
    }
    const mult = slices[target];
    pending = { stake, amount: Math.round(mult * stake * 100) / 100, mult, target, lucky };

    const theta = (target + 0.15 + Math.random() * 0.7) * SEG;
    const delta = (((-theta - angle) % 360) + 360) % 360;
    const from = angle;
    const total = 360 * (5 + Math.floor(Math.random() * 2)) + delta;
    const t0 = performance.now();
    let lastSlice = sliceAt(from + SEG / 2);
    sfx.whoosh();

    const frame = (now) => {
      const t = Math.min(1, (now - t0) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      angle = from + total * eased;
      rot.setAttribute('transform', `rotate(${angle})`);

      const s = sliceAt(angle + SEG / 2);
      if (s !== lastSlice) {
        lastSlice = s;
        sfx.peg();
        flapper.classList.remove('flick');
        void flapper.offsetWidth;
        flapper.classList.add('flick');
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else land();
    };
    raf = requestAnimationFrame(frame);
  }

  function land() {
    angle %= 360;
    rot.setAttribute('transform', `rotate(${angle})`);
    const { stake, amount, mult, target, lucky } = pending;
    pending = null;
    spinning = false;
    el.querySelector(`.slice[data-i="${target}"]`).classList.add('hit');
    if (mult === 0) {
      showBanner('BUST!', 'lose');
      juice.lose(stage, svg);
    } else {
      ctx.payout(amount, stake);
      const level = juice.bankWin(svg, amount, stake);
      if (lucky) juice.lucky(svg);
      if (mult >= 4) {
        fx.confettiRain(140);
        juice.flash();
      }
      showBanner(mult >= 4 ? 'JACKPOT!' : mult >= 2 ? 'DOUBLE!' : mult > 1 ? 'NICE!' : 'HALF BACK', mult >= 1 ? 'win' : 'meh');
      if (level >= 3) fx.shake(stage, true);
    }
    ctx.roundSettled();
    sync();
  }

  spinBtn.addEventListener('click', spin);
  svg.addEventListener('click', spin);
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      spin();
    }
  };
  addEventListener('keydown', onKey);
  sync();
  const unsubscribe = subscribe((e) => e.type === 'perk' && sync());

  return () => {
    removeEventListener('keydown', onKey);
    unsubscribe();
    cancelAnimationFrame(raf);
    if (pending) {
      if (pending.amount > 0) ctx.payout(pending.amount, pending.stake);
      ctx.roundSettled();
    }
  };
}
