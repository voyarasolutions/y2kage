// Every non-gameplay screen: CRT power-on, BIOS POST, the dial-up connection, the chrome title,
// the iMac hero picker, pause and level-clear dialogs, the Blue Screen of Death, and midnight.
import { PAL, FLAVOURS, PARTY } from '../core/palette.js';
import { W, H, TAU } from '../core/util.js';
import { text, textCanvas, textWidth, wrap } from '../core/pixelfont.js';
import { bevel, rect, button, progress, window98, iconInfo, iconError, startFlag, titleBar } from './win98.js';
import { HEROES } from '../data/heroes.js';
import { heroXp, rankFor, dmgMulFor } from '../data/progress.js';
import { clockFor, DISTRICTS, TOTAL_LEVELS } from '../data/levels.js';

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

function computerIcon(g, x, y) {
  rect(g, x, y, 22, 16, PAL.winFace);
  rect(g, x + 2, y + 2, 18, 11, PAL.winTeal);
  rect(g, x + 2, y + 2, 18, 1, '#40a0a0');
  rect(g, x + 6, y + 17, 10, 2, PAL.winShadow);
  rect(g, x + 2, y + 19, 18, 2, PAL.winFace);
}

export function drawDesktop(g) {
  rect(g, 0, 0, W, H, PAL.winTeal);
  // Desktop icons down the left, like everyone's did.
  const icons = [['My Computer', PAL.winFace], ['Y2K Patch', PAL.gold], ['Recycle Bin', PAL.winShadow], ['Dial-Up', PAL.bondi]];
  icons.forEach(([name, c], i) => {
    const y = 8 + i * 34;
    rect(g, 30, y, 16, 14, c);
    rect(g, 32, y + 2, 12, 8, i === 1 ? PAL.strawberry : '#1a4a8a');
    text(g, name, 38, y + 17, { font: 'small', color: PAL.white, align: 'center' });
  });
}

