// The horde's wardrobe. Every district dresses its dead differently: party-goers in Times Square,
// the theatre crowd on Broadway, commuters in the subway, the IT department in the server room,
// and everyone at once under confetti at the ball drop. Plus two new party fouls: crawlers and bloaters.
import { Pix, micro } from './pix.js';
import { PAL, PARTY } from '../core/palette.js';
import { mulberry32 } from '../core/util.js';
import { humanoid, SHAMBLER, RUNNER, BRUTE, GLITCH, SKIN, crtHead, glitchify, deathFrames, tex } from './sprites.js';

// Four flavours of undead skin.
const SKINS = [
  SKIN,
  { skin: '#9aa88a', skinL: '#c0ccb0', skinD: '#62705a', skinDeep: '#3a4436' },
  { skin: '#8e9ab8', skinL: '#b8c2dc', skinD: '#5a6284', skinDeep: '#343a54' },
  { skin: '#a8a85a', skinL: '#cccc80', skinD: '#6e6e32', skinDeep: '#42421c' },
];

const cloth = (top, topL, topD) => ({ top, topL, topD, sleeve: top, sleeveD: topD });

// ---------------------------------------------------------------- shambler outfits
const OUT = {
  tux: {},
  sequin: {
    ...cloth('#d8a830', '#ffe080', '#8a6a18'), sleeve: null, pants: '#d8a830', pantsD: '#8a6a18', shorts: 5, shoes: '#c01848',
    torsoArt(p, x0, y0, w, y1) {
      const r = mulberry32(x0 * 7 + y0);
      for (let k = 0; k < 12; k++) p.px(x0 + 1 + Math.floor(r() * (w - 2)), y0 + Math.floor(r() * (y1 - y0)), r() < 0.5 ? PAL.white : PAL.cream);
      p.rect(x0 + 2, y0, w - 4, 1, '#ffe080');
    },
    headArt(p, cx, hy, rx, ry) {
      // Long hair falling past the shoulders, a tiara.
      p.rect(cx - rx - 1, hy - ry + 1, 2, ry * 2 + 3, '#c89a4a').rect(cx + rx, hy - ry + 1, 2, ry * 2 + 3, '#8a6a2a');
      p.rect(cx - rx + 1, hy - ry, rx * 2 - 1, 2, '#c89a4a');
      p.px(cx - 2, hy - ry - 1, PAL.cyan).px(cx, hy - ry - 2, PAL.white).px(cx + 2, hy - ry - 1, PAL.cyan).rect(cx - 3, hy - ry, 7, 1, PAL.steelLight);
    },
  },
  specs2000: {
    ...cloth('#6a3a9c', '#9a6acc', '#3e1e64'), pants: PAL.denim, pantsD: PAL.denimDark,
    torsoArt(p, x0, y0, w) {
      p.rect(x0 + 3, y0 + 3, w - 6, 3, '#9a6acc').rect(x0 + 2, y0 + 8, w - 4, 2, '#4e2a7c');
      p.px(x0 + 3, y0, PAL.cream).px(x0 + w - 4, y0, PAL.cream).px(x0 + 3, y0 + 1, PAL.cream).px(x0 + w - 4, y0 + 1, PAL.cream);
    },
    headArt(p, cx, hy, rx, ry, f) {
      // Novelty "2000" glasses: the two zeros are the lenses.
      p.rect(cx - 7, hy - 3, 15, 1, PAL.gold);
      p.px(cx - 7, hy - 2, PAL.gold).px(cx - 6, hy - 1, PAL.gold).px(cx - 7, hy, PAL.gold).rect(cx - 7, hy, 2, 1, PAL.gold);
      for (const s of [-2, 3]) p.rect(cx + s - 2, hy - 2, 4, 3, PAL.gold).rect(cx + s - 1, hy - 1, 2, 1, PAL.ink);
      p.px(cx + 6, hy - 2, PAL.gold).px(cx + 7, hy - 1, PAL.gold).px(cx + 6, hy, PAL.gold).px(cx + 7, hy - 2, PAL.gold).px(cx + 7, hy, PAL.gold);
      // Party blower.
      const l = f.atk ? 1 : 4;
      p.rect(cx + 1, hy + 3, l, 1, PAL.pink).px(cx + 1 + l, hy + 2, PAL.pinkLight);
      p.rect(cx - 4, hy - ry, 8, 1, '#3a2a1a');
    },
  },
  tourist: {
    ...cloth('#f0f0f0', '#ffffff', '#b8b8c8'), sleeve: null, pants: '#c8b078', pantsD: '#8a7848', shorts: 5, socks: PAL.white, shoes: '#3a3a44',
    torsoArt(p, x0, y0, w) {
      const c = x0 + Math.floor(w / 2);
      micro(p, 'NY', c - 3, y0 + 2, PAL.red);
      p.px(c - 4, y0 + 2, PAL.red).px(c - 4, y0 + 3, PAL.red);
      // Camera on a strap, fanny pack.
      p.line(x0, y0, x0 + w - 1, y0 + 7, '#2a2a30');
      p.rect(x0 + w - 5, y0 + 6, 5, 4, '#1a1a20').px(x0 + w - 3, y0 + 7, '#6a8ad0');
      p.rect(x0 + 1, y0 + 9, w - 2, 2, PAL.pink).rect(c - 1, y0 + 9, 3, 2, PAL.cyan);
    },
    headArt(p, cx, hy, rx, ry) {
      p.oval(cx, hy - ry + 1, rx, 2, PAL.red).rect(cx - rx, hy - ry + 1, rx * 2 + 1, 2, PAL.red).rect(cx - 1, hy - ry + 3, rx + 4, 1, '#a01818');
      p.px(cx, hy - ry - 1, PAL.white);
    },
  },
  phantom: {
    ...cloth(PAL.tux, PAL.tuxLight, '#0e0c1a'),
    torsoArt(p, x0, y0, w, y1) {
      const c = x0 + Math.floor(w / 2);
      p.rect(c - 1, y0, 3, 7, PAL.white).px(c, y0 + 1, PAL.ink).rect(c - 2, y0, 5, 1, PAL.ink);
      // Cape draped from the shoulders, red lining showing.
      p.rect(x0 - 3, y0, 2, y1 - y0 + 6, '#0a0810').rect(x0 + w + 1, y0, 2, y1 - y0 + 6, '#0a0810');
      p.rect(x0 - 2, y0 + 1, 1, y1 - y0 + 5, '#8e1a36').rect(x0 + w + 1, y0 + 1, 1, y1 - y0 + 5, '#8e1a36');
    },
    headArt(p, cx, hy, rx, ry) {
      // Slicked hair and the half mask.
      p.oval(cx, hy - ry + 1, rx, 2, '#0a0810').rect(cx - rx, hy - ry + 1, 2, 4, '#0a0810');
      for (let y = -ry + 2; y <= 2; y++) p.rect(cx + 1, hy + y, rx - (y > 0 ? 1 : 0), 1, '#f4f0e8');
      p.rect(cx + 2, hy - 1, 2, 2, PAL.ink).px(cx + 2, hy - 1, PAL.eye);
      p.px(cx + rx - 1, hy - 3, '#c8c0b0');
    },
  },
  chorus: {
    ...cloth('#e82e88', '#ff8fc4', '#8a1a50'), sleeve: null, pants: '#e8b8a0', pantsD: '#b08070', shoes: PAL.gold, tall: 6,
    torsoArt(p, x0, y0, w, y1) {
      const r = mulberry32(x0 + y1);
      for (let k = 0; k < 10; k++) p.px(x0 + 1 + Math.floor(r() * (w - 2)), y0 + Math.floor(r() * (y1 - y0)), r() < 0.5 ? PAL.gold : PAL.white);
      p.rect(x0, y1, w, 1, PAL.gold);
    },
    headArt(p, cx, hy, rx, ry, f) {
      // Feather headdress fanning up.
      const top = hy - ry;
      const sway = f.walk % 2;
      for (let k = -3; k <= 3; k++) {
        const h = 7 - Math.abs(k);
        const x = cx + k * 2 + (k ? sway : 0);
        p.line(cx, top, x, top - h, k % 2 ? PAL.white : PAL.pinkLight);
        p.px(x, top - h - 1, k % 2 ? PAL.pinkLight : PAL.white);
      }
      p.rect(cx - rx, top, rx * 2 + 1, 2, PAL.gold).px(cx, top, PAL.cyan);
      p.rect(cx - rx - 1, hy - 2, 1, 5, '#3a1a10').rect(cx + rx + 1, hy - 2, 1, 5, '#3a1a10');
    },
    post(p, o) {
      // Fishnets.
      for (let y = o.hipY + 2; y < o.footY - 2; y += 2) {
        for (let x = o.cx - 5; x <= o.cx + 5; x += 2) if (p.g.getImageData(x, y, 1, 1).data[3]) p.px(x, y, '#6a4a3a');
      }
    },
  },
  usher: {
    ...cloth('#b81830', '#e84858', '#6a0a1a'), pants: '#141024', pantsD: '#08060c',
    torsoArt(p, x0, y0, w) {
      for (let y = y0 + 1; y < y0 + 10; y += 2) p.px(x0 + 3, y, PAL.gold).px(x0 + w - 4, y, PAL.gold);
      p.rect(x0 + 1, y0, w - 2, 1, PAL.gold);
    },
    headArt(p, cx, hy, rx, ry) {
      p.rect(cx - 3, hy - ry - 2, 7, 3, '#b81830').rect(cx - 3, hy - ry, 7, 1, PAL.gold).px(cx - 2, hy - ry - 2, '#e84858');
    },
    hands(p, lx, ly) {
      // A flashlight still on.
      p.rect(lx - 1, ly - 3, 3, 4, '#2a2a30').px(lx, ly - 4, PAL.cream).px(lx, ly - 5, '#fff4d688');
    },
  },
  commuter: {
    ...cloth('#a08858', '#c8b080', '#6a5830'), pants: '#3a3a4a', pantsD: '#22222e',
    torsoArt(p, x0, y0, w, y1) {
      const c = x0 + Math.floor(w / 2);
      p.line(c - 2, y0, c, y0 + 4, '#6a5830').line(c + 2, y0, c, y0 + 4, '#6a5830');
      p.rect(c - 1, y0, 3, 3, PAL.white).px(c, y0 + 1, '#2a4a8a').px(c, y0 + 2, '#2a4a8a');
      p.rect(x0, y0 + 7, w, 1, '#6a5830').px(x0 + 2, y0 + 7, PAL.gold);
      p.rect(x0 - 1, y1 + 1, w + 2, 5, '#a08858').rect(x0 + w - 1, y1 + 1, 2, 5, '#6a5830').rect(c, y1 + 1, 1, 5, '#6a5830');
    },
    headArt(p, cx, hy, rx, ry) {
      // Comb-over.
      p.rect(cx - rx, hy - ry + 1, rx * 2 + 1, 1, '#5a4a3a').line(cx - rx, hy - ry + 2, cx + 2, hy - ry, '#5a4a3a');
    },
    hands(p, lx, ly) {
      p.rect(lx - 3, ly + 2, 8, 6, '#4a2a1a').rect(lx - 3, ly + 2, 8, 1, '#6a4a2a').rect(lx, ly + 1, 2, 1, PAL.gold).px(lx + 2, ly + 4, PAL.gold);
    },
  },
  hardhat: {
    ...cloth('#ff7a1a', '#ffb070', '#b04a08'), sleeve: '#6a6a78', sleeveD: '#44444e', pants: PAL.denim, pantsD: PAL.denimDark, shoes: '#4a2a10',
    torsoArt(p, x0, y0, w) {
      p.rect(x0, y0 + 4, w, 1, '#e8f0ff').rect(x0, y0 + 8, w, 1, '#e8f0ff');
      p.rect(x0 + Math.floor(w / 2) - 1, y0, 2, 10, '#6a6a78');
    },
    headArt(p, cx, hy, rx, ry) {
      p.oval(cx, hy - ry + 1, rx + 1, 3, PAL.gold).rect(cx - rx - 2, hy - ry + 2, rx * 2 + 5, 1, PAL.goldDark);
      p.px(cx - 2, hy - ry - 1, '#fff0a0').rect(cx, hy - ry - 2, 1, 3, PAL.goldDark);
    },
  },
  conductor: {
    ...cloth('#1a2a5a', '#2e4a8a', '#0e1630'), pants: '#1a2a5a', pantsD: '#0e1630',
    torsoArt(p, x0, y0, w) {
      const c = x0 + Math.floor(w / 2);
      for (let y = y0 + 1; y < y0 + 10; y += 3) p.px(c - 2, y, PAL.gold).px(c + 2, y, PAL.gold);
      p.rect(x0 + 1, y0 + 1, 2, 2, PAL.gold);
    },
    headArt(p, cx, hy, rx, ry) {
      p.rect(cx - rx - 1, hy - ry - 1, rx * 2 + 3, 3, '#1a2a5a').rect(cx - rx - 2, hy - ry + 2, rx * 2 + 4, 1, '#0a0a14');
      p.px(cx, hy - ry, PAL.gold).px(cx - 1, hy - ry, PAL.gold);
    },
  },
  itguy: {
    ...cloth('#e8f0f8', '#ffffff', '#a8b8c8'), pants: '#b0985a', pantsD: '#806a3a', shoes: '#2a1a0a',
    torsoArt(p, x0, y0, w) {
      const c = x0 + Math.floor(w / 2);
      p.rect(c, y0, 1, 8, '#c02030').px(c - 1, y0, '#c02030').px(c + 1, y0, '#c02030');
      // Lanyard and badge, pocket protector with pens.
      p.line(c - 3, y0, c - 2, y0 + 6, PAL.bondi).line(c + 3, y0, c + 2, y0 + 6, PAL.bondi);
      p.rect(c - 2, y0 + 6, 4, 4, PAL.white).rect(c - 2, y0 + 6, 4, 1, PAL.bondi).px(c - 1, y0 + 8, '#8a6a4a');
      p.rect(x0 + w - 4, y0 + 2, 3, 3, '#c8d0e0').px(x0 + w - 4, y0 + 1, PAL.red).px(x0 + w - 3, y0 + 1, PAL.bondi).px(x0 + w - 2, y0 + 1, PAL.ink);
    },
    headArt(p, cx, hy, rx, ry) {
      p.rect(cx - 5, hy - 2, 4, 3, PAL.ink).rect(cx + 1, hy - 2, 4, 3, PAL.ink).rect(cx - 1, hy - 2, 2, 1, PAL.ink);
      p.px(cx - 4, hy - 1, PAL.eye).px(cx + 2, hy - 1, PAL.eye);
      p.rect(cx - rx, hy - ry + 1, rx * 2 + 1, 2, '#6a4a2a');
    },
  },
  banker: {
    ...cloth('#f4f4f8', '#ffffff', '#b8bcc8'), pants: '#4a4a5a', pantsD: '#2a2a36',
    torsoArt(p, x0, y0, w, y1) {
      const c = x0 + Math.floor(w / 2);
      p.rect(x0 + 2, y0, 1, y1 - y0 + 1, '#c02030').rect(x0 + w - 3, y0, 1, y1 - y0 + 1, '#c02030');
      p.rect(c, y0, 1, 8, PAL.gold).px(c - 1, y0, PAL.gold).px(c + 1, y0, PAL.gold).px(c, y0 + 3, PAL.goldDark);
      p.px(x0 + 1, y0 + 6, PAL.blood).px(x0 + 1, y0 + 7, PAL.blood);
    },
    headArt(p, cx, hy, rx, ry) {
      p.oval(cx, hy - ry + 1, rx, 2, '#1a1010').rect(cx - rx, hy - ry + 1, 2, 3, '#1a1010').px(cx + 1, hy - ry, '#5a5a6a');
    },
    hands(p, lx, ly) {
      // Still clutching a cellphone the size of a brick.
      p.rect(lx - 1, ly - 4, 3, 6, '#2a2a30').px(lx, ly - 5, '#2a2a30').px(lx, ly - 3, '#40ff60');
    },
  },
  guard: {
    ...cloth('#5a6a8a', '#7a8aaa', '#3a4460'), pants: '#2a3044', pantsD: '#181c2a',
    torsoArt(p, x0, y0, w, y1) {
      p.rect(x0 + 1, y0 + 2, 3, 3, PAL.gold).px(x0 + 2, y0 + 3, PAL.goldDark);
      p.rect(x0, y1 - 1, w, 2, '#1a1a20').rect(x0 + w - 4, y1 - 4, 3, 4, '#2a2a30').px(x0 + w - 3, y1 - 5, '#2a2a30');
    },
    headArt(p, cx, hy, rx, ry) {
      p.rect(cx - rx - 1, hy - ry - 1, rx * 2 + 3, 3, '#3a4460').rect(cx - rx, hy - ry + 2, rx * 2 + 2, 1, '#0a0a14');
      p.px(cx, hy - ry, PAL.gold);
    },
  },
};

