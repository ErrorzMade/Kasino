import { h, money } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { symbolSvg } from '../symbols.js';
import { perkCount, luckyReroll } from '../state.js';

const TICKETS = [
  {
    id: 'buck', name: 'Lucky Buck', price: 2, color: '#ff6fb5',
    table: [
      { sym: 'cherry', mult: 1.5, p: 0.24 },
      { sym: 'bell', mult: 2, p: 0.13 },
      { sym: 'clover', mult: 3, p: 0.05 },
      { sym: 'diamond', mult: 10, p: 0.01 },
      { sym: 'seven', mult: 50, p: 0.001 },
    ],
  },
  {
    id: 'cascade', name: 'Cash Cascade', price: 5, color: '#4f8cff',
    table: [
      { sym: 'lemon', mult: 1.5, p: 0.2 },
      { sym: 'horseshoe', mult: 2, p: 0.1 },
      { sym: 'star', mult: 4, p: 0.05 },
      { sym: 'diamond', mult: 15, p: 0.01 },
      { sym: 'seven', mult: 100, p: 0.0008 },
    ],
  },
  {
    id: 'gold', name: 'Gold Rush', price: 20, color: '#ffc83d',
    table: [
      { sym: 'coin', mult: 1.5, p: 0.18 },
      { sym: 'bell', mult: 2.5, p: 0.1 },
      { sym: 'clover', mult: 5, p: 0.04 },
      { sym: 'star', mult: 25, p: 0.006 },
      { sym: 'seven', mult: 250, p: 0.0004 },
    ],
  },
];

function rollTicket(t) {
  const first = rollOnce(t);
  if (first.winner || !luckyReroll()) return first;
  const second = rollOnce(t);
  return { ...second, lucky: Boolean(second.winner) };
}

const REVEAL_AT = 0.5;
const BRUSH = 30;

