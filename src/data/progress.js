// Hero experience. Every kill earns XP for the hero you're playing, saved between sessions.
// Each level-up makes that hero hit harder, so grinding earlier levels pays off later.
import { store } from '../core/util.js';

export const MAX_RANK = 99;
export const DMG_PER_RANK = 0.04;

// Total XP needed to reach rank r.
export function xpForRank(r) {
  return Math.round(150 * Math.pow(Math.max(0, r - 1), 1.5));
}

export function rankFor(xp) {
  let r = 1;
  while (r < MAX_RANK && xp >= xpForRank(r + 1)) r++;
  return r;
}

export function dmgMulFor(rank) {
  return 1 + (rank - 1) * DMG_PER_RANK;
}

export function loadXp() {
  return store.get('xp', {}) || {};
}

export function heroXp(id) {
  return loadXp()[id] || 0;
}

export function saveHeroXp(id, xp) {
  const all = loadXp();
  all[id] = Math.max(all[id] || 0, Math.round(xp));
  store.set('xp', all);
}

// Special meter, saved per hero so it carries over between waves, levels and sessions.
export function heroSp(id) {
  const v = (store.get('sp', {}) || {})[id];
  return Math.max(0, Math.min(100, Number(v) || 0));
}

export function saveHeroSp(id, sp) {
  const all = store.get('sp', {}) || {};
  all[id] = Math.round(Math.max(0, Math.min(100, sp)));
  store.set('sp', all);
}
