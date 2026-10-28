import { state, newRun, clearRun } from '../state.js';
import { FREE_PLAY, STANDARD, TOTAL_DEBT } from '../config.js';
import { h, money, confirmModal } from '../ui.js';
import { sfx } from '../audio.js';
import { go } from '../main.js';

export function renderHome(root) {
  const run = state.run;
  const n = STANDARD.installments.length;

  const logo = [...'KASINO'].map((c, i) => `<span style="animation-delay:${i * -0.18}s">${c}</span>`).join('');
  root.append(
    h(`
    <div class="title-screen">
      <h1 class="title-logo" aria-label="Kasino">${logo}</h1>

      ${
        run && !run.over
          ? `<button class="btn gold big continue-btn" data-act="continue">Continue · ${run.mode === 'standard' ? 'Standard' : 'Free Play'} · ${money(run.balance)}</button>`
          : ''
      }

      <div class="mode-picks">
        <button class="mode-btn standard" data-act="standard">
          <strong>Standard</strong>
          <span>You owe ${money(TOTAL_DEBT)}. Pay it back in ${n} installments, each on a clock. Miss one and you’re done.</span>
          <div class="facts"><i>Start ${money(STANDARD.startBalance)}</i><i>First due ${money(STANDARD.installments[0].amount)}</i><i>${n} payments</i></div>
        </button>
        <button class="mode-btn free" data-act="free">
          <strong>Free Play</strong>
          <span>No debt, no clock. Gamble until you can’t cover the cheapest bet on the floor.</span>
          <div class="facts"><i>Start ${money(FREE_PLAY.startBalance)}</i><i>No deadline</i></div>
        </button>
      </div>

      <div class="sticker-note">
        <b>Pretend money only.</b> Nothing can be bought and nothing can be cashed out.
        Real gambling is a different story: <a href="#/support">find support here</a>.
      </div>
    </div>`)
  );

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    sfx.click();
    if (act === 'continue') return go('#/floor');
    if (state.run && !state.run.over) {
      const ok = await confirmModal({
        title: 'Start a new run?',
        body: 'Your current run will be thrown away.',
        confirm: 'Start new run',
        danger: true,
      });
      if (!ok) return;
    }
    clearRun();
    newRun(act);
    go('#/floor');
  });
}
