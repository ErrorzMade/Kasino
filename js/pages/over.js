import { state, newRun, clearRun } from '../state.js';
import { TOTAL_DEBT, STANDARD, FREE_PLAY } from '../config.js';
import { h, money } from '../ui.js';
import { sfx } from '../audio.js';
import { balanceChart } from '../chart.js';
import { perkChips } from '../perks.js';
import { go } from '../main.js';

const COPY = {
  cleared: { title: 'Debt free', lead: 'Every installment paid. You made it out.', won: true },
  missed: { title: 'Repossessed', lead: 'The clock ran out before you could cover the installment.' },
  bust: { title: 'Bust', lead: 'Your balance couldn’t cover the cheapest bet on the floor.' },
  quit: { title: 'Walked away', lead: 'You ended the run yourself.' },
};

function duration(ms) {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export function renderOver(root) {
  const run = state.run;
  const standard = run.mode === 'standard';
  const copy = COPY[run.over.reason] || COPY.quit;
  const start = standard ? STANDARD.startBalance : FREE_PLAY.startBalance;
  const paid = run.standard?.paid ?? 0;

  const net = Math.round((run.over.balance + paid - start) * 100) / 100;
  const history = run.history?.length ? [...run.history] : [{ b: start, k: 'start' }];
  if (history[history.length - 1].b !== run.over.balance) history.push({ b: run.over.balance, k: 'round' });

  const firstStat = standard
    ? `<div class="card"><span>Debt paid</span><b>${money(paid)}</b><small>of ${money(TOTAL_DEBT)} · ${run.standard.index}/${STANDARD.installments.length} installments</small></div>`
    : `<div class="card"><span>Final balance</span><b>${money(run.over.balance)}</b><small>started with ${money(start)}</small></div>`;

  root.append(
    h(`
    <div class="summary ${copy.won ? 'cleared' : run.over.reason === 'quit' ? '' : 'lost'}">
      <header class="summary-head">
        <h1 class="stamp">${copy.title}</h1>
        <p>${copy.lead}</p>
        <div class="summary-meta">
          <span>${standard ? 'Standard' : 'Free Play'}</span>
          <span>${duration(run.playMs)} played</span>
          <span>${run.stats.rounds} rounds</span>
          <span>peak ${money(run.stats.peak)}</span>
          ${run.stats.hustled ? `<span>${money(run.stats.hustled)} from dishes</span>` : ''}
          ${run.stats.rebated ? `<span>${money(run.stats.rebated)} rebated</span>` : ''}
        </div>
        <div class="summary-perks">${perkChips()}</div>
      </header>

      <div class="summary-stats">
        ${firstStat}
        <div class="card"><span>Wagered</span><b>${money(run.stats.wagered)}</b><small>across all games</small></div>
        <div class="card"><span>Biggest win</span><b>${money(run.stats.biggestWin)}</b><small>profit on one round</small></div>
        <div class="card"><span>Net result</span><b class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</b><small>won minus lost</small></div>
      </div>

      <section class="panel chart-panel">
        <div class="chart-top">
          <h2>Balance</h2>
          <div class="legend">
            <span><i style="border-color:var(--win)"></i>Won</span>
            <span><i style="border-color:var(--loss)"></i>Lost</span>
            ${standard ? '<span><i class="dash" style="border-color:var(--muted)"></i>Debt payment</span>' : ''}
          </div>
        </div>
        <div class="chart"></div>
      </section>

      <div class="summary-actions">
        <button class="btn big ${standard ? 'loss' : 'win'}" data-act="again">Play ${standard ? 'Standard' : 'Free Play'} again</button>
        <button class="btn big ghost" data-act="home">Main menu</button>
      </div>
    </div>`)
  );

  const disposeChart = balanceChart(root.querySelector('.chart'), history, start);

  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    sfx.click();
    const mode = run.mode;
    clearRun();
    if (act === 'again') {
      newRun(mode);
      go('#/floor');
    } else go('#/');
  });

  return disposeChart;
}
