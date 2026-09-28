// The weapon bob from the ride, and 2D sparkle and flame over the 3D weapons (gfx/viewmodel.js),
// which draws every weapon and hand.
import { MUZZLE } from '../data/muzzles.js';
import { PAL } from '../core/palette.js';

export function weaponBob(P) {
  const M = P.hero.move;
  const sp = Math.min(1, P.speed / 4);
  let bx = Math.sin(P.stride * 2.2) * 5 * sp;
  let by = Math.abs(Math.cos(P.stride * 2.2)) * 4 * sp;
  if (M.type === 'skate' || M.type === 'board') {
    bx = Math.sin(P.stride * 1.1) * 7 * sp;
    by = 2 * sp;
  }
  if (M.type === 'pogo') by = -P.z * 14 + 6;
  if (M.type === 'slinky') by += P.charge * 18;
  if (!P.onGround && M.type !== 'pogo') by -= Math.min(12, P.vz * 2);
  if (P.dashT > 0) bx -= 10;
  return { bx, by };
}

export class WeaponView {
  draw(g, sim, heroIdx, t) {
    const P = sim.player;
    const G = sim.hero.gun;
    const { bx, by } = weaponBob(P);
    const kick = P.fireAnim > 0 ? 3 : 0;

    if (G.kind === 'soaker') {
      // The gun itself is 3D (gfx/viewmodel.js); spray sparkles at the nozzle.
      if (P.fireAnim > 0) {
        for (let i = 0; i < 5; i++) {
          g.fillStyle = i % 2 ? '#8fd8ff' : '#ffffff';
          g.fillRect(Math.round(MUZZLE.soaker.x - 1 + (Math.random() - 0.5) * 5 + bx), Math.round(MUZZLE.soaker.y - 2 - Math.random() * 5 + by), 2, 2);
        }
      }
    } else if (G.kind === 'rocket') {
      // The launcher is 3D (gfx/viewmodel.js); a burst of flame at its mouth.
      if (P.fireAnim > 0.1) {
        const fx = Math.round(MUZZLE.rocket.x + bx);
        const fy = Math.round(MUZZLE.rocket.y + kick * 2 + by);
        g.fillStyle = PAL.tangerine;
        g.fillRect(fx - 12, fy - 5, 24, 10);
        g.fillRect(fx - 7, fy - 10, 14, 20);
        g.fillStyle = PAL.gold;
        g.fillRect(fx - 8, fy - 3, 16, 6);
        g.fillRect(fx - 4, fy - 6, 8, 12);
        g.fillStyle = PAL.cream;
        g.fillRect(fx - 3, fy - 2, 6, 4);
      }
    }
    // Every weapon and hand is 3D now (gfx/viewmodel.js); this only adds 2D sparkle and flame.
    return { bx, by };
  }
}
