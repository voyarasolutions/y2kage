// First-person weapons, drawn as pixel-art sprites over the 3D view the way the 16-bit shooters did.
// Each hero's hands wear their iMac colour.
import { Pix, micro } from '../gfx/pix.js';
import { yoyoPix } from '../gfx/sprites.js';
import { LOOKS, ramp } from '../gfx/heroart.js';
import { PAL, FLAVOURS } from '../core/palette.js';
import { W, H } from '../core/util.js';

// A fist seen from behind, knuckles up, three-tone shaded, in the hero's own sleeve.
// L is the hero look from heroart.js; i picks the sleeve style.
function fist(p, x, y, L, i, flip = false) {
  const s = L.skin;
  const t = L.top;
  const side = (a, w) => (flip ? x + 20 - a - w : x + a);
  // Forearm and sleeve down to the bottom of the sprite.
  const armTop = y + 13;
  const armH = p.h - armTop;
  const sleeveTop = i === 1 ? p.h : i === 3 ? armTop + 9 : armTop + 2;
  p.rect(x - 1, armTop, 22, armH, s.base);
  p.rect(side(0, 3), armTop, 3, armH, s.light);
  p.rect(side(16, 5), armTop, 5, armH, s.dark);
  if (i === 1) {
    // Marcus: bare forearm, terry wristband with two stripes.
    p.rect(x - 1, armTop + 1, 22, 6, PAL.white).rect(x - 1, armTop + 2, 22, 1, PAL.tangerine).rect(x - 1, armTop + 5, 22, 1, PAL.tangerine);
    p.rect(side(17, 4), armTop + 1, 4, 6, '#c8c8d0');
    p.px(side(10, 1), armTop + 12, s.deep).px(side(12, 1), armTop + 16, s.deep);
  } else {
    const w = 24 + (i === 0 ? 2 : 0);
    const sx = x - 2 - (i === 0 ? 1 : 0);
    p.rect(sx, sleeveTop, w, p.h - sleeveTop, t.base);
    p.rect(flip ? sx + w - 4 : sx, sleeveTop, 4, p.h - sleeveTop, t.light);
    p.rect(flip ? sx : sx + w - 6, sleeveTop, 6, p.h - sleeveTop, t.dark);
    p.rect(sx, sleeveTop, w, 2, t.dark).rect(sx, sleeveTop + 2, w, 1, t.deep);
    if (i === 0) {
      // Tina: windbreaker cuff with a pink stripe.
      p.rect(sx, sleeveTop + 7, w, 3, PAL.pink).rect(sx, sleeveTop + 10, w, 1, PAL.white);
      p.rect(sx, sleeveTop, w, 2, '#20202a');
    }
    if (i === 2) {
      // Dot: chunky knit cuff.
      for (let k = sx; k < sx + w; k += 2) p.rect(k, sleeveTop, 1, 6, t.light);
      p.rect(sx, sleeveTop + 6, w, 1, t.deep);
    }
    if (i === 3) {
      // Gus: rolled plaid flannel.
      for (let yy = sleeveTop + 3; yy < p.h; yy++) {
        for (let k = sx + 1; k < sx + w - 1; k++) {
          if ((k - sx) % 5 === 2 || (yy - sleeveTop) % 5 === 3) p.px(k, yy, t.dark);
          if ((k - sx) % 5 === 2 && (yy - sleeveTop) % 5 === 3) p.px(k, yy, t.deep);
        }
      }
      p.rect(sx, sleeveTop, w, 3, t.light).rect(sx, sleeveTop + 3, w, 1, t.deep);
    }
    if (i === 4) {
      // Kev: track sleeve with two white stripes.
      const k = flip ? sx + 3 : sx + w - 9;
      p.rect(k, sleeveTop + 3, 2, p.h - sleeveTop, PAL.white).rect(k + 4, sleeveTop + 3, 2, p.h - sleeveTop, PAL.white);
      p.rect(sx, sleeveTop, w, 3, '#20202a');
    }
  }
  // Back of the hand.
  p.oval(x + 10, y + 9, 11, 7, s.base);
  p.oval(flip ? x + 13 : x + 7, y + 8, 6, 4, s.light);
  p.oval(x + 10, y + 10, 10, 5, s.base);
  p.rect(side(15, 6), y + 6, 6, 9, s.dark);
  p.rect(x + 2, y + 15, 17, 1, s.dark);
  // Tendons.
  for (let k = 0; k < 3; k++) p.rect(x + 5 + k * 5, y + 9, 1, 4, s.light);
  // Four curled fingers with knuckles catching the light.
  for (let k = 0; k < 4; k++) {
    const fx = x + 1 + k * 5;
    p.rect(fx, y + 1, 5, 6, s.base);
    p.rect(fx, y + 1, 4, 1, s.light).px(fx + 1, y + 2, s.hi);
    p.rect(fx + 4, y + 2, 1, 5, s.dark);
    p.rect(fx, y + 6, 5, 1, s.dark);
  }
  if (i === 0) {
    // Fingerless gloves: dark back of hand, bare fingers.
    p.oval(x + 10, y + 10, 10, 5, '#20202a');
    p.rect(x + 1, y + 6, 20, 2, '#20202a');
    p.rect(x + 4, y + 9, 12, 1, '#3a3a4a').px(x + 10, y + 11, PAL.pink).px(x + 11, y + 11, PAL.cyan);
  }
  // Thumb wrapping over the grip on the inside.
  const tx = flip ? x + 17 : x - 3;
  p.rect(tx, y + 4, 6, 8, s.base);
  p.rect(tx, y + 4, 6, 1, s.light).rect(flip ? tx : tx + 5, y + 5, 1, 7, s.dark);
  p.rect(flip ? tx + 1 : tx, y + 4, 2, 2, s.hi);
}

