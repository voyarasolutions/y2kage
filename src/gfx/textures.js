// World textures: walls, floors, ceilings, sky and prop skins, all painted at 32 pixels per
// map unit and sampled with nearest filtering so every texel stays a hard square.
import * as THREE from 'three';
import { Pix, micro, microWidth, sevenSeg } from './pix.js';
import { PAL, PARTY } from '../core/palette.js';
import { mulberry32 } from '../core/util.js';

export const TPU = 32; // texels per world unit

function toTex(p, repeat = true) {
  const t = new THREE.CanvasTexture(p.c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.userData.pix = p;
  return t;
}

// ---------------------------------------------------------------- walls
function brick(rnd, w = 64, h = 64, base = '#7a2f3c', light = '#9c4450', dark = '#5a1f2e', mortar = '#3a1a2a') {
  const p = new Pix(w, h).fill(mortar);
  for (let row = 0; row < h / 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < w; x += 16) {
      const tone = rnd();
      const c = tone < 0.2 ? dark : tone > 0.85 ? light : base;
      p.rect(x + 1, row * 8 + 1, 15, 7, c);
      p.rect(x + 1, row * 8 + 1, 15, 1, tone > 0.5 ? light : c);
      if (rnd() < 0.2) p.px(x + 2 + Math.floor(rnd() * 12), row * 8 + 2 + Math.floor(rnd() * 5), dark);
    }
  }
  p.speckle(0, 0, w, h, '#2a1020', 0.02, rnd);
  return p;
}

function windowsFacade(rnd, w, h, wall, frame, opts = {}) {
  const p = new Pix(w, h).fill(wall);
  p.speckle(0, 0, w, h, frame, 0.05, rnd);
  const cw = opts.cw || 16;
  const ch = opts.ch || 16;
  for (let y = 0; y < h; y += ch) {
    for (let x = 0; x < w; x += cw) {
      const r = rnd();
      const lit = r < 0.32 ? PAL.gold : r < 0.42 ? '#8fb8ff' : r < 0.47 ? PAL.pinkLight : '#1a1426';
      const wx = x + 3;
      const wy = y + 3;
      const ww = cw - 6;
      const wh = ch - 5;
      p.rect(wx - 1, wy - 1, ww + 2, wh + 2, frame);
      p.rect(wx, wy, ww, wh, lit);
      if (lit !== '#1a1426') {
        // Half-drawn blinds, a silhouette or a TV glow.
        if (rnd() < 0.4) p.rect(wx, wy, ww, Math.floor(wh * rnd() * 0.7), '#c98f2a');
        if (rnd() < 0.2) p.rect(wx + 2, wy + wh - 5, 3, 5, '#2a1a30');
      } else if (rnd() < 0.15) p.rect(wx + 1, wy + wh - 3, ww - 2, 2, '#3a5a9a');
      p.rect(wx, wy + wh, ww, 1, frame);
    }
  }
  return p;
}

function storefronts(rnd) {
  // Four shops, 64px (2 units) each, 40px tall (1.25 units).
  const p = new Pix(256, 40);
  const shops = [
    { name: 'PIZZA', awn: [PAL.strawberry, PAL.cream], glass: '#3b2a1a', neon: PAL.red },
    { name: 'VIDEO', awn: [PAL.winNavy, PAL.gold], glass: '#1a2a4a', neon: PAL.cyan },
    { name: 'DELI 24H', awn: [PAL.lime, PAL.cream], glass: '#2a2a1a', neon: PAL.gold },
    { name: 'CD WORLD', awn: [PAL.grape, PAL.pink], glass: '#2a1a3a', neon: PAL.pink },
  ];
  shops.forEach((s, i) => {
    const x = i * 64;
    p.rect(x, 0, 64, 40, '#4a3a4a');
    p.rect(x, 0, 64, 2, '#2a1a2a');
    // Awning stripes.
    for (let k = 0; k < 64; k += 4) p.rect(x + k, 2, 4, 7, s.awn[(k / 4) % 2]);
    for (let k = 0; k < 64; k += 4) p.rect(x + k + 1, 9, 2, 1, s.awn[(k / 4) % 2]);
    p.rect(x, 10, 64, 1, '#1a0f1a');
    // Shop windows with goods.
    p.rect(x + 2, 12, 36, 24, '#2a2030');
    p.rect(x + 3, 13, 34, 22, s.glass);
    p.rect(x + 3, 13, 34, 1, '#6a6a8a');
    if (s.name === 'VIDEO') {
      for (let k = 0; k < 4; k++) p.rect(x + 5 + k * 8, 25, 6, 9, PARTY[k]);
    } else if (s.name === 'PIZZA') {
      p.oval(x + 20, 28, 7, 4, PAL.gold).oval(x + 20, 28, 5, 3, PAL.tangerine);
      p.px(x + 18, 27, PAL.strawberry).px(x + 22, 29, PAL.strawberry);
    } else if (s.name === 'CD WORLD') {
      for (let k = 0; k < 3; k++) p.oval(x + 10 + k * 10, 29, 3, 3, '#c8d0e8').px(x + 10 + k * 10, 29, '#2a1a3a');
    } else {
      for (let k = 0; k < 5; k++) p.rect(x + 6 + k * 6, 27, 4, 7, k % 2 ? PAL.lime : PAL.strawberry);
    }
    // Neon sign in the window.
    micro(p, s.name.split(' ')[0], x + 5, 15, s.neon);
    p.rect(x + 3, 21, microWidth(s.name.split(' ')[0]) + 4, 1, s.neon);
    // Door.
    p.rect(x + 42, 12, 18, 28, '#2a1a24');
    p.rect(x + 43, 13, 16, 26, '#4a3a5a');
    p.rect(x + 45, 15, 12, 12, s.glass);
    p.px(x + 56, 27, PAL.gold);
    micro(p, 'OPEN', x + 44, 30, rnd() < 0.5 ? PAL.red : PAL.lime);
    p.rect(x + 40, 38, 24, 2, '#2a1a24');
  });
  return p;
}

