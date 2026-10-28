import { h, money } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll } from '../state.js';

const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const CHIPS = [1, 5, 25, 100];
const SEG = 360 / ORDER.length;
const SPIN_MS = 5200;
const INK = '#0e0e14';

const color = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

function returns(key, n) {
  const [kind, v] = key.split(':');
  if (kind === 'n') return Number(v) === n ? 36 : 0;
  if (n === 0) return 0;
  if (kind === 'col') return n % 3 === Number(v) % 3 ? 3 : 0;
  if (kind === 'dz') return Math.ceil(n / 12) === Number(v) ? 3 : 0;
  const even = {
    red: REDS.has(n), black: !REDS.has(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 18, high: n >= 19,
  };
  return even[kind] ? 2 : 0;
}

function wheelSvg() {
  const R = 180;
  const pockets = ORDER.map((n, i) => {
    const a0 = ((i * SEG - SEG / 2 - 90) * Math.PI) / 180;
    const a1 = ((i * SEG + SEG / 2 - 90) * Math.PI) / 180;
    const p = (a, r) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    const fill = n === 0 ? '#21a67a' : REDS.has(n) ? '#e5484d' : '#2a2a38';
    return `
      <path d="M${p(a0, 110)} L${p(a0, R)} A${R} ${R} 0 0 1 ${p(a1, R)} L${p(a1, 110)} A110 110 0 0 0 ${p(a0, 110)}Z" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>
      <text transform="rotate(${i * SEG}) translate(0 -162)" text-anchor="middle" dominant-baseline="middle" font-family="Lilita One, sans-serif" font-size="13" fill="#fff">${n}</text>`;
  }).join('');
  return `
    <svg class="roulette-wheel" viewBox="-200 -200 400 400" aria-label="Roulette wheel">
      <circle r="196" fill="#8a5530" stroke="${INK}" stroke-width="6"/>
      <g class="rw-rot">
        ${pockets}
        <circle r="110" fill="#5e3519" stroke="${INK}" stroke-width="4"/>
        <circle r="62" fill="#ffc83d" stroke="${INK}" stroke-width="5"/>
        <path d="M0 -58 V58 M-58 0 H58" stroke="#c98f12" stroke-width="10" stroke-linecap="round"/>
        <circle r="18" fill="#ffc83d" stroke="${INK}" stroke-width="5"/>
      </g>
      <circle class="rw-ball" r="8" fill="#fff" stroke="${INK}" stroke-width="3" cx="0" cy="-186"/>
    </svg>`;
}

function tableHtml() {

  const cell = (n) =>
    `<button class="rt-cell num ${color(n)}" data-bet="n:${n}" style="grid-column:${2 + Math.floor((n - 1) / 3)};grid-row:${3 - ((n - 1) % 3)}">${n}<span class="rt-chips"></span></button>`;
  const rows = Array.from({ length: 36 }, (_, i) => cell(i + 1)).join('');
  return `
    <div class="rt-table">
      <button class="rt-cell num green zero" data-bet="n:0">0<span class="rt-chips"></span></button>
      ${rows}
      <button class="rt-cell side" data-bet="col:3" style="grid-column:14;grid-row:1">2:1<span class="rt-chips"></span></button>
      <button class="rt-cell side" data-bet="col:2" style="grid-column:14;grid-row:2">2:1<span class="rt-chips"></span></button>
      <button class="rt-cell side" data-bet="col:1" style="grid-column:14;grid-row:3">2:1<span class="rt-chips"></span></button>
      ${[1, 2, 3].map((d) => `<button class="rt-cell outside dz" data-bet="dz:${d}" style="grid-column:${2 + (d - 1) * 4} / span 4;grid-row:4">${['1st', '2nd', '3rd'][d - 1]} 12<span class="rt-chips"></span></button>`).join('')}
      ${[
        ['low', '1–18'], ['even', 'Even'], ['red', '<i class="diamond red"></i>'], ['black', '<i class="diamond black"></i>'], ['odd', 'Odd'], ['high', '19–36'],
      ].map(([k, label], i) => `<button class="rt-cell outside" data-bet="${k}" style="grid-column:${2 + i * 2} / span 2;grid-row:5">${label}<span class="rt-chips"></span></button>`).join('')}
    </div>`;
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="roulette-layout">
      <div class="stage roulette-stage">
        <div class="result-banner"></div>
        <div class="rw-wrap">${wheelSvg()}<div class="rw-result" data-result></div></div>
        <div class="rt-scroll">${tableHtml()}</div>
        <div class="rt-history"></div>
      </div>
      <div class="controls roulette-controls">
        <div class="panel">
          <span class="label">Chip</span>
          <div class="chip-picker">${CHIPS.map((c, i) => `<button class="chip-btn pick ${i === 0 ? 'on' : ''}" data-chip-val="${c}">${c}</button>`).join('')}</div>
          <div class="rt-total"><span class="label">Total bet</span><b data-total>$0</b></div>
          <div class="rt-actions">
            <button class="btn small ghost" data-act="undo">Undo</button>
            <button class="btn small ghost" data-act="clear">Clear</button>
            <button class="btn small ghost" data-act="rebet">Rebet</button>
          </div>
          <button class="btn big gold" data-act="spin">Spin</button>
          <span class="hint">Click the table to place chips · Space to spin</span>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const rot = q('.rw-rot');
  const ball = q('.rw-ball');
  const resultEl = q('[data-result]');
  const history = q('.rt-history');
  const spinBtn = q('[data-act=spin]');

  let chip = CHIPS[0];
  let bets = {};
  let placed = [];
  let lastBets = null;
  let spinning = false;
  let wheelAngle = 0;
  let raf = 0;
  let pending = null;

  const total = () => Object.values(bets).reduce((a, b) => a + b, 0);

  function renderChips() {
    el.querySelectorAll('[data-bet]').forEach((cell) => {
      const amt = bets[cell.dataset.bet] || 0;
      const chips = cell.querySelector('.rt-chips');
      chips.textContent = amt ? (amt >= 1000 ? `${Math.round(amt / 100) / 10}k` : amt) : '';
      chips.classList.toggle('on', amt > 0);
    });
  }

  function sync() {
    const t = total();
    q('[data-total]').textContent = money(t);
    spinBtn.disabled = spinning || t < game.minBet || t > ctx.getBalance() + 1e-9;
    spinBtn.textContent = spinning ? 'Spinning…' : t < game.minBet ? `Min table bet ${money(game.minBet)}` : `Spin ${money(t)}`;
    el.querySelectorAll('[data-act=undo], [data-act=clear]').forEach((b) => (b.disabled = spinning || !placed.length));
    q('[data-act=rebet]').disabled = spinning || !lastBets;
    el.querySelectorAll('.chip-btn.pick').forEach((b) => b.classList.toggle('on', Number(b.dataset.chipVal) === chip));
    renderChips();
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function place(key) {
    if (spinning) return;
    if (total() + chip > ctx.getBalance() + 1e-9) {
      fx.shake(q('.rt-total'));
      return;
    }
    bets[key] = (bets[key] || 0) + chip;
    placed.push([key, chip]);
    sfx.chip();
    el.querySelector('.rt-table').classList.remove('cleared');
    sync();
  }

  function spin() {
    const stake = total();
    if (spinning || ctx.isOver() || stake < game.minBet) return;
    if (!ctx.placeBet(stake)) return;
    lastBets = { ...bets };
    const payoutFor = (n) => Object.entries(bets).reduce((sum, [k, a]) => sum + a * returns(k, n), 0);
    let n = ORDER[Math.floor(Math.random() * ORDER.length)];
    let lucky = false;
    if (payoutFor(n) < stake && luckyReroll()) {
      n = ORDER[Math.floor(Math.random() * ORDER.length)];
      lucky = payoutFor(n) > stake;
    }
    const amount = payoutFor(n);
    pending = { stake, amount };
    spinning = true;
    resultEl.className = 'rw-result';
    resultEl.textContent = '';
    el.querySelectorAll('.rt-cell.hit').forEach((c) => c.classList.remove('hit'));
    sync();
    sfx.whoosh();

    const idx = ORDER.indexOf(n);
    const w0 = wheelAngle;
    const w1 = w0 + 360 * 2 + Math.random() * 360;
    const pocketAt = w1 + idx * SEG;
    const b1 = pocketAt - 360 * 5;
    const b0 = b1 + 360 * 5 + 200;
    const t0 = performance.now();
    let lastPeg = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / SPIN_MS);
      wheelAngle = w0 + (w1 - w0) * ease(t);
      rot.setAttribute('transform', `rotate(${wheelAngle})`);
      const b = b0 + (b1 - b0) * ease(t);

      const drop = Math.max(0, (t - 0.62) / 0.38);
      const r = 186 - 36 * Math.min(1, drop * 1.4) + Math.abs(Math.sin(drop * Math.PI * 3)) * 10 * (1 - drop);
      const a = ((b - 90) * Math.PI) / 180;
      ball.setAttribute('cx', (Math.cos(a) * r).toFixed(2));
      ball.setAttribute('cy', (Math.sin(a) * r).toFixed(2));
      if (drop > 0 && now - lastPeg > 90 + drop * 160 && t < 0.97) {
        sfx.peg();
        lastPeg = now;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else land(n, stake, amount, lucky);
    };
    raf = requestAnimationFrame(frame);
  }

  function land(n, stake, amount, lucky) {
    pending = null;
    spinning = false;
    wheelAngle %= 360;
    sfx.land();
    resultEl.textContent = n;
    resultEl.className = `rw-result show ${color(n)}`;
    history.prepend(h(`<span class="${color(n)}">${n}</span>`));
    while (history.children.length > 12) history.lastElementChild.remove();
    el.querySelectorAll('[data-bet]').forEach((c) => returns(c.dataset.bet, n) && c.classList.add('hit'));
    if (amount > 0) {
      ctx.payout(amount, stake);
      if (amount > stake) {
        const level = juice.bankWin(resultEl, amount, stake);
        if (lucky) juice.lucky(resultEl);
        showBanner(level >= 3 ? 'BIG WIN!' : `${n} ${color(n).toUpperCase()}!`, 'win');
      } else {
        sfx.plink(2);
        showBanner(amount === stake ? 'PUSH' : 'SOME BACK', 'meh');
      }
    } else {
      showBanner(`${n} ${color(n).toUpperCase()}`, 'lose');
      juice.lose(stage, resultEl);
    }

    bets = {};
    placed = [];
    el.querySelector('.rt-table').classList.add('cleared');
    ctx.roundSettled();
    sync();
  }

  el.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-bet]');
    if (cell) place(cell.dataset.bet);
    const pick = e.target.closest('[data-chip-val]');
    if (pick) {
      chip = Number(pick.dataset.chipVal);
      sfx.chip();
      sync();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'spin') spin();
    if (act === 'undo' && placed.length && !spinning) {
      const [k, a] = placed.pop();
      bets[k] -= a;
      if (bets[k] <= 0) delete bets[k];
      sfx.click();
      sync();
    }
    if (act === 'clear' && !spinning) {
      bets = {};
      placed = [];
      sfx.click();
      sync();
    }
    if (act === 'rebet' && lastBets && !spinning) {
      const cost = Object.values(lastBets).reduce((a, b) => a + b, 0);
      if (cost > ctx.getBalance() + 1e-9) {
        fx.shake(q('.rt-total'));
        return;
      }
      bets = { ...lastBets };
      placed = Object.entries(bets);
      sfx.chip();
      sync();
    }
  });
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), spin());
  };
  addEventListener('keydown', onKey);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    if (pending) {
      if (pending.amount > 0) ctx.payout(pending.amount, pending.stake);
      ctx.roundSettled();
    }
  };
}
