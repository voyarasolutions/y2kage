// Every non-gameplay screen: CRT power-on, BIOS POST, the dial-up connection, the chrome title,
// the iMac hero picker, pause and level-clear dialogs, the Blue Screen of Death, and midnight.
import { PAL, FLAVOURS, PARTY } from '../core/palette.js';
import { W, H, TAU } from '../core/util.js';
import { text, textCanvas, textWidth, wrap } from '../core/pixelfont.js';
import { bevel, rect, button, progress, window98, iconInfo, iconError, startFlag, titleBar } from './win98.js';
import { HEROES, heroById } from '../data/heroes.js';
import { gradeOf, GRADE_COL } from '../data/grades.js';
import { heroXp, rankFor, dmgMulFor, xpForRank, MAX_RANK } from '../data/progress.js';
import { clockFor, DISTRICTS, TOTAL_LEVELS, BOSSES } from '../data/levels.js';
import { UPGRADES, upgradeById, stacks, rarityOf, RARITY } from '../data/upgrades.js';
import { ACHIEVEMENTS, EXTRAS, unlocked, extraUnlocked, cheats } from '../data/achievements.js';
import { store } from '../core/util.js';
import { micro } from '../gfx/pix.js';
import { dailyFor, dailyRecord } from '../data/daily.js';
import { shopItems, perkTier, nextCost, tokens, weaponTier } from '../data/shop.js';

// ---------------------------------------------------------------- chrome logo
let chromeCache = null;
export function chromeLogo() {
  if (chromeCache) return chromeCache;
  const mask = textCanvas('Y2KAGE', 'big', '#ffffff', 4);
  const w = mask.width + 6;
  const h = mask.height + 6;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  // Chrome bands: sky reflection on top, dark horizon line, warm ground reflection below.
  const inner = document.createElement('canvas');
  inner.width = w;
  inner.height = h;
  const ig = inner.getContext('2d');
  ig.drawImage(mask, 3, 3);
  const grad = document.createElement('canvas');
  grad.width = w;
  grad.height = h;
  const gg = grad.getContext('2d');
  const top = 3 + 4;
  const bands = [
    [0, '#ffffff'], [0.14, '#dff0ff'], [0.3, '#9cc8f0'], [0.46, '#3a64b8'], [0.52, '#1a1840'],
    [0.56, '#6a3a20'], [0.66, '#e89040'], [0.8, '#ffd890'], [0.92, '#fff4d6'],
  ];
  const gh = 30;
  for (let y = 0; y < h; y++) {
    const f = (y - top) / gh;
    let col = bands[0][1];
    for (const [at, cc] of bands) if (f >= at) col = cc;
    gg.fillStyle = col;
    gg.fillRect(0, y, w, 1);
  }
  ig.globalCompositeOperation = 'source-in';
  ig.drawImage(grad, 0, 0);
  // Outline: navy then a white rim, all on the pixel grid.
  const ol = textCanvas('Y2KAGE', 'big', PAL.winNavy, 4);
  for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [-2, 1], [2, 1], [-1, 2], [1, 2], [2, 2], [0, 3], [2, 3], [3, 3]]) g.drawImage(ol, 3 + ox, 3 + oy);
  g.drawImage(inner, 0, 0);
  chromeCache = c;
  return c;
}

function sparkle(g, x, y, s, col = PAL.white) {
  rect(g, x - s, y, s * 2 + 1, 1, col);
  rect(g, x, y - s, 1, s * 2 + 1, col);
  rect(g, x - 1, y - 1, 3, 3, col);
}

// ---------------------------------------------------------------- power + BIOS + dial-up
export function drawPower(g, t) {
  rect(g, 0, 0, W, H, PAL.black);
  const on = Math.floor(t * 2) % 2;
  text(g, 'PRESS ANY KEY', W / 2, H / 2 - 10, { font: 'big', color: on ? PAL.cream : PAL.winShadow, align: 'center' });
  text(g, 'or tap to power on', W / 2, H / 2 + 4, { font: 'small', color: PAL.winShadow, align: 'center' });
  // The power LED.
  rect(g, W / 2 - 2, H / 2 + 24, 5, 3, on ? PAL.lime : '#1a3a1a');
}

export function drawCrtOn(g, t) {
  rect(g, 0, 0, W, H, PAL.black);
  const f = Math.min(1, t / 0.45);
  if (f < 0.5) {
    const w = Math.round(W * (f * 2));
    rect(g, W / 2 - w / 2, H / 2, w, 1, PAL.white);
  } else {
    const h = Math.round(H * ((f - 0.5) * 2));
    rect(g, 0, H / 2 - h / 2, W, h, '#d8e0ff');
  }
}

const BIOS_LINES = [
  [0.0, 'MILLENNIUM BIOS v1.999, An Energy Friendly BIOS', PAL.winFace],
  [0.0, 'Copyright (C) 1984-1999, Y2Kage Systems Inc.', PAL.winFace],
  [0.35, 'Y2KAGE-PC  11:09 PM  12/31/1999', PAL.winFace],
  [0.7, 'Main Processor : MMX 450MHz', PAL.winFace],
  [0.95, 'Memory Testing : ', PAL.winFace, 'mem'],
  [1.8, 'Primary Master   : 8.4GB HDD', PAL.winFace],
  [2.0, 'Secondary Master : 3.5" FLOPPY 1.44MB', PAL.winFace],
  [2.2, 'Sound Blaster, Modem 56K ....... OK', PAL.winFace],
  [2.55, 'Checking system date ..... 12/31/1999', PAL.winFace],
  [2.9, 'Y2K compliance ............ ', PAL.winFace, 'y2k'],
];

export function drawBios(g, t) {
  rect(g, 0, 0, W, H, PAL.black);
  // Badge in the corner where the Energy Star logo used to live.
  const bx = W - 70;
  rect(g, bx, 8, 62, 30, '#0a2a1a');
  rect(g, bx + 1, 9, 60, 28, '#14502a');
  text(g, 'Y2K', bx + 31, 12, { font: 'big', color: PAL.lime, align: 'center' });
  text(g, 'READY?', bx + 31, 24, { font: 'small', color: PAL.limeLight, align: 'center' });
  sparkle(g, bx + 8, 16, 2, PAL.gold);
  let y = 8;
  for (const [at, line, col, special] of BIOS_LINES) {
    if (t < at) break;
    let s = line;
    let extra = null;
    if (special === 'mem') {
      const k = Math.min(65536, Math.floor(((t - at) / 0.7) * 65536));
      s += `${k}K${k >= 65536 ? ' OK' : ''}`;
    }
    if (special === 'y2k') extra = Math.floor(t * 4) % 2 ? 'UNKNOWN' : '';
    text(g, s, 8, y, { font: 'small', color: col });
    if (extra) text(g, extra, 8 + textWidth(s, 'small') + 2, y, { font: 'small', color: PAL.red });
    y += at === 0 && line.startsWith('MILLENNIUM') ? 9 : 11;
  }
  if (t > 3.2) text(g, 'Press DEL to enter SETUP', 8, H - 26, { font: 'small', color: PAL.winFace });
  text(g, '12/31/99-Y2KAGE-2A69K', 8, H - 14, { font: 'small', color: PAL.winShadow });
  // Blinking cursor.
  if (Math.floor(t * 3) % 2) rect(g, 8, y + 1, 6, 7, PAL.winFace);
}

const DIAL_STEPS = [[0, 'Dialing...'], [1.8, 'Verifying password...'], [3.3, 'Logging on to network...'], [4.6, 'Connected at 56,000 bps']];