function posters(rnd) {
  const p = new Pix(128, 40).fill('#3a2e3e');
  const words = ['Y2K', 'RAVE', '1999', 'PARTY', 'THE END', 'BUY GOLD', 'DJ ZERO', 'LIVE', 'GLOW', 'REPENT', '2000', 'NYE'];
  let x = 0;
  while (x < 128) {
    const w = 14 + Math.floor(rnd() * 12);
    const h = 16 + Math.floor(rnd() * 12);
    const y = 4 + Math.floor(rnd() * (36 - h));
    const c = PARTY[Math.floor(rnd() * PARTY.length)];
    p.rect(x, y, w, h, c);
    p.rect(x + 1, y + h - 1, w - 1, 1, '#0006');
    const word = words[Math.floor(rnd() * words.length)];
    micro(p, word.split(' ')[0], x + 2, y + 3, c === PAL.cream || c === PAL.gold ? PAL.ink : PAL.cream);
    p.rect(x + 2, y + 10, w - 4, 1, PAL.ink);
    p.rect(x + 2, y + 12, Math.max(2, w - 8), 1, PAL.ink);
    if (rnd() < 0.5) p.px(x + 1, y + 1, '#ddd').px(x + w - 2, y + 1, '#ddd');
    if (rnd() < 0.4) p.rect(x + w - 5, y, 5, 4, '#3a2e3e');
    x += w - 2 + Math.floor(rnd() * 5);
  }
  p.speckle(0, 0, 128, 40, '#2a1e2e', 0.04, rnd);
  return p;
}

function billboardTower(rnd) {
  // Stacked billboards like the tower at the head of Times Square. 64 wide (2 units), 256 tall (8 units).
  const p = new Pix(64, 256).fill('#1a1426');
  const ads = [
    { bg: PAL.strawberry, fg: PAL.cream, t: ['COLA'] },
    { bg: PAL.winNavy, fg: PAL.gold, t: ['Y2K', 'READY?'] },
    { bg: PAL.cream, fg: PAL.strawberry, t: ['DISC', 'PLAYER'] },
    { bg: PAL.lime, fg: PAL.ink, t: ['DOT', 'COM'] },
    { bg: PAL.grape, fg: PAL.cyan, t: ['1999'] },
    { bg: PAL.gold, fg: PAL.ink, t: ['PAGER', '$29'] },
    { bg: PAL.bondi, fg: PAL.white, t: ['THINK', 'Y2K'] },
  ];
  let y = 0;
  let i = 0;
  while (y < 256) {
    const a = ads[i++ % ads.length];
    const h = 26 + Math.floor(rnd() * 14);
    p.rect(1, y + 1, 62, h - 2, a.bg);
    p.rect(1, y + 1, 62, 1, '#ffffff55');
    a.t.forEach((t, k) => micro(p, t, 32 - microWidth(t, 2) / 2, y + 5 + k * 12, a.fg, 2));
    // Bulb border.
    for (let k = 3; k < 62; k += 4) p.px(k, y + 1, PAL.gold).px(k, y + h - 2, PAL.gold);
    y += h;
  }
  return p;
}

function glassTower(rnd) {
  const p = new Pix(64, 64).fill('#1c2a4a');
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const r = rnd();
      p.rect(x + 1, y + 1, 7, 7, r < 0.25 ? '#8fb8ff' : r < 0.35 ? PAL.gold : r < 0.4 ? PAL.pink : '#2a3e6a');
      p.px(x + 1, y + 1, '#4a6aa0');
    }
  }
  for (let x = 0; x < 64; x += 8) p.rect(x, 0, 1, 64, '#0e1428');
  for (let y = 0; y < 64; y += 8) p.rect(0, y, 64, 1, '#0e1428');
  return p;
}

function subwayTile(rnd, name) {
  // 64 wide, 56 tall = the whole 1.75 unit wall.
  const p = new Pix(64, 56).fill('#d8d2bc');
  for (let y = 0; y < 56; y += 4) for (let x = (y / 4) % 2 ? 4 : 0; x < 64; x += 8) p.rect(x, y, 1, 4, '#b8b09a');
  for (let y = 0; y < 56; y += 4) p.rect(0, y, 64, 1, '#b8b09a');
  // Mosaic band with the station name.
  p.rect(0, 14, 64, 11, '#7a2f3c');
  p.rect(0, 15, 64, 9, '#c9a23a');
  p.rect(0, 16, 64, 7, '#2a5a4a');
  micro(p, name, 32 - microWidth(name) / 2, 17, PAL.cream);
  // Wainscot, grime, a gum-covered base.
  p.rect(0, 42, 64, 14, '#3a6a5a');
  p.rect(0, 42, 64, 1, '#6aa08a');
  p.speckle(0, 0, 64, 56, '#9a927a', 0.03, rnd);
  p.speckle(0, 44, 64, 12, '#1a2a24', 0.06, rnd);
  // Graffiti tag.
  if (name) {
    p.line(6, 32, 12, 28, PAL.pink).line(12, 28, 16, 34, PAL.pink).line(16, 34, 22, 29, PAL.pink);
    micro(p, 'Y2K', 40, 30, PAL.cyanDark);
  }
  return p;
}

