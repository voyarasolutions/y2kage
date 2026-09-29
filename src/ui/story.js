// Story mode screens and HUD: the chapter picker, cutscenes (TV news breaks, pagers, AIM chats,
// the crew talking), and in a mission the objective line, chat pop-ups, markers pointing at what
// to do next, the USE prompt, the bag-check keypad and the news ticker.
import { PAL, PARTY, FLAVOURS } from '../core/palette.js';
import { W, H } from '../core/util.js';
import { text, textWidth, wrap } from '../core/pixelfont.js';
import { bevel, rect, button, window98, iconInfo } from './win98.js';
import { HEROES } from '../data/heroes.js';
import { CHAPTERS, STATIONS } from '../data/story.js';
import { GRADE_COL } from '../data/grades.js';
import { TASKBAR_H } from './hud.js';

const BUG = 'MillenniumBug99';
const heroIdx = (id) => Math.max(0, HEROES.findIndex((h) => h.id === id));
// Typewriter speed for scene lines, characters per second.
export const TYPE_CPS = 45;

// ---------------------------------------------------------------- chapter picker
export function drawStoryMenu(g, ui, t, S) {
  const game = ui.game;
  const prog = game.storyProgress();
  text(g, 'STORY MODE', W / 2, 8, { font: 'big', scale: 2, color: PAL.gold, outline: PAL.ink, align: 'center' });
  text(g, 'INSERT DISK 2', W / 2, 27, { font: 'big', color: PARTY[Math.floor(t * 3) % PARTY.length], outline: PAL.ink, align: 'center' });

  // Chapters down the left.
  const cw = 132;
  const ci = window98(g, 6, 40, cw, 150, 'CHAPTERS');
  const names = ['Times Square', 'Broadway', 'Subway', 'Bank Server Room', 'The Ball Drop'];
  names.forEach((nm, k) => {
    const C = CHAPTERS[k];
    const b = { x: ci.x + 2, y: ci.y + 2 + k * 25, w: ci.w - 4, h: 23 };
    const on = game.storyCh === k;
    bevel(g, b.x, b.y, b.w, b.h, on, on ? PAL.white : PAL.winFace);
    text(g, `${k + 1}`, b.x + 5, b.y + 4, { font: 'big', color: C ? PAL.winNavy : PAL.winShadow });
    text(g, nm.toUpperCase(), b.x + 16, b.y + 4, { font: 'small', color: C ? PAL.ink : PAL.winShadow });
    const done = C ? C.missions.filter((M) => prog[M.id]).length : 0;
    text(g, C ? `${done}/${C.missions.length} MISSIONS` : 'COMING SOON', b.x + 16, b.y + 13, { font: 'small', color: C ? (done === C.missions.length ? PAL.lime : PAL.winDark) : PAL.winShadow });
    if (C) ui.addButton(b, () => game.pickChapter(k), 40 + k);
  });

  // Missions of the picked chapter on the right.
  const C = CHAPTERS[game.storyCh];
  const mx = cw + 12;
  const mi = window98(g, mx, 40, W - mx - 6, 150, C ? `CHAPTER ${C.n}: ${C.title.toUpperCase()}` : 'CHAPTER');
  if (!C) return;
  const hi = heroIdx(C.hero);
  bevel(g, mi.x + 1, mi.y + 1, 36, 36, true, FLAVOURS[hi].dark);
  g.drawImage(S.portraits[hi].c, mi.x + 3, mi.y + 3);
  text(g, `${HEROES[hi].name}'S CHAPTER`, mi.x + 42, mi.y + 4, { font: 'big', color: PAL.winNavy });
  wrap(C.blurb, mi.w - 46).slice(0, 2).forEach((l, k) => text(g, l, mi.x + 42, mi.y + 16 + k * 9, { font: 'small', color: PAL.ink }));
  C.missions.forEach((M, k) => {
    const open = game.missionOpen(M);
    const b = { x: mi.x + 2, y: mi.y + 41 + k * 17, w: mi.w - 4, h: 15 };
    button(g, b.x, b.y, b.w, b.h, '', { focus: ui.focus === k, disabled: !open });
    text(g, `${M.id}`, b.x + 5, b.y + 4, { font: 'small', color: open ? PAL.winNavy : PAL.winShadow });
    text(g, open ? M.name.toUpperCase() : 'LOCKED', b.x + 26, b.y + 4, { font: 'small', color: open ? PAL.ink : PAL.winShadow });
    text(g, `11:${M.minute} PM`, b.x + b.w - 30, b.y + 4, { font: 'small', color: open ? PAL.winDark : PAL.winShadow, align: 'right' });
    const gr = prog[M.id];
    if (gr) text(g, gr, b.x + b.w - 8, b.y + 3, { font: 'big', color: GRADE_COL[gr], outline: PAL.ink, align: 'center' });
    if (open) ui.addButton(b, () => game.startMission(M.id), k);
  });
  text(g, 'ARROWS pick  ENTER play  ESC back', W / 2, H - 11, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
}

// ---------------------------------------------------------------- cutscenes
// One line of a scene, typed out. `shown` is how many characters are visible so far.
export function drawScene(g, ui, t, S, line, shown, i, n) {
  rect(g, 0, 0, W, H, '#0a061488');
  const body = line.text ? line.text.slice(0, shown) : '';
  const k = line.k;
  if (k === 'card') drawCard(g, t, line);
  else if (k === 'news') drawNews(g, t, body);
  else if (k === 'pager') drawPager(g, t, body);
  else if (k === 'aim') drawAim(g, t, line.from, body, W / 2 - 110, 60, 220);
  else if (k === 'say') drawSay(g, t, S, line.who, body, H - 64);
  else if (k === 'result') drawResult(g, t, line.stats);
  // Progress through the scene and how to move on.
  const done = !line.text || shown >= line.text.length;
  text(g, `${i + 1}/${n}`, 6, 6, { font: 'small', color: PAL.winShadow, outline: PAL.ink });
  text(g, done ? (ui.game.input.pad.on ? 'A next   B skip' : 'ENTER next   ESC skip') : '', W - 6, 6, { font: 'small', color: Math.floor(t * 2) % 2 ? PAL.cream : PAL.winShadow, outline: PAL.ink, align: 'right' });
}

function drawCard(g, t, line) {
  rect(g, 0, 0, W, H, PAL.ink);
  for (let k = 0; k < 40; k++) {
    const x = (k * 97 + Math.floor(t * 30) * (k % 3)) % W;
    const y = (k * 53) % H;
    rect(g, x, y, 1, 1, PARTY[k % PARTY.length]);
  }
  text(g, line.title, W / 2, 80, { font: 'big', scale: 2, color: PAL.gold, outline: PAL.purple, align: 'center' });
  text(g, line.sub, W / 2, 106, { font: 'big', color: PAL.cyan, outline: PAL.ink, align: 'center' });
}

// A TV on the news: a CRT bezel, the NEWS 4 LIVE bug and the words along the lower third.
function drawNews(g, t, body) {
  const w = 250;
  const h = 150;
  const x = Math.round(W / 2 - w / 2);
  const y = 30;
  rect(g, x - 8, y - 8, w + 16, h + 22, '#2a2a30');
  rect(g, x - 6, y - 6, w + 12, h + 12, '#101014');
  rect(g, x, y, w, h, '#16306a');
  for (let yy = 0; yy < h; yy += 2) rect(g, x, y + yy, w, 1, '#1c3a7a');
  // The studio: a desk and the anchor's shape, and the skyline behind.
  for (let k = 0; k < 12; k++) rect(g, x + 8 + k * 20, y + 40 - ((k * 7) % 20), 14, 60, '#0e2250');
  rect(g, x + 80, y + 46, 90, 48, '#0a1430');
  rect(g, x + 110, y + 34, 30, 30, '#0a1430');
  rect(g, x + 40, y + 88, w - 80, 20, '#3a2a1a');
  rect(g, x, y + h - 44, w, 44, '#000000cc');
  rect(g, x, y + h - 44, 70, 11, PAL.red);
  text(g, 'NEWS 4 LIVE', x + 4, y + h - 42, { font: 'small', color: PAL.white });
  const lines = wrap(body, w - 12);
  lines.slice(0, 3).forEach((l, i) => text(g, l, x + 6, y + h - 30 + i * 9, { font: 'small', color: PAL.cream }));
  // Every so often the picture rolls, because the Bug is in the signal.
  if (Math.floor(t * 3) % 7 === 0) rect(g, x, y + ((t * 200) % h), w, 3, '#ffffff33');
  rect(g, x + w - 16, y + h + 8, 8, 4, PAL.red);
}

// A pager in someone's hand: a black clip-on with a green LCD, the message scrolling across.
function drawPager(g, t, body) {
  const w = 220;
  const x = Math.round(W / 2 - w / 2);
  const y = 70;
  rect(g, x - 2, y - 2, w + 4, 64, PAL.ink);
  rect(g, x, y, w, 60, '#2a2a34');
  rect(g, x, y, w, 2, '#4a4a58');
  rect(g, x + 10, y + 10, w - 20, 34, '#1a2a12');
  rect(g, x + 12, y + 12, w - 24, 30, '#9cc070');
  const lines = wrap(body.toUpperCase(), w - 32);
  lines.slice(-3).forEach((l, i) => text(g, l, x + 16, y + 14 + i * 9, { font: 'small', color: '#1a2a12' }));
  rect(g, x + w / 2 - 20, y + 48, 12, 6, '#4a4a58');
  rect(g, x + w / 2 + 8, y + 48, 12, 6, '#4a4a58');
  text(g, 'SKYTEL', x + 10, y + 49, { font: 'small', color: '#6a6a78' });
  if (Math.floor(t * 4) % 2) rect(g, x + w - 16, y + 4, 4, 3, PAL.red);
}

// An AIM instant message window. The Bug's name comes up in red, anyone else's in blue.
export function drawAim(g, t, from, body, x, y, w) {
  const lines = wrap(body, w - 14);
  const h = 34 + lines.length * 9;
  const inner = window98(g, x, y, w, h, textWidth(`${from} - Instant Message`, 'small') < w - 20 ? `${from} - Instant Message` : `${from} - IM`);
  rect(g, inner.x, inner.y, inner.w, inner.h - 2, PAL.white);
  const bug = from === BUG;
  text(g, `${from}:`, inner.x + 3, inner.y + 3, { font: 'small', color: bug ? PAL.red : PAL.winNavy });
  lines.forEach((l, i) => text(g, l, inner.x + 3, inner.y + 12 + i * 9, { font: 'small', color: bug && Math.random() < 0.03 ? PAL.lime : PAL.ink }));
  return h;
}

// A hero talking: their portrait and a dialog box.
function drawSay(g, t, S, who, body, y) {
  const i = heroIdx(who);
  const w = W - 20;
  const x = 10;
  const inner = window98(g, x, y, w, 58, HEROES[i].name);
  bevel(g, inner.x + 1, inner.y + 1, 36, 36, true, FLAVOURS[i].dark);
  g.drawImage(S.portraits[i].c, inner.x + 3, inner.y + 3);
  wrap(body, inner.w - 48).slice(0, 4).forEach((l, k) => text(g, l, inner.x + 42, inner.y + 3 + k * 9, { font: 'small', color: PAL.ink }));
}

// Mission complete: grade, kills, time and tokens, before the story carries on.
function drawResult(g, t, st) {
  const w = 230;
  const x = Math.round(W / 2 - w / 2);
  const inner = window98(g, x, 50, w, 92, `Mission ${st.id} complete`);
  rect(g, inner.x + 3, inner.y + 1, 15, 13, PAL.ink);
  rect(g, inner.x + 4, inner.y + 2, 13, 11, PAL.white);
  text(g, st.grade, inner.x + 11, inner.y + 4, { font: 'big', color: GRADE_COL[st.grade], outline: PAL.ink, align: 'center' });
  text(g, st.name.toUpperCase(), inner.x + 24, inner.y + 3, { font: 'big', color: PAL.winNavy });
  const tm = `${Math.floor(st.time / 60)}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`;
  const rows = [['Zombies deleted', st.kills], ['Time', tm], ['Best combo', `${st.combo} hits`], ['Score', st.score]];
  rows.forEach(([k, v], i) => {
    text(g, k, inner.x + 6, inner.y + 20 + i * 9, { font: 'small', color: PAL.ink });
    text(g, String(v), inner.x + inner.w - 6, inner.y + 20 + i * 9, { font: 'small', color: PAL.winNavy, align: 'right' });
  });
  if (st.tokens) text(g, `+${st.tokens} TOKENS${st.best ? '  NEW BEST GRADE' : ''}`, W / 2, inner.y + 60, { font: 'small', color: PAL.goldDark, align: 'center' });
}

// ---------------------------------------------------------------- in a mission
// The objective line where the wave counter usually sits, with a progress strip.
export function drawObjective(g, sim, t) {
  const M = sim.mission;
  text(g, String(sim.totalScore).padStart(7, '0'), 5, 5, { font: 'big', color: PAL.gold, outline: PAL.ink });
  text(g, `MISSION ${M.def.id}`, W - 5, 5, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'right' });
  text(g, M.def.name.toUpperCase(), W - 5, 14, { font: 'small', color: PAL.pinkLight, outline: PAL.ink, align: 'right' });
  if (sim.lv.phase === 'outro') {
    text(g, 'MISSION COMPLETE!', W / 2, 5, { font: 'big', color: PARTY[Math.floor(t * 8) % PARTY.length], outline: PAL.ink, align: 'center' });
    return;
  }
  if (!M.step) return;
  // Fresh objectives blink for a moment so you notice them change.
  const fresh = (M.stepT || 0) < 1.5;
  const lines = wrap(M.text, 236);
  lines.forEach((l, i) => text(g, l, W / 2, 5 + i * 9, { font: 'small', color: fresh && Math.floor(t * 8) % 2 ? PAL.white : PAL.cream, outline: PAL.ink, align: 'center' }));
  const p = M.progress();
  if (p) {
    const y = 5 + lines.length * 9;
    text(g, p.label, W / 2, y, { font: 'small', color: p.warn ? (Math.floor(t * 4) % 2 ? PAL.red : PAL.gold) : PAL.cyan, outline: PAL.ink, align: 'center' });
    rect(g, W / 2 - 40, y + 9, 80, 3, PAL.ink);
    rect(g, W / 2 - 39, y + 10, Math.round(78 * Math.max(0, Math.min(1, p.frac))), 1, p.warn ? PAL.red : PAL.gold);
  }
}

