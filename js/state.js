import { FREE_PLAY, STANDARD, LUCK } from './config.js';
import { GAMES } from './games/registry.js';

const SAVE_KEY = 'kasino.save.v1';
const listeners = new Set();

export const state = load();

function load() {
  const fallback = { run: null, settings: { muted: false } };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed, settings: { ...fallback.settings, ...parsed.settings } };
  } catch {
    return fallback;
  }
}

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {

  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event) {
  save();
  listeners.forEach((fn) => fn(event));
}

export function newRun(mode) {
  const startBalance = mode === 'standard' ? STANDARD.startBalance : FREE_PLAY.startBalance;
  state.run = {
    mode,
    balance: startBalance,
    startedAt: Date.now(),
    playMs: 0,
    over: null,
    stats: { rounds: 0, wagered: 0, won: 0, biggestWin: 0, peak: startBalance, hustled: 0, rebated: 0 },

    history: [{ b: startBalance, k: 'start' }],
    perks: [],
    pendingOffers: 1,
    milestone: 0,
    graceUsed: false,
    luck: 0,
    round: { stake: 0, won: 0 },
    standard:
      mode === 'standard'
        ? { index: 0, remainingMs: STANDARD.installments[0].minutes * 60_000, paid: 0 }
        : null,
  };
  emit({ type: 'run' });
}

export function endRun(reason) {
  const run = state.run;
  if (!run || run.over) return;
  run.over = { reason, at: Date.now(), balance: run.balance };
  emit({ type: 'over', reason });
}

export function clearRun() {
  state.run = null;
  emit({ type: 'run' });
}

export const isActive = () => Boolean(state.run && !state.run.over);

export const perkCount = (id) => state.run?.perks?.filter((p) => p === id).length ?? 0;

function offerPerk() {
  const run = state.run;
  run.pendingOffers = (run.pendingOffers ?? 0) + 1;
  emit({ type: 'offer' });
}

export const sharkBonus = (amount, stake) => (amount > stake ? round2(stake + (amount - stake) * (1 + 0.1 * perkCount('cards'))) : amount);

export function takePerk(id) {
  const run = state.run;
  if (!run || !(run.pendingOffers > 0)) return;
  (run.perks ??= []).push(id);
  run.pendingOffers -= 1;
  emit({ type: 'perk', id });
}

export const luck = () => state.run?.luck ?? 0;

export const luckyReroll = () => Math.random() < luck();

function updateLuck(stake, won) {
  const run = state.run;
  if (!(stake > 0)) return;
  const before = run.luck ?? 0;
  const clover = perkCount('clover') > 0;
  const cap = clover ? LUCK.cloverCap : LUCK.cap;
  run.luck = won > stake ? 0 : Math.min(cap, before + (clover ? LUCK.cloverStep : LUCK.step));
  if (run.luck !== before) emit({ type: 'luck', luck: run.luck, reset: run.luck < before });
}

export function placeBet(amount) {
  const run = state.run;
  if (!isActive() || !(amount > 0) || amount > run.balance + 1e-9) return false;
  run.balance = round2(run.balance - amount);
  run.stats.rounds += 1;
  run.stats.wagered = round2(run.stats.wagered + amount);
  run.round ??= { stake: 0, won: 0 };
  run.round.stake += amount;
  emit({ type: 'balance', delta: -amount });
  return true;
}

export function payout(amount, stake = 0) {
  const run = state.run;
  if (!run || !(amount > 0)) return;
  run.balance = round2(run.balance + amount);
  const profit = amount - stake;
  if (profit > 0) {
    run.stats.won = round2(run.stats.won + profit);
    run.stats.biggestWin = Math.max(run.stats.biggestWin, round2(profit));
  }
  run.stats.peak = Math.max(run.stats.peak, run.balance);
  run.round ??= { stake: 0, won: 0 };
  run.round.won += amount;
  emit({ type: 'balance', delta: amount });
  checkMilestones();
}

