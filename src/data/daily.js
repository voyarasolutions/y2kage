// The Daily Bug Report: one Endless run a day that is the same for everyone who plays it that day.
// The date picks the hero, the district, a twist and two starting upgrades. Your best wave today
// and your streak of days played are saved on this device.
import { store } from '../core/util.js';
import { HEROES } from './heroes.js';
import { DISTRICTS } from './levels.js';
import { UPGRADES } from './upgrades.js';

// Each twist is a set of sim cheats (see Sim), some of them daily-only.
export const TWISTS = [
  { id: 'heads', name: 'Big Head Mode', desc: 'Huge heads. Aim high.', cheats: { bighead: true } },
  { id: 'moon', name: 'Moon Party', desc: 'Low gravity for everyone.', cheats: { lowgrav: true } },
  { id: 'turbo', name: 'Overclocked', desc: 'The whole game runs 25% faster.', cheats: { turbo: true } },
  { id: 'swarm', name: 'Swarm', desc: 'Half again as many zombies, but flimsier.', cheats: { swarm: true, confetti: true } },
  { id: 'glass', name: 'Glass Cannon', desc: 'You hit twice as hard. So do they.', cheats: { glass: true } },
  { id: 'lucky', name: 'Lucky Day', desc: 'Start with a legendary upgrade.', cheats: {}, legendary: true },
];

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Today's run. Same date, same run.
export function dailyFor(key = todayKey()) {
  let h = 1999;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = rng(h);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const hero = pick(HEROES);
  const district = Math.floor(r() * DISTRICTS.length);
  const twist = pick(TWISTS);
  const commons = UPGRADES.filter((u) => !u.rarity);
  const ups = [pick(commons).id, pick(commons).id];
  if (twist.legendary) ups.push(pick(UPGRADES.filter((u) => u.rarity === 'legendary')).id);
  return { key, hero, district, twist, ups };
}

// { key, best, bestScore, streak, last } for the most recent day played.
export function dailyRecord() {
  const d = store.get('daily', null) || {};
  const key = todayKey();
  const yesterday = todayKey(new Date(Date.now() - 864e5));
  // A streak survives until a whole day is skipped.
  const streak = d.last === key || d.last === yesterday ? d.streak || 0 : 0;
  return { today: d.key === key ? { best: d.best || 0, score: d.bestScore || 0, tries: d.tries || 0 } : { best: 0, score: 0, tries: 0 }, streak, playedToday: d.last === key };
}

// Call when a daily run starts: counts the day toward the streak.
export function dailyStarted() {
  const d = store.get('daily', null) || {};
  const key = todayKey();
  const yesterday = todayKey(new Date(Date.now() - 864e5));
  if (d.last !== key) d.streak = d.last === yesterday ? (d.streak || 0) + 1 : 1;
  if (d.key !== key) Object.assign(d, { key, best: 0, bestScore: 0, tries: 0 });
  d.last = key;
  d.tries = (d.tries || 0) + 1;
  store.set('daily', d);
  return d.streak;
}

// Call when a daily run ends. Returns whether it beat today's best.
export function dailyFinished(wave, score) {
  const d = store.get('daily', null) || {};
  const better = wave > (d.best || 0) || (wave === d.best && score > (d.bestScore || 0));
  if (better) {
    d.best = wave;
    d.bestScore = score;
  }
  store.set('daily', d);
  return better;
}
