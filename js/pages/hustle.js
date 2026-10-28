import { state, earn, perkCount, subscribe } from '../state.js';
import { HUSTLE } from '../config.js';
import { h, money } from '../ui.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import { go } from '../main.js';

const SPOTS = 5;
const HP = 2;
const rand = (a, b) => a + Math.random() * (b - a);

export function renderHustle(root) {
  if (state.run?.mode !== 'standard') {
    go('#/floor');
    return;
  }
  const pay = () => HUSTLE.payPerPlate * (perkCount('payday') ? 2 : 1);
  const el = h(`
    <div>
      <div class="game-head">
        <a class="back btn small ghost" href="#/floor">← Floor</a>
        <h1>Side Hustle</h1>
      </div>
      <div class="game-layout">
        <div class="stage hustle-stage">
          <div class="plate-slot"></div>
          <div class="shift-over" hidden>
            <h2>Shift’s over</h2>
            <p>You’ve got enough to get back on the floor.</p>
            <a class="btn big gold" href="#/floor">Back to the floor</a>
          </div>
        </div>
        <div class="controls">
          <div class="panel">
            <span class="label">The dish pit</span>
            <p class="hustle-copy">Hold and scrub the grime off each plate. Every clean plate pays <b data-pay></b>.
            You can work while you have under ${money(HUSTLE.cap)}, and the clock keeps ticking.</p>
          </div>
          <div class="panel">
            <div class="stat-list">
              <div class="stat"><span>Plates</span><b data-plates>0</b></div>
              <div class="stat"><span>Earned</span><b data-earned>$0</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const slot = q('.plate-slot');
  const shiftOver = q('.shift-over');
  let plates = 0;
  let earned = 0;
  let plate = null;

  const capped = () => state.run.balance + 1e-9 >= HUSTLE.cap;

  function sync() {
    q('[data-pay]').textContent = money(pay());
    q('[data-plates]').textContent = plates;
    q('[data-earned]').textContent = money(earned);
    shiftOver.hidden = !capped();
  }

  function newPlate() {
    if (capped()) {
      sync();
      return;
    }
    const plateEl = h('<div class="plate enter"><div class="plate-rim"></div></div>');
    const spots = Array.from({ length: SPOTS }, () => {
      const ang = rand(0, Math.PI * 2);
      const dist = rand(0, 78);
      const r = rand(18, 30);
      const spot = { x: 130 + Math.cos(ang) * dist, y: 130 + Math.sin(ang) * dist, r, hp: HP, last: null };
      spot.el = h(`<i class="grime" style="left:${spot.x - r}px;top:${spot.y - r}px;width:${r * 2}px;height:${r * 2}px;--rot:${rand(0, 360)}deg"></i>`);
      plateEl.append(spot.el);
      return spot;
    });
    const old = slot.firstElementChild;
    if (old) {
      old.classList.add('leave');
      old.addEventListener('animationend', () => old.remove(), { once: true });
    }
    slot.append(plateEl);
    plate = { el: plateEl, spots, done: false };
    bindScrub(plate);
  }

  function bindScrub(p) {
    let down = false;
    let lastSqueak = 0;
    p.el.addEventListener('pointerdown', (e) => {
      down = true;
      p.el.setPointerCapture(e.pointerId);
      scrub(e);
    });
    p.el.addEventListener('pointermove', (e) => down && scrub(e));
    p.el.addEventListener('pointerup', () => (down = false));
    p.el.addEventListener('pointercancel', () => (down = false));

    function scrub(e) {
      if (p.done) return;

      const box = p.el.getBoundingClientRect();
      const x = ((e.clientX - box.left) / box.width) * 260;
      const y = ((e.clientY - box.top) / box.height) * 260;
      for (const s of p.spots) {
        if (s.hp <= 0 || Math.hypot(x - s.x, y - s.y) > s.r + 14) continue;
        if (s.last && Math.hypot(x - s.last.x, y - s.last.y) < 10) continue;
        s.last = { x, y };
        s.hp -= 1;
        fx.bubblesAt(e.clientX, e.clientY, 3);
        const now = performance.now();
        if (now - lastSqueak > 70) {
          sfx.squeak();
          lastSqueak = now;
        }
        s.el.style.transform = `rotate(var(--rot)) scale(${0.35 + (0.65 * s.hp) / HP})`;
        s.el.style.opacity = 0.4 + (0.6 * s.hp) / HP;
        if (s.hp <= 0) {
          s.el.classList.add('gone');
          fx.bubblesAt(e.clientX, e.clientY, 8);
        }
      }
      if (p.spots.every((s) => s.hp <= 0)) clean(p);
    }
  }

  function clean(p) {
    p.done = true;
    plates += 1;
    const amount = pay();
    earned += amount;
    p.el.classList.add('sparkle');
    sfx.ting();
    fx.stars(p.el, 10, 150);
    fx.popText(p.el, `+${money(amount)}`, { size: 38, color: '#3bd497', dy: -40 });
    fx.coinsTo(p.el, document.getElementById('hud-money'), 3, (i) => sfx.plink(i));
    earn(amount);
    sync();
    setTimeout(newPlate, 650);
  }

  const unsubscribe = subscribe((e) => e.type === 'balance' && sync());
  newPlate();
  sync();
  return unsubscribe;
}