// One row of a cylinder seen from behind: highlight stripe left of centre, falloff to the right.
function cyl(p, cx, y, w, r) {
  const x0 = cx - Math.floor(w / 2);
  p.rect(x0, y, w, 1, r.base);
  p.rect(x0, y, Math.max(1, Math.round(w * 0.12)), 1, r.dark);
  p.rect(x0 + Math.round(w * 0.2), y, Math.max(1, Math.round(w * 0.14)), 1, r.light);
  p.px(x0 + Math.round(w * 0.24), y, r.hi);
  p.rect(x0 + Math.round(w * 0.66), y, Math.ceil(w * 0.34), 1, r.dark);
  p.rect(x0 + w - Math.max(1, Math.round(w * 0.1)), y, Math.max(1, Math.round(w * 0.1)), 1, r.deep);
}

function screw(p, x, y) {
  p.px(x, y, PAL.steelLight).px(x + 1, y, PAL.steel).px(x, y + 1, PAL.steel).px(x + 1, y + 1, PAL.steelDark);
}

function soaker(L, hi) {
  const p = new Pix(110, 96);
  const cx = 55;
  const lime = ramp(PAL.lime);
  const org = ramp(PAL.tangerine);
  // Barrel narrowing to the nozzle.
  for (let y = 4; y < 30; y++) cyl(p, cx, y, 10 + Math.floor((y - 4) / 8), lime);
  for (let y = 0; y < 7; y++) cyl(p, cx, y, 13, org);
  p.oval(cx, 2, 3, 1, PAL.ink).px(cx - 1, 1, '#4ab8ff');
  p.rect(cx - 6, 7, 13, 1, org.deep);
  // Pressure tank: a fat orange capsule with a see-through window.
  p.oval(cx, 34, 25, 13, org.deep);
  p.oval(cx - 1, 33, 23, 11, org.base);
  p.oval(cx + 6, 36, 16, 8, org.dark);
  p.oval(cx - 3, 32, 18, 8, org.base);
  p.oval(cx - 10, 27, 8, 3, org.light).rect(cx - 14, 26, 5, 1, org.hi);
  p.rect(cx - 13, 29, 26, 10, org.deep);
  p.rect(cx - 12, 30, 24, 8, '#1a2840');
  p.rect(cx - 12, 30, 24, 1, '#304870');
  screw(p, cx - 20, 32);
  screw(p, cx + 18, 32);
  // Body: widening down, cylinder shaded, with orange side rails.
  for (let i = 0; i < 40; i++) cyl(p, cx, 46 + i, 44 + Math.floor(i * 0.6), lime);
  for (let i = 0; i < 40; i++) {
    const w = 44 + Math.floor(i * 0.6);
    const x0 = cx - Math.floor(w / 2);
    p.rect(x0 + 1, 46 + i, 3, 1, org.base).rect(x0 + w - 4, 46 + i, 3, 1, org.dark);
  }
  p.rect(cx - 22, 46, 44, 1, lime.hi);
  // Decal plate and pressure gauge.
  p.rect(cx - 15, 51, 30, 14, lime.deep).rect(cx - 14, 52, 28, 12, '#20304a');
  micro(p, 'SOAKER', cx - 12, 53, PAL.tangerine);
  micro(p, '2000', cx - 8, 59, PAL.gold);
  p.oval(cx + 21, 57, 4, 4, PAL.steelDark).oval(cx + 21, 57, 3, 3, PAL.cream);
  p.line(cx + 21, 57, cx + 23, 55, PAL.red).px(cx + 20, 55, PAL.ink).px(cx + 19, 57, PAL.ink);
  p.rect(cx - 20, 68, 40, 2, lime.deep);
  // Ribbed pump grip.
  for (let y = 72; y < 84; y++) cyl(p, cx, y, 26, org);
  for (let y = 73; y < 84; y += 3) p.rect(cx - 12, y, 25, 1, org.deep);
  fist(p, cx - 10, 70, L, hi);
  p.outline(PAL.ink);
  return p;
}

