import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { round2, luckyReroll, sharkBonus } from '../state.js';
import { cardHtml, cardBackHtml, randomCard, rankLabel } from '../cards.js';

const EDGE = 0.97;
const odds = (rank) => ({ hi: (14 - rank) / 13, lo: rank / 13 });
const multFor = (p) => Math.floor((EDGE / p) * 100) / 100;

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage hilo-stage">
        <div class="result-banner"></div>
        <div class="hilo-table">
          <div class="deck">${cardBackHtml('d1')}${cardBackHtml('d2')}${cardBackHtml('d3')}</div>
          <div class="card-slot"></div>
        </div>
        <div class="pot"><span class="hud-label">Pot</span><b data-pot>$0</b></div>
        <div class="hilo-history"></div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <button class="btn big gold" data-act="start">Deal in</button>
          <div class="hilo-calls">
            <button class="btn win" data-call="hi">▲ Higher or same<small data-hi></small></button>
            <button class="btn loss" data-call="lo">▼ Lower or same<small data-lo></small></button>
          </div>
          <button class="btn ghost" data-act="skip">Skip card</button>
          <button class="btn big win" data-act="cash" hidden>Cash out</button>
          <span class="hint">↑ / ↓ to call · S to skip · C to cash out</span>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const slot = q('.card-slot');
  const banner = q('.result-banner');
  const potEl = q('[data-pot]');
  const history = q('.hilo-history');
  const startBtn = q('[data-act=start]');
  const cashBtn = q('[data-act=cash]');
  const skipBtn = q('[data-act=skip]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let card = randomCard();
  let phase = 'idle';
  let stake = 0;
  let pot = 0;
  let calls = 0;
  let flip = null;

  function showCard(c, dir = 0) {
    const old = slot.firstElementChild;
    const next = h(cardHtml(c, 'flip-in'));
    if (old) {
      old.classList.add('flip-out');
      old.addEventListener('animationend', () => old.remove(), { once: true });
    }
    slot.append(next);
    if (dir) next.style.setProperty('--tilt', dir > 0 ? '6deg' : '-6deg');
  }
  showCard(card);

  function sync() {
    const playing = phase === 'playing';
    const { hi, lo } = odds(card.rank);
    bet.setDisabled(phase !== 'idle');
    startBtn.hidden = phase !== 'idle';
    startBtn.textContent = `Deal in ${money(bet.value || 0)}`;
    el.querySelectorAll('[data-call]').forEach((b) => (b.disabled = !playing));
    q('[data-hi]').textContent = `${multFor(hi)}× · ${Math.round(hi * 100)}%`;
    q('[data-lo]').textContent = `${multFor(lo)}× · ${Math.round(lo * 100)}%`;
    skipBtn.disabled = phase === 'flipping';
    cashBtn.hidden = !(playing && calls > 0);
    cashBtn.textContent = `Cash out ${money(pot)}`;
    potEl.textContent = money(pot);
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function start() {
    if (phase !== 'idle' || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    pot = stake;
    calls = 0;
    history.replaceChildren();
    phase = 'playing';
    sfx.chip();
    sync();
  }

  function skip() {
    if (phase === 'flipping') return;
    card = randomCard();
    sfx.whoosh();
    showCard(card);
    sync();
  }

  function call(dir) {
    if (phase !== 'playing') return;
    const { hi, lo } = odds(card.rank);
    const p = dir === 'hi' ? hi : lo;
    const ok = (c) => (dir === 'hi' ? c.rank >= card.rank : c.rank <= card.rank);
    let next = randomCard();
    let lucky = false;
    if (!ok(next) && luckyReroll()) {
      next = randomCard();
      lucky = ok(next);
    }
    const win = ok(next);
    const prev = card;
    phase = 'flipping';
    sync();
    sfx.whoosh();
    card = next;
    showCard(next, next.rank - prev.rank);
    const newPot = win ? round2(pot * multFor(p)) : 0;
    flip = { win, pot: newPot };
    flip.timer = setTimeout(() => {
      flip = null;
      history.append(h(`<span class="hist ${win ? 'ok' : 'bad'}">${rankLabel(prev.rank)}${dir === 'hi' ? '▲' : '▼'}${rankLabel(next.rank)}</span>`));
      if (win) {
        pot = newPot;
        calls += 1;
        phase = 'playing';
        juice.smallWin(slot, `${multFor(p)}×`);
        if (lucky) juice.lucky(slot);
        fx.thump(potEl);
        showBanner(calls > 2 ? `${calls} IN A ROW` : 'NICE CALL', 'win');
      } else {
        showBanner('WRONG!', 'lose');
        juice.lose(stage, slot);
        pot = 0;
        phase = 'idle';
        ctx.roundSettled();
      }
      sync();
    }, 420);
  }

  function cashOut() {
    if (phase !== 'playing' || calls === 0) return;
    const amount = sharkBonus(pot, stake);
    ctx.payout(amount, stake);
    const level = juice.bankWin(potEl, amount, stake);
    showBanner(level >= 3 ? 'BIG CASH OUT' : 'CASHED OUT', 'win');
    pot = 0;
    phase = 'idle';
    ctx.roundSettled();
    sync();
  }

  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-call]')?.dataset.call;
    if (c) call(c);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'start') start();
    if (act === 'skip') skip();
    if (act === 'cash') cashOut();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.key === 'ArrowUp') (e.preventDefault(), phase === 'idle' ? start() : call('hi'));
    if (e.key === 'ArrowDown') (e.preventDefault(), call('lo'));
    if (e.key === 's' || e.key === 'S') skip();
    if (e.key === 'c' || e.key === 'C') cashOut();
  };
  addEventListener('keydown', onKey);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    if (flip) {
      clearTimeout(flip.timer);
      if (flip.win) ctx.payout(flip.pot, stake);
      ctx.roundSettled();
    } else if (phase === 'playing') {
      ctx.payout(pot, stake);
      ctx.roundSettled();
    }
  };
}
