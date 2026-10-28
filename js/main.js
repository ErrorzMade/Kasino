import { state, subscribe, tick, isActive, currentInstallment, payInstallment, setMuted, endRun, perkCount } from './state.js';
import { STANDARD, TOTAL_DEBT, BREAK_REMINDER_MINUTES, HUSTLE, LUCK } from './config.js';
import { symbolSvg } from './symbols.js';
import { $, h, money, clock, countTo, toast, confirmModal, icons } from './ui.js';
import { sfx } from './audio.js';
import { fx } from './fx.js';
import { renderHome } from './pages/home.js';
import { renderFloor } from './pages/floor.js';
import { renderGame } from './pages/game.js';
import { renderOver } from './pages/over.js';
import { renderSupport } from './pages/support.js';
import { renderHustle } from './pages/hustle.js';
import { maybeOfferPerk, perkChips } from './perks.js';
import { GAMES } from './games/registry.js';

const app = $('#app');
const hud = $('#hud');
let cleanup = null;
let route = { name: 'home' };

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'floor') return { name: 'floor' };
  if (parts[0] === 'game' && parts[1]) return { name: 'game', id: parts[1] };
  if (parts[0] === 'over') return { name: 'over' };
  if (parts[0] === 'support') return { name: 'support' };
  if (parts[0] === 'hustle') return { name: 'hustle' };
  return { name: 'home' };
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render() {
  route = parse();
  const run = state.run;
  const needsRun = onFloor();
  if (needsRun && run?.over) return go('#/over');
  if (needsRun && !run) return go('#/');
  if (route.name === 'over' && !run?.over) return go(run ? '#/floor' : '#/');

  cleanup?.();
  cleanup = null;
  app.replaceChildren();
  const page = h('<div class="page-enter"></div>');
  app.append(page);
  const pages = { home: renderHome, floor: renderFloor, game: renderGame, over: renderOver, support: renderSupport, hustle: renderHustle };
  cleanup = pages[route.name](page, route) || null;

  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route.name));
  window.scrollTo({ top: 0 });
  renderHud();
  if (needsRun) setTimeout(maybeOfferPerk, 400);
}

const onFloor = () => ['floor', 'game', 'hustle'].includes(route.name);

addEventListener('hashchange', render);

function renderHud() {
  const run = state.run;
  if (!run || run.over || route.name === 'home' || route.name === 'over') {
    hud.replaceChildren();
    return;
  }
  if (!hud.firstElementChild || hud.firstElementChild.dataset.mode !== run.mode) {
    hud.replaceChildren(
      h(`
      <div class="hud" data-mode="${run.mode}">
        <div class="pill money">
          <span class="coin-icon"></span>
          <div><small><span class="mode-chip ${run.mode}">${run.mode === 'standard' ? 'Standard' : 'Free Play'}</span></small>
          <b class="hud-money" id="hud-money"></b></div>
        </div>
        <div class="pill luck" id="hud-luck" title="Luck builds with every losing round and resets when you win. While it’s up, a losing result gets a second roll.">
          ${symbolSvg('clover', 28)}
          <div><small>Luck <span id="hud-luck-pct"></span></small><div class="luck-meter"><span id="hud-luck-bar"></span></div></div>
        </div>
        <div class="perk-row" id="hud-perks"></div>
        ${
          run.mode === 'standard'
            ? `<div class="pill"><div><small id="hud-due-label"></small><b id="hud-due"></b></div></div>
               <div class="pill clock" id="hud-clock-pill"><div><small>Due in</small><b id="hud-clock"></b></div></div>
               <div class="pill debt">
                 <small id="hud-paid"></small>
                 <div class="progress"><span id="hud-bar"></span></div>
               </div>`
            : ''
        }
        <div class="hud-actions">
          ${run.mode === 'standard' ? '<a class="btn small gold" id="hud-hustle" href="#/hustle" hidden>Hustle</a><button class="btn small win" id="hud-pay">Pay now</button>' : ''}
          <button class="btn small ghost" id="hud-quit">End run</button>
        </div>
      </div>`)
    );
    $('#hud-pay')?.addEventListener('click', () => {
      const due = currentInstallment();
      if (due && payInstallment()) celebratePayment(due.amount);
    });
    $('#hud-quit').addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'End this run?',
        body: 'Your current run will finish and you’ll see your summary. This can’t be undone.',
        confirm: 'End run',
        danger: true,
      });
      if (ok) endRun('quit');
    });
  }
  updateHud();
}