// Which outfits each district's shamblers wear. The ball drop pulls from everywhere.
const DISTRICT_OUTFITS = [
  ['tux', 'sequin', 'specs2000', 'tourist'],
  ['phantom', 'chorus', 'usher', 'tux', 'sequin'],
  ['commuter', 'hardhat', 'conductor', 'tourist'],
  ['itguy', 'banker', 'guard', 'commuter'],
  ['tux', 'sequin', 'specs2000', 'phantom', 'chorus', 'hardhat', 'itguy', 'banker'],
];

// Ravers: glow sticks forever, different hair and tops.
const RAVERS = [
  {},
  {
    top: PAL.cyan, topL: PAL.bondiLight, topD: PAL.cyanDark, pants: '#3a3a44', pantsD: '#22222a',
    headArt(p, cx, hy, rx, ry) {
      // Bucket hat and a dummy.
      p.rect(cx - rx - 1, hy - ry, rx * 2 + 3, 2, PAL.gold).rect(cx - rx + 1, hy - ry - 2, rx * 2 - 1, 2, PAL.gold).rect(cx - rx - 1, hy - ry + 1, rx * 2 + 3, 1, PAL.goldDark);
      p.px(cx, hy + 3, PAL.pink).px(cx - 1, hy + 3, PAL.pink).px(cx + 1, hy + 3, PAL.pink);
    },
  },
  {
    top: PAL.lime, topL: PAL.limeLight, topD: '#3f7a1e', pants: '#6a3a9c', pantsD: '#3e1e64',
    headArt(p, cx, hy, rx, ry) {
      // Pigtails and welder goggles.
      p.rect(cx - rx, hy - ry, rx * 2 + 1, 2, PAL.pink).rect(cx - rx - 3, hy - ry + 1, 3, 3, PAL.pink).rect(cx + rx + 1, hy - ry + 1, 3, 3, PAL.pink);
      p.rect(cx - rx, hy - 2, rx * 2 + 1, 1, '#2a2a30').rect(cx - 3, hy - 2, 2, 2, PAL.cyan).rect(cx + 1, hy - 2, 2, 2, PAL.cyan);
    },
  },
];

