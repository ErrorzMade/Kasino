import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll, sharkBonus } from '../state.js';
import { cardHtml, cardBackHtml, randomCard } from '../cards.js';

const STEP_MS = 360;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cardValue = (c) => (c.rank === 1 ? 11 : Math.min(10, c.rank));

function score(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === 1) aces++;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
const isBlackjack = (cards) => cards.length === 2 && score(cards).total === 21;

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage bj-stage">
        <div class="result-banner"></div>
        <div class="shoe">${cardBackHtml('sm')}</div>
        <div class="bj-row dealer"><span class="bj-label">Dealer <b data-dealer-total></b></span><div class="bj-hand" data-dealer></div></div>
        <div class="bj-rule">Blackjack pays 3:2 · Dealer stands on 17</div>
        <div class="bj-row player"><div class="bj-hands" data-player></div></div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <button class="btn big gold" data-act="deal">Deal</button>
          <div class="bj-actions">
            <button class="btn win" data-act="hit">Hit</button>
            <button class="btn loss" data-act="stand">Stand</button>
            <button class="btn" data-act="double">Double</button>
            <button class="btn" data-act="split">Split</button>
          </div>
          <span class="hint">H hit · S stand · D double · P split · Space to deal</span>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const dealerEl = q('[data-dealer]');
  const playerEl = q('[data-player]');
  const dealBtn = q('[data-act=deal]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let phase = 'idle';
  let dealer = [];
  let holeHidden = true;
  let hands = [];
  let active = 0;
  let alive = true;

  function renderDealer() {
    dealerEl.innerHTML = dealer
      .map((c, i) => (i === 1 && holeHidden ? cardBackHtml('sm dealt') : cardHtml(c, `sm dealt ${c.fresh ? 'deal-in' : ''}`)))
      .join('');
    dealer.forEach((c) => (c.fresh = false));
    const shown = holeHidden ? dealer.slice(0, 1) : dealer;
    const s = score(shown);
    q('[data-dealer-total]').textContent = dealer.length ? (holeHidden ? `${s.total}+?` : s.total) : '';
  }

  function renderPlayer() {
    playerEl.innerHTML = hands
      .map((hand, i) => {
        const s = score(hand.cards);
        const label = isBlackjack(hand.cards) && !hand.fromSplit ? 'BJ!' : s.total > 21 ? 'BUST' : `${s.soft && s.total < 21 ? 'soft ' : ''}${s.total}`;
        return `
          <div class="bj-hand-wrap ${i === active && phase === 'player' ? 'active' : ''} ${hand.result || ''}">
            <div class="bj-hand">${hand.cards.map((c) => cardHtml(c, `sm dealt ${c.fresh ? 'deal-in' : ''}`)).join('')}</div>
            <span class="bj-label">${label} · ${money(hand.bet)}${hand.result ? ` · ${hand.result.toUpperCase()}` : ''}</span>
          </div>`;
      })
      .join('');
    hands.forEach((hd) => hd.cards.forEach((c) => (c.fresh = false)));
  }

  function sync() {
    const hand = hands[active];
    const playing = phase === 'player' && hand;
    bet.setDisabled(phase !== 'idle');
    dealBtn.hidden = phase !== 'idle';
    dealBtn.textContent = `Deal ${money(bet.value || 0)}`;
    const canAfford = hand && ctx.getBalance() + 1e-9 >= hand.bet;
    q('[data-act=hit]').disabled = !playing;
    q('[data-act=stand]').disabled = !playing;
    q('[data-act=double]').disabled = !(playing && hand.cards.length === 2 && canAfford);
    q('[data-act=split]').disabled = !(
      playing && hands.length === 1 && hand.cards.length === 2 && cardValue(hand.cards[0]) === cardValue(hand.cards[1]) && canAfford
    );
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  const fresh = () => ({ ...randomCard(), fresh: true });

  async function step() {
    sfx.chip();
    await sleep(STEP_MS);
    return alive;
  }

  async function deal() {
    if (phase !== 'idle' || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    phase = 'dealing';
    dealer = [];
    holeHidden = true;
    hands = [{ cards: [], bet: stake, done: false }];
    active = 0;
    sync();
    sfx.whoosh();
    for (const who of ['p', 'd', 'p', 'd']) {
      (who === 'p' ? hands[0].cards : dealer).push(fresh());
      renderDealer();
      renderPlayer();
      if (!(await step())) return;
    }
    const playerBJ = isBlackjack(hands[0].cards);
    const dealerBJ = isBlackjack(dealer);
    if (playerBJ || dealerBJ) {
      holeHidden = false;
      renderDealer();
      await finish();
      return;
    }
    phase = 'player';
    renderPlayer();
    sync();
  }

  async function hit() {
    if (phase !== 'player') return;
    const hand = hands[active];
    hand.cards.push(fresh());
    phase = 'dealing';
    renderPlayer();
    sync();
    if (!(await step())) return;
    phase = 'player';
    const t = score(hand.cards).total;
    if (t > 21) {
      fx.shake(playerEl);
      sfx.thunk();
      await nextHand();
    } else if (t === 21) await nextHand();
    else {
      renderPlayer();
      sync();
    }
  }

  async function stand() {
    if (phase !== 'player') return;
    await nextHand();
  }

  async function double() {
    const hand = hands[active];
    if (phase !== 'player' || hand.cards.length !== 2) return;
    if (!ctx.placeBet(hand.bet)) return;
    hand.bet *= 2;
    hand.doubled = true;
    await hit();
    if (phase === 'player' && hands[active] === hand) await nextHand();
  }

  async function split() {
    const hand = hands[active];
    if (phase !== 'player' || hands.length !== 1) return;
    if (!ctx.placeBet(hand.bet)) return;
    const [a, b] = hand.cards;
    hands = [
      { cards: [a, fresh()], bet: hand.bet, fromSplit: true },
      { cards: [b, fresh()], bet: hand.bet, fromSplit: true },
    ];
    phase = 'dealing';
    renderPlayer();
    sync();
    if (!(await step())) return;
    phase = 'player';

    if (a.rank === 1) {
      active = hands.length;
      await dealerTurn();
      return;
    }
    renderPlayer();
    sync();
  }

  async function nextHand() {
    active += 1;
    if (active < hands.length) {
      phase = 'player';
      renderPlayer();
      sync();
      return;
    }
    await dealerTurn();
  }

  function dealerDraw() {
    let c = fresh();
    const best = Math.max(...hands.map((hd) => score(hd.cards).total).filter((t) => t <= 21), 0);
    const after = score([...dealer, c]).total;
    if (best && after >= 17 && after <= 21 && after > best && luckyReroll()) c = fresh();
    return c;
  }

  async function dealerTurn() {
    phase = 'dealer';
    sync();
    holeHidden = false;
    renderDealer();
    renderPlayer();
    sfx.whoosh();
    if (!(await step())) return;
    const anyLive = hands.some((hd) => score(hd.cards).total <= 21);
    while (anyLive && score(dealer).total < 17) {
      dealer.push(dealerDraw());
      renderDealer();
      if (!(await step())) return;
    }
    await finish();
  }

  function settle() {
    const d = score(dealer).total;
    const dealerBJ = isBlackjack(dealer);
    let paid = 0;
    let staked = 0;
    for (const hand of hands) {
      const p = score(hand.cards).total;
      const bj = isBlackjack(hand.cards) && !hand.fromSplit;
      staked += hand.bet;
      if (p > 21) hand.result = 'lose';
      else if (bj && !dealerBJ) (hand.result = 'blackjack'), (paid += hand.bet * 2.5);
      else if (dealerBJ && !bj) hand.result = 'lose';
      else if (d > 21 || p > d) (hand.result = 'win'), (paid += hand.bet * 2);
      else if (p === d) (hand.result = 'push'), (paid += hand.bet);
      else hand.result = 'lose';
    }
    return { paid: sharkBonus(Math.round(paid * 100) / 100, staked), staked };
  }

  async function finish() {
    const { paid, staked } = settle();
    phase = 'idle';
    renderPlayer();
    if (paid > 0) ctx.payout(paid, staked);
    if (paid > staked) {
      const level = juice.bankWin(playerEl, paid, staked);
      const bj = hands.some((hd) => hd.result === 'blackjack');
      showBanner(bj ? 'BLACKJACK!' : level >= 3 ? 'BIG WIN!' : 'YOU WIN!', 'win');
    } else if (paid === staked) {
      sfx.plink(2);
      showBanner('PUSH', 'meh');
    } else {
      showBanner(score(dealer).total === 21 && dealer.length === 2 ? 'DEALER BLACKJACK' : 'DEALER WINS', 'lose');
      juice.lose(stage, playerEl);
    }
    ctx.roundSettled();
    sync();
  }

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'deal') deal();
    if (act === 'hit') hit();
    if (act === 'stand') stand();
    if (act === 'double') double();
    if (act === 'split') split();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') (e.preventDefault(), deal());
    if (k === 'h') hit();
    if (k === 's') stand();
    if (k === 'd' && !q('[data-act=double]').disabled) double();
    if (k === 'p' && !q('[data-act=split]').disabled) split();
  };
  addEventListener('keydown', onKey);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    alive = false;
    if (phase === 'idle' || !hands.length) return;
    holeHidden = false;
    if (dealer.length < 2) while (dealer.length < 2) dealer.push(randomCard());
    for (const hand of hands) while (hand.cards.length < 2) hand.cards.push(randomCard());
    if (hands.some((hd) => score(hd.cards).total <= 21)) while (score(dealer).total < 17) dealer.push(randomCard());
    const { paid, staked } = settle();
    if (paid > 0) ctx.payout(paid, staked);
    ctx.roundSettled();
  };
}
