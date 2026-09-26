// A tiny pixel-art toolkit: every sprite and texture in the game is drawn with these,
// pixel by pixel, from the palette. No image files.
import { rgb } from '../core/palette.js';

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.c = document.createElement('canvas');
    this.c.width = w;
    this.c.height = h;
    this.g = this.c.getContext('2d', { willReadFrequently: true });
    this.g.imageSmoothingEnabled = false;
  }

  rect(x, y, w, h, col) {
    if (w <= 0 || h <= 0) return this;
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  px(x, y, col) {
    return this.rect(x, y, 1, 1, col);
  }

  clear(x = 0, y = 0, w = this.w, h = this.h) {
    this.g.clearRect(x, y, w, h);
    return this;
  }

  fill(col) {
    return this.rect(0, 0, this.w, this.h, col);
  }

  // Box with a light top-left edge and a dark bottom-right edge.
  bevel(x, y, w, h, base, light, dark) {
    this.rect(x, y, w, h, base);
    this.rect(x, y, w, 1, light);
    this.rect(x, y, 1, h, light);
    this.rect(x, y + h - 1, w, 1, dark);
    this.rect(x + w - 1, y, 1, h, dark);
    return this;
  }

  // Filled ellipse on the pixel grid.
  oval(cx, cy, rx, ry, col) {
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5));
      if (t < 0) continue;
      const hw = Math.round(rx * Math.sqrt(t) + 0.15);
      this.rect(cx - hw, cy + y, hw * 2 + 1, 1, col);
    }
    return this;
  }

  line(x0, y0, x1, y1, col) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  // Scatter single pixels over a region (grime, stars, speckle).
  speckle(x, y, w, h, col, density, rnd = Math.random) {
    const n = Math.round(w * h * density);
    for (let i = 0; i < n; i++) this.px(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h), col);
    return this;
  }

  // 2x2 ordered dither between the current fill and col (for 16-bit style gradients).
  dither(x, y, w, h, col, phase = 0) {
    this.g.fillStyle = col;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) if ((xx + yy + phase) % 2 === 0) this.g.fillRect(x + xx, y + yy, 1, 1);
    }
    return this;
  }

  // Vertical gradient quantised to bands with a dithered seam between each band.
  bands(x, y, w, h, cols) {
    const n = cols.length;
    for (let yy = 0; yy < h; yy++) {
      const f = (yy / h) * (n - 1);
      const i = Math.floor(f);
      const t = f - i;
      const a = cols[i];
      const b = cols[Math.min(n - 1, i + 1)];
      this.rect(x, y + yy, w, 1, a);
      if (t > 0.5) {
        this.g.fillStyle = b;
        for (let xx = (yy % 2); xx < w; xx += 2) this.g.fillRect(x + xx, y + yy, 1, 1);
      }
      if (t > 0.8) this.rect(x, y + yy, w, 1, b);
    }
    return this;
  }

  // 1px outline around every opaque pixel (the thing that makes sprites read as pixel art).
  outline(col, diagonal = false) {
    const { w, h } = this;
    const img = this.g.getImageData(0, 0, w, h);
    const d = img.data;
    const [r, g, b] = rgb(col);
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    const dirs = diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        let edge = false;
        for (const [ox, oy] of dirs) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && solid[ny * w + nx]) {
            edge = true;
            break;
          }
        }
        if (edge) {
          d[i * 4] = r;
          d[i * 4 + 1] = g;
          d[i * 4 + 2] = b;
          d[i * 4 + 3] = 255;
        }
      }
    }
    this.g.putImageData(img, 0, 0);
    return this;
  }

  // Copy of this sprite in one flat colour (hit flash, silhouettes, shadows).
  silhouette(col) {
    const out = new Pix(this.w, this.h);
    out.g.drawImage(this.c, 0, 0);
    out.g.globalCompositeOperation = 'source-in';
    out.rect(0, 0, this.w, this.h, col);
    out.g.globalCompositeOperation = 'source-over';
    return out;
  }

  draw(src, x, y, w, h) {
    const s = src.c || src;
    if (w == null) this.g.drawImage(s, Math.round(x), Math.round(y));
    else this.g.drawImage(s, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  mirror() {
    const out = new Pix(this.w, this.h);
    out.g.translate(this.w, 0);
    out.g.scale(-1, 1);
    out.g.drawImage(this.c, 0, 0);
    return out;
  }
}

// Draw a string with the 3x5 micro font (for text painted into textures: signs, labels, screens).
const MICRO = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', ':': '000010000010000', '.': '000000000000010', '-': '000000111000000', '!': '010010010000010',
  '?': '110001010000010', "'": '010010000000000', '/': '001001010100100', '$': '011110010011110', '%': '101001010100101',
  '+': '000010111010000', '#': '101111101111101', '(': '010100100100010', ')': '010001001001010', ',': '000000000010100',
  '&': '010101010101011', '@': '010101111100011', '*': '101010101000000', '=': '000111000111000', ' ': '000000000000000',
};

export function micro(p, str, x, y, col, scale = 1) {
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const m = MICRO[ch] || MICRO['?'];
    for (let i = 0; i < 15; i++) if (m[i] === '1') p.rect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale, col);
    cx += 4 * scale;
  }
  return cx - x;
}

export function microWidth(str, scale = 1) {
  return String(str).length * 4 * scale - scale;
}

// Seven-segment digits (jumbotron clocks, the Millennium Bug's display).
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
export function sevenSeg(p, str, x, y, s, on, off) {
  let cx = x;
  const w = s * 3;
  const h = s * 5;
  for (const ch of String(str)) {
    if (ch === ':') {
      p.rect(cx, y + s, s, s, on);
      p.rect(cx, y + h - s * 2, s, s, on);
      cx += s * 2;
      continue;
    }
    const segs = SEG[ch] ?? '';
    const bars = {
      a: [s, 0, w - 2 * s + s, s], b: [w, s, s, (h - s) / 2 - s / 2], c: [w, h / 2 + s / 2, s, (h - s) / 2 - s / 2],
      d: [s, h, w - s, s], e: [0, h / 2 + s / 2, s, (h - s) / 2 - s / 2], f: [0, s, s, (h - s) / 2 - s / 2], g: [s, h / 2, w - s, s],
    };
    for (const k in bars) {
      const [bx, by, bw, bh] = bars[k];
      const col = segs.includes(k) ? on : off;
      if (col) p.rect(cx + bx, y + by, bw, bh, col);
    }
    cx += w + s * 3;
  }
  return cx - x;
}