export function drawDialup(g, t) {
  drawDesktop(g);
  const w = 230;
  const h = 96;
  const x = W / 2 - w / 2;
  const y = 50;
  const inner = window98(g, x, y, w, h, 'Connecting to Y2KAGE.NET');
  computerIcon(g, inner.x + 14, inner.y + 6);
  computerIcon(g, inner.x + inner.w - 36, inner.y + 6);
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
  const inner = window98(g, x, y, w, 89, 'Y2KAGE.EXE');
  const items = [
    ['Start Game', () => ui.game.toSelect()],
    ['Online Co-op', () => ui.game.setMode('mp')],
    ['How to Play', () => ui.game.setMode('howto')],
    ['Options', () => ui.game.openOptions()],
  ];
  items.forEach(([label, on], i) => {
    const b = { x: inner.x + 6, y: inner.y + 2 + i * 17, w: inner.w - 12, h: 14 };
    button(g, b.x, b.y, b.w, b.h, label, { focus: ui.focus === i });
    ui.addButton(b, on, i);
  });
  const best = ui.game.best;
  if (best > 1) text(g, `Furthest: level ${best}  ${clockFor(best).label}`, W / 2, y + 91, { font: 'small', color: PAL.gold, outline: PAL.ink, align: 'center' });

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

// ---------------------------------------------------------------- how to play (Notepad)
const HOWTO = [
  'README.TXT',
  '',
  'It is 11:10 PM, Dec 31 1999. The Y2K bug hit early and the',
  'party turned. Hold out through 50 levels, one per minute,',
  'until the ball drops at midnight.',
  '',
  'MOVE   W A S D  (arrows turn)     AIM   mouse',
  'FIRE   click, hold for auto       RIDE  SPACE / SHIFT',
  'SPECIAL R / right-click when full  PAUSE ESC   MUTE M',
  'Phone: left thumb moves, right thumb aims, tap FIRE.',
  'ONLINE CO-OP: host a room, up to 3 friends join by code.',
  'Each hero has a ride and a weapon of their own.',
  'Water fries Corrupted zombies. Every 10th level: boss.',
  'Kills earn XP. Every LEVEL UP makes that hero hit harder.',
  'Powerups: FIX disk invincible, x3 triple shot,',
  'toaster slow-mo, C-A-D ends every zombie in sight.',
];

export function drawHowto(g, ui, t) {
  const w = 340;
  const h = 196;
  const x = W / 2 - w / 2;
  const y = 6;
  const inner = window98(g, x, y, w, h, 'README.TXT - Notepad');
  // Menu bar.
  ['File', 'Edit', 'Search', 'Help'].forEach((m, i) => text(g, m, inner.x + 2 + [0, 30, 60, 100][i], inner.y, { font: 'small', color: PAL.ink }));
  bevel(g, inner.x, inner.y + 10, inner.w, inner.h - 28, true, PAL.white);
  HOWTO.forEach((l, i) => text(g, l, inner.x + 4, inner.y + 14 + i * 9, { font: 'small', color: PAL.ink }));
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
  text(g, hero.weapon.toUpperCase(), inner.x + 58, inner.y + 22, { font: 'small', color: PAL.strawberryDark });
  const stats = [['SPD', hero.stats.speed], ['PWR', hero.stats.power], ['RNG', hero.stats.range]];
  stats.forEach(([k, v], j) => {
    text(g, k, inner.x + inner.w - 58, inner.y + 2 + j * 9, { font: 'small', color: PAL.ink });
    statPips(g, inner.x + inner.w - 34, inner.y + 3 + j * 9, v, FLAVOURS[i].dark);
  });
  text(g, hero.controls.toUpperCase(), inner.x + inner.w - 3, inner.y + 30, { font: 'small', color: PAL.winShadow, align: 'right' });
  wrap(hero.blurb, inner.w - 6).slice(0, 3).forEach((l, k) => text(g, l, inner.x + 2, inner.y + 40 + k * 8, { font: 'small', color: PAL.ink }));

  // Level picker and go button.
  const px = 254;
  const pin = window98(g, px, dy, W - px - 6, 84, 'Start Level');
  const n = game.pickLevel;
  const c = clockFor(n);
  const d = DISTRICTS[Math.min(DISTRICTS.length - 1, Math.floor((n - 1) / 10))];
  const bl = { x: pin.x + 2, y: pin.y + 2, w: 14, h: 14 };
  const br = { x: pin.x + pin.w - 16, y: pin.y + 2, w: 14, h: 14 };
  button(g, bl.x, bl.y, bl.w, bl.h, '<', { disabled: n <= 1 });
  button(g, br.x, br.y, br.w, br.h, '>', { disabled: n >= game.best });
  ui.addButton(bl, () => game.stepLevel(-1), 20);
  ui.addButton(br, () => game.stepLevel(1), 21);
  bevel(g, pin.x + 18, pin.y + 2, pin.w - 36, 14, true, PAL.white);
  text(g, `LVL ${n}`, pin.x + pin.w / 2, pin.y + 6, { font: 'big', color: PAL.ink, align: 'center' });
  text(g, c.label, pin.x + pin.w / 2, pin.y + 20, { font: 'small', color: PAL.winNavy, align: 'center' });
  text(g, d.name.toUpperCase(), pin.x + pin.w / 2, pin.y + 29, { font: 'small', color: PAL.strawberryDark, align: 'center' });
  if (n % 10 === 0) text(g, 'BOSS LEVEL', pin.x + pin.w / 2, pin.y + 38, { font: 'small', color: PAL.red, align: 'center' });
  const go = { x: pin.x + 4, y: pin.y + pin.h - 22, w: pin.w - 8, h: 18 };
  button(g, go.x, go.y, go.w, go.h, 'PLAY', { font: 'big', focus: true });
  ui.addButton(go, () => game.startRun(), 30);
  text(g, 'ARROWS pick  ENTER play  ESC back', W / 2, H - 11, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
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
}

export function drawClear(g, ui, t, stats) {
  const w = 220;
  const x = W / 2 - w / 2;
  const inner = window98(g, x, 30, w, 134, `Level ${stats.level} complete`);
  iconInfo(g, inner.x + 4, inner.y + 4);
  text(g, `${clockFor(stats.level).label} SURVIVED`, inner.x + 22, inner.y + 4, { font: 'big', color: PAL.winNavy });
  const rows = [['Zombies deleted', stats.kills], ['Time', `${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, '0')}`], ['Best combo', `${stats.combo || 0} hits`], ['Level score', stats.levelScore], ['Total score', stats.score]];
  rows.forEach(([k, v], i) => {
    text(g, k, inner.x + 22, inner.y + 20 + i * 10, { font: 'small', color: PAL.ink });
    text(g, String(v), inner.x + inner.w - 6, inner.y + 20 + i * 10, { font: 'small', color: PAL.ink, align: 'right' });
  });
  const next = Math.min(TOTAL_LEVELS, stats.level + 1);
  text(g, `Next: ${clockFor(next).label}, ${DISTRICTS[Math.min(4, Math.floor((next - 1) / 10))].name}`, inner.x + 22, inner.y + 73, { font: 'small', color: PAL.strawberryDark });
  if (ui.game.isGuest()) {
    text(g, 'Waiting for the host...', inner.x + 22, inner.y + 92, { font: 'small', color: PAL.winNavy });
    const b = { x: inner.x + inner.w - 62, y: inner.y + 88, w: 56, h: 16 };
    button(g, b.x, b.y, b.w, b.h, 'Leave', { focus: true });
    ui.addButton(b, () => ui.game.leaveOnline(), 5);
    return;
  }
  const items = [['Next Level', () => ui.game.nextLevel()], [ui.game.net.active ? 'Lobby' : 'Menu', () => ui.game.toSelect()]];
  items.forEach(([label, on], i) => {
    const b = { x: inner.x + 22 + i * 88, y: inner.y + 88, w: 80, h: 16 };
    button(g, b.x, b.y, b.w, b.h, label, { focus: ui.focus === i });
    ui.addButton(b, on, i);
  });
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
    '',
    '*  Press ENTER (or tap) to try this minute again.',
    '*  Press ESC to return to the menu. You will lose',
    '   any unsaved dignity.',
  ];
  const guest = ui.game.isGuest();
  if (guest) lines.splice(5, 3, '*  The whole crew crashed. Waiting for the host', '   to try again...');
  lines.forEach((l, i) => text(g, l, 26, 46 + i * 11, { font: 'small', color: PAL.white }));
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
  const inner = window98(g, x, 30, w, 150, 'Control Panel - Y2Kage');
  const rows = [
    ['Mouse look', `${S.sens.toFixed(2)}x`, 'step'],
    ['Music', S.music, 'bar'],
    ['Sound FX', S.sfx, 'bar'],
    ['CRT scanlines', S.scanlines ? 'On' : 'Off', 'toggle'],
    ['Glitch effects', S.glitch ? 'On' : 'Off', 'toggle'],
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
