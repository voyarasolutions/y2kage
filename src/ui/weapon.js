// First-person weapons, drawn as pixel-art sprites over the 3D view the way the 16-bit shooters did.
// Each hero's hands wear their iMac colour.
import { Pix, micro } from '../gfx/pix.js';
import { Rig, texture, skew } from '../gfx/model.js';
import { MUZZLE } from '../data/muzzles.js';
import { sfx } from '../audio/sfx.js';
import { LOOKS, ramp } from '../gfx/heroart.js';
import { PAL, FLAVOURS } from '../core/palette.js';
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

function screw(p, x, y) {
  p.px(x, y, PAL.steelLight).px(x + 1, y, PAL.steel).px(x, y + 1, PAL.steel).px(x + 1, y + 1, PAL.steelDark);
}

// Tina's Soaker 2500, seen from over her shoulder: a long lime barrel with an orange pump slung
// underneath, a fat pressure chamber, and a see-through reservoir on top whose water drops as she sprays.
// The body is baked once per water level; the pump and her left hand are a separate sprite that slides.
// Paste a flat sticker onto a slanted face by shearing its columns (keeps the pixel lettering crisp).
function shearOn(p, src, x, y, slope) {
  for (let cx = 0; cx < src.w; cx++) p.g.drawImage(src.c, cx, 0, 1, src.h, x + cx, y + Math.round(cx * slope), 1, src.h);
}

// Tina's Soaker 2500, held at her right hip and pointing straight ahead, seen from just above and
// behind: a long lime barrel, an orange pump she works with her left hand, a gold pressure chamber
// bulging out underneath, and a see-through reservoir on top whose water drops as she sprays.
// Three layers so the pump can slide between the gun and the tank: base, pump, tank.
const SOAK = { w: 190, h: 130, a: { x: 44, y: 10 }, b: { x: 96, y: 98 }, far: 0.36, scale: 1.45, levels: 8 };

function soakerRig() {
  return new Rig(SOAK.w, SOAK.h, SOAK.a, SOAK.b, SOAK.far, { scale: SOAK.scale });
}

function soakerDecal() {
  const d = new Pix(29, 14);
  d.rect(0, 0, 29, 14, PAL.purple).rect(1, 1, 27, 12, PAL.grape);
  micro(d, 'SOAKER', 3, 2, PAL.gold);
  micro(d, '2500', 7, 8, PAL.white);
  return d;
}

function soakerBase(L, hi) {
  const R = soakerRig();
  const lime = ramp(PAL.lime);
  const org = ramp(PAL.tangerine);
  const grape = ramp(PAL.grape);
  // Lowest first: the pressure chamber peeks out on the left, then the pump rod, barrel and body.
  R.tube(0.34, 0.86, -16, 19, 21, ramp(PAL.gold), { x: -14, round: true, stripe: (t) => (t < 0.05 || (t > 0.47 && t < 0.52) ? grape : null) });
  R.tube(0.08, 0.5, -9, 3, 3.5, ramp(PAL.steel), { shade: 'chrome' });
  R.tube(0.02, 0.62, 0, 10, 12, lime, { round: true, stripe: (t) => ((t > 0.1 && t < 0.14) || (t > 0.84 && t < 0.88) ? grape : null) });
  R.tube(0, 0.06, 0, 11, 12, org, { round: true, cap: 0.3 });
  R.tube(0.06, 0.085, 0, 13, 13, grape);
  R.box(0.46, 1.25, -2, 25, 28, lime, { shade: 'top', stripe: (t, v) => (v > 0.62 && v < 0.8 ? grape : v > -0.84 && v < -0.76 ? org : null) });
  const p = R.render();
  // Pressure gauge on the side of the chamber, trigger guard edge, and her right hand on the grip.
  const g = R.at(0.62, -10, -34);
  p.oval(Math.round(g.x), Math.round(g.y), 5, 4, PAL.steelDark).oval(Math.round(g.x), Math.round(g.y), 4, 3, PAL.cream);
  p.line(g.x, g.y, g.x + 3, g.y - 2, PAL.red).px(Math.round(g.x), Math.round(g.y), PAL.ink);
  const h = R.at(0.9, -6, 30);
  arm(p, { x: h.x + 4, y: h.y + 10 }, { x: 34, y: 60 }, L, hi);
  fist(p, Math.round(h.x - 10), Math.round(h.y - 6), L, hi, false, true);
  p.outline(PAL.ink);
  return p;
}