const BOUNCERS = [
  {},
  { top: '#1a2a5a', topL: '#2e4a8a', topD: '#0e1630', label: 'SEC', labelCol: PAL.white },
  { top: '#3a0a1a', topL: '#5a1a2a', topD: '#1a0408', label: 'CREW', labelCol: PAL.gold },
];
const BOUNCER_BY_DISTRICT = [[0], [2, 0], [1, 2], [1], [0, 1, 2]];

const OFFICE = [
  { top: '#9ec4e8', topL: '#c8e0f8', topD: '#6a8ab0' },
  { top: '#f0f0f0', topL: '#ffffff', topD: '#b8b8c8' },
  { top: '#e8b8c8', topL: '#ffd8e0', topD: '#b08090' },
];
const SCREENS = ['bsod', '404', 'hourglass', 'prompt', 'bars'];

// ---------------------------------------------------------------- new types
function crawler(o, f) {
  const p = new Pix(30, 18);
  const cx = 15;
  const sk = o;
  // Torso seen head-on, low to the street, a ragged shirt.
  p.oval(cx, 12, 8, 4, o.topD);
  p.oval(cx - 1, 11, 7, 3, o.top);
  p.px(cx - 5, 10, o.topL).px(cx - 4, 9, o.topL);
  // Arms dragging it forward; one reaches while the other pulls.
  const reach = f.atk ? 2 : f.walk % 4;
  const lUp = f.atk || reach === 0 ? 4 : reach === 1 ? 2 : 0;
  const rUp = f.atk || reach === 2 ? 4 : reach === 3 ? 2 : 0;
  p.line(cx - 6, 11, 3, 15 - lUp, o.sleeve).line(cx - 6, 12, 3, 16 - lUp, o.sleeveD);
  p.line(cx + 6, 11, 26, 15 - rUp, o.sleeve).line(cx + 6, 12, 26, 16 - rUp, o.sleeveD);
  p.rect(1, 15 - lUp, 3, 2, sk.skin).px(1, 17 - lUp, sk.skinD).px(3, 17 - lUp, sk.skinD);
  p.rect(26, 15 - rUp, 3, 2, sk.skin).px(26, 17 - rUp, sk.skinD).px(28, 17 - rUp, sk.skinD);
  // Head, craned up.
  const hy = 7 + (f.walk % 2);
  p.oval(cx, hy, 4, 4, sk.skin).px(cx + 3, hy, sk.skinD).px(cx + 3, hy + 1, sk.skinD).px(cx - 3, hy - 2, sk.skinL);
  const eye = f.atk ? PAL.red : PAL.eye;
  p.px(cx - 2, hy, eye).px(cx + 1, hy, eye);
  p.rect(cx - 1, hy + 2, 3, f.atk ? 2 : 1, sk.skinDeep);
  p.rect(cx - 3, hy - 4, 7, 1, o.hair || '#3a2a1a');
  // Goo trail.
  p.rect(cx - 3, 16, 7, 1, PAL.blood).px(cx - 5, 17, PAL.blood).px(cx + 4, 17, PAL.blood);
  p.outline(PAL.ink);
  return p;
}

