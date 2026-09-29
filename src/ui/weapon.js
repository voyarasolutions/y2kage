// First-person weapons, drawn as pixel-art sprites over the 3D view the way the 16-bit shooters did:
// flat painted parts, a Rig for the tubes, and the hero's own fist and sleeve. Each weapon has a
// second tier bought in the Upgrade Shop (CPS 2500, X-Brains, CDs, Roman candles, laser tag gun).
// Tina's Soakers are VS's own painted sprites (gfx/art/soakers.js).
import { Pix, micro } from '../gfx/pix.js';
import { Rig, texture, skew } from '../gfx/model.js';
import { MUZZLE } from '../data/muzzles.js';
import { CANDLE_COLS } from '../data/heroes.js';
import { sfx } from '../audio/sfx.js';
import { LOOKS, ramp } from '../gfx/heroart.js';
import { PAL, FLAVOURS } from '../core/palette.js';
import { MELEE } from '../data/melee.js';
import * as SOAKER_ART from '../gfx/art/soakers.js';

// VS's painted Soaker sprites (see gfx/art/soakers.js), and where each one's nozzle sits in it.
const IMG = {};
for (const k in SOAKER_ART) {
  IMG[k] = new Image();
  IMG[k].src = SOAKER_ART[k];
}
const NOZZLE = { green: { x: 29, y: 31 }, cps: { x: 150, y: 43 } };
// The pump strokes were painted a little further back, so they drop to line their nozzle up.
const DROP = { cpsPumpA: 19, cpsPumpB: 19 };
import { W, H } from '../core/util.js';

