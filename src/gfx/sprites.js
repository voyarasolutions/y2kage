// Pixel-art sprites: the horde, projectiles, pickups, hero portraits and first-person weapons.
// Zombies always shamble toward you, so like the classic 16-bit shooters they only need a front view.
import * as THREE from 'three';
import { Pix, micro, microWidth, sevenSeg } from './pix.js';
import { PAL, FLAVOURS } from '../core/palette.js';
import { mulberry32 } from '../core/util.js';
import { LOOKS, portrait, heroBody } from './heroart.js';

// ---------------------------------------------------------------- humanoid zombie base
function legs(p, o, f) {
  const lift = [[0, 0], [2, 0], [0, 0], [0, 2]][f.walk % 4];
  const { cx, hipY, footY, legW, legGap } = o;
  const lx = cx - legGap - legW;
  const rx = cx + legGap;
  const lf = footY - lift[0];
  const rf = footY - lift[1];
  if (o.flare) {
    // JNCO jeans: legs widen toward the bottom and hide the shoes.
    for (let y = hipY; y <= lf; y++) {
      const t = (y - hipY) / (footY - hipY);
      const w = Math.round(legW + t * 3);
      p.rect(lx - Math.round(t * 2), y, w, 1, y === lf ? o.pantsD : o.pants);
    }
    for (let y = hipY; y <= rf; y++) {
      const t = (y - hipY) / (footY - hipY);
      const w = Math.round(legW + t * 3);
      p.rect(rx, y, w, 1, y === rf ? o.pantsD : o.pants);
    }
    p.rect(cx - 1, hipY, 2, 3, o.pants);
    p.rect(lx + legW - 1, hipY + 2, 1, lf - hipY - 2, o.pantsD);
    p.rect(rx + legW, hipY + 2, 1, rf - hipY - 3, o.pantsD);
    return;
  }
  p.rect(lx, hipY, legW, lf - hipY - 1, o.pants);
  p.rect(rx, hipY, legW, rf - hipY - 1, o.pants);
  p.rect(lx + legW - 1, hipY + 1, 1, lf - hipY - 2, o.pantsD);
  p.rect(rx + legW - 1, hipY + 1, 1, rf - hipY - 2, o.pantsD);
  p.rect(cx - legGap, hipY, legGap * 2, 3, o.pants);
  if (o.shorts) {
    // Shorts or a skirt: bare (rotting) shins below.
    p.rect(lx, hipY + o.shorts, legW, lf - hipY - 1 - o.shorts, o.legSkin || o.skin);
    p.rect(rx, hipY + o.shorts, legW, rf - hipY - 1 - o.shorts, o.legSkin || o.skin);
    p.rect(lx + legW - 1, hipY + o.shorts, 1, lf - hipY - 1 - o.shorts, o.skinD);
    p.rect(rx + legW - 1, hipY + o.shorts, 1, rf - hipY - 1 - o.shorts, o.skinD);
    if (o.socks) p.rect(lx, lf - 5, legW, 3, o.socks).rect(rx, rf - 5, legW, 3, o.socks);
  }
  p.rect(lx - 1, lf - 2, legW + 1, 2, o.shoes);
  p.rect(rx, rf - 2, legW + 1, 2, o.shoes);
  if (o.rip) {
    p.px(lx + 1, hipY + 5, o.skin).px(lx + 1, hipY + 6, o.skinD);
    p.px(rx + 1, hipY + 7, o.skin);
  }
}

function arms(p, o, f) {
  const { cx, shoulderY, torsoW } = o;
  const sl = cx - Math.floor(torsoW / 2) - o.armW + 1;
  const sr = cx + Math.ceil(torsoW / 2) - 1;
  const aw = o.armW;
  const swing = [0, 1, 0, -1][f.walk % 4] * (o.swing || 1);
  if (f.atk) {
    // Both arms up, clawing.
    const up = f.atk === 2 ? 6 : 3;
    p.rect(sl - 1, shoulderY - up, aw, up + 4, o.sleeve);
    p.rect(sr + 1, shoulderY - up, aw, up + 4, o.sleeve);
    p.rect(sl - 2, shoulderY - up - 3, aw + 1, 3, o.skin);
    p.rect(sr + 1, shoulderY - up - 3, aw + 1, 3, o.skin);
    for (let k = 0; k < aw + 1; k += 2) {
      p.px(sl - 2 + k, shoulderY - up - 4, o.skinD);
      p.px(sr + 1 + k, shoulderY - up - 4, o.skinD);
    }
    return;
  }
  // Reaching toward you: arms hang forward, hands at chest-to-belly height.
  const len = o.armLen;
  p.rect(sl, shoulderY, aw, len + swing, o.sleeve);
  p.rect(sr, shoulderY, aw, len - swing, o.sleeve);
  p.rect(sl + aw - 1, shoulderY + 1, 1, len + swing - 1, o.sleeveD);
  p.rect(sr + aw - 1, shoulderY + 1, 1, len - swing - 1, o.sleeveD);
  const hl = shoulderY + len + swing;
  const hr = shoulderY + len - swing;
  p.rect(sl - 1, hl, aw + 1, 3, o.skin);
  p.rect(sr, hr, aw + 1, 3, o.skin);
  p.px(sl - 1, hl + 3, o.skinD).px(sl + 1, hl + 3, o.skinD);
  p.px(sr, hr + 3, o.skinD).px(sr + 2, hr + 3, o.skinD);
  if (o.hands) o.hands(p, sl - 1, hl, sr, hr, f);
}