function rollOnce(t) {

  const luck = 1 + 0.12 * perkCount('ticket');
  let r = Math.random() / luck;
  let winner = null;
  for (const row of t.table) {
    if (r < row.p) {
      winner = row;
      break;
    }
    r -= row.p;
  }

  const cells = winner ? [winner.sym, winner.sym, winner.sym] : [];
  const counts = Object.fromEntries(t.table.map((row) => [row.sym, 0]));
  if (winner) counts[winner.sym] = 3;
  while (cells.length < 9) {
    const options = t.table.filter((row) => counts[row.sym] < 2);
    const sym = options[Math.floor(Math.random() * options.length)].sym;
    counts[sym] += 1;
    cells.push(sym);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return { winner, cells };
}

export function mount(root, ctx) {
  const el = h(`
    <div class="game-layout">
      <div class="stage scratch-stage">
        <div class="result-banner"></div>
        <div class="ticket-slot"><p class="scratch-empty">Pick a ticket to start scratching</p></div>
      </div>
      <div class="controls">
        <div class="panel">
          <span class="label">Buy a ticket</span>
          <div class="shop"></div>
          <button class="btn big gold" data-act="reveal" disabled>Reveal all</button>
          <span class="hint">Drag across the foil to scratch</span>
        </div>
        <div class="panel">
          <div class="stat-list">
            <div class="stat"><span>Tickets</span><b data-count>0</b></div>
            <div class="stat"><span>Best prize</span><b data-best>$0</b></div>
          </div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const slot = q('.ticket-slot');
  const banner = q('.result-banner');
  const shop = q('.shop');
  const revealBtn = q('[data-act=reveal]');

  for (const t of TICKETS) {
    const top = Math.max(...t.table.map((r) => r.mult)) * t.price;
    shop.append(
      h(`<button class="shop-ticket" data-ticket="${t.id}" style="--t:${t.color}">
          <b>${t.name}</b><span>${money(t.price)}</span><small>Top prize ${money(top)}</small>
        </button>`)
    );
  }

  let current = null;
  let count = 0;
  let best = 0;

  function sync() {
    const busy = current && !current.done;
    shop.querySelectorAll('[data-ticket]').forEach((b) => {
      const t = TICKETS.find((x) => x.id === b.dataset.ticket);
      b.disabled = busy || ctx.getBalance() + 1e-9 < t.price || ctx.isOver();
    });
    revealBtn.disabled = !busy;
    q('[data-count]').textContent = count;
    q('[data-best]').textContent = money(best);
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function buy(t) {
    if (current && !current.done) return;
    if (!ctx.placeBet(t.price)) return;
    count += 1;
    sfx.chip();
    const outcome = rollTicket(t);
    const prize = (sym) => t.table.find((r) => r.sym === sym).mult * t.price;
    const ticketEl = h(`
      <div class="ticket enter" style="--t:${t.color}">
        <div class="ticket-head"><h3>${t.name}</h3><span>${money(t.price)}</span></div>
        <div class="ticket-sub">Match 3 symbols to win that prize</div>
        <div class="ticket-grid">
          ${outcome.cells.map((s) => `<div class="cell">${symbolSvg(s, 52)}<small>${money(prize(s))}</small></div>`).join('')}
          <canvas class="foil"></canvas>
        </div>
        <div class="ticket-foot">${t.table.map((r) => `<span>${symbolSvg(r.sym, 18)}${money(r.mult * t.price)}</span>`).join('')}</div>
      </div>`);

    const old = slot.firstElementChild;
    if (old?.classList.contains('ticket')) {
      old.classList.add('leave');
      old.addEventListener('animationend', () => old.remove(), { once: true });
    } else old?.remove();
    slot.append(ticketEl);
    sfx.whoosh();

    current = { t, outcome, revealed: new Set(), done: false, ticketEl };
    requestAnimationFrame(() => setupFoil(current));
    sync();
  }

  function setupFoil(c) {
    const grid = c.ticketEl.querySelector('.ticket-grid');
    const canvas = c.ticketEl.querySelector('.foil');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = grid.clientWidth;
    const H = grid.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    c.cellRects = [...grid.querySelectorAll('.cell')].map((cell) => ({
      x: cell.offsetLeft, y: cell.offsetTop, w: cell.offsetWidth, h: cell.offsetHeight,
    }));
    for (const r of c.cellRects) drawFoil(g, r);
    c.canvas = canvas;
    c.g = g;
    c.dpr = dpr;
    bindScratch(c);
  }

  function drawFoil(g, r) {
    const rad = 10;
    g.save();
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, rad);
    g.fillStyle = '#c7c9d6';
    g.fill();
    g.clip();

    g.strokeStyle = '#b4b6c6';
    g.lineWidth = 6;
    for (let d = -r.h; d < r.w + r.h; d += 16) {
      g.beginPath();
      g.moveTo(r.x + d, r.y);
      g.lineTo(r.x + d - r.h, r.y + r.h);
      g.stroke();
    }
    g.font = `${Math.round(r.w * 0.42)}px 'Lilita One', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = '#0e0e14';
    g.strokeText('?', r.x + r.w / 2, r.y + r.h / 2 + 2);
    g.fillStyle = '#f6f1e7';
    g.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 2);
    g.restore();
    g.beginPath();
    g.roundRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, rad);
    g.strokeStyle = '#0e0e14';
    g.lineWidth = 3;
    g.stroke();
  }

  function bindScratch(c) {
    const { canvas, g } = c;
    let last = null;
    let lastSound = 0;
    let lastCheck = 0;

    const pos = (e) => ({ x: e.offsetX, y: e.offsetY });
    const scratchTo = (p, e) => {
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = BRUSH;
      g.beginPath();
      g.moveTo(last.x, last.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      g.restore();
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      const now = performance.now();
      if (dist > 2) {
        if (now - lastSound > 55) {
          sfx.scratch();
          lastSound = now;
        }
        if (Math.random() < Math.min(1, dist / 10)) fx.flakesAt(e.clientX, e.clientY, 1 + (Math.random() < 0.4));
      }
      if (now - lastCheck > 120) {
        lastCheck = now;
        checkCells(c);
      }
      last = p;
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (c.done) return;
      canvas.setPointerCapture(e.pointerId);
      last = pos(e);
      scratchTo({ x: last.x + 0.1, y: last.y }, e);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!last || c.done) return;
      scratchTo(pos(e), e);
    });
    const end = () => {
      if (!last) return;
      last = null;
      checkCells(c);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function checkCells(c) {
    if (c.done) return;
    const { g, dpr } = c;
    c.cellRects.forEach((r, i) => {
      if (c.revealed.has(i)) return;
      const data = g.getImageData(r.x * dpr, r.y * dpr, r.w * dpr, r.h * dpr).data;
      let clear = 0;
      let total = 0;
      for (let k = 3; k < data.length; k += 16) {
        total++;
        if (data[k] < 40) clear++;
      }
      if (clear / total >= REVEAL_AT) revealCell(c, i);
    });
  }

  function revealCell(c, i) {
    if (c.revealed.has(i)) return;
    c.revealed.add(i);
    const r = c.cellRects[i];
    c.g.clearRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    const cell = c.ticketEl.querySelectorAll('.cell')[i];
    cell.classList.add('pop');
    sfx.reveal(c.revealed.size);
    if (c.revealed.size === 9) finish(c);
  }

  function revealAll() {
    const c = current;
    if (!c || c.done) return;
    revealBtn.disabled = true;
    const remaining = [...Array(9).keys()].filter((i) => !c.revealed.has(i));
    remaining.forEach((i, n) => setTimeout(() => current === c && revealCell(c, i), n * 90));
  }

  function finish(c) {
    c.done = true;
    const { winner } = c.outcome;
    const amount = winner ? winner.mult * c.t.price : 0;

    if (winner) {
      ctx.payout(amount, c.t.price);
      best = Math.max(best, amount);
    }
    ctx.roundSettled();
    setTimeout(() => {
      if (current !== c) return;
      if (winner) {
        c.ticketEl.querySelectorAll('.cell').forEach((cell, i) => {
          if (c.outcome.cells[i] === winner.sym) cell.classList.add('match');
        });
        const level = juice.bankWin(c.ticketEl, amount, c.t.price);
        if (c.outcome.lucky) juice.lucky(c.ticketEl);
        showBanner(level >= 3 ? 'BIG WINNER!' : 'WINNER!', 'win');
      } else {
        c.ticketEl.classList.add('dud');
        showBanner('NO LUCK', 'lose');
        sfx.lose();
        fx.dust(c.ticketEl, 8);
      }
      sync();
    }, 250);
    sync();
  }

  shop.addEventListener('click', (e) => {
    const id = e.target.closest('[data-ticket]')?.dataset.ticket;
    if (id) buy(TICKETS.find((t) => t.id === id));
  });
  revealBtn.addEventListener('click', revealAll);
  sync();

  return () => {
    const c = current;
    current = null;
    if (!c || c.done) return;
    if (c.outcome.winner) ctx.payout(c.outcome.winner.mult * c.t.price, c.t.price);
    ctx.roundSettled();
  };
}
