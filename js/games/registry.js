export const TIERS = [
  { id: 'low', name: 'Low Stakes', blurb: 'Cheap thrills, small payouts' },
  { id: 'mid', name: 'Mid Stakes', blurb: 'The heart of the floor' },
  { id: 'high', name: 'High Rollers', blurb: 'Big entry, bigger swings' },
  { id: 'extra', name: 'Specials', blurb: 'Oddities and spectacles' },
];

export const GAMES = [
  { id: 'scratch', name: 'Scratch-offs', tier: 'low', minBet: 2, glyph: '✦', accent: '#ff6fb5', blurb: 'Scratch the foil, match three, win.', ready: true, load: () => import('./scratch.js') },
  { id: 'coinflip', name: 'Coin Flip', tier: 'low', minBet: 1, glyph: '◉', accent: '#ffc83d', blurb: 'Double or nothing. Let it ride, or cash out.', ready: true, load: () => import('./coinflip.js') },
  { id: 'plinko', name: 'Plinko', tier: 'low', minBet: 1, glyph: '⁘', accent: '#4f8cff', blurb: 'Drop the ball and pray for the edges.', ready: true, load: () => import('./plinko.js') },
  { id: 'hilo', name: 'Hi-Lo', tier: 'low', minBet: 2, glyph: '⇅', accent: '#3bd497', blurb: 'Higher or lower? Build the pot card by card.', ready: true, load: () => import('./hilo.js') },

  { id: 'wheel', name: 'Spin the Wheel', tier: 'mid', minBet: 10, glyph: '✺', accent: '#ff9f43', blurb: 'One big spin. Jackpot or bust slice.', ready: true, load: () => import('./wheel.js') },
  { id: 'slots', name: 'Slot Machine', tier: 'mid', minBet: 2, glyph: '7', accent: '#e5484d', blurb: 'Pull the lever. Line up three.', ready: true, load: () => import('./slots.js') },
  { id: 'mines', name: 'Mines', tier: 'mid', minBet: 2, glyph: '✸', accent: '#9b6bff', blurb: 'Reveal safe tiles. Don\'t touch the bombs.', ready: true, load: () => import('./mines.js') },
  { id: 'dice', name: 'Dice', tier: 'mid', minBet: 2, glyph: '⚄', accent: '#4f8cff', blurb: 'Over or under. You set the risk.', ready: true, load: () => import('./dice.js') },

  { id: 'blackjack', name: 'Blackjack', tier: 'high', minBet: 10, glyph: '♠', accent: '#3bd497', blurb: 'Beat the dealer to 21.', ready: true, load: () => import('./blackjack.js') },
  { id: 'roulette', name: 'Roulette', tier: 'high', minBet: 5, glyph: '◎', accent: '#e5484d', blurb: 'Red, black, or a single number.', ready: true, load: () => import('./roulette.js') },
  { id: 'crash', name: 'Crash', tier: 'high', minBet: 5, glyph: '↗', accent: '#ff6fb5', blurb: 'Cash out before the rocket blows.', ready: true, load: () => import('./crash.js') },
  { id: 'poker', name: 'Video Poker', tier: 'high', minBet: 10, glyph: '♦', accent: '#9b6bff', blurb: 'Jacks or Better. Hold and draw.', ready: true, load: () => import('./poker.js') },

  { id: 'race', name: 'Horse Race', tier: 'extra', minBet: 2, glyph: '⚑', accent: '#ff9f43', blurb: 'Back a racer and watch them run.', ready: true, load: () => import('./race.js') },
  { id: 'keno', name: 'Keno', tier: 'extra', minBet: 1, glyph: '❋', accent: '#4f8cff', blurb: 'Pick your numbers, watch the draw.', ready: true, load: () => import('./keno.js') },
  { id: 'mystery', name: 'Mystery Box', tier: 'extra', minBet: 5, glyph: '?', accent: '#9b6bff', blurb: 'Open a box. Watch the reel decide.', ready: true, load: () => import('./mystery.js') },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