function pillar() {
  const p = new Pix(32, 56).fill('#1f3a2c');
  p.rect(0, 0, 4, 56, '#2e5a44').rect(28, 0, 4, 56, '#142a1e');
  p.rect(12, 0, 8, 56, '#244a38');
  for (let y = 4; y < 56; y += 8) p.px(2, y, '#6a9a80').px(29, y, '#0a1a12').px(15, y, '#4a7a60');
  p.rect(0, 44, 32, 12, '#e8d24a');
  for (let x = -12; x < 32; x += 8) p.line(x, 56, x + 12, 44, '#1a1a1a').line(x + 1, 56, x + 13, 44, '#1a1a1a');
  return p;
}

export function drawRack(p, t, rnd) {
  // 64 wide (2 units), 48 tall (1.5 units). t animates the LEDs.
  p.fill('#15161c');
  for (let x = 0; x < 64; x += 32) {
    p.rect(x, 0, 2, 48, '#3a3e4a').rect(x + 30, 0, 2, 48, '#0a0a10');
    for (let y = 3; y < 46; y += 5) {
      p.rect(x + 3, y, 26, 4, '#23252e');
      p.rect(x + 3, y, 26, 1, '#3a3e4a');
      const seed = (x * 7 + y * 13) % 17;
      for (let k = 0; k < 4; k++) {
        const on = ((seed + k * 5 + Math.floor(t * (1 + ((seed + k) % 3)))) % 4) !== 0;
        const col = k === 0 ? PAL.lime : k === 3 ? (seed % 5 === 0 ? PAL.red : PAL.gold) : PAL.cyan;
        p.px(x + 5 + k * 3, y + 2, on ? col : '#1a1a20');
      }
      p.rect(x + 20, y + 1, 7, 2, '#0a0a10');
    }
  }
  if (rnd) p.speckle(0, 0, 64, 48, '#2a2e38', 0.02, rnd);
  return p;
}

function dataWall(rnd) {
  const p = new Pix(64, 48).fill('#8a8f9e');
  for (let x = 0; x < 64; x += 32) {
    p.bevel(x, 0, 32, 48, '#8a8f9e', '#b0b5c2', '#5a5f6e');
    for (let y = 6; y < 20; y += 3) p.rect(x + 6, y, 20, 1, '#4a4f5e');
  }
  p.rect(36, 26, 22, 14, PAL.gold);
  p.rect(37, 27, 20, 12, PAL.ink);
  micro(p, 'Y2K', 41, 29, PAL.gold);
  micro(p, 'TASK', 39, 34, PAL.gold);
  p.rect(6, 28, 18, 10, '#e8e8e8');
  micro(p, 'NO', 8, 30, PAL.red);
  p.rect(16, 30, 7, 5, PAL.red);
  p.speckle(0, 0, 64, 48, '#6a6f7e', 0.03, rnd);
  return p;
}

// ---------------------------------------------------------------- floors and ceilings
function asphalt(rnd) {
  const p = new Pix(64, 64).fill('#3a3548');
  p.speckle(0, 0, 64, 64, '#48425a', 0.2, rnd);
  p.speckle(0, 0, 64, 64, '#2a2636', 0.12, rnd);
  p.line(10, 50, 22, 44, '#1a1622').line(22, 44, 26, 46, '#1a1622');
  // Confetti from the party that never ended.
  for (let i = 0; i < 10; i++) p.px(Math.floor(rnd() * 64), Math.floor(rnd() * 64), PARTY[i % PARTY.length]);
  return p;
}

function sidewalk(rnd) {
  const p = new Pix(32, 32).fill('#5a5566');
  p.rect(0, 0, 32, 1, '#3a3546').rect(0, 0, 1, 32, '#3a3546');
  p.rect(0, 16, 32, 1, '#3a3546').rect(16, 0, 1, 32, '#3a3546');
  p.speckle(0, 0, 32, 32, '#6a6577', 0.12, rnd);
  p.speckle(0, 0, 32, 32, '#4a4556', 0.08, rnd);
  p.oval(22, 8, 2, 1, '#3a3546');
  for (let i = 0; i < 4; i++) p.px(Math.floor(rnd() * 32), Math.floor(rnd() * 32), PARTY[(i * 3) % PARTY.length]);
  return p;
}

function crosswalk(rnd) {
  const p = asphalt(rnd);
  for (let x = 0; x < 64; x += 16) p.rect(x + 2, 0, 9, 64, '#d8d4c8');
  p.speckle(0, 0, 64, 64, '#2a2634', 0.05, rnd);
  return p;
}

function platform(rnd) {
  const p = new Pix(32, 32).fill('#6a6a70');
  p.speckle(0, 0, 32, 32, '#7a7a80', 0.15, rnd);
  p.speckle(0, 0, 32, 32, '#505058', 0.1, rnd);
  p.oval(10, 20, 3, 2, '#44444c');
  p.px(24, 6, '#e8e8e8');
  return p;
}

