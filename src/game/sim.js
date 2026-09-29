// One level of Y2Kage: the party on their rides, their weapons, the horde and the waves.
// Pure game state, no drawing. Map units: one cell = 1, x/y on the ground plane, z is height.
//
// Modes: 'solo' runs everything locally. 'host' runs everything too, and also records sounds and
// effects in `out` so the network layer can replay them for guests. 'client' only moves the local
// player; everything else arrives in snapshots from the host (see applySnapshot).
import { ENEMIES, BOSSES, scaleFor } from '../data/levels.js';
import { upgradeMods } from '../data/upgrades.js';
import { muzzleWorld } from '../data/muzzles.js';
import { rankFor, dmgMulFor, xpForRank } from '../data/progress.js';
import { PARTY } from '../core/palette.js';
import { rand, clamp, TAU, pickOne } from '../core/util.js';
import { sfx } from '../audio/sfx.js';
import { HEROES, heroAtTier, CANDLE_COLS } from '../data/heroes.js';
import { MELEE, MELEE_KINDS, SWAP_T } from '../data/melee.js';

export const EYE = 0.62;
const GRAV = 16;
export const ZRAD = { shambler: 0.3, runner: 0.26, brute: 0.45, glitch: 0.3, boss: 0.85, crawler: 0.28, bloater: 0.42 };
// How wide a zombie is to shots and blasts: bosses are drawn bigger, so they are hit bigger too.
export const hitR = (z) => ZRAD[z.kind] * (z.kind === 'boss' || z.elite ? z.sc || 1 : 1);
export const ZHEIGHT = { shambler: 1.0, runner: 1.0, brute: 1.45, glitch: 1.0, boss: 1.95, crawler: 0.45, bloater: 1.3 };
const COMBO_WINDOW = 2.2;
// Keep a combo going this long and the whole party goes into Overdrive: faster fire until it breaks.
export const OVERDRIVE_AT = 20;
const OVERDRIVE_RATE = 1.35;
const GOO = '#9be04a';
const COMBO_CALLS = [
  { n: 5, text: 'BOOYAH!' },
  { n: 10, text: 'ALL THAT!' },
  { n: 15, text: 'DA BOMB!' },
  { n: 25, text: 'OFF THE HOOK!' },
  { n: 40, text: 'PHAT!!' },
  { n: 60, text: 'MILLENNIUM!!' },
];
export function comboMult(n) {
  return n >= 40 ? 3 : n >= 25 ? 2.5 : n >= 15 ? 2 : n >= 5 ? 1.5 : 1;
}
const NEW_TIPS = {
  runner: 'Fast, and glowing.',
  brute: 'Soaks damage. Not on the list.',
  bloater: 'Pops on death. Keep back!',
  glitch: 'Teleports. Weak to water.',
  crawler: 'Low and quick. Watch your feet.',
};
const ZMASS = { shambler: 1, runner: 0.8, brute: 2.5, glitch: 1, boss: 8, crawler: 0.7, bloater: 1.6 };
export const ZKINDS = ['shambler', 'runner', 'brute', 'glitch', 'boss', 'crawler', 'bloater'];
// Special zombies (index 0 is none).
export const AFFIXES = [null, 'spit', 'fast', 'tough'];
const AFFIX_TIPS = {
  spit: ['NEW: SPITTER', 'Green ones lob glitch packets. Close the gap or dodge.'],
  fast: ['NEW: SPRINTER', 'Yellow ones run twice as fast. Take them first.'],
  tough: ['NEW: TANK', 'Purple ones are big and take a beating. Worth extra.'],
};
export const PROJ_KINDS = ['water', 'yoyo', 'floppy', 'rocket'];
// Boss moves and how long until each one comes round again (seconds).
const BOSS_CD = { charge: [4, 6], ring: [3.2, 4.4], burrow: [5, 7], bolts: [2.6, 3.6], summon: [9, 12], blink: [5, 7] };
// New kinds go on the end so guests on an older index still line up.
export const PICK_KINDS = ['health', 'armor', 'overclock', 'patch', 'multi', 'freeze', 'cad', 'zip', 'bat', 'keyboard', 'bottle'];
// Seconds of bottomless ammo from a Zip Disk.
const ZIP_T = 6;
const ZSTATES = ['walk', 'attack', 'windup'];

// The special meter fills slowly on its own and much faster with kills.
export const SP_MAX = 100;
export const DIFFS = { easy: { hurt: 0.6, count: 0.8, tokens: 0.75 }, normal: { hurt: 1, count: 1, tokens: 1 }, hard: { hurt: 1.4, count: 1.25, tokens: 1.5 } };
const SP_PER_SEC = 1.4;
const SP_PER_SCORE = 0.45;
// Co-op: every extra player adds this share of a wave again, and more of the horde on screen.
// Every extra player on the team (a friend or a CPU teammate) brings more of the horde.
const COOP_WAVE = 0.75;
const COOP_ALIVE = 0.45;
const COOP_BOSS_HP = 0.5;
// How far each weapon is worth firing from, for CPU teammates.
const BOT_RANGE = { soaker: 7.5, yoyo: 6.2, floppy: 11, rocket: 13, laser: 15 };
const REVIVE_HP = 60;
// Hit zones: the top of a zombie takes double, the legs a bit over half.
export const HEAD_MUL = 2;
export const LEG_MUL = 0.6;
const HEAD_FRAC = 0.72;
const LEG_FRAC = 0.36;
// Shots converge on the crosshair this far out, so what you aim at is what you hit.
const CONVERGE = 5;
export const MAX_PITCH = 0.55;
// Seconds of countdown between waves (the level keeps running), and the victory lap after the last one.
export const BREAK_T = 4;
// How long the Jackpot zombie hangs around before it escapes.
const JACKPOT_T = 13;
// When the queue is empty and this few are left, they hurry to the party.
const STRAGGLERS = 3;
// Share of the horde that rises from the street around the party instead of a map spawn.
const SPAWN_NEAR = 0.45;
const OUTRO_T = 2.8;

const r2 = (v) => Math.round(v * 100) / 100;

