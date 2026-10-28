import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll, sharkBonus } from '../state.js';
import { cardHtml, SUITS } from '../cards.js';

const PAYTABLE = [
  ['royal', 'Royal Flush', 800],
  ['sflush', 'Straight Flush', 50],
  ['quads', 'Four of a Kind', 25],
  ['full', 'Full House', 9],
  ['flush', 'Flush', 6],
  ['straight', 'Straight', 4],
  ['trips', 'Three of a Kind', 3],
  ['twopair', 'Two Pair', 2],
  ['jacks', 'Jacks or Better', 1],
];
const PAYS = Object.fromEntries(PAYTABLE.map(([k, , p]) => [k, p]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freshDeck() {
  const deck = [];
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function evaluate(cards) {
  const counts = {};
  cards.forEach((c) => (counts[c.rank] = (counts[c.rank] || 0) + 1));
  const groups = Object.entries(counts).map(([r, n]) => [Number(r), n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  const wheel = ranks.join() === '1,2,3,4,5';
  const broadway = ranks.join() === '1,10,11,12,13';
  const straight = ranks.length === 5 && (ranks[4] - ranks[0] === 4 || wheel || broadway);
  if (straight && flush) return broadway ? 'royal' : 'sflush';
  if (groups[0][1] === 4) return 'quads';
  if (groups[0][1] === 3 && groups[1][1] === 2) return 'full';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (groups[0][1] === 3) return 'trips';
  if (groups[0][1] === 2 && groups[1][1] === 2) return 'twopair';
  if (groups[0][1] === 2 && (groups[0][0] >= 11 || groups[0][0] === 1)) return 'jacks';
  return null;
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage poker-stage">
        <div class="result-banner"></div>
        <div class="paytable-board">
          ${PAYTABLE.map(([k, name, p]) => `<div class="pt-row" data-row="${k}"><span>${name}</span><b>${p}×</b></div>`).join('')}
        </div>
        <div class="poker-hand"></div>
        <div class="poker-hint" data-hint>Deal to start</div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <button class="btn big gold" data-act="go">Deal</button>
          <span class="hint">Click cards (or 1–5) to hold · Space to deal / draw</span>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const handEl = q('.poker-hand');
  const hint = q('[data-hint]');
  const goBtn = q('[data-act=go]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let phase = 'idle';
  let deck = [];
  let hand = [];
  let held = [false, false, false, false, false];
  let stake = 0;
  let alive = true;

  function renderHand(flipIdx = []) {
    handEl.innerHTML = hand
      .map(
        (c, i) => `
        <button class="pk-slot ${held[i] ? 'held' : ''}" data-i="${i}" ${phase !== 'dealt' ? 'disabled' : ''}>
          ${cardHtml(c, flipIdx.includes(i) ? 'flip-in' : '')}
          <span class="held-tag">HELD</span>
        </button>`
      )
      .join('');
    handEl.querySelectorAll('.card.flip-in').forEach((c, n) => (c.style.animationDelay = `${n * 0.08}s`));
  }

  function highlight(kind) {
    el.querySelectorAll('.pt-row').forEach((r) => r.classList.toggle('on', r.dataset.row === kind));
  }

  function sync() {
    bet.setDisabled(phase !== 'idle');
    goBtn.disabled = phase === 'busy';
    goBtn.textContent = phase === 'dealt' ? 'Draw' : `Deal ${money(bet.value || 0)}`;
    goBtn.className = `btn big ${phase === 'dealt' ? 'win' : 'gold'}`;
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  async function deal() {
    if (phase !== 'idle' || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    deck = freshDeck();
    hand = deck.splice(0, 5);
    held = [false, false, false, false, false];
    phase = 'busy';
    sync();
    sfx.whoosh();
    renderHand([0, 1, 2, 3, 4]);
    highlight(evaluate(hand));
    await sleep(450);
    if (!alive) return;
    phase = 'dealt';
    renderHand();
    const k = evaluate(hand);
    hint.textContent = k ? `You’re holding ${PAYTABLE.find((r) => r[0] === k)[1]}. Hold and draw.` : 'Pick the cards to keep, then draw.';
    sync();
  }

  async function draw() {
    if (phase !== 'dealt') return;
    phase = 'busy';
    sync();
    const replace = held.map((hd, i) => (hd ? -1 : i)).filter((i) => i >= 0);
    const drawFrom = (d) => {
      const next = [...hand];
      replace.forEach((i) => (next[i] = d.shift()));
      return next;
    };
    let next = drawFrom([...deck]);
    let lucky = false;
    if (!evaluate(next) && replace.length && luckyReroll()) {

      const rest = deck.slice(replace.length);
      next = drawFrom(rest.concat(deck.slice(0, replace.length)));
      lucky = Boolean(evaluate(next));
    }
    hand = next;
    sfx.whoosh();
    renderHand(replace);
    await sleep(380 + replace.length * 80);
    if (!alive) return;
    resolve(lucky);
  }

  function resolve(lucky) {
    const kind = evaluate(hand);
    highlight(kind);
    phase = 'idle';
    if (kind) {
      const amount = sharkBonus(Math.round(stake * PAYS[kind] * 100) / 100, stake);
      const name = PAYTABLE.find((r) => r[0] === kind)[1];
      ctx.payout(amount, stake);
      if (amount > stake) {
        juice.bankWin(handEl, amount, stake);
        if (lucky) juice.lucky(handEl);
      } else sfx.plink(2);
      showBanner(name.toUpperCase(), amount > stake ? 'win' : 'meh');
      hint.textContent = `${name}: pays ${money(amount)}`;
      handEl.classList.add('scored');
    } else {
      showBanner('NOTHING', 'lose');
      juice.lose(stage, handEl);
      hint.textContent = 'No luck. Deal again?';
    }
    renderHand();
    ctx.roundSettled();
    sync();
  }

  function toggle(i) {
    if (phase !== 'dealt' || !hand[i]) return;
    held[i] = !held[i];
    sfx.click();
    renderHand();
  }

  el.addEventListener('click', (e) => {
    const slot = e.target.closest('[data-i]');
    if (slot) toggle(Number(slot.dataset.i));
    if (e.target.closest('[data-act=go]')) phase === 'dealt' ? draw() : deal();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), phase === 'dealt' ? draw() : deal());
    if (/^[1-5]$/.test(e.key)) toggle(Number(e.key) - 1);
  };
  addEventListener('keydown', onKey);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    alive = false;
    if (phase === 'idle' || !hand.length) return;
    if (phase === 'dealt') held.forEach((hd, i) => !hd && (hand[i] = deck.shift()));
    const kind = evaluate(hand);
    if (kind) ctx.payout(sharkBonus(Math.round(stake * PAYS[kind] * 100) / 100, stake), stake);
    ctx.roundSettled();
  };
}
