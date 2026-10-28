import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { round2, luckyReroll, perkCount } from '../state.js';
import { symbolSvg } from '../symbols.js';

const TILES = 25;
const EDGE = 0.97;
const MINE_OPTIONS = [1, 3, 5, 10];

function multiplier(mines, safe) {
  let m = EDGE * (1 + 0.05 * perkCount('mines'));
  for (let i = 0; i < safe; i++) m *= (TILES - i) / (TILES - mines - i);
  return Math.floor(m * 100) / 100;
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage mines-stage">
        <div class="result-banner"></div>
        <div class="mine-grid">${'<button class="mine-tile" disabled></button>'.repeat(TILES)}</div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <span class="label">Bombs</span>
          <div class="seg seg4" role="group" aria-label="Bombs">
            ${MINE_OPTIONS.map((m) => `<button data-mines="${m}" class="${m === 3 ? 'on' : ''}">${m}</button>`).join('')}
          </div>
          <button class="btn big gold" data-act="start">Start</button>
          <button class="btn ghost" data-act="random" hidden>Pick a random tile</button>
          <button class="btn big win" data-act="cash" hidden>Cash out</button>
        </div>
        <div class="panel">
          <div class="stat-list">
            <div class="stat"><span>Multiplier</span><b data-mult>1×</b></div>
            <div class="stat"><span>Next tile</span><b data-next>—</b></div>
            <div class="stat"><span>Pot</span><b data-pot>$0</b></div>
            <div class="stat"><span>Safe left</span><b data-left>—</b></div>
          </div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const tiles = [...el.querySelectorAll('.mine-tile')];
  const banner = q('.result-banner');
  const startBtn = q('[data-act=start]');
  const cashBtn = q('[data-act=cash]');
  const randomBtn = q('[data-act=random]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let mines = 3;
  let phase = 'idle';
  let roundId = 0;
  let stake = 0;
  let safe = 0;
  let revealed = new Set();
  let bombs = new Set();

  const pot = () => (safe ? round2(stake * multiplier(mines, safe)) : stake);

  function sync() {
    const playing = phase === 'playing';
    bet.setDisabled(playing);
    el.querySelectorAll('[data-mines]').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.mines) === mines);
      b.disabled = playing;
    });
    startBtn.hidden = playing;
    startBtn.textContent = `Start ${money(bet.value || 0)}`;
    randomBtn.hidden = !playing;
    cashBtn.hidden = !(playing && safe > 0);
    cashBtn.textContent = `Cash out ${money(pot())}`;
    const s = playing ? safe : 0;
    q('[data-mult]').textContent = `${s ? multiplier(mines, s) : 1}×`;
    q('[data-next]').textContent = s < TILES - mines ? `${multiplier(mines, s + 1)}×` : '—';
    q('[data-pot]').textContent = money(playing ? pot() : 0);
    q('[data-left]').textContent = playing ? TILES - mines - safe : TILES - mines;
    tiles.forEach((t, i) => (t.disabled = !playing || revealed.has(i)));
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function reset() {
    revealed = new Set();
    bombs = new Set();
    safe = 0;
    tiles.forEach((t) => {
      t.className = 'mine-tile';
      t.innerHTML = '';
      t.style.animationDelay = '';
    });
  }

  function start() {
    if (phase === 'playing' || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    reset();
    roundId += 1;
    phase = 'playing';
    sfx.chip();
    tiles.forEach((t, i) => {
      t.classList.add('deal');
      t.style.animationDelay = `${i * 0.015}s`;
    });
    sync();
  }

  function placeRemainingBombs(already) {
    const hidden = tiles.map((_, i) => i).filter((i) => !revealed.has(i) && !bombs.has(i));
    for (let n = already; n < mines && hidden.length; n++) {
      const j = Math.floor(Math.random() * hidden.length);
      bombs.add(hidden.splice(j, 1)[0]);
    }
  }

  function showBoard(dim) {
    tiles.forEach((t, i) => {
      if (revealed.has(i)) return;
      t.classList.add('shown', dim ? 'dim' : 'late');
      t.innerHTML = bombs.has(i) ? symbolSvg('bomb', 40) : symbolSvg('diamond', 34);
      if (bombs.has(i)) t.classList.add('bomb');
      t.style.animationDelay = `${(i % 5) * 0.04 + Math.floor(i / 5) * 0.04}s`;
    });
  }

  function pick(i) {
    if (phase !== 'playing' || revealed.has(i)) return;
    const tilesLeft = TILES - revealed.size;
    const isBomb = () => Math.random() < mines / tilesLeft;
    let boom = isBomb();
    let lucky = false;
    if (boom && luckyReroll()) {
      boom = isBomb();
      lucky = !boom;
    }
    revealed.add(i);
    const tile = tiles[i];
    tile.classList.add('shown');
    if (boom) {
      bombs.add(i);
      tile.classList.add('bomb', 'boom');
      tile.innerHTML = symbolSvg('bomb', 44);
      phase = 'idle';
      showBanner('BOOM!', 'lose');
      juice.lose(stage, tile);
      juice.flash();
      fx.ring(tile, '#e5484d', 160);
      fx.shake(stage, true);
      placeRemainingBombs(1);
      const id = roundId;
      setTimeout(() => id === roundId && showBoard(false), 350);
      ctx.roundSettled();
    } else {
      safe += 1;
      tile.classList.add('gem');
      tile.innerHTML = symbolSvg('diamond', 38);
      sfx.reveal(Math.min(safe, 10));
      fx.stars(tile, 6, 60);
      if (lucky) juice.lucky(tile);
      if (safe === TILES - mines) {
        cashOut();
        return;
      }
    }
    sync();
  }

  function cashOut() {
    if (phase !== 'playing' || safe === 0) return;
    const amount = pot();
    ctx.payout(amount, stake);
    phase = 'idle';
    const level = juice.bankWin(q('.mine-grid'), amount, stake);
    showBanner(level >= 3 ? 'BIG CASH OUT' : 'CASHED OUT', 'win');
    placeRemainingBombs(0);
    showBoard(true);
    ctx.roundSettled();
    sync();
  }

  function randomPick() {
    const open = tiles.map((_, i) => i).filter((i) => !revealed.has(i));
    if (open.length) pick(open[Math.floor(Math.random() * open.length)]);
  }

  el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mines]');
    if (m && phase !== 'playing') {
      mines = Number(m.dataset.mines);
      sfx.click();
      sync();
    }
    const tile = e.target.closest('.mine-tile');
    if (tile) pick(tiles.indexOf(tile));
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'start') start();
    if (act === 'cash') cashOut();
    if (act === 'random') randomPick();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), phase === 'playing' ? randomPick() : start());
    if (e.key === 'c' || e.key === 'C') cashOut();
  };
  addEventListener('keydown', onKey);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    if (phase === 'playing') {
      ctx.payout(pot(), stake);
      ctx.roundSettled();
    }
  };
}
