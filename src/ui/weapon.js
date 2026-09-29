// First-person weapons, drawn as pixel-art sprites over the 3D view the way the 16-bit shooters did:
// painted parts, a Rig for the tubes, and the hero's own painted fist (gfx/art/hands.js). Each weapon has a
// second tier bought in the Upgrade Shop (CPS 2500, Pro Yo-yos, CDs, Roman candles, laser tag gun).
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
import * as YOYO_ART from '../gfx/art/yoyos.js';
import { HAND_GRIP, fistTina, fistMarcus, fistDot, fistGus, fistKev } from '../gfx/art/hands.js';

// VS's painted Soaker sprites (see gfx/art/soakers.js), and where each one's nozzle sits in it.
const IMG = {};
const FISTS = [fistTina, fistMarcus, fistDot, fistGus, fistKev];
for (const [k, src] of Object.entries({ ...SOAKER_ART, ...YOYO_ART, ...FISTS })) {
  IMG[k] = new Image();
  IMG[k].src = src;
}
const NOZZLE = { green: { x: 36, y: 10 }, cps: { x: 150, y: 43 } };
// The pump strokes were painted a little further back, so they drop to line their nozzle up.
const DROP = { cpsPumpA: 19, cpsPumpB: 19 };
import { W, H } from '../core/util.js';

// Every hand in the game is one of the painted fists (gfx/art/hands.js). Art that holds something is
// baked once the fist image has decoded; until then it is rebuilt each frame (a frame or two at most).
const handReady = (i) => IMG[i].complete && IMG[i].naturalWidth > 0;

// Draw hero i's painted fist so its grip lands on (x, y). The left hand's forearm runs off to the
// bottom left; `right` mirrors it for the right hand.
function paintedFist(p, i, x, y, right = false) {
  const img = IMG[i];
  if (!handReady(i)) return;
  const w = img.naturalWidth;
  if (!right) {
    p.g.drawImage(img, Math.round(x - HAND_GRIP.x), Math.round(y - HAND_GRIP.y));
    return;
  }
  p.g.save();
  p.g.translate(Math.round(x + HAND_GRIP.x + 1), Math.round(y - HAND_GRIP.y));
  p.g.scale(-1, 1);
  p.g.drawImage(img, 0, 0);
  p.g.restore();
}

// Give a procedural part the painted sprites' finish: light catching the top-left edges, shade on the
// bottom-right, and a soft brushy grain across the flat colours.
function paint(p, seed = 0) {
  const im = p.g.getImageData(0, 0, p.w, p.h);
  const d = im.data;
  const w = p.w;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < p.h && d[(y * w + x) * 4 + 3] > 0 && d[(y * w + x) * 4] + d[(y * w + x) * 4 + 1] + d[(y * w + x) * 4 + 2] > 110;
  const noise = (x, y) => {
    const n = Math.sin((x >> 1) * 12.9898 + (y >> 1) * 78.233 + seed * 3.1) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const k = (y * w + x) * 4;
      let f = 1 + noise(x, y) * 0.05;
      let lift = 0;
      if (!solid(x - 1, y) || !solid(x, y - 1)) lift = 0.16;
      else if (!solid(x + 1, y) || !solid(x, y + 1)) f *= 0.84;
      for (let c = 0; c < 3; c++) out[k + c] = d[k + c] * f + ([255, 244, 214][c] - d[k + c] * f) * lift;
    }
  }
  im.data.set(out);
  p.g.putImageData(im, 0, 0);
  return p;
}

// Room around a part for the fist and forearm: the part sits at (M, M) and `off` tells draw() to
// shift it back.
const M = 60;
function withFist(part, heroIdx, gx, gy, right) {
  const p = new Pix(part.w + M * 2, part.h + M * 2 + 40);
  p.draw(part, M, M);
  paintedFist(p, heroIdx, gx + M, gy + M, right);
  p.off = M;
  return p;
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
  return texture(x2(p));
}

// Textures at twice the size, so the disks can be held as big as the painted hands holding them.
function x2(p) {
  const q = new Pix(p.w * 2, p.h * 2);
  q.draw(p, 0, 0, p.w * 2, p.h * 2);
  return q;
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
  return texture(x2(p));
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
  return texture(x2(p));
}