// A fist seen from behind, knuckles up, three-tone shaded, in the hero's own sleeve.
// L is the hero look from heroart.js; i picks the sleeve style.
function fist(p, x, y, L, i, flip = false, noArm = false) {
  const s = L.skin;
  const t = L.top;
  const side = (a, w) => (flip ? x + 20 - a - w : x + a);
  // Forearm and sleeve down to the bottom of the sprite (angled weapons draw their own with arm()).
  const armTop = noArm ? p.h : y + 13;
  const armH = p.h - armTop;
  const sleeveTop = i === 1 ? p.h : i === 3 ? armTop + 9 : armTop + 2;
  if (!noArm) {
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

// A forearm reaching in at an angle, from the wrist at w toward the edge of the screen along dir,
// in the hero's own sleeve. Drawn before the fist, which then sits on the wrist.
function arm(p, w, dir, L, i) {
  const R = new Rig(p.w, p.h, w, { x: w.x + dir.x, y: w.y + dir.y }, 0.82);
  const t = L.top;
  const sk = L.skin;
  const white = ramp('#f4f4f4');
  const dark = ramp('#20202a');
  let sleeve = t;
  let stripe = null;
  if (i === 0) stripe = (q, v) => (q < 0.08 ? dark : q < 0.16 ? ramp(PAL.pink) : q < 0.19 ? white : null);
  if (i === 1) {
    sleeve = sk;
    stripe = (q) => (q < 0.13 ? (q > 0.03 && q < 0.05) || (q > 0.09 && q < 0.11) ? ramp(PAL.tangerine) : white : null);
  }
  if (i === 2) stripe = (q, v) => (q < 0.1 && Math.floor((v + 1) * 6) % 2 ? ramp(t.light) : null);
  if (i === 3) stripe = (q, v) => (q < 0.07 ? ramp(t.light) : Math.floor(q * 22) % 4 === 0 || Math.floor((v + 1) * 5) % 3 === 0 ? ramp(t.dark) : null);
  if (i === 4) stripe = (q, v) => (q < 0.07 ? dark : v > 0.2 && v < 0.34 || v > 0.46 && v < 0.6 ? white : null);
  R.tube(-0.05, 0.14, 0, 8, 9, sk);
  R.tube(0.1, 1.3, 0, 11, 14, sleeve, { stripe, noEdge: true });
  R.render(p);
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

// Marcus's yo-yos, turned a little toward you so you see the rim, the gap between the halves, the
// shiny hub and a sticker that spins. Four frames of spin.
function yoyoArt(col, rim, f) {
  const p = new Pix(38, 40);
  const c = ramp(col);
  const cx = 17;
  const cy = 19;
  // Back half and the gap.
  p.oval(cx + 5, cy, 13, 17, c.deep).oval(cx + 4, cy, 13, 17, c.dark);
  p.oval(cx + 3, cy, 12, 16, '#1a1030');
  // Front half: rim, dished face, inner ring, chrome hub.
  p.oval(cx, cy, 13, 17, rim);
  p.oval(cx - 1, cy, 12, 16, c.base);
  p.oval(cx - 2, cy - 1, 10, 13, c.light);
  p.oval(cx - 1, cy, 9, 12, c.base);
  p.oval(cx - 1, cy, 7, 9, c.dark);
  p.oval(cx - 1, cy, 6, 8, c.base);
  // Sticker: a four-point star that turns with the spin.
  const ang = (f / 4) * Math.PI * 0.5;
  for (let k = 0; k < 4; k++) {
    const a = ang + (k * Math.PI) / 2;
    for (let r = 1; r < 7; r++) p.px(Math.round(cx - 1 + Math.cos(a) * r * 0.75), Math.round(cy + Math.sin(a) * r), k % 2 ? PAL.gold : PAL.white);
  }
  p.oval(cx - 1, cy, 2, 3, PAL.steel).px(cx - 2, cy - 1, PAL.white).px(cx, cy + 2, PAL.steelDark);
  // Gloss along the upper-left of the rim.
  p.px(cx - 9, cy - 9, PAL.white).px(cx - 8, cy - 11, PAL.white).px(cx - 10, cy - 7, PAL.white).px(cx - 11, cy - 4, c.hi).px(cx - 6, cy - 13, c.hi).px(cx - 11, cy - 2, c.hi);
  p.outline(PAL.ink);
  return p;
}

// The X-Brain: the same yo-yo in see-through plastic, so you can watch the steel clutch (the
// "brain") and the bearing spin inside it. Four frames of spin.
function xbrainArt(col, f) {
  const c = ramp(col);
  const cx = 17;
  const cy = 19;
  // The plastic, painted solid and then laid down at part strength so the hand shows through.
  const shell = new Pix(38, 40);
  shell.oval(cx + 5, cy, 13, 17, c.dark).oval(cx + 3, cy, 12, 16, c.deep);
  shell.oval(cx, cy, 13, 17, c.base).oval(cx - 1, cy, 12, 16, c.light).oval(cx - 1, cy, 9, 12, c.base);
  const p = new Pix(38, 40);
  p.g.globalAlpha = 0.62;
  p.draw(shell, 0, 0);
  p.g.globalAlpha = 1;
  // The brain: two steel clutch arms hugging a bearing, turning with the spin.
  const ang = (f / 4) * Math.PI;
  for (let k = 0; k < 2; k++) {
    const a = ang + k * Math.PI;
    for (let r = 2; r < 8; r++) {
      const b = a + r * 0.12;
      const x = Math.round(cx - 1 + Math.cos(b) * r * 0.75);
      const y = Math.round(cy + Math.sin(b) * r);
      p.px(x, y, r % 3 ? PAL.steelLight : PAL.steel).px(x + 1, y, PAL.steelDark);
    }
    p.px(Math.round(cx - 1 + Math.cos(a + 1) * 5.4), Math.round(cy + Math.sin(a + 1) * 7.5), PAL.red);
  }
  p.oval(cx - 1, cy, 3, 4, PAL.steelDark).oval(cx - 1, cy, 2, 3, PAL.steelLight).px(cx - 1, cy, PAL.ink);
  // Rim edges and gloss stay crisp.
  for (let a = 0; a < Math.PI * 2; a += 0.08) p.px(Math.round(cx + Math.cos(a) * 13), Math.round(cy + Math.sin(a) * 17), a > 2.2 && a < 4.4 ? c.hi : c.dark);
  p.px(cx - 9, cy - 9, PAL.white).px(cx - 8, cy - 11, PAL.white).px(cx - 10, cy - 7, PAL.white).px(cx - 11, cy - 4, PAL.white).px(cx - 6, cy - 13, PAL.white);
  p.outline(c.deep);
  return p;
}

// A yo-yo hanging from a fist, the forearm angling in from the bottom corner of the screen.
// flip is the left hand: its fist sits on the right of the sprite and the arm runs off to the left.
function yoyoHand(L, hi, flip, col, rim, tier) {
  const p = new Pix(96, 110);
  const fx = flip ? 63 : 11;
  const w = { x: fx + 10, y: 54 };
  arm(p, w, { x: flip ? -30 : 30, y: 64 }, L, hi);
  fist(p, fx, 40, L, hi, flip, true);
  p.outline(PAL.ink);
  const frames = [0, 1, 2, 3].map((f) => {
    const yo = new Pix(96, 110);
    yo.draw(p, 0, 0);
    yo.draw(tier ? xbrainArt(col, f) : yoyoArt(col, rim, f), fx - 6, 2);
    // String looped over the middle finger, running up to the axle.
    yo.rect(fx + 10, 22, 1, 19, PAL.cream).px(fx + 11, 40, PAL.cream).px(fx + 9, 41, PAL.cream);
    return yo;
  });
  return { empty: p, frames };
}

// Dot's floppies: a real 3.5" disk, drawn flat once and then tilted into her hand.
function floppyTex(col, label, k) {
  const r = ramp(col);
  const p = new Pix(32, 32);
  p.rect(0, 0, 32, 32, r.base);
  p.rect(0, 0, 32, 1, r.light).rect(0, 0, 1, 32, r.light).rect(31, 0, 1, 32, r.dark).rect(0, 31, 32, 1, r.dark);
  // Chamfered corner, write-protect hole and the HD hole.
  p.clear(30, 0, 2, 1).clear(31, 1, 1, 1);
  p.rect(2, 26, 3, 3, '#1a1030').rect(27, 26, 3, 3, '#1a1030').rect(27, 26, 2, 1, r.light);
  // Sliding metal shutter with the window onto the brown disk.
  p.rect(8, 0, 16, 12, PAL.steel).rect(8, 0, 16, 1, PAL.steelLight).rect(8, 11, 16, 1, PAL.steelDark).rect(23, 0, 1, 12, PAL.steelDark);
  p.rect(17, 2, 4, 8, '#1a1030').rect(18, 3, 2, 6, '#6a3a1a');
  p.rect(10, 2, 2, 1, PAL.white);
  // Label with a coloured strip and handwriting.
  p.rect(4, 14, 24, 17, PAL.cream).rect(4, 14, 24, 2, PAL.strawberry).rect(4, 30, 24, 1, '#d8ccb0');
  micro(p, label, 6, 18, '#2a2a6a');
  p.rect(6, 25, 10 + k * 3, 1, '#8a8aa0').rect(6, 27, 7 + k * 2, 1, '#8a8aa0');
  p.px(2, 2, PAL.ink).px(3, 3, PAL.ink).px(2, 3, PAL.ink);
  return texture(p);
}

// Lay a disk down with its edge showing: the dark side first, then the face on top.
function tilted(p, tex, o, ux, vx, depth) {
  const side = { w: tex.w, h: tex.h, d: new Uint8ClampedArray(tex.d.length) };
  for (let i = 0; i < tex.d.length; i += 4) {
    side.d[i] = 42;
    side.d[i + 1] = 30;
    side.d[i + 2] = 64;
    side.d[i + 3] = tex.d[i + 3];
  }
  for (let k = depth; k > 0; k--) skew(p, side, { x: o.x + k * 0.6, y: o.y + k }, ux, vx);
  skew(p, tex, o, ux, vx);
}

const DISKS = [
  [PAL.bondi, 'DOOM II'],
  [FLAVOURS[1].base, 'Y2K FIX'],
  [FLAVOURS[2].base, 'MIXTAPE'],
  [FLAVOURS[3].base, 'BACKUP'],
  [FLAVOURS[4].base, 'GAMES'],
];

// Dot's upgrade: CD-ROMs. The shiny side, a rainbow sheen across silver around a clear hub.
const SHEEN = ['#ff8fc4', '#f6c945', '#9ef07a', '#7fdcec', '#b89cff'];
function cdTex(k) {
  const p = new Pix(32, 32);
  const c = 15.5;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - 16;
      const dy = y + 0.5 - 16;
      const r = Math.hypot(dx, dy);
      if (r > c || r < 2.6) continue;
      let col = r < 6 ? '#dce8f0' : r < 7 ? '#8a96a8' : (x + y) % 7 === 0 ? '#e8eef6' : PAL.steelLight;
      // Rainbow bands along a diagonal, as if the light catches it from the top left.
      const a = Math.atan2(dy, dx) + k * 0.5;
      const band = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 10 + r * 0.12);
      if (r > 7.5 && Math.abs(Math.sin(a * 2)) > 0.72) col = SHEEN[band % SHEEN.length];
      if (r > c - 1) col = '#8a96a8';
      p.px(x, y, col);
    }
  }
  p.px(10, 8, PAL.white).px(9, 9, PAL.white).px(22, 22, PAL.white);
  return texture(p);
}

