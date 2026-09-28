// Trophies and the extras they unlock. Everything is saved on this device.
import { store } from '../core/util.js';

// `reward` names the extra a trophy unlocks, if any (see EXTRAS).
export const ACHIEVEMENTS = [
  { id: 'boss1', name: 'Bug Squashed', desc: 'Beat the Millennium Bug (level 10)', reward: 'endless' },
  { id: 'boss2', name: 'Encore Cancelled', desc: 'Beat the Frontman (level 20)', reward: 'lowgrav' },
  { id: 'boss3', name: 'End of the Line', desc: 'Beat the Conductor (level 30)', reward: 'confetti' },
  { id: 'boss4', name: 'Pulled the Plug', desc: 'Beat the Mainframe (level 40)', reward: 'turbo' },
  { id: 'boss5', name: 'Happy New Year', desc: 'Beat the Countdown and reach 2000', reward: 'onehit' },
  { id: 'flawless', name: 'Y2K Compliant', desc: 'Clear level 5+ without getting hurt' },
  { id: 'heads', name: 'Head Hunter', desc: '25 headshot kills in one level', reward: 'bighead' },
  { id: 'combo', name: 'Off the Hook', desc: 'Reach a 40 kill combo' },
  { id: 'fast', name: 'Broadband Speed', desc: 'Clear level 5+ in under 75 seconds' },
  { id: 'kills1k', name: 'Zombie Deleter', desc: 'Delete 1,000 zombies in total' },
  { id: 'kills10k', name: 'Format C:', desc: 'Delete 10,000 zombies in total' },
  { id: 'rank10', name: 'Power User', desc: 'Get any hero to level 10' },
  { id: 'roster', name: 'Full Roster', desc: 'Clear a level with all five heroes' },
  { id: 'specials', name: 'Special Delivery', desc: 'Use 25 specials' },
  { id: 'loaded', name: 'Fully Loaded', desc: 'Hold 10 upgrades in one run' },
  { id: 'lan', name: 'LAN Party', desc: 'Clear a level in online co-op' },
  { id: 'wave20', name: 'Still Standing', desc: 'Reach wave 20 in Endless mode' },
  { id: 'jackpot', name: 'Jackpot!', desc: 'Catch a golden Jackpot zombie' },
  { id: 'overdrive', name: 'Overdrive', desc: 'Hit a 20 kill combo and go into Overdrive' },
];

// Unlockable extras. Endless is a mode; the rest are cheats you toggle in the Trophy Case.
export const EXTRAS = [
  { id: 'endless', name: 'Endless Mode', desc: 'Waves forever. Bosses every 5 waves.', mode: true },
  { id: 'bighead', name: 'Big Heads', desc: 'Bigger heads, easier headshots.' },
  { id: 'lowgrav', name: 'Low Gravity', desc: 'Every jump goes to the moon.' },
  { id: 'confetti', name: 'Confetti Goo', desc: 'Zombies burst into party colours.' },
  { id: 'turbo', name: 'Turbo Mode', desc: 'The whole game runs 25% faster.' },
  { id: 'onehit', name: 'One Hit Wonder', desc: 'Everything dies in one hit. You too.' },
];

export const achById = (id) => ACHIEVEMENTS.find((a) => a.id === id);

export function unlocked() {
  return store.get('ach', {}) || {};
}

export function hasAch(id) {
  return !!unlocked()[id];
}

// Returns true the first time a trophy is earned.
export function grant(id) {
  const all = unlocked();
  if (all[id] || !achById(id)) return false;
  all[id] = Date.now();
  store.set('ach', all);
  return true;
}

export function extraUnlocked(id) {
  const a = ACHIEVEMENTS.find((x) => x.reward === id);
  return !!(a && hasAch(a.id));
}

// Cheats that are switched on (and unlocked).
export function cheats() {
  const on = store.get('cheats', {}) || {};
  const out = {};
  for (const e of EXTRAS) if (!e.mode && on[e.id] && extraUnlocked(e.id)) out[e.id] = true;
  return out;
}

export function toggleCheat(id) {
  const on = store.get('cheats', {}) || {};
  on[id] = !on[id];
  store.set('cheats', on);
}

// Running totals that trophies count toward.
export function stat(k) {
  return (store.get('stats', {}) || {})[k] || 0;
}

export function addStat(k, n = 1) {
  const s = store.get('stats', {}) || {};
  s[k] = (s[k] || 0) + n;
  store.set('stats', s);
  return s[k];
}

export function heroesCleared() {
  return store.get('cleared', []) || [];
}

export function markHeroCleared(id) {
  const l = heroesCleared();
  if (!l.includes(id)) {
    l.push(id);
    store.set('cleared', l);
  }
  return l.length;
}
