// The four district bosses after the Millennium Bug, painted pixel by pixel like the rest of the horde.
// Each set has the same frames as a zombie: four walk frames, two attack frames, a hit flash, a death.
import { Pix, micro, sevenSeg } from './pix.js';
import { PAL, PARTY } from '../core/palette.js';
import { mulberry32 } from '../core/util.js';
import { humanoid, SKIN, deathFrames, tex } from './sprites.js';

// ---------------------------------------------------------------- Broadway: the Frontman
// A zombie boy-band lead in a silver suit, frosted tips and a headset mic, belting sonic booms.
const FRONTMAN = {
  ...SKIN, w: 52, h: 78, cx: 26, headY: 15, headR: [7, 8], shoulderY: 27, hipY: 50, footY: 77,
  torsoW: 24, legW: 7, legGap: 2, armW: 6, armLen: 17, swing: 2,
  top: '#d8dde8', topL: '#ffffff', topD: '#8a90a8', sleeve: '#d8dde8', sleeveD: '#8a90a8',
  pants: '#e4e6f0', pantsD: '#9ca0b8', shoes: '#f4f4f4',
  torsoArt(p, x0, y0, w, y1) {
    const c = x0 + Math.floor(w / 2);
    // Open collar down to the belt: rotting chest and a gold chain.
    for (let k = 0; k < 13; k++) p.rect(c - Math.max(0, 5 - Math.floor(k / 2.6)), y0 + k, Math.max(1, 11 - Math.floor(k / 1.3)), 1, k < 12 ? PAL.zSkin : PAL.zSkinDark);
    p.rect(c - 1, y0 + 4, 1, 3, PAL.zSkinDark).px(c + 2, y0 + 6, PAL.zSkinDark);
    for (let k = -4; k <= 4; k++) p.px(c + k, y0 + 3 + Math.round(Math.abs(k) * -0.5 + 2), PAL.gold);
    p.rect(c - 1, y0 + 5, 3, 3, PAL.gold).px(c, y0 + 6, PAL.goldDark);
    // Lapels and rhinestones.
    p.rect(x0 + 3, y0, 3, 12, PAL.white).rect(x0 + w - 6, y0, 3, 12, '#b8bcd0');
    for (const [dx, dy] of [[4, 15], [w - 5, 17], [6, 20], [w - 8, 13]]) p.px(x0 + dx, y0 + dy, PAL.cyan);
    // Belt with a big buckle.
    p.rect(x0, y1 - 2, w, 2, PAL.ink).rect(c - 3, y1 - 3, 6, 4, PAL.gold).rect(c - 1, y1 - 2, 2, 2, PAL.goldDark);
    p.px(x0 + 8, y0 + 18, PAL.blood).px(x0 + 9, y0 + 19, PAL.blood).px(x0 + 8, y0 + 20, PAL.blood);
  },
  headArt(p, cx, hy, rx, ry, f) {
    // Frosted tips: dark roots, bleached spikes.
    const top = hy - ry;
    p.rect(cx - rx, top - 1, rx * 2 + 1, 3, '#3a2a1a');
    for (let k = -rx; k <= rx; k += 2) {
      const h = 4 + ((k + 9) % 3);
      p.rect(cx + k, top - h, 2, h, k % 4 ? '#f6e6a0' : '#fff4d6');
      p.px(cx + k, top - h, PAL.white);
    }
    // Headset mic curling to the mouth.
    p.rect(cx - rx - 1, hy - 3, 2, 5, PAL.ink);
    p.line(cx - rx, hy + 2, cx - 3, hy + 4, PAL.ink);
    p.rect(cx - 4, hy + 3, 2, 2, '#404040');
    // Soul patch and dead eyes rimmed with glitter.
    p.px(cx, hy + 6, '#3a2a1a').px(cx + 1, hy + 6, '#3a2a1a');
    if (f.atk) p.rect(cx - 2, hy + 2, 5, 4, PAL.ink).rect(cx - 1, hy + 3, 3, 2, PAL.strawberryDark);
  },
  hands(p, lx, ly, rx, ry, f) {
    // Hand mic in his right hand, a pointing finger on the left.
    p.rect(rx + 2, ry - 7, 3, 7, '#303030').rect(rx + 1, ry - 10, 5, 4, '#9aa3b5').px(rx + 2, ry - 9, PAL.white);
    p.rect(lx - 1, ly + 3, 2, 3, PAL.zSkin);
  },
  post(p, o, f) {
    // Stage sparkle.
    const rnd = mulberry32(f.walk * 7 + (f.atk || 0) * 13 + 3);
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(rnd() * (o.w - 4));
      const y = 2 + Math.floor(rnd() * 40);
      if (p.g.getImageData(x, y, 1, 1).data[3]) continue;
      const c = PARTY[i % PARTY.length];
      p.px(x, y, c).px(x - 1, y, c + '99').px(x + 1, y, c + '99').px(x, y - 1, c + '99').px(x, y + 1, c + '99');
    }
    if (f.atk) {
      // Sound rings out of the mic.
      const cx = o.cx;
      for (let r = 0; r < 3; r++) {
        const y = o.headY + 12 + r * 3;
        p.rect(cx - 4 - r * 3, y, 8 + r * 6, 1, r % 2 ? PAL.pink : PAL.cyan);
      }
    }
  },
};