// A CD in its jewel case, for the spares in her other hand.
const CASES = [
  ['#2a6a3a', 'MYST'],
  [PAL.bondi, 'WIN 98'],
  [PAL.pink, 'NOW 3'],
  ['#1a4ab8', 'AOL 4.0'],
];
function caseTex(col, label, k) {
  const r = ramp(col);
  const p = new Pix(32, 30);
  p.rect(0, 0, 32, 30, '#c8d4e0').rect(0, 0, 32, 1, PAL.white).rect(0, 29, 32, 1, '#6a7688');
  p.rect(0, 0, 3, 30, '#2a2a34').rect(1, 0, 1, 30, '#4a4a58');
  p.rect(4, 2, 26, 26, r.base).rect(4, 2, 26, 3, r.light).rect(4, 25, 26, 3, r.dark);
  p.oval(22, 14, 6, 6, r.light).oval(22, 14, 3, 3, r.hi);
  micro(p, label, 6, 7, PAL.white);
  p.rect(6, 20, 8 + k * 3, 1, r.hi);
  p.px(28, 3, PAL.white).px(27, 4, PAL.white);
  return texture(p);
}

function floppyHand(L, hi, tier) {
  const e = new Pix(96, 110);
  const w = { x: 50, y: 58 };
  arm(e, w, { x: 30, y: 70 }, L, hi);
  fist(e, w.x - 10, w.y - 14, L, hi, false, true);
  e.outline(PAL.ink);
  const p = new Pix(96, 110);
  const [col, label] = DISKS[0];
  if (tier) tilted(p, cdTex(0), { x: 20, y: 12 }, { x: 36, y: -9 }, { x: 11, y: 36 }, 1);
  else tilted(p, floppyTex(col, label, 1), { x: 22, y: 14 }, { x: 34, y: -9 }, { x: 11, y: 34 }, 2);
  p.outline(PAL.ink);
  p.draw(e, 0, 0);
  return { full: p, empty: e };
}