// The disk she's about to throw, pinched upright in her right fist; `empty` is the fist alone.
const DISK_GRIP = { x: 60, y: 64 };
function floppyHand(L, hi, tier) {
  const p = new Pix(120, 110);
  if (tier) tilted(p, cdTex(0), { x: 26, y: 18 }, { x: 52, y: -13 }, { x: 16, y: 52 }, 1);
  else tilted(p, floppyTex(DISKS[0][0], DISKS[0][1], 1), { x: 28, y: 20 }, { x: 50, y: -13 }, { x: 16, y: 50 }, 3);
  p.outline(PAL.ink);
  paint(p, 1);
  return { full: withFist(p, hi, DISK_GRIP.x, DISK_GRIP.y, true), empty: withFist(new Pix(120, 110), hi, DISK_GRIP.x, DISK_GRIP.y, true) };
}

// The spares resting on her left fist: n of them (four is a full box).
const STACK_GRIP = { x: 58, y: 92 };
function floppyStack(L, hi, tier, n = 4) {
  const stack = new Pix(130, 110);
  for (let i = 0; i < n; i++) {
    const [col, label] = tier ? CASES[i] : DISKS[i + 1];
    const tx = tier ? caseTex(col, label, i) : floppyTex(col, label, i);
    tilted(stack, tx, { x: 16, y: 62 - i * 6 }, { x: 66, y: -10 }, { x: 22, y: tier ? 17 : 18 }, 4);
  }
  stack.outline(PAL.ink);
  paint(stack, 2);
  return withFist(stack, hi, STACK_GRIP.x, STACK_GRIP.y, false);
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
    const h = R.at(0.72, -4, 26);
    p.outline(PAL.ink);
    paint(p, 3);
    return withFist(p, hi, h.x + 6, h.y + 6, true);
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
  R.tube(0.02, 1.25, 0, 12, 15, paper, {
    stripe: (t, v) => {
      const k = Math.floor(t * 26 + v * 2.2) % 4;
      return k === 0 ? red : k === 2 ? blue : null;
    },
  });
  R.tube(-0.02, 0.04, 0, 12, 12, ramp('#2a1a10'), { round: true, cap: 0.35 });
  R.tube(0.05, 0.08, 0, 12.5, 12.5, ramp(PAL.gold));
  const p = R.render();
  // A little printed label: how many balls are left in it (never true).
  const lb = R.at(0.2, 0, 0);
  const tag = new Pix(17, 7);
  tag.rect(0, 0, 17, 7, PAL.cream);
  micro(tag, '10 X', 2, 1, PAL.strawberryDark);
  p.draw(tag, Math.round(lb.x - 8), Math.round(lb.y - 3));
  const h = R.at(0.5, 0, 0);
  p.outline(PAL.ink);
  paint(p, flip ? 4 : 5);
  return withFist(p, hi, h.x, h.y, !flip);
}

// Gus steers the pogo stick and Kev the scooter with their free hand: a handlebar across
// the lower screen, the stem dropping out of view, the grip in their fist.
function handlebar(L, hi, grip, ribbed) {
  const p = new Pix(190, 110);
  const r = ramp(grip);
  // Stem and clamp.
  for (let x = 168; x < 182; x++) p.rect(x, 26, 1, 84, x < 170 ? PAL.steelDark : x < 173 ? PAL.steelLight : x < 178 ? PAL.steel : PAL.steelDark);
  p.rect(165, 22, 20, 10, '#2a2a30').rect(165, 22, 20, 1, '#5a5a66').rect(167, 26, 3, 3, PAL.steel);
  // The bar, rising slightly toward the stem.
  for (let k = 0; k < 8; k++) p.line(40, 34 + k, 174, 24 + k, k < 1 ? PAL.steelLight : k < 3 ? PAL.white : k < 5 ? PAL.steel : PAL.steelDark);
  // Grip under the fist, with an end cap poking out.
  for (let y = 24; y < 44; y++) cyl(p, 44, y, 56, r);
  if (ribbed) for (let y = 25; y < 44; y += 3) p.rect(18, y, 52, 1, r.deep);
  else for (let x = 19; x < 70; x += 4) p.rect(x, 24, 1, 20, r.dark);
  p.rect(12, 24, 5, 20, '#2a2a30').px(12, 24, '#5a5a66');
  p.outline(PAL.ink);
  paint(p, 6);
  return withFist(p, hi, 46, 34, false);
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
  const h = R.at(0.62, 0, 2);
  p.outline(PAL.ink);
  paint(p, 7);
  return withFist(p, hi, h.x, h.y, true);
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
  const h = R.at(0.5, -2, 4);
  p.outline(PAL.ink);
  paint(p, 8);
  return withFist(p, hi, h.x, h.y, true);
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
  const p = new Pix(90, 260);
  const item = new Pix(90, 200);
  if (kind === 'bat') batArt(item);
  if (kind === 'keyboard') keyboardArt(item);
  if (kind === 'bottle') bottleArt(item);
  item.outline(PAL.ink);
  paint(item, 9);
  p.draw(item, 0, 0);
  paintedFist(p, hi, PIVOT.x, PIVOT.y, true);
  return p;
}