// Mission banners: the opening card and "objective complete".
export function drawMissionBanner(g, sim, t) {
  const b = sim.banner;
  if (!b || !sim.mission) return;
  const age = b.dur - b.t;
  if (b.kind === 'mission') {
    if (b.done) return;
    const M = sim.mission.def;
    const w = 220;
    const x = Math.round(W / 2 - w / 2);
    const inner = window98(g, x, 50, w, 44, `MISSION ${M.id}`);
    iconInfo(g, inner.x + 4, inner.y + 3);
    text(g, M.name.toUpperCase(), inner.x + 22, inner.y + 3, { font: 'big', color: PAL.winNavy });
    text(g, `11:${M.minute} PM  ${sim.map.name.toUpperCase()}`, inner.x + 22, inner.y + 14, { font: 'small', color: PAL.ink });
  } else if (b.kind === 'objective') {
    g.globalAlpha = Math.min(1, b.t / 0.4);
    const s = age < 0.1 ? 3 : 2;
    text(g, 'OBJECTIVE COMPLETE', W / 2, 60, { font: 'big', scale: s, color: PARTY[Math.floor(t * 10) % PARTY.length], outline: PAL.ink, align: 'center' });
    g.globalAlpha = 1;
  }
}

// Chat pop-ups in the top-left while you play: AIM windows, pager messages, the crew talking.
export function drawChat(g, sim, S, t) {
  const c = sim.mission?.chatNow;
  if (!c) return;
  const L = c.line;
  const age = c.dur - c.t;
  // Slides in from the left and out again.
  const slide = Math.min(1, age / 0.18, c.t / 0.25);
  const w = 176;
  const x = Math.round(-w + (w + 4) * slide);
  // Sits in the bottom-left corner, above the XP bar, clear of the crew list and the boss bar.
  const bottom = H - TASKBAR_H - 16;
  // Sized from the whole line so the box doesn't grow while it types.
  const body = L.text.slice(0, Math.floor(age * TYPE_CPS * 1.4));
  if (L.k === 'aim') {
    const h = 34 + wrap(L.text, w - 14).length * 9;
    return drawAim(g, t, L.from, body, x, bottom - h, w);
  }
  if (L.k === 'pager') {
    const h = 12 + wrap(L.text.toUpperCase(), w - 12).length * 9;
    const y = bottom - h;
    rect(g, x, y, w, h, '#2a2a34');
    rect(g, x + 3, y + 3, w - 6, h - 6, '#9cc070');
    wrap(body.toUpperCase(), w - 12).forEach((l, i) => text(g, l, x + 6, y + 6 + i * 9, { font: 'small', color: '#1a2a12' }));
    return;
  }
  if (L.k === 'news') {
    const h = 14 + wrap(L.text, w - 10).length * 9;
    const y = bottom - h;
    rect(g, x, y, w, h, '#000000cc');
    rect(g, x, y, 50, 9, PAL.red);
    text(g, 'NEWS 4', x + 3, y + 1, { font: 'small', color: PAL.white });
    wrap(body, w - 10).forEach((l, i) => text(g, l, x + 4, y + 11 + i * 9, { font: 'small', color: PAL.cream }));
    return;
  }
  // A hero: a small portrait and a speech box.
  const i = heroIdx(L.who);
  const lines = wrap(body, w - 44);
  const h = Math.max(38, 16 + wrap(L.text, w - 44).length * 9);
  const y = bottom - h;
  bevel(g, x, y, w, h);
  bevel(g, x + 3, y + 3, 34, 34, true, FLAVOURS[i].dark);
  g.drawImage(S.portraits[i].c, x + 4, y + 4, 32, 32);
  text(g, HEROES[i].name, x + 41, y + 3, { font: 'small', color: FLAVOURS[i].dark });
  lines.forEach((l, k) => text(g, l, x + 41, y + 12 + k * 9, { font: 'small', color: PAL.ink }));
}

