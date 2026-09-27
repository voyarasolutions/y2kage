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
];

export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

// How many of each upgrade a list holds.
export function stacks(list) {
  const out = {};
  for (const id of list || []) if (upgradeById(id)) out[id] = (out[id] || 0) + 1;
  return out;
}

// Three different upgrades to offer. Anything already stacked five times is left out.
export function offer(list, n = 3) {
  const st = stacks(list);
  const pool = UPGRADES.filter((u) => (st[u.id] || 0) < 5);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
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
  };
}
