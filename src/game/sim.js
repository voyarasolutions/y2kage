// One level of Y2Kage: the player on their ride, their weapon, the horde and the waves.
// Pure game state, no drawing. Map units: one cell = 1, x/y on the ground plane, z is height.
import { ENEMIES, clockFor } from '../data/levels.js';
import { PARTY } from '../core/palette.js';
import { rand, clamp, TAU, pickOne } from '../core/util.js';
import { sfx } from '../audio/sfx.js';

export const EYE = 0.62;
const GRAV = 16;
export const ZRAD = { shambler: 0.3, runner: 0.26, brute: 0.45, glitch: 0.3, boss: 0.85, crawler: 0.28, bloater: 0.42 };
export const ZHEIGHT = { shambler: 1.0, runner: 1.0, brute: 1.45, glitch: 1.0, boss: 1.95, crawler: 0.45, bloater: 1.3 };
const COMBO_WINDOW = 2.2;
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

export class Sim {
  constructor(map, cfg, hero, levelN) {
    this.map = map;
    this.cfg = cfg;
    this.hero = hero;
    this.levelN = levelN;
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
    this.flowCell = -1;
    const s = map.start;
    this.player = {
      x: s.x, y: s.y, a: this.faceOpen(s), z: 0, vz: 0, vx: 0, vy: 0,
      hp: 100, armor: 0, hurtT: 0, overclock: 0, charge: 0, charging: false, boostCd: 0,
      charges: hero.move.charges || 0, rechargeT: 0, mega: false, bob: 0, onGround: true, dashT: 0,
      tank: hero.gun.tank || 0, heat: 0, overheated: false, fireCd: 0, hand: 0, fireAnim: 0, pumpT: 0, speed: 0, stride: 0,
    };
    this.zombies = [];
    this.projs = [];
    this.pickups = [];
    this.splats = [];
    this.particles = [];
    this.corpses = [];
    this.boss = null;
    this.laser = null;
    this.shake = 0;
    this.flash = null;
    this.glitchT = 0;
    this.score = 0;
    this.lv = { phase: 'intro', t: 3.4, wave: -1, queue: [], spawnT: 0, time: 0, kills: 0, bestCombo: 0 };
    // Chain kills inside the window to build a combo and a score multiplier.
    this.combo = { n: 0, t: 0 };
    this.comboCall = null;
    this.popups = [];
    this.hitT = 0;
    this.banner = { kind: 'level', t: 3.4, dur: 3.4 };
  }

