// In-game HUD: a Windows 98 taskbar along the bottom (health, armor, ride and weapon meters, the
// system-tray clock counting down to midnight), dialog-box banners and tray tooltips.
import { comboMult as comboMultOf, BREAK_T } from '../game/sim.js';
import { PAL, PARTY } from '../core/palette.js';
import { W, H } from '../core/util.js';
import { text, textWidth, wrap } from '../core/pixelfont.js';
import { bevel, rect, progress, meter, window98, tooltip, iconError, iconInfo, iconWarn, startFlag } from './win98.js';
import { clockFor, levelConfig } from '../data/levels.js';
import { ENEMIES } from '../data/levels.js';

export const TASKBAR_H = 16;

export function drawCrosshair(g, kind, over, hit = 0, headHit = 0) {
  const cx = W / 2;
  const cy = H / 2;
  // Gold over a head, red over the body.
  const col = over === 'head' ? PAL.gold : over ? PAL.red : kind === 'laser' ? PAL.red : PAL.cream;
  if (hit > 0) {
    // Hitmarker: four diagonal ticks around the crosshair, bigger and gold for a headshot.
    const n = headHit > 0 ? 8 : 6;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      for (let k = 3; k < n; k++) rect(g, cx + sx * k, cy + sy * k, 1, 1, headHit > 0 ? PAL.gold : PAL.white);
    }
  }
  rect(g, cx - 4, cy, 3, 1, PAL.ink);
  rect(g, cx + 2, cy, 3, 1, PAL.ink);
  rect(g, cx, cy - 4, 1, 3, PAL.ink);
  rect(g, cx, cy + 2, 1, 3, PAL.ink);
  rect(g, cx - 3, cy, 2, 1, col);
  rect(g, cx + 2, cy, 2, 1, col);
  rect(g, cx, cy - 3, 1, 2, col);
  rect(g, cx, cy + 2, 1, 2, col);
}

function weaponMeter(g, sim, x, y, S) {
  const P = sim.player;
  const G = sim.hero.gun;
  const M = sim.hero.move;
  g.drawImage(S.icons[G.kind].c, x, y - 1);
  let label = '';
  let frac = 1;
  let col = PAL.cyan;
  if (G.kind === 'soaker') {
    label = 'H2O';
    frac = P.tank / G.tank;
    col = '#4ab8ff';
  } else if (G.kind === 'laser') {
    label = P.overheated ? 'HOT!' : 'HEAT';
    frac = P.heat / 100;
    col = P.overheated ? PAL.red : P.heat > 70 ? PAL.tangerine : PAL.gold;
  } else if (G.kind === 'yoyo') {
    label = 'X2';
    frac = 1 - sim.projs.filter((p) => p.kind === 'yoyo' && p.o === sim.local && !p.orbit).length / 2;
    col = PAL.pink;
  } else if (G.kind === 'floppy') {
    label = 'DISK';
    frac = 1 - Math.max(0, P.fireCd) / G.every;
  } else if (G.kind === 'rocket') {
    label = 'LOAD';
    frac = 1 - Math.max(0, P.fireCd) / G.every;
    col = PAL.strawberry;
  }
  meter(g, x + 17, y + 3, 30, 7, frac, col);
  let rx = x + 52;
  g.drawImage(S.icons[M.type].c, rx, y - 1);
  rx += 17;
  if (M.type === 'scooter') {
    for (let i = 0; i < M.charges; i++) {
      bevel(g, rx + i * 7, y + 2, 6, 9, i >= P.charges, i < P.charges ? PAL.lime : PAL.winFace);
    }
  } else if (M.type === 'board') {
    meter(g, rx, y + 3, 24, 7, 1 - P.boostCd / M.boostCd, PAL.tangerine);
  } else if (M.type === 'slinky') {
    meter(g, rx, y + 3, 24, 7, P.charge, PAL.grape);
  } else if (M.type === 'pogo') {
    meter(g, rx, y + 3, 24, 7, P.onGround ? 1 : Math.max(0, 1 - P.z / 1.2), PAL.strawberry);
  } else {
    meter(g, rx, y + 3, 24, 7, Math.min(1, P.speed / M.max), PAL.bondi);
  }
  return label;
}

