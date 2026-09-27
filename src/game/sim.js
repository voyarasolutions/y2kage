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
import { HEROES } from '../data/heroes.js';

export const EYE = 0.62;
const GRAV = 16;
export const ZRAD = { shambler: 0.3, runner: 0.26, brute: 0.45, glitch: 0.3, boss: 0.85, crawler: 0.28, bloater: 0.42 };
export const ZHEIGHT = { shambler: 1.0, runner: 1.0, brute: 1.45, glitch: 1.0, boss: 1.95, crawler: 0.45, bloater: 1.3 };
const COMBO_WINDOW = 2.2;
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
export const PROJ_KINDS = ['water', 'yoyo', 'floppy', 'rocket'];
// Boss moves and how long until each one comes round again (seconds).
const BOSS_CD = { charge: [4, 6], ring: [3.2, 4.4], burrow: [5, 7], bolts: [2.6, 3.6], summon: [9, 12], blink: [5, 7] };
export const PICK_KINDS = ['health', 'armor', 'overclock', 'patch', 'multi', 'freeze', 'cad'];
const ZSTATES = ['walk', 'attack', 'windup'];

// The special meter fills slowly on its own and much faster with kills.
export const SP_MAX = 100;
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
const HEAD_FRAC = 0.76;
const LEG_FRAC = 0.36;
// Shots converge on the crosshair this far out, so what you aim at is what you hit.
const CONVERGE = 5;
export const MAX_PITCH = 0.55;
// Seconds of countdown between waves (the level keeps running), and the victory lap after the last one.
export const BREAK_T = 4;
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
    this.endless = !!cfg.endless;
    this.grav = this.cheats.lowgrav ? 0.4 : 1;
    this.bossIdx = cfg.bossIdx ?? Math.min(BOSSES.length - 1, Math.floor((levelN - 1) / 10));
    this.bossDef = BOSSES[this.bossIdx];
    this.rings = [];
    this.bolts = [];
    this.hurtTaken = 0;
    // How carefully CPU teammates keep their distance and aim (headless playtests turn it down to act like a person).
    this.botSkill = opts.botSkill ?? 1;
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
    this.lv = { phase: 'intro', t: 3.4, wave: -1, queue: [], spawnT: 0, time: 0, kills: 0, bestCombo: 0, total: 0 };
    // Chain kills inside the window to build a combo and a score multiplier.
    this.combo = { n: 0, t: 0 };
    this.comboCall = null;
    this.popups = [];
    this.hitT = 0;
    this.banner = { kind: 'level', t: 3.4, dur: 3.4 };
  }

  makePlayer(e, i, n, s, face) {
    const hero = e.hero;
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
    return {
      idx: i, name: e.name || `P${i + 1}`, hero, heroIdx: Math.max(0, HEROES.findIndex((h) => h.id === hero.id)),
      xp, rank, dmgMul: dmgMulFor(rank) * mods.dmg, lvlUp: null, ups, mods, maxHp: mods.maxHp,
      sp: Math.max(0, Math.min(SP_MAX, e.sp || 0)), spKind: null, pitch: 0, spT: 0, spStep: 0, spCall: null, iT: 0,
      down: false, remote: false, bot: !!e.bot, input: { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0 },
      x, y, a: face, z: 0, vz: 0, vx: 0, vy: 0,
      hp: mods.maxHp, armor: mods.armor, hurtT: 0, overclock: 0, charge: 0, charging: false, boostCd: 0,
      charges: hero.move.charges || 0, rechargeT: 0, mega: false, bob: 0, onGround: true, dashT: 0,
      tank: hero.gun.tank || 0, heat: 0, overheated: false, fireCd: 0, hand: 0, fireAnim: 0, pumpT: 0, speed: 0, stride: 0,
    };
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
      this.shake = Math.min(1, this.shake + 0.4);
      this.flash = { color: '#ff2020', t: 0.18, amt: 0.35 };
      sfx.hurt();
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
    if (this.mode === 'client') {
      this.act?.('sp');
      return true;
    }
    return this.special(P);
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

  hurtPlayer(P, dmg) {
    if (P.down || P.dashT > 0 || P.iT > 0 || this.lv.phase === 'done') return;
    if (this.buffs.patch > 0) {
      this.personal(P, 'shield');
      return;
    }
    if (this.cheats.onehit) dmg = 9999;
    this.hurtTaken += dmg;
    if (P.armor > 0) {
      const soak = Math.min(P.armor, dmg * 0.5);
      P.armor -= soak;
      dmg -= soak;
    }
    P.hp -= dmg;
    P.hurtT = 0.4;
    this.personal(P, 'hurt');
    if (P.hp <= 0) {
      P.hp = 0;
      P.down = true;
      P.spKind = null;
      this.fx('downed', r2(P.x), r2(P.y));
      if (!this.alive().length) {
        this.lv.phase = 'done';
        this.emit('dead');
      } else this.toast(`${P.name} CRASHED`, 'Reboots next wave');
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
    P.input = { move: { f: 0, s: 0 }, turn: 0, fire, look: 0 };
    // Specials: save them for a crowd or the boss.
    if (P.sp >= SP_MAX && !P.spKind) {
      const near = this.zombies.filter((z) => !z.bs && Math.hypot(z.x - P.x, z.y - P.y) < 7);
      if (near.length >= 4 || this.zombies.some((z) => z.kind === 'boss' && !z.bs && Math.hypot(z.x - P.x, z.y - P.y) < 9)) this.special(P);
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
    const oc = (P.overclock > 0 ? 0.5 : 1) / P.mods.rate;
    P.fireCd -= dt;
    const firing = P.input.fire;
    this.lasers = this.lasers.filter((l) => l.o !== P.idx || l.sp);
    const eyeZ = EYE + P.z;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);

    if (G.kind === 'soaker') {
      if (firing && P.tank > G.drain) {
        while (P.fireCd <= 0) {
          P.fireCd += G.every / P.mods.rate;
          P.tank -= G.drain * (P.overclock > 0 ? 0.5 : 1);
          const m = this.muzzle(P, 'soaker');
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
      if (firing && P.fireCd <= 0) {
        P.fireCd = G.every * oc;
        P.fireAnim = 0.16;
        for (const off of this.spread()) this.throwFloppy(P, P.a + off, G.dmg, G.bounces, G.life, true);
        this.snd('shoot', 'floppy');
      }
    } else if (G.kind === 'rocket') {
      if (firing && P.fireCd <= 0) {
        P.fireCd = G.every * oc;
        P.fireAnim = 0.2;
        const m = this.muzzle(P, 'rocket');
        for (const off of this.spread()) {
          const b = m.a + off;
          this.projs.push(this.aimRay({ kind: 'rocket', o: P.idx, x: m.x, y: m.y, z: m.z, vx: Math.cos(b) * G.speed, vy: Math.sin(b) * G.speed, vz: this.aimVz(P, m.z, G.speed), life: G.life, r: 0.2, dmg: G.direct, knock: 0 }, P));
        }
        this.snd('shoot', 'rocket');
        if (this.isLocal(P)) this.shake = Math.min(1, this.shake + 0.15);
      }
    } else if (G.kind === 'laser') {
      if (P.overheated) {
        P.heat -= G.cool * dt;
        if (P.heat <= 30) P.overheated = false;
      } else if (firing) {
        P.heat += G.heat * oc * dt;
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
      if (t > 0 && t < wallD && Math.abs(rx * dy - ry * dx) < ZRAD[z.kind] * 1.15) {
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
      // Grand Finale: fireworks rain down on the horde.
      const G = P.hero.gun;
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
        this.projs.push({ kind: 'rocket', o: P.idx, fall: true, x: tx, y: ty, z: 7, vx: 0, vy: 0, vz: -10, life: 3, r: 0.2, dmg: G.direct, knock: 0, big: 1.3 });
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
          if (d < ZRAD[z.kind] + p.r) {
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
        } else {
          const nx = p.x + p.vx * dt;
          const ny = p.y + p.vy * dt;
          p.z = Math.max(0.08, p.z + (p.vz || 0) * dt);
          p.travel += G.speed * dt;
          if (this.wallAt(nx, ny) || p.travel > G.range) {
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
          if (Math.hypot(z.x - p.x, z.y - p.y) < ZRAD[z.kind] + p.r && this.inHeight(z, hz)) {
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
        if (p.kind === 'rocket') this.explode(p.x, p.y, p.z, P, p.big);
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
        p.spin = (p.spin || 0) + dt * 12;
        this.rocketTrail(p);
        if (!p.fall) {
          p.z += p.vz * dt;
          if (p.z <= 0.06 && !dead) {
            this.explode(p.x, p.y, 0.1, P, p.big);
            dead = true;
          }
        }
        if (p.fall) {
          p.z += p.vz * dt;
          if (p.z <= 0.15 && !dead) {
            this.explode(p.x, p.y, 0.15, P, p.big);
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
          this.puff(p.x, p.y, p.z, '#3de0e0', 4);
          if (this.isLocal(P)) sfx.tick();
          if (p.bounces < 0) dead = true;
        } else {
          p.x = nx;
          p.y = ny;
        }
      } else if (!dead && this.wallAt(nx, ny)) {
        dead = true;
        if (p.kind === 'rocket') this.explode(p.x, p.y, p.z, P, p.big);
        if (p.kind === 'water' && !p.fx) this.puff(p.x, p.y, p.z, '#8fd8ff', 3);
      } else {
        p.x = nx;
        p.y = ny;
      }

      if (!dead && !p.fx) {
        for (const z of this.zombies) {
          const hz = this.hitZ(p);
          if (Math.hypot(z.x - p.x, z.y - p.y) < ZRAD[z.kind] + p.r && this.inHeight(z, hz)) {
            const d = Math.hypot(p.vx, p.vy) || 1;
            let dmg = p.dmg * ocMul;
            if (p.kind === 'water' && z.kind === 'glitch') dmg *= 2.5;
            this.hurtZombie(z, dmg, p.vx / d, p.vy / d, p.knock, P, this.zoneAt(z, hz));
            if (p.kind === 'water') {
              this.puff(p.x, p.y, p.z, '#8fd8ff', 2);
              if (Math.random() < 0.15) this.snd('splash');
            }
            if (p.kind === 'floppy') this.puff(p.x, p.y, p.z, this.goo(), 6);
            if (p.kind === 'rocket') this.explode(p.x, p.y, p.z, P, p.big);
            dead = true;
            break;
          }
        }
      }
      if (dead) this.projs.splice(i, 1);
    }
  }

  rocketTrail(p) {
    if (Math.random() < 0.9) this.particles.push({ x: p.x, y: p.y, z: p.z, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(-0.2, 0.3), life: 0.35, color: Math.random() < 0.5 ? '#f6c945' : '#ff8a2a' });
  }

  explode(x, y, z, P, big = 1) {
    const G = P.hero.gun;
    const R = (G.radius || 1.9) * big;
    this.fx('explode', r2(x), r2(y), r2(z), pickOne(PARTY), pickOne(PARTY));
    for (const zb of this.zombies.slice()) {
      const d = Math.hypot(zb.x - x, zb.y - y);
      if (d < R + ZRAD[zb.kind]) {
        const f = 1 - Math.min(1, d / (R + ZRAD[zb.kind]));
        this.hurtZombie(zb, (G.dmg || 55) * big * (0.4 + 0.6 * f) * (P.overclock > 0 ? 1.3 : 1), (zb.x - x) / (d || 1), (zb.y - y) / (d || 1), G.knock || 2.5, P);
      }
    }
  }

  // A bloater bursts in a shower of confetti and goo, hurting anything standing too close, players included.
  pop(z, P) {
    const R = 1.7;
    this.fx('pop', r2(z.x), r2(z.y));
    for (const o of this.zombies.slice()) {
      const d = Math.hypot(o.x - z.x, o.y - z.y);
      if (d < R + ZRAD[o.kind]) this.hurtZombie(o, 45 / (P?.dmgMul || 1), (o.x - z.x) / (d || 1), (o.y - z.y) / (d || 1), 1.5, P);
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
    }
  }

  // Headshot: the head pops off spinning, a fountain of goo and confetti, the body stands a beat, then drops.
  fx_headshot(kind, x, y, look, sc, nx, ny) {
    sfx.headshot();
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
    const base = ENEMIES[kind];
    const cfg = this.cfg;
    let s = at;
    if (!s) s = this.spawnPoint(kind);
    const B = kind === 'boss' ? this.bossDef : null;
    const hp = base.hp * cfg.hpMul * (B ? B.hpMul * (1 + COOP_BOSS_HP * (this.players.length - 1)) : 1);
    const z = {
      id: this.nextZid++, kind, x: s.x + rand(-0.2, 0.2), y: s.y + rand(-0.2, 0.2),
      hp, max: hp, bs: 0,
      speed: Math.min(kind === 'runner' ? 4.2 : 3.6, (base.speed / 40) * cfg.speedMul * rand(0.88, 1.12)) * (B ? B.speed : 1),
      dmg: base.damage * cfg.damageMul, state: 'walk', atkT: 0, cd: 0.5, kx: 0, ky: 0, hurtT: 0,
      look: Math.floor(Math.random() * 1000), sc: B ? B.scale : r2(rand(0.92, 1.08)),
      anim: rand(0, 4), spawnT: 0.6, blinkT: rand(2, 3.5), chargeT: rand(4, 6), chargeLeft: 0, groanT: rand(2, 9), wob: rand(0, TAU),
    };
    if (B) {
      z.ab = {};
      B.moves.forEach((m, i) => (z.ab[m] = rand(...BOSS_CD[m]) * 0.6 + i * 0.8));
    }
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
      let speed = z.speed * frz;
      // The last few of a wave stop dawdling and come find you, so a wave never ends in a search.
      if (this.lv.phase === 'wave' && !this.lv.queue.length && this.zombies.length <= STRAGGLERS && z.kind !== 'boss') speed *= 1.7;
      if (z.spawnT > 0) speed = 0;
      if (z.state === 'attack') speed *= 0.15;

      // Bosses run their own move set.
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

      // Attacks.
      const reach = r + 0.45;
      if (z.state === 'walk' && z.kind !== 'boss' && dist < reach && z.cd <= 0 && z.spawnT <= 0) {
        z.state = 'attack';
        z.atkT = 0.35;
      }
      if (z.kind === 'boss' && !z.bs && dist < reach + 0.2 && z.cd <= 0) {
        z.cd = 1;
        if (P.z < 0.35) this.hurtPlayer(P, z.dmg);
      }
      if (z.state === 'attack') {
        z.atkT -= dt;
        if (z.atkT <= 0) {
          z.state = 'walk';
          z.cd = 0.9;
          if (dist < r + 0.75 && P.z < 0.3) this.hurtPlayer(P, z.dmg);
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
          this.hurtPlayer(Q, b.dmg);
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
    z.hp -= dmg * P.dmgMul;
    z.hurtT = 0.08;
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
  }

  killZombie(z, P = this.player, head = false, nx = 0, ny = 0) {
    z.dead = true;
    this.zombies.splice(this.zombies.indexOf(z), 1);
    const base = ENEMIES[z.kind];
    const C = this.combo;
    C.n = C.t > 0 ? C.n + 1 : 1;
    C.t = COMBO_WINDOW + P.mods.combo;
    this.lv.bestCombo = Math.max(this.lv.bestCombo, C.n);
    const mult = comboMult(C.n);
    // Headshot kills are worth half again, in score and XP.
    const hs = head ? 1.5 : 1;
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
    if (z.kind === 'boss') {
      this.boss = this.zombies.find((o) => o.kind === 'boss') || null;
      for (const k of ['health', 'armor', 'overclock']) this.dropPickup(z.x + rand(-0.8, 0.8), z.y + rand(-0.8, 0.8), k);
      this.emit('bossDown');
      return;
    }
    const roll = Math.random();
    const weak = this.players.some((Q) => !Q.down && Q.hp < Q.maxHp / 2);
    if (roll < (weak ? 0.09 : 0.04)) this.dropPickup(z.x, z.y, 'health');
    else if (roll < 0.115) this.dropPickup(z.x, z.y, 'armor');
    else if (roll < 0.14) this.dropPickup(z.x, z.y, 'overclock');
    else if (roll < 0.14 + 0.025 * Math.max(...this.players.map((Q) => Q.mods.luck)) + (z.kind === 'brute' ? 0.25 : 0)) this.dropPickup(z.x, z.y, pickOne(['patch', 'multi', 'freeze', 'multi', 'patch', 'cad']));
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
    const extra = Math.round(base.length * COOP_WAVE * (this.players.length - 1));
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
    return Math.round(this.cfg.maxAlive * (1 + COOP_ALIVE * (this.players.length - 1)));
  }

  updateWaves(dt) {
    const L = this.lv;
    const cfg = this.cfg;
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
      for (const P of this.alive()) this.chargeSpecial(P, 10);
      if (!last) {
        L.phase = 'break';
        L.t = BREAK_T;
        for (const P of this.alive()) {
          if (P.hp < P.maxHp * 0.7) this.dropPickup(P.x + rand(-1, 1), P.y + rand(-1, 1), 'health');
        }
      } else {
        L.phase = 'outro';
        L.t = OUTRO_T;
      }
    }
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
  }

  remoteAct(i, kind, ...a) {
    const P = this.players[i];
    if (!P || P.down) return;
    if (kind === 'sp') this.special(P);
    if (kind === 'stomp' && P.hero.move.type === 'pogo') this.stomp(P, a[0], a[1]);
  }

  // Everything a guest needs to draw the level, compacted into arrays.
  snapshot() {
    const L = this.lv;
    const snap = {
      t: 'snap',
      p: this.players.map((P) => [r2(P.x), r2(P.y), r2(P.a), r2(P.z), Math.ceil(P.hp), Math.ceil(P.armor), P.down ? 1 : 0, Math.floor(P.sp), Math.floor(P.xp), r2(P.overclock), r2(P.tank), r2(P.heat), P.overheated ? 1 : 0, r2(P.fireCd), P.fireAnim > 0 ? 1 : 0, P.spKind ? 1 : 0, r2(P.iT), r2(P.pitch || 0)]),
      z: this.zombies.map((z) => [z.id, ZKINDS.indexOf(z.kind), r2(z.x), r2(z.y), r2(z.hp / z.max), ZSTATES.indexOf(z.state), r2(z.atkT), r2(z.anim), z.hurtT > 0 ? 1 : 0, r2(z.spawnT), z.look, z.sc, z.warp ? 1 : 0, z.bs || 0]),
      rg: this.rings.map((g) => [g.x, g.y, r2(g.r), g.v]),
      bo: this.bolts.map((b) => [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), b.c]),
      pr: this.projs.filter((p) => !p.fx || Math.random() < 0.5).map((p) => [PROJ_KINDS.indexOf(p.kind), r2(p.x), r2(p.y), r2(p.z), Math.floor(p.spin || 0), p.hand ?? 0, p.o, p.orbit ? 1 : 0]),
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
      return z;
    });
    this.rings = (s.rg || []).map((a) => ({ x: a[0], y: a[1], r: a[2], v: a[3] }));
    this.bolts = (s.bo || []).map((a) => ({ x: a[0], y: a[1], z: a[2], vx: a[3], vy: a[4], c: a[5] }));
    this.boss = s.boss ? this.zombies.find((z) => z.id === s.boss) || null : null;
    this.projs = s.pr.map((a) => ({ kind: PROJ_KINDS[a[0]], x: a[1], y: a[2], z: a[3], spin: a[4], hand: a[5], o: a[6], orbit: !!a[7] }));
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
    const G = P.hero.gun;
    if (input.fire && !P.down && (G.kind === 'soaker' ? P.tank > G.drain : G.kind === 'laser' ? !P.overheated : false)) P.fireAnim = 0.06;
    // The pump animation needs to know when the guest last sprayed.
    P.pumpT = input.fire && !P.down ? 0.35 : P.pumpT - dt;
    // Draw our own laser from where we are now, not where the host last saw us.
    this.lasers = this.lasers.filter((l) => l.o !== this.local || l.sp);
    if (G.kind === 'laser' && input.fire && !P.overheated && !P.down) {
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
          if (t > 0 && t < d && Math.abs(rx * dy - ry * dx) < ZRAD[z.kind] * 1.15 && this.inHeight(z, EYE + P.z + t * slope)) d = t;
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
    return { t: 'in', p: [r2(P.x), r2(P.y), r2(P.a), r2(P.z), r2(P.pitch)], v: [r2(P.vx), r2(P.vy)], fire: P.input.fire && !P.down ? 1 : 0, dash: P.dashT > 0 ? 1 : 0 };
  }
}

const NEIGH8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