function tracks(rnd) {
  const p = new Pix(32, 32).fill('#2a2622');
  p.speckle(0, 0, 32, 32, '#4a4238', 0.3, rnd);
  for (let x = 0; x < 32; x += 8) p.rect(x + 1, 0, 5, 32, '#3a2a1e');
  p.rect(0, 7, 32, 3, '#9aa0aa').rect(0, 7, 32, 1, '#d8dde6');
  p.rect(0, 22, 32, 3, '#9aa0aa').rect(0, 22, 32, 1, '#d8dde6');
  return p;
}

function edgeStrip(rnd) {
  const p = platform(rnd);
  p.rect(0, 0, 32, 12, '#e8c83a');
  for (let y = 1; y < 12; y += 3) for (let x = 1; x < 32; x += 3) p.px(x, y, '#b8982a');
  return p;
}

function raisedFloor(rnd) {
  const p = new Pix(32, 32).fill('#9aa0ae');
  p.bevel(0, 0, 32, 32, '#9aa0ae', '#c0c6d2', '#6a7080');
  for (let y = 6; y < 28; y += 4) for (let x = 6; x < 28; x += 4) p.px(x, y, '#5a6070');
  p.speckle(0, 0, 32, 32, '#8a909e', 0.05, rnd);
  return p;
}

function cableTray(rnd) {
  const p = raisedFloor(rnd);
  p.rect(0, 10, 32, 12, '#2a2e38');
  const cols = [PAL.gold, PAL.bondi, PAL.strawberry, PAL.lime];
  cols.forEach((c, i) => p.rect(0, 11 + i * 3, 32, 2, c));
  return p;
}

function roofTar(rnd) {
  const p = new Pix(32, 32).fill('#3a3440');
  p.speckle(0, 0, 32, 32, '#4a4452', 0.2, rnd);
  p.speckle(0, 0, 32, 32, '#2a2430', 0.1, rnd);
  for (let i = 0; i < 5; i++) p.px(Math.floor(rnd() * 32), Math.floor(rnd() * 32), PARTY[(i * 2) % PARTY.length]);
  return p;
}

function stage(rnd) {
  const p = new Pix(32, 32).fill('#3b1f5c');
  for (let y = 0; y < 32; y += 8) {
    p.rect(0, y, 32, 1, '#241238');
    p.rect(((y / 8) % 2) * 16, y, 1, 8, '#241238');
  }
  p.speckle(0, 0, 32, 32, '#4a2a70', 0.1, rnd);
  for (let i = 0; i < 6; i++) p.px(Math.floor(rnd() * 32), Math.floor(rnd() * 32), i % 2 ? PAL.gold : PAL.cream);
  return p;
}

function subwayCeiling(rnd) {
  const p = new Pix(64, 64).fill('#2a2a2e');
  p.speckle(0, 0, 64, 64, '#34343a', 0.15, rnd);
  p.rect(0, 28, 64, 8, '#4a4a50');
  p.rect(4, 30, 56, 4, '#f4f8e8');
  p.rect(4, 29, 56, 1, '#c8ccb8');
  return p;
}

function dropCeiling(rnd) {
  const p = new Pix(32, 32).fill('#c8c8c0');
  p.bevel(0, 0, 32, 32, '#c8c8c0', '#e0e0d8', '#8a8a84');
  p.speckle(2, 2, 28, 28, '#b0b0a8', 0.12, rnd);
  return p;
}

function lightPanel() {
  const p = new Pix(32, 32).fill('#8a8a84');
  p.rect(2, 2, 28, 28, '#f8fff0');
  for (let x = 4; x < 30; x += 4) p.rect(x, 2, 1, 28, '#d0d8c8');
  return p;
}

// ---------------------------------------------------------------- sky
function skyPanorama(district) {
  const rnd = mulberry32(77 + district.length);
  const p = new Pix(1024, 160);
  p.bands(0, 0, 1024, 160, ['#05030e', '#0e0824', '#1c1040', '#34185a', '#5a2468', '#8a3070']);
  // Stars.
  for (let i = 0; i < 380; i++) {
    const y = Math.floor(rnd() * 90);
    p.px(Math.floor(rnd() * 1024), y, rnd() < 0.2 ? PAL.gold : rnd() < 0.3 ? PAL.cyan : '#e8e0ff');
  }
  // A full moon.
  p.oval(760, 30, 9, 9, '#fff4d6').oval(757, 28, 2, 2, '#e8dcb8').oval(763, 34, 3, 2, '#e8dcb8');
  // Distant skyline silhouettes with lit windows.
  let x = 0;
  while (x < 1024) {
    const w = 10 + Math.floor(rnd() * 26);
    const h = 30 + Math.floor(rnd() * 60);
    p.rect(x, 160 - h, w, h, '#120a22');
    if (rnd() < 0.2) p.rect(x + Math.floor(w / 2) - 1, 160 - h - 10, 2, 10, '#120a22').px(x + Math.floor(w / 2) - 1, 160 - h - 11, PAL.red);
    for (let wy = 160 - h + 4; wy < 158; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < 0.18) p.px(wx, wy, rnd() < 0.8 ? '#f6c94599' : '#8fb8ff');
    x += w + Math.floor(rnd() * 4);
  }
  // Blimp with a banner.
  p.oval(300, 44, 22, 7, '#b8b0c8').oval(300, 42, 18, 4, '#d8d0e8');
  p.rect(290, 50, 20, 3, '#6a6080');
  p.rect(268, 40, 64, 9, PAL.winNavy);
  micro(p, 'HAPPY 2000', 280, 42, PAL.gold);
  return p;
}