// Win98 desktop icons, 24x22 each, drawn at (x, y).
const DESK_ICONS = {
  computer(g, x, y) {
    // Beige monitor on a desktop case.
    rect(g, x + 3, y, 18, 14, PAL.ink);
    rect(g, x + 4, y + 1, 16, 12, PAL.winFace);
    rect(g, x + 6, y + 3, 12, 8, PAL.winTeal);
    rect(g, x + 6, y + 3, 12, 1, '#40a0a0');
    rect(g, x + 7, y + 5, 3, 1, PAL.white);
    rect(g, x + 9, y + 14, 6, 2, PAL.winShadow);
    rect(g, x + 1, y + 16, 22, 6, PAL.ink);
    rect(g, x + 2, y + 17, 20, 4, PAL.winFace);
    rect(g, x + 4, y + 18, 8, 1, PAL.winShadow);
    rect(g, x + 18, y + 18, 2, 2, PAL.lime);
  },
  patch(g, x, y) {
    // A floppy with a gold "FIX" label.
    rect(g, x + 3, y, 18, 20, PAL.ink);
    rect(g, x + 4, y + 1, 16, 18, '#2a3a6a');
    rect(g, x + 8, y + 1, 8, 6, PAL.steel);
    rect(g, x + 13, y + 2, 2, 4, '#2a3a6a');
    rect(g, x + 6, y + 9, 12, 9, PAL.gold);
    rect(g, x + 6, y + 9, 12, 2, PAL.strawberry);
    micro({ rect: (a, b, w, h, c) => rect(g, a, b, w, h, c) }, 'FIX', x + 7, y + 12, PAL.ink);
  },
  bin(g, x, y) {
    // Wire recycle bin, a crumpled page poking out.
    rect(g, x + 5, y + 2, 14, 2, PAL.ink);
    rect(g, x + 6, y + 4, 12, 16, PAL.ink);
    rect(g, x + 7, y + 4, 10, 15, '#c8ccd4');
    for (let k = 0; k < 4; k++) rect(g, x + 8 + k * 3, y + 5, 1, 13, PAL.winShadow);
    rect(g, x + 7, y + 10, 10, 1, PAL.winShadow);
    rect(g, x + 9, y, 6, 4, PAL.white);
    rect(g, x + 10, y + 1, 3, 1, PAL.winShadow);
  },
  dialup(g, x, y) {
    // A phone handset over a modem with blinking lights.
    rect(g, x + 1, y + 12, 22, 9, PAL.ink);
    rect(g, x + 2, y + 13, 20, 7, PAL.winFace);
    for (let k = 0; k < 4; k++) rect(g, x + 4 + k * 4, y + 17, 2, 1, k % 2 ? PAL.lime : PAL.red);
    rect(g, x + 3, y + 3, 18, 5, PAL.ink);
    rect(g, x + 4, y + 4, 16, 3, PAL.bondi);
    rect(g, x + 2, y + 5, 5, 7, PAL.ink);
    rect(g, x + 17, y + 5, 5, 7, PAL.ink);
    rect(g, x + 3, y + 6, 3, 5, PAL.bondi);
    rect(g, x + 18, y + 6, 3, 5, PAL.bondi);
    rect(g, x + 6, y + 4, 4, 1, '#8fe8ff');
  },
};

export function drawDesktop(g) {
  rect(g, 0, 0, W, H, PAL.winTeal);
  // Desktop icons down the left, like everyone's did.
  const icons = [['My Computer', 'computer'], ['Y2K Patch', 'patch'], ['Recycle Bin', 'bin'], ['Dial-Up', 'dialup']];
  icons.forEach(([name, kind], i) => {
    const y = 6 + i * 34;
    DESK_ICONS[kind](g, 26, y);
    text(g, name, 38, y + 24, { font: 'small', color: PAL.white, outline: '#004040', align: 'center' });
  });
}

export function drawDialup(g, t) {
  drawDesktop(g);
  const w = 230;
  const h = 96;
  const x = W / 2 - w / 2;
  const y = 50;
  const inner = window98(g, x, y, w, h, 'Connecting to Y2KAGE.NET');
  DESK_ICONS.computer(g, inner.x + 14, inner.y + 4);
  DESK_ICONS.computer(g, inner.x + inner.w - 38, inner.y + 4);
  // Data dots travelling between the two computers.
  const n = 7;
  const step = Math.floor(t * 8) % n;
  for (let i = 0; i < n; i++) rect(g, inner.x + 46 + i * 18, inner.y + 15, 4, 4, i === step ? PAL.gold : PAL.winShadow);
  let status = DIAL_STEPS[0][1];
  for (const [at, s] of DIAL_STEPS) if (t >= at) status = s;
  text(g, 'Status:', inner.x + 8, inner.y + 34, { font: 'small', color: PAL.ink });
  text(g, status, inner.x + 48, inner.y + 34, { font: 'small', color: PAL.ink });
  progress(g, inner.x + 8, inner.y + 46, inner.w - 60, 11, Math.min(1, t / 4.8));
  button(g, inner.x + inner.w - 48, inner.y + 45, 44, 13, 'Cancel');
  drawTaskbarShell(g, t);
}

function drawTaskbarShell(g, t, label = 'Start') {
  const y = H - 16;
  rect(g, 0, y, W, 16, PAL.winFace);
  rect(g, 0, y + 1, W, 1, PAL.white);
  bevel(g, 2, y + 3, 40, 12);
  startFlag(g, 5, y + 5);
  text(g, label, 14, y + 6, { font: 'small', color: PAL.ink });
  bevel(g, W - 56, y + 3, 54, 12, true);
  text(g, '11:09 PM', W - 6, y + 6, { font: 'small', color: PAL.ink, align: 'right' });
}

// ---------------------------------------------------------------- title
const TICKER = [
  'BREAKING: ZOMBIES REPORTED IN TIMES SQUARE',
  'BANKS: "YOUR MONEY IS SAFE" (PLEASE STAY INSIDE)',
  'VCRs NATIONWIDE FLASHING 12:00',
  'MAYOR: POWER GRID IS "TOTALLY Y2K COMPLIANT"',
  'FLOPPY DISK SALES UP 900%',
  'THE BALL WILL DROP AT MIDNIGHT NO MATTER WHAT',
].join('   +++   ');

export function drawTitle(g, ui, t) {
  const logo = chromeLogo();
  const lx = Math.round(W / 2 - logo.width / 2);
  const ly = 14 + Math.round(Math.sin(t * 1.6) * 2);
  g.drawImage(logo, lx, ly);
  const sp = (t * 0.7) % 1;
  if (sp < 0.3) sparkle(g, lx + 10 + Math.round(sp * 3 * (logo.width - 20)), ly + 8, 2);
  sparkle(g, lx + logo.width - 6, ly + 4, Math.floor(t * 3) % 2 + 1, PAL.cream);
  text(g, "NEW YEAR'S EVE 1999", W / 2, ly + logo.height + 4, { font: 'big', color: PAL.pink, outline: PAL.ink, align: 'center' });
  text(g, 'survive the horde until midnight', W / 2, ly + logo.height + 15, { font: 'small', color: PAL.cyan, outline: PAL.ink, align: 'center' });

  const w = 128;
  const x = W / 2 - w / 2;
  const y = 100;
  const inner = window98(g, x, y - 8, w, 106, 'Y2KAGE.EXE');
  const got = Object.keys(unlocked()).length;
  const items = [
    ['Start Game', () => ui.game.toSelect()],
    ['Daily Challenge', () => ui.game.startDaily()],
    ['Online Co-op', () => ui.game.setMode('mp')],
    [`Shop: ${tokens()} tokens`, () => ui.game.setMode('shop')],
    [`Trophies ${got}/${ACHIEVEMENTS.length}`, () => ui.game.setMode('trophies')],
    ['How to Play', () => ui.game.setMode('howto')],
    ['Options', () => ui.game.openOptions()],
  ];
  items.forEach(([label, on], i) => {
    const b = { x: inner.x + 6, y: inner.y + 1 + i * 12, w: inner.w - 12, h: 11 };
    button(g, b.x, b.y, b.w, b.h, label, { focus: ui.focus === i });
    ui.addButton(b, on, i);
  });
  if (ui.game.input.pad.on) text(g, 'GAMEPAD READY', W - 4, 4, { font: 'small', color: PAL.lime, outline: PAL.ink, align: 'right' });
  const best = ui.game.best;
  if (best > 1) {
    text(g, 'FURTHEST', x - 10, y + 60, { font: 'small', color: PAL.gold, outline: PAL.ink, align: 'right' });
    text(g, `LEVEL ${best}`, x - 10, y + 70, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'right' });
    text(g, clockFor(best).label, x - 10, y + 80, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'right' });
  }
  drawDailyCard(g, x + w + 8, y - 6, t, ui.focus === 1);

  // News ticker along the bottom.
  const ty = H - 12;
  rect(g, 0, ty, W, 12, PAL.strawberryDark);
  rect(g, 0, ty, W, 1, PAL.pink);
  rect(g, 0, ty, 34, 12, PAL.red);
  text(g, 'LIVE', 5, ty + 3, { font: 'small', color: PAL.white });
  const tw = textWidth(TICKER + '   +++   ', 'small');
  const off = Math.floor((t * 40) % tw);
  g.save();
  g.beginPath();
  g.rect(36, ty, W - 36, 12);
  g.clip();
  text(g, TICKER + '   +++   ' + TICKER, 36 - off + W, ty + 3, { font: 'small', color: PAL.cream });
  text(g, TICKER, 36 - off + W - tw, ty + 3, { font: 'small', color: PAL.cream });
  g.restore();
}

// Today's Daily Bug Report beside the title menu: who, where, the twist, your best and streak.
function drawDailyCard(g, x, y, t, focus) {
  const D = dailyFor();
  const R = dailyRecord();
  const w = W - x - 6;
  const inner = window98(g, x, y, w, 70, 'DAILY.BUG', { active: focus || Math.floor(t * 2) % 2 === 0 });
  const hero = D.hero.name;
  const lines = [
    [`${hero} IN`, PAL.ink],
    [DISTRICTS[D.district].name.toUpperCase(), PAL.winNavy],
    [D.twist.name.toUpperCase(), PAL.strawberryDark],
    [R.today.best ? `BEST TODAY: WAVE ${R.today.best}` : 'NOT PLAYED TODAY', R.today.best ? PAL.goldDark : PAL.winShadow],
    [R.streak ? `STREAK: ${R.streak} DAY${R.streak > 1 ? 'S' : ''}` : 'START A STREAK', PAL.ink],
  ];
  lines.forEach(([l, c], i) => text(g, l, inner.x + 3, inner.y + 2 + i * 10, { font: 'small', color: c }));
}

