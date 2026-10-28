import { sfx } from './audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function money(n, { cents = 'auto' } = {}) {
  const showCents = cents === true || (cents === 'auto' && Math.abs(n % 1) > 0.001);
  return (
    (n < 0 ? '-$' : '$') +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

export function clock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function countTo(el, to, duration = 600) {
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = to;
  if (from === to) {
    el.textContent = money(to);
    return;
  }
  cancelAnimationFrame(el._raf);
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = money(Math.round((from + (to - from) * eased) * 100) / 100);
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

export function toast(message, kind = 'info', ms = 3200) {
  const el = h(`<div class="toast ${kind}"></div>`);
  el.innerHTML = message;
  document.getElementById('toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

export function confirmModal({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const back = h(`
      <div class="modal-back" role="dialog" aria-modal="true">
        <div class="modal panel">
          <h2></h2><p></p>
          <div class="row">
            <button class="btn ghost small" data-act="no"></button>
            <button class="btn small ${danger ? 'loss' : ''}" data-act="yes"></button>
          </div>
        </div>
      </div>`);
    back.querySelector('h2').textContent = title;
    back.querySelector('p').textContent = body;
    back.querySelector('[data-act=no]').textContent = cancel;
    back.querySelector('[data-act=yes]').textContent = confirm;
    const close = (val) => {
      back.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => e.key === 'Escape' && close(false);
    back.addEventListener('click', (e) => {
      if (e.target === back) close(false);
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) close(act === 'yes');
    });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    back.querySelector('[data-act=yes]').focus();
  });
}

export function betControl({ min, getBalance, initial }) {
  const el = h(`
    <div class="bet">
      <span class="hud-label">Bet amount</span>
      <label class="bet-input">$<input type="number" inputmode="decimal" min="${min}" step="1" aria-label="Bet amount" /></label>
      <div class="chips">
        <button class="chip-btn" data-chip="half">½</button>
        <button class="chip-btn" data-chip="double">×2</button>
        <button class="chip-btn" data-chip="min">Min</button>
        <button class="chip-btn" data-chip="max">Max</button>
      </div>
      <div class="bet-note"></div>
    </div>`);
  const input = el.querySelector('input');
  const note = el.querySelector('.bet-note');
  input.value = initial ?? min;

  const read = () => Math.round(Number(input.value) * 100) / 100;
  const set = (v) => {
    input.value = Math.max(min, Math.round(v * 100) / 100);
    validate();
  };
  function validate() {
    const v = read();
    let msg = '';
    if (!(v >= min)) msg = `Minimum bet is ${money(min)}`;
    else if (v > getBalance() + 1e-9) msg = 'Not enough in your balance';
    note.textContent = msg || `Min ${money(min)}`;
    note.classList.toggle('err', Boolean(msg));
    return !msg;
  }
  input.addEventListener('input', validate);
  el.querySelector('.chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]')?.dataset.chip;
    if (!chip) return;
    sfx.chip();
    const bal = getBalance();
    if (chip === 'half') set(read() / 2);
    if (chip === 'double') set(Math.min(read() * 2, Math.max(min, bal)));
    if (chip === 'min') set(min);
    if (chip === 'max') set(Math.max(min, Math.floor(bal * 100) / 100));
  });
  validate();

  return {
    el,
    get value() { return read(); },
    validate,
    setDisabled(d) { el.querySelectorAll('input, button').forEach((b) => (b.disabled = d)); },
  };
}

export const icons = {
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>',
};