// ---------------------------------------------------------------- jumbotron screen (redrawn live)
export function drawJumbo(p, clock, sub, t, mode) {
  p.fill('#05050a');
  const w = p.w;
  const h = p.h;
  const phase = Math.floor(t / 4) % 3;
  if (mode === 'boss') p.fill(PAL.bsod);
  else if (phase === 1) p.bands(0, 0, w, h, [PAL.grape, PAL.pink]);
  else if (phase === 2) p.fill(PAL.winTeal);
  // Content is laid out for 48px; centre it on the taller screen.
  p.g.setTransform(1, 0, 0, 1, 0, Math.floor((h - 48) / 2));
  if (mode === 'boss') {
    micro(p, 'WARNING', w / 2 - microWidth('WARNING', 2) / 2, 8, PAL.white, 2);
    micro(p, 'MILLENNIUM BUG', w / 2 - microWidth('MILLENNIUM BUG') / 2, 26, PAL.gold);
    micro(p, 'DETECTED', w / 2 - microWidth('DETECTED') / 2, 34, PAL.gold);
  } else if (phase === 0 || mode === 'clock') {
    sevenSeg(p, clock, 10, 10, 3, PAL.red, '#300808');
    micro(p, sub, w / 2 - microWidth(sub) / 2, 36, PAL.gold);
  } else if (phase === 1) {
    micro(p, 'PARTY LIKE', w / 2 - microWidth('PARTY LIKE', 2) / 2, 8, PAL.cream, 2);
    micro(p, "IT'S 1999", w / 2 - microWidth("IT'S 1999", 2) / 2, 24, PAL.gold, 2);
  } else {
    p.bevel(8, 6, w - 16, 48 - 12, PAL.winFace, PAL.white, PAL.winDark);
    p.rect(9, 7, w - 18, 7, PAL.winNavy);
    micro(p, 'Y2K.EXE', 11, 8, PAL.white);
    micro(p, 'ARE YOU', 14, 18, PAL.ink);
    micro(p, 'COMPLIANT?', 14, 25, PAL.ink);
    p.bevel(w / 2 - 12, 48 - 16, 24, 8, PAL.winFace, PAL.white, PAL.winDark);
    micro(p, 'OK', w / 2 - 3, 48 - 14, PAL.ink);
  }
  p.g.setTransform(1, 0, 0, 1, 0, 0);
  // Scanline grid so it reads as a giant LED wall.
  for (let y = 1; y < h; y += 2) p.rect(0, y, w, 1, '#00000040');
  for (let x = 2; x < w; x += 3) p.rect(x, 0, 1, h, '#00000030');
}

// ---------------------------------------------------------------- prop skins
function taxiSide(rnd) {
  const p = new Pix(64, 24).fill(PAL.gold);
  p.rect(0, 0, 64, 1, '#fff08a');
  p.rect(0, 20, 64, 4, '#6a5010');
  for (let x = 0; x < 64; x += 4) p.rect(x, 12, 2, 2, PAL.ink).rect(x + 2, 14, 2, 2, PAL.ink);
  p.rect(20, 2, 1, 18, PAL.goldDark).rect(40, 2, 1, 18, PAL.goldDark);
  micro(p, 'TAXI', 24, 4, PAL.ink);
  p.oval(12, 21, 5, 5, '#141418').oval(12, 21, 2, 2, '#8a8a90');
  p.oval(52, 21, 5, 5, '#141418').oval(52, 21, 2, 2, '#8a8a90');
  p.speckle(0, 0, 64, 18, '#c89a2a', 0.03, rnd);
  return p;
}

function taxiCabin() {
  const p = new Pix(32, 12).fill(PAL.gold);
  p.rect(2, 2, 12, 9, '#2a3a5a').rect(18, 2, 12, 9, '#2a3a5a');
  p.rect(2, 2, 12, 1, '#8fb8ff').rect(18, 2, 12, 1, '#8fb8ff');
  return p;
}

function taxiFront() {
  const p = new Pix(32, 24).fill(PAL.gold);
  p.rect(2, 8, 28, 6, '#2a2a30');
  for (let x = 3; x < 29; x += 2) p.rect(x, 9, 1, 4, '#8a8a90');
  p.rect(1, 8, 4, 4, '#fff8c8').rect(27, 8, 4, 4, '#fff8c8');
  p.rect(0, 16, 32, 4, '#6a6a70');
  p.rect(10, 17, 12, 2, '#e8e8e8');
  micro(p, 'Y2K', 11, 17, PAL.ink);
  return p;
}

function metalCan(rnd) {
  const p = new Pix(32, 24).fill('#6a707e');
  for (let x = 0; x < 32; x += 4) p.rect(x, 0, 1, 24, '#8a909e').rect(x + 2, 0, 1, 24, '#4a505e');
  p.rect(0, 0, 32, 2, '#aab0be').rect(0, 22, 32, 2, '#3a404e');
  p.speckle(0, 0, 32, 24, '#3a404e', 0.05, rnd);
  return p;
}

function trashTop(rnd) {
  const p = new Pix(16, 16).fill('#2a2a2e');
  for (let i = 0; i < 40; i++) p.px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), i % 3 ? PARTY[i % PARTY.length] : '#e8e0d0');
  return p;
}

