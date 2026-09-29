// Melee: slot 2 of every hero's two weapon slots (slot 1 is the gun). Empty-handed it's your fists;
// melee pickups replace them with something that hits properly until it breaks. dmg is per hit
// (before rank bonus), arc the swing's width in radians, max how many zombies one swing can connect
// with, uses how many connecting swings before it breaks. Each swing is timed in three beats: wind
// seconds pulling back, the strike (it connects at hit seconds in), then the follow-through until
// swing; every is the fastest you can swing again while holding fire.
export const MELEE = {
  shove: { name: 'FISTS', short: 'FISTS', dmg: 10, reach: 1.3, arc: 1.3, every: 0.36, knock: 3.2, max: 2, wind: 0.06, hit: 0.1, swing: 0.3 },
  bat: { name: 'LOUISVILLE SLUGGER', short: 'BAT', dmg: 60, reach: 1.75, arc: 1.9, every: 0.5, knock: 3.6, max: 4, wind: 0.15, hit: 0.2, swing: 0.46, uses: 30, tip: 'Hold fire to swing it' },
  keyboard: { name: 'CLICKY KEYBOARD', short: 'KEYBOARD', dmg: 32, reach: 1.6, arc: 1.6, every: 0.28, knock: 1.6, max: 3, wind: 0.08, hit: 0.11, swing: 0.27, uses: 50, tip: 'Fast swings, keys everywhere' },
  bottle: { name: 'CHAMPAGNE BOTTLE', short: 'BUBBLY', dmg: 95, reach: 1.55, arc: 1.5, every: 0.6, knock: 2.6, max: 3, wind: 0.18, hit: 0.23, swing: 0.52, uses: 12, burst: 120, tip: 'Bursts on the last swing' },
};
export const MELEE_KINDS = ['bat', 'keyboard', 'bottle'];
// Swapping between the slots: the weapon in hand drops out of view, the other comes up (seconds).
export const SWAP_T = 0.3;
