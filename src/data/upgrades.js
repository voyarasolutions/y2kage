// Between-level upgrades. After every cleared level each player picks one of three; they stack and
// last for the rest of the run (until you quit to the menu). Stored per run as a list of ids.

export const UPGRADES = [
  { id: 'dmg', name: 'Overclocked CPU', desc: '+15% damage', color: '#ff3b3b', icon: 'chip' },
  { id: 'rate', name: 'Turbo Button', desc: '+15% fire rate', color: '#ff8a2a', icon: 'turbo' },
  { id: 'speed', name: 'Fresh Wheels', desc: '+10% ride speed', color: '#3de0e0', icon: 'wheel' },
  { id: 'hp', name: 'Extra RAM', desc: '+25 max health', color: '#ff2e88', icon: 'ram' },
  { id: 'armor', name: 'Surge Protector', desc: 'Start levels with +40 armor', color: '#f6c945', icon: 'surge' },
  { id: 'regen', name: 'Defragmenter', desc: 'Heal 1 health per second', color: '#7ac943', icon: 'defrag' },
  { id: 'magnet', name: 'Broadband', desc: 'Grab pickups from further away', color: '#a67bd8', icon: 'modem' },
  { id: 'luck', name: 'Lucky Floppy', desc: '+50% powerup drops', color: '#7ac943', icon: 'floppy' },
  { id: 'sp', name: 'Hyper-Threading', desc: 'Special charges 30% faster', color: '#4ab8ff', icon: 'bolt' },
  { id: 'head', name: 'HEADSHOT.EXE', desc: '+30% headshot damage', color: '#fff4d6', icon: 'skull' },
  { id: 'combo', name: 'Call Waiting', desc: 'Combos last 1 second longer', color: '#ff8fc4', icon: 'phone' },
  { id: 'leech', name: 'Volt Cola Tap', desc: 'Heal 2 health per kill', color: '#e8344e', icon: 'cola' },
  { id: 'buff', name: 'Long Distance', desc: 'Powerups last 40% longer', color: '#f6c945', icon: 'clock' },
  // Rare: these change how a fight plays out, not just the numbers.
  { id: 'chain', rarity: 'rare', max: 3, name: 'Dial-Up Chain', desc: 'Hits arc to a nearby zombie', color: '#4ab8ff', icon: 'zap' },
  { id: 'crit', rarity: 'rare', max: 3, name: 'Lucky Pager', desc: '10% chance of a 3x crit', color: '#ff5fa2', icon: 'pager' },
  { id: 'firewall', rarity: 'rare', max: 3, name: 'Firewall', desc: 'Zombies that bite you get fried', color: '#ff8a2a', icon: 'wall' },
  // Legendary: one of these can carry a run.
  { id: 'boom', rarity: 'legendary', max: 2, name: 'Millennium Bomb', desc: 'Kills can blow up the crowd', color: '#f6c945', icon: 'bomb' },
  { id: 'backup', rarity: 'legendary', max: 1, name: 'Backup Disk', desc: 'Survive one killing blow a level', color: '#7ac943', icon: 'disk' },
  { id: 'virus', rarity: 'legendary', max: 2, name: 'ILOVEYOU.VBS', desc: 'Kills infect zombies nearby', color: '#e8344e', icon: 'heart' },
];

export const RARITY = {
  common: { label: '', color: null },
  rare: { label: 'RARE', color: '#4ab8ff' },
  legendary: { label: 'LEGENDARY', color: '#f6c945' },
};
export const rarityOf = (u) => u.rarity || 'common';
const maxOf = (u) => u.max || 5;

export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

// How many of each upgrade a list holds.
export function stacks(list) {
  const out = {};
  for (const id of list || []) if (upgradeById(id)) out[id] = (out[id] || 0) + 1;
  return out;
}

// Three different upgrades to offer. Each card rolls its rarity first (rarer ones get likelier
// deeper into the night), then a random upgrade of that rarity. Maxed-out upgrades are left out.
export function offer(list, n = 3, level = 1) {
  const st = stacks(list);
  const pool = UPGRADES.filter((u) => (st[u.id] || 0) < maxOf(u));
  const out = [];
  const pLeg = Math.min(0.16, 0.05 + level * 0.0025);
  const pRare = Math.min(0.35, 0.18 + level * 0.004);
  while (out.length < n && pool.length) {
    const r = Math.random();
    const want = r < pLeg ? 'legendary' : r < pLeg + pRare ? 'rare' : 'common';
    let from = pool.filter((u) => rarityOf(u) === want);
    if (!from.length) from = pool;
    const u = from[Math.floor(Math.random() * from.length)];
    pool.splice(pool.indexOf(u), 1);
    out.push(u.id);
  }
  return out;
}

// Numbers the sim uses, from a player's stacks.
export function upgradeMods(list) {
  const s = stacks(list);
  const k = (id) => s[id] || 0;
  return {
    dmg: Math.pow(1.15, k('dmg')),
    rate: Math.pow(1.15, k('rate')),
    speed: Math.pow(1.1, k('speed')),
    maxHp: 100 + 25 * k('hp'),
    armor: Math.min(100, 40 * k('armor')),
    regen: k('regen'),
    reach: 0.55 + 1.1 * k('magnet'),
    luck: 1 + 0.5 * k('luck'),
    sp: 1 + 0.3 * k('sp'),
    head: 1 + 0.3 * k('head'),
    combo: k('combo'),
    leech: 2 * k('leech'),
    buff: 1 + 0.4 * k('buff'),
    chain: 0.25 * k('chain'),
    crit: 0.1 * k('crit'),
    firewall: 35 * k('firewall'),
    boom: 0.12 * k('boom'),
    backup: k('backup'),
    virus: k('virus'),
  };
}
