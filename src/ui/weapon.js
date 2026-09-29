// First-person weapons, drawn as pixel-art sprites over the 3D view the way the 16-bit shooters did:
// flat painted parts, a Rig for the tubes, and the hero's own fist and sleeve. Each weapon has a
// second tier bought in the Upgrade Shop (CPS 2500, Pro Yo-yos, CDs, Roman candles, laser tag gun).
// Tina's Soakers are VS's own painted sprites (gfx/art/soakers.js).
import { Pix, micro } from '../gfx/pix.js';
import { Rig, texture, skew } from '../gfx/model.js';
import { MUZZLE } from '../data/muzzles.js';
import { CANDLE_COLS } from '../data/heroes.js';
import { sfx } from '../audio/sfx.js';
import { LOOKS, ramp } from '../gfx/heroart.js';
import { PAL, FLAVOURS } from '../core/palette.js';
import { MELEE, SWAP_T } from '../data/melee.js';
import * as SOAKER_ART from '../gfx/art/soakers.js';
import * as YOYO_ART from '../gfx/art/yoyos.js';

// VS's painted Soaker sprites (see gfx/art/soakers.js), and where each one's nozzle sits in it.
const IMG = {};
for (const [k, src] of Object.entries({ ...SOAKER_ART, ...YOYO_ART })) {
  IMG[k] = new Image();
  IMG[k].src = src;
}
const NOZZLE = { green: { x: 36, y: 10 }, cps: { x: 150, y: 43 } };
// The pump strokes were painted a little further back, so they drop to line their nozzle up.
const DROP = { cpsPumpA: 19, cpsPumpB: 19 };
import { W, H } from '../core/util.js';

// A fist seen from behind, knuckles up, curled round a grip at (cx, cy): four fingers over the top,
// the thumb wrapped across on the inside, shaded like VS's painted hands. L is the hero look from
// heroart.js; i picks the glove (Tina). The forearm comes from arm(), drawn first.
function fist(p, cx, cy, L, i, flip = false) {
  const s = L.skin;
  const f = new Pix(32, 26);
  // Back of the hand, lit from the top left, falling off into shadow on the far side.
  f.oval(17, 16, 13, 8, s.dark);
  f.oval(16, 15, 12, 7, s.base);
  f.oval(12, 13, 7, 4, s.light);
  f.rect(9, 12, 4, 1, s.hi);
  f.rect(6, 23, 22, 1, s.deep).rect(26, 13, 3, 9, s.dark);
  // Tendons running up to the knuckles.
  for (let k = 0; k < 3; k++) f.rect(11 + k * 5, 15, 1, 4, s.light).px(12 + k * 5, 16, s.dark);
  // Four curled fingers, the index highest, the little finger tucked lower and smaller.
  const top = [2, 1, 2, 4];
  for (let k = 0; k < 4; k++) {
    const fx = 6 + k * 6;
    const fy = top[k];
    const w = k === 3 ? 5 : 6;
    f.oval(fx + 3, fy + 3, 3, 3, s.base).rect(fx, fy + 3, w, 7 - (k === 3 ? 1 : 0), s.base);
    f.rect(fx + 1, fy, w - 3, 1, s.light).rect(fx, fy + 1, 2, 3, s.light).px(fx + 1, fy + 1, s.hi);
    f.rect(fx + w - 1, fy + 1, 1, 9, s.dark).px(fx + w - 1, fy + 3, s.deep);
    // The middle knuckle catches the light, the fold under it goes dark.
    f.rect(fx + 1, fy + 5, 3, 1, s.light).rect(fx, fy + 8, w - 1, 1, s.dark);
  }
  // Knuckle ridge where the fingers meet the back of the hand.
  for (let k = 0; k < 4; k++) f.rect(7 + k * 6, 12, 3, 1, s.light).px(8 + k * 6, 11, s.hi);
  if (i === 0) {
    // Fingerless gloves: dark back of hand, bare fingers.
    f.oval(16, 16, 12, 7, '#20202a').oval(13, 14, 7, 4, '#2e2e3a');
    f.rect(6, 11, 23, 2, '#20202a').rect(10, 13, 12, 1, '#3a3a4a');
    f.px(16, 17, PAL.pink).px(17, 17, PAL.cyan);
  }
  // Thumb wrapped over the grip on the inside, nail toward the index finger.
  f.oval(4, 10, 4, 5, s.dark);
  f.oval(4, 9, 3, 5, s.base);
  f.rect(1, 6, 2, 6, s.light).px(2, 6, s.hi);
  f.rect(5, 5, 3, 3, s.light).px(6, 5, s.hi).rect(5, 8, 3, 1, s.dark);
  f.rect(7, 6, 1, 9, s.deep);
  const x = Math.round(cx) - 16;
  const y = Math.round(cy) - 12;
  if (!flip) return p.draw(f, x, y);
  p.g.save();
  p.g.translate(x + 32, y);
  p.g.scale(-1, 1);
  p.g.drawImage(f.c, 0, 0);
  p.g.restore();
  return p;
}