export class Sim {
  // party: [{ hero, xp, name }]. opts.local is the index this machine plays; opts.mode as above.
  constructor(map, cfg, party, levelN, opts = {}) {
    this.map = map;
    this.cfg = cfg;
    this.levelN = levelN;
    this.mode = opts.mode || 'solo';
    this.out = null;
    // Cheats from the Trophy Case, and Endless mode (waves generated as they come).
    this.cheats = opts.cheats || {};
    // Tonight's level event (see EVENTS in levels.js); some of them are just cheats.
    this.event = cfg.event?.id || null;
    if (cfg.event?.cheats) this.cheats = { ...this.cheats, ...cfg.event.cheats };
    this.jackpotsLeft = this.event === 'gold' ? 3 : 1;
    this.endless = !!cfg.endless;
    this.grav = this.cheats.lowgrav ? 0.4 : 1;
    this.bossIdx = cfg.bossIdx ?? Math.min(BOSSES.length - 1, Math.floor((levelN - 1) / 10));
    this.bossDef = BOSSES[this.bossIdx];
    this.rings = [];
    this.bolts = [];
    this.hurtTaken = 0;
    // How carefully CPU teammates keep their distance and aim (headless playtests turn it down to act like a person).
    this.botSkill = opts.botSkill ?? 1;
    // Difficulty (Control Panel): how hard zombies bite and how many come.
    this.diff = DIFFS[opts.diff] || DIFFS.normal;
    // Timed powerups are shared by the whole party.
    this.buffs = { patch: 0, multi: 0, freeze: 0 };
    this.t = 0;
    this.events = [];
    this.blocked = new Uint8Array(map.w * map.h);
    for (let k = 0; k < this.blocked.length; k++) this.blocked[k] = map.walls[k];
    this.props = map.props.map((p) => {
      const pcx = Math.floor(p.x);
      const pcy = Math.floor(p.y);
      // Block the prop's cell for pathfinding, plus neighbours a wide prop spills into.
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = pcx + ox;
          const cy = pcy + oy;
          if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) continue;
          if (Math.hypot(cx + 0.5 - p.x, cy + 0.5 - p.y) < p.r + 0.2) this.blocked[cy * map.w + cx] = 1;
        }
      }
      return { x: p.x, y: p.y, r: p.r };
    });
    // Set dressing is solid to bump into but never blocks a pathfinding cell.
    for (const d of map.decor || []) if (d.r) this.props.push({ x: d.x, y: d.y, r: d.r });
    this.flow = new Int16Array(map.w * map.h);
    this.flowQ = new Int32Array(map.w * map.h);
    this.flowKey = '';
    const s = map.start;
    const face = this.faceOpen(s);
    this.players = party.map((e, i) => this.makePlayer(e, i, party.length, s, face));
    this.local = opts.local || 0;
    this.player = this.players[this.local];
    this.zombies = [];
    this.nextZid = 1;
    this.projs = [];
    this.pickups = [];
    this.splats = [];
    this.particles = [];
    this.corpses = [];
    this.heads = [];
    this.lasers = [];
    this.boss = null;
    this.shake = 0;
    this.flash = null;
    this.glitchT = 0;
    this.score = 0;
    this.lv = { phase: 'intro', t: 2.8, wave: -1, queue: [], spawnT: 0, time: 0, kills: 0, bestCombo: 0, total: 0 };
    // Chain kills inside the window to build a combo and a score multiplier.
    this.combo = { n: 0, t: 0 };
    this.comboCall = null;
    this.popups = [];
    this.hitT = 0;
    this.banner = { kind: 'level', t: 3.4, dur: 3.4 };
    // Retrying a boss level you already reached the boss on starts at the boss wave.
    if (opts.fromWave > 0 && cfg.waves[opts.fromWave]) {
      this.lv.wave = opts.fromWave - 1;
      this.checkpoint = true;
    }
  }

  makePlayer(e, i, n, s, face) {
    const hero = heroAtTier(e.hero, e.tier);
    // Spread a party around the start point.
    let x = s.x;
    let y = s.y;
    if (n > 1) {
      const a = face + Math.PI / 2 + (i - (n - 1) / 2) * 0.9;
      const px = s.x + Math.cos(a) * 0.8;
      const py = s.y + Math.sin(a) * 0.8;
      if (!this.wallAt(px, py)) {
        x = px;
        y = py;
      }
    }
    const xp = e.xp || 0;
    const rank = rankFor(xp);
    const ups = (e.ups || []).slice();
    const mods = upgradeMods(ups);
    // Daily twist: Glass Cannon doubles everyone's damage, both ways.
    if (this.cheats.glass) mods.dmg *= 2;
    // Shop perks (your own hero only): extra health and a head start on the special meter.
    const perk = e.perk || {};
    mods.maxHp += perk.hp || 0;
    return {
      idx: i, name: e.name || `P${i + 1}`, hero, heroIdx: Math.max(0, HEROES.findIndex((h) => h.id === hero.id)),
      xp, rank, dmgMul: dmgMulFor(rank) * mods.dmg, lvlUp: null, ups, mods, maxHp: mods.maxHp, bonusHp: perk.hp || 0,
      sp: Math.max(0, Math.min(SP_MAX, Math.max(e.sp || 0, perk.sp || 0))), spKind: null, pitch: 0, spT: 0, spStep: 0, spCall: null, iT: 0,
      down: false, remote: false, bot: !!e.bot, input: { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0 },
      x, y, a: face, z: 0, vz: 0, vx: 0, vy: 0,
      hp: mods.maxHp, armor: mods.armor, hurtT: 0, overclock: 0, charge: 0, charging: false, boostCd: 0,
      charges: hero.move.charges || 0, rechargeT: 0, mega: false, bob: 0, onGround: true, dashT: 0,
      tank: hero.gun.tank || 0, heat: 0, overheated: false, fireCd: 0, hand: 0, fireAnim: 0, pumpT: 0, speed: 0, stride: 0,
      // Box or rack (Dot and Gus), the Zip Disk's bottomless timer, and the melee weapon carried (null: fists).
      ammo: hero.gun.mag || 0, reloadT: 0, zipT: 0, melee: null, meleeCd: 0, swingT: 0, swingN: 0, struck: true, hitHold: 0,
      // Which slot is in hand (0 the gun, 1 melee) and how far through swapping to it.
      slot: 0, swapT: 0,
    };
  }

  // Swap a player's upgrades mid-run (Endless picks), keeping their lost health lost.
  setUps(i, ups) {
    const P = this.players[i];
    if (!P) return;
    const mods = upgradeMods(ups);
    if (this.cheats.glass) mods.dmg *= 2;
    mods.maxHp += P.bonusHp;
    const gain = mods.maxHp - P.maxHp;
    P.ups = ups.slice();
    P.mods = mods;
    P.dmgMul = dmgMulFor(P.rank) * mods.dmg;
    P.maxHp = mods.maxHp;
    P.hp = Math.min(P.maxHp, P.hp + Math.max(0, gain));
    P.armor = Math.max(P.armor, mods.armor);
  }

  // The local player's hero and progress, for the HUD.
  get hero() {
    return this.player.hero;
  }
  get xp() {
    return this.player.xp;
  }
  get rank() {
    return this.player.rank;
  }
  get dmgMul() {
    return this.player.dmgMul;
  }
  get lvlUp() {
    return this.player.lvlUp;
  }
  get laser() {
    return this.lasers.find((l) => l.o === this.local && !l.sp) || null;
  }
  isLocal(P) {
    return P === this.player;
  }
  alive() {
    return this.players.filter((P) => !P.down);
  }

  // Zombie goo, or party colours with the Confetti Goo cheat.
  goo() {
    return this.cheats.confetti ? pickOne(PARTY) : GOO;
  }

  emit(type, data) {
    this.events.push({ type, ...data });
  }

  // A sound everyone should hear.
  snd(name, ...a) {
    sfx[name](...a);
    if (this.out) this.out.push(['s', name, ...a]);
  }

  // A visual effect everyone should see: runs the fx_ method here and on every guest.
  fx(name, ...a) {
    this['fx_' + name](...a);
    if (this.out) this.out.push(['f', name, ...a]);
  }

  // Something that only one player feels (their screen flashes red, they level up...).
  personal(P, kind, ...a) {
    if (this.isLocal(P)) this.feel(kind, ...a);
    else if (this.out) this.out.push(['p', P.idx, kind, ...a]);
  }

  feel(kind, ...a) {
    if (kind === 'hurt') {
      this.localHurt = (this.localHurt || 0) + 1;
      if (a[0] != null) (this.hurtDirs ||= []).push({ x: a[0], y: a[1], t: 1.1 });
      this.shake = Math.min(1, this.shake + 0.4);
      this.flash = { color: '#ff2020', t: 0.18, amt: 0.35 };
      sfx.hurt();
    } else if (kind === 'meleeHit') {
      // A swing connected: the screen jolts and the weapon view flashes at the point of impact.
      this.shake = Math.min(1, this.shake + (a[0] === 'shove' ? 0.1 : 0.25));
      this.player.impactT = 0.12;
    } else if (kind === 'shield') this.flash = { color: '#7ac943', t: 0.06, amt: 0.15 };
    else if (kind === 'flash') this.flash = { color: a[0], t: a[1], amt: a[2] };
    else if (kind === 'special') {
      const P = this.player;
      P.spCall = { text: a[0], t: 1.6 };
      this.flash = { color: a[1], t: 0.3, amt: 0.45 };
      this.shake = Math.min(1, this.shake + 0.5);
    } else if (kind === 'toast') this.fx_toast(a[0], a[1]);
    else if (kind === 'revive') {
      this.fx_toast('REBOOTED', 'Back in the fight');
      this.flash = { color: '#7ac943', t: 0.2, amt: 0.3 };
    }
  }

  // ------------------------------------------------------------ map queries
  wallAt(x, y) {
    const m = this.map;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    return cx < 0 || cy < 0 || cx >= m.w || cy >= m.h || m.walls[cy * m.w + cx] === 1;
  }

  wallDistance(x, y, a, max = 30) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let d = 0; d < max; d += 0.05) if (this.wallAt(x + dx * d, y + dy * d)) return d;
    return max;
  }

  faceOpen(s) {
    let best = 0;
    let bestD = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const d = this.wallDistance(s.x, s.y, a);
      if (d > bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  // Move a circle in small steps, sliding along walls and round props.
  moveCircle(e, dx, dy, r, props = true) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.15));
    const sx = e.x;
    const sy = e.y;
    for (let i = 0; i < steps; i++) {
      e.x += dx / steps;
      e.y += dy / steps;
      if (props) for (const p of this.props) {
        const ddx = e.x - p.x;
        const ddy = e.y - p.y;
        const d = Math.hypot(ddx, ddy);
        const min = p.r + r;
        if (d < min && d > 0.0001) {
          e.x += (ddx / d) * (min - d);
          e.y += (ddy / d) * (min - d);
        }
      }
      this.resolveWalls(e, r);
    }
    const mx = e.x - sx;
    const my = e.y - sy;
    return { hx: Math.abs(dx) > 0.001 && Math.abs(mx) < Math.abs(dx) * 0.5, hy: Math.abs(dy) > 0.001 && Math.abs(my) < Math.abs(dy) * 0.5 };
  }

  resolveWalls(e, r) {
    const m = this.map;
    for (let pass = 0; pass < 2; pass++) {
      for (let cy = Math.floor(e.y - r); cy <= Math.floor(e.y + r); cy++) {
        for (let cx = Math.floor(e.x - r); cx <= Math.floor(e.x + r); cx++) {
          const solid = cx < 0 || cy < 0 || cx >= m.w || cy >= m.h || m.walls[cy * m.w + cx];
          if (!solid) continue;
          const nx = clamp(e.x, cx, cx + 1);
          const ny = clamp(e.y, cy, cy + 1);
          const ddx = e.x - nx;
          const ddy = e.y - ny;
          const d = Math.hypot(ddx, ddy);
          if (d >= r) continue;
          if (d > 1e-6) {
            e.x += (ddx / d) * (r - d);
            e.y += (ddy / d) * (r - d);
          } else {
            const faces = [[e.x - cx, -1, 0], [cx + 1 - e.x, 1, 0], [e.y - cy, 0, -1], [cy + 1 - e.y, 0, 1]];
            faces.sort((a, b) => a[0] - b[0]);
            const [dist, fx, fy] = faces[0];
            e.x += fx * (dist + r);
            e.y += fy * (dist + r);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ main step
  update(dt, input) {
    if (this.mode === 'client') return this.updateClient(dt, input);
    this.t += dt;
    this.lv.time += dt;
    const L = this.player;
    L.input = input;
    if (!L.down) this.updatePlayer(L, dt);
    for (const P of this.players) {
      this.tickPlayer(P, dt);
      if (P.bot && !P.down) this.updateBot(P, dt);
      if (!P.down) this.updateWeapon(P, dt);
      this.updateSpecial(P, dt);
    }
    this.updateFlow();
    this.updateZombies(dt);
    this.updateHazards(dt);
    this.updateProjs(dt);
    this.updatePickups(dt);
    this.updateWaves(dt);
    this.updateParticles(dt);
    this.tickTimers(dt);
    for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    this.combo.t -= dt;
    if (this.combo.t <= 0) this.combo.n = 0;
    if (this.toastMsg) {
      this.toastMsg.t -= dt;
      if (this.toastMsg.t <= 0) this.toastMsg = null;
    }
  }

  // Countdowns that only affect what the local screen shows.
  tickTimers(dt) {
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    const L = this.player;
    if (L.lvlUp && (L.lvlUp.t -= dt) <= 0) L.lvlUp = null;
    if (L.spCall && (L.spCall.t -= dt) <= 0) L.spCall = null;
    if (this.comboCall && (this.comboCall.t -= dt) <= 0) this.comboCall = null;
    this.hitT = Math.max(0, this.hitT - dt);
    if (this.hurtDirs) this.hurtDirs = this.hurtDirs.filter((h) => (h.t -= dt) > 0);
    for (const p of this.popups) {
      p.t -= dt;
      p.z += dt * 0.6;
    }
    this.popups = this.popups.filter((p) => p.t > 0);
    for (const c of this.corpses) {
      c.t += dt;
      // The headless body keeps spurting until it drops.
      if (c.headless && c.t < 0.4 && Math.random() < 0.8) {
        const H = ZHEIGHT[c.kind] * (c.sc || 1);
        this.particles.push({ x: c.x + rand(-0.05, 0.05), y: c.y + rand(-0.05, 0.05), z: H * 0.74, vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), vz: rand(2, 3.4), life: rand(0.4, 0.8), color: Math.random() < 0.7 ? this.goo() : '#ff2e88' });
      }
    }
    this.corpses = this.corpses.filter((c) => c.t < (c.headless ? 0.9 : 0.5));
    for (const h of this.heads) {
      h.t += dt;
      h.vz -= 9 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.z += h.vz * dt;
      h.spin += h.vs * dt;
      if (this.wallAt(h.x, h.y)) {
        h.x -= h.vx * dt;
        h.y -= h.vy * dt;
        h.vx *= -0.4;
        h.vy *= -0.4;
      }
      if (h.z < 0) {
        h.z = 0;
        h.vz = Math.abs(h.vz) > 1 ? -h.vz * 0.35 : 0;
        h.vx *= 0.55;
        h.vy *= 0.55;
        h.vs *= 0.5;
      }
      if (Math.random() < 0.3 && h.t < 0.8) this.particles.push({ x: h.x, y: h.y, z: h.z, vx: 0, vy: 0, vz: 0, life: 0.3, color: this.goo() });
    }
    this.heads = this.heads.filter((h) => h.t < 2.2);
    this.headT = Math.max(0, (this.headT || 0) - dt);
    for (const s of this.splats) s.t -= dt;
    this.splats = this.splats.filter((s) => s.t > 0);
    // Y2K glitches get more frequent toward midnight.
    if (Math.random() < this.cfg.glitchRate * dt) {
      this.glitchT = rand(0.08, 0.2);
      sfx.glitch();
    }
    if (this.glitchT > 0) this.glitchT -= dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
    }
  }

  // Meter, timers and rechargeable ride charges; runs for every player on the machine that owns the level.
  tickPlayer(P, dt) {
    P.hurtT = Math.max(0, P.hurtT - dt);
    P.iT = Math.max(0, P.iT - dt);
    P.overclock = Math.max(0, P.overclock - dt);
    P.fireAnim = Math.max(0, P.fireAnim - dt);
    P.zipT = Math.max(0, P.zipT - dt);
    this.tickMelee(P, dt);
    if (P.mods.regen && !P.down && this.lv.phase !== 'done') P.hp = Math.min(P.maxHp, P.hp + P.mods.regen * dt);
    if (P.down) this.lasers = this.lasers.filter((l) => l.o !== P.idx);
    if (!P.down && !P.spKind && this.lv.phase !== 'done') this.chargeSpecial(P, SP_PER_SEC * dt);
  }

  chargeSpecial(P, n) {
    const was = P.sp;
    P.sp = Math.min(SP_MAX, P.sp + n * P.mods.sp);
    if (was < SP_MAX && P.sp >= SP_MAX && this.isLocal(P)) sfx.spReady();
  }

  // ------------------------------------------------------------ player and rides
  pressJump() {
    const P = this.player;
    if (P.down) return;
    const M = P.hero.move;
    if (M.type === 'scooter') return this.pressBoost();
    if (M.type === 'slinky') {
      if (P.onGround) {
        P.charging = true;
        P.charge = 0;
      }
      return;
    }
    if (!P.onGround && !(M.type === 'pogo' && P.z < 0.25)) return;
    P.vz = M.jump;
    P.onGround = false;
    if (M.type === 'pogo') {
      P.mega = true;
      sfx.spring();
    } else sfx.jump();
  }

  releaseJump() {
    const P = this.player;
    const M = P.hero.move;
    if (M.type !== 'slinky' || !P.charging) return;
    P.charging = false;
    const c = clamp(P.charge, 0.15, 1);
    P.vz = M.jump * (0.6 + c * 0.6);
    P.onGround = false;
    const f = M.leap * (0.35 + 0.65 * c);
    P.vx += Math.cos(P.a) * f;
    P.vy += Math.sin(P.a) * f;
    sfx.spring();
  }

  pressBoost() {
    const P = this.player;
    if (P.down) return;
    const M = P.hero.move;
    if (M.type === 'board' && P.boostCd <= 0) {
      P.vx += Math.cos(P.a) * M.boost;
      P.vy += Math.sin(P.a) * M.boost;
      P.boostCd = M.boostCd;
      sfx.dash();
    }
    if (M.type === 'scooter' && P.charges > 0) {
      const mv = P.input.move;
      const ang = mv.f || mv.s ? P.a + Math.atan2(mv.s, mv.f || 0.0001) : P.a;
      P.vx = Math.cos(ang) * M.dash;
      P.vy = Math.sin(ang) * M.dash;
      P.charges--;
      P.dashT = 0.25;
      sfx.dash();
    }
  }

  // The local player asks for their special. Guests forward it to the host.
  pressSpecial() {
    const P = this.player;
    if (P.down || P.sp < SP_MAX || P.spKind) return false;
    // Specials come out of the gun, so it comes back into your hand.
    this.equip(P, 0);
    if (this.mode === 'client') {
      this.act?.('sp');
      return true;
    }
    return this.special(P);
  }

  // Weapon slots (Q, V, 1/2, mouse wheel, middle mouse, LB, the touch HIT button): slot 1 the gun,
  // slot 2 melee. No slot given: toggle. Guests switch straight away and tell the host in their input.
  pressSlot(slot, P = this.player) {
    if (P.down) return;
    this.equip(P, slot ?? 1 - P.slot);
  }

  // Put one weapon away and bring the other up. Swapping again halfway turns straight back.
  equip(P, slot) {
    if (P.slot === slot) return;
    P.slot = slot;
    P.swapT = P.swapT > 0 ? SWAP_T - P.swapT : SWAP_T;
    P.swingT = 0;
    P.struck = true;
    if (this.isLocal(P)) sfx.swap(slot);
  }

  // Swap, swing and hit-stop timers. A connecting swing holds still for a beat (hitHold) so it lands.
  tickMelee(P, dt) {
    P.swapT = Math.max(0, P.swapT - dt);
    P.impactT = Math.max(0, (P.impactT || 0) - dt);
    if (P.hitHold > 0) return (P.hitHold -= dt);
    P.meleeCd = Math.max(0, P.meleeCd - dt);
    P.swingT = Math.max(0, P.swingT - dt);
  }

  // How far into the current swing, in seconds (0 when not swinging).
  swingAge(P) {
    return P.swingT > 0 ? MELEE[P.melee?.kind || 'shove'].swing - P.swingT : 0;
  }

  // Wind up a swing. It connects later, at the weapon's hit time (see strike).
  startSwing(P) {
    const M = MELEE[P.melee?.kind || 'shove'];
    P.meleeCd = M.every / (P.overclock > 0 ? 1.4 : 1);
    P.swingT = M.swing;
    P.swingN = (P.swingN || 0) + 1;
    P.struck = false;
    this.snd('meleeSwish', P.melee?.kind || 'shove');
  }

  // What a swing connects with: zombies in reach inside the arc in front, nearest first, or anything
  // close enough to be touching you.
  meleeTargets(P, M) {
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);
    const hits = [];
    for (const z of this.zombies) {
      if (z.bs || z.dead || z.spawnT > 0.3 || z.hp <= 0) continue;
      const rx = z.x - P.x;
      const ry = z.y - P.y;
      const d = Math.hypot(rx, ry);
      if (d > M.reach + hitR(z)) continue;
      const da = Math.abs(Math.atan2(rx * -dy + ry * dx, rx * dx + ry * dy));
      if (d > hitR(z) + 0.3 && da > M.arc / 2) continue;
      hits.push([d, z]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    return hits.slice(0, M.max);
  }

  // Reload (X): start refilling a part-used box or rack early. With melee out, it brings the gun back first.
  pressReload(P = this.player) {
    if (P.down) return;
    if (P.slot) this.equip(P, 0);
    if (this.mode === 'client' && P === this.player) return this.act?.('reload');
    this.startReload(P);
  }

  startReload(P) {
    const G = P.hero.gun;
    if (!G.mag || P.reloadT > 0 || P.ammo >= G.mag) return;
    P.reloadT = G.reload / P.mods.rate * (P.overclock > 0 ? 0.5 : 1);
    P.reloadMax = P.reloadT;
    this.snd('reload', G.kind);
  }

  // The swing reaches the middle of the screen: whatever is in the arc gets hit.
  strike(P) {
    P.struck = true;
    const kind = P.melee?.kind || 'shove';
    const M = MELEE[kind];
    const hit = this.meleeTargets(P, M);
    for (const [d, z] of hit) {
      const nx = (z.x - P.x) / (d || 1);
      const ny = (z.y - P.y) / (d || 1);
      this.hurtZombie(z, M.dmg * (z.kind === 'boss' ? 0.6 : 1), nx, ny, M.knock, P, 'body');
      this.puff(z.x, z.y, ZHEIGHT[z.kind] * (z.sc || 1) * 0.6, this.goo(), kind === 'shove' ? 3 : 8);
      if (kind === 'keyboard') for (let k = 0; k < 4; k++) this.particles.push({ x: z.x, y: z.y, z: 0.8, vx: rand(-2, 2), vy: rand(-2, 2), vz: rand(1.5, 3.5), life: rand(0.5, 0.9), color: k % 2 ? '#e8e4d8' : '#8a8a96' });
    }
    if (hit.length) {
      this.snd('meleeHit', kind);
      P.hitHold = kind === 'shove' ? 0.03 : 0.05;
      // Guests show their own impacts as they swing (see updateClient), so this is for us only.
      if (this.isLocal(P)) this.feel('meleeHit', kind);
      this.hitStop = Math.max(this.hitStop || 0, kind === 'shove' ? 0.02 : 0.05);
      if (P.melee && --P.melee.uses <= 0) this.breakMelee(P);
    }
    return hit.length > 0;
  }

  // The melee weapon gives out. The champagne goes off like a bomb on its way.
  breakMelee(P) {
    const kind = P.melee.kind;
    const M = MELEE[kind];
    P.melee = null;
    if (M.burst) {
      const fx = P.x + Math.cos(P.a) * 1.2;
      const fy = P.y + Math.sin(P.a) * 1.2;
      for (const z of this.zombies) {
        const d = Math.hypot(z.x - fx, z.y - fy);
        if (d < 2.4 && !z.bs) this.hurtZombie(z, M.burst * (1 - d / 3.2), (z.x - fx) / (d || 1), (z.y - fy) / (d || 1), 3, P, 'body');
      }
      for (let k = 0; k < 40; k++) this.particles.push({ x: fx, y: fy, z: 0.9, vx: rand(-3, 3), vy: rand(-3, 3), vz: rand(1, 5), life: rand(0.5, 1.1), color: k % 3 ? '#fff4c8' : '#f6c945' });
      this.snd('pop');
      this.personal(P, 'toast', 'POP!', 'The bubbly went off');
    } else this.personal(P, 'toast', `${M.short} BROKE`, 'Back to your fists');
    this.snd('meleeBreak', kind);
  }

  updatePlayer(P, dt) {
    const M = P.hero.move;
    const inp = P.input;
    P.a += inp.turn * 2.6 * dt;
    const { f, s } = inp.move;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);
    const air = P.onGround ? 1 : 0.35;
    let ax;
    let ay;
    let accel = M.accel * P.mods.speed;
    const vmax = M.max * P.mods.speed;
    if (M.type === 'board') {
      // Push only forward; back brakes; strafing is weak.
      const fwd = Math.max(0, f);
      ax = dx * fwd + -dy * s * M.strafe;
      ay = dy * fwd + dx * s * M.strafe;
      if (f < 0) {
        P.vx *= 1 - 3 * dt;
        P.vy *= 1 - 3 * dt;
      }
    } else {
      ax = dx * f + -dy * s * M.strafe;
      ay = dy * f + dx * s * M.strafe;
    }
    if (P.charging) accel *= 0.2;
    const am = Math.hypot(ax, ay);
    if (am > 1) {
      ax /= am;
      ay /= am;
    }
    P.vx += ax * accel * air * dt;
    P.vy += ay * accel * air * dt;
    // Carving: skates and boards swing their momentum toward where you face.
    const sp = Math.hypot(P.vx, P.vy);
    if ((M.type === 'board' || M.type === 'skate') && sp > 0.5 && P.onGround) {
      const carve = M.type === 'board' ? 3 : 1.4;
      const va = Math.atan2(P.vy, P.vx);
      const da = Math.atan2(Math.sin(P.a - va), Math.cos(P.a - va));
      if (Math.abs(da) < 1.9) {
        const na = va + da * Math.min(1, carve * dt);
        P.vx = Math.cos(na) * sp;
        P.vy = Math.sin(na) * sp;
      }
    }
    if (P.onGround) {
      const fr = am < 0.1 ? M.friction * 1.6 : M.friction;
      const keep = Math.max(0, 1 - fr * dt);
      P.vx *= keep;
      P.vy *= keep;
    }
    const sp2 = Math.hypot(P.vx, P.vy);
    if (sp2 > vmax) {
      const target = Math.max(vmax, sp2 - 6 * dt);
      P.vx *= target / sp2;
      P.vy *= target / sp2;
    }
    const hit = this.moveCircle(P, P.vx * dt, P.vy * dt, 0.24);
    if (hit.hx) P.vx *= -0.2;
    if (hit.hy) P.vy *= -0.2;

    // Vertical: hops, the slinky's coil, the pogo's endless bounce.
    if (P.charging) P.charge = Math.min(1, P.charge + dt);
    if (!P.onGround || P.vz > 0) {
      P.vz -= GRAV * this.grav * dt;
      P.z += P.vz * dt;
      if (P.z <= 0) {
        P.z = 0;
        const hard = P.vz < -5;
        P.vz = 0;
        P.onGround = true;
        if (P.mega && M.type === 'pogo') {
          if (this.mode === 'client') {
            this.act?.('stomp', r2(P.x), r2(P.y));
            this.fx_stomp(P.x, P.y);
          } else this.stomp(P);
        } else if (hard) sfx.land();
        P.mega = false;
      }
    }
    if (M.type === 'pogo' && P.onGround && !P.charging) {
      P.vz = 2.3;
      P.onGround = false;
      sfx.boing();
    }
    P.stride += sp * dt;
    P.bob = P.onGround && M.type === 'slinky' ? Math.sin(this.t * 10) * 0.02 * Math.min(1, sp / 2) - P.charge * 0.18 : 0;
    P.boostCd = Math.max(0, P.boostCd - dt);
    if (M.type === 'scooter' && P.charges < M.charges) {
      P.rechargeT += dt;
      if (P.rechargeT >= M.recharge) {
        P.rechargeT = 0;
        P.charges++;
      }
    }
    if (P.dashT > 0) {
      P.dashT -= dt;
      if (Math.random() < 0.6) this.puff(P.x, P.y, 0.1, '#fff4d6', 1);
    }
    P.speed = sp;
  }

  stomp(P, x = P.x, y = P.y) {
    const M = P.hero.move;
    this.fx('stomp', r2(x), r2(y));
    for (const z of this.zombies.slice()) {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < M.stompR) {
        const f = 1 - d / M.stompR;
        this.hurtZombie(z, M.stomp * (0.5 + f * 0.5), (z.x - x) / (d || 1), (z.y - y) / (d || 1), 4, P);
      }
    }
  }

  // sx, sy: where the hit came from, for the direction arrow on the hurt player's screen.
  hurtPlayer(P, dmg, sx = null, sy = null) {
    if (P.down || P.dashT > 0 || P.iT > 0 || this.lv.phase === 'done') return;
    if (this.buffs.patch > 0) {
      this.personal(P, 'shield');
      return;
    }
    if (this.cheats.onehit) dmg = 9999;
    if (this.cheats.glass) dmg *= 2;
    dmg *= this.diff.hurt;
    this.hurtTaken += dmg;
    if (P.armor > 0) {
      const soak = Math.min(P.armor, dmg * 0.5);
      P.armor -= soak;
      dmg -= soak;
    }
    P.hp -= dmg;
    P.hurtT = 0.4;
    this.personal(P, 'hurt', sx == null ? null : r2(sx), sy == null ? null : r2(sy));
    if (P.hp <= 0 && P.mods.backup && !P.backupUsed) {
      // Backup Disk: restored from floppy, once per level.
      P.backupUsed = true;
      P.hp = Math.round(P.maxHp * 0.5);
      P.iT = 2.5;
      this.personal(P, 'toast', 'BACKUP RESTORED', 'Saved by the floppy. Once per level.');
      this.personal(P, 'flash', '#7ac943', 0.4, 0.6);
      this.fx('stomp', r2(P.x), r2(P.y));
      for (const z of this.zombies.slice()) {
        const d = Math.hypot(z.x - P.x, z.y - P.y);
        if (d < 3 && !z.bs) this.hurtZombie(z, 0, (z.x - P.x) / (d || 1), (z.y - P.y) / (d || 1), 3, P, 'chain');
      }
      return;
    }
    if (P.hp <= 0) {
      P.hp = 0;
      P.down = true;
      P.spKind = null;
      this.fx('downed', r2(P.x), r2(P.y));
      if (!this.alive().length) {
        this.lv.phase = 'done';
        this.emit('dead');
      } else this.toast(`${P.name} CRASHED`, this.mission ? 'Reboots next objective' : 'Reboots next wave');
    }
  }

  // Everyone who went down comes back when a new wave starts, next to someone still standing.
  reviveAll() {
    const up = this.alive();
    for (const P of this.players) {
      if (!P.down || P.gone) continue;
      const buddy = up[P.idx % Math.max(1, up.length)];
      if (buddy) {
        P.x = buddy.x;
        P.y = buddy.y;
      }
      P.down = false;
      P.hp = Math.min(P.maxHp, REVIVE_HP);
      P.iT = 2;
      this.personal(P, 'revive');
    }
  }

  // ------------------------------------------------------------ CPU teammates
  // A CPU teammate sticks near the lead player, backs off when the horde gets close, and shoots
  // whatever it can see. It drives its ride directly rather than through the controls.
  updateBot(P, dt) {
    const B = (P.ai ||= { t: 0, target: null, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(1, 3), lostT: 0, stuckT: 0, lx: P.x, ly: P.y, err: 0, dry: false });
    const G = P.hero.gun;
    const M = P.hero.move;
    const range = BOT_RANGE[G.kind];
    // Pick a target a few times a second: the nearest zombie in plain sight, preferring the boss.
    B.t -= dt;
    if (B.t <= 0 || !B.target || B.target.hp <= 0 || B.target.bs || !this.zombies.includes(B.target)) {
      B.t = rand(0.25, 0.45);
      B.target = null;
      let bd = Infinity;
      for (const z of this.zombies) {
        if (z.bs || z.spawnT > 0.2) continue;
        const d = Math.hypot(z.x - P.x, z.y - P.y);
        if (d > range + 5) continue;
        if (this.wallDistance(P.x, P.y, Math.atan2(z.y - P.y, z.x - P.x), d) < d - 0.4) continue;
        const score = d - (z.kind === 'boss' ? 4 : 0);
        if (score < bd) {
          bd = score;
          B.target = z;
        }
      }
      B.err = rand(-0.06, 0.06) / this.botSkill;
    }
    // Aim: turn toward the target at a human-ish rate, pitch toward the middle of its body.
    let fire = false;
    const T = B.target;
    if (T) {
      const d = Math.hypot(T.x - P.x, T.y - P.y);
      const ta = Math.atan2(T.y - P.y, T.x - P.x) + B.err;
      const da = Math.atan2(Math.sin(ta - P.a), Math.cos(ta - P.a));
      P.a += clamp(da, -6 * dt, 6 * dt);
      const hz = ZHEIGHT[T.kind] * (T.sc || 1) * (T.kind === 'crawler' ? 0.5 : 0.62);
      P.pitch = clamp(Math.atan2(hz - (EYE + P.z), Math.max(0.6, d)), -MAX_PITCH, MAX_PITCH);
      fire = Math.abs(da) < 0.12 + 0.35 / Math.max(1, d) && d < range && !(G.kind === 'rocket' && d < 1.2);
    } else P.pitch *= 1 - Math.min(1, 4 * dt);
    // The Soaker runs dry: let go and pump back up before spraying again.
    if (G.kind === 'soaker') {
      if (P.tank < G.drain * 3) B.dry = true;
      if (B.dry && P.tank > G.tank * 0.7) B.dry = false;
      if (B.dry) fire = false;
    }
    // Too close to shoot comfortably: out with the melee weapon, and back to the gun once there's
    // room again (held for a moment either way so they don't flick back and forth).
    const MM = MELEE[P.melee?.kind || 'shove'];
    B.slotT = (B.slotT || 0) - dt;
    if (T) {
      const d = Math.hypot(T.x - P.x, T.y - P.y);
      const reach = MM.reach + hitR(T);
      // Bare fists only beat the gun for Gus, whose rockets can't go off that close, and Dot, whose
      // floppies are slow to throw.
      const worth = P.melee || G.kind === 'rocket' || G.kind === 'floppy';
      const want = worth && d < reach + (P.melee ? 0.3 : -0.1) ? 1 : !worth || d > reach + 1.2 ? 0 : P.slot;
      if (want !== P.slot && B.slotT <= 0 && !P.spKind) {
        this.equip(P, want);
        B.slotT = 0.7;
      }
      if (P.slot) {
        const da = Math.atan2(Math.sin(Math.atan2(T.y - P.y, T.x - P.x) - P.a), Math.cos(Math.atan2(T.y - P.y, T.x - P.x) - P.a));
        fire = d < reach - 0.1 && Math.abs(da) < MM.arc * 0.4;
      }
    } else if (P.slot && B.slotT <= 0) this.equip(P, 0);
    P.input = { move: { f: 0, s: 0 }, turn: 0, fire, look: 0 };
    // Nothing around: top up the box or rack.
    if (!T && G.mag && P.ammo < G.mag / 2) this.startReload(P);
    // Specials: save them for a crowd or the boss.
    if (P.sp >= SP_MAX && !P.spKind) {
      const near = this.zombies.filter((z) => !z.bs && Math.hypot(z.x - P.x, z.y - P.y) < 7);
      if (near.length >= 4 || this.zombies.some((z) => z.kind === 'boss' && !z.bs && Math.hypot(z.x - P.x, z.y - P.y) < 9)) {
        this.equip(P, 0);
        this.special(P);
      }
    }

    // Where to go: a spot beside the lead player, away from anything too close, sidestepping in a fight.
    let wx = 0;
    let wy = 0;
    const lead = this.players.find((Q) => !Q.bot && !Q.down) || this.players.find((Q) => Q !== P && !Q.down);
    if (lead) {
      const dl = Math.hypot(lead.x - P.x, lead.y - P.y);
      const seen = this.wallDistance(P.x, P.y, Math.atan2(lead.y - P.y, lead.x - P.x), dl) >= dl - 0.3;
      B.lostT = seen ? 0 : B.lostT + dt;
      // Lost behind the buildings or left far behind: catch up the way game sidekicks do.
      if (dl > 16 || B.lostT > 4) {
        const back = lead.a + Math.PI + (P.idx % 2 ? 0.5 : -0.5);
        const nx = lead.x + Math.cos(back) * 1.2;
        const ny = lead.y + Math.sin(back) * 1.2;
        if (!this.wallAt(nx, ny)) {
          P.x = nx;
          P.y = ny;
          P.vx = P.vy = 0;
          B.lostT = 0;
          this.fx('spawn', r2(nx), r2(ny));
        }
      }
      const slot = lead.a + Math.PI + (P.idx % 2 ? 1 : -1) * (0.8 + 0.4 * Math.floor((P.idx - 1) / 2));
      let gx = lead.x + Math.cos(slot) * 2;
      let gy = lead.y + Math.sin(slot) * 2;
      if (this.wallAt(gx, gy)) {
        gx = lead.x;
        gy = lead.y;
      }
      const dg = Math.hypot(gx - P.x, gy - P.y);
      if (dg > 0.7) {
        const k = Math.min(1.3, (dg - 0.7) / 2.5 + (T ? 0 : 0.4));
        wx += ((gx - P.x) / dg) * k;
        wy += ((gy - P.y) / dg) * k;
      }
    }
    for (const z of this.zombies) {
      if (z.spawnT > 0.3) continue;
      const keep = z.kind === 'boss' ? 5 : z.kind === 'brute' || z.kind === 'bloater' ? 3.4 : 2.6;
      const d = Math.hypot(z.x - P.x, z.y - P.y);
      if (d < keep && d > 0.01) {
        const f = ((keep - d) / keep) * 1.8 * this.botSkill;
        wx -= ((z.x - P.x) / d) * f;
        wy -= ((z.y - P.y) / d) * f;
      }
    }
    if (T) {
      // Short-range weapons step in to reach their target.
      const d = Math.hypot(T.x - P.x, T.y - P.y);
      if (d > range * 0.85) {
        wx += ((T.x - P.x) / d) * 0.7;
        wy += ((T.y - P.y) / d) * 0.7;
      }
      B.strafeT -= dt;
      if (B.strafeT <= 0) {
        B.strafeT = rand(1.2, 3);
        B.strafe *= -1;
      }
      wx += -Math.sin(P.a) * B.strafe * 0.35;
      wy += Math.cos(P.a) * B.strafe * 0.35;
    }
    // Stuck on a wall or a prop: slide sideways for a moment.
    B.stuckT += dt;
    if (B.stuckT > 0.6) {
      if (Math.hypot(wx, wy) > 0.4 && Math.hypot(P.x - B.lx, P.y - B.ly) < 0.15) B.strafe *= -1;
      B.stuckT = 0;
      B.lx = P.x;
      B.ly = P.y;
    }
    const m = Math.hypot(wx, wy);
    if (m > 1) {
      wx /= m;
      wy /= m;
    }
    const vmax = M.max * P.mods.speed * 0.85;
    const k = Math.min(1, (P.onGround ? 5 : 1.5) * dt);
    P.vx += (wx * vmax - P.vx) * k;
    P.vy += (wy * vmax - P.vy) * k;
    const hit = this.moveCircle(P, P.vx * dt, P.vy * dt, 0.24);
    if (hit.hx) P.vx *= -0.2;
    if (hit.hy) P.vy *= -0.2;
    if (!P.onGround || P.vz > 0) {
      P.vz -= GRAV * this.grav * dt;
      P.z += P.vz * dt;
      if (P.z <= 0) {
        P.z = 0;
        P.vz = 0;
        P.onGround = true;
      }
    }
    if (M.type === 'pogo' && P.onGround) {
      P.vz = 2.3;
      P.onGround = false;
    }
    const sp = Math.hypot(P.vx, P.vy);
    P.stride += sp * dt;
    P.speed = sp;
    P.dashT = Math.max(0, P.dashT - dt);
  }

  // ------------------------------------------------------------ weapons
  updateWeapon(P, dt) {
    const G = P.hero.gun;
    const oc = (P.overclock > 0 ? 0.5 : 1) / P.mods.rate / (this.overdrive() ? OVERDRIVE_RATE : 1);
    P.fireCd -= dt;
    // The gun only fires from slot 1, once it's all the way up.
    const gunUp = P.slot === 0 && P.swapT <= 0;
    let firing = P.input.fire && gunUp;
    const bottomless = P.zipT > 0;
    this.updateMelee(P);
    // A box or rack only reloads with the gun in hand (it waits, half done, while you're swinging).
    if (G.mag && P.slot === 0) {
      if (P.reloadT > 0) {
        P.reloadT -= dt;
        firing = false;
        if (P.reloadT <= 0) {
          P.reloadT = 0;
          P.ammo = G.mag;
          this.snd('reloaded', G.kind);
        }
      } else if (P.ammo <= 0 && !bottomless) this.startReload(P);
      else if (P.ammo < G.mag && !P.input.fire && (this.lv.phase === 'break' || this.lv.phase === 'intro')) this.startReload(P);
    }
    this.lasers = this.lasers.filter((l) => l.o !== P.idx || l.sp);
    const eyeZ = EYE + P.z;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);

    if (G.kind === 'soaker') {
      if (firing && P.tank > G.drain) {
        while (P.fireCd <= 0) {
          P.fireCd += G.every / P.mods.rate;
          if (!bottomless) P.tank -= G.drain * (P.overclock > 0 ? 0.5 : 1);
          const m = this.muzzle(P, G.tier ? 'soaker2' : 'soaker');
          const a = m.a + rand(-G.spread, G.spread);
          for (const off of this.spread()) {
            const b = a + off;
            this.projs.push({ kind: 'water', o: P.idx, x: m.x, y: m.y, z: m.z, vx: Math.cos(b) * G.speed + P.vx * 0.5, vy: Math.sin(b) * G.speed + P.vy * 0.5, vz: rand(0.3, 0.9) + this.aimVz(P, m.z, G.speed), life: G.life, r: 0.12, dmg: G.dmg, knock: G.knock });
          }
          if (Math.random() < 0.35) this.snd('shoot', 'soaker');
        }
        P.fireAnim = 0.06;
        P.pumpT = 0.35;
      } else {
        P.fireCd = Math.max(P.fireCd, 0);
        P.pumpT -= dt;
        if (P.pumpT <= 0) P.tank = Math.min(G.tank, P.tank + G.refill * dt);
      }
    } else if (G.kind === 'yoyo') {
      if (firing && P.fireCd <= 0) {
        const out = this.projs.filter((p) => p.kind === 'yoyo' && p.o === P.idx && !p.orbit).map((p) => p.hand);
        const hand = [P.hand, 1 - P.hand].find((h) => !out.includes(h));
        if (hand != null) {
          P.hand = 1 - hand;
          P.fireCd = G.every * oc;
          const m = this.muzzle(P, 'yoyo', hand);
          this.spread().forEach((off, k) => {
            const b = m.a + off;
            this.projs.push(this.aimRay({ kind: 'yoyo', o: P.idx, hand: k ? 2 : hand, x: m.x, y: m.y, z: m.z, vx: Math.cos(b) * G.speed, vy: Math.sin(b) * G.speed, vz: this.aimVz(P, m.z, G.speed), travel: 0, back: false, hits: new Set(), r: 0.22, dmg: G.dmg, knock: G.knock, spin: 0 }, P));
          });
          this.snd('shoot', 'yoyo');
        }
      }
    } else if (G.kind === 'floppy') {
      if (firing && P.fireCd <= 0 && (P.ammo > 0 || bottomless)) {
        P.fireCd = G.every * oc;
        if (!bottomless) P.ammo--;
        P.fireAnim = 0.16;
        for (const off of this.spread()) this.throwFloppy(P, P.a + off, G.dmg, G.bounces, G.life, true);
        this.snd('shoot', 'floppy');
      }
    } else if (G.kind === 'rocket') {
      if (firing && P.fireCd <= 0 && (P.ammo > 0 || bottomless)) {
        P.fireCd = G.every * oc;
        if (!bottomless) P.ammo--;
        P.fireAnim = 0.2;
        // Dual Roman candles fire from each fist in turn, a new colour each ball.
        const hand = G.dual ? P.hand : 0;
        if (G.dual) {
          P.hand = 1 - hand;
          P.candleN = (P.candleN || 0) + 1;
        }
        const m = G.dual ? this.muzzle(P, 'candle', hand) : this.muzzle(P, 'rocket');
        for (const off of this.spread()) {
          const b = m.a + off;
          this.projs.push(this.aimRay({ kind: 'rocket', o: P.idx, x: m.x, y: m.y, z: m.z, vx: Math.cos(b) * G.speed, vy: Math.sin(b) * G.speed, vz: this.aimVz(P, m.z, G.speed), life: G.life, r: 0.2, dmg: G.direct, knock: 0, candle: !!G.dual, spin: G.dual ? P.candleN % 5 : 0 }, P));
        }
        this.snd('shoot', 'rocket');
        if (this.isLocal(P)) this.shake = Math.min(1, this.shake + 0.15);
      }
    } else if (G.kind === 'laser') {
      if (P.overheated) {
        P.heat -= G.cool * dt;
        if (P.heat <= 30) P.overheated = false;
      } else if (firing) {
        if (!bottomless) P.heat += G.heat * oc * dt;
        if (P.heat >= 100) {
          P.overheated = true;
          P.heat = 100;
          if (this.isLocal(P)) sfx.overheat();
        }
        const pierce = this.buffs.multi > 0;
        const d = this.beam(P, P.x, P.y, P.a, G.range, G.dps * dt, pierce, P.pitch);
        this.lasers.push({ o: P.idx, x: P.x, y: P.y, z: eyeZ, a: P.a, d, pt: P.pitch });
        if (P.fireCd <= 0) {
          this.snd('shoot', 'laser');
          P.fireCd = 0.07;
        }
        P.fireAnim = 0.05;
      } else {
        P.heat = Math.max(0, P.heat - G.cool * dt);
      }
    }
  }

  // Slot 2: holding fire keeps swinging at the weapon's pace; each swing connects partway through.
  updateMelee(P) {
    if (P.swingT > 0 && !P.struck && this.swingAge(P) >= MELEE[P.melee?.kind || 'shove'].hit) this.strike(P);
    if (P.slot === 1 && P.swapT <= 0 && P.input.fire && P.meleeCd <= 0 && !P.spKind) this.startSwing(P);
  }

  // Burn along a line. Returns how far the beam reaches: the first zombie, or the wall when piercing.
  // Pitched beams (the pointer) also stop at the floor and pick a hit zone by height.
  beam(P, x, y, a, range, dmg, pierce, pitch = null) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const eyeZ = EYE + P.z;
    const slope = pitch == null ? 0 : Math.tan(pitch);
    let wallD = Math.min(range, this.wallDistance(x, y, a, range));
    if (slope < -0.01) wallD = Math.min(wallD, eyeZ / -slope);
    let best = null;
    let bestT = wallD;
    const inLine = [];
    for (const z of this.zombies) {
      const rx = z.x - x;
      const ry = z.y - y;
      const t = rx * dx + ry * dy;
      if (t > 0 && t < wallD && Math.abs(rx * dy - ry * dx) < hitR(z) * 1.15) {
        const hz = pitch == null ? null : eyeZ + t * slope;
        if (hz != null && !this.inHeight(z, hz)) continue;
        inLine.push([z, hz]);
        if (t < bestT) {
          best = [z, hz];
          bestT = t;
        }
      }
    }
    const reach = pierce ? wallD : bestT;
    if (Math.random() < 0.7) this.puff(x + dx * (reach - 0.1), y + dy * (reach - 0.1), Math.max(0.05, eyeZ + reach * slope - 0.1), Math.random() < 0.5 ? '#ff3b3b' : '#fff4d6', 2);
    for (const [z, hz] of pierce ? inLine : best ? [best] : []) this.hurtZombie(z, dmg, dx, dy, 0.3, P, this.zoneAt(z, hz));
    // Mirror Ball: the beam glances off to the nearest other zombie.
    if (P.mods.ricochet && best && !best[0].dead) {
      const b = best[0];
      let o = null;
      let od = 3.5;
      for (const z of this.zombies) {
        const d = Math.hypot(z.x - b.x, z.y - b.y);
        if (z !== b && d < od) {
          o = z;
          od = d;
        }
      }
      if (o) {
        this.hurtZombie(o, dmg * (0.4 + 0.2 * P.mods.ricochet), (o.x - b.x) / (od || 1), (o.y - b.y) / (od || 1), 0.2, P, 'chain');
        if ((P.ricT = (P.ricT || 0) - 1) <= 0) {
          P.ricT = 4;
          this.fx('zap', r2(b.x), r2(b.y), 0.9, r2(o.x), r2(o.y), 0.9);
        }
      }
    }
    return reach;
  }

  throwFloppy(P, a, dmg, bounces, life, aimed = false) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const S = P.hero.gun.speed;
    // Aimed throws leave from the disk in her hand; special bursts fan out from her body.
    const m = aimed ? this.muzzle(P, 'floppy') : null;
    const z0 = m ? m.z : EYE + P.z - 0.14;
    const b = m ? a + (m.a - P.a) : a;
    const p = { kind: 'floppy', o: P.idx, x: m ? m.x : P.x + dx * 0.3, y: m ? m.y : P.y + dy * 0.3, z: z0, vx: Math.cos(b) * S, vy: Math.sin(b) * S, vz: aimed ? this.aimVz(P, z0, S) : 0, life, bounces, r: 0.18, dmg, knock: P.hero.gun.knock, spin: rand(0, 4) };
    this.projs.push(aimed ? this.aimRay(p, P) : p);
  }

  // Where a shot leaves the weapon on screen, in the world, and the heading that brings it across the
  // crosshair CONVERGE units out (the muzzle sits off to one side of the eye).
  muzzle(P, kind, hand = 0) {
    const m = muzzleWorld(kind, hand, P.x, P.y, EYE + P.z, P.a, P.pitch || 0);
    m.a = P.a - Math.atan2(m.r, CONVERGE);
    return m;
  }

  // Angle offsets for each shot: one normally, a fan of three while Multitasking.
  spread() {
    return this.buffs.multi > 0 ? [0, -0.2, 0.2] : [0];
  }

  // Vertical speed for a shot leaving the hand at startZ so it crosses the crosshair CONVERGE units out.
  aimVz(P, startZ, hspeed) {
    return hspeed * (Math.tan(P.pitch || 0) + (EYE + P.z - startZ) / CONVERGE);
  }

  // Tag a shot with the crosshair ray it was aimed along. Hits are judged on that ray, so a head
  // under the crosshair is a head hit even though the shot leaves from the hand below it.
  aimRay(p, P) {
    p.ox = P.x;
    p.oy = P.y;
    p.rz = EYE + P.z;
    p.rs = Math.tan(P.pitch || 0);
    return p;
  }

  hitZ(p) {
    return p.rs == null ? p.z : p.rz + p.rs * Math.hypot(p.x - p.ox, p.y - p.oy);
  }

  // Which part of a zombie a hit at height hz lands on. Crawlers are all body.
  zoneAt(z, hz) {
    if (hz == null || z.kind === 'crawler') return 'body';
    const f = hz / (ZHEIGHT[z.kind] * (z.sc || 1));
    return f > (this.cheats.bighead && z.kind !== 'boss' ? 0.62 : HEAD_FRAC) ? 'head' : f < LEG_FRAC ? 'legs' : 'body';
  }

  // Can a shot at height hz touch this zombie at all?
  inHeight(z, hz) {
    if (z.bs) return false;
    const top = ZHEIGHT[z.kind] * (z.sc || 1) * (this.cheats.bighead && z.kind !== 'boss' && z.kind !== 'crawler' ? 1.15 : 1) + (z.kind === 'crawler' ? 0.12 : 0.06);
    return hz > -0.05 && hz < top;
  }

  // ------------------------------------------------------------ specials
  special(P) {
    if (P.down || P.sp < SP_MAX || P.spKind || this.lv.phase === 'done') return false;
    const G = P.hero.gun;
    const S = P.hero.special;
    P.sp = 0;
    P.spKind = G.kind;
    P.spT = 0;
    P.spStep = 0;
    P.iT = Math.max(P.iT, 0.8);
    this.snd('special', G.kind);
    this.personal(P, 'special', S.name, S.color);
    this.emit('special', { p: P.idx });
    if (G.kind === 'floppy') {
      this.snd('shoot', 'floppy');
      for (let i = 0; i < 24; i++) this.throwFloppy(P, P.a + (i / 24) * TAU, 30, 4, 2.6);
    }
    if (G.kind === 'yoyo') {
      for (let k = 0; k < 2; k++) this.projs.push({ kind: 'yoyo', o: P.idx, orbit: true, hand: k, ang: P.a + k * Math.PI, x: P.x, y: P.y, z: EYE + P.z - 0.25, vx: 0, vy: 0, life: 6, r: 0.5, dmg: 26, knock: 1.2, spin: 0 });
    }
    if (G.kind === 'laser') {
      P.heat = 0;
      P.overheated = false;
    }
    return true;
  }

  // What each special does while it runs.
  updateSpecial(P, dt) {
    if (!P.spKind) return;
    P.spT += dt;
    const k = P.spKind;
    const eyeZ = EYE + P.z;
    if (k === 'soaker') {
      // Tidal Wave: a firehose cone that shoves the whole street back.
      const a0 = P.a;
      for (let i = 0; i < 5; i++) {
        const b = a0 + rand(-0.6, 0.6);
        const s = rand(9, 15);
        this.projs.push({ kind: 'water', fx: true, o: P.idx, x: P.x + Math.cos(b) * 0.4, y: P.y + Math.sin(b) * 0.4, z: eyeZ - 0.25, vx: Math.cos(b) * s, vy: Math.sin(b) * s, vz: rand(0.5, 2.6), life: 0.7, r: 0.12, dmg: 0, knock: 0 });
      }
      for (const z of this.zombies.slice()) {
        const rx = z.x - P.x;
        const ry = z.y - P.y;
        const d = Math.hypot(rx, ry);
        if (d > 8 || d < 0.01) continue;
        const da = Math.atan2(Math.sin(Math.atan2(ry, rx) - a0), Math.cos(Math.atan2(ry, rx) - a0));
        if (Math.abs(da) > 0.7) continue;
        const dmg = 95 * dt * (z.kind === 'glitch' ? 2.5 : 1);
        this.hurtZombie(z, dmg, rx / d, ry / d, 14 * dt, P);
      }
      if (P.spT > 1.4) P.spKind = null;
    } else if (k === 'yoyo') {
      // Around the World: the yo-yos orbit on their own; the special ends when they do.
      if (!this.projs.some((p) => p.orbit && p.o === P.idx)) P.spKind = null;
    } else if (k === 'floppy') {
      // Defrag: a second ring of disks, offset from the first.
      if (P.spStep === 0 && P.spT > 0.35) {
        P.spStep = 1;
        this.snd('shoot', 'floppy');
        for (let i = 0; i < 24; i++) this.throwFloppy(P, P.a + ((i + 0.5) / 24) * TAU, 30, 4, 2.6);
      }
      if (P.spT > 0.5) P.spKind = null;
    } else if (k === 'rocket') {
      // Grand Finale: fireworks rain down on the horde, always with the base rocket's punch.
      const B = P.hero.baseGun || P.hero.gun;
      while (P.spStep < 16 && P.spT > P.spStep * 0.13) {
        P.spStep++;
        const near = this.zombies.filter((z) => Math.hypot(z.x - P.x, z.y - P.y) < 14);
        let tx;
        let ty;
        if (near.length) {
          const z = pickOne(near);
          tx = z.x + rand(-0.3, 0.3);
          ty = z.y + rand(-0.3, 0.3);
        } else {
          const a = rand(0, TAU);
          const r = rand(2, 6);
          tx = P.x + Math.cos(a) * r;
          ty = P.y + Math.sin(a) * r;
        }
        if (this.wallAt(tx, ty)) continue;
        this.projs.push({ kind: 'rocket', o: P.idx, fall: true, x: tx, y: ty, z: 7, vx: 0, vy: 0, vz: -10, life: 3, r: 0.2, dmg: B.direct, knock: 0, big: 1.3, st: B });
        if (P.spStep % 3 === 1) this.snd('shoot', 'rocket');
      }
      if (P.spStep >= 16) P.spKind = null;
    } else if (k === 'laser') {
      // Light Show: six beams spin around you and cut through everything.
      this.lasers = this.lasers.filter((l) => !(l.o === P.idx && l.sp));
      for (let i = 0; i < 6; i++) {
        const a = P.a + P.spT * 2.4 + (i / 6) * TAU;
        const d = this.beam(P, P.x, P.y, a, 12, 150 * dt, true);
        this.lasers.push({ o: P.idx, sp: true, x: P.x, y: P.y, z: eyeZ, a, d });
      }
      if (Math.floor(P.spT * 14) !== Math.floor((P.spT - dt) * 14)) this.snd('shoot', 'laser');
      if (P.spT > 3.5) {
        P.spKind = null;
        this.lasers = this.lasers.filter((l) => !(l.o === P.idx && l.sp));
      }
    }
  }

  updateProjs(dt) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      const P = this.players[p.o] || this.player;
      const G = P.hero.gun;
      const ocMul = P.overclock > 0 ? 1.3 : 1;
      let dead = false;
      if (p.kind === 'yoyo' && p.orbit) {
        p.life -= dt;
        p.spin += dt * 24;
        p.ang += dt * 7;
        const R = 1.7;
        p.x = P.x + Math.cos(p.ang) * R;
        p.y = P.y + Math.sin(p.ang) * R;
        p.z = EYE + P.z - 0.3;
        if (p.life <= 0 || P.down) {
          this.projs.splice(i, 1);
          continue;
        }
        for (const z of this.zombies.slice()) {
          if ((z.orbT || 0) > this.t) continue;
          const d = Math.hypot(z.x - p.x, z.y - p.y);
          if (d < hitR(z) + p.r) {
            z.orbT = this.t + 0.22;
            this.hurtZombie(z, p.dmg * ocMul, (z.x - P.x) / (d || 1), (z.y - P.y) / (d || 1), p.knock, P);
            this.puff(p.x, p.y, p.z, this.goo(), 5);
          }
        }
        continue;
      }
      if (p.kind === 'yoyo') {
        p.spin += dt * 20;
        if (p.back) {
          const ddx = P.x - p.x;
          const ddy = P.y - p.y;
          const d = Math.hypot(ddx, ddy);
          if (d < 0.45) {
            this.projs.splice(i, 1);
            continue;
          }
          p.vx = (ddx / d) * G.speed * 1.1;
          p.vy = (ddy / d) * G.speed * 1.1;
          p.z += (EYE + P.z - 0.18 - p.z) * Math.min(1, dt * 6);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else if (p.sleepT > 0) {
          // Walk the Dog: the yo-yo sleeps at full reach, hitting whatever it touches again.
          p.sleepT -= dt;
          if ((p.tick = (p.tick || 0) + dt) > 0.15) {
            p.tick = 0;
            p.hits.clear();
          }
          if (p.sleepT <= 0) p.back = true;
        } else {
          const nx = p.x + p.vx * dt;
          const ny = p.y + p.vy * dt;
          p.z = Math.max(0.08, p.z + (p.vz || 0) * dt);
          p.travel += G.speed * dt;
          if (!this.wallAt(nx, ny) && p.travel > G.range && P.mods.sleeper && !p.slept) {
            p.slept = true;
            p.sleepT = 0.25 + 0.25 * P.mods.sleeper;
            p.hits.clear();
          } else if (this.wallAt(nx, ny) || p.travel > G.range) {
            p.back = true;
            p.rs = null;
            p.hits.clear();
            if (this.wallAt(nx, ny)) this.puff(p.x, p.y, p.z, '#fff4d6', 4);
          } else {
            p.x = nx;
            p.y = ny;
          }
        }
        for (const z of this.zombies.slice()) {
          if (p.hits.has(z)) continue;
          const hz = this.hitZ(p);
          if (Math.hypot(z.x - p.x, z.y - p.y) < hitR(z) + p.r && this.inHeight(z, hz)) {
            p.hits.add(z);
            const d = Math.hypot(p.vx, p.vy) || 1;
            this.hurtZombie(z, p.dmg * ocMul, p.vx / d, p.vy / d, p.knock, P, this.zoneAt(z, hz));
            this.puff(p.x, p.y, p.z, this.goo(), 5);
          }
        }
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        dead = true;
        if (p.kind === 'rocket') this.explode(p.x, p.y, p.z, P, p.big, p.st);
      }
      if (p.kind === 'water') {
        p.vz -= 2.2 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0.02) {
          dead = true;
          if (!p.fx || Math.random() < 0.3) this.puff(p.x, p.y, 0.02, '#8fd8ff', 1);
        }
      }
      if (p.kind === 'floppy') {
        p.spin += dt * 16;
        p.z += p.vz * dt;
        // Aimed at the floor: skip off it (counts as a bounce).
        if (p.z < 0.06 && p.vz < 0) {
          p.z = 0.06;
          p.vz = -p.vz * 0.7;
          p.bounces--;
          p.rs = null;
          this.puff(p.x, p.y, 0.06, '#3de0e0', 3);
          if (p.bounces < 0) dead = true;
        }
      }
      if (p.kind === 'rocket') {
        if (!p.candle) p.spin = (p.spin || 0) + dt * 12;
        this.rocketTrail(p);
        if (!p.fall) {
          p.z += p.vz * dt;
          if (p.z <= 0.06 && !dead) {
            this.explode(p.x, p.y, 0.1, P, p.big, p.st);
            dead = true;
          }
        }
        if (p.fall) {
          p.z += p.vz * dt;
          if (p.z <= 0.15 && !dead) {
            this.explode(p.x, p.y, 0.15, P, p.big, p.st);
            dead = true;
          }
          if (dead) this.projs.splice(i, 1);
          continue;
        }
      }

      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (p.kind === 'floppy') {
        let bounced = false;
        if (this.wallAt(nx, p.y)) {
          p.vx = -p.vx;
          bounced = true;
        }
        if (this.wallAt(p.x, ny)) {
          p.vy = -p.vy;
          bounced = true;
        }
        if (bounced) {
          p.bounces--;
          p.rs = null;
          // Disk Split: the first bounce throws off copies at an angle.
          if (P.mods.split && !p.split && !dead) {
            p.split = true;
            for (let k = 0; k < P.mods.split; k++) {
              const a = (k % 2 ? -1 : 1) * (0.45 + 0.2 * Math.floor(k / 2));
              const c = Math.cos(a);
              const s = Math.sin(a);
              this.projs.push({ ...p, vx: p.vx * c - p.vy * s, vy: p.vx * s + p.vy * c, dmg: p.dmg * 0.7, spin: rand(0, 4), rs: null });
            }
          }
          this.puff(p.x, p.y, p.z, '#3de0e0', 4);
          if (this.isLocal(P)) sfx.tick();
          if (p.bounces < 0) dead = true;
        } else {
          p.x = nx;
          p.y = ny;
        }
      } else if (!dead && this.wallAt(nx, ny)) {
        dead = true;
        if (p.kind === 'rocket') this.explode(p.x, p.y, p.z, P, p.big, p.st);
        if (p.kind === 'water' && !p.fx) this.puff(p.x, p.y, p.z, '#8fd8ff', 3);
      } else {
        p.x = nx;
        p.y = ny;
      }

      if (!dead && !p.fx) {
        for (const z of this.zombies) {
          const hz = this.hitZ(p);
          if (Math.hypot(z.x - p.x, z.y - p.y) < hitR(z) + p.r && this.inHeight(z, hz)) {
            const d = Math.hypot(p.vx, p.vy) || 1;
            let dmg = p.dmg * ocMul;
            if (p.kind === 'water' && z.kind === 'glitch') dmg *= 2.5;
            this.hurtZombie(z, dmg, p.vx / d, p.vy / d, p.knock, P, this.zoneAt(z, hz));
            if (p.kind === 'water') {
              if (P.mods.slick) z.slowT = 0.8 + 0.6 * P.mods.slick;
              this.puff(p.x, p.y, p.z, '#8fd8ff', 2);
              if (Math.random() < 0.15) this.snd('splash');
            }
            if (p.kind === 'floppy') this.puff(p.x, p.y, p.z, this.goo(), 6);
            if (p.kind === 'rocket') this.explode(p.x, p.y, p.z, P, p.big, p.st);
            dead = true;
            break;
          }
        }
      }
      if (dead) this.projs.splice(i, 1);
    }
  }

  rocketTrail(p) {
    // Roman candle balls (the spin carries the colour) leave sparks in their own colour.
    const candle = p.candle;
    const col = candle ? (Math.random() < 0.6 ? CANDLE_COLS[Math.floor(p.spin || 0) % CANDLE_COLS.length] : '#fff4d6') : Math.random() < 0.5 ? '#f6c945' : '#ff8a2a';
    if (Math.random() < 0.9) this.particles.push({ x: p.x, y: p.y, z: p.z, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(-0.2, 0.3), life: 0.35, color: col });
  }

  // st: the stats the shot was fired with (Grand Finale fireworks keep the base rocket's).
  explode(x, y, z, P, big = 1, st = null) {
    const G = st || P.hero.gun;
    const R = (G.radius || 1.9) * big;
    this.fx('explode', r2(x), r2(y), r2(z), pickOne(PARTY), pickOne(PARTY));
    // Cluster Bomb: each blast scatters smaller ones around it.
    if (P.mods.cluster && !G.mini) {
      const mini = { ...G, radius: R * 0.5, dmg: (G.dmg || 55) * 0.35, knock: 1, mini: true };
      const n = 2 + P.mods.cluster;
      const a0 = Math.random() * TAU;
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * TAU;
        const bx = x + Math.cos(a) * R * 0.9;
        const by = y + Math.sin(a) * R * 0.9;
        if (!this.wallAt(bx, by)) this.explode(bx, by, Math.max(0.1, z), P, 1, mini);
      }
    }
    for (const zb of this.zombies.slice()) {
      const d = Math.hypot(zb.x - x, zb.y - y);
      if (d < R + hitR(zb)) {
        const f = 1 - Math.min(1, d / (R + hitR(zb)));
        this.hurtZombie(zb, (G.dmg || 55) * big * (0.4 + 0.6 * f) * (P.overclock > 0 ? 1.3 : 1), (zb.x - x) / (d || 1), (zb.y - y) / (d || 1), G.knock || 2.5, P);
      }
    }
  }

  // An upgrade explosion: hurts zombies only, not tied to anyone's weapon.
  blast(x, y, R, dmg, P) {
    this.fx('explode', r2(x), r2(y), 0.5, '#f6c945', '#ff8a2a');
    for (const zb of this.zombies.slice()) {
      const d = Math.hypot(zb.x - x, zb.y - y);
      if (d < R + hitR(zb)) this.hurtZombie(zb, dmg / P.dmgMul * (1 + (P.dmgMul - 1) * 0.5), (zb.x - x) / (d || 1), (zb.y - y) / (d || 1), 1.6, P, 'chain');
    }
  }

  fx_overdrive() {
    sfx.overdrive();
    this.flash = { color: '#ff2e88', t: 0.2, amt: 0.35 };
    this.shake = Math.min(1, this.shake + 0.3);
    this.comboCall = { text: 'OVERDRIVE!', mult: comboMult(this.combo.n), t: 1.8 };
  }

  fx_jackpot(x, y, got) {
    if (got) {
      sfx.jackpot();
      this.flash = { color: '#f6c945', t: 0.3, amt: 0.5 };
      this.hitStop = 0.18;
      for (let i = 0; i < 70; i++) {
        const a = rand(0, TAU);
        const s = rand(1, 4);
        this.particles.push({ x, y, z: 0.6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(2, 5), life: rand(0.6, 1.3), color: i % 3 ? '#f6c945' : '#fff4d6' });
      }
    } else sfx.glitch();
    for (let i = 0; i < 20; i++) this.particles.push({ x: x + rand(-0.3, 0.3), y: y + rand(-0.3, 0.3), z: rand(0, 1.2), vx: 0, vy: 0, vz: rand(0.5, 1.5), life: rand(0.3, 0.7), color: '#f6c945', float: true });
  }

  fx_zap(x1, y1, z1, x2, y2, z2) {
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const j = i === 0 || i === n ? 0 : 0.12;
      this.particles.push({ x: x1 + (x2 - x1) * f + rand(-j, j), y: y1 + (y2 - y1) * f + rand(-j, j), z: z1 + (z2 - z1) * f + rand(-j, j), vx: 0, vy: 0, vz: 0, life: rand(0.1, 0.22), color: i % 3 ? '#4ab8ff' : '#ffffff', float: true });
    }
    sfx.arc();
  }

  fx_infect(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      this.particles.push({ x, y, z: rand(0.3, 1), vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, vz: rand(0, 0.8), life: rand(0.3, 0.6), color: i % 2 ? '#e8344e' : '#ff8fc4', float: true });
    }
  }

  // A bloater bursts in a shower of confetti and goo, hurting anything standing too close, players included.
  pop(z, P) {
    const R = 1.7;
    this.fx('pop', r2(z.x), r2(z.y));
    for (const o of this.zombies.slice()) {
      const d = Math.hypot(o.x - z.x, o.y - z.y);
      if (d < R + hitR(o)) this.hurtZombie(o, 45 / (P?.dmgMul || 1), (o.x - z.x) / (d || 1), (o.y - z.y) / (d || 1), 1.5, P);
    }
    for (const Q of this.players) if (Math.hypot(Q.x - z.x, Q.y - z.y) < R - 0.2 && Q.z < 0.6) this.hurtPlayer(Q, 14 * this.cfg.damageMul);
    this.emit('pop');
  }

  puff(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x, y, z, vx: rand(-1.2, 1.2), vy: rand(-1.2, 1.2), vz: rand(0, 2), life: rand(0.2, 0.45), color });
    }
    if (this.out) this.out.push(['f', 'puff', r2(x), r2(y), r2(z), color, n]);
  }

  // ------------------------------------------------------------ effects (replayed on guests)
  fx_puff(x, y, z, color, n) {
    for (let i = 0; i < n; i++) this.particles.push({ x, y, z, vx: rand(-1.2, 1.2), vy: rand(-1.2, 1.2), vz: rand(0, 2), life: rand(0.2, 0.45), color });
  }

  fx_stomp(x, y) {
    sfx.stomp();
    this.shake = 0.6;
    for (let i = 0; i < 50; i++) {
      const a = rand(0, TAU);
      const s = rand(2, 5);
      this.particles.push({ x, y, z: 0.05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0.5, 2), life: 0.5, color: i % 3 ? '#fff4d6' : '#ff8a2a' });
    }
  }

  fx_explode(x, y, z, c1, c2) {
    sfx.explode();
    this.shake = Math.min(1, this.shake + 0.35);
    this.flash = { color: '#ffd080', t: 0.08, amt: 0.2 };
    const cols = [c1, c2, '#fff4d6'];
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU);
      const e = rand(-0.6, 1);
      const s = rand(2, 5);
      this.particles.push({ x, y, z: Math.max(0.2, z), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: e * s, life: rand(0.4, 0.9), color: cols[i % 3] });
    }
  }

  fx_pop(x, y) {
    sfx.explode();
    this.shake = Math.min(1, this.shake + 0.3);
    this.splats.push({ x, y, t: 14, big: true, rot: rand(0, TAU) });
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU);
      const s = rand(1.5, 4.5);
      this.particles.push({ x, y, z: rand(0.4, 1.1), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0, 3.5), life: rand(0.5, 1.2), color: i % 3 ? PARTY[i % PARTY.length] : this.goo() });
    }
  }

  fx_death(kind, x, y, look, sc) {
    sfx.die();
    this.corpses.push({ kind, x, y, t: 0, look, sc });
    this.splats.push({ x, y, t: 14, big: kind === 'boss' || kind === 'brute', rot: rand(0, TAU) });
    if (this.splats.length > 40) this.splats.shift();
    const n = kind === 'boss' ? 90 : 20;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.8, kind === 'boss' ? 5 : 2.5);
      this.particles.push({ x, y, z: rand(0.3, 0.9), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0.5, 3), life: rand(0.5, 1.1), color: i % 2 ? this.goo() : PARTY[i % PARTY.length] });
    }
    if (kind === 'boss') {
      this.shake = 1;
      this.flash = { color: '#ffffff', t: 0.25, amt: 0.6 };
      this.hitStop = 0.3;
    } else if (kind === 'brute') this.hitStop = Math.max(this.hitStop || 0, 0.05);
  }

  // Headshot: the head pops off spinning, a fountain of goo and confetti, the body stands a beat, then drops.
  fx_headshot(kind, x, y, look, sc, nx, ny) {
    sfx.headshot();
    // A beat of hit-stop sells the pop (longer for the big ones).
    this.hitStop = Math.max(this.hitStop || 0, kind === 'boss' ? 0.3 : kind === 'brute' || kind === 'bloater' ? 0.07 : 0.035);
    const H = ZHEIGHT[kind] * (sc || 1);
    this.corpses.push({ kind, x, y, t: 0, look, sc, headless: true });
    this.splats.push({ x, y, t: 14, big: kind === 'boss' || kind === 'brute', rot: rand(0, TAU) });
    if (this.splats.length > 40) this.splats.shift();
    this.heads.push({ kind, look, sc, x, y, z: H * 0.84, vx: nx * 2.2 + rand(-0.6, 0.6), vy: ny * 2.2 + rand(-0.6, 0.6), vz: rand(3.6, 4.6), spin: 0, vs: rand(-14, 14), t: 0 });
    for (let i = 0; i < 36; i++) {
      const a = rand(0, TAU);
      const s = rand(0.4, 1.6);
      this.particles.push({ x, y, z: H * 0.78, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(1.5, 4), life: rand(0.5, 1.1), color: i % 3 ? this.goo() : PARTY[i % PARTY.length] });
    }
    if (kind === 'boss') {
      this.shake = 1;
      this.flash = { color: '#ffffff', t: 0.25, amt: 0.6 };
    }
  }

  fx_popup(x, y, z, text, big) {
    this.popups.push({ x, y, z, t: 0.9, text, big });
  }

  fx_spawn(x, y) {
    for (let i = 0; i < 16; i++) this.particles.push({ x: x + rand(-0.3, 0.3), y: y + rand(-0.3, 0.3), z: rand(0, 1), vx: 0, vy: 0, vz: rand(-0.5, 0.5), life: rand(0.2, 0.6), color: i % 2 ? '#3de0e0' : '#ff2e88', float: true });
  }

  fx_blink(x, y) {
    sfx.glitch();
    for (let i = 0; i < 14; i++) this.particles.push({ x: x + rand(-0.3, 0.3), y: y + rand(-0.3, 0.3), z: rand(0, 1), vx: 0, vy: 0, vz: 0, life: 0.3, color: i % 2 ? '#3de0e0' : '#ff2e88', float: true });
  }

  fx_downed(x, y) {
    sfx.bsod();
    for (let i = 0; i < 30; i++) this.particles.push({ x: x + rand(-0.3, 0.3), y: y + rand(-0.3, 0.3), z: rand(0, 1.2), vx: 0, vy: 0, vz: rand(0.2, 0.8), life: rand(0.5, 1), color: i % 2 ? '#0000aa' : '#ffffff', float: true });
  }

  fx_nuke() {
    this.shake = 1;
    this.flash = { color: '#0000aa', t: 0.35, amt: 0.7 };
    sfx.bsod();
  }

  fx_shake(a) {
    this.shake = Math.min(1, this.shake + a);
  }

  // ------------------------------------------------------------ the horde
  // `at` places the zombie somewhere specific (a boss calling in minions); otherwise it comes
  // out of a spawn point away from the party.
  spawnZombie(kind, at = null) {
    if (kind === 'mini') return this.spawnMiniBoss(at);
    const base = ENEMIES[kind];
    const cfg = this.cfg;
    let s = at;
    if (!s) s = this.spawnPoint(kind);
    const B = kind === 'boss' ? this.bossDef : null;
    // Story bosses scale with the people playing, not the CPU crew the story hands you.
    const crowd = cfg.story ? this.players.filter((P) => !P.bot).length : this.players.length;
    const hp = base.hp * cfg.hpMul * (B ? B.hpMul * (1 + COOP_BOSS_HP * (crowd - 1)) : this.cheats.swarm ? 0.65 : 1);
    const z = {
      id: this.nextZid++, kind, x: s.x + rand(-0.2, 0.2), y: s.y + rand(-0.2, 0.2),
      hp, max: hp, bs: 0,
      speed: Math.min(kind === 'runner' ? 4.2 : 3.6, (base.speed / 40) * cfg.speedMul * rand(0.88, 1.12)) * (B ? B.speed : 1),
      dmg: base.damage * cfg.damageMul, state: 'walk', atkT: 0, cd: 0.5, kx: 0, ky: 0, hurtT: 0,
      look: Math.floor(Math.random() * 1000), sc: B ? B.scale : r2(rand(0.92, 1.08)),
      anim: rand(0, 4), spawnT: 0.6, hitAt: this.t, blinkT: rand(2, 3.5), chargeT: rand(4, 6), chargeLeft: 0, groanT: rand(2, 9), wob: rand(0, TAU),
    };
    if (B) {
      z.ab = {};
      B.moves.forEach((m, i) => (z.ab[m] = rand(...BOSS_CD[m]) * 0.6 + i * 0.8));
    }
    this.rollAffix(z);
    this.zombies.push(z);
    // First sighting of a new type gets a heads-up.
    const tip = NEW_TIPS[kind];
    if (tip && this.levelN === base.unlock && !(this.announced ||= new Set()).has(kind)) {
      this.announced.add(kind);
      this.toast(`NEW: ${base.name.toUpperCase()}`, tip);
    }
    this.fx('spawn', r2(z.x), r2(z.y));
    if (kind === 'boss') {
      this.boss = z;
      if (!this.boss || this.boss === z) this.banner = { kind: 'boss', t: 2.8, dur: 2.8 };
      this.snd('bossRoar');
    }
  }

  // From level 3 a few of the horde are special: Spitters lob glitch packets from range, Sprinters
  // run you down, Tanks soak up punishment. Each has its own tint and pays extra score.
  rollAffix(z) {
    const n = this.levelN;
    if (z.kind === 'boss' || n < 3 || this.lv.phase === 'intro') return;
    const p = Math.min(0.22, 0.09 + n * 0.003) * (this.endless ? 1.3 : 1);
    if (Math.random() > p) return;
    const opts = ['fast', 'tough'];
    if (z.kind === 'shambler' || z.kind === 'runner' || z.kind === 'glitch' || z.kind === 'bloater') opts.push('spit', 'spit');
    const a = opts[Math.floor(Math.random() * opts.length)];
    z.affix = AFFIXES.indexOf(a);
    if (a === 'fast') z.speed = Math.min(4.6, z.speed * 1.5);
    if (a === 'tough') {
      z.hp *= 2.6;
      z.max = z.hp;
      z.sc = r2(z.sc * 1.18);
    }
    if (a === 'spit') z.spitT = rand(0.6, 1.4);
    if (!(this.announced ||= new Set()).has(a)) {
      this.announced.add(a);
      this.toast(AFFIX_TIPS[a][0], AFFIX_TIPS[a][1]);
    }
  }

  // The Head Bouncer: a giant elite Bouncer halfway through each district, with the boss bar.
  spawnMiniBoss(at) {
    this.spawnZombie('brute', at || this.spawnPoint('brute', true));
    const z = this.zombies[this.zombies.length - 1];
    z.elite = true;
    z.sc = 1.55;
    z.hp = z.max = z.max * 8 * (1 + COOP_BOSS_HP * (this.players.length - 1));
    z.dmg *= 1.4;
    z.speed *= 1.15;
    this.boss = z;
    this.banner = { kind: 'boss', t: 2.8, dur: 2.8, mini: true };
    this.snd('bossRoar');
  }

  // The Jackpot zombie: a gold-plated Raver carrying the party's prize money. It flees, and it gets
  // away if nobody drops it in time.
  spawnJackpot() {
    const s = this.spawnPoint('runner', true);
    this.spawnZombie('runner', s);
    const z = this.zombies[this.zombies.length - 1];
    z.gold = true;
    z.hp = z.max = z.max * 3;
    z.escT = JACKPOT_T;
    z.speed = Math.max(z.speed, 3.4);
    this.lv.total++;
    this.toast('JACKPOT ZOMBIE!', 'Gold one on the loose. Drop it before it gets away!');
    this.snd('jackpotSpot');
  }

  // Where a new zombie comes in: usually a map spawn that is out of reach but not across the map,
  // and often a patch of open street just out of sight around the party, so the horde closes in
  // from every side instead of trickling out of the corners.
  spawnPoint(kind, near = false) {
    const up = this.alive();
    const nearest = (s) => Math.min(...up.map((P) => Math.hypot(s.x - P.x, s.y - P.y)));
    if (kind !== 'boss' && up.length && (near || Math.random() < SPAWN_NEAR)) {
      for (let k = 0; k < (near ? 60 : 24); k++) {
        const P = pickOne(up);
        const a = P.a + Math.PI + rand(-1.9, 1.9);
        const d = rand(7, 11);
        const x = P.x + Math.cos(a) * d;
        const y = P.y + Math.sin(a) * d;
        if (x < 1 || y < 1 || x >= this.map.w - 1 || y >= this.map.h - 1) continue;
        if (this.blocked[Math.floor(y) * this.map.w + Math.floor(x)]) continue;
        if (this.flow[Math.floor(y) * this.map.w + Math.floor(x)] < 0) continue;
        if (nearest({ x, y }) < 6) continue;
        return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
      }
    }
    let pts = this.map.spawns.filter((s) => nearest(s) > 6);
    if (!pts.length) return this.map.spawns.slice().sort((a, b) => nearest(b) - nearest(a))[0];
    // Weight the closer ones: across the map is a long, empty walk.
    pts.sort((a, b) => nearest(a) - nearest(b));
    return pts[Math.min(pts.length - 1, Math.floor(Math.random() * Math.random() * pts.length))];
  }

  // One flow field toward whichever standing player is closest; rebuilt when anyone changes cell.
  updateFlow() {
    const m = this.map;
    const cells = this.alive().map((P) => Math.floor(P.y) * m.w + Math.floor(P.x));
    const key = cells.join(',');
    if (key === this.flowKey) return;
    this.flowKey = key;
    const dist = this.flow;
    dist.fill(-1);
    const q = this.flowQ;
    let head = 0;
    let tail = 0;
    for (const c of cells) {
      if (c < 0 || c >= dist.length || dist[c] === 0) continue;
      dist[c] = 0;
      q[tail++] = c;
    }
    while (head < tail) {
      const c = q[head++];
      const cx = c % m.w;
      const cy = (c / m.w) | 0;
      const nd = dist[c] + 1;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const ni = ny * m.w + nx;
        if (this.blocked[ni] || dist[ni] >= 0) continue;
        dist[ni] = nd;
        q[tail++] = ni;
      }
    }
  }

  nearestPlayer(x, y) {
    let best = null;
    let bd = Infinity;
    for (const P of this.players) {
      if (P.down) continue;
      const d = Math.hypot(P.x - x, P.y - y);
      if (d < bd) {
        bd = d;
        best = P;
      }
    }
    return best;
  }

  updateZombies(dt) {
    const m = this.map;
    const frz = this.buffs.freeze > 0 ? 0.3 : 1;
    for (const z of this.zombies) {
      z.anim += dt * frz * (z.kind === 'runner' ? 7 : z.kind === 'boss' ? 4 : z.kind === 'crawler' ? 6 : z.kind === 'bloater' ? 3 : 4.2) * (z.spawnT > 0 ? 0 : 1);
      z.hurtT = Math.max(0, z.hurtT - dt);
      z.spawnT = Math.max(0, z.spawnT - dt);
      if (z.infected) {
        const I = z.infected;
        I.t -= dt;
        if (Math.random() < dt * 8) this.particles.push({ x: z.x + rand(-0.2, 0.2), y: z.y + rand(-0.2, 0.2), z: rand(0.4, ZHEIGHT[z.kind]), vx: 0, vy: 0, vz: 0.6, life: 0.4, color: '#e8344e', float: true });
        if (I.t <= 0) z.infected = null;
        else {
          const hz = z.hurtT;
          this.hurtZombie(z, I.dps * dt, 0, 0, 0, I.P, 'chain');
          z.hurtT = hz;
          if (z.dead) continue;
        }
      }
      z.cd = Math.max(0, z.cd - dt);
      const P = this.nearestPlayer(z.x, z.y);
      if (!P) continue;
      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = rand(4, 12);
        if (Math.hypot(z.x - P.x, z.y - P.y) < 8) this.snd('groan');
      }
      const tx = P.x - z.x;
      const ty = P.y - z.y;
      const dist = Math.hypot(tx, ty);
      if (z.gold) {
        z.escT -= dt;
        if (Math.random() < dt * 20) this.particles.push({ x: z.x + rand(-0.25, 0.25), y: z.y + rand(-0.25, 0.25), z: rand(0.2, 1.1), vx: 0, vy: 0, vz: rand(0.3, 1), life: 0.5, color: Math.random() < 0.5 ? '#f6c945' : '#fff4d6', float: true });
        if (z.escT <= 0) {
          // Got away: gone in a puff of static, prize and all.
          this.fx('jackpot', r2(z.x), r2(z.y), 0);
          this.toast('IT GOT AWAY', 'The Jackpot zombie escaped.');
          z.dead = true;
          this.zombies.splice(this.zombies.indexOf(z), 1);
          this.lv.total--;
          continue;
        }
      }
      const r = ZRAD[z.kind];

      // Steering: straight at the player when close, otherwise down the flow field.
      let gx = tx;
      let gy = ty;
      if (dist > 2.2) {
        const cx = Math.floor(z.x);
        const cy = Math.floor(z.y);
        let best = this.flow[cy * m.w + cx];
        let bx = -1;
        let by = -1;
        for (const [ox, oy] of NEIGH8) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
          if (ox && oy && (this.blocked[cy * m.w + nx] || this.blocked[ny * m.w + cx])) continue;
          const d = this.flow[ny * m.w + nx];
          if (d >= 0 && (best < 0 || d < best)) {
            best = d;
            bx = nx;
            by = ny;
          }
        }
        if (bx >= 0) {
          gx = bx + 0.5 - z.x;
          gy = by + 0.5 - z.y;
        }
      }
      const gm = Math.hypot(gx, gy) || 1;
      gx /= gm;
      gy /= gm;
      // Unstick: barely moved for a while, so sidestep for a moment.
      z.stuckT = (z.stuckT || 0) + dt;
      if (z.stuckT > 1) {
        if (Math.hypot(z.x - (z.lx ?? z.x + 1), z.y - (z.ly ?? 0)) < 0.15 && z.state === 'walk' && dist > 1.5) z.sideT = 0.7;
        z.lx = z.x;
        z.ly = z.y;
        z.stuckT = 0;
        z.side = Math.random() < 0.5 ? 1 : -1;
      }
      if (z.sideT > 0) {
        z.sideT -= dt;
        const sgx = -gy * z.side;
        const sgy = gx * z.side;
        gx = sgx;
        gy = sgy;
      }
      if (z.kind === 'runner' || z.kind === 'shambler') {
        const w = Math.sin(this.t * (z.kind === 'runner' ? 5 : 1.5) + z.wob) * (z.kind === 'runner' ? 0.35 : 0.2);
        const ngx = gx - gy * w;
        const ngy = gy + gx * w;
        gx = ngx;
        gy = ngy;
      }

      // A straggler that has neither hurt anyone nor been hurt for a while (wedged behind a rack, or
      // lost across the map) walks back in from nearby, so a wave can never stall.
      if (this.lv.phase === 'wave' && !this.lv.queue.length && z.kind !== 'boss' && z.hurtT <= 0 && z.state === 'walk') {
        z.farT = (z.farT || 0) + dt;
        if (z.farT > (dist > 9 ? 6 : 9)) {
          const s = this.spawnPoint(z.kind, true);
          z.x = s.x;
          z.y = s.y;
          z.farT = 0;
          z.spawnT = 0.6;
          this.fx('spawn', r2(z.x), r2(z.y));
        }
      } else z.farT = 0;
      if (z.gold && dist < 9) {
        // Run from whoever is closest, sliding along walls rather than into them.
        let fx = -tx / (dist || 1);
        let fy = -ty / (dist || 1);
        if (this.wallAt(z.x + fx * 0.8, z.y + fy * 0.8)) {
          const side = z.wob > Math.PI ? 1 : -1;
          const nx = -fy * side;
          const ny = fx * side;
          fx = this.wallAt(z.x + nx * 0.8, z.y + ny * 0.8) ? -nx : nx;
          fy = this.wallAt(z.x + nx * 0.8, z.y + ny * 0.8) ? -ny : ny;
        }
        gx = fx;
        gy = fy;
      }
      let speed = z.speed * frz;
      // Slip 'n Slide: soaked zombies wade.
      if (z.slowT > 0) {
        z.slowT -= dt;
        speed *= 0.6;
      }
      // Spitters hang back at range once they can see you.
      if (z.spitT != null && dist < 6.5 && dist > 2) speed *= 0.15;
      // The last few of a wave stop dawdling and come find you, so a wave never ends in a search.
      if (this.lv.phase === 'wave' && !this.lv.queue.length && this.zombies.length <= STRAGGLERS && z.kind !== 'boss') speed *= 1.7;
      if (z.spawnT > 0) speed = 0;
      if (z.state === 'attack') speed *= 0.15;

      // Bosses run their own move set. One that nobody has managed to hurt for a long while
      // (lost behind the scenery) blinks back into the fight.
      if (z.kind === 'boss' && !z.bs && this.t - (z.hitAt ?? this.t) > 25 && z.spawnT <= 0) {
        const s = this.spawnPoint('shambler', true);
        this.fx('blink', r2(z.x), r2(z.y));
        z.x = s.x;
        z.y = s.y;
        z.hitAt = this.t;
        this.fx('blink', r2(z.x), r2(z.y));
      }
      if (z.kind === 'boss') {
        const o = this.updateBoss(z, P, dist, tx, ty, dt);
        if (o.speed != null) speed = o.speed * frz;
        if (o.gx != null) {
          gx = o.gx;
          gy = o.gy;
        }
      }

      // Corrupted: blink toward the player through static.
      if (z.kind === 'glitch' && z.spawnT <= 0) {
        z.blinkT -= dt;
        if (z.blinkT <= 0) {
          z.blinkT = rand(2, 3.5);
          if (dist > 2.5) {
            const nx = z.x + gx * 1.6;
            const ny = z.y + gy * 1.6;
            if (!this.wallAt(nx, ny) && !this.blocked[Math.floor(ny) * m.w + Math.floor(nx)]) {
              this.fx('blink', r2(z.x), r2(z.y));
              z.x = nx;
              z.y = ny;
              z.warp = true;
            }
          }
        }
      }

      z.kx *= Math.max(0, 1 - 7 * dt);
      z.ky *= Math.max(0, 1 - 7 * dt);
      this.moveCircle(z, (gx * speed + z.kx) * dt, (gy * speed + z.ky) * dt, (z.bs ? 0.3 : r) * 0.9, !z.bs);

      // Spitters stop at range and lob a glitch packet at you.
      if (z.spitT != null && z.state === 'walk' && z.spawnT <= 0) {
        z.spitT -= dt * frz;
        if (z.spitT <= 0 && dist > 2.5 && dist < 10 && P.z < 1 && this.wallDistance(z.x, z.y, Math.atan2(ty, tx), dist) >= dist - 0.3) {
          const a = Math.atan2(ty, tx);
          this.bolts.push({ x: z.x + Math.cos(a) * 0.5, y: z.y + Math.sin(a) * 0.5, z: 0.9, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, life: 2.2, dmg: z.dmg * 0.55, c: 2, ox: z.x, oy: z.y });
          z.spitT = rand(2.6, 4.2);
          z.state = 'attack';
          z.atkT = 0.3;
          z.spat = true;
          this.snd('shoot', 'glitch');
        } else if (z.spitT <= 0) z.spitT = 0.4;
      }

      // Attacks.
      const reach = r + 0.45;
      if (z.state === 'walk' && z.kind !== 'boss' && dist < reach && z.cd <= 0 && z.spawnT <= 0) {
        z.state = 'attack';
        z.atkT = 0.35;
      }
      if (z.kind === 'boss' && !z.bs && dist < reach + 0.2 && z.cd <= 0) {
        z.cd = 1;
        if (P.z < 0.35) this.hurtPlayer(P, z.dmg, z.x, z.y);
      }
      if (z.state === 'attack') {
        z.atkT -= dt;
        if (z.atkT <= 0) {
          z.state = 'walk';
          z.cd = 0.9;
          const spat = z.spat;
          z.spat = false;
          if (!spat && dist < r + 0.75 && P.z < 0.3) {
            this.hurtPlayer(P, z.dmg, z.x, z.y);
            // Firewall: whatever bit you gets a jolt and a shove.
            if (P.mods.firewall && !P.down) {
              this.fx('zap', r2(P.x), r2(P.y), 0.5, r2(z.x), r2(z.y), r2(ZHEIGHT[z.kind] * 0.6));
              this.hurtZombie(z, P.mods.firewall * (1 + this.levelN * 0.03), -tx / (dist || 1), -ty / (dist || 1), 2.2, P, 'chain');
              if (z.dead) continue;
            }
          }
        }
      }
      // Keep out of the player's body.
      if (!z.bs && dist < r + 0.26 && dist > 0.001) {
        const push = (r + 0.26 - dist) / dist;
        this.moveCircle(z, -tx * push, -ty * push, r * 0.9);
      }
    }
    // Separate the horde.
    const zs = this.zombies;
    for (let i = 0; i < zs.length; i++) {
      for (let j = i + 1; j < zs.length; j++) {
        const a = zs[i];
        const b = zs[j];
        if (a.bs || b.bs) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (ZRAD[a.kind] + ZRAD[b.kind]) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) / d;
          const ma = ZMASS[a.kind];
          const mb = ZMASS[b.kind];
          const fa = mb / (ma + mb);
          const fb = ma / (ma + mb);
          this.moveCircle(a, -dx * push * fa, -dy * push * fa, ZRAD[a.kind] * 0.9);
          this.moveCircle(b, dx * push * fb, dy * push * fb, ZRAD[b.kind] * 0.9);
        }
      }
    }
  }

  // ------------------------------------------------------------ bosses
  // One step of a boss's move set. Returns overrides for its speed and heading this frame.
  // Only one move winds up at a time; below half health every timer runs faster.
  updateBoss(z, P, dist, tx, ty, dt) {
    const B = this.bossDef;
    const enraged = z.hp < z.max * 0.5;
    const rate = enraged ? 1.45 : 1;
    const out = {};
    if (z.spawnT > 0) return out;
    // Bull rush in progress.
    if (z.chargeLeft > 0) {
      z.chargeLeft -= dt;
      if (Math.random() < 0.5) this.puff(z.x, z.y, 0.1, '#d8cfb4', 1);
      return { speed: z.speed * 3.4, gx: z.cdx, gy: z.cdy };
    }
    // Under the street: rush toward the nearest player, then surface beneath them.
    if (z.bs === 1) {
      z.burT -= dt;
      if (Math.random() < 0.7) this.puff(z.x + rand(-0.4, 0.4), z.y + rand(-0.4, 0.4), 0.05, '#6a5a44', 1);
      if (dist < 0.6 || z.burT <= 0) {
        z.bs = 2;
        z.emT = 0.85;
        this.snd('rumble');
      }
      // Tunnels straight at them under props and parked cars; round walls by the flow field.
      const clear = this.wallDistance(z.x, z.y, Math.atan2(ty, tx), dist) >= dist - 0.05;
      return clear ? { speed: z.speed * 2.3, gx: tx / (dist || 1), gy: ty / (dist || 1) } : { speed: z.speed * 2.3 };
    }
    if (z.bs === 2) {
      z.emT -= dt;
      if (z.emT <= 0) this.erupt(z);
      return { speed: 0 };
    }
    // A telegraphed move is winding up: stand still, then let it go.
    if (z.state === 'windup') {
      z.atkT -= dt;
      if (z.atkT <= 0) {
        z.state = 'walk';
        this.bossMove(z, z.wind, P, dist, tx, ty, enraged);
      }
      return { speed: 0 };
    }
    // Trailing extra shockwaves.
    if (z.ringQ > 0) {
      z.ringT -= dt;
      if (z.ringT <= 0) {
        z.ringQ--;
        z.ringT = 0.45;
        this.ring(z);
      }
    }
    for (const m of B.moves) {
      z.ab[m] -= dt * rate;
    }
    const ready = B.moves.filter((m) => z.ab[m] <= 0 && this.bossCan(z, m, dist));
    if (ready.length) {
      const m = ready[0];
      z.ab[m] = rand(...BOSS_CD[m]);
      // Push the other moves back a little so they don't stack up.
      for (const k of B.moves) if (k !== m) z.ab[k] = Math.max(z.ab[k], 1.2);
      const wind = { charge: 0.8, ring: 0.6, bolts: 0.55, summon: 0.7, blink: 0.35, burrow: 0.5 }[m];
      z.state = 'windup';
      z.wind = m;
      z.atkT = wind;
      if (m === 'charge' || m === 'ring' || m === 'summon') this.snd('bossRoar');
      if (m === 'bolts') this.snd('charge');
      return { speed: 0 };
    }
    return out;
  }

  bossCan(z, m, dist) {
    if (m === 'charge') return dist < 10;
    if (m === 'ring') return dist < 11;
    if (m === 'bolts') return dist < 14 && dist > 1.5;
    if (m === 'burrow') return dist > 1.4;
    if (m === 'summon') return this.zombies.length < this.maxAlive() + 4;
    if (m === 'blink') return dist < 3 || dist > 9;
    return true;
  }

  bossMove(z, m, P, dist, tx, ty, enraged) {
    const B = this.bossDef;
    if (m === 'charge') {
      z.chargeLeft = 1.0;
      z.cdx = tx / (dist || 1);
      z.cdy = ty / (dist || 1);
      this.fx('shake', 0.3);
    } else if (m === 'ring') {
      this.ring(z);
      z.ringQ = (B.id === 'frontman' ? 1 : 0) + (enraged ? 1 : 0);
      z.ringT = 0.45;
    } else if (m === 'bolts') {
      const n = enraged ? 7 : 5;
      const a0 = Math.atan2(ty, tx);
      const spread = enraged ? 0.2 : 0.26;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * spread;
        this.bolts.push({ x: z.x + Math.cos(a) * 0.9, y: z.y + Math.sin(a) * 0.9, z: 0.75, vx: Math.cos(a) * 5.2, vy: Math.sin(a) * 5.2, life: 3.2, dmg: z.dmg * 0.28, c: i % 2 });
      }
      this.snd('zap');
    } else if (m === 'summon') {
      const kind = B.summon || 'shambler';
      const n = kind === 'crawler' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.3, 0.3);
        const x = z.x + Math.cos(a) * 1.3;
        const y = z.y + Math.sin(a) * 1.3;
        if (!this.wallAt(x, y)) this.spawnZombie(kind, { x, y });
      }
      const call = { runner: ['BACKUP DANCERS!', 'The Frontman called his crew'], crawler: ['MIND THE GAP', 'Crawlers from the tracks'], glitch: ['SPAWNING PROCESSES', 'Corrupted inbound'] }[kind];
      if (call) this.toast(call[0], call[1]);
    } else if (m === 'blink') {
      // Reappear somewhere open a few steps from the player.
      for (let k = 0; k < 12; k++) {
        const a = rand(0, TAU);
        const r = rand(3.5, 6);
        const x = P.x + Math.cos(a) * r;
        const y = P.y + Math.sin(a) * r;
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (this.wallAt(x, y) || this.blocked[cy * this.map.w + cx] || this.flow[cy * this.map.w + cx] < 0) continue;
        this.fx('blink', r2(z.x), r2(z.y));
        z.x = x;
        z.y = y;
        z.warp = true;
        this.fx('blink', r2(x), r2(y));
        break;
      }
    } else if (m === 'burrow') {
      z.bs = 1;
      z.burT = 2.6;
      this.fx('dig', r2(z.x), r2(z.y));
    }
  }

  // A shockwave rolling out along the floor from the boss. Jump it, dash through it, or eat it.
  ring(z) {
    this.rings.push({ x: r2(z.x), y: r2(z.y), r: ZRAD.boss, v: 5.2, max: 12, dmg: z.dmg * 0.42, hit: [] });
    this.snd('boom');
    this.fx('shake', 0.25);
  }

  // Burrowing boss bursts up out of the street.
  erupt(z) {
    z.bs = 0;
    z.cd = 0.8;
    this.fx('erupt', r2(z.x), r2(z.y));
    for (const Q of this.players) {
      const d = Math.hypot(Q.x - z.x, Q.y - z.y);
      if (Q.down || d > 2.1) continue;
      if (Q.z < 0.5) this.hurtPlayer(Q, z.dmg * (1.3 - d * 0.3));
      if (!Q.remote) {
        Q.vx += ((Q.x - z.x) / (d || 1)) * 5;
        Q.vy += ((Q.y - z.y) / (d || 1)) * 5;
      }
    }
    const kind = this.bossDef.summon;
    if (kind && this.zombies.length < this.maxAlive() + 4) {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, TAU);
        const x = z.x + Math.cos(a) * 1.4;
        const y = z.y + Math.sin(a) * 1.4;
        if (!this.wallAt(x, y)) this.spawnZombie(kind, { x, y });
      }
    }
  }

  // Shockwaves and packets fired by bosses.
  updateHazards(dt) {
    for (const g of this.rings) {
      g.r += g.v * dt;
      for (const Q of this.players) {
        if (Q.down || g.hit.includes(Q.idx)) continue;
        const d = Math.hypot(Q.x - g.x, Q.y - g.y);
        if (Math.abs(d - g.r) < 0.35 && Q.z < 0.3) {
          g.hit.push(Q.idx);
          this.hurtPlayer(Q, g.dmg);
        }
      }
    }
    this.rings = this.rings.filter((g) => g.r < g.max);
    for (const b of this.bolts) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (this.wallAt(b.x, b.y)) {
        b.life = 0;
        this.puff(b.x - b.vx * dt, b.y - b.vy * dt, b.z, '#3de0e0', 4);
        continue;
      }
      for (const Q of this.players) {
        if (Q.down || Q.z > 1.1) continue;
        if (Math.hypot(Q.x - b.x, Q.y - b.y) < 0.38) {
          this.hurtPlayer(Q, b.dmg, b.ox ?? b.x - b.vx, b.oy ?? b.y - b.vy);
          b.life = 0;
          this.puff(b.x, b.y, b.z, '#ff3b3b', 5);
          break;
        }
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  fx_dig(x, y) {
    sfx.stomp();
    this.shake = Math.min(1, this.shake + 0.3);
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU);
      const s = rand(1, 3);
      this.particles.push({ x, y, z: 0.1, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(1, 3), life: rand(0.4, 0.8), color: i % 3 ? '#6a5a44' : '#a89878' });
    }
  }

  fx_erupt(x, y) {
    sfx.explode();
    this.shake = 1;
    this.flash = { color: '#a89878', t: 0.15, amt: 0.3 };
    this.splats.push({ x, y, t: 14, big: true, rot: rand(0, TAU) });
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU);
      const s = rand(1.5, 5);
      this.particles.push({ x, y, z: 0.1, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(2, 5), life: rand(0.5, 1.1), color: i % 3 === 0 ? '#e8e2c8' : i % 3 === 1 ? '#6a5a44' : '#a89878' });
    }
  }

  hurtZombie(z, dmg, nx, ny, knock, P = this.player, zone = 'body') {
    if (z.dead || z.bs) return;
    if (zone === 'head') dmg *= HEAD_MUL * P.mods.head;
    else if (zone === 'legs') dmg *= LEG_MUL;
    if (this.cheats.onehit && dmg > 0) dmg = z.kind === 'boss' ? dmg * 8 : 1e6;
    // Lucky Pager: now and then a hit lands three times as hard.
    if (P.mods.crit && dmg > 0 && Math.random() < P.mods.crit) {
      dmg *= 3;
      if (this.t - (P.critAt || -1) > 0.5) {
        P.critAt = this.t;
        this.fx('popup', r2(z.x), r2(z.y), r2(ZHEIGHT[z.kind] * (z.sc || 1) + 0.1), 'CRIT!', true);
      }
    }
    // Dial-Up Chain: the hit jumps to the next zombie over (not more than a few times a second).
    if (P.mods.chain && zone !== 'chain' && dmg > 2 && this.t - (P.chainAt || -1) > 0.12 && Math.random() < P.mods.chain) {
      P.chainAt = this.t;
      let o = null;
      let od = 3.2;
      for (const c of this.zombies) {
        if (c === z || c.bs) continue;
        const d = Math.hypot(c.x - z.x, c.y - z.y);
        if (d < od) {
          od = d;
          o = c;
        }
      }
      if (o) {
        this.fx('zap', r2(z.x), r2(z.y), r2(ZHEIGHT[z.kind] * 0.6), r2(o.x), r2(o.y), r2(ZHEIGHT[o.kind] * 0.6));
        const zd = Math.max(12, dmg * 0.6);
        this.pendingZaps = this.pendingZaps || [];
        this.pendingZaps.push([o, zd, P]);
      }
    }
    z.hp -= dmg * P.dmgMul;
    z.hurtT = 0.08;
    z.hitAt = this.t;
    if (this.isLocal(P)) {
      this.hitT = 0.12;
      if (zone === 'head') {
        if (this.headT <= 0.02) sfx.headTick();
        this.headT = 0.15;
      }
    }
    const k = (knock * 6) / ZMASS[z.kind];
    z.kx += nx * k;
    z.ky += ny * k;
    if (dmg > 3) this.snd('hit');
    if (z.hp <= 0) this.killZombie(z, P, zone === 'head', nx, ny);
    // Chain zaps land after the hit that caused them, so a kill never happens mid-loop twice.
    if (this.pendingZaps?.length && zone !== 'chain') {
      const zaps = this.pendingZaps.splice(0);
      for (const [o, zd, Q] of zaps) if (!o.dead) this.hurtZombie(o, zd, 0, 0, 0.3, Q, 'chain');
    }
  }

  killZombie(z, P = this.player, head = false, nx = 0, ny = 0) {
    z.dead = true;
    this.zombies.splice(this.zombies.indexOf(z), 1);
    const base = ENEMIES[z.kind];
    const C = this.combo;
    C.n = C.t > 0 ? C.n + 1 : 1;
    C.t = COMBO_WINDOW + P.mods.combo;
    this.lv.bestCombo = Math.max(this.lv.bestCombo, C.n);
    if (C.n === OVERDRIVE_AT) {
      this.fx('overdrive');
      this.emit('overdrive');
    }
    const mult = comboMult(C.n);
    // Headshot kills are worth half again, in score and XP.
    const hs = (head ? 1.5 : 1) * (z.affix ? 1.5 : 1);
    const gain = Math.round(base.score * (1 + Math.floor(this.levelN / 10)) * mult * hs);
    this.score += gain;
    this.fx('popup', r2(z.x), r2(z.y), r2(ZHEIGHT[z.kind] * 0.8), `+${gain}`, mult > 1);
    if (head) {
      this.fx('popup', r2(z.x), r2(z.y), r2(ZHEIGHT[z.kind] * (z.sc || 1) + 0.25), 'HEADSHOT!', true);
      this.lv.headshots = (this.lv.headshots || 0) + 1;
    }
    const call = COMBO_CALLS.find((c) => c.n === C.n);
    if (call) {
      this.comboCall = { text: call.text, mult, t: 1.6 };
      this.snd('combo', COMBO_CALLS.indexOf(call));
    }
    this.lv.kills++;
    // The killer gets full XP and meter; teammates get half.
    for (const Q of this.players) {
      const share = Q === P ? 1 : 0.5;
      this.gainXp(Q, base.score * share * hs);
      if (!Q.down && !Q.spKind) this.chargeSpecial(Q, base.score * SP_PER_SCORE * share);
    }
    if (P.mods.leech && !P.down) P.hp = Math.min(P.maxHp, P.hp + P.mods.leech);
    if (head) this.fx('headshot', z.kind, r2(z.x), r2(z.y), z.look, z.sc, r2(nx), r2(ny));
    else this.fx('death', z.kind, r2(z.x), r2(z.y), z.look, z.sc);
    if (z.kind === 'bloater') this.pop(z, P);
    if (z.gold) {
      const prize = 250 * (1 + Math.floor(this.levelN / 5));
      this.score += prize;
      this.fx('jackpot', r2(z.x), r2(z.y), 1);
      this.fx('popup', r2(z.x), r2(z.y), 1.4, `JACKPOT +${prize}`, true);
      for (const k of ['health', 'armor', pickOne(['patch', 'multi', 'freeze', 'cad'])]) this.dropPickup(z.x + rand(-0.7, 0.7), z.y + rand(-0.7, 0.7), k);
      for (const Q of this.alive()) this.chargeSpecial(Q, 35);
      this.lv.jackpots = (this.lv.jackpots || 0) + 1;
      this.emit('jackpot');
    }
    // Millennium Bomb: the kill goes off like a firework and takes the crowd with it.
    if (P.mods.boom && Math.random() < P.mods.boom) this.blast(z.x, z.y, 1.9, 40 + this.levelN * 1.5, P);
    // ILOVEYOU.VBS: the kill infects zombies nearby; they sicken, glow and take damage over time.
    if (P.mods.virus) {
      let n = 0;
      for (const o of this.zombies) {
        if (o.bs || o.infected || Math.hypot(o.x - z.x, o.y - z.y) > 2.4) continue;
        o.infected = { t: 3, dps: (10 + this.levelN * 0.6) * P.mods.virus, P };
        if (++n >= 2 + P.mods.virus) break;
      }
      if (n) this.fx('infect', r2(z.x), r2(z.y));
    }
    if (z.kind === 'boss' || z.elite) {
      this.boss = this.zombies.find((o) => o !== z && (o.kind === 'boss' || o.elite)) || null;
      for (const k of ['health', 'armor', 'overclock']) this.dropPickup(z.x + rand(-0.8, 0.8), z.y + rand(-0.8, 0.8), k);
      this.emit('bossDown');
      return;
    }
    const roll = Math.random();
    const weak = this.players.some((Q) => !Q.down && Q.hp < Q.maxHp / 2);
    if (roll < (weak ? 0.09 : 0.04)) this.dropPickup(z.x, z.y, 'health');
    else if (roll < 0.115) this.dropPickup(z.x, z.y, 'armor');
    else if (roll < 0.14) this.dropPickup(z.x, z.y, 'overclock');
    else if (roll < 0.14 + 0.025 * Math.max(...this.players.map((Q) => Q.mods.luck)) + (z.kind === 'brute' ? 0.25 : 0) + (this.event === 'supply' ? 0.12 : 0)) this.dropPickup(z.x, z.y, pickOne(['patch', 'multi', 'freeze', 'multi', 'patch', 'cad', 'zip', 'zip']));
    // Melee weapons: Bouncers are carrying, and now and then anyone else is.
    else if (Math.random() < (z.kind === 'brute' ? 0.45 : z.affix === 3 ? 0.2 : 0.025) && this.pickups.filter((q) => MELEE[q.kind]).length < 2) this.dropPickup(z.x, z.y, pickOne(MELEE_KINDS));
  }

  gainXp(P, n) {
    P.xp += n;
    const r = Math.min(99, rankFor(P.xp));
    if (r > P.rank) {
      P.rank = r;
      P.dmgMul = dmgMulFor(r) * P.mods.dmg;
      if (this.isLocal(P)) this.celebrateRank(r);
    }
  }

  celebrateRank(r) {
    this.player.lvlUp = { rank: r, t: 2.2 };
    this.flash = { color: '#f6c945', t: 0.15, amt: 0.25 };
    sfx.levelUp();
    this.emit('levelup', { rank: r });
  }

  xpProgress() {
    const P = this.player;
    const a = xpForRank(P.rank);
    const b = xpForRank(P.rank + 1);
    return Math.min(1, (P.xp - a) / Math.max(1, b - a));
  }

  // Ctrl+Alt+Del: end every zombie in sight of whoever grabbed it. Bosses only take a chunk.
  nuke(P) {
    for (const z of this.zombies.slice()) {
      if (Math.hypot(z.x - P.x, z.y - P.y) > 14) continue;
      if (z.kind === 'boss') this.hurtZombie(z, (z.max * 0.15) / P.dmgMul, 0, 0, 0, P);
      else this.hurtZombie(z, 99999, 0, 0, 0, P);
    }
    this.fx('nuke');
  }

  dropPickup(x, y, kind) {
    if (this.wallAt(x, y)) return;
    this.pickups.push({ kind, x, y, t: 14, ph: r2(rand(0, TAU)) });
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      for (const P of this.players) {
        if (P.down || Math.hypot(p.x - P.x, p.y - P.y) >= P.mods.reach || P.z >= 0.8) continue;
        if (p.kind === 'health') {
          if (P.hp >= P.maxHp) continue;
          P.hp = Math.min(P.maxHp, P.hp + 30);
          this.personal(P, 'flash', '#ff6aa0', 0.12, 0.2);
          this.personal(P, 'toast', '+30 HEALTH', 'Volt Cola');
        } else if (p.kind === 'armor') {
          P.armor = Math.min(100, P.armor + 50);
          this.personal(P, 'flash', '#f6c945', 0.12, 0.2);
          this.personal(P, 'toast', '+50 ARMOR', 'Y2K compliant');
        } else if (p.kind === 'overclock') {
          P.overclock = 10 * P.mods.buff;
          this.personal(P, 'flash', '#3de0e0', 0.12, 0.2);
          this.personal(P, 'toast', 'OVERCLOCKED', '10 seconds of turbo');
        } else if (p.kind === 'patch') {
          this.buffs.patch = 8 * P.mods.buff;
          this.toast('Y2K PATCH INSTALLED', 'Invincible for 8 seconds');
          this.fx('flash', '#7ac943', 0.15, 0.25);
        } else if (p.kind === 'multi') {
          this.buffs.multi = 10 * P.mods.buff;
          this.toast('MULTITASKING', 'Triple shot for 10 seconds');
          this.fx('flash', '#ff8a2a', 0.12, 0.2);
        } else if (p.kind === 'freeze') {
          this.buffs.freeze = 7 * P.mods.buff;
          this.toast('SCREENSAVER ON', 'The horde slows to a crawl');
          this.fx('flash', '#8fd8ff', 0.2, 0.3);
        } else if (p.kind === 'cad') {
          this.toast('CTRL+ALT+DEL', 'End task: everything');
          this.nuke(P);
        } else if (p.kind === 'zip') {
          // Zip Disk: everyone's weapon topped up, and a few seconds of never running out.
          for (const Q of this.players) {
            if (Q.down) continue;
            const QG = Q.hero.gun;
            if (QG.mag) Q.ammo = QG.mag;
            Q.reloadT = 0;
            if (QG.tank) Q.tank = QG.tank;
            Q.heat = 0;
            Q.overheated = false;
            Q.zipT = ZIP_T * P.mods.buff;
          }
          this.toast('ZIP DISK: 100 MB', `Bottomless ammo for ${Math.round(ZIP_T * P.mods.buff)} seconds`);
          this.fx('flash', '#b89cff', 0.12, 0.2);
        } else if (MELEE[p.kind]) {
          // Melee weapons: grab one if your hands are free, it's the same kind, or yours is nearly done.
          const M = MELEE[p.kind];
          if (P.melee && P.melee.kind !== p.kind && P.melee.uses > MELEE[P.melee.kind].uses * 0.34) continue;
          P.melee = { kind: p.kind, uses: M.uses };
          // Straight into your hand so you notice (guests switch themselves when the snapshot says so).
          if (!P.remote) this.equip(P, 1);
          this.personal(P, 'flash', '#f6c945', 0.1, 0.18);
          this.personal(P, 'toast', M.name, M.tip);
        }
        this.snd('pickup');
        this.pickups.splice(i, 1);
        break;
      }
    }
  }

  fx_waveClear(n, last) {
    sfx.waveClear(!!last);
    this.flash = { color: '#f6c945', t: 0.25, amt: 0.3 };
    this.shake = Math.min(1, this.shake + 0.2);
    // Confetti rains down around this player.
    const P = this.player;
    for (let i = 0; i < 160; i++) {
      const a = rand(0, TAU);
      const r = rand(0.5, 5);
      this.particles.push({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, z: rand(1.6, 3.2), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(-0.4, 0.4), life: rand(1.4, 2.6), color: PARTY[i % PARTY.length], float: true, fall: true });
    }
  }

  fx_flash(color, t, amt) {
    this.flash = { color, t, amt };
  }

  // A tray tooltip for the whole party. Pickups for one player use personal(P, 'toast', ...).
  toast(title, sub) {
    this.fx('toast', title, sub);
  }

  fx_toast(title, sub) {
    this.toastMsg = { title, sub, t: 2.2 };
  }

  // Waves grow with the party: each extra player brings more of the horde.
  startWave(i) {
    const L = this.lv;
    L.wave = i;
    if (this.endless) {
      // Endless: build the next wave on demand and turn the difficulty up.
      if (!this.cfg.waves[i]) this.cfg.waves[i] = this.cfg.makeWave(i);
      Object.assign(this.cfg, scaleFor(this.cfg.diff(i)));
    }
    const base = this.cfg.waves[i];
    const q = base.slice();
    const extra = Math.round(base.length * (COOP_WAVE * (this.players.length - 1) + (this.cheats.swarm ? 0.5 : 0) + this.diff.count - 1));
    for (let k = 0; k < extra; k++) {
      const pick = base[Math.floor(Math.random() * base.length)];
      q.splice(Math.floor(q.length * (0.3 + Math.random() * 0.7)), 0, pick === 'boss' ? 'brute' : pick);
    }
    L.queue = q;
    L.total = q.length;
    L.phase = 'wave';
    L.spawnT = 0.3;
    L.shown = 0;
    this.banner = { kind: 'wave', t: 2, dur: 2 };
    this.snd('countdown', 0);
    this.snd('wave');
    this.reviveAll();
  }

  maxAlive() {
    return Math.round(this.cfg.maxAlive * (1 + COOP_ALIVE * (this.players.length - 1)) * (this.cheats.swarm ? 1.5 : 1));
  }

  updateWaves(dt) {
    const L = this.lv;
    const cfg = this.cfg;
    // Story mode: the mission's objectives run the level instead of numbered waves.
    if (this.mission) return this.mission.update(dt);
    if (L.phase === 'done') return;
    if (L.phase === 'intro' || L.phase === 'break') {
      const was = Math.ceil(L.t);
      L.t -= dt;
      // Beep down the last three seconds of a break.
      if (L.phase === 'break' && Math.ceil(L.t) !== was && was <= 4 && was > 1) this.snd('countdown', was - 1);
      if (L.t <= 0) this.startWave(L.wave + 1);
      return;
    }
    if (L.phase === 'outro') {
      L.t -= dt;
      if (L.t <= 0) {
        L.phase = 'done';
        this.emit('clear');
      }
      return;
    }
    L.spawnT -= dt;
    // Once a level, from the second wave on, a golden Jackpot zombie turns up and runs for it.
    // Gold Rush: three of them, one after another from the first wave.
    if (this.jackpotsLeft > 0 && L.wave >= (this.event === 'gold' ? 0 : 1) && L.queue.length && this.t > (this.jackpotAt ??= this.t + rand(4, 14))) {
      this.jackpotsLeft--;
      this.jackpotAt = this.t + rand(12, 20);
      this.spawnJackpot();
    }
    if (L.queue.length && L.spawnT <= 0 && this.zombies.length < this.maxAlive()) {
      this.spawnZombie(L.queue.shift());
      L.spawnT = ((cfg.spawnEvery / 1000) * rand(0.6, 1.3)) / (1 + 0.3 * (this.players.length - 1));
    }
    if (!L.queue.length && !this.zombies.length) {
      // Wave cleared: a jingle, confetti and a score bonus, then either a live countdown to the next
      // wave or a short victory lap before the level-clear screen. Nothing pauses.
      const last = !this.endless && L.wave + 1 >= cfg.waves.length;
      const bonus = 100 * (this.endless ? 3 : L.wave + 1) * (1 + Math.floor((this.endless ? this.cfg.diff(L.wave) : this.levelN) / 10));
      this.score += bonus;
      this.fx('waveClear', L.wave + 1, last ? 1 : 0);
      this.banner = { kind: last ? 'final' : 'cleared', t: 2.6, dur: 2.6, wave: L.wave + 1, bonus };
      // Endless: every fifth wave (the boss waves) earns an upgrade pick.
      // Endless and the Daily offer an upgrade pick every third wave.
    if (this.endless && (L.wave + 1) % 3 === 0) this.emit('endlessPick', { wave: L.wave + 1 });
      for (const P of this.alive()) this.chargeSpecial(P, 10);
      if (!last) {
        L.phase = 'break';
        L.t = BREAK_T;
        for (const P of this.alive()) {
          if (P.hp < P.maxHp * 0.7) this.dropPickup(P.x + rand(-1, 1), P.y + rand(-1, 1), 'health');
          if (this.event === 'supply') this.dropPickup(P.x + rand(-1.5, 1.5), P.y + rand(-1.5, 1.5), pickOne(['patch', 'multi', 'freeze', 'cad']));
        }
      } else {
        L.phase = 'outro';
        L.t = OUTRO_T;
      }
    }
  }

  overdrive() {
    return this.combo.n >= OVERDRIVE_AT;
  }

  // The last few of a wave, once nothing else is coming: the HUD points at them.
  stragglers() {
    const L = this.lv;
    if (L.phase !== 'wave' || L.queue.length || this.zombies.length > STRAGGLERS) return [];
    return this.zombies.filter((z) => !z.bs);
  }

  remaining() {
    return this.lv.queue.length + this.zombies.length;
  }

  updateParticles(dt) {
    const out = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.fall) p.vz = -0.9 + Math.sin((p.life + p.x) * 6) * 0.3;
      else if (!p.float) p.vz -= 7 * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.5;
        p.vy *= 0.5;
      }
      out.push(p);
    }
    if (out.length > 1200) out.splice(0, out.length - 1200);
    this.particles = out;
  }

  // ------------------------------------------------------------ networking
  // Guests send their own movement; the host copies it onto that player.
  applyRemoteInput(i, s) {
    const P = this.players[i];
    if (!P) return;
    P.remote = true;
    if (!P.down) {
      [P.x, P.y, P.a, P.z] = s.p;
      P.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Number(s.p[4]) || 0));
      P.vx = s.v[0];
      P.vy = s.v[1];
      P.dashT = s.dash ? 0.1 : 0;
    }
    P.input = { move: { f: 0, s: 0 }, turn: 0, fire: !!s.fire, look: 0 };
    // Each guest owns which slot they have out.
    if (s.sl != null && !P.down) this.equip(P, s.sl ? 1 : 0);
  }

  remoteAct(i, kind, ...a) {
    const P = this.players[i];
    if (!P || P.down) return;
    if (kind === 'sp') this.special(P);
    if (kind === 'reload') this.startReload(P);
    if (kind === 'stomp' && P.hero.move.type === 'pogo') this.stomp(P, a[0], a[1]);
  }

  // Everything a guest needs to draw the level, compacted into arrays.
  snapshot() {
    const L = this.lv;
    const snap = {
      t: 'snap',
      p: this.players.map((P) => [r2(P.x), r2(P.y), r2(P.a), r2(P.z), Math.ceil(P.hp), Math.ceil(P.armor), P.down ? 1 : 0, Math.floor(P.sp), Math.floor(P.xp), r2(P.overclock), r2(P.tank), r2(P.heat), P.overheated ? 1 : 0, r2(P.fireCd), P.fireAnim > 0 ? 1 : 0, P.spKind ? 1 : 0, r2(P.iT), r2(P.pitch || 0), P.hand || 0, (P.candleN || 0) % 5, P.ammo || 0, r2(P.reloadT || 0), P.melee ? MELEE_KINDS.indexOf(P.melee.kind) + 1 : 0, P.melee ? P.melee.uses : 0, P.swingN || 0, r2(P.zipT || 0), P.slot || 0]),
      z: this.zombies.map((z) => [z.id, ZKINDS.indexOf(z.kind), r2(z.x), r2(z.y), r2(z.hp / z.max), ZSTATES.indexOf(z.state), r2(z.atkT), r2(z.anim), z.hurtT > 0 ? 1 : 0, r2(z.spawnT), z.look, z.sc, z.warp ? 1 : 0, z.bs || 0, z.gold ? 1 : 0, z.elite ? 1 : 0, z.affix || 0]),
      rg: this.rings.map((g) => [g.x, g.y, r2(g.r), g.v]),
      bo: this.bolts.map((b) => [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), b.c]),
      pr: this.projs.filter((p) => !p.fx || Math.random() < 0.5).map((p) => [PROJ_KINDS.indexOf(p.kind), r2(p.x), r2(p.y), r2(p.z), r2(p.spin || 0), p.hand ?? 0, p.o, p.orbit ? 1 : 0, p.candle ? 1 : 0]),
      pk: this.pickups.map((p) => [PICK_KINDS.indexOf(p.kind), r2(p.x), r2(p.y), r2(p.t), p.ph]),
      lz: this.lasers.map((l) => [l.o, l.sp ? 1 : 0, r2(l.x), r2(l.y), r2(l.z), r2(l.a), r2(l.d), r2(l.pt || 0)]),
      b: [r2(this.buffs.patch), r2(this.buffs.multi), r2(this.buffs.freeze)],
      lv: [L.phase, L.wave, L.queue.length, L.total, L.kills, L.bestCombo, r2(L.time), r2(L.t || 0), L.headshots || 0],
      sc: this.score,
      cb: [this.combo.n, r2(this.combo.t)],
      cc: this.comboCall,
      bn: this.banner,
      boss: this.boss ? this.boss.id : 0,
      fx: this.out ? this.out.splice(0) : [],
    };
    for (const z of this.zombies) z.warp = false;
    return snap;
  }

  // Guest side: copy the host's world in, keeping our own position and smoothing everyone else.
  applySnapshot(s) {
    this.snapT = 0;
    s.p.forEach((a, i) => {
      const P = this.players[i];
      if (!P) return;
      const me = i === this.local;
      if (!me) {
        P.tx = a[0];
        P.ty = a[1];
        P.ta = a[2];
        P.z = a[3];
        if (P.x == null || Math.hypot(P.x - a[0], P.y - a[1]) > 3) {
          P.x = a[0];
          P.y = a[1];
          P.a = a[2];
        }
      }
      const wasDown = P.down;
      P.hp = a[4];
      P.armor = a[5];
      P.down = !!a[6];
      if (me && P.down && !wasDown) P.vx = P.vy = 0;
      if (me && !P.down && wasDown) {
        P.x = a[0];
        P.y = a[1];
      }
      P.sp = a[7];
      if (me && a[8] > P.xp) {
        P.xp = a[8];
        const r = Math.min(99, rankFor(P.xp));
        if (r > P.rank) {
          P.rank = r;
          P.dmgMul = dmgMulFor(r) * P.mods.dmg;
          this.celebrateRank(r);
        }
      } else if (!me) P.xp = a[8];
      P.overclock = a[9];
      P.tank = a[10];
      P.heat = a[11];
      P.overheated = !!a[12];
      P.fireCd = a[13];
      if (a[14]) P.fireAnim = Math.max(P.fireAnim, 0.06);
      P.spKind = a[15] ? P.hero.gun.kind : null;
      P.iT = a[16];
      if (!me) P.pitch = a[17] || 0;
      P.hand = a[18] || 0;
      P.candleN = a[19] || 0;
      P.ammo = a[20] ?? P.ammo;
      P.reloadT = a[21] || 0;
      const was = P.melee;
      P.melee = a[22] ? { kind: MELEE_KINDS[a[22] - 1], uses: a[23] } : null;
      // We picked something up (a new kind, or a fresh one of the same): into our hand with it.
      if (me && P.melee && !P.down && (!was || was.kind !== P.melee.kind || P.melee.uses > was.uses)) this.equip(P, 1);
      // Someone else swung: play their swing (our own already started when we pressed).
      if (!me && a[24] && a[24] !== P.swingN) P.swingT = MELEE[P.melee?.kind || 'shove'].swing;
      if (!me || (a[24] || 0) > (P.swingN || 0)) P.swingN = a[24] || 0;
      P.zipT = a[25] || 0;
      // Our own slot is ours to say; everyone else's comes from the host.
      if (!me) P.slot = a[26] || 0;
    });
    const old = new Map(this.zombies.map((z) => [z.id, z]));
    this.zombies = s.z.map((a) => {
      const kind = ZKINDS[a[1]];
      let z = old.get(a[0]);
      if (!z || a[12]) {
        z = { id: a[0], kind, x: a[2], y: a[3] };
      }
      z.tx = a[2];
      z.ty = a[3];
      z.max = 1;
      z.hp = a[4];
      z.state = ZSTATES[a[5]];
      z.atkT = a[6];
      z.anim = a[7];
      z.hurtT = a[8] ? 0.08 : 0;
      z.spawnT = a[9];
      z.look = a[10];
      z.sc = a[11];
      z.bs = a[13] || 0;
      z.gold = !!a[14];
      z.elite = !!a[15];
      z.affix = a[16] || 0;
      return z;
    });
    this.rings = (s.rg || []).map((a) => ({ x: a[0], y: a[1], r: a[2], v: a[3] }));
    this.bolts = (s.bo || []).map((a) => ({ x: a[0], y: a[1], z: a[2], vx: a[3], vy: a[4], c: a[5] }));
    this.boss = s.boss ? this.zombies.find((z) => z.id === s.boss) || null : null;
    this.projs = s.pr.map((a) => ({ kind: PROJ_KINDS[a[0]], x: a[1], y: a[2], z: a[3], spin: a[4], hand: a[5], o: a[6], orbit: !!a[7], candle: !!a[8] }));
    this.pickups = s.pk.map((a) => ({ kind: PICK_KINDS[a[0]], x: a[1], y: a[2], t: a[3], ph: a[4] }));
    const mine = this.lasers.filter((l) => l.o === this.local && !l.sp);
    this.lasers = s.lz.filter((a) => a[0] !== this.local || a[1]).map((a) => ({ o: a[0], sp: !!a[1], x: a[2], y: a[3], z: a[4], a: a[5], d: a[6], pt: a[7] })).concat(mine);
    [this.buffs.patch, this.buffs.multi, this.buffs.freeze] = s.b;
    const L = this.lv;
    [L.phase, L.wave, , L.total, L.kills, L.bestCombo, L.time, L.t, L.headshots] = s.lv;
    L.queue = { length: s.lv[2] };
    this.score = s.sc;
    this.combo.n = s.cb[0];
    this.combo.t = s.cb[1];
    this.comboCall = s.cc;
    this.banner = s.bn;
    for (const e of s.fx) {
      if (e[0] === 's') sfx[e[1]]?.(...e.slice(2));
      else if (e[0] === 'f') this['fx_' + e[1]]?.(...e.slice(2));
      else if (e[0] === 'p' && e[1] === this.local) this.feel(e[2], ...e.slice(3));
    }
  }

  // Guest side, every frame: move ourselves, smooth everyone else, run local effects.
  updateClient(dt, input) {
    this.t += dt;
    this.lv.time += dt;
    const P = this.player;
    P.input = input;
    if (!P.down) this.updatePlayer(P, dt);
    P.hurtT = Math.max(0, P.hurtT - dt);
    P.fireAnim = Math.max(0, P.fireAnim - dt);
    for (const Q of this.players) this.tickMelee(Q, dt);
    // Our own swings start here straight away; the host decides what they hit, but we show the
    // impact ourselves when the swing reaches something on our screen.
    if (!P.down && P.slot === 1 && P.swapT <= 0 && input.fire && P.meleeCd <= 0 && !P.spKind) {
      const M = MELEE[P.melee?.kind || 'shove'];
      P.meleeCd = M.every / (P.overclock > 0 ? 1.4 : 1);
      P.swingT = M.swing;
      P.swingN = (P.swingN || 0) + 1;
      P.struck = false;
    }
    if (P.swingT > 0 && !P.struck && this.swingAge(P) >= MELEE[P.melee?.kind || 'shove'].hit) {
      P.struck = true;
      const M = MELEE[P.melee?.kind || 'shove'];
      if (this.meleeTargets(P, M).length) {
        P.hitHold = P.melee ? 0.05 : 0.03;
        this.feel('meleeHit', P.melee?.kind || 'shove');
      }
    }
    const G = P.hero.gun;
    const gunUp = P.slot === 0 && P.swapT <= 0;
    if (gunUp && input.fire && !P.down && (G.kind === 'soaker' ? P.tank > G.drain : G.kind === 'laser' ? !P.overheated : false)) P.fireAnim = 0.06;
    // The pump animation needs to know when the guest last sprayed.
    P.pumpT = gunUp && input.fire && !P.down ? 0.35 : P.pumpT - dt;
    // Draw our own laser from where we are now, not where the host last saw us.
    this.lasers = this.lasers.filter((l) => l.o !== this.local || l.sp);
    if (G.kind === 'laser' && gunUp && input.fire && !P.overheated && !P.down) {
      const dx = Math.cos(P.a);
      const dy = Math.sin(P.a);
      const slope = Math.tan(P.pitch);
      let d = Math.min(G.range, this.wallDistance(P.x, P.y, P.a, G.range));
      if (slope < -0.01) d = Math.min(d, (EYE + P.z) / -slope);
      if (this.buffs.multi <= 0) {
        for (const z of this.zombies) {
          const rx = z.x - P.x;
          const ry = z.y - P.y;
          const t = rx * dx + ry * dy;
          if (t > 0 && t < d && Math.abs(rx * dy - ry * dx) < hitR(z) * 1.15 && this.inHeight(z, EYE + P.z + t * slope)) d = t;
        }
      }
      this.lasers.push({ o: this.local, x: P.x, y: P.y, z: EYE + P.z, a: P.a, d, pt: P.pitch });
    }
    const k = Math.min(1, dt * 12);
    for (const Q of this.players) {
      if (Q === P || Q.tx == null) continue;
      Q.x += (Q.tx - Q.x) * k;
      Q.y += (Q.ty - Q.y) * k;
      Q.a += Math.atan2(Math.sin(Q.ta - Q.a), Math.cos(Q.ta - Q.a)) * k;
    }
    for (const z of this.zombies) {
      z.x += (z.tx - z.x) * k;
      z.y += (z.ty - z.y) * k;
      z.anim += dt * 4;
    }
    for (const p of this.projs) if (p.kind === 'rocket') this.rocketTrail(p);
    for (const g of this.rings) g.r += g.v * dt;
    for (const b of this.bolts) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.updateParticles(dt);
    this.tickTimers(dt);
    for (const b in this.buffs) this.buffs[b] = Math.max(0, this.buffs[b] - dt);
    if (this.toastMsg) {
      this.toastMsg.t -= dt;
      if (this.toastMsg.t <= 0) this.toastMsg = null;
    }
  }

  // Guest side: what we send the host about ourselves.
  inputState() {
    const P = this.player;
    return { t: 'in', p: [r2(P.x), r2(P.y), r2(P.a), r2(P.z), r2(P.pitch)], v: [r2(P.vx), r2(P.vy)], fire: P.input.fire && !P.down ? 1 : 0, dash: P.dashT > 0 ? 1 : 0, sl: P.slot || 0 };
  }
}

const NEIGH8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
