import { h, money } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll } from '../state.js';
import { symbolSvg } from '../symbols.js';

const RARITIES = [
  { id: 'common', name: 'Common', mult: 0.2, p: 0.45, color: '#a4a2b4', sym: 'lemon' },
  { id: 'uncommon', name: 'Uncommon', mult: 0.5, p: 0.27, color: '#3bd497', sym: 'cherry' },
  { id: 'rare', name: 'Rare', mult: 1.2, p: 0.17, color: '#4f8cff', sym: 'bell' },
  { id: 'epic', name: 'Epic', mult: 2.2, p: 0.075, color: '#9b6bff', sym: 'clover' },
  { id: 'legendary', name: 'Legendary', mult: 7, p: 0.03, color: '#ffc83d', sym: 'diamond' },
  { id: 'mythic', name: 'Mythic', mult: 25, p: 0.005, color: '#e5484d', sym: 'seven' },
];
const BOXES = [
  { price: 5, name: 'Paper Box', color: '#ff9f43' },
  { price: 20, name: 'Gift Box', color: '#ff6fb5' },
  { price: 100, name: 'Gold Box', color: '#ffc83d' },
];
const STRIP = 54;
const LAND = 46;
const ITEM_W = 112;
const SPIN_MS = 5200;

const rollRarity = () => {
  let r = Math.random();
  for (const x of RARITIES) {
    if (r < x.p) return x;
    r -= x.p;
  }
  return RARITIES[0];
};

const boxSvg = (color) => `
  <svg viewBox="0 0 120 120" class="box-svg" aria-hidden="true">
    <rect x="16" y="52" width="88" height="58" rx="8" fill="${color}" stroke="#0e0e14" stroke-width="5"/>
    <rect x="52" y="52" width="16" height="58" fill="#e5484d" stroke="#0e0e14" stroke-width="4"/>
    <g class="lid">
      <rect x="8" y="34" width="104" height="22" rx="6" fill="${color}" stroke="#0e0e14" stroke-width="5"/>
      <rect x="52" y="34" width="16" height="22" fill="#e5484d" stroke="#0e0e14" stroke-width="4"/>
      <path d="M60 34 C40 6 22 22 40 34z M60 34 C80 6 98 22 80 34z" fill="#e5484d" stroke="#0e0e14" stroke-width="4" stroke-linejoin="round"/>
    </g>
    <text x="60" y="94" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="30" fill="#fff" stroke="#0e0e14" stroke-width="6" paint-order="stroke">?</text>
  </svg>`;

