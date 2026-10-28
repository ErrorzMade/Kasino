import { h } from '../ui.js';

const RESOURCES = [
  {
    region: 'United States',
    name: 'National Problem Gambling Helpline',
    contact: '1-800-GAMBLER (call or text)',
    href: 'https://www.ncpgambling.org/help-treatment/',
    note: 'Free, confidential, 24/7. Run by the National Council on Problem Gambling.',
  },
  {
    region: 'United Kingdom',
    name: 'National Gambling Helpline (GamCare)',
    contact: '0808 8020 133',
    href: 'https://www.gamcare.org.uk/',
    note: 'Free 24/7 phone and live chat support, plus counselling.',
  },
  {
    region: 'United Kingdom',
    name: 'GambleAware',
    contact: 'gambleaware.org',
    href: 'https://www.gambleaware.org/',
    note: 'Advice, self-assessment tools and routes to free treatment.',
  },
  {
    region: 'United Kingdom',
    name: 'GAMSTOP',
    contact: 'gamstop.co.uk',
    href: 'https://www.gamstop.co.uk/',
    note: 'Free self-exclusion from UK-licensed gambling websites and apps.',
  },
  {
    region: 'Australia',
    name: 'Gambling Help Online',
    contact: '1800 858 858',
    href: 'https://www.gamblinghelponline.org.au/',
    note: 'Free 24/7 counselling by phone, chat and email.',
  },
  {
    region: 'Worldwide',
    name: 'Gamblers Anonymous',
    contact: 'gamblersanonymous.org',
    href: 'https://www.gamblersanonymous.org/',
    note: 'Peer support meetings, in person and online, around the world.',
  },
  {
    region: 'Worldwide',
    name: 'Gambling Therapy',
    contact: 'gamblingtherapy.org',
    href: 'https://www.gamblingtherapy.org/',
    note: 'Free multilingual online support for anyone affected by gambling.',
  },
];

export function renderSupport(root) {
  root.append(
    h(`
    <article class="support">
      <h1>It’s a game here. It isn’t everywhere.</h1>
      <p class="intro">Kasino uses pretend money only. Nothing can be bought and nothing can be cashed out. But the games are modelled on
      real ones, and real gambling causes real harm to many people and the people around them. If any of this
      page sounds familiar, for you or someone you care about, help is free and confidential.</p>

      <h2>Get help</h2>
      <div class="resources"></div>
      <p class="muted" style="margin-top:14px;font-size:13px">If you’re outside these countries, search for “gambling helpline”
      plus your country’s name. Most countries have a free service.</p>

      <h2>Warning signs</h2>
      <ul>
        <li>Needing to bet more and more to feel the same excitement</li>
        <li>Chasing losses: trying to win back money you’ve lost</li>
        <li>Lying to family or friends about how much you gamble</li>
        <li>Borrowing money, selling things, or missing bills to keep gambling</li>
        <li>Feeling restless, irritable or low when you try to cut back</li>
        <li>Gambling to escape stress, loneliness or other problems</li>
        <li>Thinking about gambling constantly, or planning the next bet</li>
      </ul>

      <h2>The house always wins</h2>
      <p>Every game in a real casino is built so the house keeps a slice of every bet over time.
      No strategy, streak, “system” or lucky feeling changes that maths. Losses aren’t “due” to turn around: each spin, flip or card
      is independent of the last one.</p>
      <div class="odds-wrap"><table class="odds-table">
        <thead><tr><th>Game</th><th>Typical house edge</th><th>What it means per $100 bet</th></tr></thead>
        <tbody>
          <tr><td>Blackjack (basic strategy)</td><td>~0.5–2%</td><td>About $0.50–$2 lost</td></tr>
          <tr><td>Roulette (single zero)</td><td>2.7%</td><td>About $2.70 lost</td></tr>
          <tr><td>Slot machines</td><td>~2–15%</td><td>About $2–$15 lost</td></tr>
          <tr><td>Scratch cards / lotteries</td><td>often 30–50%</td><td>About $30–$50 lost</td></tr>
        </tbody>
      </table></div>
    </article>`)
  );

  const list = root.querySelector('.resources');
  for (const r of RESOURCES) {
    const card = h(`
      <a class="resource" target="_blank" rel="noopener noreferrer">
        <span class="region"></span><strong></strong><span class="contact"></span><span></span>
      </a>`);
    card.href = r.href;
    const spans = card.querySelectorAll('span');
    spans[0].textContent = r.region;
    card.querySelector('strong').textContent = r.name;
    spans[1].textContent = r.contact;
    spans[2].textContent = r.note;
    list.append(card);
  }
}