// ---------------------------------------------------------------- how to play (Notepad)
const HOWTO = [
  'It is 11:10 PM, Dec 31 1999. The Y2K bug hit early and the',
  'party turned. Hold out through 50 levels, one per minute,',
  'until the ball drops at midnight.',
  '',
  'MOVE   W A S D  (arrows turn)     AIM   mouse',
  'FIRE   click, hold for auto       RIDE  SPACE / SHIFT',
  'SPECIAL R / right-click when full  PAUSE ESC   MUTE M',
  'MELEE  V / middle-click           RELOAD X (Dot, Gus)',
  'Phone: left thumb moves, right thumb aims, tap FIRE.',
  'ONLINE CO-OP: host a room, up to 3 friends join by code.',
  'Each hero has a ride and a weapon of their own.',
  'Headshots do double damage. Water fries Corrupted zombies.',
  'Kills earn XP. Every LEVEL UP makes that hero hit harder.',
  'Powerups: FIX disk invincible, x3 triple shot,',
  'toaster slow-mo, C-A-D ends every zombie in sight,',
  'ZIP disk bottomless ammo. Grab bats, keyboards, bubbly.',
  'Clear a level to pick an UPGRADE. They stack all run.',
  'Every 10th level has a boss. Jump their shockwaves.',
  'Trophies unlock Endless mode and cheats. Gamepads work.',
];

export function drawHowto(g, ui, t) {
  const w = 340;
  const h = 210;
  const x = W / 2 - w / 2;
  const y = 3;
  const inner = window98(g, x, y, w, h, 'README.TXT - Notepad');
  // Menu bar.
  ['File', 'Edit', 'Search', 'Help'].forEach((m, i) => text(g, m, inner.x + 2 + [0, 30, 60, 100][i], inner.y, { font: 'small', color: PAL.ink }));
  bevel(g, inner.x, inner.y + 10, inner.w, inner.h - 28, true, PAL.white);
  HOWTO.forEach((l, i) => text(g, l, inner.x + 4, inner.y + 13 + i * 8, { font: 'small', color: PAL.ink }));
  const b = { x: inner.x + inner.w - 60, y: inner.y + inner.h - 15, w: 58, h: 14 };
  button(g, b.x, b.y, b.w, b.h, 'OK', { focus: true });
  ui.addButton(b, () => ui.game.setMode('title'), 0);
}

// ---------------------------------------------------------------- hero select (iMac cards)
function statPips(g, x, y, n, col) {
  for (let i = 0; i < 5; i++) {
    rect(g, x + i * 5, y, 4, 4, i < n ? col : '#00000033');
  }
}

