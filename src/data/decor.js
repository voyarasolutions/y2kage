// Set dressing for each arena, placed deterministically from the map so every run looks the same.
// Solid pieces bump the player and the horde but never block a pathfinding cell, so they can't
// wall anyone in. Kinds are drawn in world.js (buildDecor).
import { hash2 } from '../core/util.js';

const KITS = {
  'Times Square': { wall: ['hydrant', 'payphone', 'mailbox', 'bags', 'endSign', 'bags', 'hydrant'], street: 'manhole', every: 4 },
  Broadway: { wall: ['hydrant', 'payphone', 'bags', 'endSign', 'mailbox', 'bags'], street: 'manhole', every: 3 },
  'Subway Platform': { wall: [], street: null, every: 99 },
  'Bank Server Room': { wall: ['crtPile', 'desk', 'extinguisher', 'crtPile', 'desk'], street: null, every: 3 },
  'The Ball Drop': { wall: ['ac', 'bags', 'ac', 'speakers'], street: null, every: 3 },
};

// Radius for solid decor; anything missing is walk-through.
export const DECOR_R = { hydrant: 0.16, payphone: 0.2, mailbox: 0.26, endSign: 0.2, crtPile: 0.3, desk: 0.35, ac: 0.4, speakers: 0.3, vending: 0.3 };

export function decorFor(map) {
  const kit = KITS[map.name];
  const out = [];
  if (!kit) return out;
  const { w, h } = map;
  const wall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || map.walls[y * w + x];
  const near = (x, y, pts, d) => pts.some((p) => Math.abs(p.x - 0.5 - x) + Math.abs(p.y - 0.5 - y) < d);
  const avoid = [...map.spawns, map.start, ...map.props];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (wall(x, y) || near(x, y, avoid, 3)) continue;
      const ch = map.grid[y][x];
      const r = hash2(x * 13 + 7, y * 17 + w);
      // Against a wall (sidewalks, room edges): furniture facing out into the room.
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([ox, oy]) => wall(x + ox, y + oy));
      const edgeOk = map.name === 'Bank Server Room' ? dirs.some(([ox, oy]) => map.wallChar[(y + oy) * w + x + ox] === 'D') : map.name === 'The Ball Drop' ? true : ch === ':';
      if (dirs.length === 1 && edgeOk && kit.wall.length && Math.floor(r * 1000) % kit.every === 0) {
        const [ox, oy] = dirs[0];
        const kind = kit.wall[Math.floor(r * 7919) % kit.wall.length];
        out.push({ kind, x: x + 0.5 + ox * 0.28, y: y + 0.5 + oy * 0.28, rot: Math.atan2(-ox, -oy), r: DECOR_R[kind] || 0 });
        continue;
      }
      // Out in the street: manholes with steam.
      if (kit.street && ch === '.' && dirs.length === 0 && r < 0.05) out.push({ kind: kit.street, x: x + 0.5, y: y + 0.5, rot: 0, r: 0 });
    }
  }
  if (map.name === 'Subway Platform') {
    // Vending machines and payphones between the pillars, against nothing: the platform is an island.
    for (const [x, y, kind] of [[8, 5, 'vending'], [17, 9, 'vending'], [14, 5, 'payphone'], [26, 9, 'bags'], [3, 9, 'bags']]) {
      if (!wall(x, y)) out.push({ kind, x: x + 0.5, y: y + 0.5, rot: y < 7 ? 0 : Math.PI, r: DECOR_R[kind] || 0 });
    }
  }
  if (map.name === 'The Ball Drop') {
    // Speaker stacks flanking the stage.
    for (const [x, y] of [[8, 4], [17, 4], [8, 13], [17, 13]]) if (!wall(x, y)) out.push({ kind: 'speakers', x: x + 0.5, y: y + 0.5, rot: y < 8 ? Math.PI : 0, r: DECOR_R.speakers });
  }
  return out;
}