function yoyoHand(L, hi, flip, col, rim) {
  const p = new Pix(40, 60);
  fist(p, 9, 24, L, hi, flip);
  p.outline(PAL.ink);
  const yo = new Pix(40, 60);
  yo.draw(p, 0, 0);
  const y1 = yoyoPix(col, rim, 0);
  yo.draw(y1, 12, 10, 16, 16);
  yo.px(20, 25, PAL.cream).px(20, 26, PAL.cream);
  return { empty: p, full: yo };
}

function disk(p, x, y, s, col) {
  const r = ramp(col);
  p.rect(x, y, 14 * s, 14 * s, r.base);
  p.rect(x, y, 14 * s, s, r.light).rect(x, y, s, 14 * s, r.light);
  p.rect(x + 13 * s, y, s, 14 * s, r.dark).rect(x, y + 13 * s, 14 * s, s, r.dark);
  // Sliding metal shutter.
  p.rect(x + 3 * s, y, 8 * s, 5 * s, PAL.steelLight).rect(x + 3 * s, y + 4 * s, 8 * s, s, PAL.steel);
  p.rect(x + 7 * s, y + s, 2 * s, 3 * s, PAL.steelDark);
  // Label.
  p.rect(x + 2 * s, y + 7 * s, 10 * s, 6 * s, PAL.cream);
  p.rect(x + 2 * s, y + 7 * s, 10 * s, s, PAL.strawberry);
  p.rect(x + 3 * s, y + 9 * s, 7 * s, s, '#8a8aa0').rect(x + 3 * s, y + 11 * s, 5 * s, s, '#8a8aa0');
  p.px(x + s, y + 12 * s, PAL.ink);
}

function floppyHand(L, hi) {
  const p = new Pix(64, 70);
  disk(p, 17, 4, 2, PAL.bondi);
  fist(p, 14, 26, L, hi);
  p.outline(PAL.ink);
  const e = new Pix(64, 70);
  fist(e, 14, 26, L, hi);
  e.outline(PAL.ink);
  return { full: p, empty: e };
}