export function drawTaskbar(g, sim, S, heroIdx, t) {
  const y = H - TASKBAR_H;
  const P = sim.player;
  rect(g, 0, y, W, TASKBAR_H, PAL.winFace);
  rect(g, 0, y, W, 1, PAL.winLight);
  rect(g, 0, y + 1, W, 1, PAL.white);
  // Start button carries the hero's name.
  bevel(g, 2, y + 3, 52, 12);
  startFlag(g, 5, y + 5);
  text(g, sim.hero.name, 14, y + 6, { font: 'small', color: PAL.ink });
  rect(g, 57, y + 3, 1, 12, PAL.winShadow);
  rect(g, 58, y + 3, 1, 12, PAL.white);
  // Health and armor.
  g.drawImage(S.icons.heart.c, 60, y + 1);
  const hpCol = P.hp > (P.maxHp || 100) / 2 ? PAL.winNavy : P.hp > 25 ? PAL.tangerineDark : PAL.red;
  progress(g, 76, y + 4, 54, 10, Math.min(1, P.hp / (P.maxHp || 100)), hpCol);
  text(g, String(Math.ceil(P.hp)), 133, y + 6, { font: 'small', color: P.hp <= 25 && Math.floor(t * 4) % 2 ? PAL.red : PAL.ink });
  g.drawImage(S.icons.shield.c, 150, y + 1);
  progress(g, 166, y + 4, 34, 10, P.armor / 100, PAL.goldDark);
  weaponMeter(g, sim, 205, y + 3, S);
  // Tray: sunken box with the speaker, overclock chip and the countdown clock.
  const tw = 72;
  const tx = W - tw - 2;
  bevel(g, tx, y + 3, tw, 12, true);
  if (P.overclock > 0 && (P.overclock > 2 || Math.floor(t * 6) % 2)) {
    rect(g, tx + 4, y + 6, 7, 7, '#1a6a3a');
    rect(g, tx + 6, y + 8, 3, 3, PAL.cyan);
  }
  const c = clockFor(sim.levelN);
  // The seconds tick while you fight; a level lasts "one minute" to midnight.
  const secs = Math.min(59, Math.floor(sim.lv.time));
  const colon = Math.floor(t * 2) % 2 ? ':' : ' ';
  text(g, `11${colon}${String(c.m).padStart(2, '0')} PM`, tx + tw - 4, y + 6, { font: 'small', color: PAL.ink, align: 'right' });
  return secs;
}

export function drawTopHud(g, sim, t) {
  const L = sim.lv;
  // Score, chunky and gold.
  text(g, String(sim.totalScore).padStart(7, '0'), 5, 5, { font: 'big', color: PAL.gold, outline: PAL.ink });
  // Wave status.
  const of = sim.endless ? '' : `/${sim.cfg.waves.length}`;
  if (L.phase === 'wave') {
    const s = `WAVE ${L.wave + 1}${of}`;
    const r = `${sim.remaining()} LEFT`;
    text(g, s, W / 2, 5, { font: 'big', color: PAL.cream, outline: PAL.ink, align: 'center' });
    text(g, r, W / 2, 15, { font: 'small', color: PAL.cyan, outline: PAL.ink, align: 'center' });
  } else if (L.phase === 'break') {
    // Live countdown: the level keeps running, grab pickups and reposition.
    const n = Math.max(1, Math.ceil(L.t));
    const pulse = L.t % 1 > 0.8;
    text(g, `NEXT WAVE IN ${n}`, W / 2, 5, { font: 'big', color: n <= 3 ? (pulse ? PAL.white : PAL.gold) : PAL.cream, outline: PAL.ink, align: 'center' });
    text(g, `WAVE ${L.wave + 2}${of} INCOMING${sim.endless && (L.wave + 2) % 5 === 0 ? ': BOSS' : ''}`, W / 2, 15, { font: 'small', color: PAL.pinkLight, outline: PAL.ink, align: 'center' });
    rect(g, W / 2 - 40, 24, 80, 2, PAL.ink);
    rect(g, W / 2 - 40, 24, Math.round(80 * Math.max(0, L.t) / BREAK_T), 2, PAL.gold);
  } else if (L.phase === 'outro') {
    text(g, 'LEVEL CLEAR!', W / 2, 5, { font: 'big', color: PARTY[Math.floor(t * 8) % PARTY.length], outline: PAL.ink, align: 'center' });
  }
  text(g, sim.endless ? 'ENDLESS' : `LVL ${sim.levelN}`, W - 5, 5, { font: 'big', color: PAL.cream, outline: PAL.ink, align: 'right' });
  text(g, sim.map.name.toUpperCase(), W - 5, 15, { font: 'small', color: PAL.pinkLight, outline: PAL.ink, align: 'right' });
}

