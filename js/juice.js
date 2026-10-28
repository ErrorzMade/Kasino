import { fx } from './fx.js';
import { sfx } from './audio.js';
import { money } from './ui.js';

export function winLevel(amount, stake) {
  const multiple = stake > 0 ? amount / stake : 1;
  if (multiple >= 10) return 4;
  if (multiple >= 4) return 3;
  if (multiple >= 1.9) return 2;
  return 1;
}

export function bankWin(fromEl, amount, stake = 0) {
  const level = winLevel(amount, stake);
  const target = document.getElementById('hud-money');
  const pill = target?.closest('.pill');
  fx.celebrate(fromEl, level);
  const profit = Math.round((amount - stake) * 100) / 100;
  const label = profit > 0 ? `+${money(profit)}` : `${money(amount)} back`;
  fx.popText(fromEl, label, { size: 34 + level * 8, color: profit > 0 ? '#3bd497' : '#ffc83d', dy: -50, rise: 120 });
  if (level >= 4) flash();
  if (level >= 4) sfx.jackpot();
  else if (level === 3) sfx.bigWin();
  else sfx.win();
  fx.coinsTo(fromEl, target, Math.min(26, 5 + level * 5), (i) => {
    sfx.plink(i);
    fx.thump(pill);
  });
  return level;
}

export function smallWin(el, label) {
  sfx.ting();
  fx.ring(el, '#f6f1e7', 120);
  fx.stars(el, 8, 110);
  if (label) fx.popText(el, label, { size: 30, color: '#ffc83d', dy: -100, rise: 50 });
}

export function lucky(el) {
  fx.popText(el, 'LUCKY!', { size: 30, color: '#3bd497', dy: -120, rise: 40 });
  fx.stars(el, 8, 90);
}

export function lose(stageEl, objEl = stageEl) {
  sfx.lose();
  fx.dust(objEl, 12);
  fx.shake(stageEl);
}

export function flash() {
  const el = document.createElement('div');
  el.className = 'flash';
  document.body.append(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
