// Tokens and the Upgrade Shop: a currency earned every run (levels, bosses, the Jackpot,
// Endless waves) that buys permanent perks. Perks only apply to your own hero.
import { store } from '../core/util.js';

export const PERKS = [
  { id: 'ram', name: 'RAM Upgrade', desc: '+10 max health per tier', costs: [40, 80, 160], color: '#7ac943' },
  { id: 'modem', name: 'Better Modem', desc: '+1 reroll per level each tier', costs: [60, 150], color: '#4ab8ff' },
  { id: 'luck', name: 'Lucky Charm', desc: 'Rare cards +3% per tier', costs: [50, 100, 200], color: '#ff5fa2' },
  { id: 'surge', name: 'Power Surge', desc: 'Special meter starts +25% per tier', costs: [50, 120], color: '#f6c945' },
  { id: 'head', name: 'Head Start', desc: 'A free upgrade per tier each run', costs: [100, 250], color: '#ff8a2a' },
];

export const tokens = () => store.get('tokens', 0) || 0;
export const perks = () => store.get('perks', {}) || {};
export const perkTier = (id) => perks()[id] || 0;

export function addTokens(n) {
  n = Math.max(0, Math.round(n));
  if (n) {
    store.set('tokens', tokens() + n);
    store.set('tokensEver', (store.get('tokensEver', 0) || 0) + n);
  }
  return n;
}

export const nextCost = (p) => p.costs[perkTier(p.id)];

export function buyPerk(id) {
  const p = PERKS.find((q) => q.id === id);
  const cost = p && nextCost(p);
  if (!cost || tokens() < cost) return false;
  store.set('tokens', tokens() - cost);
  store.set('perks', { ...perks(), [id]: perkTier(id) + 1 });
  return true;
}

// What the perks add up to, for the Sim and the upgrade offers.
export function perkMods() {
  const t = perks();
  return { hp: 10 * (t.ram || 0), rerolls: t.modem || 0, luck: 0.03 * (t.luck || 0), sp: 25 * (t.surge || 0), head: t.head || 0 };
}

// Tokens for clearing level n (bosses every 10th level pay extra).
export const clearTokens = (n) => 5 + Math.floor(n / 5) + (n % 10 === 0 ? 20 : 0);