// The spares in her other hand: n of them (four is a full box).
function floppyStack(L, hi, tier, n = 4) {
  const p = new Pix(90, 90);
  const w = { x: 36, y: 50 };
  arm(p, w, { x: -24, y: 60 }, L, hi);
  const stack = new Pix(90, 90);
  for (let i = 0; i < n; i++) {
    const [col, label] = tier ? CASES[i] : DISKS[i + 1];
    const tx = tier ? caseTex(col, label, i) : floppyTex(col, label, i);
    tilted(stack, tx, { x: 10, y: 34 - i * 4 }, { x: 44, y: -7 }, { x: 16, y: tier ? 12 : 13 }, 3);
  }
  stack.outline(PAL.ink);
  p.draw(stack, 0, 0);
  fist(p, w.x - 10, w.y - 12, L, hi, true, true);
  p.outline(PAL.ink);
  return p;
}

// Gus's firework mortar, held out in front like a bazooka: a striped cardboard tube pointing straight
// ahead, a bottle rocket's nose poking out when it is loaded, a fuse curling off the top.
const TUBE = { w: 170, h: 130, a: { x: 40, y: 12 }, b: { x: 90, y: 100 }, far: 0.36, scale: 1.4 };

function launcher(L, hi) {
  const make = (loaded) => {
    const R = new Rig(TUBE.w, TUBE.h, TUBE.a, TUBE.b, TUBE.far, { scale: TUBE.scale });
    const red = ramp(PAL.strawberry);
    const crm = ramp('#f4ead0');
    const gold = ramp(PAL.gold);
    R.tube(0, 1.3, 0, 17, 21, crm, {
      stripe: (t, v) => {
        if (t > 0.5 && t < 0.62) return v > -0.45 && v < 0.45 ? gold : ramp(PAL.purple);
        if ((t > 0.3 && t < 0.33 && Math.abs(v + 0.3) < 0.12) || (t > 0.72 && t < 0.75 && Math.abs(v - 0.4) < 0.12)) return gold;
        return Math.floor(t * 12) % 2 ? red : null;
      },
    });
    R.tube(0, 0.03, 0, 18, 18, ramp('#9a6a3a'));
    R.tube(0.66, 0.74, 20, 1.6, 1.6, ramp('#3a2a1a'), { x: 4 });
    if (loaded) {
      // The rocket sits in the mouth of the tube, nose toward the crosshair.
      R.tube(-0.1, 0.03, 0, 7, 8, red, { stripe: (t) => (t > 0.45 && t < 0.62 ? ramp(PAL.cream) : null) });
      R.tube(-0.17, -0.09, 0, 1.5, 7, gold, { round: true, cap: 0.6 });
    }
    const p = R.render();
    const lb = R.at(0.56, 6);
    const boom = new Pix(21, 7);
    micro(boom, 'BOOM', 2, 1, PAL.strawberryDark);
    p.draw(boom, Math.round(lb.x - 10), Math.round(lb.y - 3));
    const h = R.at(0.86, -4, 26);
    arm(p, { x: h.x + 4, y: h.y + 10 }, { x: 30, y: 64 }, L, hi);
    fist(p, Math.round(h.x - 10), Math.round(h.y - 6), L, hi, false, true);
    p.outline(PAL.ink);
    return p;
  };
  return { loaded: make(true), empty: make(false) };
}

// Gus's upgrade: a Roman candle in each fist, both aimed ahead, firing coloured balls in turn. Long
// paper tubes wrapped in a red and blue spiral, the mouths scorched black.
const CANDLE = { w: 110, h: 150, a: { x: 30, y: 10 }, b: { x: 64, y: 128 }, far: 0.42, scale: 1.2 };