function bloater(o, f) {
  const p = new Pix(36, 52);
  const cx = 18;
  const puff = f.walk % 2;
  // Party balloons tied to both wrists, bobbing.
  const bob = f.walk % 4 < 2 ? 0 : 1;
  const bl = [[6, 6 + bob, PAL.pink], [30, 5 + (1 - bob), PAL.cyan]];
  for (const [bx, by, c] of bl) {
    p.line(bx, by + 5, bx < cx ? 8 : 28, 32, PAL.cream);
    p.oval(bx, by, 4, 5, c).px(bx - 2, by - 3, PAL.white).px(bx - 1, by - 3, '#ffffffaa').px(bx, by + 6, c);
  }
  // Stubby legs.
  const step = f.walk % 2;
  p.rect(cx - 6, 42, 4, 8 - step, o.pants).rect(cx + 2, 42, 4, 7 + step, o.pants);
  p.rect(cx - 7, 49 - step, 5, 2, '#0a0a10').rect(cx + 2, 48 + step, 5, 2, '#0a0a10');
  // The belly: stretched party shirt riding up over swollen green skin.
  const rx = 12 + puff;
  p.oval(cx, 33, rx, 11, o.skinD);
  p.oval(cx - 1, 32, rx - 1, 10, o.skin);
  p.oval(cx - 4, 29, 5, 4, o.skinL);
  p.oval(cx, 27, rx - 1, 7, o.top);
  p.oval(cx - 3, 25, 5, 3, o.topL);
  for (let k = -rx + 2; k < rx - 1; k += 3) p.px(cx + k, 34 - Math.abs(k) / 4, o.topD);
  p.px(cx - 4, 38, o.skinDeep).line(cx + 2, 36, cx + 5, 40, o.skinDeep).line(cx - 7, 35, cx - 5, 39, '#6a8a2a');
  p.oval(cx, 37, 1, 1, o.skinDeep);
  // Stubby arms.
  const up = f.atk ? 6 : 0;
  p.rect(cx - rx - 2, 26 - up, 3, 7, o.top).rect(cx + rx, 26 - up, 3, 7, o.top);
  p.rect(cx - rx - 3, 32 - up, 4, 3, o.skin).rect(cx + rx, 32 - up, 4, 3, o.skin);
  // Tiny head, party hat, puffed cheeks.
  const hy = 16;
  p.oval(cx, hy, 5, 5, o.skin).px(cx + 4, hy, o.skinD).px(cx + 4, hy + 1, o.skinD).px(cx - 3, hy - 3, o.skinL);
  p.px(cx - 4, hy + 2, PAL.pink).px(cx + 4, hy + 2, PAL.pink);
  const eye = f.atk ? PAL.red : PAL.eye;
  p.px(cx - 2, hy - 1, eye).px(cx + 2, hy - 1, eye);
  p.oval(cx, hy + 3, 1, f.atk ? 1 : 0, o.skinDeep);
  for (let k = 0; k < 5; k++) p.rect(cx - 2 + Math.floor(k / 2), hy - 5 - k, 5 - k, 1, k % 2 ? PAL.gold : PAL.lime);
  p.px(cx, hy - 10, PAL.pink);
  p.outline(PAL.ink);
  return p;
}