function updateHud(delta = 0) {
  const run = state.run;
  const moneyEl = $('#hud-money');
  if (!run || !moneyEl) return;

  countTo(moneyEl, run.balance, delta > 0 ? 1100 : 500);
  if (delta) {
    moneyEl.classList.remove('bump-up', 'bump-down');
    void moneyEl.offsetWidth;
    moneyEl.classList.add(delta > 0 ? 'bump-up' : 'bump-down');
  }
  $('#hud-perks').innerHTML = perkChips();
  const luck = run.luck ?? 0;
  $('#hud-luck-pct').textContent = `+${Math.round(luck * 100)}%`;
  const cap = perkCount('clover') ? LUCK.cloverCap : LUCK.cap;
  $('#hud-luck-bar').style.width = `${(luck / cap) * 100}%`;
  $('#hud-luck').classList.toggle('maxed', luck >= cap - 1e-9);
  if (run.mode !== 'standard') return;
  $('#hud-hustle').hidden = run.balance + 1e-9 >= HUSTLE.cap || route.name === 'hustle';
  const due = currentInstallment();
  if (!due) return;
  const n = run.standard.index + 1;
  $('#hud-due-label').textContent = `Installment ${n}/${STANDARD.installments.length}`;
  $('#hud-due').textContent = money(due.amount);
  $('#hud-paid').textContent = `Debt paid · ${money(run.standard.paid)} of ${money(TOTAL_DEBT)}`;
  $('#hud-bar').style.width = `${(run.standard.paid / TOTAL_DEBT) * 100}%`;
  updateClock();
  const pay = $('#hud-pay');
  pay.disabled = run.balance + 1e-9 < due.amount;
  pay.textContent = `Pay ${money(due.amount)}`;
}

function updateClock() {
  const el = $('#hud-clock');
  const s = state.run?.standard;
  if (!el || !s) return;
  el.textContent = clock(s.remainingMs);
  const pill = $('#hud-clock-pill');
  pill.classList.toggle('warn', s.remainingMs <= 60_000 && s.remainingMs > 20_000);
  pill.classList.toggle('danger', s.remainingMs <= 20_000);
  pill.classList.toggle('paused', !clocksRunning());
  pill.title = clocksRunning() ? 'Time left to pay this installment' : 'Paused';
}

function celebratePayment(amount) {
  sfx.pay();

  const bar = $('#hud-bar')?.closest('.pill');
  fx.coinsTo($('#hud-money'), bar, 10, () => fx.thump(bar));
  fx.stars(bar, 8, 90);
  toast(`Installment of <b>${money(amount)}</b> paid. Breathe.`, 'good');
}

const clocksRunning = () =>
  isActive() && onFloor() && !(state.run.pendingOffers > 0) && document.visibilityState === 'visible';

let last = performance.now();
let warnedFor = -1;
let lastBeep = -1;
setInterval(() => {
  const now = performance.now();
  const dt = now - last;
  last = now;
  if (!clocksRunning()) {
    updateClock();
    return;
  }
  const before = state.run.playMs;
  tick(dt);
  const run = state.run;
  if (!run || run.over) return;

  const every = BREAK_REMINDER_MINUTES * 60_000;
  if (Math.floor(run.playMs / every) > Math.floor(before / every)) {
    toast(`You’ve been playing for ${Math.round(run.playMs / 60_000)} minutes. A break is a good idea. <a href="#/support">Support</a>`, 'info', 7000);
  }

  if (run.mode === 'standard') {
    const s = run.standard;
    if (s.remainingMs <= 30_000 && warnedFor !== s.index) {
      warnedFor = s.index;
      toast(`30 seconds to pay <b>${money(currentInstallment().amount)}</b>!`, 'bad');
    }
    const secs = Math.ceil(s.remainingMs / 1000);
    if (secs <= 10 && secs !== lastBeep) {
      lastBeep = secs;
      sfx.alarm();
    }
    updateClock();
  }
}, 250);

document.addEventListener('visibilitychange', () => (last = performance.now()));

subscribe((e) => {
  if (e.type === 'balance') updateHud(e.delta);
  if (e.type === 'paid' && e.auto) {
    celebratePayment(e.amount);
    toast('The clock ran out, so the installment was paid automatically.', 'info');
  }
  if (e.type === 'over') {
    if (e.reason === 'cleared') {
      sfx.bigWin();
      fx.celebrate(null, 4);
    } else if (e.reason !== 'quit') {
      sfx.lose();
      fx.shake(document.body);
    }
    setTimeout(() => go('#/over'), e.reason === 'quit' ? 0 : 700);
  }
  if (e.type === 'settings') renderMute();
  if (e.type === 'offer' && onFloor()) setTimeout(maybeOfferPerk, 700);
  if (e.type === 'perk') updateHud();
  if (e.type === 'luck') {
    updateHud();
    if (!e.reset) fx.thump($('#hud-luck'));
  }
  if (e.type === 'rebate') fx.popText($('#hud-money'), `+${money(e.amount)} rebate`, { size: 22, color: '#4f8cff', dy: 40, rise: 40 });
  if (e.type === 'piggy') toast(`Piggy Bank: <b>${money(e.amount)}</b> back.`, 'good');
  if (e.type === 'grace') {
    toast('<b>Grace Period!</b> You get 60 more seconds. Make them count.', 'info', 5000);
    fx.shake(document.body, true);
  }
});

document.addEventListener('click', (e) => {
  if (e.detail > 0) e.target.closest('button')?.blur();
});

const muteBtn = $('#mute-btn');
function renderMute() {
  muteBtn.innerHTML = state.settings.muted ? icons.soundOff : icons.soundOn;
  muteBtn.setAttribute('aria-label', state.settings.muted ? 'Unmute sound' : 'Mute sound');
}
muteBtn.addEventListener('click', () => {
  setMuted(!state.settings.muted);
  sfx.click();
});
renderMute();

render();

const preload = () => GAMES.filter((g) => g.ready).forEach((g) => g.load().catch(() => {}));
if ('requestIdleCallback' in window) requestIdleCallback(preload);
else setTimeout(preload, 1500);