export function drawBossBar(g, sim, t) {
  const z = sim.boss;
  if (!z) return;
  const w = 180;
  const x = W / 2 - w / 2;
  const y = 26;
  const B = sim.bossDef;
  const inner = window98(g, x, y, w, 38, `Deleting ${B.file}`);
  text(g, B.name, inner.x + 2, inner.y + 1, { font: 'small', color: PAL.ink });
  if (z.hp < z.max * 0.5 && !sim.endless) text(g, 'ENRAGED', inner.x + inner.w - 2, inner.y + 1, { font: 'small', color: Math.floor(t * 4) % 2 ? PAL.red : PAL.strawberryDark, align: 'right' });
  progress(g, inner.x + 2, inner.y + 10, inner.w - 4, 10, 1 - z.hp / z.max, PAL.winNavy);
}

// Centre-screen dialog banners for level start, waves and the boss.
export function drawBanner(g, sim, t) {
  const b = sim.banner;
  if (!b) return;
  const age = b.dur - b.t;
  const pop = Math.min(1, age / 0.12);
  if (pop < 1 && Math.floor(age * 60) % 2) return;
  const cfg = sim.cfg;
  if (b.kind === 'level') {
    const w = 236;
    const lines = wrap(cfg.radio, w - 34);
    const h = 58 + lines.length * 9;
    const x = Math.round(W / 2 - w / 2);
    const y = 44;
    const inner = window98(g, x, y, w, h, sim.endless ? 'Y2KAGE.EXE - Endless mode' : `Y2KAGE.EXE - Level ${sim.levelN} of 50`);
    iconInfo(g, inner.x + 4, inner.y + 3);
    text(g, sim.endless ? `ENDLESS  ${sim.map.name.toUpperCase()}` : `${cfg.clock.label}  ${sim.map.name.toUpperCase()}`, inner.x + 22, inner.y + 3, { font: 'big', color: PAL.winNavy });
    text(g, sim.endless ? `Waves forever. ${sim.bossDef.name} every 5th.` : `${cfg.waves.length} waves. ${cfg.clock.minutesLeft} min to midnight.${cfg.isBoss ? ' BOSS LEVEL.' : ''}`, inner.x + 22, inner.y + 14, { font: 'small', color: cfg.isBoss ? PAL.strawberryDark : PAL.ink });
    rect(g, inner.x + 22, inner.y + 24, inner.w - 26, 1, PAL.winShadow);
    rect(g, inner.x + 22, inner.y + 25, inner.w - 26, 1, PAL.white);
    lines.forEach((l, i) => text(g, l, inner.x + 22, inner.y + 29 + i * 9, { font: 'small', color: PAL.winDark }));
  } else if (b.kind === 'wave') {
    // Slams in, then fades, so it never feels like a pause.
    const L = sim.lv;
    const s = age < 0.1 ? 3 : 2;
    g.globalAlpha = Math.min(1, b.t / 0.5);
    const last = L.wave + 1 === cfg.waves.length;
    text(g, last ? 'FINAL WAVE' : `WAVE ${L.wave + 1}`, W / 2, 56, { font: 'big', color: last ? PAL.red : PAL.cream, outline: PAL.ink, align: 'center', scale: s });
    text(g, `${L.total} zombies inbound`, W / 2, 56 + 8 * s + 4, { font: 'small', color: PAL.cyan, outline: PAL.ink, align: 'center' });
    g.globalAlpha = 1;
  } else if (b.kind === 'cleared' || b.kind === 'final') {
    const s = age < 0.12 ? 3 : 2;
    const y = 52 - Math.round(Math.max(0, 0.25 - age) * 40);
    g.globalAlpha = Math.min(1, b.t / 0.5);
    const title = b.kind === 'final' ? 'ALL WAVES CLEARED!' : `WAVE ${b.wave} CLEARED!`;
    text(g, title, W / 2, y, { font: 'big', color: PARTY[Math.floor(t * 10) % PARTY.length], outline: PAL.ink, align: 'center', scale: s });
    const sub = b.kind === 'final' ? `${cfg.clock.label} SURVIVED   +${b.bonus} BONUS` : `+${b.bonus} WAVE BONUS`;
    text(g, sub, W / 2, y + 8 * s + 4, { font: 'small', color: PAL.gold, outline: PAL.ink, align: 'center' });
    g.globalAlpha = 1;
  } else if (b.kind === 'boss') {
    const w = 210;
    const x = Math.round(W / 2 - w / 2);
    const blink = Math.floor(t * 8) % 2;
    const B = sim.bossDef;
    const inner = window98(g, x, 48, w, 46, `${B.file} - Fatal error`, { active: !!blink });
    iconError(g, inner.x + 4, inner.y + 3);
    text(g, B.short, inner.x + 22, inner.y + 3, { font: 'big', color: PAL.strawberryDark });
    text(g, B.tag, inner.x + 22, inner.y + 14, { font: 'small', color: PAL.ink });
  }
}

