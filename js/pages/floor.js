import { state } from '../state.js';
import { TIERS, GAMES } from '../games/registry.js';
import { h, money } from '../ui.js';
import { HUSTLE } from '../config.js';

const ZONE_COLORS = { low: 'var(--win-bright)', mid: 'var(--gold)', high: 'var(--loss)', extra: 'var(--purple)' };

export function renderFloor(root) {
  const run = state.run;
  const ready = GAMES.filter((g) => g.ready).length;
  root.append(
    h(`
    <div class="floor-head">
      <h1>The Floor</h1>
      <span class="count-chip">${ready} of ${GAMES.length} machines open</span>
    </div>`)
  );

  if (run.mode === 'standard') {
    const open = run.balance + 1e-9 < HUSTLE.cap;
    root.append(
      h(`
      <section class="zone">
        <div class="zone-sign" style="--zone:#4fd1ff"><h2>Side Hustle</h2><span>Broke? Scrub dishes for pocket money</span></div>
        <div class="cabinets">
          <${open ? 'a href="#/hustle"' : 'div'} class="cabinet hustle ${open ? 'playable' : 'locked'}">
            <div class="screen"><span>◍</span></div>
            ${open ? '' : `<div class="tape">UNDER ${money(HUSTLE.cap)} ONLY</div>`}
            <h3>Dish Pit</h3>
            <p>${money(HUSTLE.payPerPlate)} a plate. Costs time, not money.</p>
            <span class="plaque">Free</span>
          </${open ? 'a' : 'div'}>
        </div>
      </section>`)
    );
  }

  for (const tier of TIERS) {
    const games = GAMES.filter((g) => g.tier === tier.id);
    const zone = h(`
      <section class="zone">
        <div class="zone-sign" style="--zone:${ZONE_COLORS[tier.id]}"><h2>${tier.name}</h2><span>${tier.blurb}</span></div>
        <div class="cabinets"></div>
      </section>`);
    const grid = zone.querySelector('.cabinets');
    for (const g of games) {
      const poor = g.ready && run.balance + 1e-9 < g.minBet;
      const tag = g.ready ? 'a' : 'div';
      grid.append(
        h(`
        <${tag} class="cabinet ${g.ready ? 'playable' : 'locked'} ${poor ? 'too-poor' : ''}"
          ${g.ready ? `href="#/game/${g.id}"` : 'aria-disabled="true"'} style="--accent:${g.accent}">
          <div class="screen"><span>${g.glyph}</span></div>
          ${g.ready ? '' : '<div class="tape">COMING SOON</div>'}
          <h3>${g.name}</h3>
          <p>${g.blurb}</p>
          <span class="plaque">Min ${money(g.minBet)}</span>
        </${tag}>`)
      );
    }
    root.append(zone);
  }
}