function torso(p, o) {
  const { cx, shoulderY, hipY, torsoW } = o;
  const x0 = cx - Math.floor(torsoW / 2);
  p.rect(x0, shoulderY, torsoW, hipY - shoulderY + 1, o.top);
  p.rect(x0, shoulderY, 1, hipY - shoulderY + 1, o.topL);
  p.rect(x0 + torsoW - 2, shoulderY, 2, hipY - shoulderY + 1, o.topD);
  p.rect(x0 + 1, shoulderY - 1, torsoW - 2, 1, o.top);
  if (o.torsoArt) o.torsoArt(p, x0, shoulderY, torsoW, hipY);
}

function head(p, o, f) {
  const { cx, headY } = o;
  const [rx, ry] = o.headR;
  p.rect(cx - 1, headY + ry - 1, 3, 3, o.skinD);
  p.oval(cx, headY, rx, ry, o.skin);
  p.oval(cx + 1, headY + 1, rx - 1, ry - 1, o.skin);
  // Shade the right side and jaw.
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
    if (t < 0) continue;
    const hw = Math.round(rx * Math.sqrt(t) + 0.15);
    p.px(cx + hw, headY + y, o.skinD);
    if (y < 0) p.px(cx - hw, headY + y, o.skinL);
  }
  const ey = headY - 1;
  const eyeCol = f.atk ? PAL.red : PAL.eye;
  p.rect(cx - 3, ey, 2, 2, o.skinDeep).rect(cx + 2, ey, 2, 2, o.skinDeep);
  p.px(cx - 3, ey, eyeCol).px(cx + 2, ey, eyeCol);
  const my = headY + 2;
  const mh = f.atk ? 3 : 2;
  p.rect(cx - 2, my, 5, mh, o.skinDeep);
  p.px(cx - 1, my, PAL.cream).px(cx + 1, my, PAL.cream);
  if (f.atk) p.px(cx, my + mh - 1, PAL.strawberryDark);
  if (o.headArt) o.headArt(p, cx, headY, rx, ry, f);
}

function humanoid(o, f) {
  const p = new Pix(o.w, o.h);
  const bob = f.walk % 2;
  const q = { ...o, headY: o.headY + bob, shoulderY: o.shoulderY + bob };
  legs(p, o, f);
  torso(p, q);
  arms(p, q, f);
  head(p, q, f);
  if (o.post) o.post(p, q, f);
  return p;
}

const SKIN = { skin: PAL.zSkin, skinL: PAL.zSkinLight, skinD: PAL.zSkinDark, skinDeep: PAL.zSkinDeep };

const SHAMBLER = {
  ...SKIN, w: 26, h: 40, cx: 13, headY: 10, headR: [4, 5], shoulderY: 17, hipY: 27, footY: 39,
  torsoW: 11, legW: 3, legGap: 1, armW: 3, armLen: 7,
  top: PAL.tux, topL: PAL.tuxLight, topD: '#0e0c1a', sleeve: PAL.tux, sleeveD: '#0e0c1a',
  pants: '#24203a', pantsD: '#141024', shoes: '#050508', rip: true,
  torsoArt(p, x0, y0, w, y1) {
    const c = x0 + Math.floor(w / 2);
    p.rect(c - 1, y0, 3, 8, PAL.cream);
    p.px(c, y0 + 3, PAL.ink).px(c, y0 + 6, PAL.ink);
    p.rect(c - 3, y0, 2, 2, PAL.pink).rect(c + 2, y0, 2, 2, PAL.pink).px(c, y0, PAL.pink).px(c, y0 + 1, PAL.strawberryDark);
    p.px(c - 2, y0 + 3, PAL.tuxLight).px(c - 2, y0 + 4, PAL.tuxLight).px(c + 2, y0 + 3, PAL.tuxLight);
    // Torn jacket showing skin, ragged hem.
    p.rect(x0 + 1, y0 + 6, 2, 2, PAL.zSkinDark).px(x0 + 1, y0 + 6, PAL.zSkin);
    p.px(c - 1, y0 + 6, PAL.blood).px(c, y0 + 7, PAL.blood);
    for (let x = x0; x < x0 + w; x += 2) p.px(x, y1 + 1, PAL.tux);
  },
  headArt(p, cx, hy, rx, ry, f) {
    // Party hat, slightly crooked.
    const top = hy - ry;
    const rows = [[1, 0], [1, 0], [3, 1], [3, 1], [5, 1], [5, 2]];
    rows.forEach(([w, off], i) => {
      const y = top - rows.length + i + 1;
      for (let k = 0; k < w; k++) p.px(cx + 1 - Math.floor(w / 2) + k + off - 1, y, (i + k) % 3 === 0 ? PAL.gold : PAL.pink);
    });
    p.px(cx - 1, top - rows.length - 1, PAL.gold).px(cx, top - rows.length - 1, PAL.cream);
    p.px(cx - 4, hy - 2, '#3a2a1a').px(cx + 4, hy - 3, '#3a2a1a').px(cx - 4, hy - 3, '#3a2a1a');
  },
};