export function drawToast(g, sim, touch) {
  const m = sim.toastMsg;
  if (!m) return;
  const w = Math.max(textWidth(m.title, 'big'), textWidth(m.sub, 'small')) + 12;
  // On phones the tray corner belongs to the thumbs, so the balloon moves up top.
  const x = touch ? Math.round(W / 2 - w / 2) : W - w - 6;
  const y = touch ? 30 : H - TASKBAR_H - 30;
  tooltip(g, x, y, w, 24);
  // Balloon tail pointing at the tray.
  if (touch) {
    text(g, m.title, x + 6, y + 4, { font: 'big', color: PAL.ink });
    text(g, m.sub, x + 6, y + 14, { font: 'small', color: PAL.winDark });
    return;
  }
  rect(g, x + w - 20, y + 23, 6, 1, PAL.winTip);
  rect(g, x + w - 18, y + 24, 3, 2, PAL.ink);
  rect(g, x + w - 17, y + 24, 1, 1, PAL.winTip);
  text(g, m.title, x + 6, y + 4, { font: 'big', color: PAL.ink });
  text(g, m.sub, x + 6, y + 14, { font: 'small', color: PAL.winDark });
}

export function drawHurt(g, sim, t) {
  const P = sim.player;
  const low = P.hp < 30 && Math.floor(t * 3) % 2 === 0;
  if (P.hurtT <= 0 && !low) return;
  const a = Math.max(P.hurtT / 0.4, low ? 0.5 : 0);
  g.fillStyle = PAL.red;
  for (let k = 0; k < 10; k++) {
    for (let i = 0; i < 10 - k; i++) {
      if ((i + k) % 2) continue;
      if (Math.random() > a) continue;
      g.fillRect(i * 2, H - TASKBAR_H - 2 - k * 2, 2, 2);
      g.fillRect(W - 2 - i * 2, H - TASKBAR_H - 2 - k * 2, 2, 2);
      g.fillRect(i * 2, k * 2, 2, 2);
      g.fillRect(W - 2 - i * 2, k * 2, 2, 2);
    }
  }
}

// On-screen buttons for phones and tablets.
export const TOUCH = {
  fire: { x: 336, y: 150, r: 22 },
  jump: { x: 292, y: 176, r: 13 },
  boost: { x: 352, y: 106, r: 12 },
  special: { x: 290, y: 132, r: 13 },
  pause: { x: 372, y: 28, r: 9 },
};