// Markers over the things to do: a bouncing diamond on screen, or an arrow at the edge.
export function drawTargets(g, marks, t) {
  const col = Math.floor(t * 5) % 2 ? PAL.cyan : PAL.white;
  for (const m of marks) {
    if (m.sx != null) {
      const x = Math.round(m.sx);
      const y = Math.round(m.sy - 8 - Math.abs(Math.sin(t * 4)) * 3);
      for (let k = 0; k < 5; k++) rect(g, x - k, y - 5 + k, k * 2 + 1, 1, PAL.ink);
      for (let k = 0; k < 5; k++) rect(g, x - (4 - k), y + k, (4 - k) * 2 + 1, 1, PAL.ink);
      for (let k = 1; k < 4; k++) rect(g, x - k + 1, y - 4 + k, k * 2 - 1, 1, col);
      for (let k = 0; k < 3; k++) rect(g, x - (2 - k), y + k, (2 - k) * 2 + 1, 1, col);
      if (m.d > 3) text(g, `${Math.round(m.d)}m`, x, y + 7, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
    } else {
      const cx = W / 2;
      const cy = (H - TASKBAR_H) / 2;
      const px = cx + Math.sin(m.rel) * (W / 2 - 14);
      const py = cy - Math.cos(m.rel) * ((H - TASKBAR_H) / 2 - 14);
      g.save();
      g.translate(Math.round(px), Math.round(py));
      g.rotate(m.rel);
      g.fillStyle = PAL.ink;
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(7, 4);
      g.lineTo(-7, 4);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 3);
      g.lineTo(-5, 3);
      g.fill();
      g.restore();
    }
  }
}

