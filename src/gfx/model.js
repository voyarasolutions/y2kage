// A tiny pixel modeller for the first-person weapons. Parts are tubes, boxes and discs laid along one
// screen-space axis (the far end up toward the crosshair, the near end toward you) and shaded per pixel
// with a five-tone ramp, so a weapon reads as a solid object seen from a three-quarter angle.
import { Pix } from './pix.js';
import { ramp } from './heroart.js';

const RGB = new Map();
const hexRgb = (c) => {
  let v = RGB.get(c);
  if (!v) {
    const n = parseInt(c.slice(1, 7), 16);
    RGB.set(c, (v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]));
  }
  return v;
};

// How far across a part (-1 top edge, +1 underside) each tone runs.
export const SHADE = {
  tube: [[-0.72, 'light'], [-0.46, 'hi'], [-0.12, 'light'], [0.42, 'base'], [0.8, 'dark'], [1, 'deep']],
  box: [[-0.86, 'hi'], [-0.2, 'light'], [0.68, 'base'], [0.9, 'dark'], [1, 'deep']],
  chrome: [[-0.74, 'light'], [-0.5, 'hi'], [-0.22, 'base'], [0.08, 'dark'], [0.36, 'light'], [0.78, 'base'], [1, 'deep']],
  glass: [[-0.8, 'light'], [-0.55, 'hi'], [-0.35, 'light'], [0.75, 'base'], [1, 'dark']],
};
const DARKER = { hi: 'light', light: 'base', base: 'dark', dark: 'deep', deep: 'deep' };

function tone(bands, v) {
  for (const [t, k] of bands) if (v <= t) return k;
  return bands[bands.length - 1][1];
}

// Read a Pix once so parts can use it as a decal.
export function texture(p) {
  return { w: p.w, h: p.h, d: p.g.getImageData(0, 0, p.w, p.h).data };
}

export class Rig {
  // a: the far end, b: the near end, in sprite pixels. kFar: how much smaller things draw at the far end.
  constructor(w, h, a, b, kFar = 0.5) {
    this.w = w;
    this.h = h;
    this.a = a;
    this.kFar = kFar;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    this.len = Math.hypot(dx, dy);
    this.u = { x: dx / this.len, y: dy / this.len };
    // Offsets point to the underside of the weapon (down and to the left on screen).
    this.n = { x: -this.u.y, y: this.u.x };
    this.parts = [];
  }

  k(s) {
    return this.kFar + (1 - this.kFar) * s;
  }

  // Screen point at axis position s, pushed o pixels (at near scale) toward the underside.
  at(s, o = 0) {
    const k = this.k(s);
    return { x: this.a.x + this.u.x * this.len * s + this.n.x * o * k, y: this.a.y + this.u.y * this.len * s + this.n.y * o * k };
  }

  // Screen-space pixels for a slide of ds along the axis (the Soaker's pump).
  slide(ds) {
    return { x: this.u.x * this.len * ds, y: this.u.y * this.len * ds };
  }

  add(type, s0, s1, o, r0, r1, col, opt) {
    const rp = typeof col === 'string' ? ramp(col) : col;
    const rgbRamp = {};
    for (const k of ['deep', 'dark', 'base', 'light', 'hi']) rgbRamp[k] = hexRgb(rp[k]);
    this.parts.push({ ...opt, type, s0, s1, o, r0, r1: r1 ?? r0, ramp: rgbRamp, shade: SHADE[opt?.shade || (type === 'box' ? 'box' : 'tube')] });
    return this;
  }

  // A round tube from s0 to s1, radius r0 tapering to r1. opt.round caps the ends.
  tube(s0, s1, o, r0, r1, col, opt = {}) {
    return this.add('tube', s0, s1, o, r0, r1, col, opt);
  }

  // A flat-topped slab: a lit top face and a side face.
  box(s0, s1, o, r0, r1, col, opt = {}) {
    return this.add('box', s0, s1, o, r0, r1, col, opt);
  }

  // A round face turned toward you (a cap, a dial, a lens), squashed along the axis by opt.flat.
  disc(s, o, r, col, opt = {}) {
    return this.add('disc', s, s, o, r, r, col, { flat: 0.4, ...opt });
  }

  // Which part covers a pixel, and where on it: returns [part, v, t] or null.
  hit(x, y, from = this.parts.length - 1) {
    const rx = x + 0.5 - this.a.x;
    const ry = y + 0.5 - this.a.y;
    const s = (rx * this.u.x + ry * this.u.y) / this.len;
    const d = rx * this.n.x + ry * this.n.y;
    for (let i = from; i >= 0; i--) {
      const q = this.parts[i];
      const k = this.k(s);
      const c = q.o * k;
      if (q.type === 'disc') {
        const r = q.r0 * k;
        const ds = ((s - q.s0) * this.len) / (r * q.flat);
        const v = (d - c) / r;
        const e = ds * ds + v * v;
        if (e <= 1) return [q, v, Math.sqrt(e), i];
        continue;
      }
      const span = q.s1 - q.s0;
      let t = (s - q.s0) / span;
      const r = (q.r0 + (q.r1 - q.r0) * Math.max(0, Math.min(1, t))) * k;
      const v = (d - c) / r;
      if (v < -1 || v > 1) continue;
      if (t >= 0 && t <= 1) return [q, v, t, i];
      if (q.round) {
        // Rounded ends: an ellipse half as long as the part is thick.
        const over = (t < 0 ? -t : t - 1) * span * this.len;
        const cap = r * (q.cap ?? 0.45);
        if ((over / cap) ** 2 + v * v <= 1) return [q, v, t < 0 ? 0 : 1, i, true];
      }
    }
    return null;
  }

