// Crisp pixel text. Canvas text is anti-aliased, so each string is rendered once off-screen,
// thresholded to hard pixels, cached, then blitted. Two fonts, both on an 8px grid:
//   'big'   Press Start 2P (headings, numbers)
//   'small' Silkscreen (body copy, fits ~64 characters across the screen)
const FONTS = {
  big: { css: '"Press Start 2P"', size: 8, base: 7 },
  small: { css: 'Silkscreen', size: 8, base: 6 },
};

const cache = new Map();

function render(text, font, color, scale) {
  const f = FONTS[font];
  const size = f.size * scale;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${size}px ${f.css}`;
  const w = Math.max(1, Math.ceil(probe.measureText(text).width) + 2);
  const h = size + 4 * scale;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.font = `${size}px ${f.css}`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#fff';
  g.fillText(text, 0, f.base * scale + scale);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const n = parseInt(color.slice(1), 16);
  const r = (n >> 16) & 255;
  const gg = (n >> 8) & 255;
  const b = n & 255;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] > 110;
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = on ? 255 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function textCanvas(text, font = 'small', color = '#ffffff', scale = 1) {
  const key = font + '|' + color + '|' + scale + '|' + text;
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 900) cache.clear();
    c = render(String(text), font, color, scale);
    cache.set(key, c);
  }
  return c;
}

export function textWidth(text, font = 'small', scale = 1) {
  return textCanvas(text, font, '#ffffff', scale).width - 2;
}

// Draw text with its top-left (or centre/right edge, by align) at x,y.
export function text(ctx, str, x, y, o = {}) {
  const font = o.font || 'small';
  const scale = o.scale || 1;
  const c = textCanvas(str, font, o.color || '#ffffff', scale);
  let dx = Math.round(x);
  const w = c.width - 2;
  if (o.align === 'center') dx = Math.round(x - w / 2);
  else if (o.align === 'right') dx = Math.round(x - w);
  const dy = Math.round(y) - scale;
  if (o.shadow) ctx.drawImage(textCanvas(str, font, o.shadow, scale), dx + scale, dy + scale);
  if (o.outline) {
    const oc = textCanvas(str, font, o.outline, scale);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) ctx.drawImage(oc, dx + ox, dy + oy);
  }
  ctx.drawImage(c, dx, dy);
  return w;
}

// Word-wrap into lines no wider than maxW pixels.
export function wrap(str, maxW, font = 'small') {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (line && textWidth(t, font) > maxW) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}
