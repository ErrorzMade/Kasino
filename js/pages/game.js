import { state, placeBet, payout, roundSettled } from '../state.js';
import { gameById } from '../games/registry.js';
import { h } from '../ui.js';
import { go } from '../main.js';

export function renderGame(root, route) {
  const game = gameById(route.id);
  if (!game?.ready) {
    go('#/floor');
    return;
  }
  root.append(
    h(`
    <div class="game-head">
      <a class="back btn small ghost" href="#/floor">← Floor</a>
      <h1>${game.name}</h1>
    </div>`)
  );
  const mountPoint = h('<div></div>');
  root.append(mountPoint);

  let disposed = false;
  let gameCleanup = null;
  const ctx = {
    game,
    getBalance: () => state.run?.balance ?? 0,
    isOver: () => Boolean(state.run?.over),
    placeBet,
    payout,
    roundSettled,
  };
  game
    .load()
    .then((mod) => {
      if (!disposed) gameCleanup = mod.mount(mountPoint, ctx) || null;
    })
    .catch(() => {
      if (disposed) return;
      mountPoint.append(
        h(`
        <div class="panel load-error">
          <h2>${game.name} didn’t load</h2>
          <p>The game files couldn’t be fetched. Check your connection and refresh. Your run is saved.</p>
          <button class="btn gold" data-act="reload">Refresh</button>
        </div>`)
      );
      mountPoint.querySelector('[data-act=reload]').addEventListener('click', () => location.reload());
    });
  return () => {
    disposed = true;
    gameCleanup?.();
  };
}