function floppyStack(L, hi) {
  const p = new Pix(56, 60);
  const cols = [PAL.strawberry, PAL.gold, PAL.lime, FLAVOURS[2].base];
  cols.forEach((c, i) => {
    const r = ramp(c);
    const y = 18 - i * 4;
    p.rect(8, y, 38, 6, r.base).rect(8, y, 38, 1, r.light).rect(8, y + 5, 38, 1, r.deep).rect(40, y, 6, 6, r.dark);
    p.rect(20, y + 1, 10, 2, PAL.steelLight).px(29, y + 1, PAL.steel);
    p.rect(33, y + 2, 5, 2, PAL.cream);
  });
  fist(p, 12, 22, L, hi, true);
  p.outline(PAL.ink);
  return p;
}

function launcher(L, hi) {
  const p = new Pix(80, 100);
  const cx = 40;
  const red = ramp(PAL.strawberry);
  const crm = ramp('#f4ead0');
  // Firework tube, striped like the packaging, open end toward you.
  for (let y = 0; y < 70; y++) {
    const w = 30 + Math.floor(y * 0.25);
    const stripe = Math.floor((y + 3) / 7) % 2;
    cyl(p, cx, 10 + y, w, stripe ? red : crm);
  }
  // Star stickers and the label.
  const star = (x, y, c) => p.px(x, y - 1, c).rect(x - 1, y, 3, 1, c).px(x, y + 1, c);
  star(cx - 8, 24, PAL.gold);
  star(cx + 6, 55, PAL.cyan);
  star(cx - 5, 62, PAL.gold);
  p.rect(cx - 11, 37, 22, 9, PAL.ink).rect(cx - 10, 38, 20, 7, PAL.gold);
  micro(p, 'BOOM', cx - 8, 39, PAL.strawberryDark);
  p.oval(cx, 10, 15, 8, '#6a3a1a').oval(cx, 10, 13, 7, '#8a5a2a').oval(cx, 11, 11, 5, PAL.ink);
  p.rect(cx - 12, 7, 6, 1, '#b08050');
  fist(p, cx - 10, 66, L, hi);
  p.outline(PAL.ink);
  const loaded = new Pix(80, 100);
  loaded.draw(p, 0, 0);
  // Rocket tail in the tube: stick and red body.
  loaded.oval(cx, 9, 7, 4, red.dark).oval(cx - 1, 8, 6, 3, red.base).oval(cx - 2, 7, 2, 1, red.light);
  loaded.oval(cx, 8, 3, 2, PAL.gold).px(cx, 8, PAL.ink);
  loaded.rect(cx - 1, 1, 2, 8, PAL.goldDark).px(cx - 1, 1, PAL.gold);
  return { loaded, empty: p };
}

// Gus steers the pogo stick and Kev the scooter with their free hand: a handlebar across
// the lower screen, the stem dropping out of view, the grip in their fist.
function handlebar(L, hi, grip, ribbed) {
  const p = new Pix(150, 80);
  const r = ramp(grip);
  // Stem and clamp.
  for (let x = 128; x < 140; x++) p.rect(x, 24, 1, 56, x < 130 ? PAL.steelDark : x < 132 ? PAL.steelLight : x < 137 ? PAL.steel : PAL.steelDark);
  p.rect(126, 22, 16, 8, '#2a2a30').rect(126, 22, 16, 1, '#5a5a66').rect(127, 25, 2, 2, PAL.steel);
  // The bar, rising slightly toward the stem.
  for (let k = 0; k < 6; k++) p.line(22, 30 + k, 134, 22 + k, k < 1 ? PAL.steelLight : k < 2 ? PAL.white : k < 4 ? PAL.steel : PAL.steelDark);
  // Grip under the fist, with an end cap poking out.
  for (let y = 22; y < 37; y++) cyl(p, 20, y, 28, r);
  if (ribbed) for (let y = 23; y < 37; y += 3) p.rect(7, y, 26, 1, r.deep);
  else for (let x = 8; x < 33; x += 3) p.rect(x, 22, 1, 15, r.dark);
  p.rect(5, 22, 3, 15, '#2a2a30').px(5, 22, '#5a5a66');
  fist(p, 10, 20, L, hi, true);
  p.outline(PAL.ink);
  return p;
}

