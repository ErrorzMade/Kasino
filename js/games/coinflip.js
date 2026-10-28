import { h, money, betControl, toast } from '../ui.js';
import { round2, perkCount, subscribe, luckyReroll } from '../state.js';
import { sfx } from '../audio.js';
import { fx } from '../fx.js';
import * as juice from '../juice.js';

const mult = () => round2(1.98 + 0.1 * perkCount('coin'));
const MAX_STREAK = 10;
const FLIP_MS = 1800;

export function mount(root, ctx) {
  const { game } = ctx;
  const el = h(`
    <div class="game-layout">
      <div class="stage">
        <div class="result-banner"></div>
        <div class="coin-scene">
          <div>
            <div class="coin-toss" style="--dur:${FLIP_MS}ms">
              <div class="coin" style="--dur:${FLIP_MS}ms">
                <div class="coin-face heads">H</div>
                <div class="coin-face tails">T</div>
              </div>
            </div>
            <div class="coin-shadow"></div>
          </div>
          <div class="pot"><span class="hud-label">Pot</span><b data-pot>$0</b></div>
          <div class="streak" aria-label="Streak"></div>
        </div>
      </div>
      <div class="controls">
        <div class="panel" data-bet-panel>
          <div class="seg" role="group" aria-label="Call it">
            <button data-pick="H" class="on">Heads</button>
            <button data-pick="T">Tails</button>
          </div>
          <button class="btn big gold" data-act="flip">Flip</button>
          <button class="btn big win" data-act="cash" hidden>Cash out</button>
          <span class="hint">Space to flip · C to cash out</span>
        </div>
        <div class="panel">
          <div class="stat-list">
            <div class="stat"><span>Payout</span><b data-mult></b></div>
            <div class="stat"><span>Streak</span><b data-streak>0</b></div>
            <div class="stat"><span>Next pot</span><b data-next>—</b></div>
            <div class="stat"><span>Best streak</span><b data-best>0</b></div>
          </div>
        </div>
      </div>
    </div>`);
  root.append(el);

  const q = (s) => el.querySelector(s);
  const coin = q('.coin');
  const toss = q('.coin-toss');
  const banner = q('.result-banner');
  const potEl = q('[data-pot]');
  const streakEl = q('.streak');
  const flipBtn = q('[data-act=flip]');
  const cashBtn = q('[data-act=cash]');
  const bet = betControl({ min: game.minBet, getBalance: ctx.getBalance });
  q('[data-bet-panel]').prepend(bet.el);

  let pick = 'H';
  let phase = 'idle';
  let stake = 0;
  let pot = 0;
  let streak = 0;
  let best = 0;
  let rot = 0;
  let pending = null;

  function sync() {
    const riding = phase === 'riding';
    bet.setDisabled(phase !== 'idle');
    el.querySelectorAll('[data-pick]').forEach((b) => {
      b.classList.toggle('on', b.dataset.pick === pick);
      b.disabled = phase === 'flipping';
    });
    flipBtn.disabled = phase === 'flipping';
    flipBtn.textContent = riding ? `Let it ride → ${money(round2(pot * mult()))}` : `Flip ${money(bet.value || 0)}`;
    cashBtn.hidden = !riding;
    cashBtn.textContent = `Cash out ${money(pot)}`;
    potEl.textContent = money(pot);
    q('[data-streak]').textContent = streak;
    q('[data-best]').textContent = best;
    q('[data-mult]').textContent = `${mult()}×`;
    q('[data-next]').textContent = riding ? money(round2(pot * mult())) : bet.value > 0 ? money(round2(bet.value * mult())) : '—';
  }

  function showBanner(text, kind) {
    banner.textContent = text;
    banner.className = `result-banner ${kind}`;
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function flip() {
    if (phase === 'flipping' || ctx.isOver()) return;
    if (phase === 'idle') {
      if (!bet.validate()) {
        fx.shake(q('[data-bet-panel]'));
        return;
      }
      stake = bet.value;
      if (!ctx.placeBet(stake)) return;
      pot = stake;
    }
    const face = () => (Math.random() < 0.5 ? 'H' : 'T');
    let result = face();
    let lucky = false;
    if (result !== pick && luckyReroll()) {
      result = face();
      lucky = result === pick;
    }
    const win = result === pick;
    const nextPot = win ? round2(pot * mult()) : 0;
    phase = 'flipping';
    sync();

    let target = rot + 360 * 6;
    target += (((result === 'T' ? 180 : 0) - (target % 360)) + 360) % 360;
    rot = target;
    coin.style.transform = `rotateY(${rot}deg)`;
    toss.classList.remove('tossing');
    void toss.offsetWidth;
    toss.classList.add('tossing');
    sfx.whoosh();

    pending = {
      win,
      nextPot,
      timer: setTimeout(() => land(result, win, nextPot, lucky), FLIP_MS * 0.86),
    };
  }

  function land(result, win, nextPot, lucky) {
    pending = null;
    sfx.land();
    streakEl.append(h(`<i class="${result === 'H' ? 'h' : 't'}">${result}</i>`));
    if (win) {
      pot = nextPot;
      streak += 1;
      best = Math.max(best, streak);
      phase = 'riding';
      showBanner(streak > 1 ? `${streak} IN A ROW` : 'CALLED IT', 'win');
      juice.smallWin(toss, `×${mult()}`);
      if (lucky) juice.lucky(toss);
      fx.thump(potEl);
      if (streak >= MAX_STREAK) {
        toast(`Max streak reached, auto cashing out.`, 'info');
        cashOut();
        return;
      }
    } else {
      showBanner('WRONG CALL', 'lose');
      juice.lose(q('.stage'), toss);
      pot = 0;
      streak = 0;
      phase = 'idle';
      setTimeout(() => streakEl.replaceChildren(), 900);
      ctx.roundSettled();
    }
    sync();
  }

  function cashOut() {
    if (phase !== 'riding') return;
    const amount = pot;
    ctx.payout(amount, stake);
    const level = juice.bankWin(potEl, amount, stake);
    showBanner(level >= 3 ? 'BIG CASH OUT' : 'CASHED OUT', 'win');
    pot = 0;
    streak = 0;
    phase = 'idle';
    streakEl.replaceChildren();
    ctx.roundSettled();
    sync();
  }

  el.addEventListener('click', (e) => {
    const pickBtn = e.target.closest('[data-pick]');
    if (pickBtn && phase !== 'flipping') {
      pick = pickBtn.dataset.pick;
      sfx.click();
      sync();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'flip') flip();
    if (act === 'cash') cashOut();
  });
  bet.el.addEventListener('input', sync);
  bet.el.addEventListener('click', () => setTimeout(sync));

  const onKey = (e) => {
    if (e.target.matches('input, textarea') || e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      flip();
    }
    if (e.key === 'c' || e.key === 'C') cashOut();
  };
  addEventListener('keydown', onKey);
  sync();
  const unsubscribe = subscribe((e) => e.type === 'perk' && sync());

  return () => {
    removeEventListener('keydown', onKey);
    unsubscribe();
    if (pending) {
      clearTimeout(pending.timer);
      if (pending.win) {
        pot = pending.nextPot;
        phase = 'riding';
      } else {
        ctx.roundSettled();
      }
    }
    if (phase === 'riding' && !ctx.isOver()) {
      toast(`Left the table, so your pot of <b>${money(pot)}</b> was cashed out.`, 'good');
      ctx.payout(pot, stake);
      ctx.roundSettled();
    }
  };
}