export function drawTouch(g, input, hero) {
  if (!input.touch.on) return;
  const ring = (b, label, on) => {
    g.fillStyle = on ? '#ffffff55' : '#ffffff22';
    for (let y = -b.r; y <= b.r; y++) {
      const w = Math.round(Math.sqrt(b.r * b.r - y * y));
      g.fillRect(b.x - w, b.y + y, w * 2, 1);
    }
    text(g, label, b.x, b.y - 3, { font: 'small', color: PAL.white, outline: PAL.ink, align: 'center' });
  };
  ring(TOUCH.fire, 'FIRE', input.touch.fire != null);
  ring(TOUCH.jump, hero.move.type === 'scooter' ? 'DASH' : hero.move.type === 'slinky' ? 'LEAP' : 'JUMP', input.touch.jump != null);
  if (hero.move.type === 'board' || hero.move.type === 'scooter') ring(TOUCH.boost, hero.move.type === 'board' ? 'KICK' : 'DASH', false);
  ring(TOUCH.pause, 'II', false);
  if (input.spReady) ring(TOUCH.special, 'SP!', false);
  if (input.touch.mo) {
    const m = input.touch.mo;
    g.fillStyle = '#ffffff22';
    g.fillRect(m.x - 24, m.y - 1, 48, 2);
    g.fillRect(m.x - 1, m.y - 24, 2, 48);
    const k = input.touch.knob || m;
    g.fillStyle = '#ffffff66';
    g.fillRect(k.x - 6, k.y - 6, 12, 12);
  }
}

export function drawGlitch(g, amt) {
  if (amt <= 0) return;
  const n = Math.floor(6 + amt * 40);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(Math.random() * H);
    const h = 1 + Math.floor(Math.random() * 3);
    const x = Math.floor(Math.random() * W);
    const w = 8 + Math.floor(Math.random() * 60);
    g.fillStyle = [PAL.cyan, PAL.pink, PAL.white, PAL.bsod][i % 4] + (i % 2 ? '99' : 'cc');
    g.fillRect(x, y, w, h);
  }
  if (amt > 0.1) text(g, 'ERR 0x7CF', Math.random() * (W - 60), Math.random() * (H - 30), { font: 'small', color: PAL.white, shadow: PAL.bsod });
}

export { ENEMIES, levelConfig };

// Floating score numbers where zombies fall (positions already projected to the screen).
export function drawPopups(g, pops) {
  for (const p of pops) {
    const a = Math.min(1, p.t / 0.3);
    g.globalAlpha = a;
    text(g, p.text, Math.round(p.sx), Math.round(p.sy), { font: p.big ? 'big' : 'small', color: p.big ? PAL.gold : PAL.cream, outline: PAL.ink, align: 'center' });
  }
  g.globalAlpha = 1;
}