function laserPen(L, hi) {
  const p = new Pix(80, 90);
  // A chrome pen pointing into the screen, drawn in perspective (tip up and to the left).
  for (let i = 0; i < 48; i++) {
    const x = 49 - Math.floor(i * 0.62);
    const y = 60 - i;
    const w = 9 - Math.floor(i / 10);
    p.rect(x, y, w, 2, PAL.steel);
    p.px(x, y, PAL.steelDark);
    p.px(x + 1, y, PAL.white).px(x + 2, y, PAL.steelLight);
    p.px(x + w - 1, y, PAL.steelDark).px(x + w - 2, y, i % 2 ? PAL.steel : '#7a8298');
  }
  // Pocket clip, grip rings, the red button and the lens housing.
  p.line(41, 44, 30, 26, PAL.steelLight).line(42, 44, 31, 26, PAL.steelDark);
  for (let k = 0; k < 3; k++) p.line(44 - k * 3, 54 - k * 5, 51 - k * 3, 54 - k * 5, '#3a3a48');
  p.rect(37, 40, 3, 5, PAL.strawberry).px(37, 40, PAL.pinkLight);
  p.rect(18, 9, 6, 5, PAL.steelDark).rect(18, 9, 6, 1, PAL.steelLight).rect(19, 11, 3, 2, '#5a0a10');
  micro(p, 'KEV', 44, 66, PAL.lime);
  fist(p, 34, 54, L, hi);
  p.outline(PAL.ink);
  return p;
}

export class WeaponView {
  constructor() {
    this.cache = {};
  }

  art(heroIdx, kind) {
    const key = heroIdx + kind;
    if (this.cache[key]) return this.cache[key];
    const L = LOOKS[heroIdx];
    const fl = heroIdx;
    let a;
    if (kind === 'soaker') a = { gun: soaker(L, fl) };
    if (kind === 'yoyo') a = { l: yoyoHand(L, fl, true, PAL.pink, PAL.strawberryDark), r: yoyoHand(L, fl, false, PAL.cyan, PAL.cyanDark) };
    if (kind === 'floppy') a = { r: floppyHand(L, fl), l: floppyStack(L, fl) };
    if (kind === 'rocket') a = { tube: launcher(L, fl), grip: handlebar(L, fl, PAL.strawberry, true) };
    if (kind === 'laser') a = { pen: laserPen(L, fl), bar: handlebar(L, fl, PAL.lime, false) };
    this.cache[key] = a;
    return a;
  }

  // Screen-space points where yo-yo strings and the laser beam leave the hands (for the 3D lines).
  static muzzle(kind, hand) {
    if (kind === 'laser') return { x: 0.55, y: -0.62 };
    if (kind === 'yoyo') return hand ? { x: 0.62, y: -0.72 } : { x: -0.62, y: -0.72 };
    return { x: 0, y: 0 };
  }