// ---------------------------------------------------------------- Subway: the Conductor
// A hulking transit worker with shovel claws, a lantern and a rat riding his cap.
const CONDUCTOR = {
  ...SKIN, w: 56, h: 78, cx: 28, headY: 17, headR: [8, 8], shoulderY: 29, hipY: 52, footY: 77,
  torsoW: 30, legW: 9, legGap: 2, armW: 8, armLen: 18,
  skin: '#86a458', skinL: '#aac878', skinD: '#526e2e',
  top: '#1c2a4a', topL: '#34466e', topD: '#0e1428', sleeve: '#1c2a4a', sleeveD: '#0e1428',
  pants: '#18223c', pantsD: '#0a1024', shoes: '#050508', rip: true,
  torsoArt(p, x0, y0, w, y1) {
    const c = x0 + Math.floor(w / 2);
    // Buttons, a reflective vest stripe and a name badge.
    for (let k = 0; k < 5; k++) p.rect(c - 1, y0 + 3 + k * 4, 2, 2, PAL.gold);
    p.rect(x0 + 1, y0 + 12, w - 2, 3, PAL.tangerine).rect(x0 + 1, y0 + 13, w - 2, 1, '#ffe07a');
    p.rect(x0 + 4, y0 + 3, 9, 6, PAL.goldDark).rect(x0 + 5, y0 + 4, 7, 4, PAL.gold);
    micro(p, 'MTA', x0 + 5, y0 + 4, PAL.ink);
    // Grime and tears.
    p.rect(x0 + w - 8, y0 + 18, 4, 3, '#526e2e').px(x0 + w - 7, y0 + 18, '#86a458');
    for (let x = x0; x < x0 + w; x += 3) p.px(x, y1 + 1, '#1c2a4a');
    p.rect(x0 + 6, y1 - 6, 3, 2, PAL.blood);
  },
  headArt(p, cx, hy, rx, ry, f) {
    // Conductor's cap with a gold band and a black peak.
    const top = hy - ry;
    p.rect(cx - rx - 1, top - 4, rx * 2 + 3, 5, '#1c2a4a').rect(cx - rx - 1, top - 4, rx * 2 + 3, 1, '#34466e');
    p.rect(cx - rx - 1, top, rx * 2 + 3, 2, PAL.gold);
    p.rect(cx - rx - 3, top + 2, rx * 2 + 7, 2, '#050508');
    p.rect(cx - 2, top - 3, 4, 3, PAL.goldDark).px(cx - 1, top - 2, PAL.gold);
    // Whiskers of a beard, broken teeth.
    for (let k = -rx + 1; k < rx; k += 2) p.px(cx + k, hy + ry - 1, '#6a6a60');
    // A rat on the brim.
    const rx0 = cx + rx - 4;
    const ry0 = top - 7 + (f.walk % 2);
    p.rect(rx0, ry0, 7, 4, '#5a5048').rect(rx0 + 5, ry0 - 1, 3, 3, '#6a6058').px(rx0 + 7, ry0, PAL.red).px(rx0 + 6, ry0 - 2, '#8a8078');
    p.line(rx0, ry0 + 2, rx0 - 4, ry0 + 5 - (f.walk % 2) * 2, '#c89090');
  },
  hands(p, lx, ly, rx, ry, f) {
    // Shovel claws for digging, and a lantern swinging on the right.
    for (let k = 0; k < 4; k++) p.rect(lx - 1 + k * 3, ly + 3, 2, 5 + (k % 2), '#d8d0b0').px(lx - 1 + k * 3, ly + 8 + (k % 2), '#8a8470');
    const lx2 = rx + 3;
    const ly2 = ry + 3 + (f.walk % 2);
    p.rect(lx2 + 2, ly2, 1, 3, PAL.ink).rect(lx2, ly2 + 3, 6, 8, '#303030').rect(lx2 + 1, ly2 + 4, 4, 6, f.walk % 2 ? PAL.gold : '#ffe07a');
    p.px(lx2 + 2, ly2 + 6, PAL.white);
  },
};