function newsBox() {
  const p = new Pix(16, 24).fill(PAL.strawberry);
  p.rect(0, 0, 16, 1, PAL.pinkLight);
  p.rect(2, 3, 12, 9, '#e8e4d8');
  micro(p, 'Y2K', 2, 4, PAL.ink);
  p.rect(2, 10, 12, 1, PAL.ink);
  p.rect(3, 14, 10, 3, PAL.strawberryDark);
  micro(p, '25', 5, 18, PAL.cream);
  return p;
}

function barricade() {
  const p = new Pix(32, 8);
  for (let x = -8; x < 32; x += 8) {
    p.rect(x, 0, 4, 8, PAL.tangerine);
    p.rect(x + 4, 0, 4, 8, PAL.cream);
  }
  for (let x = 0; x < 32; x++) {
    const off = x % 8;
    p.rect(x, 0, 1, 8, off < 4 ? PAL.tangerine : PAL.cream);
  }
  // Diagonal stripes.
  for (let y = 0; y < 8; y++) for (let x = 0; x < 32; x++) p.px(x, y, (x + y) % 8 < 4 ? PAL.tangerine : PAL.cream);
  p.rect(0, 0, 32, 1, '#ffffff').rect(0, 7, 32, 1, '#8a4a1a');
  return p;
}

function wood() {
  const p = new Pix(32, 8).fill('#8a5a2a');
  p.rect(0, 0, 32, 1, '#b07a3a').rect(0, 7, 32, 1, '#5a3a1a');
  p.rect(6, 3, 8, 1, '#6a4a22').rect(20, 4, 6, 1, '#6a4a22');
  return p;
}

function serverSkin(t) {
  const p = new Pix(24, 32).fill('#1a1b22');
  p.rect(0, 0, 24, 1, '#4a4e5a').rect(0, 0, 1, 32, '#3a3e4a');
  for (let y = 3; y < 30; y += 4) {
    p.rect(2, y, 20, 3, '#26282f');
    const on = (Math.floor(t * 2) + y) % 3;
    p.px(4, y + 1, on ? PAL.lime : '#123').px(7, y + 1, on === 1 ? PAL.gold : '#321').px(10, y + 1, PAL.cyan);
  }
  return p;
}

function plainSkin(col, dark) {
  const p = new Pix(8, 8).fill(col);
  p.rect(0, 7, 8, 1, dark);
  return p;
}

// ---------------------------------------------------------------- street furniture and set dressing
function payphone() {
  const p = new Pix(16, 24).fill('#8a909e');
  p.rect(0, 0, 16, 2, '#1a5ab0').rect(0, 22, 16, 2, '#4a505e');
  micro(p, 'TEL', 2, 0, PAL.white);
  p.rect(2, 4, 5, 12, '#1a1a20').rect(3, 5, 3, 10, '#2a2a30');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) p.px(9 + x * 2, 5 + y * 3, '#e8e8f0');
  p.rect(9, 17, 5, 2, '#2a2a30').px(10, 17, PAL.gold);
  return p;
}

function mailbox() {
  const p = new Pix(16, 24).fill('#1a4a9a');
  p.rect(0, 0, 16, 1, '#4a7ad0').rect(0, 23, 16, 1, '#0a2050');
  p.rect(2, 4, 12, 3, '#0a2050').rect(3, 5, 10, 1, '#2a2a30');
  micro(p, 'US', 2, 9, PAL.white);
  micro(p, 'MAIL', 0, 15, PAL.white);
  p.rect(12, 9, 3, 3, PAL.red);
  return p;
}

function endSign() {
  const p = new Pix(24, 32).fill('#f0e8d0');
  p.rect(0, 0, 24, 1, '#ffffff').rect(0, 31, 24, 1, '#a09878').rect(0, 0, 1, 32, '#a09878').rect(23, 0, 1, 32, '#a09878');
  micro(p, 'THE', 6, 2, PAL.ink);
  micro(p, 'END', 6, 8, PAL.red);
  micro(p, 'IS', 8, 14, PAL.ink);
  micro(p, 'NIGH', 4, 20, PAL.red);
  micro(p, 'Y2K', 6, 26, '#1a4a9a');
  return p;
}

function crtFront(scr) {
  const p = new Pix(16, 16).fill('#d8d0b0');
  p.rect(0, 0, 16, 1, '#f0ead0').rect(15, 0, 1, 16, '#a09878').rect(0, 15, 16, 1, '#a09878');
  p.rect(2, 2, 12, 9, '#2a2a30').rect(3, 3, 10, 7, scr);
  p.px(4, 4, '#ffffff88');
  p.rect(3, 12, 4, 1, '#a09878').px(12, 12, PAL.lime);
  return p;
}

function beige() {
  const p = new Pix(8, 8).fill('#c8c0a0');
  p.rect(0, 0, 8, 1, '#e0d8b8').rect(0, 7, 8, 1, '#a09878');
  return p;
}

function acSide(rnd) {
  const p = new Pix(24, 16).fill('#9aa0ac');
  for (let y = 2; y < 14; y += 2) p.rect(2, y, 20, 1, '#5a606c');
  p.rect(0, 0, 24, 1, '#c8ccd6').rect(0, 15, 24, 1, '#4a505a');
  p.speckle(0, 0, 24, 16, '#7a5a3a', 0.04, rnd);
  return p;
}

