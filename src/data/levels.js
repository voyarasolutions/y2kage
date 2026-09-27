// Level and wave design for all 50 levels. Pure data, no Phaser.
// Level n takes place at 11:(09+n) PM on Dec 31 1999; beating level 50 rolls the clock to 00:00.


export const TOTAL_LEVELS = 50;

// Base stats before per-level scaling. `unlock` is the first level a type can appear.
export const ENEMIES = {
  shambler: { name: 'Party Shambler', hp: 30, speed: 52, damage: 10, score: 10, radius: 14, unlock: 1 },
  runner: { name: 'Raver', hp: 18, speed: 118, damage: 8, score: 15, radius: 12, unlock: 3 },
  brute: { name: 'Bouncer', hp: 150, speed: 36, damage: 24, score: 40, radius: 21, unlock: 6 },
  bloater: { name: 'Bloater', hp: 55, speed: 34, damage: 14, score: 25, radius: 18, unlock: 7 },
  crawler: { name: 'Crawler', hp: 22, speed: 70, damage: 9, score: 15, radius: 12, unlock: 14 },
  glitch: { name: 'Corrupted', hp: 42, speed: 66, damage: 12, score: 30, radius: 14, unlock: 10 },
  boss: { name: 'The Millennium Bug', hp: 1400, speed: 42, damage: 34, score: 500, radius: 38, unlock: 10 },
};

// One boss per district. They share the 'boss' enemy slot; `moves` says what each one can do.
// charge: telegraphed bull rush. ring: shockwaves along the floor (jump or dash over them).
// burrow: dives under the street and erupts beneath you. bolts: fans of data packets.
// summon: calls in minions. blink: teleports through static. `scale` sizes the sprite and hitbox.
export const BOSSES = [
  { id: 'bug', scale: 1, name: 'The Millennium Bug', short: 'MILLENNIUM BUG', file: 'MILLENNIUM.BUG', hpMul: 1, speed: 1,
    tag: 'It thinks it is 1900. Delete it.', moves: ['charge'], summon: null },
  { id: 'frontman', scale: 1.7, name: 'The Frontman', short: 'THE FRONTMAN', file: 'BOYBAND.MP3', hpMul: 1.1, speed: 1.1,
    tag: 'Encore! Jump his sonic booms.', moves: ['ring', 'summon'], summon: 'runner' },
  { id: 'conductor', scale: 1.3, name: 'The Conductor', short: 'THE CONDUCTOR', file: 'LASTTRAIN.EXE', hpMul: 1.2, speed: 1,
    tag: 'Stand clear of the closing doors.', moves: ['burrow', 'summon'], summon: 'crawler' },
  { id: 'mainframe', scale: 1.65, name: 'The Mainframe', short: 'THE MAINFRAME', file: 'BIGIRON.SYS', hpMul: 1.3, speed: 0.8,
    tag: 'Dodge the packets. Pull the plug.', moves: ['bolts', 'blink', 'summon'], summon: 'glitch' },
  { id: 'countdown', scale: 1.4, name: 'The Countdown', short: 'THE COUNTDOWN', file: 'MIDNIGHT.DAT', hpMul: 1.45, speed: 1,
    tag: 'The ball itself. Everything at once.', moves: ['charge', 'ring', 'bolts', 'summon'], summon: 'runner' },
];

export const bossFor = (n) => BOSSES[Math.min(BOSSES.length - 1, Math.floor((Math.max(1, n) - 1) / 10))];

// Every 10 levels the fight moves somewhere new. `tint` recolors the arena floor.
export const DISTRICTS = [
  { name: 'Times Square', floor: 0x2b2740, line: 0xf6c945, walk: 0x3a3552 },
  { name: 'Broadway', floor: 0x2e2336, line: 0xff5fa2, walk: 0x40304a },
  { name: 'Subway Platform', floor: 0x23302f, line: 0xe8e2c8, walk: 0x324341 },
  { name: 'Bank Server Room', floor: 0x1c2a3a, line: 0x3de0e0, walk: 0x28394d },
  { name: 'The Ball Drop', floor: 0x331f2a, line: 0xff3b3b, walk: 0x472a36 },
];

const RADIO = [
  'WKRP-FM: "Folks, the ball drops in under an hour. Stay inside."',
  'Reminder from your bank: withdraw cash now, just in case.',
  'News 4: Reports of VCRs flashing 12:00 across the city.',
  'The mayor says the power grid is "totally Y2K compliant."',
  'Did you back up your files to floppy? Do it now.',
  'Pagers are down in Midtown. Nobody knows why.',
  'Survivalists outside Macy\'s selling canned beans at $40 a tin.',
  'Airlines ground all flights crossing midnight. Just in case.',
  'Your computer thinks it is 1900. So do the dead, apparently.',
  'Prince is on every station. Party like it\'s 1999.',
  'COBOL programmers wanted. Name your price.',
  'Dial-up is down. You\'ve got... no mail.',
];