// "HOLD E: FIX FUSE BOX" under the crosshair, with the progress bar filling while you hold it.
export function drawUsePrompt(g, sim, t, input) {
  const M = sim.mission;
  const s = M?.stationHere();
  if (!s || s.code) return;
  const key = input.touch.on ? 'STAND STILL' : input.pad.on ? 'HOLD LT' : 'HOLD E';
  const label = `${key}: ${verbFor(s.kind)}`;
  const w = Math.max(96, textWidth(label, 'small') + 12);
  const x = Math.round(W / 2 - w / 2);
  const y = 128;
  rect(g, x, y, w, 17, '#000000aa');
  text(g, label, W / 2, y + 2, { font: 'small', color: STATIONS[s.kind].col, align: 'center' });
  rect(g, x + 4, y + 11, w - 8, 3, PAL.winDark);
  rect(g, x + 4, y + 11, Math.round((w - 8) * s.prog), 3, STATIONS[s.kind].col);
}

const verbFor = (kind) => ({ fusebox: 'FIX FUSE BOX', payphone: 'DIAL THE THEATER', junction: 'CUT THE POWER' })[kind] || 'USE';

// The bag-check keypad: four digit slots, a keypad you can click or tap, number keys work too.
export function drawKeypad(g, ui, sim, t) {
  const M = sim.mission;
  if (!M?.keypad) return;
  const w = 112;
  const x = W - w - 8;
  const y = 30;
  const inner = window98(g, x, y, w, 132, 'BAG CHECK');
  bevel(g, inner.x + 2, inner.y + 2, inner.w - 4, 16, true, M.alarmT > 0 ? '#5a1010' : '#1a3a1a');
  for (let k = 0; k < 4; k++) {
    const d = M.entry[k];
    const ch = M.alarmT > 0 ? 'X' : d != null ? String(d) : k === M.entry.length && Math.floor(t * 3) % 2 ? '_' : '-';
    text(g, ch, inner.x + 18 + k * 18, inner.y + 6, { font: 'big', color: M.alarmT > 0 ? PAL.red : PAL.lime, align: 'center' });
  }
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, null];
  keys.forEach((d, k) => {
    if (d == null) return;
    const b = { x: inner.x + 6 + (k % 3) * 32, y: inner.y + 22 + Math.floor(k / 3) * 22, w: 28, h: 19 };
    const sel = ui.game.input.pad.on && ui.game.keypadCursor === d;
    button(g, b.x, b.y, b.w, b.h, String(d), { font: 'big', focus: sel });
    ui.addButton(b, () => M.enterDigit(d), 60 + d);
  });
  const hint = ui.game.input.pad.on ? 'DPAD pick  LT press' : ui.game.input.touch.on ? 'TAP THE DIGITS' : 'TYPE THE 4 DIGITS';
  text(g, hint, W - w / 2 - 8, y + 136, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
}

// The ticker on One Times Square, running along above the taskbar during the code step.
export function drawTicker(g, sim, t) {
  const tk = sim.mission?.ticker;
  if (!tk) return;
  const y = H - TASKBAR_H - 13;
  rect(g, 0, y, W, 12, '#0a0a0a');
  rect(g, 0, y, W, 1, PAL.gold);
  rect(g, 0, y, 58, 12, PAL.goldDark);
  text(g, 'ZIPPER', 5, y + 3, { font: 'small', color: PAL.ink });
  const full = tk + '   +++   ';
  const tw = textWidth(full, 'small');
  const off = Math.floor((t * 34) % tw);
  g.save();
  g.beginPath();
  g.rect(60, y, W - 60, 12);
  g.clip();
  for (let k = -1; k < 2; k++) text(g, full, 60 - off + k * tw, y + 3, { font: 'small', color: PAL.gold });
  g.restore();
}