// The reservoir on top, baked once per water level. Water fills it from the bottom of the screen up.
function soakerTank(f) {
  const R = soakerRig();
  const grape = ramp(PAL.grape);
  const water = ramp('#3a8ae8');
  const air = ramp('#a8dcf4');
  const top = R.at(0.56, 32, 14).y - 12;
  const bot = R.at(1, 8, 14).y;
  const line = top + (1 - f) * (bot - top);
  R.box(0.62, 0.95, 8, 6, 7, grape, { shade: 'top', x: 10 });
  R.tube(0.56, 1.02, 20, 12, 13, air, {
    shade: 'glass', round: true, cap: 0.5, x: 14,
    stripe: (t, v, key, x, y) => ((t > 0.12 && t < 0.18) || (t > 0.78 && t < 0.84) ? grape : y > line ? (y < line + 1.5 && f < 0.98 ? '#dff4ff' : water) : null),
  });
  const p = R.render();
  const dc = R.at(0.8, 20, 14);
  p.draw(soakerDecal(), Math.round(dc.x - 14), Math.round(dc.y - 7));
  p.outline(PAL.ink);
  return p;
}

// The pump grip and her left hand. It is wider than the barrel, so it shows on both sides.
function soakerPump(L, hi) {
  const R = soakerRig();
  const org = ramp(PAL.tangerine);
  const ribs = ramp(PAL.tangerineDark);
  R.tube(0.2, 0.38, -5, 12.5, 14, org, { round: true, cap: 0.3, stripe: (t) => (t > 0.08 && t < 0.92 && Math.floor(t * 18) % 3 === 0 ? ribs : null) });
  const p = R.render();
  const h = R.at(0.33, -4, -16);
  arm(p, { x: h.x - 2, y: h.y + 10 }, { x: -46, y: 80 }, L, hi);
  fist(p, Math.round(h.x - 10), Math.round(h.y - 6), L, hi, true, true);
  p.outline(PAL.ink);
  return p;
}