  draw(g, sim, heroIdx, t) {
    const P = sim.player;
    const G = sim.hero.gun;
    const M = sim.hero.move;
    const a = this.art(heroIdx, G.kind);
    // Bob with the ride: skates sway, the pogo bounces, the slinky squashes.
    const sp = Math.min(1, P.speed / 4);
    let bx = Math.sin(P.stride * 2.2) * 5 * sp;
    let by = Math.abs(Math.cos(P.stride * 2.2)) * 4 * sp;
    if (M.type === 'skate' || M.type === 'board') {
      bx = Math.sin(P.stride * 1.1) * 7 * sp;
      by = 2 * sp;
    }
    if (M.type === 'pogo') by = -P.z * 14 + 6;
    if (M.type === 'slinky') by += P.charge * 18;
    if (!P.onGround && M.type !== 'pogo') by -= Math.min(12, P.vz * 2);
    if (P.dashT > 0) bx -= 10;
    const kick = P.fireAnim > 0 ? 3 : 0;
    const base = H - 16;
    const d = (p, x, y) => g.drawImage(p.c || p, Math.round(x + bx), Math.round(y + by));

    if (G.kind === 'soaker') {
      const gun = a.gun;
      const pump = P.pumpT <= 0 && P.tank < G.tank ? Math.abs(Math.sin(t * 9)) * 4 : 0;
      const x = W / 2 + 34;
      const y = base - gun.h + 10 + kick + pump;
      d(gun, x - gun.w / 2, y);
      // Water level in the tank window.
      const f = P.tank / G.tank;
      const lw = Math.round(22 * f);
      g.fillStyle = '#4ab8ff';
      g.fillRect(Math.round(x - 11 + bx), Math.round(y + 31 + by), lw, 6);
      g.fillStyle = '#bfe8ff';
      g.fillRect(Math.round(x - 11 + bx), Math.round(y + 31 + by), lw, 1);
      if (P.fireAnim > 0) {
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i % 2 ? '#8fd8ff' : '#ffffff';
          g.fillRect(Math.round(x - 2 + (Math.random() - 0.5) * 8 + bx), Math.round(y - 3 - Math.random() * 6 + by), 2, 2);
        }
      }
    } else if (G.kind === 'yoyo') {
      const out = new Set(sim.projs.filter((p) => p.kind === 'yoyo').map((p) => p.hand));
      const L = out.has(0) ? a.l.empty : a.l.full;
      const R = out.has(1) ? a.r.empty : a.r.full;
      d(L, 58, base - 52 + (out.has(0) ? -6 : 0));
      d(R, W - 98, base - 52 + (out.has(1) ? -6 : 0));
    } else if (G.kind === 'floppy') {
      const throwing = P.fireAnim > 0;
      const r = throwing ? a.r.empty : a.r.full;
      d(a.l, 44, base - 46);
      d(r, W - 130 + (throwing ? -14 : 0), base - 62 + (throwing ? -14 : 0) + (P.fireCd > 0.05 && !throwing ? 10 : 0));
    } else if (G.kind === 'rocket') {
      const loaded = P.fireCd <= 0.05;
      const tube = loaded ? a.tube.loaded : a.tube.empty;
      d(tube, W / 2 + 40 - tube.w / 2, base - tube.h + 12 + kick * 2);
      d(a.grip, 20, base - 62);
      if (P.fireAnim > 0.1) {
        const fx = Math.round(W / 2 + 40 + bx);
        const fy = Math.round(base - 100 + by);
        g.fillStyle = PAL.tangerine;
        g.fillRect(fx - 16, fy - 6, 32, 12);
        g.fillRect(fx - 10, fy - 12, 20, 24);
        g.fillStyle = PAL.gold;
        g.fillRect(fx - 11, fy - 4, 22, 8);
        g.fillRect(fx - 6, fy - 8, 12, 16);
        g.fillStyle = PAL.cream;
        g.fillRect(fx - 5, fy - 3, 10, 6);
      }
    } else if (G.kind === 'laser') {
      d(a.bar, 20, base - 60);
      d(a.pen, W / 2 + 20, base - 80 + kick);
      if (sim.laser) {
        g.fillStyle = PAL.red;
        g.fillRect(Math.round(W / 2 + 38 + bx), Math.round(base - 72 + by), 5, 5);
        g.fillStyle = PAL.white;
        g.fillRect(Math.round(W / 2 + 39 + bx), Math.round(base - 71 + by), 2, 2);
      }
    }
    return { bx, by };
  }
}
