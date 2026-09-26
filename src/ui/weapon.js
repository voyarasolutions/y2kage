// First-person weapons, drawn as pixel-art sprites over the 3D view the way the 16-bit shooters did.
// Each hero's hands wear their iMac colour.
import { Pix, micro } from '../gfx/pix.js';
import { floppyIcon, yoyoPix, SKINS } from '../gfx/sprites.js';
import { PAL, FLAVOURS } from '../core/palette.js';
import { W, H } from '../core/util.js';

function shadeRows(p, x0, y0, rows, base, light, dark) {
  rows.forEach(([ox, w], i) => {
    p.rect(x0 + ox, y0 + i, w, 1, base);
    p.px(x0 + ox, y0 + i, light);
    p.px(x0 + ox + 1, y0 + i, light);
    p.px(x0 + ox + w - 1, y0 + i, dark);
    p.px(x0 + ox + w - 2, y0 + i, dark);
  });
}

// A fist seen from behind, knuckles up.
function fist(p, x, y, skin, skinD, sleeve, sleeveD, flip = false) {
  p.rect(x - 2, y + 14, 24, 20, sleeve);
  p.rect(flip ? x - 2 : x + 18, y + 14, 4, 20, sleeveD);
  p.rect(x - 2, y + 14, 24, 2, sleeveD);
  p.oval(x + 10, y + 9, 11, 8, skin);
  for (let k = 0; k < 4; k++) {
    p.rect(x + 1 + k * 5, y + 2, 4, 5, skin);
    p.px(x + 1 + k * 5, y + 2, '#ffffff33');
    p.rect(x + 1 + k * 5 + 4, y + 3, 1, 4, skinD);
  }
  p.rect(x + 2, y + 13, 16, 1, skinD);
  p.rect(flip ? x + 17 : x - 1, y + 5, 4, 7, skin);
}

function soaker(skin, skinD, fl) {
  const p = new Pix(110, 96);
  const cx = 55;
  // Barrel narrowing to the nozzle.
  p.rect(cx - 5, 4, 10, 24, PAL.lime).rect(cx - 5, 4, 2, 24, PAL.limeLight).rect(cx + 3, 4, 2, 24, '#3f7a1e');
  p.rect(cx - 6, 0, 12, 6, PAL.tangerine).rect(cx - 6, 0, 12, 1, '#ffc27a').rect(cx - 2, 1, 4, 3, PAL.ink);
  // Pressure tank.
  p.oval(cx, 34, 24, 13, PAL.tangerineDark).oval(cx - 1, 33, 22, 11, PAL.tangerine).oval(cx - 8, 28, 8, 3, '#ffc27a');
  p.rect(cx - 12, 30, 24, 8, '#20304a');
  // Body.
  const rows = [];
  for (let i = 0; i < 40; i++) {
    const w = 44 + Math.floor(i * 0.6);
    rows.push([-Math.floor(w / 2), w]);
  }
  shadeRows(p, cx, 46, rows, PAL.lime, PAL.limeLight, '#3f7a1e');
  micro(p, 'SOAKER', cx - 12, 52, PAL.tangerine);
  micro(p, '2000', cx - 8, 59, PAL.gold);
  p.rect(cx - 20, 68, 40, 2, '#3f7a1e');
  // Pump grip and hand.
  p.rect(cx - 12, 72, 24, 10, PAL.tangerine).rect(cx - 12, 72, 24, 1, '#ffc27a');
  fist(p, cx - 10, 70, skin, skinD, fl.base, fl.dark);
  p.outline(PAL.ink);
  return p;
}

function yoyoHand(skin, skinD, fl, flip, col, rim) {
  const p = new Pix(40, 60);
  fist(p, 9, 24, skin, skinD, fl.base, fl.dark, flip);
  p.outline(PAL.ink);
  const yo = new Pix(40, 60);
  yo.draw(p, 0, 0);
  const y1 = yoyoPix(col, rim, 0);
  yo.draw(y1, 13, 12, 14, 14);
  yo.px(20, 24, PAL.cream).px(20, 25, PAL.cream);
  return { empty: p, full: yo };
}

function floppyHand(skin, skinD, fl) {
  const p = new Pix(64, 70);
  const d = new Pix(28, 28);
  floppyIcon(d, 0, 0, 2, PAL.bondi);
  p.draw(d, 18, 6);
  fist(p, 14, 26, skin, skinD, fl.base, fl.dark);
  p.outline(PAL.ink);
  const e = new Pix(64, 70);
  fist(e, 14, 26, skin, skinD, fl.base, fl.dark);
  e.outline(PAL.ink);
  return { full: p, empty: e };
}

