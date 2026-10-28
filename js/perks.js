import { state, perkCount, takePerk } from './state.js';
import { h } from './ui.js';
import { sfx } from './audio.js';
import { fx } from './fx.js';
import { perkIcon } from './perkIcons.js';

export const PERKS = [
  { id: 'coin', name: 'Loaded Coin', color: '#ffc83d', desc: 'Coin Flip pays +0.1× more per correct call.', max: 3 },
  { id: 'ticket', name: 'Lucky Ticket', color: '#ff6fb5', desc: 'Scratch-offs are 12% more likely to win.', max: 2 },
  { id: 'reels', name: 'Lucky Pairs', color: '#e5484d', desc: 'Side-by-side pairs on the slots pay 2.2× instead of 1.9×.', max: 1 },
  { id: 'cherry', name: 'Cherry Bomb', color: '#e5484d', desc: 'A cherry pair on the slots pays 3.5× instead of 2.4×.', max: 1 },
  { id: 'wheel', name: 'Greased Wheel', color: '#ff9f43', desc: 'A BUST slice on the wheel becomes a 1.5× slice.', max: 2 },
  { id: 'dice', name: 'Loaded Dice', color: '#4f8cff', desc: 'Dice payouts are 5% bigger.', max: 2 },
  { id: 'mines', name: 'Metal Detector', color: '#9b6bff', desc: 'Mines multipliers are 5% bigger.', max: 2 },
  { id: 'crash', name: 'Rocket Fuel', color: '#ff6fb5', desc: 'The Crash rocket tends to fly 6% further.', max: 2 },
  { id: 'cards', name: 'Card Shark', color: '#3bd497', desc: 'Blackjack, Video Poker and Hi-Lo winnings +10%.', max: 2 },
  { id: 'clover', name: 'Four-Leaf Clover', color: '#3bd497', desc: 'Luck builds faster (+8% a loss) and caps at 40%.', max: 1 },
  { id: 'rebate', name: 'Rebate Card', color: '#4f8cff', desc: 'Get 4% back on every round you lose money.', max: 3 },
  { id: 'time', name: 'Extension', color: '#9b6bff', desc: '+1 minute on every future installment clock.', max: 3, mode: 'standard' },
  { id: 'grace', name: 'Grace Period', color: '#3bd497', desc: 'Once per run, a missed deadline gives you 60 more seconds instead.', max: 1, mode: 'standard' },
  { id: 'piggy', name: 'Piggy Bank', color: '#ffc83d', desc: 'Get 10% of each installment back when you pay it.', max: 2, mode: 'standard' },
  { id: 'payday', name: 'Pay Day', color: '#3bd497', desc: 'The side hustle pays double.', max: 1, mode: 'standard' },
];

export const perkById = (id) => PERKS.find((p) => p.id === id);

function rollChoices() {
  const mode = state.run.mode;
  const pool = PERKS.filter((p) => (!p.mode || p.mode === mode) && perkCount(p.id) < p.max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

let open = false;

export function maybeOfferPerk() {
  const run = state.run;
  if (open || !run || run.over || !(run.pendingOffers > 0)) return;
  const choices = rollChoices();
  if (!choices.length) {

    run.pendingOffers = 0;
    return;
  }
  open = true;
  sfx.pay();
  const back = h(`
    <div class="perk-back" role="dialog" aria-modal="true" aria-label="Pick a perk">
      <h2 class="perk-title">${run.perks?.length || run.stats.rounds ? 'Pick a perk' : 'Pick a starting perk'}</h2>
      <div class="perk-cards">
        ${choices
          .map((p, i) => {
            const owned = perkCount(p.id);
            return `
            <button class="perk-card" data-perk="${p.id}" style="--c:${p.color};animation-delay:${i * 0.09}s">
              <span class="perk-glyph">${perkIcon(p.id, 76)}</span>
              <strong>${p.name}</strong>
              <span class="perk-desc">${p.desc}</span>
              <small>${p.max > 1 ? `Owned ${owned}/${p.max}` : 'One of a kind'}</small>
            </button>`;
          })
          .join('')}
      </div>
    </div>`);
  document.body.append(back);
  fx.confettiBurst(back.querySelector('.perk-title'), 40);

  back.addEventListener('click', (e) => {
    const card = e.target.closest('[data-perk]');
    if (!card || back.classList.contains('closing')) return;
    sfx.ting();
    card.classList.add('chosen');
    back.classList.add('closing');
    fx.stars(card, 14, 160);
    setTimeout(() => {
      back.remove();
      open = false;
      takePerk(card.dataset.perk);
      maybeOfferPerk();
    }, 520);
  });
}

export function perkChips() {
  const run = state.run;
  if (!run?.perks?.length) return '';
  const counts = {};
  run.perks.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  return Object.entries(counts)
    .map(([id, n]) => {
      const p = perkById(id);
      if (!p) return '';
      return `<span class="perk-chip" style="--c:${p.color}" title="${p.name}: ${p.desc}">${perkIcon(id, 26)}${n > 1 ? `<b>×${n}</b>` : ''}</span>`;
    })
    .join('');
}
