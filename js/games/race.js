import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll } from '../state.js';

const NAMES = ['Hay Fever', 'Neigh Sayer', 'Mane Event', 'Gallop Poll', 'Sir Trots-a-Lot', 'Biscuit', 'Oat Couture', 'Pony Express', 'Colt Classic', 'Dark Horse', 'Saddle Up', 'Hay Girl'];
const COLORS = ['#e5484d', '#4f8cff', '#ffc83d', '#3bd497', '#9b6bff', '#ff6fb5'];
const EDGE = 0.94;
const RACE_MS = 7000;
const INK = '#0e0e14';

const horseSvg = (color, n) => `
  <svg class="horse" viewBox="0 0 80 56" aria-hidden="true">
    <g class="legs-back"><path d="M20 34 L14 50 M26 34 L24 52" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></g>
    <g class="legs-front"><path d="M48 34 L54 50 M42 34 L44 52" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></g>
    <path d="M10 22 C2 22 0 34 6 40" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <rect x="10" y="16" width="44" height="22" rx="11" fill="#b9814f" stroke="${INK}" stroke-width="4"/>
    <path d="M46 20 L58 4 L70 8 L74 18 L64 20 L58 26z" fill="#b9814f" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M58 4 L52 10 L50 18" fill="none" stroke="#5e3519" stroke-width="5" stroke-linecap="round"/>
    <circle cx="66" cy="11" r="2.4" fill="${INK}"/>
    <rect x="24" y="12" width="18" height="14" rx="4" fill="${color}" stroke="${INK}" stroke-width="3"/>
    <text x="33" y="23.5" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="11" fill="#fff" stroke="${INK}" stroke-width="2.5" paint-order="stroke">${n}</text>
  </svg>`;

function newField() {
  const names = [...NAMES].sort(() => Math.random() - 0.5).slice(0, 6);

  const w = names.map(() => Math.exp((Math.random() + Math.random() + Math.random() - 1.5) * 1.3));
  const sum = w.reduce((a, b) => a + b, 0);
  return names.map((name, i) => {
    const p = w[i] / sum;
    return { name, color: COLORS[i], n: i + 1, p, odds: Math.max(1.1, Math.floor((EDGE / p) * 10) / 10) };
  });
}

function pickWinner(field) {
  let r = Math.random();
  for (const horse of field) {
    if (r < horse.p) return horse;
    r -= horse.p;
  }
  return field[field.length - 1];
}

function paceProfile() {
  const segs = 8;
  const speeds = Array.from({ length: segs }, () => 0.6 + Math.random() * 0.8);
  const total = speeds.reduce((a, b) => a + b, 0);
  const cum = [0];
  speeds.forEach((s) => cum.push(cum[cum.length - 1] + s / total));
  return (f) => {
    if (f >= 1) return 1;
    const i = Math.floor(f * segs);
    return cum[i] + (cum[i + 1] - cum[i]) * (f * segs - i);
  };
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage race-stage">
        <div class="result-banner"></div>
        <div class="race-call" data-call>Pick a horse and place your bet</div>
        <div class="track"></div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <span class="label">Back a runner</span>
          <div class="runners"></div>
          <button class="btn big gold" data-act="race">Race</button>
          <span class="hint">1–6 to pick · Space to race</span>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const track = q('.track');
  const runnersEl = q('.runners');
  const call = q('[data-call]');
  const raceBtn = q('[data-act=race]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let field = newField();
  let pick = null;
  let racing = false;
  let raf = 0;
  let pending = null;

  function renderField() {
    track.innerHTML = field
      .map((hs, i) => `<div class="lane"><span class="lane-n">${hs.n}</span><div class="runner" data-runner="${i}">${horseSvg(hs.color, hs.n)}</div></div>`)
      .join('') + '<div class="finish"></div>';
    runnersEl.innerHTML = field
      .map(
        (hs, i) => `
        <button class="runner-pick ${pick === i ? 'on' : ''}" data-pick="${i}" style="--c:${hs.color}">
          <i>${hs.n}</i><span>${hs.name}</span><b>${hs.odds}×</b>
        </button>`
      )
      .join('');
  }

  function sync() {
    bet.setDisabled(racing);
    raceBtn.disabled = racing || pick === null;
    raceBtn.textContent = racing ? 'They’re off!' : pick === null ? 'Pick a runner' : `Race · ${money(bet.value || 0)} on #${pick + 1}`;
    runnersEl.querySelectorAll('[data-pick]').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.pick) === pick);
      b.disabled = racing;
    });
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function race() {
    if (racing || pick === null || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    const mine = field[pick];
    let winner = pickWinner(field);
    let lucky = false;
    if (winner !== mine && luckyReroll()) {
      winner = pickWinner(field);
      lucky = winner === mine;
    }
    const win = winner === mine;
    const amount = win ? Math.round(stake * mine.odds * 100) / 100 : 0;
    pending = { stake, amount };
    racing = true;
    sync();

    const finish = field.map((hs) => (hs === winner ? 0.86 : 0.88 + Math.random() * 0.12));
    const paces = field.map(() => paceProfile());
    const runners = [...track.querySelectorAll('.runner')];
    runners.forEach((r) => r.classList.add('galloping'));
    call.textContent = 'And they’re off!';
    sfx.whoosh();
    let leader = -1;
    let lastBeat = 0;
    let stretch = false;
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / RACE_MS);
      const progress = field.map((_, i) => paces[i](t / finish[i]));
      runners.forEach((r, i) => (r.style.left = `calc(${progress[i] * 100}% - ${progress[i] * 70}px)`));
      const lead = progress.indexOf(Math.max(...progress));
      if (lead !== leader && t > 0.08 && t < 0.86) {
        leader = lead;
        call.textContent = `${field[lead].name} takes the lead!`;
      }
      if (!stretch && t > 0.65) {
        stretch = true;
        call.textContent = `Down the final stretch… ${field[lead].name} in front!`;
      }
      if (now - lastBeat > 140) {
        sfx.reelTick();
        lastBeat = now;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else finishRace(winner, win, amount, stake, lucky);
    };
    raf = requestAnimationFrame(frame);
  }

  function finishRace(winner, win, amount, stake, lucky) {
    pending = null;
    racing = false;
    track.querySelectorAll('.runner').forEach((r) => r.classList.remove('galloping'));
    const winEl = track.querySelector(`[data-runner="${field.indexOf(winner)}"]`);
    winEl.classList.add('winner');
    call.textContent = `${winner.name} wins at ${winner.odds}×!`;
    sfx.land();
    if (win) {
      ctx.payout(amount, stake);
      const level = juice.bankWin(winEl, amount, stake);
      if (lucky) juice.lucky(winEl);
      showBanner(level >= 3 ? 'LONG SHOT!' : 'WINNER!', 'win');
    } else {
      showBanner(`#${winner.n} WINS`, 'lose');
      juice.lose(stage, track.querySelector(`[data-runner="${pick}"]`));
    }
    ctx.roundSettled();

    setTimeout(() => {
      if (racing || !el.isConnected) return;
      field = newField();
      pick = null;
      renderField();
      call.textContent = 'New field! Pick a horse.';
      sync();
    }, 2200);
    sync();
  }

  el.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pick]');
    if (p && !racing) {
      pick = Number(p.dataset.pick);
      sfx.click();
      sync();
    }
    if (e.target.closest('[data-act=race]')) race();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), race());
    if (/^[1-6]$/.test(e.key) && !racing) {
      pick = Number(e.key) - 1;
      sfx.click();
      sync();
    }
  };
  addEventListener('keydown', onKey);
  renderField();
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