function floppyStack(skin, skinD, fl) {
  const p = new Pix(56, 60);
  const cols = [PAL.strawberry, PAL.gold, PAL.lime, PAL.grape];
  cols.forEach((c, i) => {
    p.rect(8, 18 - i * 4, 38, 6, c);
    p.rect(8, 18 - i * 4, 38, 1, '#ffffff44');
    p.rect(20, 18 - i * 4, 10, 2, PAL.steelLight);
  });
  fist(p, 12, 22, skin, skinD, fl.base, fl.dark, true);
  p.outline(PAL.ink);
  return p;
}

function launcher(skin, skinD, fl) {
  const p = new Pix(80, 100);
  const cx = 40;
  // Firework tube, striped like the packaging, open end toward you.
  for (let y = 0; y < 70; y++) {
    const w = 30 + Math.floor(y * 0.25);
    const stripe = Math.floor((y + 3) / 7) % 2;
    p.rect(cx - Math.floor(w / 2), 10 + y, w, 1, stripe ? PAL.strawberry : PAL.cream);
    p.px(cx - Math.floor(w / 2), 10 + y, stripe ? PAL.pinkLight : PAL.white);
    p.rect(cx + Math.ceil(w / 2) - 3, 10 + y, 3, 1, stripe ? PAL.strawberryDark : '#c8b890');
  }
  p.oval(cx, 10, 15, 8, '#6a3a1a').oval(cx, 10, 12, 6, PAL.ink);
  micro(p, 'BOOM', cx - 8, 40, PAL.gold);
  fist(p, cx - 10, 66, skin, skinD, fl.base, fl.dark);
  p.outline(PAL.ink);
  const loaded = new Pix(80, 100);
  loaded.draw(p, 0, 0);
  // Rocket tail in the tube: stick and red body.
  loaded.oval(cx, 9, 7, 4, PAL.strawberry).oval(cx, 8, 5, 2, PAL.gold).px(cx, 8, PAL.ink);
  loaded.rect(cx - 1, 2, 2, 7, PAL.goldDark);
  return { loaded, empty: p };
}

function lighter(skin, skinD, fl) {
  const p = new Pix(44, 60);
  p.rect(14, 8, 12, 20, PAL.cyanDark).rect(14, 8, 3, 20, PAL.cyan).rect(14, 5, 12, 4, PAL.steel);
  fist(p, 9, 22, skin, skinD, fl.base, fl.dark, true);
  p.outline(PAL.ink);
  return p;
}

function laserPen(skin, skinD, fl) {
  const p = new Pix(80, 90);
  // A silver pen pointing into the screen, drawn in perspective (tip up and to the left).
  for (let i = 0; i < 48; i++) {
    const x = 50 - Math.floor(i * 0.62);
    const y = 60 - i;
    const w = 7 - Math.floor(i / 12);
    p.rect(x, y, w, 2, PAL.steel);
    p.px(x, y, PAL.steelLight);
    p.px(x + w - 1, y, PAL.steelDark);
  }
  p.rect(20, 10, 4, 4, PAL.steelDark);
  p.rect(38, 42, 3, 6, PAL.strawberry);
  micro(p, 'KEV', 44, 64, PAL.lime);
  fist(p, 34, 54, skin, skinD, fl.base, fl.dark);
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
    const skin = SKINS[heroIdx];
    const skinD = ['#a8704a', '#5e3a22', '#c89a70', '#8a5430', '#b88a60'][heroIdx];
    const fl = FLAVOURS[heroIdx];
    let a;
    if (kind === 'soaker') a = { gun: soaker(skin, skinD, fl) };
    if (kind === 'yoyo') a = { l: yoyoHand(skin, skinD, fl, true, PAL.pink, PAL.strawberryDark), r: yoyoHand(skin, skinD, fl, false, PAL.cyan, PAL.cyanDark) };
    if (kind === 'floppy') a = { r: floppyHand(skin, skinD, fl), l: floppyStack(skin, skinD, fl) };
    if (kind === 'rocket') a = { tube: launcher(skin, skinD, fl), lighter: lighter(skin, skinD, fl) };
    if (kind === 'laser') a = { pen: laserPen(skin, skinD, fl) };
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
      const y = base - gun.h + 22 + kick + pump;
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
      d(tube, W / 2 + 40 - tube.w / 2, base - tube.h + 24 + kick * 2);
      d(a.lighter, 70, base - 50);
      // Lighter flame flicker.
      const fx = 70 + 20 + bx;
      const fy = base - 50 + 1 + by;
      g.fillStyle = PAL.gold;
      g.fillRect(Math.round(fx - 1), Math.round(fy - 5 + Math.sin(t * 30)), 3, 5);
      g.fillStyle = PAL.cream;
      g.fillRect(Math.round(fx), Math.round(fy - 3), 1, 3);
      if (P.fireAnim > 0.1) {
        g.fillStyle = '#ffffffcc';
        g.fillRect(Math.round(W / 2 + 26 + bx), Math.round(base - 90 + by), 28, 16);
      }
    } else if (G.kind === 'laser') {
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