  // Paint every part into a Pix (new or given), with a dark rim where a part sits in front of another.
  render(p = new Pix(this.w, this.h)) {
    const img = p.g.getImageData(0, 0, p.w, p.h);
    const D = img.data;
    const id = new Int16Array(p.w * p.h).fill(-1);
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const h = this.hit(x, y);
        if (!h) continue;
        const [q, v, t, i, capped] = h;
        let key;
        if (q.type === 'disc') {
          // Rings: rim light on top, dark underneath, a flatter face inside.
          key = t > 0.78 ? (v < 0 ? 'light' : 'dark') : t > 0.62 ? 'deep' : v < -0.25 ? 'light' : 'base';
          if (q.face) key = q.face(t, v) || key;
        } else key = tone(q.shade, v);
        if (capped) key = DARKER[key];
        let rgb = q.ramp[key];
        if (q.stripe) {
          const alt = q.stripe(t, v, key);
          // A stripe gives a flat colour or a whole ramp to shade with instead.
          if (alt) rgb = hexRgb(typeof alt === 'string' ? alt : alt[key]);
        }
        if (q.tex && q.type !== 'disc') {
          const T = q.tex;
          const tu = (t - T.t0) / (T.t1 - T.t0);
          const tv = (v - T.v0) / (T.v1 - T.v0);
          if (tu >= 0 && tu < 1 && tv >= 0 && tv < 1) {
            const k = (Math.floor(tv * T.img.h) * T.img.w + Math.floor(tu * T.img.w)) * 4;
            if (T.img.d[k + 3] > 0) {
              rgb = [T.img.d[k], T.img.d[k + 1], T.img.d[k + 2]];
              // Keep the decal in the shade of the face it is printed on.
              if (key === 'dark' || key === 'deep') rgb = rgb.map((c) => Math.round(c * (key === 'deep' ? 0.55 : 0.75)));
            }
          }
        }
        const o = (y * p.w + x) * 4;
        D[o] = rgb[0];
        D[o + 1] = rgb[1];
        D[o + 2] = rgb[2];
        D[o + 3] = 255;
        id[y * p.w + x] = i;
      }
    }
    // Crisp edges: a front part gets a dark rim against anything behind it.
    for (let y = 1; y < p.h - 1; y++) {
      for (let x = 1; x < p.w - 1; x++) {
        const i = id[y * p.w + x];
        if (i < 0 || this.parts[i].noEdge) continue;
        const nb = [id[(y - 1) * p.w + x], id[(y + 1) * p.w + x], id[y * p.w + x - 1], id[y * p.w + x + 1]];
        if (nb.some((j) => j >= 0 && j < i && !this.parts[j].noEdge)) {
          const o = (y * p.w + x) * 4;
          const c = this.parts[i].ramp.deep;
          D[o] = c[0];
          D[o + 1] = c[1];
          D[o + 2] = c[2];
        }
      }
    }
    p.g.putImageData(img, 0, 0);
    return p;
  }
}

// Map a flat picture onto a parallelogram: o is where the picture's top-left lands, ux/vx its right
// and down edges on screen. Used for the floppies, which tilt rather than run along an axis.
export function skew(p, tex, o, ux, vx) {
  const det = ux.x * vx.y - ux.y * vx.x;
  const xs = [o.x, o.x + ux.x, o.x + vx.x, o.x + ux.x + vx.x];
  const ys = [o.y, o.y + ux.y, o.y + vx.y, o.y + ux.y + vx.y];
  const img = p.g.getImageData(0, 0, p.w, p.h);
  const D = img.data;
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(p.h - 1, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(p.w - 1, Math.ceil(Math.max(...xs))); x++) {
      const rx = x + 0.5 - o.x;
      const ry = y + 0.5 - o.y;
      const a = (rx * vx.y - ry * vx.x) / det;
      const b = (ux.x * ry - ux.y * rx) / det;
      if (a < 0 || a >= 1 || b < 0 || b >= 1) continue;
      const k = (Math.floor(b * tex.h) * tex.w + Math.floor(a * tex.w)) * 4;
      if (tex.d[k + 3] === 0) continue;
      const q = (y * p.w + x) * 4;
      D[q] = tex.d[k];
      D[q + 1] = tex.d[k + 1];
      D[q + 2] = tex.d[k + 2];
      D[q + 3] = 255;
    }
  }
  p.g.putImageData(img, 0, 0);
  return p;
}
