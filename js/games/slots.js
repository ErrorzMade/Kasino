import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { symbolSvg } from '../symbols.js';
import { perkCount, subscribe, luckyReroll } from '../state.js';

const BASE_WEIGHTS = { cherry: 6, lemon: 5, bell: 4, clover: 3, diamond: 2, seven: 1 };
const PAYS = { seven: 60, diamond: 25, clover: 12, bell: 8, lemon: 5, cherry: 4 };
const pairPays = () => (perkCount('reels') ? 2.2 : 1.9);
const BULBS = 14;

const SYMS = Object.keys(BASE_WEIGHTS);
const twoCherries = () => (perkCount('cherry') ? 3.5 : 2.4);

const weights = () => BASE_WEIGHTS;

function spinSymbol() {
  const w = weights();
  let r = Math.random() * SYMS.reduce((sum, k) => sum + w[k], 0);
  for (const s of SYMS) {
    if (r < w[s]) return s;
    r -= w[s];
  }
  return SYMS[0];
}
const anySymbol = () => SYMS[Math.floor(Math.random() * SYMS.length)];

function evaluate([a, b, c]) {
  if (a === b && b === c) return { mult: PAYS[a], label: a === 'seven' ? 'JACKPOT!' : 'TRIPLE!', cells: [0, 1, 2] };
  const pair = a === b ? [0, 1] : b === c ? [1, 2] : null;
  if (!pair) return null;
  const sym = [a, b, c][pair[0]];
  return sym === 'cherry'
    ? { mult: twoCherries(), label: 'CHERRIES!', cells: pair }
    : { mult: pairPays(), label: 'PAIR!', cells: pair };
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage slots-stage">
        <div class="result-banner"></div>
        <div class="slot-rig">
          <div class="slot-machine">
            <div class="marquee">
              <div class="bulbs">${'<i></i>'.repeat(BULBS)}</div>
              <h3>LUCKY REELS</h3>
            </div>
            <div class="reel-window">
              ${[0, 1, 2].map(() => '<div class="reel"><div class="strip"></div></div>').join('')}
              <div class="payline"></div>
            </div>
            <div class="slot-tray"><span>INSERT FAKE COIN</span></div>
          </div>
          <div class="lever" title="Pull me">
            <div class="lever-arm"><div class="lever-knob"></div></div>
            <div class="lever-base"></div>
          </div>
        </div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <button class="btn big loss" data-act="spin">Spin</button>
          <span class="hint">Drag the lever · or press Space</span>
        </div>
        <div class="panel paytable">
          <span class="label">Pays (× bet)</span>
          ${Object.entries(PAYS)
            .map(([s, m]) => `<div class="pay-row"><span>${symbolSvg(s, 22).repeat(3)}</span><b>${m}×</b></div>`)
            .join('')}
          <div class="pay-row"><span>${symbolSvg('cherry', 22).repeat(2)}<em>side by side</em></span><b data-cherries></b></div>
          <div class="pay-row"><span><em style="margin:0">Any other pair, side by side</em></span><b data-pairs></b></div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const machine = q('.slot-machine');
  const reelWin = q('.reel-window');
  const reels = [...el.querySelectorAll('.reel')];
  const banner = q('.result-banner');
  const spinBtn = q('[data-act=spin]');
  const lever = q('.lever');
  const arm = q('.lever-arm');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let shown = reels.map(() => [anySymbol(), spinSymbol(), anySymbol()]);
  let spinning = false;
  let pending = null;
  let tickTimer = null;

  const cellHtml = (s) => `<div class="slot-cell" data-sym="${s}">${symbolSvg(s, 76)}</div>`;
  function renderStatic() {
    reels.forEach((reel, i) => {
      const strip = reel.querySelector('.strip');
      strip.getAnimations().forEach((a) => a.cancel());
      strip.style.transform = '';
      strip.innerHTML = shown[i].map(cellHtml).join('');
    });
  }
  renderStatic();

  function sync() {
    bet.setDisabled(spinning);
    spinBtn.disabled = spinning;
    spinBtn.textContent = spinning ? 'Spinning…' : `Spin ${money(bet.value || 0)}`;
    lever.classList.toggle('disabled', spinning);
    q('[data-cherries]').textContent = `${twoCherries()}×`;
    q('[data-pairs]').textContent = `${pairPays()}×`;
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function spin() {
    if (spinning || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    spinning = true;
    sync();
    machine.classList.remove('party');
    reelWin.classList.remove('win');

    let result = reels.map(() => spinSymbol());
    let outcome = evaluate(result);
    let lucky = false;
    if (!outcome && luckyReroll()) {
      result = reels.map(() => spinSymbol());
      outcome = evaluate(result);
      lucky = Boolean(outcome);
    }
    pending = { stake, amount: outcome ? Math.round(outcome.mult * stake * 100) / 100 : 0 };
    const teaser = result[0] === result[1];

    sfx.lever();
    tickTimer = setInterval(sfx.reelTick, 70);
    let stopped = 0;

    reels.forEach((reel, i) => {
      const strip = reel.querySelector('.strip');
      const fillers = 18 + i * 7 + (teaser && i === 2 ? 22 : 0);
      const final = [anySymbol(), result[i], anySymbol()];
      const symbols = [...shown[i], ...Array.from({ length: fillers }, anySymbol), ...final];
      strip.innerHTML = symbols.map(cellHtml).join('');
      const distance = (symbols.length - 3) * strip.firstElementChild.offsetHeight;
      const duration = 1100 + i * 420 + (teaser && i === 2 ? 1500 : 0);
      reel.classList.add('blur');
      if (teaser && i === 2) setTimeout(() => {
        reel.classList.add('tease');
        sfx.suspense();
      }, 1100 + 420);
      const anim = strip.animate(
        [
          { transform: 'translateY(0)', easing: 'cubic-bezier(.35,.05,.25,1)' },
          { transform: `translateY(${-distance - 22}px)`, offset: 0.94, easing: 'ease-out' },
          { transform: `translateY(${-distance}px)` },
        ],
        { duration, fill: 'forwards' }
      );
      setTimeout(() => reel.classList.remove('blur'), duration * 0.8);
      anim.onfinish = () => {
        reel.classList.remove('tease');
        sfx.thunk();
        reel.classList.remove('bump');
        void reel.offsetWidth;
        reel.classList.add('bump');
        shown[i] = final;
        if (++stopped === reels.length) done(result, outcome, stake, lucky);
      };
    });
  }

  function done(result, outcome, stake, lucky) {
    clearInterval(tickTimer);
    renderStatic();
    spinning = false;
    if (outcome) {
      const amount = pending.amount;
      ctx.payout(amount, stake);
      reelWin.classList.add('win');
      machine.classList.add('party');
      outcome.cells.forEach((i) => reels[i].querySelectorAll('.slot-cell')[1].classList.add('hit'));
      const level = juice.bankWin(reelWin, amount, stake);
      if (lucky) juice.lucky(reelWin);
      showBanner(level >= 4 && result[0] === 'seven' ? 'JACKPOT!' : outcome.label, 'win');
    } else {
      sfx.lose();
    }
    pending = null;
    ctx.roundSettled();
    sync();
  }

  const MAX_PULL = 150;
  let drag = null;
  function setArm(deg, animate) {
    arm.style.transition = animate ? 'transform .45s cubic-bezier(.3, 1.8, .5, 1)' : 'none';
    arm.style.transform = `rotateX(${deg}deg)`;
  }
  function pullFully() {
    if (spinning) return;
    arm.style.transition = 'transform .14s ease-in';
    arm.style.transform = `rotateX(${MAX_PULL}deg)`;
    setTimeout(() => setArm(0, true), 160);
    spin();
  }
  lever.addEventListener('pointerdown', (e) => {
    if (spinning) return;
    lever.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, deg: 0 };
  });
  lever.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.deg = Math.max(0, Math.min(MAX_PULL, ((e.clientY - drag.y) / 120) * MAX_PULL));
    setArm(drag.deg, false);
  });
  const release = () => {
    if (!drag) return;
    const pulled = drag.deg;
    drag = null;
    setArm(0, true);
    if (pulled > MAX_PULL * 0.6 || pulled < 4) {

      if (pulled < 4) pullFully();
      else spin();
    }
  };
  lever.addEventListener('pointerup', release);
  lever.addEventListener('pointercancel', () => {
    drag = null;
    setArm(0, true);
  });

  spinBtn.addEventListener('click', pullFully);
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      pullFully();
    }
  };
  addEventListener('keydown', onKey);
  sync();
  const unsubscribe = subscribe((e) => e.type === 'perk' && sync());

  return () => {
    removeEventListener('keydown', onKey);
    unsubscribe();
    clearInterval(tickTimer);
    if (pending) {
      if (pending.amount > 0) ctx.payout(pending.amount, pending.stake);
      ctx.roundSettled();
    }
  };
}
