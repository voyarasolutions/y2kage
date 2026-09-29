// Melee: everyone can shove, and melee pickups swap the shove for something that hits properly until
// it breaks. dmg is per hit (before rank bonus), arc the swing's width in radians, max how many
// zombies one swing can connect with, uses how many connecting swings before it breaks.
export const MELEE = {
  shove: { name: 'SHOVE', dmg: 10, reach: 1.25, arc: 1.4, every: 0.55, knock: 3.2, max: 3, swing: 0.2 },
  bat: { name: 'LOUISVILLE SLUGGER', short: 'BAT', dmg: 60, reach: 1.75, arc: 1.9, every: 0.5, knock: 3.6, max: 4, swing: 0.3, uses: 30, tip: 'V / middle mouse / LB to swing' },
  keyboard: { name: 'CLICKY KEYBOARD', short: 'KEYBOARD', dmg: 32, reach: 1.6, arc: 1.6, every: 0.26, knock: 1.6, max: 3, swing: 0.2, uses: 50, tip: 'Fast swings, keys everywhere' },
  bottle: { name: 'CHAMPAGNE BOTTLE', short: 'BUBBLY', dmg: 95, reach: 1.55, arc: 1.5, every: 0.62, knock: 2.6, max: 3, swing: 0.32, uses: 12, burst: 120, tip: 'Bursts on the last swing' },
};
export const MELEE_KINDS = ['bat', 'keyboard', 'bottle'];