// Cutouts: drop stray single pixels and fill pinholes, then ink the silhouette.
function ink(p) {
  const img = p.g.getImageData(0, 0, p.w, p.h);
  const d = img.data;
  const on = (x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h && d[(y * p.w + x) * 4 + 3] > 0;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const n = on(x - 1, y) + on(x + 1, y) + on(x, y - 1) + on(x, y + 1);
      const o = (y * p.w + x) * 4;
      if (d[o + 3] > 0 && n <= 1) d[o + 3] = 0;
      else if (!d[o + 3] && n >= 3) {
        const q = on(x - 1, y) ? o - 4 : o + 4;
        for (let c = 0; c < 4; c++) d[o + c] = d[q + c];
        if (!d[o + 3]) d[o + 3] = 255;
      }
    }
  }
  p.g.putImageData(img, 0, 0);
  return p.outline(PAL.ink);
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
  R.tube(-0.05, 0.14, 0, 10, 11, sk);
  R.tube(0.1, 1.3, 0, 13, 16, sleeve, { stripe, noEdge: true });
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
  fist(e, w.x, w.y - 7, L, hi);
  ink(e);
  const p = new Pix(96, 110);
  const [col, label] = DISKS[0];
  if (tier) tilted(p, cdTex(0), { x: 20, y: 12 }, { x: 36, y: -9 }, { x: 11, y: 36 }, 1);
  else tilted(p, floppyTex(col, label, 1), { x: 22, y: 14 }, { x: 34, y: -9 }, { x: 11, y: 34 }, 2);
  ink(p);
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
  ink(stack);
  p.draw(stack, 0, 0);
  fist(p, w.x, w.y - 5, L, hi, true);
  ink(p);
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
    // A broom handle taped along the right side for a grip.
    R.tube(0.4, 0.95, -2, 3.2, 3.6, ramp('#c08a50'), { x: 22, stripe: (t) => ((t > 0.06 && t < 0.16) || (t > 0.84 && t < 0.94) ? ramp('#8a8a96') : null) });
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
    const h = R.at(0.68, -2, 22);
    arm(p, { x: h.x + 2, y: h.y + 8 }, { x: 30, y: 64 }, L, hi);
    fist(p, h.x, h.y + 1, L, hi);
    ink(p);
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
  fist(p, h.x, h.y, L, hi, flip);
  ink(p);
  return p;
}