  emit(type, data) {
    this.events.push({ type, ...data });
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
  moveCircle(e, dx, dy, r) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.15));
    const sx = e.x;
    const sy = e.y;
    for (let i = 0; i < steps; i++) {
      e.x += dx / steps;
      e.y += dy / steps;
      for (const p of this.props) {
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
    this.t += dt;
    this.input = input;
    this.lv.time += dt;
    this.updatePlayer(dt);
    this.updateWeapon(dt);
    this.updateFlow();
    this.updateZombies(dt);
    this.updateProjs(dt);
    this.updatePickups(dt);
    this.updateWaves(dt);
    this.updateParticles(dt);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    this.combo.t -= dt;
    if (this.combo.t <= 0) this.combo.n = 0;
    if (this.comboCall && (this.comboCall.t -= dt) <= 0) this.comboCall = null;
    this.hitT = Math.max(0, this.hitT - dt);
    for (const p of this.popups) {
      p.t -= dt;
      p.z += dt * 0.6;
    }
    this.popups = this.popups.filter((p) => p.t > 0);
    if (this.toastMsg) {
      this.toastMsg.t -= dt;
      if (this.toastMsg.t <= 0) this.toastMsg = null;
    }
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

  // ------------------------------------------------------------ player and rides
  pressJump() {
    const P = this.player;
    const M = this.hero.move;
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
    if (this.hero.move.type !== 'slinky' || !P.charging) return;
    const M = this.hero.move;
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
    const M = this.hero.move;
    if (M.type === 'board' && P.boostCd <= 0) {
      P.vx += Math.cos(P.a) * M.boost;
      P.vy += Math.sin(P.a) * M.boost;
      P.boostCd = M.boostCd;
      sfx.dash();
    }
    if (M.type === 'scooter' && P.charges > 0) {
      const mv = this.input.move;
      const ang = mv.f || mv.s ? P.a + Math.atan2(mv.s, mv.f || 0.0001) : P.a;
      P.vx = Math.cos(ang) * M.dash;
      P.vy = Math.sin(ang) * M.dash;
      P.charges--;
      P.dashT = 0.25;
      sfx.dash();
    }
  }

  updatePlayer(dt) {
    const P = this.player;
    const M = this.hero.move;
    const inp = this.input;
    P.a += inp.turn * 2.6 * dt;
    const { f, s } = inp.move;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);
    const air = P.onGround ? 1 : 0.35;
    let ax;
    let ay;
    let accel = M.accel;
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
    if (sp2 > M.max) {
      const target = Math.max(M.max, sp2 - 6 * dt);
      P.vx *= target / sp2;
      P.vy *= target / sp2;
    }
    const hit = this.moveCircle(P, P.vx * dt, P.vy * dt, 0.24);
    if (hit.hx) P.vx *= -0.2;
    if (hit.hy) P.vy *= -0.2;

    // Vertical: hops, the slinky's coil, the pogo's endless bounce.
    if (P.charging) P.charge = Math.min(1, P.charge + dt);
    if (!P.onGround || P.vz > 0) {
      P.vz -= GRAV * dt;
      P.z += P.vz * dt;
      if (P.z <= 0) {
        P.z = 0;
        const hard = P.vz < -5;
        P.vz = 0;
        P.onGround = true;
        if (P.mega && M.type === 'pogo') this.stomp();
        else if (hard) sfx.land();
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
    P.hurtT = Math.max(0, P.hurtT - dt);
    P.overclock = Math.max(0, P.overclock - dt);
    P.speed = sp;
  }

  stomp() {
    const P = this.player;
    const M = this.hero.move;
    sfx.stomp();
    this.shake = 0.6;
    for (const z of this.zombies.slice()) {
      const d = Math.hypot(z.x - P.x, z.y - P.y);
      if (d < M.stompR) {
        const f = 1 - d / M.stompR;
        this.hurtZombie(z, M.stomp * (0.5 + f * 0.5), (z.x - P.x) / (d || 1), (z.y - P.y) / (d || 1), 4);
      }
    }
    for (let i = 0; i < 50; i++) {
      const a = rand(0, TAU);
      const s = rand(2, 5);
      this.particles.push({ x: P.x, y: P.y, z: 0.05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0.5, 2), life: 0.5, color: i % 3 ? '#fff4d6' : '#ff8a2a' });
    }
  }

  hurtPlayer(dmg) {
    const P = this.player;
    if (P.dashT > 0 || this.lv.phase === 'done') return;
    if (P.armor > 0) {
      const soak = Math.min(P.armor, dmg * 0.5);
      P.armor -= soak;
      dmg -= soak;
    }
    P.hp -= dmg;
    P.hurtT = 0.4;
    this.shake = Math.min(1, this.shake + 0.4);
    this.flash = { color: '#ff2020', t: 0.18, amt: 0.35 };
    sfx.hurt();
    if (P.hp <= 0) {
      P.hp = 0;
      this.lv.phase = 'done';
      this.emit('dead');
    }
  }

  // ------------------------------------------------------------ weapons
  updateWeapon(dt) {
    const P = this.player;
    const G = this.hero.gun;
    const oc = P.overclock > 0 ? 0.5 : 1;
    P.fireCd -= dt;
    P.fireAnim = Math.max(0, P.fireAnim - dt);
    const firing = this.input.fire;
    this.laser = null;
    const eyeZ = EYE + P.z;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);

    if (G.kind === 'soaker') {
      if (firing && P.tank > G.drain) {
        while (P.fireCd <= 0) {
          P.fireCd += G.every;
          P.tank -= G.drain * oc;
          const a = P.a + rand(-G.spread, G.spread);
          this.projs.push({ kind: 'water', x: P.x + dx * 0.4 - dy * 0.12, y: P.y + dy * 0.4 + dx * 0.12, z: eyeZ - 0.22, vx: Math.cos(a) * G.speed + P.vx * 0.5, vy: Math.sin(a) * G.speed + P.vy * 0.5, vz: rand(0.3, 0.9), life: G.life, r: 0.12, dmg: G.dmg, knock: G.knock });
          if (Math.random() < 0.35) sfx.shoot('soaker');
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
        const out = this.projs.filter((p) => p.kind === 'yoyo').map((p) => p.hand);
        const hand = [P.hand, 1 - P.hand].find((h) => !out.includes(h));
        if (hand != null) {
          P.hand = 1 - hand;
          P.fireCd = G.every * oc;
          const a = P.a + (hand ? 0.03 : -0.03);
          const side = hand ? 1 : -1;
          this.projs.push({ kind: 'yoyo', hand, x: P.x + dx * 0.3 - dy * 0.15 * side, y: P.y + dy * 0.3 + dx * 0.15 * side, z: eyeZ - 0.18, vx: Math.cos(a) * G.speed, vy: Math.sin(a) * G.speed, vz: 0, travel: 0, back: false, hits: new Set(), r: 0.22, dmg: G.dmg, knock: G.knock, spin: 0 });
          sfx.shoot('yoyo');
        }
      }
    } else if (G.kind === 'floppy') {
      if (firing && P.fireCd <= 0) {
        P.fireCd = G.every * oc;
        P.fireAnim = 0.16;
        this.projs.push({ kind: 'floppy', x: P.x + dx * 0.3 - dy * 0.1, y: P.y + dy * 0.3 + dx * 0.1, z: eyeZ - 0.14, vx: dx * G.speed, vy: dy * G.speed, vz: 0, life: G.life, bounces: G.bounces, r: 0.18, dmg: G.dmg, knock: G.knock, spin: 0 });
        sfx.shoot('floppy');
      }
    } else if (G.kind === 'rocket') {
      if (firing && P.fireCd <= 0) {
        P.fireCd = G.every * oc;
        P.fireAnim = 0.2;
        this.projs.push({ kind: 'rocket', x: P.x + dx * 0.3 - dy * 0.12, y: P.y + dy * 0.3 + dx * 0.12, z: eyeZ - 0.12, vx: dx * G.speed, vy: dy * G.speed, vz: 0, life: G.life, r: 0.2, dmg: G.direct, knock: 0 });
        sfx.shoot('rocket');
        this.shake = Math.min(1, this.shake + 0.15);
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
          sfx.overheat();
        }
        const wallD = Math.min(G.range, this.wallDistance(P.x, P.y, P.a, G.range));
        let best = null;
        let bestT = wallD;
        for (const z of this.zombies) {
          const rx = z.x - P.x;
          const ry = z.y - P.y;
          const t = rx * dx + ry * dy;
          const perp = Math.abs(rx * dy - ry * dx);
          if (t > 0 && t < bestT && perp < ZRAD[z.kind] * 1.15) {
            best = z;
            bestT = t;
          }
        }
        this.laser = { d: bestT, hit: !!best };
        const hx = P.x + dx * bestT;
        const hy = P.y + dy * bestT;
        if (Math.random() < 0.7) this.puff(hx - dx * 0.1, hy - dy * 0.1, eyeZ - 0.1, Math.random() < 0.5 ? '#ff3b3b' : '#fff4d6', 2);
        if (best) this.hurtZombie(best, G.dps * dt, dx, dy, 0.3);
        if (P.fireCd <= 0) {
          sfx.shoot('laser');
          P.fireCd = 0.07;
        }
        P.fireAnim = 0.05;
      } else {
        P.heat = Math.max(0, P.heat - G.cool * dt);
      }
    }
  }

  updateProjs(dt) {
    const P = this.player;
    const G = this.hero.gun;
    const ocMul = P.overclock > 0 ? 1.3 : 1;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      let dead = false;
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
          p.travel += G.speed * dt;
          if (this.wallAt(nx, ny) || p.travel > G.range) {
            p.back = true;
            p.hits.clear();
            if (this.wallAt(nx, ny)) this.puff(p.x, p.y, p.z, '#fff4d6', 4);
          } else {
            p.x = nx;
            p.y = ny;
          }
        }
        for (const z of this.zombies) {
          if (p.hits.has(z)) continue;
          if (Math.hypot(z.x - p.x, z.y - p.y) < ZRAD[z.kind] + p.r) {
            p.hits.add(z);
            const d = Math.hypot(p.vx, p.vy) || 1;
            this.hurtZombie(z, p.dmg * ocMul, p.vx / d, p.vy / d, p.knock);
            this.puff(p.x, p.y, p.z, '#9be04a', 5);
          }
        }
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        dead = true;
        if (p.kind === 'rocket') this.explode(p.x, p.y, p.z);
      }
      if (p.kind === 'water') {
        p.vz -= 2.2 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0.02) {
          dead = true;
          this.puff(p.x, p.y, 0.02, '#8fd8ff', 1);
        }
      }
      if (p.kind === 'floppy') p.spin += dt * 16;
      if (p.kind === 'rocket') {
        p.spin = (p.spin || 0) + dt * 12;
        if (Math.random() < 0.9) this.particles.push({ x: p.x, y: p.y, z: p.z, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(-0.2, 0.3), life: 0.35, color: Math.random() < 0.5 ? '#f6c945' : '#ff8a2a' });
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
          p.hits = null;
          this.puff(p.x, p.y, p.z, '#3de0e0', 4);
          sfx.tick();
          if (p.bounces < 0) dead = true;
        } else {
          p.x = nx;
          p.y = ny;
        }
      } else if (this.wallAt(nx, ny)) {
        dead = true;
        if (p.kind === 'rocket') this.explode(p.x, p.y, p.z);
        if (p.kind === 'water') this.puff(p.x, p.y, p.z, '#8fd8ff', 3);
      } else {
        p.x = nx;
        p.y = ny;
      }

      if (!dead) {
        for (const z of this.zombies) {
          if (Math.hypot(z.x - p.x, z.y - p.y) < ZRAD[z.kind] + p.r && p.z < Math.max(0.72, ZHEIGHT[z.kind] + 0.1)) {
            const d = Math.hypot(p.vx, p.vy) || 1;
            let dmg = p.dmg * ocMul;
            if (p.kind === 'water' && z.kind === 'glitch') dmg *= 2.5;
            this.hurtZombie(z, dmg, p.vx / d, p.vy / d, p.knock);
            if (p.kind === 'water') {
              this.puff(p.x, p.y, p.z, '#8fd8ff', 2);
              if (Math.random() < 0.15) sfx.splash();
            }
            if (p.kind === 'floppy') this.puff(p.x, p.y, p.z, '#9be04a', 6);
            if (p.kind === 'rocket') this.explode(p.x, p.y, p.z);
            dead = true;
            break;
          }
        }
      }
      if (dead) this.projs.splice(i, 1);
    }
  }

  explode(x, y, z) {
    const G = this.hero.gun;
    sfx.explode();
    this.shake = Math.min(1, this.shake + 0.35);
    this.flash = { color: '#ffd080', t: 0.08, amt: 0.2 };
    for (const zb of this.zombies.slice()) {
      const d = Math.hypot(zb.x - x, zb.y - y);
      if (d < G.radius + ZRAD[zb.kind]) {
        const f = 1 - Math.min(1, d / (G.radius + ZRAD[zb.kind]));
        this.hurtZombie(zb, G.dmg * (0.4 + 0.6 * f) * (this.player.overclock > 0 ? 1.3 : 1), (zb.x - x) / (d || 1), (zb.y - y) / (d || 1), G.knock);
      }
    }
    const cols = [pickOne(PARTY), pickOne(PARTY), '#fff4d6'];
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU);
      const e = rand(-0.6, 1);
      const s = rand(2, 5);
      this.particles.push({ x, y, z: Math.max(0.2, z), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: e * s, life: rand(0.4, 0.9), color: cols[i % 3] });
    }
  }

  // A bloater bursts in a shower of confetti and goo, hurting anything standing too close, you included.
  pop(z) {
    const R = 1.7;
    sfx.explode();
    this.shake = Math.min(1, this.shake + 0.3);
    this.splats.push({ x: z.x, y: z.y, t: 14, big: true, rot: rand(0, TAU) });
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU);
      const s = rand(1.5, 4.5);
      this.particles.push({ x: z.x, y: z.y, z: rand(0.4, 1.1), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0, 3.5), life: rand(0.5, 1.2), color: i % 3 ? PARTY[i % PARTY.length] : '#9be04a' });
    }
    for (const o of this.zombies.slice()) {
      const d = Math.hypot(o.x - z.x, o.y - z.y);
      if (d < R + ZRAD[o.kind]) this.hurtZombie(o, 45, (o.x - z.x) / (d || 1), (o.y - z.y) / (d || 1), 1.5);
    }
    const P = this.player;
    if (Math.hypot(P.x - z.x, P.y - z.y) < R - 0.2 && P.z < 0.6) this.hurtPlayer(14 * this.cfg.damageMul);
    this.emit('pop');
  }

  puff(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x, y, z, vx: rand(-1.2, 1.2), vy: rand(-1.2, 1.2), vz: rand(0, 2), life: rand(0.2, 0.45), color });
    }
  }

  // ------------------------------------------------------------ the horde
  spawnZombie(kind) {
    const P = this.player;
    const base = ENEMIES[kind];
    const cfg = this.cfg;
    let pts = this.map.spawns.filter((s) => Math.hypot(s.x - P.x, s.y - P.y) > 6);
    if (!pts.length) pts = this.map.spawns.slice().sort((a, b) => Math.hypot(b.x - P.x, b.y - P.y) - Math.hypot(a.x - P.x, a.y - P.y)).slice(0, 1);
    const s = pickOne(pts);
    const z = {
      kind, x: s.x + rand(-0.2, 0.2), y: s.y + rand(-0.2, 0.2),
      hp: base.hp * cfg.hpMul, max: base.hp * cfg.hpMul,
      speed: Math.min(kind === 'runner' ? 4.2 : 3.6, (base.speed / 40) * cfg.speedMul * rand(0.88, 1.12)),
      dmg: base.damage * cfg.damageMul, state: 'walk', atkT: 0, cd: 0.5, kx: 0, ky: 0, hurtT: 0,
      look: Math.floor(Math.random() * 1000), sc: kind === 'boss' ? 1 : rand(0.92, 1.08),
      anim: rand(0, 4), spawnT: 0.6, blinkT: rand(2, 3.5), chargeT: rand(4, 6), chargeLeft: 0, groanT: rand(2, 9), wob: rand(0, TAU),
    };
    this.zombies.push(z);
    // First sighting of a new type gets a heads-up.
    const tip = NEW_TIPS[kind];
    if (tip && this.levelN === base.unlock && !(this.announced ||= new Set()).has(kind)) {
      this.announced.add(kind);
      this.toast(`NEW: ${base.name.toUpperCase()}`, tip);
    }
    for (let i = 0; i < 16; i++) this.particles.push({ x: z.x + rand(-0.3, 0.3), y: z.y + rand(-0.3, 0.3), z: rand(0, 1), vx: 0, vy: 0, vz: rand(-0.5, 0.5), life: rand(0.2, 0.6), color: i % 2 ? '#3de0e0' : '#ff2e88', float: true });
    if (kind === 'boss') {
      this.boss = z;
      this.banner = { kind: 'boss', t: 2.8, dur: 2.8 };
      sfx.bossRoar();
    }
  }

  updateFlow() {
    const P = this.player;
    const m = this.map;
    const cell = Math.floor(P.y) * m.w + Math.floor(P.x);
    if (cell === this.flowCell) return;
    this.flowCell = cell;
    const dist = this.flow;
    dist.fill(-1);
    const q = this.flowQ;
    let head = 0;
    let tail = 0;
    dist[cell] = 0;
    q[tail++] = cell;
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

  updateZombies(dt) {
    const P = this.player;
    const m = this.map;
    for (const z of this.zombies) {
      z.anim += dt * (z.kind === 'runner' ? 7 : z.kind === 'boss' ? 4 : z.kind === 'crawler' ? 6 : z.kind === 'bloater' ? 3 : 4.2) * (z.spawnT > 0 ? 0 : 1);
      z.hurtT = Math.max(0, z.hurtT - dt);
      z.spawnT = Math.max(0, z.spawnT - dt);
      z.cd = Math.max(0, z.cd - dt);
      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = rand(4, 12);
        if (Math.hypot(z.x - P.x, z.y - P.y) < 8) sfx.groan();
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

      let speed = z.speed;
      if (z.spawnT > 0) speed = 0;
      if (z.state === 'attack') speed *= 0.15;

      // Boss: telegraphed charges.
      if (z.kind === 'boss') {
        if (z.chargeLeft > 0) {
          z.chargeLeft -= dt;
          speed = z.speed * 3.4;
          gx = z.cdx;
          gy = z.cdy;
          if (Math.random() < 0.5) this.puff(z.x, z.y, 0.1, '#d8cfb4', 1);
        } else if (z.state !== 'windup') {
          z.chargeT -= dt;
          if (z.chargeT <= 0 && dist < 10) {
            z.state = 'windup';
            z.atkT = 0.8;
            sfx.bossRoar();
          }
        }
        if (z.state === 'windup') {
          speed = 0;
          z.atkT -= dt;
          if (z.atkT <= 0) {
            z.state = 'walk';
            z.chargeLeft = 1.0;
            z.cdx = tx / (dist || 1);
            z.cdy = ty / (dist || 1);
            z.chargeT = rand(4, 6);
            this.shake = Math.min(1, this.shake + 0.3);
          }
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
              for (let i = 0; i < 14; i++) this.particles.push({ x: z.x + rand(-0.3, 0.3), y: z.y + rand(-0.3, 0.3), z: rand(0, 1), vx: 0, vy: 0, vz: 0, life: 0.3, color: i % 2 ? '#3de0e0' : '#ff2e88', float: true });
              z.x = nx;
              z.y = ny;
              sfx.glitch();
            }
          }
        }
      }

      z.kx *= Math.max(0, 1 - 7 * dt);
      z.ky *= Math.max(0, 1 - 7 * dt);
      this.moveCircle(z, (gx * speed + z.kx) * dt, (gy * speed + z.ky) * dt, r * 0.9);

      // Attacks.
      const reach = r + 0.45;
      if (z.state === 'walk' && z.kind !== 'boss' && dist < reach && z.cd <= 0 && z.spawnT <= 0) {
        z.state = 'attack';
        z.atkT = 0.35;
      }
      if (z.kind === 'boss' && dist < reach + 0.2 && z.cd <= 0) {
        z.cd = 1;
        if (P.z < 0.35) this.hurtPlayer(z.dmg);
      }
      if (z.state === 'attack') {
        z.atkT -= dt;
        if (z.atkT <= 0) {
          z.state = 'walk';
          z.cd = 0.9;
          if (dist < r + 0.75 && P.z < 0.3) this.hurtPlayer(z.dmg);
        }
      }
      // Keep out of the player's body.
      if (dist < r + 0.26 && dist > 0.001) {
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
    for (const c of this.corpses) c.t += dt;
    this.corpses = this.corpses.filter((c) => c.t < 0.5);
  }

  hurtZombie(z, dmg, nx, ny, knock) {
    if (z.dead) return;
    z.hp -= dmg;
    z.hurtT = 0.08;
    this.hitT = 0.12;
    const k = (knock * 6) / ZMASS[z.kind];
    z.kx += nx * k;
    z.ky += ny * k;
    if (dmg > 3) sfx.hit();
    if (z.hp <= 0) this.killZombie(z);
  }

  killZombie(z) {
    z.dead = true;
    this.zombies.splice(this.zombies.indexOf(z), 1);
    const base = ENEMIES[z.kind];
    const C = this.combo;
    C.n = C.t > 0 ? C.n + 1 : 1;
    C.t = COMBO_WINDOW;
    this.lv.bestCombo = Math.max(this.lv.bestCombo, C.n);
    const mult = comboMult(C.n);
    const gain = Math.round(base.score * (1 + Math.floor(this.levelN / 10)) * mult);
    this.score += gain;
    this.popups.push({ x: z.x, y: z.y, z: ZHEIGHT[z.kind] * 0.8, t: 0.9, text: `+${gain}`, big: mult > 1 });
    const call = COMBO_CALLS.find((c) => c.n === C.n);
    if (call) {
      this.comboCall = { text: call.text, mult, t: 1.6 };
      sfx.combo(COMBO_CALLS.indexOf(call));
    }
    this.lv.kills++;
    sfx.die();
    this.corpses.push({ kind: z.kind, x: z.x, y: z.y, t: 0, look: z.look, sc: z.sc });
    if (z.kind === 'bloater') this.pop(z);
    this.splats.push({ x: z.x, y: z.y, t: 14, big: z.kind === 'boss' || z.kind === 'brute', rot: rand(0, TAU) });
    if (this.splats.length > 40) this.splats.shift();
    const n = z.kind === 'boss' ? 90 : 20;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.8, z.kind === 'boss' ? 5 : 2.5);
      this.particles.push({ x: z.x, y: z.y, z: rand(0.3, 0.9), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0.5, 3), life: rand(0.5, 1.1), color: i % 2 ? '#9be04a' : PARTY[i % PARTY.length] });
    }
    if (z.kind === 'boss') {
      this.boss = null;
      this.shake = 1;
      this.flash = { color: '#ffffff', t: 0.25, amt: 0.6 };
      for (const k of ['health', 'armor', 'overclock']) this.dropPickup(z.x + rand(-0.8, 0.8), z.y + rand(-0.8, 0.8), k);
      this.emit('bossDown');
      return;
    }
    const roll = Math.random();
    const P = this.player;
    if (roll < (P.hp < 50 ? 0.09 : 0.04)) this.dropPickup(z.x, z.y, 'health');
    else if (roll < 0.115) this.dropPickup(z.x, z.y, 'armor');
    else if (roll < 0.14) this.dropPickup(z.x, z.y, 'overclock');
  }

  dropPickup(x, y, kind) {
    if (this.wallAt(x, y)) return;
    this.pickups.push({ kind, x, y, t: 14, ph: rand(0, TAU) });
  }

  updatePickups(dt) {
    const P = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (Math.hypot(p.x - P.x, p.y - P.y) < 0.55 && P.z < 0.8) {
        if (p.kind === 'health') {
          if (P.hp >= 100) continue;
          P.hp = Math.min(100, P.hp + 30);
          this.toast('+30 HEALTH', 'Volt Cola');
          this.flash = { color: '#ff6aa0', t: 0.12, amt: 0.2 };
        } else if (p.kind === 'armor') {
          P.armor = Math.min(100, P.armor + 50);
          this.toast('+50 ARMOR', 'Y2K compliant');
          this.flash = { color: '#f6c945', t: 0.12, amt: 0.2 };
        } else {
          P.overclock = 10;
          this.toast('OVERCLOCKED', '10 seconds of turbo');
          this.flash = { color: '#3de0e0', t: 0.12, amt: 0.2 };
        }
        sfx.pickup();
        this.pickups.splice(i, 1);
      }
    }
    for (const s of this.splats) s.t -= dt;
    this.splats = this.splats.filter((s) => s.t > 0);
  }

  toast(title, sub) {
    this.toastMsg = { title, sub, t: 2.2 };
  }

  startWave(i) {
    const L = this.lv;
    L.wave = i;
    L.queue = this.cfg.waves[i].slice();
    L.total = L.queue.length;
    L.phase = 'wave';
    L.spawnT = 0.3;
    this.banner = { kind: 'wave', t: 2, dur: 2 };
    sfx.wave();
  }

  updateWaves(dt) {
    const L = this.lv;
    const cfg = this.cfg;
    if (L.phase === 'done') return;
    if (L.phase === 'intro' || L.phase === 'break') {
      L.t -= dt;
      if (L.t <= 0) this.startWave(L.wave + 1);
      return;
    }
    L.spawnT -= dt;
    if (L.queue.length && L.spawnT <= 0 && this.zombies.length < cfg.maxAlive) {
      this.spawnZombie(L.queue.shift());
      L.spawnT = (cfg.spawnEvery / 1000) * rand(0.6, 1.3);
    }
    if (!L.queue.length && !this.zombies.length) {
      if (L.wave + 1 < cfg.waves.length) {
        L.phase = 'break';
        L.t = 3.5;
        this.banner = { kind: 'cleared', t: 2.4, dur: 2.4, next: clockFor(Math.min(50, this.levelN + 1)).label };
        if (this.player.hp < 70) {
          const s = this.map.start;
          this.dropPickup(s.x + rand(-1, 1), s.y + rand(-1, 1), 'health');
        }
      } else {
        L.phase = 'done';
        this.emit('clear');
      }
    }
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
      if (!p.float) p.vz -= 7 * dt;
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
}

const NEIGH8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
