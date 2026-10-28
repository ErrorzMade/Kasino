export const SUITS = ['♠', '♥', '♦', '♣'];
const LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const rankLabel = (r) => LABELS[r] || String(r);
export const isRed = (suit) => suit === '♥' || suit === '♦';

export const randomCard = () => ({ rank: 1 + Math.floor(Math.random() * 13), suit: SUITS[Math.floor(Math.random() * 4)] });

export function cardHtml({ rank, suit }, extra = '') {
  const label = rankLabel(rank);
  return `
    <div class="card ${isRed(suit) ? 'red' : ''} ${extra}" aria-label="${label}${suit}">
      <span class="corner tl">${label}<i>${suit}</i></span>
      <span class="pip">${rank > 10 ? label : suit}</span>
      <span class="corner br">${label}<i>${suit}</i></span>
    </div>`;
}

export const cardBackHtml = (extra = '') => `<div class="card back ${extra}"><span>K</span></div>`;