// ---------------------------------------------------------------- Server room: the Mainframe
// A room-sized computer that got up and walked: tape reels for eyes, blinking panels, cable arms.
function mainframe(f) {
  const p = new Pix(60, 80);
  const rnd = mulberry32(f.walk * 31 + (f.atk || 0) * 97 + 11);
  const bob = f.walk % 2;
  const x0 = 10;
  const y0 = 4 + bob;
  const w = 40;
  const h = 60;
  // Cable-bundle legs.
  const lift = [[0, 0], [3, 0], [0, 0], [0, 3]][f.walk % 4];
  for (const [lx, l] of [[16, lift[0]], [36, lift[1]]]) {
    for (let k = 0; k < 4; k++) p.rect(lx + k * 2, y0 + h - 2, 2, 80 - (y0 + h) - l, ['#202020', '#3a3a3a', PAL.winNavy, '#3a3a3a'][k]);
    p.rect(lx - 2, 77 - l, 12, 3, '#505058');
  }
  // Cabinet.
  p.bevel(x0, y0, w, h, '#c8c0a8', '#ece4cc', '#8a826c');
  p.rect(x0 + 2, y0 + 2, w - 4, 3, PAL.winNavy);
  micro(p, 'IBM', x0 + 4, y0 + 1, '#c8c0a8');
  micro(p, 'Y2K', x0 + w - 16, y0 + 1, PAL.red);
  // Tape reel eyes, spinning.
  for (const s of [0, 1]) {
    const cx = x0 + 11 + s * 18;
    const cy = y0 + 15;
    p.rect(cx - 8, cy - 8, 17, 17, '#2a2a30');
    p.oval(cx, cy, 7, 7, f.atk ? '#5a1010' : '#4a4a52');
    p.oval(cx, cy, 5, 5, f.atk ? PAL.red : '#8a8a94');
    p.oval(cx, cy, 2, 2, '#1a1a20');
    const a = ((f.walk + s) / 4) * Math.PI * 2 * (s ? 1 : -1);
    for (let k = 0; k < 3; k++) {
      const b = a + (k / 3) * Math.PI * 2;
      p.px(cx + Math.round(Math.cos(b) * 4), cy + Math.round(Math.sin(b) * 4), '#1a1a20');
    }
    p.px(cx - 3, cy - 4, PAL.white);
  }
  // Blinking lamp panel.
  p.rect(x0 + 3, y0 + 26, w - 6, 13, '#1a1a20');
  const lamps = [PAL.red, PAL.gold, PAL.lime, PAL.cyan];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) p.rect(x0 + 5 + c * 4, y0 + 28 + r * 4, 2, 2, rnd() < 0.5 ? lamps[(r + c) % 4] : '#3a3a40');
  // Punch-card mouth: spits cards when it attacks.
  p.rect(x0 + 8, y0 + 42, w - 16, 5, '#050508');
  if (f.atk) {
    micro(p, 'ERR', x0 + 14, y0 + 42, PAL.red);
    for (let k = 0; k < 3; k++) p.rect(x0 + 10 + k * 7, y0 + 48 + k, 6, 3, PAL.cream).px(x0 + 11 + k * 7, y0 + 49 + k, PAL.ink);
  } else p.rect(x0 + 10, y0 + 44, w - 20, 1, '#40ff60');
  // Vents and a floppy slot.
  for (let k = 0; k < 4; k++) p.rect(x0 + 4, y0 + 50 + k * 2, 12, 1, '#8a826c');
  p.rect(x0 + w - 16, y0 + 51, 12, 2, '#303030');
  // Goo leaking from a seam.
  p.rect(x0 + w - 4, y0 + 20, 2, 9, PAL.blood).px(x0 + w - 4, y0 + 29, PAL.blood);
  // Cable arms reaching forward, plugs for hands.
  const sw = [0, 1, 0, -1][f.walk % 4];
  const up = f.atk ? -14 : 0;
  for (const s of [-1, 1]) {
    const sx = s < 0 ? x0 : x0 + w - 1;
    const hx = sx + s * 9;
    const hy = y0 + 30 + sw * s + up;
    p.line(sx, y0 + 22, hx, hy, '#202020').line(sx, y0 + 23, hx, hy + 1, '#3a3a3a').line(sx, y0 + 24, hx, hy + 2, PAL.winNavy);
    p.rect(hx - 2, hy, 5, 5, '#9aa3b5').rect(hx - 1, hy + 5, 1, 2, PAL.gold).rect(hx + 1, hy + 5, 1, 2, PAL.gold);
    if (f.atk) p.px(hx, hy + 8, PAL.cyan).px(hx - 1, hy + 9, PAL.white).px(hx + 1, hy + 9, PAL.cyan);
  }
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------- Ball Drop: the Countdown
// The Times Square ball itself, cracked open by the bug and walking on its own rigging.
function countdown(f) {
  const p = new Pix(84, 84);
  const cx = 42;
  const cy = 34 + (f.walk % 2);
  const R = 30;
  // Truss legs.
  const lift = [[0, 0], [3, 0], [0, 0], [0, 3]][f.walk % 4];
  for (const [s, l] of [[-1, lift[0]], [1, lift[1]], [-0.45, lift[1]], [0.45, lift[0]]]) {
    const hx = cx + s * 16;
    const fx = cx + s * 34;
    const fy = 83 - l;
    p.line(hx, cy + 20, fx, fy, '#6a6e80').line(hx + 1, cy + 20, fx + 1, fy, '#9aa3b5');
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      p.px(Math.round(hx + (fx - hx) * t) + 2, Math.round(cy + 20 + (fy - cy - 20) * t), '#4a4e60');
    }
    p.rect(fx - 2, fy - 1, 5, 2, '#4a4e60');
  }
  // Crystal facets: a diamond grid clipped to the sphere, twinkling frame to frame.
  const rnd = mulberry32(f.walk * 13 + 5);
  const cols = [PAL.white, '#dff0ff', PAL.cyan, PAL.pinkLight, PAL.gold, '#9cc8f0'];
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      if (x * x + y * y > R * R) continue;
      const u = Math.floor((x + y + 64) / 6);
      const v = Math.floor((x - y + 64) / 6);
      const edge = (x + y + 64) % 6 === 0 || (x - y + 64) % 6 === 0;
      const shade = (x + y) / (R * 2);
      let c = cols[(u * 3 + v * 5) % cols.length];
      if (edge) c = '#6a6e80';
      else if (shade > 0.35) c = '#8a90a8';
      p.px(cx + x, cy + y, c);
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * (R - 4);
    const sx = cx + Math.round(Math.cos(a) * r);
    const sy = cy + Math.round(Math.sin(a) * r);
    p.px(sx, sy, PAL.white).px(sx - 1, sy, '#ffffffaa').px(sx + 1, sy, '#ffffffaa').px(sx, sy - 1, '#ffffffaa').px(sx, sy + 1, '#ffffffaa');
  }
  // The LED band across the middle: 00:00, or ERR when it attacks.
  p.rect(cx - R + 2, cy - 5, R * 2 - 3, 11, '#0a0406');
  p.rect(cx - R + 2, cy - 5, R * 2 - 3, 1, '#3a2024');
  if (f.atk) micro(p, 'ERR!!', cx - 19, cy - 3, PAL.red, 2);
  else sevenSeg(p, f.walk % 2 ? '00:00' : '00 00', cx - 21, cy - 3, 2, PAL.red, '#2a0606');
  // The crack, with goo and eyes peering out.
  const crack = [[-8, -26], [-4, -20], [-9, -14], [-2, -10], [3, -14], [1, -22], [6, -27]];
  for (let i = 1; i < crack.length; i++) p.line(cx + crack[i - 1][0], cy + crack[i - 1][1], cx + crack[i][0], cy + crack[i][1], PAL.ink);
  p.rect(cx - 6, cy - 19, 7, 5, '#0a0406');
  const eye = f.atk ? PAL.red : PAL.eye;
  p.px(cx - 5, cy - 17, eye).px(cx - 1, cy - 17, eye);
  p.rect(cx + 8, cy + 8, 2, 12, PAL.blood).px(cx + 8, cy + 20, PAL.blood).rect(cx - 16, cy + 6, 2, 7, PAL.blood);
  // Spotlights on top and cables whipping.
  p.rect(cx - 3, cy - R - 5, 7, 6, '#4a4e60').rect(cx - 2, cy - R - 4, 5, 2, f.walk % 2 ? PAL.gold : PAL.white);
  if (f.atk) {
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.5;
      p.line(cx + Math.cos(a) * (R + 2), cy + Math.sin(a) * (R + 2), cx + Math.cos(a) * (R + 9), cy + Math.sin(a) * (R + 9), PARTY[k]);
    }
  }
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------- frame sets
function set(make, hmul = 1) {
  const walk = [0, 1, 2, 3].map((i) => make({ walk: i, atk: 0 }));
  const atk = [make({ walk: 0, atk: 1 }), make({ walk: 0, atk: 2 })];
  const all = { walk, atk, flash: [walk[0].silhouette(PAL.white)], die: deathFrames(walk[0]) };
  const T = {};
  for (const k in all) T[k] = all[k].map(tex);
  T.aspect = walk[0].w / walk[0].h;
  T.pix = walk[0];
  T.hmul = hmul;
  return T;
}