function romanCandle(L, hi, flip) {
  const a = flip ? { x: CANDLE.w - CANDLE.a.x, y: CANDLE.a.y } : CANDLE.a;
  const b = flip ? { x: CANDLE.w - CANDLE.b.x, y: CANDLE.b.y } : CANDLE.b;
  const R = new Rig(CANDLE.w, CANDLE.h, a, b, CANDLE.far, { scale: CANDLE.scale });
  const paper = ramp('#f4d870');
  const red = ramp(PAL.strawberry);
  const blue = ramp('#2a5ad8');
  R.tube(0.02, 1.25, 0, 9, 12, paper, {
    stripe: (t, v) => {
      const k = Math.floor(t * 26 + v * 2.2) % 4;
      return k === 0 ? red : k === 2 ? blue : null;
    },
  });
  R.tube(-0.02, 0.04, 0, 9, 9, ramp('#2a1a10'), { round: true, cap: 0.35 });
  R.tube(0.05, 0.08, 0, 9.5, 9.5, ramp(PAL.gold));
  const p = R.render();
  // A little printed label: how many balls are left in it (never true).
  const lb = R.at(0.2, 0, 0);
  const tag = new Pix(17, 7);
  tag.rect(0, 0, 17, 7, PAL.cream);
  micro(tag, '10 X', 2, 1, PAL.strawberryDark);
  p.draw(tag, Math.round(lb.x - 8), Math.round(lb.y - 3));
  const h = R.at(0.38, 0, 0);
  arm(p, { x: h.x + (flip ? -2 : 2), y: h.y + 10 }, { x: flip ? -26 : 26, y: 70 }, L, hi);
  fist(p, Math.round(h.x - 10), Math.round(h.y - 7), L, hi, flip, true);
  p.outline(PAL.ink);
  return p;
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

// Kev's laser pointer, gripped in his fist and aimed straight ahead: a chrome pen with a knurled grip,
// a pocket clip and the red button under his thumb.
const PEN = { w: 140, h: 120, a: { x: 36, y: 10 }, b: { x: 80, y: 96 }, far: 0.36, scale: 1.4 };

function laserPen(L, hi) {
  const R = new Rig(PEN.w, PEN.h, PEN.a, PEN.b, PEN.far, { scale: PEN.scale });
  const chrome = ramp(PAL.steel);
  const knurl = ramp(PAL.steelDark);
  R.tube(-0.03, 0.06, 0, 8, 8.5, ramp('#2a2a34'), { round: true, cap: 0.3 });
  R.tube(0.05, 1.2, 0, 8.5, 11, chrome, {
    shade: 'chrome',
    stripe: (t) => (t > 0.55 && t < 0.95 && Math.floor(t * 50) % 2 === 0 ? knurl : t > 0.08 && t < 0.11 ? ramp(PAL.lime) : null),
  });
  R.box(0.18, 0.5, 9, 2.4, 2.8, chrome, { shade: 'chrome', x: -7 });
  R.tube(0.36, 0.44, 10, 3.5, 3.5, ramp(PAL.strawberry), { round: true });
  const p = R.render();
  const h = R.at(0.74, 0, 2);
  arm(p, { x: h.x + 2, y: h.y + 10 }, { x: 20, y: 70 }, L, hi);
  fist(p, Math.round(h.x - 10), Math.round(h.y - 7), L, hi, false, true);
  p.outline(PAL.ink);
  return p;
}

// Kev's upgrade: a 90s laser tag blaster. Chunky grey plastic, a green lens up front, an orange
// hit-sensor dome on top and a lime stripe down the side.
const TAG = { w: 150, h: 124, a: { x: 36, y: 10 }, b: { x: 80, y: 96 }, far: 0.36, scale: 1.4 };

function laserTag(L, hi) {
  const R = new Rig(TAG.w, TAG.h, TAG.a, TAG.b, TAG.far, { scale: TAG.scale });
  const shell = ramp('#6a6a7a');
  R.tube(0.03, 0.3, 0, 8, 9.5, ramp('#34343f'));
  R.tube(0.04, 0.1, 0, 11, 11, ramp(PAL.tangerine));
  R.tube(-0.03, 0.05, 0, 7, 7.5, ramp(PAL.lime), { shade: 'glass', round: true, cap: 0.4 });
  R.box(0.22, 1.2, -1, 15, 19, shell, { round: true, cap: 0.3, shade: 'top', stripe: (t, v) => (v > 0.5 && v < 0.72 ? ramp(PAL.lime) : v < -0.82 ? ramp('#34343f') : null) });
  R.tube(0.27, 0.42, 12, 6, 7, ramp(PAL.tangerine), { shade: 'glass', round: true, cap: 0.9 });
  R.box(0.48, 0.62, 11, 4, 5, ramp('#2a2a34'), { shade: 'top' });
  const p = R.render();
  const lb = R.at(0.47, 1, 0);
  const d = new Pix(31, 7);
  d.rect(0, 0, 31, 7, '#20202a');
  micro(d, 'LASER TAG', 2, 1, PAL.lime);
  p.draw(d, Math.round(lb.x - 15), Math.round(lb.y - 3));
  const h = R.at(0.56, -2, 4);
  arm(p, { x: h.x + 2, y: h.y + 10 }, { x: 20, y: 70 }, L, hi);
  fist(p, Math.round(h.x - 10), Math.round(h.y - 7), L, hi, false, true);
  p.outline(PAL.ink);
  return p;
}

export function weaponBob(P) {
  const M = P.hero.move;
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
  return { bx, by };
}


// A burst of flame at a muzzle, in the colours given (outer, inner, core).
function flame(g, x, y, s, cols) {
  g.fillStyle = cols[0];
  g.fillRect(x - 12 * s, y - 5 * s, 24 * s, 10 * s);
  g.fillRect(x - 7 * s, y - 10 * s, 14 * s, 20 * s);
  g.fillStyle = cols[1];
  g.fillRect(x - 8 * s, y - 3 * s, 16 * s, 6 * s);
  g.fillRect(x - 4 * s, y - 6 * s, 8 * s, 12 * s);
  g.fillStyle = cols[2];
  g.fillRect(x - 3 * s, y - 2 * s, 6 * s, 4 * s);
}


// ---------------------------------------------------------------- melee
// Melee weapons, held upright in the right fist and swung across the screen. Each is drawn standing
// up with the fist at PIVOT; the swing rotates the whole sprite (arm too) around it.
const PIVOT = { x: 40, y: 150 };

function batArt(p) {
  const wood = ramp('#d8a060');
  const tape = ramp('#2a2a34');
  for (let y = 8; y < 166; y++) {
    // Barrel, a long taper, the handle, then the knob.
    const w = y < 12 ? 10 + (y - 8) * 1.5 : y < 70 ? 16 : y < 118 ? 16 - ((y - 70) / 48) * 9 : y < 160 ? 7 : 11;
    cyl(p, PIVOT.x, y, Math.round(w), y > 118 && y < 158 ? tape : wood);
  }
  // Tape wraps and the burnt-in brand.
  for (let y = 121; y < 158; y += 5) p.rect(PIVOT.x - 3, y, 7, 1, '#4a4a58');
  p.rect(PIVOT.x - 4, 40, 7, 16, '#8a5a2a').rect(PIVOT.x - 3, 42, 5, 12, '#6a3a1a');
  p.rect(PIVOT.x - 2, 44, 1, 8, '#d8a060').rect(PIVOT.x, 44, 1, 8, '#d8a060');
  // Grain.
  for (let y = 16; y < 110; y += 7) p.px(PIVOT.x + 3, y, '#b88040').px(PIVOT.x - 5, y + 3, '#b88040');
}

function keyboardArt(p) {
  // A beige PS/2 keyboard held by one end like a club, keys facing us, the cable whipping off the top.
  const x0 = PIVOT.x - 15;
  p.rect(x0, 14, 30, 150, '#d8d0b0').rect(x0, 14, 2, 150, PAL.white).rect(x0 + 27, 14, 3, 150, '#a09878').rect(x0, 162, 30, 2, '#a09878');
  for (let r = 0; r < 23; r++) {
    for (let k = 0; k < 4; k++) {
      const kx = x0 + 3 + k * 6;
      const ky = 18 + r * 6;
      p.rect(kx, ky, 5, 5, '#ece6d0').rect(kx, ky + 4, 5, 1, '#8a8470').rect(kx + 4, ky, 1, 5, '#b0a890');
    }
  }
  // Space bar down the side, and a couple of coloured keys.
  p.rect(x0 + 3, 40, 3, 40, '#ece6d0').rect(x0 + 5, 40, 1, 40, '#8a8470');
  p.rect(x0 + 21, 18, 5, 5, PAL.strawberry).rect(x0 + 15, 24, 5, 5, PAL.lime);
  p.rect(PIVOT.x, 6, 2, 8, '#4a4a58').rect(PIVOT.x + 2, 2, 6, 2, '#4a4a58').rect(PIVOT.x + 7, 0, 2, 3, '#4a4a58');
}

function bottleArt(p) {
  // Held by the neck, the heavy end out: a green champagne bottle with a label and gold foil.
  const glass = ramp('#1e5a32');
  const foil = ramp(PAL.gold);
  for (let y = 12; y < 168; y++) {
    const w = y < 16 ? 18 : y < 92 ? 24 : y < 112 ? 24 - ((y - 92) / 20) * 14 : y < 150 ? 10 : 12;
    cyl(p, PIVOT.x, y, Math.round(w), y >= 138 ? foil : glass);
  }
  p.rect(PIVOT.x - 11, 40, 22, 26, PAL.cream).rect(PIVOT.x - 11, 40, 22, 2, PAL.gold).rect(PIVOT.x - 11, 64, 22, 2, PAL.gold);
  p.rect(PIVOT.x + 6, 42, 5, 22, '#d8ccb0');
  micro(p, 'Y2K', PIVOT.x - 7, 46, PAL.strawberryDark);
  micro(p, '1999', PIVOT.x - 9, 54, PAL.ink);
  p.rect(PIVOT.x - 6, 18, 2, 60, '#5aa06e');
}

function meleeArt(L, hi, kind) {
  const p = new Pix(90, 200);
  arm(p, { x: PIVOT.x + 2, y: PIVOT.y + 8 }, { x: 34, y: 60 }, L, hi);
  const item = new Pix(90, 200);
  if (kind === 'bat') batArt(item);
  if (kind === 'keyboard') keyboardArt(item);
  if (kind === 'bottle') bottleArt(item);
  item.outline(PAL.ink);
  p.draw(item, 0, 0);
  fist(p, PIVOT.x - 10, PIVOT.y - 8, L, hi, false, true);
  p.outline(PAL.ink);
  return p;
}

// Empty-handed: a straight-arm shove with the left hand.
function shoveArt(L, hi) {
  const p = new Pix(96, 110);
  const w = { x: 46, y: 42 };
  arm(p, w, { x: -26, y: 70 }, L, hi);
  fist(p, w.x - 10, w.y - 14, L, hi, true, true);
  p.outline(PAL.ink);
  return p;
}

export class WeaponView {
  constructor() {
    this.cache = {};
  }

  art(heroIdx, kind, tier) {
    const key = `${heroIdx}${kind}${tier}`;
    if (this.cache[key]) return this.cache[key];
    const L = LOOKS[heroIdx];
    const fl = heroIdx;
    let a;
    if (kind === 'soaker') a = {};
    if (kind === 'yoyo') a = tier
      ? { l: yoyoHand(L, fl, true, '#9fd8ff', null, 1), r: yoyoHand(L, fl, false, '#ff8fc4', null, 1) }
      : { l: yoyoHand(L, fl, true, PAL.pink, PAL.strawberryDark, 0), r: yoyoHand(L, fl, false, PAL.cyan, PAL.cyanDark, 0) };
    if (kind === 'floppy') a = { r: floppyHand(L, fl, tier), ls: [0, 1, 2, 3, 4].map((n) => floppyStack(L, fl, tier, n)) };
    if (kind === 'rocket') a = tier ? { l: romanCandle(L, fl, true), r: romanCandle(L, fl, false) } : { tube: launcher(L, fl), grip: handlebar(L, fl, PAL.strawberry, true) };
    if (kind === 'laser') a = { gun: tier ? laserTag(L, fl) : laserPen(L, fl), bar: handlebar(L, fl, PAL.lime, false) };
    this.cache[key] = a;
    return a;
  }

  melee(heroIdx, kind) {
    const key = `m${heroIdx}${kind}`;
    return (this.cache[key] ||= kind === 'shove' ? shoveArt(LOOKS[heroIdx], heroIdx) : meleeArt(LOOKS[heroIdx], heroIdx, kind));
  }

  // The swing: the melee weapon sweeps from the right across to the left, with a smear behind it.
  drawSwing(g, P, heroIdx, bx, by) {
    const kind = P.melee?.kind || 'shove';
    const M = MELEE[kind];
    const ph = 1 - P.swingT / M.swing;
    const art = this.melee(heroIdx, kind);
    if (kind === 'shove') {
      const k = Math.sin(Math.PI * Math.min(1, ph * 1.2));
      g.drawImage(art.c, Math.round(W * 0.28 + k * 34 + bx), Math.round(H - 40 - k * 70 + by));
      return;
    }
    const ease = (q) => 1 - (1 - q) * (1 - q);
    const ang = (q) => 0.7 - 2.1 * ease(Math.min(1, q));
    const px = W * 0.7 + bx;
    const py = H - 30 + by - Math.sin(Math.PI * ph) * 20;
    const put = (a, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(Math.round(px), Math.round(py));
      g.rotate(a);
      g.drawImage(art.c, -PIVOT.x, -PIVOT.y);
      g.restore();
    };
    put(ang(ph - 0.2), 0.18);
    put(ang(ph - 0.1), 0.35);
    put(ang(ph), 1);
  }

  draw(g, sim, heroIdx, t) {
    const P = sim.player;
    const G = P.hero.gun;
    const tier = G.tier || 0;
    const a = this.art(heroIdx, G.kind, tier);
    let { bx, by } = weaponBob(P);
    const kick = P.fireAnim > 0 ? 3 : 0;
    // Swinging drops the weapon out of the way; reloading dips it down and back up.
    const swing = P.swingT > 0;
    if (swing) {
      const M = MELEE[P.melee?.kind || 'shove'];
      by += Math.sin(Math.PI * (1 - P.swingT / M.swing)) * 70;
    }
    if (G.mag && P.reloadT > 0) {
      const q = 1 - P.reloadT / (P.reloadMax || G.reload);
      by += Math.sin(Math.PI * Math.min(1, Math.max(0, q))) * 30;
    }
    const base = H - 16;
    const d = (p, x, y) => g.drawImage(p.c || p, Math.round(x + bx), Math.round(y + by));

    if (G.kind === 'soaker') {
      // Refilling pressure: she works the pump back and forth until the tank is full again.
      const pumping = P.pumpT <= 0 && P.tank < G.tank - 0.5 && !P.down;
      const dt = Math.min(0.1, Math.max(0, t - (this.lastT ?? t)));
      this.lastT = t;
      this.pumpPh = pumping ? (this.pumpPh || 0) + dt * 7 : 0;
      const stroke = pumping ? 0.5 - 0.5 * Math.cos(this.pumpPh) : 0;
      const half = Math.floor(this.pumpPh / Math.PI);
      if (pumping && half !== this.pumpHalf && sim.isLocal(P)) sfx.pump(half % 2 === 0);
      this.pumpHalf = half;
      // The green starter rocks with each pump; the CPS 2500 has real pump frames.
      const M = tier ? MUZZLE.soaker2 : MUZZLE.soaker;
      const N = tier ? NOZZLE.cps : NOZZLE.green;
      let img = tier ? IMG.cpsIdle : IMG.green;
      if (tier && pumping) img = stroke < 0.33 ? IMG.cpsIdle : stroke < 0.66 ? IMG.cpsPumpA : IMG.cpsPumpB;
      const x = M.x - N.x + (!tier && pumping ? stroke * 3 : 0);
      const y = M.y - N.y + kick + (!tier && pumping ? stroke * 5 : 0);
      const key = Object.keys(IMG).find((k) => IMG[k] === img);
      if (img.complete && img.naturalWidth) d(img, x, y + (DROP[key] || 0));
      if (P.fireAnim > 0) {
        for (let i = 0; i < 5 + tier * 4; i++) {
          g.fillStyle = i % 2 ? '#8fd8ff' : '#ffffff';
          g.fillRect(Math.round(M.x - 1 + (Math.random() - 0.5) * (5 + tier * 4) + bx), Math.round(M.y + kick - 2 - Math.random() * (5 + tier * 3) + by), 2, 2);
        }
      }
    } else if (G.kind === 'yoyo') {
      const out = new Set(sim.projs.filter((p) => p.kind === 'yoyo' && p.o === sim.local && !p.orbit).map((p) => p.hand));
      const f = Math.floor(t * 10) & 3;
      const L = out.has(0) ? a.l.empty : a.l.frames[f];
      const R = out.has(1) ? a.r.empty : a.r.frames[(f + 2) & 3];
      d(L, 0, base - 84 + (out.has(0) ? -6 : 0));
      d(R, W - 96, base - 84 + (out.has(1) ? -6 : 0));
    } else if (G.kind === 'floppy') {
      const throwing = P.fireAnim > 0;
      const dry = P.ammo <= 0 && P.zipT <= 0;
      const r = throwing || dry ? a.r.empty : a.r.full;
      // The spares in her left hand go down as the box empties.
      d(a.ls[P.zipT > 0 ? 4 : Math.ceil((4 * Math.max(0, P.ammo - 1)) / Math.max(1, G.mag - 1))], 20, base - 76);
      d(r, W - 128 + (throwing ? -14 : 0), base - 92 + (throwing ? -12 : 0) + (P.fireCd > 0.05 && !throwing ? 12 : 0));
    } else if (G.kind === 'rocket' && tier) {
      // The candle that just fired kicks back; the other waits its turn.
      const fired = 1 - (P.hand || 0);
      const kk = (h) => (P.fireAnim > 0 && h === fired ? 6 : 0);
      const [ml, mr] = MUZZLE.candle;
      d(a.l, ml.x - (CANDLE.w - CANDLE.a.x), ml.y - CANDLE.a.y + kk(0));
      d(a.r, mr.x - CANDLE.a.x, mr.y - CANDLE.a.y + kk(1));
      // Guests only hear that a shot went off, so they show the flash for as long as it lasts.
      if (P.fireAnim > (sim.mode === 'client' ? 0 : 0.08)) {
        const m = MUZZLE.candle[fired];
        const c = CANDLE_COLS[(P.candleN || 0) % CANDLE_COLS.length];
        flame(g, Math.round(m.x + bx), Math.round(m.y + kk(fired) + by), 0.6, [c, PAL.gold, PAL.white]);
      }
    } else if (G.kind === 'rocket') {
      const loaded = P.fireCd <= 0.05 && (P.ammo > 0 || P.zipT > 0) && !(P.reloadT > 0);
      const tube = loaded ? a.tube.loaded : a.tube.empty;
      d(a.grip, 20, base - 62);
      d(tube, MUZZLE.rocket.x - TUBE.a.x, MUZZLE.rocket.y - TUBE.a.y + kick * 2);
      if (P.fireAnim > (sim.mode === 'client' ? 0 : 0.1)) flame(g, Math.round(MUZZLE.rocket.x + bx), Math.round(MUZZLE.rocket.y + kick * 2 + by), 1, [PAL.tangerine, PAL.gold, PAL.cream]);
    } else if (G.kind === 'laser') {
      const A = tier ? TAG.a : PEN.a;
      d(a.bar, 20, base - 60);
      d(a.gun, MUZZLE.laser.x - A.x, MUZZLE.laser.y - A.y + kick);
      if (sim.laser || P.fireAnim > 0) {
        const lx = Math.round(MUZZLE.laser.x - 2 + bx);
        const ly = Math.round(MUZZLE.laser.y - 3 + kick + by);
        g.fillStyle = tier ? '#9ef07a88' : '#ff3b3b88';
        g.fillRect(lx - 2, ly - 2, 9, 9);
        g.fillStyle = tier ? PAL.lime : PAL.red;
        g.fillRect(lx, ly, 5, 5);
        g.fillStyle = PAL.white;
        g.fillRect(lx + 1, ly + 1, 2, 2);
      }
    }
    if (swing) this.drawSwing(g, P, heroIdx, bx, by - Math.sin(Math.PI * (1 - P.swingT / MELEE[P.melee?.kind || 'shove'].swing)) * 70);
    return { bx, by };
  }
}
