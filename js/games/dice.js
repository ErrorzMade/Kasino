import { h, money, betControl } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';
import { luckyReroll, perkCount } from '../state.js';

const EDGE = 0.97;
const MIN_CHANCE = 2;
const MAX_CHANCE = 88;
const ROLL_MS = 1500;

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const dieFace = (n) => Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join('');

const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage dice-stage">
        <div class="result-banner"></div>
        <div class="dice-roll" data-roll>Roll it</div>
        <div class="dice-track">
          <div class="dice-runner"><div class="die">${dieFace(5)}</div></div>
          <div class="dice-bar"><span class="dz lose"></span><span class="dz win"></span><span class="dz-line"></span></div>
          <div class="dice-knob" tabindex="0" role="slider" aria-label="Target"><b></b></div>
          <div class="dice-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        </div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <div class="seg" role="group" aria-label="Direction">
            <button data-dir="under" class="on">Roll under</button><button data-dir="over">Roll over</button>
          </div>
          <button class="btn big gold" data-act="roll">Roll</button>
          <span class="hint">Drag the knob (or ← →) to set your target · Space to roll</span>
        </div>
        <div class="panel">
          <div class="stat-list">
            <div class="stat"><span>Win chance</span><b data-chance></b></div>
            <div class="stat"><span>Payout</span><b data-mult></b></div>
          </div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const stage = q('.stage');
  const banner = q('.result-banner');
  const rollEl = q('[data-roll]');
  const track = q('.dice-track');
  const bar = q('.dice-bar');
  const knob = q('.dice-knob');
  const runner = q('.dice-runner');
  const die = runner.querySelector('.die');
  const rollBtn = q('[data-act=roll]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance, initial: game.minBet });
  q('[data-bet-panel]').prepend(bet.el);

  let target = 50;
  let dir = 'under';
  let rolling = false;
  let pending = null;
  let raf = 0;

  const chance = () => (dir === 'under' ? target : 100 - target);
  const mult = () => Math.floor(((EDGE * (1 + 0.05 * perkCount('dice')) * 100) / chance()) * 100) / 100;
  const wins = (roll) => (dir === 'under' ? roll < target : roll >= target);

  const bounds = () => (dir === 'under' ? [MIN_CHANCE, MAX_CHANCE] : [100 - MAX_CHANCE, 100 - MIN_CHANCE]);

  function sync() {
    bet.setDisabled(rolling);
    rollBtn.disabled = rolling;
    rollBtn.textContent = rolling ? 'Rolling…' : `Roll ${money(bet.value || 0)}`;
    el.querySelectorAll('[data-dir]').forEach((b) => {
      b.classList.toggle('on', b.dataset.dir === dir);
      b.disabled = rolling;
    });
    const [loseZ, winZ] = [q('.dz.lose'), q('.dz.win')];
    const [leftZ, rightZ] = dir === 'under' ? [winZ, loseZ] : [loseZ, winZ];
    leftZ.style.left = '0';
    leftZ.style.width = `${target}%`;
    rightZ.style.left = `${target}%`;
    rightZ.style.width = `${100 - target}%`;
    q('.dz-line').style.left = `${target}%`;
    knob.style.left = `${target}%`;
    knob.querySelector('b').textContent = target;
    knob.setAttribute('aria-valuenow', target);
    q('[data-chance]').textContent = `${chance()}%`;
    q('[data-mult]').textContent = `${mult()}×`;
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function setTarget(t) {
    const [lo, hi] = bounds();
    const next = Math.max(lo, Math.min(hi, Math.round(t)));
    if (next !== target) {
      target = next;
      sfx.reelTick();
      sync();
    }
  }

  let dragging = false;
  const fromPointer = (e) => {
    const r = bar.getBoundingClientRect();
    setTarget(((e.clientX - r.left) / r.width) * 100);
  };
  track.addEventListener('pointerdown', (e) => {
    if (rolling) return;
    e.preventDefault();
    dragging = true;
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  track.addEventListener('pointermove', (e) => dragging && fromPointer(e));
  const endDrag = () => {
    dragging = false;
    track.classList.remove('dragging');
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  knob.addEventListener('keydown', (e) => {
    if (rolling) return;
    if (e.key === 'ArrowLeft') (e.preventDefault(), setTarget(target - 1));
    if (e.key === 'ArrowRight') (e.preventDefault(), setTarget(target + 1));
  });

  const placeRunner = (pos) => (runner.style.left = `${pos}%`);

  function roll() {
    if (rolling || ctx.isOver()) return;
    if (!bet.validate()) {
      fx.shake(q('[data-bet-panel]'));
      return;
    }
    const stake = bet.value;
    if (!ctx.placeBet(stake)) return;
    const draw = () => Math.floor(Math.random() * 10000) / 100;
    let result = draw();
    let lucky = false;
    if (!wins(result) && luckyReroll()) {
      result = draw();
      lucky = wins(result);
    }
    const win = wins(result);
    const amount = win ? Math.round(stake * mult() * 100) / 100 : 0;
    pending = { stake, amount };
    rolling = true;
    sync();
    sfx.whoosh();

    const from = result < 50 ? 100 : 0;
    const t0 = performance.now();
    let lastFace = 0;
    let lastTick = 0;
    rollEl.className = 'dice-roll';
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / ROLL_MS);
      const pos = Math.max(0, Math.min(99.99, from + (result - from) * easeOutBack(t)));
      placeRunner(pos);
      const hop = Math.abs(Math.sin(t * Math.PI * 5)) * 34 * Math.pow(1 - t, 1.4);
      die.style.transform = `translateY(${-hop}px) rotate(${(pos - from) * 9}deg)`;
      rollEl.textContent = pos.toFixed(2);
      rollEl.classList.toggle('win', wins(pos));
      rollEl.classList.toggle('lose', !wins(pos));
      if (now - lastFace > 90 && t < 0.85) {
        die.innerHTML = dieFace(1 + Math.floor(Math.random() * 6));
        lastFace = now;
      }
      if (now - lastTick > 55 && t < 0.9) {
        sfx.reelTick();
        lastTick = now;
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else land(result, win, amount, stake, lucky);
    };
    raf = requestAnimationFrame(frame);
  }

  function land(result, win, amount, stake, lucky) {
    pending = null;
    rolling = false;
    die.style.transform = '';
    placeRunner(result);
    runner.classList.remove('landed');
    void runner.offsetWidth;
    runner.classList.add('landed');
    sfx.land();
    rollEl.textContent = result.toFixed(2);
    rollEl.className = `dice-roll ${win ? 'win' : 'lose'} pop`;
    if (win) {
      ctx.payout(amount, stake);
      const level = juice.bankWin(runner, amount, stake);
      if (lucky) juice.lucky(runner);
      showBanner(level >= 3 ? 'LONG SHOT!' : 'WINNER!', 'win');
    } else {
      showBanner(Math.abs(result - target) < 3 ? 'SO CLOSE!' : 'MISSED', 'lose');
      juice.lose(stage, runner);
    }
    ctx.roundSettled();
    sync();
  }

  el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dir]');
    if (d && !rolling) {
      dir = d.dataset.dir;
      sfx.click();
      setTarget(target);
      sync();
    }
    if (e.target.closest('[data-act=roll]')) roll();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));
  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') (e.preventDefault(), roll());
  };
  addEventListener('keydown', onKey);
  placeRunner(50);
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