function human(o) {
  return (f) => {
    const p = humanoid(o, f);
    p.outline(PAL.ink);
    return p;
  };
}

// Boss frame sets by district, the Millennium Bug first.
export function buildBosses(bugSet) {
  return [bugSet, set(human(FRONTMAN)), set(human(CONDUCTOR)), set(mainframe), set(countdown)];
}

// A data packet fired by the Mainframe and the Countdown (c 0 or 1), or a Spitter's green glob (c 2).
export function packetPix(c) {
  const p = new Pix(10, 10);
  if (c === 2) {
    p.oval(5, 5, 4, 4, '#4aa82a').oval(4, 4, 3, 3, PAL.lime).px(3, 3, '#e8ffd0').px(7, 7, '#2a6a1a');
    p.outline(PAL.ink);
    return p;
  }
  p.rect(1, 1, 8, 8, c ? PAL.red : PAL.cyan).rect(2, 2, 6, 6, c ? '#ff9090' : '#bff8f8');
  micro(p, c ? '1' : '0', 4, 3, PAL.ink);
  p.outline(PAL.ink);
  return p;
}

// The Conductor tunnelling under the street: a heaving mound of broken asphalt.
export function moundPix(f) {
  const p = new Pix(32, 14);
  const rnd = mulberry32(f * 17 + 9);
  p.oval(16, 13, 15, 7 + f, '#4a3e30');
  p.oval(15, 12, 12, 5 + f, '#6a5a44');
  p.oval(13, 11, 7, 3, '#8a7858');
  for (let i = 0; i < 9; i++) {
    const x = 4 + Math.floor(rnd() * 24);
    const y = 6 + Math.floor(rnd() * 7) - f;
    p.rect(x, y, 3, 2, rnd() < 0.5 ? '#2b2740' : '#3a3552').px(x, y, '#5a5470');
  }
  p.line(10, 9 - f, 14, 12, PAL.ink).line(18, 8 - f, 21, 12, PAL.ink);
  p.outline(PAL.ink);
  return p;
}