// Combo counter under the level readout, and the big 90s shout-out when you hit a tier.
export function drawCombo(g, sim, t, window) {
  const C = sim.combo;
  if (C.n >= 2 && C.t > 0) {
    const mult = comboMultOf(C.n);
    const x = W - 5;
    text(g, `${C.n} HIT COMBO`, x, 26, { font: 'small', color: PAL.gold, outline: PAL.ink, align: 'right' });
    if (mult > 1) text(g, `x${mult}`, x, 35, { font: 'big', color: PARTY[Math.floor(t * 8) % PARTY.length], outline: PAL.ink, align: 'right' });
    const bw = 44;
    rect(g, x - bw, mult > 1 ? 45 : 35, bw, 2, PAL.ink);
    rect(g, x - bw, mult > 1 ? 45 : 35, Math.round(bw * Math.max(0, C.t / window)), 2, PAL.gold);
  }
  const call = sim.comboCall;
  if (call) {
    const age = 1.6 - call.t;
    const s = age < 0.12 ? 3 : 2;
    const y = 50 - Math.round(Math.max(0, 0.25 - age) * 40);
    g.globalAlpha = Math.min(1, call.t / 0.3);
    text(g, call.text, W / 2, y, { font: 'big', color: PARTY[Math.floor(t * 12) % PARTY.length], outline: PAL.ink, align: 'center', scale: s });
    text(g, `x${call.mult} SCORE`, W / 2, y + 8 * s + 3, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
    g.globalAlpha = 1;
  }
}

// Hero XP bar just above the taskbar, with the level on the left.
export function drawXpBar(g, sim, t) {
  const y = H - TASKBAR_H - 3;
  rect(g, 0, y, W, 3, PAL.ink);
  rect(g, 0, y + 1, Math.round(W * sim.xpProgress()), 1, sim.lvlUp && Math.floor(t * 10) % 2 ? PAL.white : PAL.gold);
  text(g, `LV ${sim.rank}`, 3, y - 9, { font: 'small', color: PAL.gold, outline: PAL.ink });
}

// Active powerups under the score: icon plus a draining bar.
export function drawBuffs(g, sim, S, t) {
  const list = [];
  for (const k of ['patch', 'multi', 'freeze']) if (sim.buffs[k] > 0) list.push([k, sim.buffs[k], { patch: 8, multi: 10, freeze: 7 }[k]]);
  if (sim.player.overclock > 0) list.push(['overclock', sim.player.overclock, 10]);
  list.forEach(([k, left, max], i) => {
    if (left < 2 && Math.floor(t * 8) % 2) return;
    const x = 5 + i * 22;
    const icon = S.buffIcons[k];
    g.drawImage(icon.c, x, 17, 16, Math.round((16 * icon.h) / icon.w));
    rect(g, x, 34, 18, 2, PAL.ink);
    rect(g, x, 34, Math.round(18 * (left / max)), 2, k === 'patch' ? PAL.lime : k === 'freeze' ? PAL.cyan : PAL.tangerine);
  });
}

export function drawLevelUp(g, sim, t) {
  const L = sim.lvlUp;
  if (!L) return;
  const age = 2.2 - L.t;
  g.globalAlpha = Math.min(1, L.t / 0.4);
  const y = 78 - Math.round(Math.max(0, 0.2 - age) * 60);
  text(g, 'LEVEL UP!', W / 2, y, { font: 'big', color: Math.floor(t * 10) % 2 ? PAL.gold : PAL.cream, outline: PAL.ink, align: 'center', scale: 2 });
  text(g, `LV ${L.rank}   DAMAGE +${Math.round((sim.dmgMul - 1) * 100)}%`, W / 2, y + 20, { font: 'small', color: PAL.cyan, outline: PAL.ink, align: 'center' });
  g.globalAlpha = 1;
}

// Powerup overlays: flying toasters for the screensaver, a green frame while patched.
export function drawBuffFx(g, sim, S, t) {
  if (sim.buffs.freeze > 0) {
    g.globalAlpha = Math.min(0.85, sim.buffs.freeze);
    for (let k = 0; k < 6; k++) {
      const p = (t * 0.12 + k / 6) % 1;
      const x = W + 20 - p * (W + 60) + (k % 2) * 30;
      const y = -20 + p * (H * 0.9) + k * 14;
      g.drawImage(S.toasters[Math.floor(t * 6 + k) % 2].c, Math.round(x), Math.round(y));
    }
    g.globalAlpha = 1;
  }
  if (sim.buffs.patch > 0 && (sim.buffs.patch > 2 || Math.floor(t * 8) % 2)) {
    const c = '#7ac94388';
    rect(g, 0, 0, W, 2, c);
    rect(g, 0, H - TASKBAR_H - 2, W, 2, c);
    rect(g, 0, 0, 2, H - TASKBAR_H, c);
    rect(g, W - 2, 0, 2, H - TASKBAR_H, c);
  }
}

// Special meter above the taskbar on the right; flashes its name and key when full.
export function drawSpecial(g, sim, t, touch) {
  const P = sim.player;
  const S = P.hero.special;
  const y = H - TASKBAR_H - 13;
  const w = 64;
  const x = W - w - 4;
  const full = P.sp >= 100;
  const on = !!P.spKind;
  rect(g, x - 1, y - 1, w + 2, 8, PAL.ink);
  rect(g, x, y, w, 6, '#202020');
  const col = on ? PARTY[Math.floor(t * 12) % PARTY.length] : full ? (Math.floor(t * 6) % 2 ? S.color : PAL.white) : S.color;
  rect(g, x, y, Math.round(w * (on ? 1 : P.sp / 100)), 6, col);
  rect(g, x, y, Math.round(w * (on ? 1 : P.sp / 100)), 1, '#ffffff66');
  const label = on ? S.name : full ? `${touch ? 'TAP SP!' : '[R]'} ${S.name}` : 'SPECIAL';
  text(g, label, x + w, y - 9, { font: 'small', color: full || on ? PAL.cream : PAL.pinkLight, outline: PAL.ink, align: 'right' });
}

// The special's name slammed across the middle of the screen.
export function drawSpCall(g, sim, t) {
  const c = sim.player.spCall;
  if (!c) return;
  const age = 1.6 - c.t;
  const s = age < 0.1 ? 3 : 2;
  g.globalAlpha = Math.min(1, c.t / 0.3);
  text(g, c.text, W / 2, 60, { font: 'big', color: Math.floor(t * 12) % 2 ? sim.player.hero.special.color : PAL.white, outline: PAL.ink, align: 'center', scale: s });
  g.globalAlpha = 1;
}

// Co-op: each teammate's face, name and health down the left edge.
export function drawTeam(g, sim, S, t) {
  const others = sim.players.filter((P) => P !== sim.player);
  others.forEach((P, i) => {
    const x = 4;
    const y = 42 + i * 22;
    rect(g, x, y, 20, 20, PAL.ink);
    g.globalAlpha = P.down ? 0.4 : 1;
    g.drawImage(S.portraits[P.heroIdx].c, x + 2, y + 2, 16, 16);
    g.globalAlpha = 1;
    text(g, P.name.slice(0, 10), x + 23, y + 1, { font: 'small', color: P.down ? PAL.red : PAL.cream, outline: PAL.ink });
    rect(g, x + 23, y + 11, 40, 4, PAL.ink);
    rect(g, x + 23, y + 11, Math.round(40 * Math.min(1, Math.max(0, P.hp) / (P.maxHp || 100))), 4, P.hp > 50 ? PAL.lime : P.hp > 25 ? PAL.tangerine : PAL.red);
    rect(g, x + 23, y + 16, Math.round(40 * P.sp / 100), 1, P.sp >= 100 ? PAL.gold : PAL.pink);
    if (P.down) text(g, 'REBOOTING', x + 23, y + 11, { font: 'small', color: PAL.white, outline: PAL.ink });
  });
}

// Floating names over teammates in the world.
export function drawNameTags(g, tags) {
  for (const n of tags) {
    text(g, n.text, Math.round(n.sx), Math.round(n.sy), { font: 'small', color: n.down ? PAL.red : PAL.cyan, outline: PAL.ink, align: 'center' });
  }
}

// You went down in co-op: the screen goes blue until the next wave reboots you.
export function drawDowned(g, sim, t) {
  if (!sim.player.down) return;
  rect(g, 0, 0, W, H - TASKBAR_H, '#0000aa88');
  text(g, 'YOU CRASHED', W / 2, 70, { font: 'big', color: PAL.white, outline: PAL.ink, align: 'center', scale: 2 });
  text(g, 'Your crew has to clear this wave.', W / 2, 96, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
  text(g, 'You reboot when the next one starts.', W / 2, 106, { font: 'small', color: PAL.cream, outline: PAL.ink, align: 'center' });
}

// The last few zombies of a wave: a bobbing marker over each one on screen, an arrow at the edge
// for the ones behind you. `marks` holds { sx, sy } for on-screen ones and { rel } (radians from
// straight ahead, clockwise) for the rest.
export function drawStragglers(g, marks, t) {
  if (!marks.length) return;
  const col = Math.floor(t * 6) % 2 ? PAL.gold : PAL.red;
  for (const m of marks) {
    if (m.sx != null) {
      const y = Math.round(m.sy - 6 - Math.abs(Math.sin(t * 5)) * 3);
      const x = Math.round(m.sx);
      g.fillStyle = PAL.ink;
      g.beginPath();
      g.moveTo(x - 4, y - 5);
      g.lineTo(x + 4, y - 5);
      g.lineTo(x, y + 1);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - 3, y - 4);
      g.lineTo(x + 3, y - 4);
      g.lineTo(x, y);
      g.fill();
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
      g.moveTo(0, -8);
      g.lineTo(6, 3);
      g.lineTo(-6, 3);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4, 2);
      g.lineTo(-4, 2);
      g.fill();
      g.restore();
    }
  }
}