// Small seeded RNG so a level always plays the same waves.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightsFor(n) {
  const w = { shambler: 10 };
  if (n >= ENEMIES.runner.unlock) w.runner = Math.min(9, 2 + (n - 3) * 0.6);
  if (n >= ENEMIES.brute.unlock) w.brute = Math.min(4.5, 1 + (n - 6) * 0.12);
  if (n >= ENEMIES.glitch.unlock) w.glitch = Math.min(6, 1 + (n - 10) * 0.18);
  if (n >= ENEMIES.bloater.unlock) w.bloater = Math.min(4, 0.6 + (n - 7) * 0.1);
  if (n >= ENEMIES.crawler.unlock) w.crawler = Math.min(5, 1 + (n - 14) * 0.2);
  return w;
}

function pick(weights, rnd) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = rnd() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'shambler';
}

export function clockFor(n) {
  const minutes = 9 + n; // level 1 -> 11:10, level 50 -> 11:59
  return { h: 11, m: minutes, label: `11:${String(minutes).padStart(2, '0')} PM`, minutesLeft: 60 - minutes };
}

// How tough the horde is at difficulty n (the level number, or a running figure in Endless).
export function scaleFor(n) {
  return {
    hpMul: 1 + (n - 1) * 0.055,
    speedMul: Math.min(1.6, 1 + (n - 1) * 0.012),
    damageMul: 1 + (n - 1) * 0.025,
    spawnEvery: Math.max(160, 800 - n * 13),
    maxAlive: Math.round(Math.min(70, 16 + n * 0.8)),
    // Chance per second of a Y2K screen glitch; rises toward midnight.
    glitchRate: Math.min(0.5, 0.02 + n * 0.009),
  };
}

function makeWave(n, w, rnd, bosses) {
  const weights = weightsFor(n);
  // Hordes: half again as many as the first release, and they arrive faster.
  const count = Math.round((5 + n * 0.75 + w * 3) * 1.5);
  const spawns = [];
  for (let i = 0; i < count; i++) spawns.push(pick(weights, rnd));
  // Brutes arrive late in a wave, not in the opening second.
  spawns.sort((a, b) => (a === 'brute') - (b === 'brute'));
  for (let b = 0; b < bosses; b++) spawns.splice(Math.floor(count / 3) + b, 0, 'boss');
  return spawns;
}

export function levelConfig(n) {
  const rnd = mulberry32(n * 9973 + 1999);
  const dIdx = Math.min(DISTRICTS.length - 1, Math.floor((n - 1) / 10));
  const isBoss = n % 10 === 0;
  // Levels stay short (two to three minutes) so there is always time for one more; later waves hit harder instead.
  const waveCount = 3 + Math.floor((n - 1) / 20);
  const waves = [];
  for (let w = 0; w < waveCount; w++) waves.push(makeWave(n, w, rnd, isBoss && w === waveCount - 1 ? 1 + Math.floor(n / 30) : 0));
  return {
    level: n,
    district: DISTRICTS[dIdx],
    dIdx,
    bossIdx: dIdx,
    clock: clockFor(n),
    isBoss,
    waves,
    ...scaleFor(n),
    radio: RADIO[(n - 1) % RADIO.length],
  };
}

// Endless: pick a district, then waves keep coming and keep getting harder. Every fifth wave
// brings that district's boss. The sim asks for each wave as it needs it.
export function endlessConfig(dIdx, start = null) {
  const n0 = start ?? dIdx * 10 + 3;
  const cfg = {
    level: dIdx * 10 + 1,
    district: DISTRICTS[dIdx],
    dIdx,
    bossIdx: dIdx,
    clock: clockFor(dIdx * 10 + 1),
    isBoss: false,
    endless: true,
    waves: [],
    ...scaleFor(n0),
    radio: 'Endless mode. There is no midnight. There is only the horde.',
  };
  cfg.diff = (w) => n0 + w * 1.6;
  cfg.makeWave = (w) => {
    const n = Math.round(cfg.diff(w));
    const rnd = mulberry32(w * 7919 + dIdx * 31 + 2000);
    return makeWave(Math.min(50, n), Math.min(6, w % 5), rnd, w % 5 === 4 ? 1 + Math.floor(w / 15) : 0);
  };
  return cfg;
}
