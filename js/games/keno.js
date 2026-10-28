import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll } from '../state.js';

const NUMBERS = 40;
const DRAWN = 10;
const MAX_PICKS = 8;
const BALL_MS = 260;
const PAYS = {
  1: { 1: 3.7 },
  2: { 1: 1.1, 2: 8.8 },
  3: { 2: 3.8, 3: 34 },
  4: { 2: 2, 3: 7.6, 4: 91 },
  5: { 2: 1.1, 3: 3.4, 4: 27, 5: 270 },
  6: { 3: 3.1, 4: 12, 5: 100, 6: 1020 },
  7: { 3: 1.8, 4: 6.2, 5: 39, 6: 270, 7: 2650 },
  8: { 3: 1, 4: 4.2, 5: 17, 6: 100, 7: 840, 8: 8440 },
};

function drawBalls() {
  const pool = Array.from({ length: NUMBERS }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DRAWN);
}

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage keno-stage">
        <div class="result-banner"></div>
        <div class="keno-tray"></div>
        <div class="keno-board">${Array.from({ length: NUMBERS }, (_, i) => `<button class="kn" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <div class="keno-tools">
            <button class="btn small ghost" data-act="quick">Quick pick</button>
            <button class="btn small ghost" data-act="clear">Clear</button>
          </div>
          <button class="btn big gold" data-act="draw">Draw</button>
          <span class="hint">Pick up to ${MAX_PICKS} numbers · Space to draw</span>
        </div>
        <div class="panel paytable">
          <span class="label" data-pt-title>Pick numbers to see pays</span>
          <div data-pt></div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const board = q('.keno-board');
  const tray = q('.keno-tray');
  const drawBtn = q('[data-act=draw]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let picks = new Set();
  let drawing = false;
  let pending = null;
  let timers = [];

  const cells = () => [...board.querySelectorAll('.kn')];

  function renderPaytable(hits = -1) {
    const k = picks.size;
    q('[data-pt-title]').textContent = k ? `${k} pick${k > 1 ? 's' : ''}: hits pay (× bet)` : 'Pick numbers to see pays';
    const rows = PAYS[k] || {};
    q('[data-pt]').innerHTML = Object.entries(rows)
      .reverse()
      .map(([hh, m]) => `<div class="pay-row ${Number(hh) === hits ? 'lit' : ''}"><span><em style="margin:0">${hh} hit${hh > 1 ? 's' : ''}</em></span><b>${m}×</b></div>`)
      .join('');
  }

  function sync() {
    bet.setDisabled(drawing);
    drawBtn.disabled = drawing || !picks.size;
    drawBtn.textContent = drawing ? 'Drawing…' : picks.size ? `Draw ${money(bet.value || 0)}` : 'Pick some numbers';
    el.querySelectorAll('[data-act=quick], [data-act=clear]').forEach((b) => (b.disabled = drawing));
    cells().forEach((c) => {
      c.classList.toggle('picked', picks.has(Number(c.dataset.n)));
      c.disabled = drawing;
    });
    if (!drawing) renderPaytable();
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function clearDraw() {
    tray.replaceChildren();
    cells().forEach((c) => c.classList.remove('drawn', 'hit'));
  }

  function toggle(n) {
    if (drawing) return;
    clearDraw();
    if (picks.has(n)) picks.delete(n);
    else if (picks.size < MAX_PICKS) picks.add(n);
    else {
      fx.shake(board);
      return;
    }
    sfx.chip();
    sync();
  }

  function quickPick() {
    if (drawing) return;
    clearDraw();
    const k = picks.size || 5;
    picks = new Set(drawBalls().slice(0, k));
    sfx.whoosh();
    sync();
  }

  function draw() {
    if (drawing || !picks.size || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    const payFor = (balls) => (PAYS[picks.size][balls.filter((b) => picks.has(b)).length] || 0) * stake;
    let balls = drawBalls();
    let lucky = false;
    if (payFor(balls) < stake && luckyReroll()) {
      balls = drawBalls();
      lucky = payFor(balls) > stake;
    }
    const amount = Math.round(payFor(balls) * 100) / 100;
    pending = { stake, amount };
    drawing = true;
    clearDraw();
    sync();
    let hits = 0;
    balls.forEach((b, i) => {
      timers.push(
        setTimeout(() => {
          const hit = picks.has(b);
          if (hit) hits += 1;
          tray.append(h(`<span class="kball ${hit ? 'hit' : ''}">${b}</span>`));
          const cell = board.querySelector(`[data-n="${b}"]`);
          cell.classList.add('drawn');
          if (hit) {
            cell.classList.add('hit');
            sfx.reveal(hits);
            fx.stars(cell, 5, 50);
          } else sfx.reelTick();
          renderPaytable(hits);
          if (i === balls.length - 1) timers.push(setTimeout(() => done(amount, stake, hits, lucky), 350));
        }, i * BALL_MS)
      );
    });
  }

  function done(amount, stake, hits, lucky) {
    timers = [];
    pending = null;
    drawing = false;
    if (amount > 0) ctx.payout(amount, stake);
    if (amount > stake) {
      const level = juice.bankWin(tray, amount, stake);
      if (lucky) juice.lucky(tray);
      showBanner(level >= 3 ? 'BIG HIT!' : `${hits} HITS!`, 'win');
    } else if (amount > 0) {
      sfx.plink(2);
      showBanner(amount === stake ? 'MONEY BACK' : 'SOME BACK', 'meh');
    } else {
      showBanner(`${hits} HIT${hits === 1 ? '' : 'S'}`, 'lose');
      juice.lose(stage, tray);
    }
    ctx.roundSettled();
    sync();
    renderPaytable(hits);
  }

  el.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-n]');
    if (cell) toggle(Number(cell.dataset.n));
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'quick') quickPick();
    if (act === 'clear' && !drawing) {
      picks.clear();
      clearDraw();
      sfx.click();
      sync();
    }
    if (act === 'draw') draw();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), draw());
  };
  addEventListener('keydown', onKey);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    timers.forEach(clearTimeout);
    if (pending) {
      if (pending.amount > 0) ctx.payout(pending.amount, pending.stake);
      ctx.roundSettled();
    }
  };
}