const RUNNER = {
  ...SKIN, w: 26, h: 40, cx: 13, headY: 10, headR: [3, 4], shoulderY: 16, hipY: 25, footY: 39,
  torsoW: 8, legW: 3, legGap: 1, armW: 2, armLen: 7, swing: 2, flare: true,
  top: PAL.pink, topL: PAL.pinkLight, topD: '#a81a5a', sleeve: PAL.zSkin, sleeveD: PAL.zSkinDark,
  pants: PAL.denim, pantsD: PAL.denimDark, shoes: '#050508',
  torsoArt(p, x0, y0, w) {
    p.rect(x0 + 2, y0 + 2, 4, 3, PAL.gold);
    micro(p, '', x0, y0, PAL.ink);
    p.px(x0 + 3, y0 + 3, PAL.ink).px(x0 + 4, y0 + 3, PAL.ink);
    p.rect(x0 + 1, y0 + 8, w - 2, 1, PAL.lime);
  },
  headArt(p, cx, hy, rx, ry) {
    // Spiky neon hair and a pacifier.
    const top = hy - ry;
    for (let k = -3; k <= 3; k++) {
      const h = 2 + ((k + 4) % 2) * 2;
      p.rect(cx + k, top - h + 1, 1, h, k % 2 ? PAL.limeLight : PAL.lime);
    }
    p.rect(cx - 3, top, 7, 1, PAL.lime);
    p.px(cx, hy + 3, PAL.cyan).px(cx - 1, hy + 3, PAL.cyan).px(cx + 1, hy + 3, PAL.cyan).px(cx, hy + 4, PAL.pinkLight);
  },
  hands(p, lx, ly, rx, ry, f) {
    // Glow sticks.
    const g1 = f.walk % 2 ? PAL.cyan : PAL.bondiLight;
    p.rect(lx, ly - 4, 1, 5, g1).px(lx - 1, ly - 3, '#3de0e088');
    p.rect(rx + 2, ry - 4, 1, 5, PAL.limeLight).px(rx + 3, ry - 3, '#c3f06a88');
  },
};

const BRUTE = {
  ...SKIN, w: 36, h: 54, cx: 18, headY: 10, headR: [5, 6], shoulderY: 19, hipY: 36, footY: 53,
  torsoW: 20, legW: 6, legGap: 1, armW: 6, armLen: 13,
  skin: '#7aa04e', skinL: '#a6c870', skinD: '#4a6a28',
  top: '#16141c', topL: '#2e2a38', topD: '#08070c', sleeve: '#7aa04e', sleeveD: '#4a6a28',
  pants: '#2a2a3a', pantsD: '#18182a', shoes: '#050508',
  torsoArt(p, x0, y0, w) {
    micro(p, 'STAFF', x0 + 1, y0 + 4, PAL.gold);
    p.rect(x0 + 2, y0 + 11, w - 4, 1, '#2e2a38');
    p.rect(x0 + 3, y0 + 13, 3, 2, PAL.blood);
  },
  headArt(p, cx, hy) {
    // Shades and an earpiece.
    p.rect(cx - 5, hy - 2, 11, 3, '#08080c');
    p.px(cx - 4, hy - 2, '#5a5a7a').px(cx + 2, hy - 2, '#5a5a7a');
    p.px(cx - 6, hy, PAL.ink).px(cx - 6, hy + 1, PAL.ink).px(cx - 6, hy + 2, '#3a3a4a');
    p.px(cx - 1, hy - 6, PAL.zSkinLight).px(cx, hy - 6, PAL.zSkinLight);
  },
  hands(p, lx, ly, rx, ry) {
    p.rect(lx - 1, ly, 8, 5, '#7aa04e').rect(rx, ry, 8, 5, '#7aa04e');
    p.rect(lx - 1, ly + 4, 8, 1, '#4a6a28').rect(rx, ry + 4, 8, 1, '#4a6a28');
  },
};

