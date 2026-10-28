import { money } from './ui.js';

const H = 260;
const M = { t: 12, r: 16, b: 26, l: 60 };
const STYLE = {
  up: 'stroke:var(--win)',
  down: 'stroke:var(--loss)',
  flat: 'stroke:var(--muted)',
  pay: 'stroke:var(--muted);stroke-dasharray:4 4',
};

export function balanceChart(el, points, start) {
  if (points.length < 2) {
    el.innerHTML = '<div class="chart-empty">Not enough rounds played to draw a chart.</div>';
    return () => {};
  }
  const draw = () => render(el, points, start);
  draw();
  const ro = new ResizeObserver(draw);
  ro.observe(el);
  return () => ro.disconnect();
}

function render(el, points, start) {
  const W = el.clientWidth;
  if (!W) return;
  if (el._w === W) return;
  el._w = W;

  const n = points.length;
  const max = Math.max(start, ...points.map((p) => p.b));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1];
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const x = (i) => M.l + (i / (n - 1)) * plotW;
  const y = (v) => M.t + plotH - (v / top) * plotH;

  const groups = [];
  for (let i = 1; i < n; i++) {
    const p = points[i];
    const d = p.b - points[i - 1].b;
    const kind = p.k === 'pay' ? 'pay' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const last = groups[groups.length - 1];
    if (last && last.kind === kind) last.pts.push(i);
    else groups.push({ kind, pts: [i - 1, i] });
  }

  const grid = ticks
    .map(
      (t) => `<line x1="${M.l}" x2="${W - M.r}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--panel)"/>
              <text x="${M.l - 10}" y="${y(t) + 4}" text-anchor="end">${money(t)}</text>`
    )
    .join('');
  const lines = groups
    .map(
      (g) =>
        `<polyline fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" style="${STYLE[g.kind]}"
          points="${g.pts.map((i) => `${x(i).toFixed(1)},${y(points[i].b).toFixed(1)}`).join(' ')}"/>`
    )
    .join('');
  const payDots = points
    .map((p, i) =>
      p.k === 'pay' ? `<circle cx="${x(i)}" cy="${y(p.b)}" r="4" style="fill:var(--ink);stroke:var(--muted);stroke-width:2"/>` : ''
    )
    .join('');
  const rounds = points.filter((p) => p.k === 'round').length;

  el.innerHTML = `
    <svg height="${H}" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Balance over the run: started at ${money(start)}, ended at ${money(points[n - 1].b)}, peak ${money(max)}.">
      ${grid}
      <line x1="${M.l}" x2="${W - M.r}" y1="${y(start)}" y2="${y(start)}" style="stroke:var(--dim);stroke-dasharray:2 4"/>
      <text x="${W - M.r}" y="${y(start) - 6}" text-anchor="end">start</text>
      <text x="${M.l}" y="${H - 6}">Start</text>
      <text x="${W - M.r}" y="${H - 6}" text-anchor="end">${rounds} round${rounds === 1 ? '' : 's'}</text>
      ${lines}
      ${payDots}
      <g class="hover" style="display:none">
        <line y1="${M.t}" y2="${M.t + plotH}" style="stroke:var(--panel-3)"/>
        <circle r="5" style="fill:var(--text);stroke:var(--ink);stroke-width:2"/>
      </g>
      <rect x="${M.l}" y="0" width="${plotW}" height="${H}" fill="transparent" style="cursor:crosshair"/>
    </svg>
    <div class="tooltip"></div>`;

  const svg = el.querySelector('svg');
  const hover = svg.querySelector('.hover');
  const vline = hover.querySelector('line');
  const dot = hover.querySelector('circle');
  const tip = el.querySelector('.tooltip');

  let round = 0;
  const labels = points.map((p) => (p.k === 'round' ? `Round ${++round}` : p.k === 'pay' ? 'Debt payment' : 'Start'));

  const hit = svg.querySelector('rect');
  hit.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / plotW) * (n - 1))));
    const p = points[i];
    const cx = x(i);
    const cy = y(p.b);
    hover.style.display = '';
    vline.setAttribute('x1', cx);
    vline.setAttribute('x2', cx);
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    const d = i > 0 ? p.b - points[i - 1].b : 0;
    const change = i === 0 ? '' : `<span class="${d > 0 ? 'pos' : d < 0 ? 'neg' : 'muted'}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${money(Math.abs(d))}</span>`;
    tip.innerHTML = `<span class="muted">${labels[i]}</span> ${change}<b>${money(p.b)}</b>`;
    tip.style.display = 'block';
    const tw = tip.offsetWidth;
    tip.style.left = `${cx + 12 + tw > W ? cx - tw - 12 : cx + 12}px`;
    tip.style.top = `${Math.max(0, cy - 48)}px`;
  });
  hit.addEventListener('pointerleave', () => {
    hover.style.display = 'none';
    tip.style.display = 'none';
  });
}

function niceTicks(max, count) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v < max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100);
  return ticks;
}