function acTop() {
  const p = new Pix(16, 16).fill('#8a909c');
  p.oval(8, 8, 6, 6, '#3a3e48').oval(8, 8, 5, 5, '#22242c');
  p.line(3, 8, 13, 8, '#6a707c').line(8, 3, 8, 13, '#6a707c').line(4, 4, 12, 12, '#5a606c').line(12, 4, 4, 12, '#5a606c');
  p.oval(8, 8, 1, 1, '#9aa0ac');
  return p;
}

function speaker() {
  const p = new Pix(20, 32).fill('#1a1a20');
  p.rect(0, 0, 20, 1, '#3a3a44').rect(0, 0, 1, 32, '#2a2a34');
  p.oval(10, 9, 6, 6, '#2e2e38').oval(10, 9, 4, 4, '#101014').oval(10, 9, 1, 1, '#5a5a66');
  p.oval(10, 23, 5, 5, '#2e2e38').oval(10, 23, 3, 3, '#101014');
  p.rect(2, 30, 16, 1, PAL.pink);
  micro(p, 'Y2K', 5, 1, '#5a5a66');
  return p;
}

function vending() {
  const p = new Pix(24, 48).fill(PAL.strawberry);
  p.rect(0, 0, 24, 1, PAL.pinkLight).rect(23, 0, 1, 48, PAL.strawberryDark);
  p.rect(2, 2, 20, 8, PAL.cream);
  micro(p, 'VOLT', 4, 3, PAL.strawberryDark);
  p.rect(2, 12, 14, 24, '#2a3a5a');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) p.rect(3 + x * 5, 13 + y * 6, 3, 4, [PAL.strawberry, PAL.gold, PAL.lime, PAL.cyan][(x + y) % 4]);
  p.rect(2, 12, 14, 1, '#8fb8ff');
  p.rect(17, 14, 4, 6, '#2a2a30').px(18, 15, PAL.lime).rect(17, 22, 4, 2, '#1a1a20');
  p.rect(3, 39, 12, 5, '#1a1a20');
  return p;
}

function trainSide(rnd) {
  // A parked R-train: brushed steel, a red stripe, windows lit and full of something moving.
  const p = new Pix(128, 45).fill('#9aa0ac');
  for (let x = 0; x < 128; x += 3) p.rect(x, 0, 1, 45, '#8a909c');
  p.rect(0, 0, 128, 2, '#c8ccd6').rect(0, 43, 128, 2, '#2a2a30');
  p.rect(0, 34, 128, 3, PAL.strawberry).rect(0, 34, 128, 1, PAL.pinkLight);
  // Doors at the car ends, windows between.
  for (const dx of [4, 104]) {
    p.rect(dx, 6, 20, 34, '#7a808c').rect(dx + 9, 6, 2, 34, '#2a2a30');
    p.rect(dx + 2, 9, 6, 12, '#f8f0c8').rect(dx + 12, 9, 6, 12, '#f8f0c8');
  }
  for (let k = 0; k < 4; k++) {
    const x = 30 + k * 18;
    p.rect(x, 9, 14, 12, '#2a2a30').rect(x + 1, 10, 12, 10, '#f8f0c8');
    p.rect(x + 1, 10, 12, 2, '#fffae0');
    // Silhouettes pressed to the glass.
    if (k % 2 === 0) p.oval(x + 5, 16, 2, 3, '#56722e').rect(x + 3, 18, 5, 3, '#56722e').px(x + 4, 15, PAL.eye).px(x + 6, 15, PAL.eye);
    else p.oval(x + 8, 17, 2, 2, '#4a5a3a').rect(x + 6, 19, 5, 2, '#4a5a3a');
  }
  micro(p, 'N', 52, 25, PAL.white);
  p.oval(58, 27, 3, 3, PAL.gold);
  micro(p, 'W', 57, 25, PAL.ink);
  p.speckle(0, 0, 128, 44, '#6a707c', 0.02, rnd);
  micro(p, 'Y2K', 80, 26, PAL.pink);
  p.rect(78, 24, 16, 1, PAL.pink);
  return p;
}

function subSign(word) {
  const p = new Pix(48, 12).fill('#101014');
  p.rect(0, 0, 48, 1, '#3a3a44').rect(0, 11, 48, 1, '#000000');
  micro(p, word, 4, 4, PAL.white);
  p.oval(42, 6, 3, 3, PAL.lime);
  micro(p, '4', 41, 4, PAL.ink);
  return p;
}

function manhole() {
  const p = new Pix(32, 32);
  p.oval(16, 16, 14, 14, '#1a1822').oval(16, 16, 12, 12, '#3a3644');
  for (let k = -10; k <= 10; k += 4) p.rect(6, 16 + k, 20, 1, '#2a2632');
  p.oval(16, 16, 4, 4, '#4a4654');
  micro(p, 'NYC', 11, 14, '#5a5664');
  return p;
}