export function mount(root, ctx) {
  const el = h(`
    <div class="game-layout">
      <div class="stage mystery-stage">
        <div class="result-banner"></div>
        <div class="box-wrap">${boxSvg(BOXES[0].color)}</div>
        <div class="reel-frame">
          <div class="reel-pointer"></div>
          <div class="item-strip"></div>
        </div>
        <div class="prize-card" hidden></div>
      </div>
      <div class="controls">
        <div class="panel">
          <span class="label">Choose a box</span>
          <div class="box-shop">
            ${BOXES.map((b, i) => `<button class="shop-ticket box-pick ${i === 0 ? 'on' : ''}" data-box="${i}" style="--t:${b.color}"><b>${b.name}</b><span>${money(b.price)}</span><small>Up to ${money(b.price * 25)}</small></button>`).join('')}
          </div>
          <button class="btn big gold" data-act="open">Open</button>
          <span class="hint">Space to open</span>
        </div>
        <div class="panel paytable">
          <span class="label">What’s inside (× box price)</span>
          ${RARITIES.map((r) => `<div class="pay-row"><span><i class="swatch" style="background:${r.color}"></i>${r.name} <em>${(r.p * 100).toFixed(r.p < 0.01 ? 1 : 0)}%</em></span><b>${r.mult}×</b></div>`).join('')}
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const boxWrap = q('.box-wrap');
  const frame = q('.reel-frame');
  const strip = q('.item-strip');
  const prizeCard = q('.prize-card');
  const openBtn = q('[data-act=open]');

  let box = 0;
  let opening = false;
  let raf = 0;
  let pending = null;
  let timer = 0;

  const itemHtml = (r) =>
    `<div class="mb-item" style="--r:${r.color}">${symbolSvg(r.sym, 52)}<b>${r.mult}×</b><small>${r.name}</small></div>`;

  function fillStrip(landing) {
    const items = Array.from({ length: STRIP }, (_, i) => (i === LAND ? landing : rollRarity()));

    if (Math.random() < 0.5) items[LAND + (Math.random() < 0.5 ? 1 : -1)] = RARITIES[4 + Math.floor(Math.random() * 2)];
    strip.innerHTML = items.map(itemHtml).join('');
    strip.style.transform = 'translateX(0)';
  }
  fillStrip(rollRarity());

  function sync() {
    const b = BOXES[box];
    el.querySelectorAll('[data-box]').forEach((btn, i) => {
      btn.classList.toggle('on', i === box);
      btn.disabled = opening || ctx.getBalance() + 1e-9 < BOXES[i].price;
    });
    openBtn.disabled = opening || ctx.getBalance() + 1e-9 < b.price;
    openBtn.textContent = opening ? 'Opening…' : `Open ${b.name} · ${money(b.price)}`;
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function open() {
    if (opening || ctx.isOver()) return;
    const { price, color } = BOXES[box];
    if (!ctx.placeBet(price)) return;
    let prize = rollRarity();
    let lucky = false;
    if (prize.mult < 1 && luckyReroll()) {
      prize = rollRarity();
      lucky = prize.mult > 1;
    }
    const amount = Math.round(price * prize.mult * 100) / 100;
    pending = { stake: price, amount };
    opening = true;
    prizeCard.hidden = true;
    boxWrap.innerHTML = boxSvg(color);
    boxWrap.className = 'box-wrap shaking';
    stage.classList.remove('revealed');
    sync();
    sfx.lever();
    fillStrip(prize);

    timer = setTimeout(() => {
      boxWrap.classList.replace('shaking', 'burst');
      sfx.whoosh();
      fx.confettiBurst(boxWrap, 30);
      frame.classList.add('live');
      const center = frame.clientWidth / 2;
      const target = LAND * ITEM_W + ITEM_W / 2 - center + (Math.random() - 0.5) * (ITEM_W * 0.7);
      const t0 = performance.now();
      let lastItem = -1;
      const ease = (t) => 1 - Math.pow(1 - t, 4);
      const step = (now) => {
        const t = Math.min(1, (now - t0) / SPIN_MS);
        const x = target * ease(t);
        strip.style.transform = `translateX(${-x}px)`;
        const under = Math.floor((x + center) / ITEM_W);
        if (under !== lastItem) {
          lastItem = under;
          sfx.peg();
        }
        if (t < 1) raf = requestAnimationFrame(step);
        else reveal(prize, amount, price, lucky);
      };
      raf = requestAnimationFrame(step);
    }, 700);
  }

  function reveal(prize, amount, price, lucky) {
    pending = null;
    opening = false;
    frame.classList.remove('live');
    stage.classList.add('revealed');
    strip.children[LAND].classList.add('won');
    prizeCard.hidden = false;
    prizeCard.style.setProperty('--r', prize.color);
    prizeCard.innerHTML = `${symbolSvg(prize.sym, 70)}<div><small>${prize.name}</small><b>${money(amount)}</b></div>`;
    ctx.payout(amount, price);
    if (amount > price) {
      const level = juice.bankWin(prizeCard, amount, price);
      if (lucky) juice.lucky(prizeCard);
      showBanner(prize.id === 'mythic' ? 'MYTHIC!!' : prize.id === 'legendary' ? 'LEGENDARY!' : level >= 2 ? `${prize.name.toUpperCase()}!` : 'NICE!', 'win');
      if (prize.mult >= 7) fx.confettiRain(120);
    } else {
      sfx.lose();
      showBanner(prize.name.toUpperCase(), 'meh');
      fx.dust(prizeCard, 8);
    }
    ctx.roundSettled();
    sync();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-box]');
    if (b && !opening) {
      box = Number(b.dataset.box);
      boxWrap.innerHTML = boxSvg(BOXES[box].color);
      boxWrap.className = 'box-wrap';
      sfx.click();
      sync();
    }
    if (e.target.closest('[data-act=open]')) open();
  });
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), open());
  };
  addEventListener('keydown', onKey);
  const balanceTimer = setInterval(sync, 1000);
  sync();

  return () => {
    removeEventListener('keydown', onKey);
    clearTimeout(timer);
    clearInterval(balanceTimer);
    cancelAnimationFrame(raf);
    if (pending) {
      ctx.payout(pending.amount, pending.stake);
      ctx.roundSettled();
    }
  };
}