const GLITCH = {
  ...SKIN, w: 26, h: 40, cx: 13, headY: 9, headR: [5, 5], shoulderY: 17, hipY: 27, footY: 39,
  torsoW: 11, legW: 3, legGap: 1, armW: 3, armLen: 7,
  top: '#9ec4e8', topL: '#c8e0f8', topD: '#6a8ab0', sleeve: '#9ec4e8', sleeveD: '#6a8ab0',
  pants: '#b0985a', pantsD: '#806a3a', shoes: '#2a1a0a',
  torsoArt(p, x0, y0, w) {
    const c = x0 + Math.floor(w / 2);
    p.rect(c, y0, 1, 8, PAL.strawberry).px(c - 1, y0, PAL.strawberry).px(c + 1, y0, PAL.strawberry);
    p.rect(x0 + 1, y0 + 2, 3, 2, '#eef4ff');
  },
};

// Corrupted zombies wear a CRT monitor where a head should be.
function crtHead(p, cx, hy, f, rnd, screen = 'bsod') {
  p.rect(cx - 7, hy - 6, 14, 12, '#d8d0b0');
  p.rect(cx - 7, hy - 6, 14, 1, '#f0ead0');
  p.rect(cx + 6, hy - 6, 1, 12, '#a09878');
  p.rect(cx - 6, hy - 5, 11, 8, screen === 'bsod' ? PAL.bsod : screen === 'prompt' ? '#050505' : screen === '404' ? '#f0f0f0' : screen === 'hourglass' ? PAL.winTeal : '#000000');
  if (f.atk) {
    micro(p, 'ERR', cx - 6, hy - 4, screen === '404' ? PAL.red : PAL.white);
  } else if (screen === 'prompt') {
    micro(p, 'C:', cx - 6, hy - 4, '#40ff60');
    if (f.walk % 2) p.rect(cx + 2, hy + 0, 2, 1, '#40ff60');
  } else if (screen === '404') {
    micro(p, '404', cx - 6, hy - 3, PAL.ink);
  } else if (screen === 'hourglass') {
    p.rect(cx - 3, hy - 4, 5, 1, PAL.white).rect(cx - 3, hy + 2, 5, 1, PAL.white);
    p.rect(cx - 2, hy - 3, 3, 1, PAL.gold).px(cx - 1, hy - 2, PAL.gold).px(cx - 1, hy - 1, PAL.gold).rect(cx - 2, hy + 1, 3, 1, PAL.gold);
    p.px(cx - 2 + (f.walk % 3), hy, PAL.gold);
  } else if (screen === 'bars') {
    const bars = [PAL.white, PAL.gold, PAL.cyan, PAL.lime, PAL.pink, PAL.red, PAL.bondi, PAL.ink];
    bars.forEach((c, k) => p.rect(cx - 6 + Math.floor((k * 11) / 8), hy - 5, 2, 6, c));
    p.rect(cx - 6, hy + 1, 11, 2, '#202020');
  } else {
    p.px(cx - 3, hy - 3, PAL.white).px(cx + 1, hy - 3, PAL.white);
    p.rect(cx - 3, hy, 5, 1, PAL.white).px(cx - 4, hy + 1, PAL.white).px(cx + 2, hy + 1, PAL.white);
  }
  for (let i = 0; i < 4; i++) p.px(cx - 6 + Math.floor(rnd() * 11), hy - 5 + Math.floor(rnd() * 8), rnd() < 0.5 ? PAL.cyan : PAL.pink);
  p.rect(cx - 3, hy + 6, 6, 1, '#a09878');
  p.px(cx + 4, hy + 4, PAL.lime);
}

function glitchify(src, f, rnd) {
  const p = new Pix(src.w, src.h);
  const ghostA = src.silhouette(PAL.cyan);
  const ghostB = src.silhouette(PAL.pink);
  const o = 1 + (f.walk % 2);
  p.g.globalAlpha = 0.8;
  p.draw(ghostA, -o, 0).draw(ghostB, o, 0);
  p.g.globalAlpha = 1;
  // Tear a few rows sideways.
  for (let y = 0; y < src.h; y++) {
    const shift = rnd() < 0.12 ? Math.round((rnd() - 0.5) * 6) : 0;
    p.g.drawImage(src.c, 0, y, src.w, 1, shift, y, src.w, 1);
  }
  for (let i = 0; i < 6; i++) p.rect(Math.floor(rnd() * src.w), Math.floor(rnd() * src.h), 2 + Math.floor(rnd() * 3), 1, rnd() < 0.5 ? PAL.cyan : PAL.pink);
  return p;
}