function soaker(L, hi) {
  const tanks = [];
  return {
    base: soakerBase(L, hi),
    pump: soakerPump(L, hi),
    rig: soakerRig(),
    tank: (f) => {
      const i = Math.max(0, Math.min(SOAK.levels, Math.round(f * SOAK.levels)));
      return (tanks[i] ||= soakerTank(i / SOAK.levels));
    },
  };
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

function yoyoHand(L, hi, flip, col, rim) {
  const p = new Pix(44, 80);
  fist(p, 11, 40, L, hi, flip);
  p.outline(PAL.ink);
  const frames = [0, 1, 2, 3].map((f) => {
    const yo = new Pix(44, 70);
    yo.draw(p, 0, 0);
    yo.draw(yoyoArt(col, rim, f), 5, 2);
    // String looped over the middle finger, running up to the axle.
    yo.rect(21, 22, 1, 19, PAL.cream).px(22, 40, PAL.cream).px(20, 41, PAL.cream);
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

function floppyHand(L, hi) {
  const e = new Pix(96, 110);
  const w = { x: 50, y: 58 };
  arm(e, w, { x: 30, y: 70 }, L, hi);
  fist(e, w.x - 10, w.y - 14, L, hi, false, true);
  e.outline(PAL.ink);
  const p = new Pix(96, 110);
  const [col, label] = DISKS[0];
  tilted(p, floppyTex(col, label, 1), { x: 22, y: 14 }, { x: 34, y: -9 }, { x: 11, y: 34 }, 2);
  p.outline(PAL.ink);
  p.draw(e, 0, 0);
  return { full: p, empty: e };
}

function floppyStack(L, hi) {
  const p = new Pix(90, 90);
  const w = { x: 36, y: 50 };
  arm(p, w, { x: -24, y: 60 }, L, hi);
  const stack = new Pix(90, 90);
  for (let i = 0; i < 4; i++) {
    const [col, label] = DISKS[i + 1];
    tilted(stack, floppyTex(col, label, i), { x: 10, y: 34 - i * 4 }, { x: 44, y: -7 }, { x: 16, y: 13 }, 3);
  }
  stack.outline(PAL.ink);
  p.draw(stack, 0, 0);
  fist(p, w.x - 10, w.y - 12, L, hi, true, true);
  p.outline(PAL.ink);
  return p;
}

// Gus's firework mortar: a striped cardboard tube held at an angle on a black grip, a bottle rocket
// poking out of the end when it is loaded.
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
    if (kind === 'soaker') a = soaker(L, fl);
    if (kind === 'yoyo') a = { l: yoyoHand(L, fl, true, PAL.pink, PAL.strawberryDark), r: yoyoHand(L, fl, false, PAL.cyan, PAL.cyanDark) };
    if (kind === 'floppy') a = { r: floppyHand(L, fl), l: floppyStack(L, fl) };
    if (kind === 'rocket') a = { tube: launcher(L, fl), grip: handlebar(L, fl, PAL.strawberry, true) };
    if (kind === 'laser') a = { pen: laserPen(L, fl), bar: handlebar(L, fl, PAL.lime, false) };
    this.cache[key] = a;
    return a;
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
      // Refilling pressure: she works the pump back and forth until the tank is full again.
      const pumping = P.pumpT <= 0 && P.tank < G.tank - 0.5 && !P.down;
      const dt = Math.min(0.1, Math.max(0, t - (this.lastT ?? t)));
      this.lastT = t;
      this.pumpPh = pumping ? (this.pumpPh || 0) + dt * 7 : 0;
      const stroke = pumping ? 0.5 - 0.5 * Math.cos(this.pumpPh) : 0;
      const half = Math.floor(this.pumpPh / Math.PI);
      if (pumping && half !== this.pumpHalf && sim.isLocal(P)) sfx.pump(half % 2 === 0);
      this.pumpHalf = half;
      const rk = a.rig.slide(kick * 0.01);
      const x = MUZZLE.soaker.x - SOAK.a.x + rk.x;
      const y = MUZZLE.soaker.y - SOAK.a.y + rk.y + (pumping ? stroke : 0);
      d(a.base, x, y);
      const ps = a.rig.slide(stroke * 0.14);
      d(a.pump, x + ps.x, y + ps.y);
      d(a.tank(P.tank / G.tank), x, y);
      if (P.fireAnim > 0) {
        for (let i = 0; i < 5; i++) {
          g.fillStyle = i % 2 ? '#8fd8ff' : '#ffffff';
          g.fillRect(Math.round(x + SOAK.a.x - 1 + (Math.random() - 0.5) * 5 + bx), Math.round(y + SOAK.a.y - 2 - Math.random() * 5 + by), 2, 2);
        }
      }
    } else if (G.kind === 'yoyo') {
      const out = new Set(sim.projs.filter((p) => p.kind === 'yoyo' && p.o === sim.local && !p.orbit).map((p) => p.hand));
      const f = Math.floor(t * 10) & 3;
      const L = out.has(0) ? a.l.empty : a.l.frames[f];
      const R = out.has(1) ? a.r.empty : a.r.frames[(f + 2) & 3];
      d(L, 52, base - 74 + (out.has(0) ? -6 : 0));
      d(R, W - 96, base - 74 + (out.has(1) ? -6 : 0));
    } else if (G.kind === 'floppy') {
      const throwing = P.fireAnim > 0;
      const r = throwing ? a.r.empty : a.r.full;
      d(a.l, 20, base - 76);
      d(r, W - 128 + (throwing ? -14 : 0), base - 92 + (throwing ? -12 : 0) + (P.fireCd > 0.05 && !throwing ? 12 : 0));
    } else if (G.kind === 'rocket') {
      const loaded = P.fireCd <= 0.05;
      const tube = loaded ? a.tube.loaded : a.tube.empty;
      const tx = MUZZLE.rocket.x - TUBE.a.x;
      const ty = MUZZLE.rocket.y - TUBE.a.y + kick * 2;
      d(a.grip, 20, base - 62);
      d(tube, tx, ty);
      if (P.fireAnim > 0.1) {
        const fx = Math.round(MUZZLE.rocket.x + bx);
        const fy = Math.round(MUZZLE.rocket.y + kick * 2 + by);
        g.fillStyle = PAL.tangerine;
        g.fillRect(fx - 12, fy - 5, 24, 10);
        g.fillRect(fx - 7, fy - 10, 14, 20);
        g.fillStyle = PAL.gold;
        g.fillRect(fx - 8, fy - 3, 16, 6);
        g.fillRect(fx - 4, fy - 6, 8, 12);
        g.fillStyle = PAL.cream;
        g.fillRect(fx - 3, fy - 2, 6, 4);
      }
    } else if (G.kind === 'laser') {
      d(a.bar, 20, base - 60);
      d(a.pen, MUZZLE.laser.x - PEN.a.x, MUZZLE.laser.y - PEN.a.y + kick);
      if (sim.laser) {
        const lx = Math.round(MUZZLE.laser.x - 2 + bx);
        const ly = Math.round(MUZZLE.laser.y - 3 + kick + by);
        g.fillStyle = '#ff3b3b88';
        g.fillRect(lx - 2, ly - 2, 9, 9);
        g.fillStyle = PAL.red;
        g.fillRect(lx, ly, 5, 5);
        g.fillStyle = PAL.white;
        g.fillRect(lx + 1, ly + 1, 2, 2);
      }
    }
    return { bx, by };
  }
}