function neonSign(word, col, bg) {
  // A vertical blade sign: letters stacked top to bottom in neon.
  const n = word.length;
  const p = new Pix(12, 8 + n * 7).fill(bg);
  p.rect(0, 0, 12, 1, col).rect(0, p.h - 1, 12, 1, col).rect(0, 0, 1, p.h, col).rect(11, 0, 1, p.h, col);
  [...word].forEach((ch, i) => micro(p, ch, 4, 5 + i * 7, '#ffffff'));
  // Glow halo around each letter stroke.
  const img = p.g.getImageData(0, 0, p.w, p.h);
  const d = img.data;
  const out = p.g.getImageData(0, 0, p.w, p.h);
  const [r, g, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
  for (let y = 1; y < p.h - 1; y++) {
    for (let x = 1; x < p.w - 1; x++) {
      const k = (y * p.w + x) * 4;
      if (d[k] === 255 && d[k + 1] === 255) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => d[((y + oy) * p.w + x + ox) * 4] === 255 && d[((y + oy) * p.w + x + ox) * 4 + 1] === 255);
      if (near) {
        out.data[k] = r;
        out.data[k + 1] = g;
        out.data[k + 2] = b;
      }
    }
  }
  p.g.putImageData(out, 0, 0);
  return p;
}

function trashBag(rnd) {
  const p = new Pix(16, 16).fill('#1e2420');
  p.speckle(0, 0, 16, 16, '#2e3a32', 0.2, rnd);
  p.rect(3, 3, 3, 1, '#5a6a60').px(4, 2, '#7a8a80').rect(10, 9, 2, 1, '#4a5a50');
  return p;
}

export const NEON_WORDS = [['EAT', '#ff2e88'], ['BAR', '#3de0e0'], ['HOTEL', '#f6c945'], ['PIZZA', '#ff8a2a'], ['VIDEO', '#a67bd8'], ['ARCADE', '#7ac943'], ['DELI', '#ff2e88'], ['TIX', '#3de0e0']];

export function buildTextures() {
  const rnd = mulberry32(1999);
  const T = {};
  const mk = (name, p, repeat = true) => (T[name] = toTex(p, repeat));
  mk('brick', brick(rnd));
  mk('brickUpper', windowsFacade(rnd, 128, 128, '#5a2436', '#3a1424'));
  mk('shop', storefronts(rnd));
  mk('shopUpper', windowsFacade(rnd, 128, 128, '#3a2a4a', '#221630', { cw: 16, ch: 20 }));
  mk('poster', posters(rnd));
  mk('posterUpper', windowsFacade(rnd, 128, 128, '#4a3a2a', '#2a1a14', { cw: 20, ch: 16 }));
  mk('tower', billboardTower(rnd));
  mk('glass', glassTower(rnd));
  mk('glassUpper', glassTower(rnd));
  mk('tile', subwayTile(rnd, 'TIMES SQ 42 ST'));
  mk('pillar', pillar());
  const rack = drawRack(new Pix(64, 48), 0, rnd);
  mk('rack', rack);
  mk('dataWall', dataWall(rnd));
  mk('street', asphalt(rnd));
  mk('walk', sidewalk(rnd));
  mk('stripe', crosswalk(rnd));
  mk('platform', platform(rnd));
  mk('tracks', tracks(rnd));
  mk('edge', edgeStrip(rnd));
  mk('raised', raisedFloor(rnd));
  mk('cable', cableTray(rnd));
  mk('roof', roofTar(rnd));
  mk('stage', stage(rnd));
  mk('subwayCeil', subwayCeiling(rnd));
  mk('dropCeil', dropCeiling(rnd));
  mk('lightPanel', lightPanel());
  mk('jumbo', new Pix(96, 64));
  drawJumbo(T.jumbo.userData.pix, '11:10', 'T-50 MIN', 0);
  T.jumbo.needsUpdate = true;
  // Prop skins.
  mk('taxiSide', taxiSide(rnd), false);
  mk('taxiCabin', taxiCabin(), false);
  mk('taxiFront', taxiFront(), false);
  mk('can', metalCan(rnd));
  mk('trashTop', trashTop(rnd), false);
  mk('newsBox', newsBox(), false);
  mk('barricade', barricade());
  mk('wood', wood());
  mk('server', serverSkin(0), false);
  mk('iron', plainSkin('#2a2a32', '#16161c'));
  mk('red', plainSkin(PAL.strawberry, PAL.strawberryDark));
  mk('darkMetal', plainSkin('#3a3e4a', '#22242c'));
  mk('gold', plainSkin(PAL.gold, PAL.goldDark));
  mk('payphone', payphone(), false);
  mk('mailbox', mailbox(), false);
  mk('endSign', endSign(), false);
  mk('crtBlue', crtFront(PAL.bsod), false);
  mk('crtGreen', crtFront('#0a3a1a'), false);
  mk('crtOff', crtFront('#1a1a22'), false);
  mk('beige', beige());
  mk('acSide', acSide(rnd), false);
  mk('acTop', acTop(), false);
  mk('speaker', speaker(), false);
  mk('vending', vending(), false);
  mk('train', trainSide(rnd));
  mk('signUp', subSign('UPTOWN'), false);
  mk('signDown', subSign('DOWNTOWN'), false);
  mk('manhole', manhole(), false);
  mk('bag', trashBag(rnd));
  mk('blue', plainSkin('#1a4a9a', '#0a2050'));
  mk('steel', plainSkin('#8a909c', '#5a606c'));
  NEON_WORDS.forEach(([w, c]) => mk('neon' + w, neonSign(w, c, '#140c1c'), false));
  T.skies = ['Times Square', 'Broadway', 'Subway', 'Bank', 'Ball Drop'].map((d) => {
    const t = toTex(skyPanorama(d));
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
  return T;
}