// ---------------------------------------------------------------- the boss
function bug(f) {
  const p = new Pix(84, 72);
  const cx = 42;
  const legLift = (i) => ((f.walk + i) % 2 ? 3 : 0);
  // Legs behind the body: three per side, two segments each.
  for (let i = 0; i < 3; i++) {
    const sy = 34 + i * 6;
    const kx = 12 - i * 2;
    const fy = 71 - legLift(i);
    p.rect(cx - 24, sy, 1, 1, '#0a140a');
    p.line(cx - 22, sy, kx, sy - 6 + i * 3, '#1a2e14').line(cx - 22, sy + 1, kx, sy - 5 + i * 3, '#1a2e14');
    p.line(kx, sy - 6 + i * 3, kx + 4 + i * 4, fy, '#2c4a22').line(kx + 1, sy - 6 + i * 3, kx + 5 + i * 4, fy, '#2c4a22');
    const fyR = 71 - legLift(i + 1);
    const kxR = 84 - kx - 1;
    p.line(cx + 22, sy, kxR, sy - 6 + i * 3, '#1a2e14').line(cx + 22, sy + 1, kxR, sy - 5 + i * 3, '#1a2e14');
    p.line(kxR, sy - 6 + i * 3, kxR - 4 - i * 4, fyR, '#2c4a22').line(kxR - 1, sy - 6 + i * 3, kxR - 5 - i * 4, fyR, '#2c4a22');
  }
  // Carapace.
  p.oval(cx, 30, 30, 20, '#1e3a1e');
  p.oval(cx - 3, 26, 25, 15, '#2c5226');
  p.oval(cx - 8, 20, 12, 6, '#3e6e30');
  p.rect(cx, 11, 1, 38, '#0e1e0e');
  // Circuit traces on the shell.
  const trace = PAL.gold;
  p.line(cx - 22, 30, cx - 12, 30, trace).line(cx - 12, 30, cx - 8, 24, trace).px(cx - 22, 30, PAL.limeLight);
  p.line(cx + 22, 26, cx + 10, 26, trace).line(cx + 10, 26, cx + 6, 20, trace).px(cx + 22, 26, PAL.limeLight);
  p.line(cx - 18, 38, cx - 6, 38, trace).line(cx + 18, 36, cx + 8, 40, trace);
  // Head.
  p.oval(cx, 46, 17, 11, '#243e1c');
  p.oval(cx - 2, 44, 13, 7, '#34562a');
  // The display that thinks it is 1900.
  p.rect(cx - 15, 34, 30, 9, '#050505');
  p.rect(cx - 15, 34, 30, 1, '#3a3a3a');
  sevenSeg(p, f.walk % 4 === 3 ? '1900' : '19:00'.replace(':', ''), cx - 13, 36, 1, PAL.red, '#2a0606');
  // Compound eyes.
  const eyeC = f.atk ? '#ff6060' : PAL.red;
  for (const s of [-1, 1]) {
    p.oval(cx + s * 11, 48, 5, 4, '#6a0a14');
    p.oval(cx + s * 11, 48, 4, 3, eyeC);
    p.px(cx + s * 11 - 2, 46, PAL.white).px(cx + s * 11 - 1, 47, '#ffb0b0');
    for (let k = -3; k <= 3; k += 2) p.px(cx + s * 11 + k, 49, '#a01020');
  }
  // Mandibles: open wider when it charges.
  const open = f.atk ? 5 : 2;
  for (const s of [-1, 1]) {
    p.line(cx + s * 4, 55, cx + s * (6 + open), 61, PAL.cream).line(cx + s * 5, 55, cx + s * (7 + open), 61, PAL.cream);
    p.line(cx + s * (6 + open), 61, cx + s * (3 + open), 65, PAL.cream).line(cx + s * (7 + open), 62, cx + s * (4 + open), 66, '#c8b890');
  }
  // Antennae with sparks.
  p.line(cx - 6, 36, cx - 20, 8, '#1a2e14').line(cx - 20, 8, cx - 28, 3, '#1a2e14');
  p.line(cx + 6, 36, cx + 20, 8, '#1a2e14').line(cx + 20, 8, cx + 28, 3, '#1a2e14');
  const sp = f.walk % 2 ? PAL.cyan : PAL.gold;
  p.rect(cx - 29, 2, 2, 2, sp).rect(cx + 27, 2, 2, 2, sp);
  p.px(cx - 30, 1, PAL.white).px(cx + 29, 1, PAL.white);
  p.outline('#050a05');
  return p;
}