// ---------------------------------------------------------------- build
function frameSet(make, confetti = false) {
  const deco = (p) => {
    if (!confetti) return p;
    // Ball-drop zombies are covered in confetti.
    const r = mulberry32(p.w * 131 + p.h);
    const img = p.g.getImageData(0, 0, p.w, p.h).data;
    for (let k = 0; k < 18; k++) {
      const x = Math.floor(r() * p.w);
      const y = Math.floor(r() * p.h);
      if (img[(y * p.w + x) * 4 + 3] > 0 && !(img[(y * p.w + x) * 4] === 0x14 && img[(y * p.w + x) * 4 + 1] === 0x0c)) p.px(x, y, PARTY[k % PARTY.length]);
    }
    return p;
  };
  // Drawn on the low-res grid, then refined to four times the detail so they hold up at arm's length.
  const walk = [0, 1, 2, 3].map((i) => deco(make({ walk: i, atk: 0 })).refine());
  const atk = [deco(make({ walk: 0, atk: 1 })).refine(), deco(make({ walk: 0, atk: 2 })).refine()];
  const all = { walk, atk, flash: [walk[0].silhouette(PAL.white)], die: deathFrames(walk[0]) };
  const T = {};
  for (const k in all) T[k] = all[k].map(tex);
  T.aspect = walk[0].w / walk[0].h;
  return T;
}

