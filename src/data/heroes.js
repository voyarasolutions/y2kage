// The playable roster. Each hero has their own ride (movement) and their own weapon.


export const HEROES = [
  {
    id: 'tina',
    name: 'TINA',
    nick: 'Turbo',
    ride: 'Rollerblades',
    weapon: 'Soaker 2500',
    blurb: 'Glides on momentum, hard to catch and hard to stop. Hold fire to hose zombies back. Water fries Corrupted zombies.',
    controls: 'SPACE hop',
    stats: { speed: 5, power: 2, range: 3 },
    move: { type: 'skate', accel: 13, max: 5.6, friction: 1.3, strafe: 0.85, jump: 4.2 },
    gun: { kind: 'soaker', every: 0.045, dmg: 8, speed: 13, spread: 0.05, life: 0.6, knock: 0.3, tank: 100, drain: 1.6, refill: 50 },
    // Upgrade Shop tier 2 for each weapon: these override the gun.
    gun2: { name: 'Soaker 3500', desc: 'High pressure: harder, further, bigger tank', dmg: 12, speed: 17, spread: 0.035, life: 0.7, knock: 0.45, tank: 150, drain: 1.5, refill: 70 },
    special: { name: 'TIDAL WAVE', desc: 'A firehose blast that shoves the whole street back.', color: '#4ab8ff' },
  },
  {
    id: 'marcus',
    name: 'MARCUS',
    nick: 'Ollie',
    ride: 'Skateboard',
    weapon: 'Dual Yo-Yos',
    blurb: 'Coasts forever but strafes badly. Yo-yos hit on the way out and again on the way back.',
    controls: 'SPACE ollie · SHIFT kick-push',
    stats: { speed: 4, power: 3, range: 3 },
    move: { type: 'board', accel: 9, max: 5.2, friction: 0.55, strafe: 0.35, jump: 5.6, boost: 3.4, boostCd: 1.4 },
    gun: { kind: 'yoyo', every: 0.2, dmg: 18, speed: 15, range: 6.5, knock: 0.8 },
    gun2: { name: 'X-Brain Yo-yos', desc: 'See-through, faster, longer reach', every: 0.16, dmg: 26, speed: 18, range: 8.5, knock: 1 },
    special: { name: 'AROUND THE WORLD', desc: 'Both yo-yos orbit you for 6 seconds, shredding anything close.', color: '#ff5fa2' },
  },
  {
    id: 'dot',
    name: 'DOT',
    nick: 'Disk',
    ride: 'Slinky Springs',
    weapon: 'Floppy Disks',
    blurb: 'Hold SPACE to coil the slinky, release to spring across the street. Floppies ricochet off walls twice.',
    controls: 'hold SPACE, release to leap',
    stats: { speed: 3, power: 3, range: 5 },
    move: { type: 'slinky', accel: 36, max: 3.8, friction: 11, strafe: 1, jump: 3.6, leap: 11 },
    gun: { kind: 'floppy', every: 0.24, dmg: 22, speed: 15, bounces: 2, life: 1.6, knock: 0.6 },
    gun2: { name: 'CD-ROMs', desc: 'Hit harder and ricochet four times', dmg: 32, speed: 18, bounces: 4, life: 2, knock: 0.8 },
    special: { name: 'DEFRAG', desc: 'Two rings of 24 floppies burst out and ricochet everywhere.', color: '#3de0e0' },
  },
  {
    id: 'gus',
    name: 'GUS',
    nick: 'Pogo',
    ride: 'Pogo Stick',
    weapon: 'Bottle Rockets',
    blurb: 'Never stops bouncing. SPACE for a mega-bounce that shockwaves the street when you land. Rockets burst like fireworks.',
    controls: 'SPACE mega-bounce',
    stats: { speed: 3, power: 5, range: 4 },
    move: { type: 'pogo', accel: 28, max: 3.9, friction: 8, strafe: 1, jump: 6.4, stomp: 50, stompR: 2.3 },
    gun: { kind: 'rocket', every: 0.75, dmg: 55, direct: 20, radius: 1.9, speed: 10, life: 2, knock: 2.5 },
    gun2: { name: 'Dual Roman Candles', desc: 'Two candles firing coloured fireballs', every: 0.32, dmg: 30, direct: 14, radius: 1.4, speed: 15, knock: 1.6, dual: true },
    special: { name: 'GRAND FINALE', desc: 'Sixteen fireworks rain down on the horde around you.', color: '#ff8a2a' },
  },
  {
    id: 'kev',
    name: 'KEV',
    nick: 'Laser',
    ride: 'Kick Scooter',
    weapon: 'Laser Pointer',
    blurb: 'Three kick-dash charges to zip past a horde. The laser never misses but it overheats. Watch the meter.',
    controls: 'SHIFT kick-dash (3 charges)',
    stats: { speed: 4, power: 4, range: 5 },
    move: { type: 'scooter', accel: 20, max: 4.6, friction: 3.2, strafe: 0.7, jump: 0, dash: 9, charges: 3, recharge: 1.6 },
    gun: { kind: 'laser', dps: 78, range: 18, heat: 32, cool: 45 },
    gun2: { name: 'Laser Tag Gun', desc: 'Stronger beam, longer reach, runs cooler', dps: 105, range: 22, heat: 26, cool: 55 },
    special: { name: 'LIGHT SHOW', desc: 'Six beams spin around you and cut through everything.', color: '#ff3b3b' },
  },
];

export const heroById = (id) => HEROES.find((h) => h.id === id) || HEROES[0];

// Gus's Roman candle balls cycle through these colours.
export const CANDLE_COLS = ['#ff3b3b', '#3de0e0', '#9ef07a', '#ff2e88', '#f6c945'];

// A hero with their weapon at the given tier (0 base, 1 the Upgrade Shop version).
const TIERED = {};
export function heroAtTier(hero, tier) {
  if (!tier || !hero.gun2) return hero;
  return (TIERED[hero.id] ||= { ...hero, weapon: hero.gun2.name, gun: { ...hero.gun, ...hero.gun2, tier: 1 } });
}
