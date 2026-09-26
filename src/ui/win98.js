// Windows 98-style widgets drawn straight onto the 384x216 UI canvas: bevelled buttons, title bars,
// chunky blue progress bars, tooltips and the taskbar.
import { PAL } from '../core/palette.js';
import { text, textWidth } from '../core/pixelfont.js';

export function rect(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Raised (out) or sunken (in) 3D border, 2px like the real thing.
export function bevel(g, x, y, w, h, sunken = false, face = PAL.winFace) {
  rect(g, x, y, w, h, face);
  const hi = sunken ? PAL.winDark : PAL.white;
  const hi2 = sunken ? PAL.winShadow : PAL.winLight;
  const lo = sunken ? PAL.white : PAL.winDark;
  const lo2 = sunken ? PAL.winLight : PAL.winShadow;
  rect(g, x, y, w, 1, hi);
  rect(g, x, y, 1, h, hi);
  rect(g, x + 1, y + 1, w - 2, 1, hi2);
  rect(g, x + 1, y + 1, 1, h - 2, hi2);
  rect(g, x, y + h - 1, w, 1, lo);
  rect(g, x + w - 1, y, 1, h, lo);
  rect(g, x + 1, y + h - 2, w - 2, 1, lo2);
  rect(g, x + w - 2, y + 1, 1, h - 2, lo2);
}

export function titleBar(g, x, y, w, title, active = true) {
  // Win98 title bars fade from navy to blue; dithered in two bands here.
  rect(g, x, y, w, 10, active ? PAL.winNavy : PAL.winShadow);
  rect(g, x + Math.floor(w * 0.55), y, Math.ceil(w * 0.45), 10, active ? PAL.winBlue : '#a0a0a0');
  for (let yy = 0; yy < 10; yy++) for (let xx = Math.floor(w * 0.45) + (yy % 2); xx < Math.floor(w * 0.55); xx += 2) rect(g, x + xx, y + yy, 1, 1, active ? PAL.winBlue : '#a0a0a0');
  text(g, title, x + 3, y + 2, { font: 'small', color: PAL.white });
  // Close box.
  bevel(g, x + w - 10, y + 1, 9, 8);
  rect(g, x + w - 8, y + 3, 1, 1, PAL.ink);
  rect(g, x + w - 4, y + 3, 1, 1, PAL.ink);
  rect(g, x + w - 7, y + 4, 1, 1, PAL.ink);
  rect(g, x + w - 5, y + 4, 1, 1, PAL.ink);
  rect(g, x + w - 6, y + 5, 1, 1, PAL.ink);
  rect(g, x + w - 7, y + 6, 1, 1, PAL.ink);
  rect(g, x + w - 5, y + 6, 1, 1, PAL.ink);
  rect(g, x + w - 8, y + 7, 1, 1, PAL.ink);
  rect(g, x + w - 4, y + 7, 1, 1, PAL.ink);
}

export function window98(g, x, y, w, h, title, o = {}) {
  if (o.shadow !== false) rect(g, x + 3, y + 3, w, h, '#00000066');
  bevel(g, x, y, w, h);
  titleBar(g, x + 2, y + 2, w - 4, title, o.active !== false);
  return { x: x + 4, y: y + 15, w: w - 8, h: h - 19 };
}

export function button(g, x, y, w, h, label, o = {}) {
  const down = o.down;
  bevel(g, x, y, w, h, down, o.face || PAL.winFace);
  if (o.focus) {
    rect(g, x - 1, y - 1, w + 2, 1, PAL.ink);
    rect(g, x - 1, y + h, w + 2, 1, PAL.ink);
    rect(g, x - 1, y - 1, 1, h + 2, PAL.ink);
    rect(g, x + w, y - 1, 1, h + 2, PAL.ink);
    // Dotted focus ring inside, like the real thing.
    for (let k = 3; k < w - 3; k += 2) {
      rect(g, x + k, y + 3, 1, 1, PAL.winDark);
      rect(g, x + k, y + h - 4, 1, 1, PAL.winDark);
    }
  }
  const tw = textWidth(label, o.font || 'small');
  text(g, label, x + Math.round((w - tw) / 2) + (down ? 1 : 0), y + Math.round((h - 7) / 2) + (down ? 1 : 0), { font: o.font || 'small', color: o.disabled ? PAL.winShadow : o.color || PAL.ink });
}

// The chunky segmented progress bar from file copies and installers.
export function progress(g, x, y, w, h, frac, col = PAL.winNavy, back = PAL.winFace) {
  bevel(g, x, y, w, h, true, back);
  const inner = w - 4;
  const block = Math.max(3, h - 4);
  const n = Math.floor((inner * Math.max(0, Math.min(1, frac))) / (block + 1));
  for (let i = 0; i < n; i++) rect(g, x + 2 + i * (block + 1), y + 2, block, h - 4, col);
  return n;
}

// Smooth bar for small HUD meters.
export function meter(g, x, y, w, h, frac, col, back = '#202020') {
  rect(g, x, y, w, h, PAL.winDark);
  rect(g, x + 1, y + 1, w - 2, h - 2, back);
  rect(g, x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), h - 2, col);
  rect(g, x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), 1, '#ffffff55');
}

export function tooltip(g, x, y, w, h) {
  rect(g, x, y, w, h, PAL.ink);
  rect(g, x + 1, y + 1, w - 2, h - 2, PAL.winTip);
}

// Standard dialog icons.
export function iconError(g, x, y) {
  const r = [[3, 0, 6], [1, 1, 10], [0, 2, 12], [0, 3, 12], [0, 4, 12], [0, 5, 12], [0, 6, 12], [0, 7, 12], [0, 8, 12], [1, 9, 10], [3, 10, 6]];
  for (const [ox, oy, w] of r) rect(g, x + ox, y + oy + 1, w, 1, PAL.red);
  for (let k = 0; k < 5; k++) {
    rect(g, x + 3 + k, y + 3 + k, 2, 1, PAL.white);
    rect(g, x + 7 - k, y + 3 + k, 2, 1, PAL.white);
  }
}

export function iconInfo(g, x, y) {
  const r = [[3, 0, 6], [1, 1, 10], [0, 2, 12], [0, 3, 12], [0, 4, 12], [0, 5, 12], [0, 6, 12], [0, 7, 12], [0, 8, 12], [1, 9, 10], [3, 10, 6]];
  for (const [ox, oy, w] of r) rect(g, x + ox, y + oy + 1, w, 1, PAL.winBlue);
  rect(g, x + 5, y + 3, 2, 2, PAL.white);
  rect(g, x + 5, y + 6, 2, 4, PAL.white);
}

export function iconWarn(g, x, y) {
  for (let k = 0; k < 11; k++) rect(g, x + 6 - Math.floor(k / 2), y + k, 1 + Math.floor(k / 2) * 2, 1, PAL.gold);
  rect(g, x + 5, y + 3, 2, 4, PAL.ink);
  rect(g, x + 5, y + 8, 2, 2, PAL.ink);
}

// The four-colour flag on the Start button, redone as a party flag.
export function startFlag(g, x, y) {
  rect(g, x, y, 3, 3, PAL.strawberry);
  rect(g, x + 4, y, 3, 3, PAL.lime);
  rect(g, x, y + 4, 3, 3, PAL.bondi);
  rect(g, x + 4, y + 4, 3, 3, PAL.gold);
}

export function hit(b, x, y) {
  return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
}