function shamblerSet(name, skin, confetti) {
  const o = OUT[name];
  const tall = o.tall || 0;
  const base = { ...SHAMBLER, ...skin, ...o, h: SHAMBLER.h + tall };
  if (!o.sleeve && o.top) {
    base.sleeve = skin.skin;
    base.sleeveD = skin.skinD;
  }
  for (const k of ['headY', 'shoulderY', 'hipY', 'footY']) base[k] = SHAMBLER[k] + tall;
  if (name === 'tux') Object.assign(base, { torsoArt: SHAMBLER.torsoArt, headArt: SHAMBLER.headArt });
  const make = (f) => {
    const p = humanoid(base, f);
    p.outline(PAL.ink);
    return p;
  };
  const T = frameSet(make, confetti);
  T.hmul = base.h / SHAMBLER.h;
  return T;
}

export function buildHorde() {
  const H = { shambler: [], runner: [], brute: [], glitch: [], crawler: [], bloater: [] };
  for (let d = 0; d < 5; d++) {
    const confetti = d === 4;
    H.shambler[d] = DISTRICT_OUTFITS[d].map((name, k) => shamblerSet(name, SKINS[(k + d) % SKINS.length], confetti));
    H.runner[d] = RAVERS.map((r, k) => frameSet((f) => {
      const p = humanoid({ ...RUNNER, ...SKINS[(k + d) % 3], sleeve: SKINS[(k + d) % 3].skin, sleeveD: SKINS[(k + d) % 3].skinD, ...r }, f);
      p.outline(PAL.ink);
      return p;
    }, confetti));
    H.brute[d] = BOUNCER_BY_DISTRICT[d].map((b) => {
      const v = BOUNCERS[b];
      const torsoArt = v.label
        ? (p, x0, y0, w) => {
            micro(p, v.label, x0 + Math.floor((w - (v.label.length * 4 - 1)) / 2), y0 + 4, v.labelCol);
            p.rect(x0 + 2, y0 + 11, w - 4, 1, v.topL);
          }
        : BRUTE.torsoArt;
      return frameSet((f) => {
        const p = humanoid({ ...BRUTE, ...v, torsoArt }, f);
        p.outline(PAL.ink);
        return p;
      }, confetti);
    });
    H.glitch[d] = SCREENS.slice(0, 3 + Math.min(2, d)).map((scr, k) => {
      const rnd = mulberry32(k * 17 + d);
      return frameSet((f) => {
        const p = humanoid({ ...GLITCH, ...OFFICE[k % 3], sleeve: OFFICE[k % 3].top, sleeveD: OFFICE[k % 3].topD, headArt: null }, f);
        p.clear(0, 0, p.w, 16);
        crtHead(p, 13, 9 + (f.walk % 2), f, rnd, scr);
        p.outline(PAL.ink);
        return glitchify(p, f, rnd);
      }, false);
    });
    H.crawler[d] = DISTRICT_OUTFITS[d].slice(0, 3).map((name, k) => {
      const o = { ...SHAMBLER, ...OUT[name], ...SKINS[(k + d + 1) % SKINS.length] };
      if (name === 'tux') Object.assign(o, { top: PAL.tux, topL: PAL.tuxLight, topD: '#0e0c1a' });
      if (!o.sleeve || o.sleeve === SHAMBLER.sleeve) Object.assign(o, { sleeve: o.top, sleeveD: o.topD });
      return frameSet((f) => crawler(o, f), confetti);
    });
    H.bloater[d] = [
      { top: PAL.pink, topL: PAL.pinkLight, topD: '#a81a5a', pants: '#24203a' },
      { top: '#f6c945', topL: '#fff0a0', topD: '#a8701a', pants: PAL.denim },
    ].map((c, k) => frameSet((f) => bloater({ ...SKINS[(k + d) % SKINS.length], ...c }, f), confetti));
  }
  for (const k of ['crawler', 'bloater']) for (const d of H[k]) for (const s of d) s.hmul = 1;
  return H;
}