// Empty-handed: a straight-arm shove with the left hand.
function shoveArt(L, hi) {
  const p = new Pix(110, 130);
  paintedFist(p, hi, 60, 24, false);
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
    if (kind === 'yoyo') a = {};
    if (kind === 'floppy') a = { r: floppyHand(L, fl, tier), ls: [0, 1, 2, 3, 4].map((n) => floppyStack(L, fl, tier, n)) };
    if (kind === 'rocket') a = tier ? { l: romanCandle(L, fl, true), r: romanCandle(L, fl, false) } : { tube: launcher(L, fl), grip: handlebar(L, fl, PAL.strawberry, true) };
    if (kind === 'laser') a = { gun: tier ? laserTag(L, fl) : laserPen(L, fl), bar: handlebar(L, fl, PAL.lime, false) };
    if (handReady(heroIdx)) this.cache[key] = a;
    return a;
  }

  melee(heroIdx, kind) {
    const key = `m${heroIdx}${kind}`;
    if (this.cache[key]) return this.cache[key];
    const a = kind === 'shove' ? shoveArt(LOOKS[heroIdx], heroIdx) : meleeArt(LOOKS[heroIdx], heroIdx, kind);
    if (handReady(heroIdx)) this.cache[key] = a;
    return a;
  }

  // The swing: the melee weapon sweeps from the right across to the left, with a smear behind it.
  drawSwing(g, P, heroIdx, bx, by) {
    const kind = P.melee?.kind || 'shove';
    const M = MELEE[kind];
    const ph = 1 - P.swingT / M.swing;
    const art = this.melee(heroIdx, kind);
    if (kind === 'shove') {
      const k = Math.sin(Math.PI * Math.min(1, ph * 1.2));
      g.drawImage(art.c, Math.round(W * 0.28 - 24 + k * 34 + bx), Math.round(H - 40 - k * 70 + by));
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
    const d = (p, x, y) => g.drawImage(p.c || p, Math.round(x + bx - (p.off || 0)), Math.round(y + by - (p.off || 0)));

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
      d(a.ls[P.zipT > 0 ? 4 : Math.ceil((4 * Math.max(0, P.ammo - 1)) / Math.max(1, G.mag - 1))], 24, base - 140);
      d(r, W - 147 + (throwing ? -14 : 0), base - 110 + (throwing ? -12 : 0) + (P.fireCd > 0.05 && !throwing ? 12 : 0));
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
      d(a.grip, 20, base - 84);
      d(tube, MUZZLE.rocket.x - TUBE.a.x, MUZZLE.rocket.y - TUBE.a.y + kick * 2);
      if (P.fireAnim > (sim.mode === 'client' ? 0 : 0.1)) flame(g, Math.round(MUZZLE.rocket.x + bx), Math.round(MUZZLE.rocket.y + kick * 2 + by), 1, [PAL.tangerine, PAL.gold, PAL.cream]);
    } else if (G.kind === 'laser') {
      const A = tier ? TAG.a : PEN.a;
      d(a.bar, 20, base - 84);
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