// Gus steers the pogo stick and Kev the scooter with their free hand: a T-bar across the lower
// screen, the stem dropping out of view in the middle, the left grip in their fist and the right one
// free under the weapon hand. The pogo's pole is painted, the scooter's is chrome with a clamp.
function handlebar(L, hi, grip, pogo) {
  const p = new Pix(W, 72);
  const r = ramp(grip);
  const st = ramp(PAL.steel);
  const c = W / 2;
  // Stem.
  for (let y = 36; y < 72; y++) cyl(p, c, y, pogo ? 16 : 11, pogo ? r : st);
  // The bar, a chrome tube lit from above.
  const bar = ['light', 'hi', 'light', 'base', 'base', 'dark', 'dark', 'deep'];
  bar.forEach((k, j) => p.rect(70, 36 + j, W - 140, 1, st[k]));
  // Clamp where the bar meets the stem.
  const cl = ramp(pogo ? PAL.steel : '#34343f');
  for (let y = 28; y < 44; y++) cyl(p, c, y, pogo ? 22 : 17, cl);
  p.rect(c - 10, 28, 20, 1, cl.hi).rect(c - 10, 43, 20, 1, cl.deep);
  if (!pogo) p.rect(c + 9, 35, 7, 3, PAL.lime).rect(c + 9, 37, 7, 1, ramp(PAL.lime).dark);
  // Grips, ribbed foam on the pogo, flanged rubber on the scooter, with end caps.
  const rows = ['light', 'hi', 'light', 'base', 'base', 'base', 'dark', 'dark', 'dark', 'deep', 'deep'];
  for (const [x0, x1] of [[40, 72], [W - 72, W - 40]]) {
    rows.forEach((k, j) => p.rect(x0, 35 + j, x1 - x0, 1, r[k]));
    for (let x = x0 + 4; x < x1 - 3; x += 3) p.rect(x, 36, 1, 10, pogo ? r.deep : r.dark);
    const cap = x0 < c ? x0 - 3 : x1;
    p.rect(cap, 35, 3, 11, '#2a2a30').rect(cap, 35, 3, 1, '#5a5a66');
    const fl = x0 < c ? x1 - 2 : x0;
    if (!pogo) p.rect(fl, 33, 2, 15, r.dark).rect(fl, 33, 2, 1, r.light);
  }
  arm(p, { x: 58, y: 48 }, { x: -18, y: 60 }, L, hi);
  fist(p, 58, 42, L, hi, true);
  ink(p);
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
  R.tube(0.42, 0.5, 10, 3.5, 3.5, ramp(PAL.strawberry), { round: true });
  const p = R.render();
  const h = R.at(0.62, 0, 2);
  arm(p, { x: h.x + 2, y: h.y + 10 }, { x: 20, y: 70 }, L, hi);
  fist(p, h.x, h.y, L, hi);
  ink(p);
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
  const lb = R.at(0.4, 1, 0);
  const d = new Pix(39, 7);
  d.rect(0, 0, 39, 7, '#20202a');
  micro(d, 'LASER TAG', 2, 1, PAL.lime);
  p.draw(d, Math.round(lb.x - 19), Math.round(lb.y - 3));
  const h = R.at(0.66, -2, 4);
  arm(p, { x: h.x + 2, y: h.y + 10 }, { x: 20, y: 70 }, L, hi);
  fist(p, h.x, h.y, L, hi);
  ink(p);
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
// Melee weapons, held in the right fist and swung across the screen. Each is drawn standing up with
// the fist at PIVOT; the swing turns the weapon around it while the forearm follows from the shoulder.
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

// The weapon and the fist gripping it, standing upright with the fist at PIVOT. The forearm is
// drawn separately (armArt) so it always reaches back to the shoulder however the swing turns.
function meleeArt(L, hi, kind) {
  const p = new Pix(90, 200);
  if (kind === 'bat') batArt(p);
  if (kind === 'keyboard') keyboardArt(p);
  if (kind === 'bottle') bottleArt(p);
  ink(p);
  fist(p, PIVOT.x, PIVOT.y - 1, L, hi);
  ink(p);
  return p;
}

// A bare fist, knuckles up, centred on (16, 12) of its sprite. flip: the left hand.
function fistArt(L, hi, flip) {
  const p = new Pix(32, 26);
  fist(p, 16, 12, L, hi, flip);
  return ink(p);
}

// A forearm in the hero's sleeve running from the wrist at w off toward the shoulder at angle ang.
const ARM_LEN = 120;
function armArt(L, hi, ang) {
  const dx = Math.cos(ang) * ARM_LEN;
  const dy = Math.sin(ang) * ARM_LEN;
  const pad = 20;
  const w = { x: pad + Math.max(0, -dx * 1.3), y: pad + Math.max(0, -dy * 1.3) };
  const p = new Pix(Math.ceil(Math.abs(dx) * 1.3 + pad * 2), Math.ceil(Math.abs(dy) * 1.3 + pad * 2));
  arm(p, w, { x: dx, y: dy }, L, hi);
  ink(p);
  return { p, w };
}

// Where the arms come from: the shoulders, just off the bottom corners of the screen.
const SHOULDER = [{ x: W * 0.06, y: H + 70 }, { x: W * 0.94, y: H + 70 }];
const ARM_STEPS = 48;

// Held melee poses: the fist as a fraction of the screen, and the weapon's lean in radians (0 upright,
// negative toward the left). idle is the batter's stance, weapon up over the right shoulder; wind
// cocks it further back; hit is the moment of contact, laid across the middle of the screen; end is
// where the follow-through carries it before it drops out and comes back up to idle.
const POSE = {
  bat: { idle: [0.68, 0.85, 0.5], wind: [0.76, 0.86, 1.05], hit: [0.6, 0.62, -1.3], end: [0.3, 0.8, -2.25] },
  keyboard: { idle: [0.7, 0.85, 0.4], wind: [0.77, 0.86, 0.9], hit: [0.6, 0.64, -1.25], end: [0.34, 0.8, -2.1] },
  bottle: { idle: [0.68, 0.86, 0.3], wind: [0.74, 0.78, 0.15], hit: [0.58, 0.64, -0.85], end: [0.38, 0.92, -1.7] },
};
const lerp = (a, b, q) => a + (b - a) * q;
const easeOut = (q) => 1 - (1 - q) * (1 - q);
const easeIn = (q) => q * q;
const smooth = (q) => q * q * (3 - 2 * q);

// Swap lowering: how far down (pixels) the weapon in hand is, and which slot is showing.
const SWAP_DROP = 150;
function swapPose(P) {
  if (!(P.swapT > 0)) return { slot: P.slot, drop: 0 };
  const half = SWAP_T / 2;
  if (P.swapT > half) return { slot: 1 - P.slot, drop: SWAP_DROP * easeIn((SWAP_T - P.swapT) / half) };
  return { slot: P.slot, drop: SWAP_DROP * easeIn(P.swapT / half) };
}

// The pose of a held weapon s seconds into its swing (0: at rest): fist position and lean. The strike
// speeds up into the contact and slows out of it; strike is set while the blow is travelling fast.
function swingPose(kind, s) {
  const M = MELEE[kind];
  const K = POSE[kind];
  const at = (A) => ({ x: A[0] * W, y: A[1] * H, a: A[2] });
  const mix = (A, B, q) => ({ x: lerp(A.x, B.x, q), y: lerp(A.y, B.y, q), a: lerp(A.a, B.a, q) });
  const idle = at(K.idle);
  if (s <= 0) return idle;
  const end = at(K.end);
  const e = M.hit + (M.hit - M.wind) * 1.2;
  if (s < M.wind) return mix(idle, at(K.wind), easeOut(s / M.wind));
  if (s < M.hit) return { ...mix(at(K.wind), at(K.hit), easeIn((s - M.wind) / (M.hit - M.wind))), strike: true };
  if (s < e) return { ...mix(at(K.hit), end, easeOut((s - M.hit) / (e - M.hit))), strike: true };
  // Follow-through: carry on past, drop out of view, and come back up at rest.
  const r = Math.min(1, (s - e) / Math.max(0.01, M.swing - e));
  if (r < 0.5) {
    const q = r / 0.5;
    return { x: end.x - 12 * easeOut(q), y: end.y + 120 * q * q, a: end.a - 0.2 * easeOut(q) };
  }
  const q = (r - 0.5) / 0.5;
  return { x: idle.x, y: idle.y + 120 * (1 - q) * (1 - q), a: idle.a };
}

// A point along the weapon, r pixels out from the fist, for a pose.
function along(o, r) {
  return { x: o.x + Math.sin(o.a) * r, y: o.y - Math.cos(o.a) * r };
}

// Fists: the guard each hand rests in, and the jab. s seconds into the punch; h the punching hand.
function fistPose(hand, s, h) {
  const M = MELEE.shove;
  const side = hand ? 1 : -1;
  const guard = { x: W / 2 + side * W * 0.25, y: H - 46 };
  if (s <= 0 || hand !== h) return guard;
  const back = { x: guard.x + side * 6, y: guard.y + 12 };
  const hit = { x: W / 2 + side * 20, y: H * 0.55 };
  if (s < M.wind) {
    const q = easeOut(s / M.wind);
    return { x: lerp(guard.x, back.x, q), y: lerp(guard.y, back.y, q) };
  }
  if (s < M.hit + 0.03) {
    const q = easeOut(Math.min(1, (s - M.wind) / (M.hit - M.wind)));
    return { x: lerp(back.x, hit.x, q), y: lerp(back.y, hit.y, q), strike: true };
  }
  const q = smooth(Math.min(1, (s - M.hit - 0.03) / (M.swing - M.hit - 0.03)));
  return { x: lerp(hit.x, guard.x, q), y: lerp(hit.y, guard.y, q) };
}

// Where a swing lands on screen, for the impact burst.
function impactStar(g, x, y, k) {
  const r = Math.round(3 + k * 9);
  g.fillStyle = PAL.gold;
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.fillRect(Math.round(x + sx * r * 0.4 - 1), Math.round(y + sy * r * 0.4 - 1), sx ? r : 3, sy ? r : 3);
  g.fillStyle = PAL.white;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let i = 2; i < r * 0.7; i++) g.fillRect(Math.round(x + sx * i), Math.round(y + sy * i), 2, 2);
  g.fillRect(Math.round(x - 3), Math.round(y - 3), 7, 7);
  g.fillStyle = PAL.cream;
  g.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
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
    if (kind === 'yoyo') a = {};
    if (kind === 'floppy') a = { r: floppyHand(L, fl, tier), ls: [0, 1, 2, 3, 4].map((n) => floppyStack(L, fl, tier, n)) };
    if (kind === 'rocket') a = tier ? { l: romanCandle(L, fl, true), r: romanCandle(L, fl, false) } : { tube: launcher(L, fl), grip: handlebar(L, fl, PAL.strawberry, true) };
    if (kind === 'laser') a = { gun: tier ? laserTag(L, fl) : laserPen(L, fl), bar: handlebar(L, fl, PAL.lime, false) };
    this.cache[key] = a;
    return a;
  }

  melee(heroIdx, kind) {
    return (this.cache[`m${heroIdx}${kind}`] ||= meleeArt(LOOKS[heroIdx], heroIdx, kind));
  }

  fistArt(heroIdx, flip) {
    return (this.cache[`f${heroIdx}${flip}`] ||= fistArt(LOOKS[heroIdx], heroIdx, flip));
  }

  // Gus and Kev keep their free hand on the pogo or scooter bar while they fight up close.
  bar(heroIdx, type) {
    return (this.cache[`b${heroIdx}${type}`] ||= handlebar(LOOKS[heroIdx], heroIdx, type === 'pogo' ? PAL.strawberry : PAL.lime, type === 'pogo'));
  }

  // The forearm from a wrist at w back to the shoulder on one side (1 right, 0 left).
  drawArm(g, heroIdx, w, side) {
    const S = SHOULDER[side];
    const step = Math.round((Math.atan2(S.y - w.y, S.x - w.x) / (Math.PI * 2)) * ARM_STEPS);
    const A = (this.cache[`a${heroIdx}${step}`] ||= armArt(LOOKS[heroIdx], heroIdx, (step / ARM_STEPS) * Math.PI * 2));
    g.drawImage(A.p.c, Math.round(w.x - A.w.x), Math.round(w.y - A.w.y));
  }

  // Slot 2 in hand: the melee weapon held at rest, or swinging; fists up in a guard, or jabbing.
  drawMelee(g, sim, P, heroIdx, t, bx, by, drop) {
    const kind = P.melee?.kind || 'shove';
    const M = MELEE[kind];
    const s = P.swingT > 0 ? M.swing - P.swingT : 0;
    const ride = P.hero.move.type;
    const bar = ride === 'pogo' || ride === 'scooter';
    const breathe = Math.sin(t * 1.8) * 1.5;
    if (bar) g.drawImage(this.bar(heroIdx, ride).c, Math.round(bx), Math.round(H - 16 - 66 + by));
    let impact = null;
    if (kind === 'shove') {
      // Alternate hands, unless the other one is steering.
      const h = bar ? 1 : (P.swingN || 0) % 2;
      for (const hand of bar ? [1] : [0, 1]) {
        const o = fistPose(hand, s, h);
        const x = o.x + bx;
        const y = o.y + by + drop + (o.strike ? 0 : breathe * (hand ? 1 : -1));
        this.drawArm(g, heroIdx, { x: x + (hand ? 2 : -2), y: y + 8 }, hand);
        g.drawImage(this.fistArt(heroIdx, !hand).c, Math.round(x - 16), Math.round(y - 12));
        if (hand === h && P.impactT > 0) impact = { x, y: y - 10 };
      }
    } else {
      const o = swingPose(kind, s);
      o.x += bx;
      o.y += by + drop + (s > 0 ? 0 : breathe);
      // A smear along the path the head just took, newest brightest.
      if (o.strike) {
        const n = 60;
        for (let k = 0; k < n; k++) {
          const q = swingPose(kind, s - 0.02 + (k / n) * 0.02);
          if (!q.strike) continue;
          g.globalAlpha = 0.1 + (k / n) * 0.35;
          g.fillStyle = k > n * 0.6 ? PAL.white : PAL.cream;
          for (let r = 118; r <= 150; r += 2) {
            const p = along(q, r);
            g.fillRect(Math.round(p.x + bx) - 1, Math.round(p.y + by + drop) - 1, 3, 3);
          }
        }
        g.globalAlpha = 1;
      }
      // The wrist sits just below the fist, turned with it.
      const wr = along(o, -9);
      this.drawArm(g, heroIdx, { x: wr.x + 2, y: wr.y }, 1);
      const a = Math.round((o.a / (Math.PI * 2)) * 96) * ((Math.PI * 2) / 96);
      g.save();
      g.translate(Math.round(o.x), Math.round(o.y));
      g.rotate(a);
      g.drawImage(this.melee(heroIdx, kind).c, -PIVOT.x, -PIVOT.y);
      g.restore();
      // The burst goes where the weapon crosses nearest the crosshair.
      if (P.impactT > 0) {
        let best = Infinity;
        for (let r = 50; r <= 140; r += 5) {
          const p = along(o, r);
          const d = Math.hypot(p.x - W / 2, p.y - H / 2);
          if (d < best) [best, impact] = [d, p];
        }
      }
    }
    // Contact: a burst where the blow lands, shrinking away.
    if (impact && P.impactT > 0) impactStar(g, impact.x, impact.y, P.impactT / 0.12);
  }

  draw(g, sim, heroIdx, t) {
    const P = sim.player;
    const G = P.hero.gun;
    const tier = G.tier || 0;
    const a = this.art(heroIdx, G.kind, tier);
    let { bx, by } = weaponBob(P);
    // Swapping slots: the one in hand drops out of view, then the other comes up.
    const sw = swapPose(P);
    if (sw.slot === 1) {
      this.drawMelee(g, sim, P, heroIdx, t, bx, by, sw.drop);
      return { bx, by };
    }
    const kick = P.fireAnim > 0 ? 3 : 0;
    // Reloading dips the gun down and back up.
    if (G.mag && P.reloadT > 0) {
      const q = 1 - P.reloadT / (P.reloadMax || G.reload);
      by += Math.sin(Math.PI * Math.min(1, Math.max(0, q))) * 30;
    }
    // Gus and Kev's handlebar stays put while the gun goes down.
    const barY = by;
    by += sw.drop;
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
      // VS's painted hands: holding the yo-yo, or empty with the string out while it's thrown.
      const pre = tier ? 'xb' : 'yo';
      const L = IMG[pre + (out.has(0) ? 'LOut' : 'LHeld')];
      const R = IMG[pre + (out.has(1) ? 'ROut' : 'RHeld')];
      const bob = (k) => Math.round(Math.sin(t * 5 + k * 2) * 1.5);
      if (L.complete && L.naturalWidth) d(L, 22, H - 6 - L.naturalHeight + (out.has(0) ? -6 : bob(0)));
      if (R.complete && R.naturalWidth) d(R, W - 22 - R.naturalWidth, H - 6 - R.naturalHeight + (out.has(1) ? -6 : bob(1)));
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
      d(a.grip, 0, base - 66 - by + barY);
      d(tube, MUZZLE.rocket.x - TUBE.a.x, MUZZLE.rocket.y - TUBE.a.y + kick * 2);
      if (P.fireAnim > (sim.mode === 'client' ? 0 : 0.1)) flame(g, Math.round(MUZZLE.rocket.x + bx), Math.round(MUZZLE.rocket.y + kick * 2 + by), 1, [PAL.tangerine, PAL.gold, PAL.cream]);
    } else if (G.kind === 'laser') {
      const A = tier ? TAG.a : PEN.a;
      d(a.bar, 0, base - 66 - by + barY);
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
    return { bx, by };
  }
}