export function earn(amount) {
  const run = state.run;
  if (!isActive() || !(amount > 0)) return;
  run.balance = round2(run.balance + amount);
  run.stats.hustled = round2((run.stats.hustled ?? 0) + amount);
  run.stats.peak = Math.max(run.stats.peak, run.balance);
  record('hustle');
  emit({ type: 'balance', delta: amount });
}

function checkMilestones() {
  const run = state.run;
  if (!isActive() || run.mode !== 'free') return;
  while (run.milestone < FREE_PLAY.perkAt.length && run.balance >= FREE_PLAY.perkAt[run.milestone]) {
    run.milestone += 1;
    offerPerk();
  }
}

export function roundSettled() {
  const run = state.run;
  if (!run) return;
  const r = run.round ?? { stake: 0, won: 0 };
  const loss = r.stake - r.won;
  const rebates = perkCount('rebate');
  if (loss > 0 && rebates && isActive()) {
    const back = round2(loss * 0.04 * rebates);
    if (back > 0) {
      run.balance = round2(run.balance + back);
      run.stats.rebated = round2((run.stats.rebated ?? 0) + back);
      emit({ type: 'rebate', amount: back });
      emit({ type: 'balance', delta: back });
    }
  }
  updateLuck(r.stake, r.won);
  run.round = { stake: 0, won: 0 };
  record('round');
  checkBust();
}

const MAX_HISTORY = 4000;

function record(kind) {
  const run = state.run;
  if (!run) return;
  run.history ??= [{ b: run.balance, k: 'start' }];
  run.history.push({ b: run.balance, k: kind });

  if (run.history.length > MAX_HISTORY) {
    run.history = run.history.filter((p, i) => p.k !== 'round' || i % 2 === 0 || i > MAX_HISTORY / 2);
  }
  save();
}

export function cheapestMinBet() {
  const mins = GAMES.filter((g) => g.ready).map((g) => g.minBet);
  return mins.length ? Math.min(...mins) : 0;
}

export function checkBust() {
  const run = state.run;
  if (!isActive() || run.mode === 'standard') return false;
  if (run.balance + 1e-9 < cheapestMinBet()) {
    endRun('bust');
    return true;
  }
  return false;
}

export function currentInstallment() {
  const s = state.run?.standard;
  return s ? STANDARD.installments[s.index] : null;
}

export function payInstallment({ auto = false } = {}) {
  const run = state.run;
  const due = currentInstallment();
  if (!isActive() || !due || run.balance + 1e-9 < due.amount) return false;
  run.balance = round2(run.balance - due.amount);
  run.standard.paid += due.amount;
  run.standard.index += 1;
  record('pay');
  const next = currentInstallment();
  emit({ type: 'paid', amount: due.amount, auto, cleared: !next });
  if (!next) {
    endRun('cleared');
    return true;
  }
  run.standard.remainingMs = (next.minutes + perkCount('time')) * 60_000;
  emit({ type: 'balance', delta: -due.amount });
  const piggy = round2(due.amount * 0.1 * perkCount('piggy'));
  if (piggy > 0) {
    run.balance = round2(run.balance + piggy);
    emit({ type: 'piggy', amount: piggy });
    emit({ type: 'balance', delta: piggy });
  }
  offerPerk();
  return true;
}

export function tick(dtMs) {
  const run = state.run;
  if (!isActive()) return;
  run.playMs += dtMs;
  if (run.mode !== 'standard') return;
  run.standard.remainingMs -= dtMs;
  if (run.standard.remainingMs <= 0) {
    run.standard.remainingMs = 0;
    if (payInstallment({ auto: true })) return;
    if (perkCount('grace') && !run.graceUsed) {
      run.graceUsed = true;
      run.standard.remainingMs = 60_000;
      emit({ type: 'grace' });
      return;
    }
    endRun('missed');
  }
}

export function setMuted(muted) {
  state.settings.muted = muted;
  emit({ type: 'settings' });
}

export const round2 = (n) => Math.round(n * 100) / 100;