export function drawSelect(g, ui, t, S) {
  const game = ui.game;
  rect(g, 0, 0, W, H, '#00000055');
  text(g, 'CHOOSE YOUR PLAYER', W / 2, 6, { font: 'big', color: PAL.cream, outline: PAL.ink, align: 'center' });
  const cw = 68;
  const gap = 5;
  const total = HEROES.length * cw + (HEROES.length - 1) * gap;
  const x0 = Math.round(W / 2 - total / 2);
  HEROES.forEach((hero, i) => {
    const fl = FLAVOURS[i];
    const sel = hero.id === game.heroId;
    const x = x0 + i * (cw + gap);
    const y = 19 + (sel ? 0 : 4);
    const h = 94;
    // Translucent iMac shell: coloured frame, lighter stripes, a screen with the hero standing on their ride.
    rect(g, x + 2, y + 2, cw, h, '#00000066');
    rect(g, x, y, cw, h, fl.dark);
    rect(g, x + 1, y + 1, cw - 2, h - 2, fl.base);
    for (let k = 3; k < h - 2; k += 4) rect(g, x + 1, y + k, cw - 2, 1, fl.light + '66');
    rect(g, x + 1, y + 1, cw - 2, 2, fl.light);
    rect(g, x + 4, y + 4, cw - 8, 72, '#ececec');
    rect(g, x + 6, y + 6, cw - 12, 68, sel ? '#203050' : '#101828');
    // Screen: a little night skyline behind them, scanlines over the top.
    rect(g, x + 6, y + 56, cw - 12, 18, sel ? '#2a2048' : '#181830');
    for (let k = 0; k < 6; k++) rect(g, x + 8 + k * 9, y + 46 + ((k * 7) % 11), 7, 28 - ((k * 7) % 11), sel ? '#141030' : '#0c0c1c');
    rect(g, x + 6, y + 68, cw - 12, 6, sel ? fl.dark : '#10101a');
    const body = S.heroBodies[i][sel ? Math.floor(Math.abs(t) * 2.5) & 1 : 0];
    g.drawImage(body.c, Math.round(x + cw / 2 - body.w / 2), y + 74 - body.h + 2);
    for (let k = y + 6; k < y + 74; k += 2) rect(g, x + 6, k, cw - 12, 1, '#00000030');
    text(g, hero.name, x + cw / 2, y + 79, { font: 'big', color: PAL.white, outline: fl.dark, align: 'center' });
    text(g, String(i + 1), x + cw - 8, y + 7, { font: 'small', color: fl.light, align: 'center' });
    text(g, `LV${rankFor(heroXp(hero.id))}`, x + 8, y + 7, { font: 'small', color: PAL.gold, outline: PAL.ink });
    // CPU teammates play the next heroes along from yours.
    const pick = HEROES.findIndex((h) => h.id === game.heroId);
    const k = (i - pick + HEROES.length) % HEROES.length;
    if (k > 0 && k <= game.cpu) {
      rect(g, x + cw / 2 - 12, y + 16, 24, 9, PAL.ink);
      text(g, 'CPU', x + cw / 2, y + 18, { font: 'small', color: PAL.gold, align: 'center' });
    }
    if (sel) {
      rect(g, x - 2, y - 2, cw + 4, 1, PAL.white);
      rect(g, x - 2, y + h + 1, cw + 4, 1, PAL.white);
      rect(g, x - 2, y - 2, 1, h + 4, PAL.white);
      rect(g, x + cw + 1, y - 2, 1, h + 4, PAL.white);
      if (Math.floor(t * 3) % 2) text(g, 'v', x + cw / 2, y + h + 3, { font: 'big', color: PAL.gold, align: 'center' });
    }
    ui.addButton({ x, y, w: cw, h }, () => {
      if (game.heroId === hero.id) game.startRun();
      else game.pickHero(hero.id);
    }, 10 + i);
  });

  // Detail window for the selected hero.
  const hero = HEROES.find((h) => h.id === game.heroId);
  const i = HEROES.indexOf(hero);
  const dw = 240;
  const dx = 8;
  const dy = 120;
  const rank = rankFor(heroXp(hero.id));
  const inner = window98(g, dx, dy, dw, 84, `${hero.name} "${hero.nick}"  LV ${rank}${rank > 1 ? ` +${Math.round((dmgMulFor(rank) - 1) * 100)}% DMG` : ''}`);
  bevel(g, inner.x + 1, inner.y + 1, 36, 36, true, FLAVOURS[i].dark);
  g.drawImage(S.portraits[i].c, inner.x + 3, inner.y + 3);
  g.drawImage(S.icons[hero.move.type].c, inner.x + 40, inner.y + 1);
  text(g, hero.ride.toUpperCase(), inner.x + 58, inner.y + 5, { font: 'small', color: PAL.winNavy });
  g.drawImage(S.icons[hero.gun.kind].c, inner.x + 40, inner.y + 18);
  const upg = weaponTier(hero.id) && hero.gun2;
  text(g, (upg ? `${hero.gun2.name} *` : hero.weapon).toUpperCase(), inner.x + 58, inner.y + 22, { font: 'small', color: upg ? PAL.grape : PAL.strawberryDark });
  const stats = [['SPD', hero.stats.speed], ['PWR', hero.stats.power], ['RNG', hero.stats.range]];
  stats.forEach(([k, v], j) => {
    text(g, k, inner.x + inner.w - 58, inner.y + 2 + j * 9, { font: 'small', color: PAL.ink });
    statPips(g, inner.x + inner.w - 34, inner.y + 3 + j * 9, v, FLAVOURS[i].dark);
  });
  text(g, hero.controls.toUpperCase(), inner.x + inner.w - 3, inner.y + 30, { font: 'small', color: PAL.winShadow, align: 'right' });
  wrap(hero.blurb, inner.w - 6).slice(0, 3).forEach((l, k) => text(g, l, inner.x + 2, inner.y + 40 + k * 8, { font: 'small', color: PAL.ink }));

  // Level picker and go button.
  const px = 254;
  const canEndless = extraUnlocked('endless');
  const endless = canEndless && game.endlessOn;
  const pin = window98(g, px, dy, W - px - 6, 84, endless ? 'Endless Mode' : 'Start Level');
  const bl = { x: pin.x + 2, y: pin.y + 2, w: 14, h: 14 };
  const br = { x: pin.x + pin.w - 16, y: pin.y + 2, w: 14, h: 14 };
  if (endless) {
    const di = game.pickDistrict;
    button(g, bl.x, bl.y, bl.w, bl.h, '<', { disabled: di <= 0 });
    button(g, br.x, br.y, br.w, br.h, '>', { disabled: di >= game.endlessMax() });
    bevel(g, pin.x + 18, pin.y + 2, pin.w - 36, 14, true, PAL.white);
    text(g, 'ENDLESS', pin.x + pin.w / 2, pin.y + 6, { font: 'big', color: PAL.strawberryDark, align: 'center' });
    text(g, DISTRICTS[di].name.toUpperCase(), pin.x + pin.w / 2, pin.y + 20, { font: 'small', color: PAL.winNavy, align: 'center' });
    const bestW = (store.get('endless', {}) || {})[di] || 0;
    text(g, bestW ? `Best: wave ${bestW}` : 'No best yet', pin.x + pin.w / 2, pin.y + 29, { font: 'small', color: PAL.ink, align: 'center' });
  } else {
    const n = game.pickLevel;
    const c = clockFor(n);
    const d = DISTRICTS[Math.min(DISTRICTS.length - 1, Math.floor((n - 1) / 10))];
    button(g, bl.x, bl.y, bl.w, bl.h, '<', { disabled: n <= 1 });
    button(g, br.x, br.y, br.w, br.h, '>', { disabled: n >= game.best });
    bevel(g, pin.x + 18, pin.y + 2, pin.w - 36, 14, true, PAL.white);
    text(g, `LVL ${n}`, pin.x + pin.w / 2, pin.y + 6, { font: 'big', color: PAL.ink, align: 'center' });
    const gl = gradeOf(n);
    if (gl) text(g, gl, pin.x + pin.w - 30, pin.y + 5, { font: 'big', color: GRADE_COL[gl], outline: PAL.ink });
    text(g, c.label, pin.x + pin.w / 2, pin.y + 20, { font: 'small', color: PAL.winNavy, align: 'center' });
    text(g, n % 10 === 0 ? 'BOSS LEVEL' : d.name.toUpperCase(), pin.x + pin.w / 2, pin.y + 29, { font: 'small', color: n % 10 === 0 ? PAL.red : PAL.strawberryDark, align: 'center' });
  }
  ui.addButton(bl, () => game.stepLevel(-1), 20);
  ui.addButton(br, () => game.stepLevel(1), 21);
  // CPU teammates (C) and, once unlocked, the Endless toggle (TAB) share a row.
  const half = canEndless ? Math.floor((pin.w - 10) / 2) : pin.w - 8;
  const cb = { x: pin.x + 4, y: pin.y + 37, w: half, h: 11 };
  button(g, cb.x, cb.y, cb.w, cb.h, game.cpu ? `CPU x${game.cpu}` : 'No CPU', {});
  ui.addButton(cb, () => game.cycleCpu(), 32);
  if (canEndless) {
    const eb = { x: pin.x + 6 + half, y: pin.y + 37, w: half, h: 11 };
    button(g, eb.x, eb.y, eb.w, eb.h, endless ? 'Campaign' : 'Endless', {});
    ui.addButton(eb, () => game.toggleEndless(), 31);
  }
  const go = { x: pin.x + 4, y: pin.y + pin.h - 17, w: pin.w - 8, h: 15 };
  const run = !endless && game.savedRun();
  button(g, go.x, go.y, go.w, go.h, run ? `CONTINUE +${run.ups.length}` : 'PLAY', { font: 'big', focus: true });
  ui.addButton(go, () => game.startRun(), 30);
  text(g, `ARROWS pick  C cpu${canEndless ? '  TAB endless' : ''}  ENTER play  ESC back`, W / 2, H - 11, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
}

// ---------------------------------------------------------------- pause, clear
export function drawPause(g, ui, t) {
  rect(g, 0, 0, W, H, '#00000077');
  const w = 180;
  const x = W / 2 - w / 2;
  const inner = window98(g, x, 44, w, 115, 'Y2KAGE.EXE is paused');
  iconInfo(g, inner.x + 4, inner.y + 4);
  text(g, 'Take a breather.', inner.x + 22, inner.y + 4, { font: 'small', color: PAL.ink });
  text(g, 'The zombies will wait.', inner.x + 22, inner.y + 13, { font: 'small', color: PAL.ink });
  const items = [['Resume', () => ui.game.resume()], ['Options', () => ui.game.openOptions()], [`Sound: ${ui.game.muted() ? 'Off' : 'On'}`, () => ui.game.toggleMute()], ['Quit to Menu', () => ui.game.toSelect()]];
  items.forEach(([label, on], i) => {
    const b = { x: inner.x + 22, y: inner.y + 26 + i * 17, w: inner.w - 44, h: 14 };
    button(g, b.x, b.y, b.w, b.h, label, { focus: ui.focus === i });
    ui.addButton(b, on, i);
  });
  drawUpgradeList(g, ui.game.runUps, W / 2, 164);
}

// A line of upgrade tags (name x stacks) centred at cx, wrapping onto more lines.
function drawUpgradeList(g, list, cx, y) {
  const st = stacks(list);
  const ids = Object.keys(st);
  if (!ids.length) return;
  const tags = ids.map((id) => `${upgradeById(id).name}${st[id] > 1 ? ' x' + st[id] : ''}`);
  const lines = wrap(tags.join('  +  '), W - 30);
  text(g, 'UPGRADES THIS RUN', cx, y, { font: 'small', color: PAL.gold, outline: PAL.ink, align: 'center' });
  lines.slice(0, 4).forEach((l, i) => text(g, l, cx, y + 9 + i * 9, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' }));
}

export function drawClear(g, ui, t, stats) {
  const game = ui.game;
  const offerIds = game.upOffer || [];
  const w = 312;
  const h = offerIds.length ? 200 : 134;
  const x = Math.round(W / 2 - w / 2);
  const inner = window98(g, x, offerIds.length ? 2 : 30, w, h, `Level ${stats.level} complete`);
  // The grade stamp takes the info icon's place, popping in a beat after the window.
  if (!stats.grade) iconInfo(g, inner.x + 4, inner.y + 2);
  else if (t - (game.upRevealT || 0) > 0.35) {
    rect(g, inner.x + 3, inner.y + 1, 15, 13, PAL.ink);
    rect(g, inner.x + 4, inner.y + 2, 13, 11, PAL.white);
    text(g, stats.grade, inner.x + 11, inner.y + 4, { font: 'big', color: GRADE_COL[stats.grade], outline: PAL.ink, align: 'center' });
  }
  text(g, `${clockFor(stats.level).label} SURVIVED`, inner.x + 22, inner.y + 2, { font: 'big', color: PAL.winNavy });
  if (stats.tokens) text(g, `${stats.gradePay ? 'NEW BEST! ' : ''}+${stats.tokens} TOKENS`, inner.x + inner.w - 4, inner.y + 3, { font: 'small', color: PAL.goldDark, align: 'right' });
  const tm = `${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, '0')}`;
  const rows = [['Zombies deleted', stats.kills], ['Time', tm], ['Best combo', `${stats.combo || 0} hits`], ['Headshots', stats.headshots || 0], ['Level score', stats.levelScore], ['Total score', stats.score]];
  const colW = Math.floor((inner.w - 26) / 2);
  rows.forEach(([k, v], i) => {
    const cx = inner.x + 22 + (i % 2) * (colW + 4);
    const cy = inner.y + 15 + Math.floor(i / 2) * 9;
    text(g, k, cx, cy, { font: 'small', color: PAL.ink });
    text(g, String(v), cx + colW - 4, cy, { font: 'small', color: PAL.winNavy, align: 'right' });
  });
  const next = Math.min(TOTAL_LEVELS, stats.level + 1);
  const nd = Math.min(4, Math.floor((next - 1) / 10));
  const nextLine = `Next: ${clockFor(next).label}, ${DISTRICTS[nd].name}${next % 10 === 0 ? `. BOSS: ${BOSSES[nd].name}` : ''}`;
  let y = inner.y + 44;
  text(g, nextLine, inner.x + 22, y, { font: 'small', color: PAL.strawberryDark });
  if (game.sim) drawRankBar(g, game.sim.player.xp, inner.x + inner.w - 84, y - 1, 80, PAL.ink);
  y += 11;
  if (offerIds.length) {
    drawCards(g, ui, inner, y);
    y += 87;
  }
  if (game.isGuest()) {
    text(g, 'Waiting for the host...', inner.x + 22, y + 4, { font: 'small', color: PAL.winNavy });
    const b = { x: inner.x + inner.w - 62, y, w: 56, h: 16 };
    button(g, b.x, b.y, b.w, b.h, 'Leave', { focus: !!game.upPicked || !offerIds.length });
    ui.addButton(b, () => game.leaveOnline(), 5);
    return;
  }
  const locked = offerIds.length && !game.upPicked;
  const items = [['Next Level', () => !locked && game.nextLevel()], [game.net.active ? 'Lobby' : 'Menu', () => game.toSelect()]];
  items.forEach(([label, on], i) => {
    const b = { x: inner.x + inner.w / 2 - 84 + i * 88, y, w: 80, h: 16 };
    button(g, b.x, b.y, b.w, b.h, label, { focus: !locked && ui.focus === i, disabled: i === 0 && locked });
    ui.addButton(b, on, i);
  });
}

// A tiny pictogram for each upgrade, drawn in the card's title strip.
function upgradeGlyph(g, u, x, y, dim) {
  const c = dim ? PAL.winFace : PAL.ink;
  const l = dim ? PAL.winFace : PAL.white;
  const id = u.id;
  if (id === 'dmg') {
    rect(g, x + 1, y + 1, 7, 7, c);
    rect(g, x + 3, y + 3, 3, 3, l);
    for (let k = 0; k < 3; k++) rect(g, x + 2 + k * 2, y, 1, 9, c);
  } else if (id === 'rate') {
    rect(g, x, y, 9, 9, c);
    text(g, 'T', x + 2, y + 1, { font: 'small', color: l });
  } else if (id === 'speed') {
    rect(g, x, y + 3, 9, 3, c);
    rect(g, x + 1, y + 7, 2, 2, c);
    rect(g, x + 6, y + 7, 2, 2, c);
  } else if (id === 'hp' || id === 'leech') {
    rect(g, x + 1, y + 1, 3, 3, c);
    rect(g, x + 5, y + 1, 3, 3, c);
    rect(g, x, y + 2, 9, 3, c);
    rect(g, x + 1, y + 5, 7, 1, c);
    rect(g, x + 2, y + 6, 5, 1, c);
    rect(g, x + 3, y + 7, 3, 1, c);
  } else if (id === 'armor') {
    rect(g, x + 1, y, 7, 5, c);
    rect(g, x + 2, y + 5, 5, 2, c);
    rect(g, x + 3, y + 7, 3, 2, c);
  } else if (id === 'head') {
    rect(g, x + 1, y, 7, 6, c);
    rect(g, x + 2, y + 2, 2, 2, l);
    rect(g, x + 5, y + 2, 2, 2, l);
    rect(g, x + 2, y + 6, 5, 2, c);
  } else if (id === 'chain') {
    // A lightning bolt.
    rect(g, x + 4, y, 4, 2, c);
    rect(g, x + 3, y + 2, 3, 2, c);
    rect(g, x + 2, y + 4, 6, 1, c);
    rect(g, x + 4, y + 5, 3, 2, c);
    rect(g, x + 3, y + 7, 2, 2, c);
  } else if (id === 'boom') {
    rect(g, x + 1, y + 3, 6, 6, c);
    rect(g, x + 3, y + 2, 2, 1, c);
    rect(g, x + 5, y, 1, 2, c);
    rect(g, x + 6, y, 2, 1, PAL.gold);
    rect(g, x + 2, y + 4, 1, 2, l);
  } else if (id === 'backup') {
    rect(g, x, y, 9, 9, c);
    rect(g, x + 2, y, 5, 3, l);
    rect(g, x + 2, y + 5, 5, 4, l);
  } else if (id === 'virus') {
    rect(g, x + 1, y + 1, 3, 3, c);
    rect(g, x + 5, y + 1, 3, 3, c);
    rect(g, x, y + 2, 9, 3, c);
    rect(g, x + 1, y + 5, 7, 1, c);
    rect(g, x + 2, y + 6, 5, 1, c);
    rect(g, x + 3, y + 7, 3, 1, c);
    rect(g, x + 4, y + 2, 1, 4, l);
  } else if (id === 'firewall') {
    for (let k = 0; k < 3; k++) rect(g, x, y + k * 3, 9, 2, c);
    rect(g, x + 4, y + 2, 1, 1, c);
    rect(g, x + 2, y + 5, 1, 1, c);
    rect(g, x + 6, y + 5, 1, 1, c);
  } else {
    const glyph = { regen: 'D', magnet: '~', luck: 'F', sp: '!', combo: 'C', buff: '+', crit: '*', slick: 'W', sleeper: 'O', split: '/', cluster: '#', ricochet: 'Z' }[id] || '?';
    rect(g, x, y, 9, 9, c);
    text(g, glyph, x + 2, y + 1, { font: 'small', color: l });
  }
}

// Three upgrade cards with the pick-one header and reroll button, under a divider at y.
function drawCards(g, ui, inner, y) {
  const game = ui.game;
  const offerIds = game.upOffer || [];
  const picked = game.upPicked;
  rect(g, inner.x, y, inner.w, 1, PAL.winShadow);
  rect(g, inner.x, y + 1, inner.w, 1, PAL.white);
  text(g, picked ? 'Upgrade installed. It lasts the rest of the run.' : 'INSTALL AN UPGRADE (pick one)', inner.x + inner.w / 2, y + 5, { font: 'small', color: picked ? PAL.winNavy : PAL.strawberryDark, align: 'center' });
  if (!picked && game.rerolls > 0) {
    const rb = { x: inner.x + inner.w - 50, y: y + 3, w: 46, h: 11 };
    button(g, rb.x, rb.y, rb.w, rb.h, 'Reroll R', {});
    ui.addButton(rb, () => game.rerollUpgrades(), 45);
  }
  const st = stacks(game.runUps);
  const cw = Math.floor((inner.w - 16) / 3);
  offerIds.forEach((id, i) => {
    const u = upgradeById(id);
    const cx = inner.x + 4 + i * (cw + 4);
    const cy = y + 15;
    const ch = 68;
    const mine = picked === id;
    const dim = picked && !mine;
    const focus = !picked && (game.upFocus || 0) === i;
    const rar = rarityOf(u);
    // Cards flip up one after another; rarer ones glint.
    const age = ui.t - (game.upRevealT ?? -9) - i * 0.12;
    if (age < 0) return;
    bevel(g, cx, cy, cw, ch, mine, dim ? '#a8a8a8' : PAL.winFace);
    if (rar !== 'common' && !dim) {
      const rc = RARITY[rar].color;
      const glow = rar === 'legendary' && Math.floor(ui.t * 6) % 2 ? PAL.white : rc;
      rect(g, cx, cy, cw, 2, glow);
      rect(g, cx, cy + ch - 2, cw, 2, glow);
      rect(g, cx, cy, 2, ch, glow);
      rect(g, cx + cw - 2, cy, 2, ch, glow);
      if (rar === 'legendary') {
        // A glint sweeping across the card.
        const gx = Math.floor(((ui.t * 70) % (cw + 40)) - 20);
        for (let k = 0; k < 6; k++) if (gx + k > 2 && gx + k < cw - 2) rect(g, cx + gx + k, cy + 18, 1, ch - 21, '#ffffff33');
      }
    }
    if (focus) {
      rect(g, cx - 1, cy - 1, cw + 2, 1, PAL.ink);
      rect(g, cx - 1, cy + ch, cw + 2, 1, PAL.ink);
      rect(g, cx - 1, cy - 1, 1, ch + 2, PAL.ink);
      rect(g, cx + cw, cy - 1, 1, ch + 2, PAL.ink);
    }
    rect(g, cx + 3, cy + 3, cw - 6, 13, dim ? PAL.winShadow : u.color);
    upgradeGlyph(g, u, cx + 5, cy + 5, dim);
    text(g, String(i + 1), cx + cw - 7, cy + 6, { font: 'small', color: PAL.ink });
    wrap(u.name.toUpperCase(), cw - 8).slice(0, 2).forEach((l, k) => text(g, l, cx + cw / 2, cy + 20 + k * 9, { font: 'small', color: dim ? PAL.winShadow : PAL.ink, align: 'center' }));
    wrap(u.desc, cw - 8).slice(0, 2).forEach((l, k) => text(g, l, cx + cw / 2, cy + 40 + k * 8, { font: 'small', color: dim ? PAL.winShadow : PAL.winNavy, align: 'center' }));
    const have = st[id] || 0;
    if (have) text(g, mine ? `NOW x${have}` : `HAVE x${have}`, cx + cw / 2, cy + ch - 10, { font: 'small', color: PAL.goldDark, align: 'center' });
    else if (rar !== 'common') text(g, RARITY[rar].label, cx + cw / 2, cy + ch - 10, { font: 'small', color: dim ? PAL.winShadow : rar === 'legendary' ? PAL.goldDark : PAL.winNavy, align: 'center' });
    if (!picked) ui.addButton({ x: cx, y: cy, w: cw, h: ch }, () => game.pickUpgrade(id), 40 + i);
  });
}

// Endless and the Daily: an upgrade pick after each boss wave, over the paused game.
export function drawPick(g, ui, t, wave) {
  rect(g, 0, 0, W, H, '#00000066');
  const w = 312;
  const x = Math.round(W / 2 - w / 2);
  const inner = window98(g, x, 44, w, 112, `Wave ${wave} cleared - bonus upgrade`);
  drawCards(g, ui, inner, inner.y);
}

// Hero rank and a bar filling toward the next one.
function drawRankBar(g, xp, x, y, w, color) {
  const r = rankFor(xp);
  const a = xpForRank(r);
  const b = xpForRank(r + 1);
  const f = r >= MAX_RANK ? 1 : Math.max(0, Math.min(1, (xp - a) / (b - a)));
  text(g, `RANK ${r}`, x, y + 1, { font: 'small', color });
  const bx = x + 34;
  const bw = w - 34;
  rect(g, bx, y + 1, bw, 6, PAL.winShadow);
  rect(g, bx + 1, y + 2, bw - 2, 4, PAL.ink);
  rect(g, bx + 1, y + 2, Math.round((bw - 2) * f), 4, PAL.gold);
}

// ---------------------------------------------------------------- death: the Blue Screen
export function drawBsod(g, ui, t, stats) {
  rect(g, 0, 0, W, H, PAL.bsod);
  const title = ' Y2KAGE ';
  const tw = textWidth(title, 'big');
  rect(g, W / 2 - tw / 2 - 2, 20, tw + 4, 11, PAL.winFace);
  text(g, title, W / 2, 22, { font: 'big', color: PAL.bsod, align: 'center' });
  const hex = (0xc0011e00 + stats.level * 0x1f).toString(16).toUpperCase();
  const lines = [
    `A fatal exception 0E has occurred at 0028:${hex} in VXD`,
    `ZOMBIE(01) + ${String(stats.kills).padStart(8, '0')}. ${stats.hero} has been terminated.`,
    '',
    `Reached ${clockFor(stats.level).label}, level ${stats.level}. Score ${stats.score}.`,
    stats.left != null ? `Crashed in wave ${stats.wave} of ${stats.waves} with ${stats.left} zombie${stats.left === 1 ? '' : 's'} left.${stats.left <= 5 && stats.wave === stats.waves ? ' SO CLOSE.' : ''}` : '',
    '*  Press ENTER (or tap) to try this minute again.',
    '*  Press ESC to return to the menu. You will lose',
    '   any unsaved dignity.',
  ];
  if (stats.daily) {
    const d = stats.daily;
    lines[3] = `Daily Bug Report ${d.key} (${d.twist}): reached wave ${d.wave}.`;
    lines[4] = d.newBest ? '*** NEW BEST TODAY ***' : `Best today: wave ${d.best}. Streak: ${d.streak} day${d.streak === 1 ? '' : 's'}.`;
    lines[5] = '*  Press ENTER (or tap) to try the daily again.';
  } else if (stats.endless) {
    const e = stats.endless;
    lines[3] = `Endless, ${e.district}: survived to wave ${e.wave}. Score ${stats.score}.`;
    lines[4] = e.newBest ? '*** NEW BEST WAVE ***' : `Best in this district: wave ${e.best}.`;
    lines[5] = '*  Press ENTER (or tap) to start Endless again.';
  }
  const guest = ui.game.isGuest();
  if (guest) lines.splice(5, 3, '*  The whole crew crashed. Waiting for the host', '   to try again...');
  lines.forEach((l, i) => text(g, l, 26, 46 + i * 11, { font: 'small', color: PAL.white }));
  if (stats.xp != null && !stats.endless && !stats.daily) {
    const r = rankFor(stats.xp);
    const need = Math.max(0, Math.round(xpForRank(r + 1) - stats.xp));
    text(g, `${stats.me || stats.hero} is rank ${r}. ${need} XP to rank ${r + 1}.`, 26, 46 + lines.length * 11 + 4, { font: 'small', color: PAL.gold });
  }
  if (stats.tokens) text(g, `+${stats.tokens} tokens banked (${tokens()} total). Spend them in the Shop.`, 26, 148, { font: 'small', color: PAL.cyan });
  if (stats.checkpoint) text(g, 'CHECKPOINT: Try again starts at the boss wave.', 26, 138, { font: 'small', color: PAL.gold });
  const msg = 'Press any key to continue ';
  text(g, msg, W / 2, 158, { font: 'small', color: PAL.white, align: 'center' });
  if (Math.floor(t * 2) % 2) rect(g, W / 2 + textWidth(msg, 'small') / 2, 158, 5, 7, PAL.white);
  const b1 = { x: W / 2 - 90, y: 176, w: 84, h: 16 };
  const b2 = { x: W / 2 + 6, y: 176, w: 84, h: 16 };
  const btns = guest ? [[b2, 'Leave', 0]] : [[b1, 'Try again', 0], [b2, ui.game.net.active ? 'Lobby' : 'Menu', 1]];
  if (guest) ui.addButton(b2, () => ui.game.leaveOnline(), 5);
  else {
    ui.addButton(b1, () => ui.game.retry(), 0);
    ui.addButton(b2, () => ui.game.toSelect(), 1);
  }
  for (const [b, label, i] of btns) {
    rect(g, b.x, b.y, b.w, b.h, ui.focus === i ? PAL.white : PAL.bsod);
    rect(g, b.x, b.y, b.w, 1, PAL.white);
    rect(g, b.x, b.y + b.h - 1, b.w, 1, PAL.white);
    rect(g, b.x, b.y, 1, b.h, PAL.white);
    rect(g, b.x + b.w - 1, b.y, 1, b.h, PAL.white);
    text(g, label, b.x + b.w / 2, b.y + 5, { font: 'small', color: ui.focus === i ? PAL.bsod : PAL.white, align: 'center' });
  }
}

// ---------------------------------------------------------------- midnight
export function drawEnding(g, ui, t, stats) {
  if (t < 10) {
    const n = Math.max(0, 10 - Math.floor(t));
    text(g, 'THE BALL IS DROPPING', W / 2, 20, { font: 'big', color: PAL.cream, outline: PAL.ink, align: 'center' });
    const s = String(n);
    text(g, s, 44, 150, { font: 'big', scale: 5, color: PAL.gold, outline: PAL.ink, align: 'center' });
    text(g, `11:59:${String(50 + Math.min(9, Math.floor(t))).padStart(2, '0')} PM`, W / 2, H - 20, { font: 'big', color: PAL.pink, outline: PAL.ink, align: 'center' });
    return;
  }
  if (t < 26) {
    const logo = textCanvas('2000', 'big', PAL.gold, 5);
    const pulse = Math.floor(t * 4) % 2;
    text(g, 'HAPPY NEW YEAR', W / 2, 26, { font: 'big', scale: 2, color: pulse ? PAL.cream : PAL.pink, outline: PAL.ink, align: 'center' });
    text(g, '2000', W / 2, 52, { font: 'big', scale: 5, color: PAL.gold, outline: PAL.ink, align: 'center' });
    text(g, 'The clocks rolled over. The computers held.', W / 2, 108, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
    text(g, `${stats.hero} made it to midnight.  Final score ${stats.score}`, W / 2, 120, { font: 'small', color: PAL.cyan, outline: PAL.ink, align: 'center' });
    void logo;
    return;
  }
  // "It's now safe to turn off your computer."
  rect(g, 0, 0, W, H, PAL.black);
  text(g, "It's now safe to turn off", W / 2, H / 2 - 14, { font: 'big', color: PAL.tangerine, align: 'center' });
  text(g, 'your computer.', W / 2, H / 2, { font: 'big', color: PAL.tangerine, align: 'center' });
  if (t > 28) text(g, 'press any key', W / 2, H - 20, { font: 'small', color: PAL.winShadow, align: 'center' });
}

export { TAU, PARTY };

// ---------------------------------------------------------------- options (Control Panel)
export function drawOptions(g, ui, t, S) {
  const game = ui.game;
  rect(g, 0, 0, W, H, '#00000088');
  const w = 220;
  const x = W / 2 - w / 2;
  const inner = window98(g, x, 22, w, 168, 'Control Panel - Y2Kage');
  const rows = [
    ['Mouse look', `${S.sens.toFixed(2)}x`, 'step'],
    ['Music', S.music, 'bar'],
    ['Sound FX', S.sfx, 'bar'],
    ['CRT scanlines', S.scanlines ? 'On' : 'Off', 'toggle'],
    ['Glitch effects', S.glitch ? 'On' : 'Off', 'toggle'],
    ['Difficulty', { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[S.diff] || 'Normal', 'step'],
  ];
  rows.forEach(([label, val, kind], i) => {
    const y = inner.y + 4 + i * 18;
    const focus = ui.focus === i;
    if (focus) rect(g, inner.x + 2, y - 2, inner.w - 4, 16, PAL.winNavy);
    text(g, label, inner.x + 6, y + 2, { font: 'small', color: focus ? PAL.white : PAL.ink });
    const cx = inner.x + 110;
    if (kind === 'toggle') {
      const b = { x: cx, y: y - 1, w: 90, h: 13 };
      button(g, b.x, b.y, b.w, b.h, val, {});
      ui.addButton(b, () => game.optAdjust(i, 1), 100 + i);
      return;
    }
    const bl = { x: cx, y: y - 1, w: 13, h: 13 };
    const br = { x: cx + 77, y: y - 1, w: 13, h: 13 };
    button(g, bl.x, bl.y, bl.w, bl.h, '<', {});
    button(g, br.x, br.y, br.w, br.h, '>', {});
    ui.addButton(bl, () => game.optAdjust(i, -1), 110 + i);
    ui.addButton(br, () => game.optAdjust(i, 1), 120 + i);
    bevel(g, cx + 15, y - 1, 60, 13, true, PAL.white);
    if (kind === 'bar') {
      for (let k = 0; k < 10; k++) rect(g, cx + 18 + k * 5.5, y + 2, 4, 7, k < val ? PAL.winNavy : '#d0d0d0');
    } else text(g, val, cx + 45, y + 2, { font: 'small', color: PAL.ink, align: 'center' });
  });
  const dh = { easy: 'Softer bites, fewer zombies, 0.75x tokens.', hard: 'Harder bites, more zombies, 1.5x tokens.' }[S.diff] || 'The Daily Challenge is always Normal.';
  text(g, dh, inner.x + inner.w / 2, inner.y + 4 + rows.length * 18, { font: 'small', color: PAL.winShadow, align: 'center' });
  const done = { x: inner.x + inner.w / 2 - 40, y: inner.y + inner.h - 20, w: 80, h: 16 };
  button(g, done.x, done.y, done.w, done.h, 'OK', { focus: ui.focus === rows.length });
  ui.addButton(done, () => game.closeOptions(), rows.length);
  text(g, 'ARROWS adjust  ESC close', W / 2, H - 20, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
}

// ---------------------------------------------------------------- online co-op
export function drawMp(g, ui, t) {
  rect(g, 0, 0, W, H, '#00000066');
  const w = 200;
  const x = W / 2 - w / 2;
  const inner = window98(g, x, 40, w, 128, 'Online Co-op');
  iconInfo(g, inner.x + 4, inner.y + 4);
  text(g, 'Fight the horde with up to', inner.x + 24, inner.y + 4, { font: 'small', color: PAL.ink });
  text(g, '3 friends. Bigger waves, too.', inner.x + 24, inner.y + 13, { font: 'small', color: PAL.ink });
  const items = [['Host a Game', () => ui.game.hostOnline()], ['Join a Game', () => ui.game.setMode('join')], ['Back', () => ui.game.setMode('title')]];
  items.forEach(([label, on], i) => {
    const b = { x: inner.x + 24, y: inner.y + 28 + i * 18, w: inner.w - 48, h: 15 };
    button(g, b.x, b.y, b.w, b.h, label, { focus: ui.focus === i });
    ui.addButton(b, on, i);
  });
  if (ui.game.netStatus) text(g, ui.game.netStatus, W / 2, inner.y + inner.h - 9, { font: 'small', color: ui.game.netError ? PAL.red : PAL.winNavy, align: 'center' });
}

export function drawJoin(g, ui, t) {
  rect(g, 0, 0, W, H, '#00000066');
  const w = 220;
  const x = W / 2 - w / 2;
  const inner = window98(g, x, 44, w, 118, 'Join a Game');
  text(g, 'Type the room code your host sees:', inner.x + 4, inner.y + 4, { font: 'small', color: PAL.ink });
  const box = { x: inner.x + 30, y: inner.y + 16, w: inner.w - 60, h: 22 };
  bevel(g, box.x, box.y, box.w, box.h, true, PAL.white);
  const code = ui.game.joinCode;
  const shown = code + (Math.floor(t * 2) % 2 && code.length < 5 ? '_' : '');
  text(g, shown, box.x + box.w / 2, box.y + 7, { font: 'big', color: PAL.ink, align: 'center', scale: 1 });
  ui.addButton(box, () => ui.game.promptCode(), 9);
  const busy = ui.game.netBusy;
  const b1 = { x: inner.x + 30, y: inner.y + 46, w: 70, h: 16 };
  const b2 = { x: inner.x + inner.w - 100, y: inner.y + 46, w: 70, h: 16 };
  button(g, b1.x, b1.y, b1.w, b1.h, busy ? 'Dialing...' : 'Join', { focus: true, disabled: busy || code.length < 5 });
  button(g, b2.x, b2.y, b2.w, b2.h, 'Cancel');
  ui.addButton(b1, () => ui.game.joinOnline(), 0);
  ui.addButton(b2, () => ui.game.cancelJoin(), 1);
  if (ui.game.netStatus) text(g, ui.game.netStatus, W / 2, inner.y + 70, { font: 'small', color: ui.game.netError ? PAL.red : PAL.winNavy, align: 'center' });
  text(g, "Or just open your host's join link.", W / 2, inner.y + 84, { font: 'small', color: PAL.winShadow, align: 'center' });
}

export function drawLobby(g, ui, t, S) {
  const game = ui.game;
  const L = game.lobby;
  rect(g, 0, 0, W, H, '#00000066');
  const inner = window98(g, 8, 6, W - 16, H - 14, `Co-op room ${L.code}  -  ${L.players.length}/4 players`);
  // Player slots.
  const cw = 84;
  L.players.forEach((p, i) => {
    const x = inner.x + 4 + i * (cw + 4);
    const y = inner.y + 4;
    const hi = HEROES.findIndex((h) => h.id === p.heroId);
    const hero = HEROES[hi] || HEROES[0];
    const fl = FLAVOURS[Math.max(0, hi)];
    const mine = i === L.you;
    bevel(g, x, y, cw, 88, true, mine ? '#203050' : '#101828');
    const body = S.heroBodies[Math.max(0, hi)][Math.floor(t * 2.5 + i) & 1];
    g.drawImage(body.c, Math.round(x + cw / 2 - body.w / 2), y + 4);
    rect(g, x + 2, y + 66, cw - 4, 20, fl.dark);
    text(g, `${p.name}${mine ? ' (YOU)' : ''}`, x + cw / 2, y + 68, { font: 'small', color: PAL.white, align: 'center' });
    text(g, `${hero.name} LV${rankFor(p.xp || 0)}`, x + cw / 2, y + 77, { font: 'small', color: PAL.gold, align: 'center' });
    if (mine) {
      const bl = { x: x + 2, y: y + 30, w: 12, h: 14 };
      const br = { x: x + cw - 14, y: y + 30, w: 12, h: 14 };
      button(g, bl.x, bl.y, bl.w, bl.h, '<');
      button(g, br.x, br.y, br.w, br.h, '>');
      ui.addButton(bl, () => game.lobbyHero(-1), 20);
      ui.addButton(br, () => game.lobbyHero(1), 21);
    }
  });
  for (let i = L.players.length; i < 4; i++) {
    const x = inner.x + 4 + i * (cw + 4);
    bevel(g, x, inner.y + 4, cw, 88, true, '#0c0c14');
    text(g, 'waiting', x + cw / 2, inner.y + 40, { font: 'small', color: PAL.winShadow, align: 'center' });
    text(g, 'for player', x + cw / 2, inner.y + 49, { font: 'small', color: PAL.winShadow, align: 'center' });
  }
  const y2 = inner.y + 98;
  // Room code and join link.
  text(g, 'ROOM CODE', inner.x + 4, y2, { font: 'small', color: PAL.ink });
  bevel(g, inner.x + 4, y2 + 9, 70, 18, true, PAL.white);
  text(g, L.code, inner.x + 39, y2 + 14, { font: 'big', color: PAL.winNavy, align: 'center' });
  const cb = { x: inner.x + 4, y: y2 + 30, w: 70, h: 14 };
  button(g, cb.x, cb.y, cb.w, cb.h, game.copiedT > 0 ? 'Copied!' : 'Copy link');
  ui.addButton(cb, () => game.copyJoinLink(), 22);
  // Level (host picks) and start.
  const n = L.level;
  const px = inner.x + 84;
  text(g, 'LEVEL', px, y2, { font: 'small', color: PAL.ink });
  bevel(g, px, y2 + 9, 120, 18, true, PAL.white);
  text(g, `${n}  ${clockFor(n).label}`, px + 60, y2 + 14, { font: 'small', color: PAL.ink, align: 'center' });
  text(g, DISTRICTS[Math.min(4, Math.floor((n - 1) / 10))].name.toUpperCase(), px + 60, y2 + 33, { font: 'small', color: PAL.strawberryDark, align: 'center' });
  const host = L.you === 0;
  if (host) {
    const bl = { x: px - 0, y: y2 + 30, w: 12, h: 12 };
    const br = { x: px + 108, y: y2 + 30, w: 12, h: 12 };
    button(g, bl.x, bl.y, bl.w, bl.h, '<', { disabled: n <= 1 });
    button(g, br.x, br.y, br.w, br.h, '>', { disabled: n >= game.best });
    ui.addButton(bl, () => game.lobbyLevel(-1), 23);
    ui.addButton(br, () => game.lobbyLevel(1), 24);
  }
  const bx = inner.x + inner.w - 124;
  if (host) {
    const go = { x: bx, y: y2 + 6, w: 120, h: 20 };
    button(g, go.x, go.y, go.w, go.h, L.players.length > 1 ? 'START' : 'START SOLO', { font: 'big', focus: true });
    ui.addButton(go, () => game.startOnline(), 0);
  } else text(g, 'Host starts the game', bx + 60, y2 + 12, { font: 'small', color: PAL.winNavy, align: 'center' });
  const lv = { x: bx, y: y2 + 30, w: 120, h: 14 };
  button(g, lv.x, lv.y, lv.w, lv.h, host ? 'Close room' : 'Leave room');
  ui.addButton(lv, () => game.leaveOnline(), 1);
  const tip = host ? 'Send friends the code or link.  ARROWS hero/level  ENTER start' : 'ARROWS change hero   ESC leave';
  text(g, game.netStatus || tip, W / 2, inner.y + inner.h - 9, { font: 'small', color: game.netError ? PAL.red : PAL.winShadow, align: 'center' });
}

// A message box over whatever is on screen (for dropped connections and the like).
export function drawNotice(g, ui, n) {
  const w = 220;
  const x = W / 2 - w / 2;
  const inner = window98(g, x, 70, w, 62, n.title);
  iconError(g, inner.x + 4, inner.y + 4);
  wrap(n.text, inner.w - 30).slice(0, 2).forEach((l, i) => text(g, l, inner.x + 24, inner.y + 4 + i * 9, { font: 'small', color: PAL.ink }));
  const b = { x: inner.x + inner.w / 2 - 30, y: inner.y + 26, w: 60, h: 15 };
  button(g, b.x, b.y, b.w, b.h, 'OK', { focus: true });
  ui.addButton(b, () => ui.game.dismissNotice(), 99);
}

// ---------------------------------------------------------------- trophy case
export function drawTrophies(g, ui, t) {
  const game = ui.game;
  rect(g, 0, 0, W, H, '#00000077');
  const got = unlocked();
  const n = Object.keys(got).length;
  const inner = window98(g, 4, 3, W - 8, H - 6, `Trophy Case - ${n} of ${ACHIEVEMENTS.length}`);
  // Trophies down the left.
  const lw = 212;
  bevel(g, inner.x, inner.y, lw, inner.h, true, PAL.white);
  ACHIEVEMENTS.forEach((a, i) => {
    const y = inner.y + 3 + i * Math.min(10, Math.floor((inner.h - 6) / ACHIEVEMENTS.length));
    const on = !!got[a.id];
    rect(g, inner.x + 3, y, 7, 7, on ? PAL.gold : '#d0d0d0');
    if (on) rect(g, inner.x + 5, y + 2, 3, 3, PAL.goldDark);
    // Earned trophies show their name; the rest show what it takes.
    text(g, on ? a.name : a.desc, inner.x + 13, y, { font: 'small', color: on ? PAL.winNavy : PAL.winShadow });
    if (on && a.reward) text(g, 'EXTRA', inner.x + lw - 3, y, { font: 'small', color: PAL.goldDark, align: 'right' });
  });
  // Extras down the right.
  const rx = inner.x + lw + 4;
  const rw = inner.w - lw - 4;
  text(g, 'EXTRAS', rx + rw / 2, inner.y + 1, { font: 'big', color: PAL.winNavy, align: 'center' });
  const on = cheats();
  const endless = EXTRAS[0];
  const eu = extraUnlocked('endless');
  text(g, eu ? 'Endless: on the' : 'Endless mode:', rx + 2, inner.y + 13, { font: 'small', color: eu ? PAL.ink : PAL.winShadow });
  text(g, eu ? 'hero select screen' : 'beat level 10', rx + 2, inner.y + 21, { font: 'small', color: eu ? PAL.ink : PAL.winShadow });
  void endless;
  EXTRAS.slice(1).forEach((e, i) => {
    const y = inner.y + 32 + i * 25;
    const un = extraUnlocked(e.id);
    const b = { x: rx, y, w: rw, h: 14 };
    button(g, b.x, b.y, b.w, b.h, un ? `${e.name}: ${on[e.id] ? 'ON' : 'off'}` : '???', { focus: game.focus === i, color: un && on[e.id] ? PAL.strawberryDark : undefined, disabled: !un });
    ui.addButton(b, () => game.flipCheat(e.id), i);
    const how = un ? e.desc : `Unlock: ${ACHIEVEMENTS.find((a) => a.reward === e.id).name}`;
    wrap(how, rw).slice(0, 1).forEach((l) => text(g, l, rx + rw / 2, y + 16, { font: 'small', color: PAL.winShadow, align: 'center' }));
  });
  const back = { x: rx, y: inner.y + inner.h - 15, w: rw, h: 14 };
  button(g, back.x, back.y, back.w, back.h, 'Back', { focus: game.focus === EXTRAS.length - 1 });
  ui.addButton(back, () => game.setMode('title'), EXTRAS.length - 1);
}

// "Achievement unlocked" balloon sliding down from the top.
export function drawAchPop(g, a) {
  const w = 190;
  const h = a.reward ? 34 : 26;
  const inT = Math.min(1, a.t / 0.25);
  const outT = Math.max(0, (a.t - 3.6) / 0.4);
  const y = Math.round(-h + (h + 4) * inT - (h + 4) * outT);
  const x = Math.round(W / 2 - w / 2);
  rect(g, x + 2, y + 2, w, h, '#00000066');
  bevel(g, x, y, w, h, false, PAL.winTip);
  rect(g, x + 4, y + 4, 16, 16, PAL.gold);
  rect(g, x + 7, y + 7, 10, 7, PAL.goldDark);
  rect(g, x + 10, y + 14, 4, 3, PAL.goldDark);
  rect(g, x + 8, y + 17, 8, 2, PAL.goldDark);
  text(g, 'TROPHY UNLOCKED', x + 25, y + 4, { font: 'small', color: PAL.strawberryDark });
  text(g, a.name, x + 25, y + 13, { font: 'big', color: PAL.ink });
  if (a.reward) text(g, `New extra: ${a.reward}`, x + 25, y + 24, { font: 'small', color: PAL.winNavy });
}

// ---------------------------------------------------------------- upgrade shop
// Permanent perks bought with tokens. Each row: what it does, its tiers, and a Buy button.
export function drawShop(g, ui, t) {
  const game = ui.game;
  rect(g, 0, 0, W, H, '#00000077');
  const inner = window98(g, 24, 8, W - 48, H - 16, 'Upgrade Shop - SHOP.EXE');
  const hero = heroById(game.heroId);
  const items = shopItems(hero);
  text(g, 'PERMANENT PERKS FOR YOUR HERO', inner.x + 4, inner.y + 2, { font: 'small', color: PAL.winNavy });
  const tk = `${tokens()} TOKENS`;
  const coinX = inner.x + inner.w - 6 - textWidth(tk, 'big');
  rect(g, coinX - 11, inner.y + 1, 8, 8, PAL.gold);
  rect(g, coinX - 9, inner.y + 3, 4, 4, PAL.goldDark);
  text(g, tk, inner.x + inner.w - 4, inner.y + 1, { font: 'big', color: PAL.goldDark, align: 'right' });
  const rowH = 24;
  items.forEach((p, i) => {
    const y = inner.y + 13 + i * rowH;
    const tier = perkTier(p.id);
    const cost = nextCost(p);
    bevel(g, inner.x, y, inner.w, rowH - 2, true, game.focus === i ? '#fff8d8' : PAL.white);
    rect(g, inner.x + 4, y + 4, 16, 16, p.color);
    rect(g, inner.x + 6, y + 6, 12, 12, PAL.ink);
    text(g, String(tier), inner.x + 12, y + 8, { font: 'small', color: p.color, align: 'center' });
    text(g, p.weapon ? `${hero.name}: ${p.name}` : p.name, inner.x + 25, y + 3, { font: 'big', color: PAL.ink });
    text(g, p.desc, inner.x + 25, y + 14, { font: 'small', color: PAL.winShadow });
    // Tier pips.
    const px = inner.x + inner.w - 124;
    if (!p.weapon) p.costs.forEach((c, k) => rect(g, px + k * 9, y + 9, 7, 7, k < tier ? p.color : '#d0d0d0'));
    const b = { x: inner.x + inner.w - 72, y: y + 5, w: 66, h: 14 };
    const can = cost && tokens() >= cost;
    button(g, b.x, b.y, b.w, b.h, cost ? `Buy ${cost}` : p.weapon ? 'OWNED' : 'MAXED', { focus: game.focus === i, disabled: !can });
    ui.addButton(b, () => game.buyPerk(p.id), i);
  });
  const by = inner.y + inner.h - 16;
  const flashing = game.shopFlash && t - game.shopFlash.t < 1;
  if (!flashing) text(g, 'Earn tokens: levels, bosses, Jackpots, Endless.', inner.x + 4, by + 4, { font: 'small', color: PAL.winShadow });
  const back = { x: inner.x + inner.w - 60, y: by, w: 58, h: 14 };
  button(g, back.x, back.y, back.w, back.h, 'Back', { focus: game.focus === items.length });
  ui.addButton(back, () => game.setMode('title'), items.length);
  if (flashing) text(g, game.shopFlash.text, inner.x + 4, by + 3, { font: 'big', color: game.shopFlash.ok ? PAL.strawberryDark : PAL.red, outline: PAL.white });
}
