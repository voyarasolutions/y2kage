import { Game } from './game/game.js';

async function boot() {
  const fail = document.getElementById('fail');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('8px Silkscreen')]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch (e) {}
  try {
    window.game = new Game(document.getElementById('gl'), document.getElementById('ui'));
    document.getElementById('ui').focus();
  } catch (e) {
    fail.hidden = false;
    fail.textContent = 'Y2KAGE could not start: ' + e.message;
    console.error(e);
  }
}

boot();