// ---------------------------------------------------------------- frame sets
function tex(p) {
  const t = new THREE.CanvasTexture(p.c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function deathFrames(src) {
  const out = [];
  const specs = [
    [1.05, 0.72],
    [1.15, 0.42],
    [1.25, 0.2],
  ];
  for (const [sx, sy] of specs) {
    const p = new Pix(src.w, src.h);
    const w = Math.round(src.w * Math.min(1, sx));
    const h = Math.round(src.h * sy);
    p.g.drawImage(src.c, Math.round((src.w - w) / 2), src.h - h, w, h);
    out.push(p);
  }
  return out;
}

export { humanoid, SHAMBLER, RUNNER, BRUTE, GLITCH, SKIN, crtHead, glitchify, deathFrames, tex };

function zombieSet(kind) {
  const rnd = mulberry32(kind.length * 31);
  const make = (f) => {
    let p;
    if (kind === 'boss') return bug(f);
    if (kind === 'shambler') p = humanoid(SHAMBLER, f);
    if (kind === 'runner') p = humanoid(RUNNER, f);
    if (kind === 'brute') p = humanoid(BRUTE, f);
    if (kind === 'glitch') {
      p = humanoid({ ...GLITCH, headArt: null }, f);
      p.clear(0, 0, p.w, 16);
      crtHead(p, 13, 9 + (f.walk % 2), f, rnd);
      p.outline(PAL.ink);
      return glitchify(p, f, rnd);
    }
    p.outline(PAL.ink);
    return p;
  };
  const walk = [0, 1, 2, 3].map((i) => make({ walk: i, atk: 0 }));
  const atk = [make({ walk: 0, atk: 1 }), make({ walk: 0, atk: 2 })];
  const flash = walk[0].silhouette(PAL.white);
  const die = deathFrames(walk[0]);
  const all = { walk, atk, flash: [flash], die };
  const T = {};
  for (const k in all) T[k] = all[k].map(tex);
  T.aspect = walk[0].w / walk[0].h;
  T.pix = walk[0];
  return T;
}

// ---------------------------------------------------------------- projectiles, pickups, decals
function droplet() {
  const p = new Pix(6, 6);
  p.oval(3, 3, 2, 2, '#4ab8ff').px(2, 2, PAL.white).px(3, 1, '#bfe8ff');
  return p;
}

function yoyo(col, rim, spin) {
  const p = new Pix(12, 12);
  p.oval(6, 6, 5, 5, rim).oval(6, 6, 4, 4, col);
  const a = (spin / 4) * Math.PI * 2;
  p.px(6 + Math.round(Math.cos(a) * 3), 6 + Math.round(Math.sin(a) * 3), PAL.white);
  p.px(6 + Math.round(Math.cos(a + Math.PI) * 3), 6 + Math.round(Math.sin(a + Math.PI) * 3), PAL.white);
  p.rect(5, 5, 2, 2, PAL.ink);
  p.outline(PAL.ink);
  return p;
}

function floppyIcon(p, x, y, s = 1, col = PAL.bondi) {
  p.rect(x, y, 12 * s, 12 * s, col);
  p.rect(x + 3 * s, y, 6 * s, 4 * s, PAL.steelLight);
  p.rect(x + 6 * s, y + s, 2 * s, 2 * s, PAL.steelDark);
  p.rect(x + 2 * s, y + 6 * s, 8 * s, 6 * s, PAL.cream);
  p.rect(x + 3 * s, y + 8 * s, 6 * s, s, PAL.strawberry);
  p.rect(x + 3 * s, y + 10 * s, 5 * s, s, '#8a8a9a');
  p.rect(x, y + 11 * s, s, s, PAL.ink);
}

function floppySpin(i) {
  const p = new Pix(12, 12);
  floppyIcon(p, 0, 0);
  if (i === 0) return p;
  const q = new Pix(12, 12);
  q.g.translate(6, 6);
  q.g.rotate((i * Math.PI) / 2);
  q.g.drawImage(p.c, -6, -6);
  return q;
}

function rocketFlare(i) {
  const p = new Pix(10, 10);
  p.oval(5, 5, 4, 4, i % 2 ? PAL.tangerine : PAL.gold).oval(5, 5, 2, 2, PAL.cream).px(5, 5, PAL.white);
  p.px(1, 1, PAL.gold).px(8, 2, PAL.pink).px(2, 8, PAL.cyan);
  return p;
}

function cola() {
  const p = new Pix(12, 18);
  p.rect(2, 2, 8, 15, PAL.strawberry);
  p.rect(2, 1, 8, 1, PAL.steelLight).rect(2, 17, 8, 1, PAL.steelDark);
  p.rect(2, 2, 2, 15, PAL.pinkLight);
  p.rect(8, 2, 2, 15, PAL.strawberryDark);
  p.line(7, 4, 4, 9, PAL.gold).line(4, 9, 7, 9, PAL.gold).line(7, 9, 4, 14, PAL.gold);
  p.outline(PAL.ink);
  return p;
}

function badge() {
  const p = new Pix(16, 16);
  p.oval(8, 8, 7, 7, PAL.goldDark).oval(8, 8, 6, 6, PAL.gold);
  p.rect(3, 6, 10, 5, PAL.winNavy);
  micro(p, 'Y2K', 3, 6, PAL.white);
  p.px(5, 3, PAL.cream).px(6, 2, PAL.cream);
  p.outline(PAL.ink);
  return p;
}

function chip() {
  const p = new Pix(16, 16);
  p.rect(2, 2, 12, 12, '#1a6a3a');
  for (let k = 3; k < 14; k += 2) p.px(k, 1, PAL.gold).px(k, 14, PAL.gold).px(1, k, PAL.gold).px(14, k, PAL.gold);
  p.rect(4, 4, 8, 8, '#2a2a30');
  p.oval(8, 8, 3, 3, '#6a6a78').px(8, 8, PAL.cyan).px(7, 6, PAL.white);
  p.outline(PAL.ink);
  return p;
}

// Powerups: a boxed Y2K patch disk, a multitasking window stack, a screensaver toaster, and Ctrl+Alt+Del.
function patchDisk() {
  const p = new Pix(16, 16);
  p.rect(1, 1, 14, 14, PAL.lime).rect(1, 1, 14, 1, PAL.limeLight).rect(14, 1, 1, 14, '#3f7a1e');
  p.rect(4, 1, 8, 5, PAL.steelLight).rect(8, 2, 2, 3, PAL.steelDark);
  p.rect(3, 8, 10, 6, PAL.cream);
  micro(p, 'FIX', 3, 9, PAL.strawberryDark);
  p.outline(PAL.ink);
  return p;
}

function multiWin() {
  const p = new Pix(18, 16);
  for (let k = 2; k >= 0; k--) {
    const x = k * 3;
    const y = 6 - k * 3;
    p.rect(x, y, 11, 9, PAL.winFace).rect(x, y, 11, 2, [PAL.winNavy, PAL.tangerine, PAL.strawberry][k]).rect(x + 1, y + 3, 9, 5, PAL.white);
  }
  micro(p, 'x3', 8, 4, PAL.ink);
  p.outline(PAL.ink);
  return p;
}

function toaster(frame = 0) {
  const p = new Pix(18, 14);
  p.rect(2, 4, 13, 9, '#c8ccd6').rect(2, 4, 13, 1, PAL.white).rect(14, 4, 1, 9, '#8a909c');
  p.rect(5, 3, 3, 2, '#2a2a30').rect(10, 3, 3, 2, '#2a2a30').px(6, 2, '#d8a060').px(11, 2, '#d8a060');
  p.rect(15, 7, 2, 1, '#2a2a30');
  // Wings flap.
  if (frame % 2) p.rect(0, 2, 5, 2, PAL.white).rect(12, 2, 5, 2, PAL.white);
  else p.rect(0, 6, 4, 3, PAL.white).rect(13, 6, 4, 3, PAL.white);
  p.outline(PAL.ink);
  return p;
}

function cadKeys() {
  const p = new Pix(22, 12);
  ['C', 'A', 'D'].forEach((ch, k) => {
    const x = k * 7;
    p.rect(x, 1, 7, 10, '#d8d0b0').rect(x, 1, 7, 1, PAL.white).rect(x, 9, 7, 2, '#a09878');
    micro(p, ch, x + 2, 3, PAL.ink);
  });
  p.outline(PAL.ink);
  return p;
}

function goo(big) {
  const s = big ? 48 : 32;
  const p = new Pix(s, s);
  const rnd = mulberry32(s);
  p.oval(s / 2, s / 2, s / 2 - 4, s / 2 - 6, '#4a7a22');
  p.oval(s / 2 - 1, s / 2 - 1, s / 2 - 7, s / 2 - 9, PAL.blood);
  for (let i = 0; i < 6; i++) p.oval(Math.floor(rnd() * (s - 8)) + 4, Math.floor(rnd() * (s - 8)) + 4, 2, 1, PAL.blood);
  for (let i = 0; i < 10; i++) p.px(Math.floor(rnd() * s), Math.floor(rnd() * s), ['#ff2e88', '#f6c945', '#3de0e0'][i % 3]);
  p.px(s / 2 - 3, s / 2 - 3, PAL.limeLight);
  return p;
}

function shadowBlob() {
  const p = new Pix(16, 8);
  p.oval(8, 4, 7, 3, '#000000');
  return p;
}

// ---------------------------------------------------------------- hero portraits (select screen)
export const SKINS = LOOKS.map((l) => l.skin.base);
export { portrait };

// ---------------------------------------------------------------- 16px icons
export function icon(name) {
  const p = new Pix(16, 16);
  switch (name) {
    case 'skate':
      p.rect(3, 2, 7, 8, PAL.bondi).rect(3, 2, 7, 2, PAL.bondiLight).rect(9, 6, 4, 4, PAL.bondi);
      p.rect(2, 10, 12, 2, PAL.ink);
      for (let k = 0; k < 4; k++) p.oval(3 + k * 3, 13, 1, 1, PAL.gold);
      break;
    case 'board':
      p.rect(1, 8, 14, 3, PAL.tangerine).rect(1, 8, 14, 1, '#ffc27a').px(0, 7, PAL.tangerine).px(15, 7, PAL.tangerine);
      p.oval(4, 12, 1, 1, PAL.cream).oval(12, 12, 1, 1, PAL.cream);
      break;
    case 'slinky':
      for (let k = 0; k < 6; k++) p.oval(8, 3 + k * 2, 5, 1, k % 2 ? PAL.steelLight : PAL.steel);
      break;
    case 'pogo':
      p.rect(7, 1, 2, 13, PAL.steel).rect(3, 3, 10, 2, PAL.strawberry).rect(4, 9, 8, 2, PAL.ink);
      p.rect(6, 11, 4, 2, PAL.steelDark).px(7, 14, PAL.ink).px(8, 14, PAL.ink);
      break;
    case 'scooter':
      p.rect(3, 11, 10, 2, PAL.lime).rect(11, 2, 2, 10, PAL.steel).rect(9, 2, 6, 1, PAL.ink);
      p.oval(3, 13, 2, 2, PAL.ink).oval(12, 13, 2, 2, PAL.ink);
      break;
    case 'soaker':
      p.rect(1, 7, 12, 4, PAL.lime).rect(9, 3, 5, 4, PAL.tangerine).rect(4, 11, 3, 4, PAL.lime).rect(13, 8, 3, 2, PAL.gold);
      p.rect(10, 4, 3, 2, '#8fd8ff');
      break;
    case 'yoyo':
      p.oval(5, 9, 4, 4, PAL.pink).oval(11, 6, 4, 4, PAL.cyan).line(5, 9, 5, 1, PAL.cream).line(11, 6, 11, 1, PAL.cream);
      break;
    case 'floppy':
      floppyIcon(p, 2, 2);
      break;
    case 'rocket':
      p.line(3, 13, 12, 4, PAL.goldDark).rect(10, 2, 4, 4, PAL.strawberry).px(13, 1, PAL.cream);
      p.px(2, 14, PAL.tangerine).px(1, 15, PAL.gold);
      break;
    case 'laser':
      p.line(2, 13, 10, 5, '#2a2a30').line(3, 13, 11, 5, PAL.steel).px(11, 4, PAL.red).px(12, 3, '#ff9090');
      p.line(12, 3, 15, 0, PAL.red);
      break;
    case 'heart':
      p.oval(5, 6, 3, 3, PAL.strawberry).oval(10, 6, 3, 3, PAL.strawberry);
      for (let y = 0; y < 6; y++) p.rect(2 + y, 7 + y, 12 - y * 2, 1, PAL.strawberry);
      p.px(4, 5, PAL.pinkLight);
      break;
    case 'shield':
      p.rect(3, 2, 10, 7, PAL.gold);
      for (let y = 0; y < 6; y++) p.rect(3 + y, 9 + y, 10 - y * 2, 1, PAL.gold);
      p.rect(7, 4, 2, 8, PAL.goldDark);
      break;
    default:
      break;
  }
  p.outline(PAL.ink);
  return p;
}

export const RIDE_ICON = { skate: 'skate', board: 'board', slinky: 'slinky', pogo: 'pogo', scooter: 'scooter' };

export function buildSprites() {
  const S = { zombies: {} };
  for (const k of ['shambler', 'runner', 'brute', 'glitch', 'boss']) S.zombies[k] = zombieSet(k);
  S.water = tex(droplet());
  S.yoyo = [0, 1, 2, 3].map((i) => tex(yoyo(PAL.pink, PAL.strawberryDark, i)));
  S.yoyo2 = [0, 1, 2, 3].map((i) => tex(yoyo(PAL.cyan, PAL.cyanDark, i)));
  S.floppy = [0, 1, 2, 3].map((i) => tex(floppySpin(i)));
  S.flare = [0, 1].map((i) => tex(rocketFlare(i)));
  S.pickups = { health: tex(cola()), armor: tex(badge()), overclock: tex(chip()), patch: tex(patchDisk()), multi: tex(multiWin()), freeze: tex(toaster(0)), cad: tex(cadKeys()) };
  S.toasters = [toaster(0), toaster(1)];
  S.buffIcons = { patch: patchDisk(), multi: multiWin(), freeze: toaster(0), overclock: chip() };
  S.goo = tex(goo(false));
  S.gooBig = tex(goo(true));
  S.shadow = tex(shadowBlob());
  S.portraits = [0, 1, 2, 3, 4].map(portrait);
  S.heroBodies = [0, 1, 2, 3, 4].map((i) => [heroBody(i, 0), heroBody(i, 1)]);
  S.icons = {};
  for (const k of ['skate', 'board', 'slinky', 'pogo', 'scooter', 'soaker', 'yoyo', 'floppy', 'rocket', 'laser', 'heart', 'shield']) S.icons[k] = icon(k);
  return S;
}

export { floppyIcon, yoyo as yoyoPix, cola as colaPix, badge as badgePix, chip as chipPix };
