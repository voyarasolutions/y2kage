// The roster, drawn properly: full-body sprites standing on their rides (select screen),
// shaded portraits, and the colour ramps the first-person hands reuse.
import { Pix, micro } from './pix.js';
import { PAL, FLAVOURS, rgb } from '../core/palette.js';

// ---------------------------------------------------------------- colour ramps
function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Five-step ramp that hue-shifts shadows toward purple and highlights toward cream (the 16-bit way).
export function ramp(base) {
  return {
    deep: mix(base, '#1a1030', 0.62),
    dark: mix(base, '#2b1a4a', 0.34),
    base,
    light: mix(base, '#fff4d6', 0.36),
    hi: mix(base, '#ffffff', 0.66),
  };
}

// Per-hero look. Shared by the full-body sprite, the portrait and the first-person hands.
export const LOOKS = [
  {
    // Tina "Turbo": space buns, windbreaker, bike shorts, rollerblades.
    skin: ramp('#d99a6c'), hair: ramp('#4a2a1a'), top: ramp(FLAVOURS[0].base), trim: PAL.pink,
    bottom: ramp('#2a2440'), shoe: ramp('#e8f4f8'), sleeve: 'windbreaker',
  },
  {
    // Marcus "Ollie": backwards cap, #23 jersey, baggy jeans, skateboard.
    skin: ramp('#8a5a3a'), hair: ramp('#1a1010'), top: ramp(FLAVOURS[1].base), trim: PAL.cream,
    bottom: ramp(PAL.denim), shoe: ramp('#f0f0f0'), sleeve: 'wristband',
  },
  {
    // Dot "Disk": purple bob, glasses, cardigan, plaid skirt, striped stockings.
    skin: ramp('#f0c8a0'), hair: ramp('#7a3fb0'), top: ramp(FLAVOURS[2].base), trim: PAL.cream,
    bottom: ramp('#c83048'), shoe: ramp('#2a2030'), sleeve: 'knit',
  },
  {
    // Gus "Pogo": frosted tips, open flannel, cargo shorts.
    skin: ramp('#c08050'), hair: ramp('#6a4a2a'), top: ramp(FLAVOURS[3].base), trim: PAL.cream,
    bottom: ramp('#b0a070'), shoe: ramp('#e0e0e0'), sleeve: 'flannel',
  },
  {
    // Kev "Laser": bowl cut, headset, lime tracksuit.
    skin: ramp('#e8b890'), hair: ramp('#2a1a10'), top: ramp(FLAVOURS[4].base), trim: PAL.white,
    bottom: ramp(FLAVOURS[4].dark), shoe: ramp('#f4f4f4'), sleeve: 'track',
  },
];

// ---------------------------------------------------------------- full-body sprites
const FW = 44;
const FH = 68;

// A limb or torso column with a light left edge and a dark right edge.
function column(p, x, y, w, h, r) {
  p.rect(x, y, w, h, r.base);
  p.rect(x, y, 1, h, r.light);
  p.rect(x + w - 1, y, 1, h, r.dark);
}

function face(p, cx, cy, L, i) {
  const s = L.skin;
  p.rect(cx - 1, cy + 5, 3, 3, s.dark);
  p.oval(cx, cy, 5, 6, s.base);
  p.oval(cx - 1, cy - 1, 3, 3, s.light);
  p.oval(cx, cy, 4, 5, s.base);
  for (let y = -5; y <= 5; y++) {
    const hw = Math.round(5 * Math.sqrt(Math.max(0, 1 - (y * y) / 36.5)) + 0.15);
    p.px(cx + hw, cy + y, s.dark);
  }
  p.px(cx - 3, cy - 2, s.light).px(cx - 2, cy - 3, s.hi);
  // Eyes, brows, nose, mouth.
  p.rect(cx - 3, cy, 2, 2, PAL.white).rect(cx + 1, cy, 2, 2, PAL.white);
  p.px(cx - 2, cy, PAL.ink).px(cx - 2, cy + 1, PAL.ink).px(cx + 2, cy, PAL.ink).px(cx + 2, cy + 1, PAL.ink);
  p.rect(cx - 3, cy - 2, 2, 1, L.hair.dark).rect(cx + 1, cy - 2, 2, 1, L.hair.dark);
  p.px(cx, cy + 2, s.dark);
  p.rect(cx - 1, cy + 4, 3, 1, s.deep);
  p.px(cx + 2, cy + 3, s.deep);
  p.px(cx - 4, cy + 3, mix(s.base, PAL.pink, 0.35)).px(cx + 3, cy + 3, mix(s.base, PAL.pink, 0.35));
}

function hair(p, cx, cy, L, i) {
  const h = L.hair;
  if (i === 0) {
    // Space buns and a butterfly clip.
    p.oval(cx, cy - 4, 6, 3, h.base).rect(cx - 6, cy - 4, 2, 7, h.base).rect(cx + 5, cy - 4, 2, 6, h.dark);
    p.oval(cx - 6, cy - 7, 3, 3, h.base).oval(cx + 6, cy - 7, 3, 3, h.dark);
    p.px(cx - 7, cy - 8, h.light).px(cx - 6, cy - 9, h.light).px(cx + 5, cy - 9, h.base);
    p.rect(cx - 3, cy - 6, 5, 1, h.light);
    p.px(cx - 4, cy - 3, PAL.pink).px(cx - 3, cy - 4, PAL.cyan).px(cx - 5, cy - 4, PAL.cyan);
  } else if (i === 1) {
    // Backwards cap with the bill sticking out the back-left, headphones round the neck.
    const c = L.top;
    p.oval(cx, cy - 4, 6, 3, c.base).rect(cx - 6, cy - 4, 13, 2, c.base);
    p.rect(cx - 5, cy - 6, 5, 1, c.light).px(cx + 5, cy - 4, c.dark).px(cx + 6, cy - 3, c.dark);
    p.rect(cx - 9, cy - 3, 4, 2, c.dark).rect(cx - 9, cy - 3, 4, 1, c.base);
    p.rect(cx - 2, cy - 3, 4, 1, c.deep).px(cx, cy - 7, c.hi);
    p.rect(cx - 6, cy - 2, 1, 3, h.base).rect(cx + 5, cy - 2, 1, 3, h.base);
    p.rect(cx - 5, cy + 7, 11, 1, '#2a2a30').rect(cx - 6, cy + 5, 2, 3, '#3a3a44').rect(cx + 5, cy + 5, 2, 3, '#3a3a44');
    p.px(cx - 6, cy + 5, PAL.tangerine).px(cx + 6, cy + 5, PAL.tangerine);
  } else if (i === 2) {
    // A blunt purple bob and round glasses.
    p.oval(cx, cy - 3, 7, 5, h.base).rect(cx - 7, cy - 3, 3, 9, h.base).rect(cx + 5, cy - 3, 3, 9, h.dark);
    p.rect(cx - 5, cy - 4, 10, 2, h.base).rect(cx - 4, cy - 7, 6, 1, h.light).px(cx - 5, cy - 6, h.light);
    p.rect(cx - 7, cy + 5, 3, 1, h.dark).rect(cx + 5, cy + 5, 3, 1, h.deep);
    p.rect(cx - 4, cy - 1, 4, 4, PAL.ink).rect(cx + 1, cy - 1, 4, 4, PAL.ink).rect(cx, cy, 1, 1, PAL.ink);
    p.rect(cx - 3, cy, 2, 2, '#9fe8f8').rect(cx + 2, cy, 2, 2, '#9fe8f8');
    p.px(cx - 3, cy, PAL.white).px(cx + 2, cy, PAL.white);
  } else if (i === 3) {
    // Frosted tips, spiked up.
    p.oval(cx, cy - 4, 6, 3, h.base).rect(cx - 6, cy - 4, 2, 4, h.base).rect(cx + 5, cy - 4, 2, 3, h.dark);
    for (let k = -5; k <= 5; k += 2) {
      const tip = 3 + ((k + 7) % 4 === 0 ? 1 : 0);
      p.rect(cx + k, cy - 6 - tip, 2, tip + 1, h.base);
      p.px(cx + k, cy - 6 - tip, '#f6e8b0').px(cx + k + 1, cy - 6 - tip, '#f6e0a0').px(cx + k, cy - 5 - tip, '#e8cc80');
    }
    p.px(cx - 3, cy - 5, h.light);
  } else {
    // Bowl cut and a headset mic.
    p.oval(cx, cy - 3, 6, 4, h.base).rect(cx - 6, cy - 3, 13, 3, h.base);
    p.rect(cx - 5, cy - 1, 11, 1, h.dark).rect(cx - 4, cy - 6, 6, 1, h.light).px(cx - 5, cy - 5, h.light);
    p.rect(cx - 7, cy - 1, 2, 4, '#2a2a30').px(cx - 7, cy - 1, '#5a5a66');
    p.line(cx - 6, cy + 3, cx - 2, cy + 5, '#2a2a30').px(cx - 1, cy + 5, PAL.red);
  }
}

// Torso details: jersey number, cardigan, open flannel, track stripes, windbreaker chevron.
function shirt(p, cx, y0, y1, L, i) {
  const t = L.top;
  const x0 = cx - 6;
  const w = 13;
  if (i === 0) {
    // Windbreaker: colour-block chevron, zip.
    column(p, x0, y0, w, y1 - y0, t);
    p.line(x0, y0 + 6, cx, y0 + 10, PAL.pink).line(cx, y0 + 10, x0 + w - 1, y0 + 6, PAL.pink);
    p.line(x0, y0 + 7, cx, y0 + 11, PAL.white).line(cx, y0 + 11, x0 + w - 1, y0 + 7, PAL.white);
    p.rect(cx, y0 + 1, 1, y1 - y0 - 2, t.light);
    p.rect(x0 + 1, y1 - 2, w - 2, 2, t.dark);
    p.rect(cx - 2, y0, 5, 2, t.light).px(cx, y0 + 2, PAL.steelLight);
  } else if (i === 1) {
    // Oversized basketball jersey over a white tee.
    column(p, x0 - 1, y0, w + 2, y1 - y0 + 2, t);
    p.rect(cx - 2, y0, 5, 2, PAL.white).px(cx, y0 + 2, PAL.white);
    micro(p, '23', cx - 3, y0 + 5, PAL.cream);
    p.rect(cx - 3, y0 + 10, 7, 1, t.dark);
    p.rect(x0 - 1, y0, 1, y1 - y0 + 2, PAL.cream).rect(x0 + w, y0, 1, y1 - y0 + 2, t.deep);
  } else if (i === 2) {
    // Cardigan over a white tee, buttons down the front.
    column(p, x0, y0, w, y1 - y0, t);
    p.rect(cx - 2, y0, 5, y1 - y0 - 1, '#f4f0ff').rect(cx + 2, y0, 1, y1 - y0 - 1, '#c8c0e0');
    for (let y = y0 + 2; y < y1 - 1; y += 3) p.px(cx - 3, y, PAL.gold);
    p.rect(x0, y1 - 2, w, 2, t.dark);
    for (let x = x0 + 1; x < x0 + w; x += 2) p.px(x, y1 - 1, t.light);
  } else if (i === 3) {
    // Open plaid flannel over a white tee.
    column(p, x0, y0, w, y1 - y0, t);
    for (let y = y0; y < y1; y++) {
      for (let x = x0 + 1; x < x0 + w - 1; x++) {
        if ((x - x0) % 4 === 1 || (y - y0) % 4 === 2) p.px(x, y, t.dark);
        if ((x - x0) % 4 === 1 && (y - y0) % 4 === 2) p.px(x, y, t.deep);
      }
    }
    p.rect(cx - 2, y0, 5, y1 - y0, '#f4f4f4').rect(cx + 2, y0, 1, y1 - y0, '#c8c8d0');
    p.px(cx - 1, y0 + 4, PAL.tangerine).px(cx, y0 + 4, PAL.gold).px(cx + 1, y0 + 4, PAL.tangerine);
  } else {
    // Track jacket: white double stripes down the sleeves and a zip.
    column(p, x0, y0, w, y1 - y0, t);
    p.rect(cx, y0, 1, y1 - y0, PAL.steelLight);
    p.rect(cx - 2, y0, 5, 2, t.light);
    p.rect(x0 + 1, y1 - 2, w - 2, 2, t.dark);
  }
}

function armsAndHands(p, cx, y0, L, i, f) {
  const t = L.top;
  const s = L.skin;
  const sw = f % 2;
  const lx = cx - 9;
  const rx = cx + 7;
  const len = 12;
  if (i === 1) {
    // Short jersey sleeves: bare arms, wristbands.
    column(p, lx, y0 + 3, 3, len - 2, s);
    column(p, rx, y0 + 3, 3, len - 2, s);
    p.rect(lx, y0 + 1, 3, 3, PAL.white).rect(rx, y0 + 1, 3, 3, PAL.white);
    p.rect(lx, y0 + len - 1, 3, 2, PAL.tangerine).rect(rx, y0 + len - 1, 3, 2, PAL.tangerine);
  } else {
    column(p, lx, y0 + 1, 3, len, t);
    column(p, rx, y0 + 1, 3, len, t);
    if (i === 4) {
      p.rect(lx, y0 + 2, 1, len - 1, PAL.white).rect(rx + 2, y0 + 2, 1, len - 1, PAL.white);
    }
    if (i === 0) p.rect(lx, y0 + 6, 3, 1, PAL.pink).rect(rx, y0 + 6, 3, 1, PAL.pink);
    if (i === 3) {
      p.rect(lx, y0 + len - 1, 3, 2, t.light).rect(rx, y0 + len - 1, 3, 2, t.light);
      p.rect(lx, y0 + len + 1, 3, 1, s.base).rect(rx, y0 + len + 1, 3, 1, s.base);
    }
  }
  p.rect(lx, y0 + len + 1, 3, 3, s.base).px(lx + 2, y0 + len + 3, s.dark);
  p.rect(rx, y0 + len + 1, 3, 3, s.base).px(rx + 2, y0 + len + 3, s.dark);
  if (i === 0) p.rect(lx, y0 + len + 1, 3, 1, '#20202a').rect(rx, y0 + len + 1, 3, 1, '#20202a');
  return { lh: [lx + 1, y0 + len + 2], rh: [rx + 1, y0 + len + 2 + sw * 0] };
}

function legsAndShoes(p, cx, y0, footY, L, i) {
  const b = L.bottom;
  const sh = L.shoe;
  const lx = cx - 5;
  const rx = cx + 1;
  if (i === 1) {
    // Baggy jeans, stacked at the ankle, and fat white sneakers.
    column(p, lx - 1, y0, 6, footY - y0 - 2, b);
    column(p, rx, y0, 6, footY - y0 - 2, b);
    p.rect(cx - 1, y0, 2, 4, b.base);
    for (let y = y0 + 4; y < footY - 3; y += 4) p.px(lx + 1, y, b.dark).px(rx + 2, y + 2, b.dark);
    p.rect(lx - 1, footY - 5, 6, 1, b.dark).rect(rx, footY - 5, 6, 1, b.dark);
    p.rect(lx - 2, footY - 2, 7, 3, sh.base).rect(rx, footY - 2, 7, 3, sh.base);
    p.rect(lx - 2, footY, 7, 1, sh.dark).rect(rx, footY, 7, 1, sh.dark);
    p.px(lx + 1, footY - 1, PAL.tangerine).px(rx + 3, footY - 1, PAL.tangerine);
    return;
  }
  if (i === 0) {
    // Bike shorts, then bare legs into the skates.
    column(p, lx, y0, 4, 7, b);
    column(p, rx, y0, 4, 7, b);
    p.rect(cx - 1, y0, 2, 3, b.base);
    p.rect(lx, y0 + 5, 4, 1, PAL.pink).rect(rx, y0 + 5, 4, 1, PAL.pink);
    column(p, lx, y0 + 7, 4, footY - y0 - 13, L.skin);
    column(p, rx, y0 + 7, 4, footY - y0 - 13, L.skin);
    return;
  }
  if (i === 2) {
    // Plaid skirt and striped stockings.
    for (let y = 0; y < 8; y++) {
      const w = 12 + Math.floor(y / 2);
      const x = cx - Math.floor(w / 2);
      p.rect(x, y0 + y, w, 1, b.base);
      for (let k = x; k < x + w; k++) if ((k + 1) % 3 === 0) p.px(k, y0 + y, y % 3 === 1 ? '#20204a' : b.dark);
      if (y % 3 === 1) p.rect(x, y0 + y, w, 1, '#20204a').px(x + 2, y0 + y, b.light);
    }
    p.rect(cx - 7, y0 + 8, 15, 1, b.deep);
    for (let y = y0 + 9; y < footY - 2; y++) {
      const c = (y - y0) % 2 ? PAL.white : L.top.base;
      p.rect(lx + 1, y, 3, 1, c).rect(rx, y, 3, 1, c);
    }
    p.rect(lx, footY - 2, 5, 3, sh.base).rect(rx, footY - 2, 5, 3, sh.base);
    p.px(lx + 1, footY - 2, sh.light).px(rx + 1, footY - 2, sh.light);
    p.rect(lx + 1, footY - 3, 3, 1, sh.dark).rect(rx, footY - 3, 3, 1, sh.dark);
    return;
  }
  if (i === 3) {
    // Cargo shorts with pockets, bare shins, tube socks.
    column(p, lx - 1, y0, 5, 10, b);
    column(p, rx, y0, 5, 10, b);
    p.rect(cx - 1, y0, 2, 3, b.base);
    p.rect(lx - 1, y0 + 4, 3, 3, b.dark).rect(rx + 3, y0 + 4, 2, 3, b.dark);
    column(p, lx, y0 + 10, 3, footY - y0 - 16, L.skin);
    column(p, rx + 1, y0 + 10, 3, footY - y0 - 16, L.skin);
    p.rect(lx, footY - 6, 3, 4, PAL.white).rect(rx + 1, footY - 6, 3, 4, PAL.white);
    p.px(lx, footY - 5, PAL.strawberry).px(rx + 1, footY - 5, PAL.strawberry).px(lx + 2, footY - 5, PAL.strawberry).px(rx + 3, footY - 5, PAL.strawberry);
    p.rect(lx - 1, footY - 2, 5, 3, sh.base).rect(rx, footY - 2, 6, 3, sh.base);
    p.rect(lx - 1, footY, 5, 1, sh.dark).rect(rx, footY, 6, 1, sh.dark);
    return;
  }
  // Kev: track pants with the stripe, white sneakers.
  column(p, lx, y0, 4, footY - y0 - 2, b);
  column(p, rx, y0, 4, footY - y0 - 2, b);
  p.rect(cx - 1, y0, 2, 3, b.base);
  p.rect(lx, y0 + 1, 1, footY - y0 - 4, PAL.white).rect(rx + 3, y0 + 1, 1, footY - y0 - 4, PAL.white);
  p.rect(lx - 1, footY - 2, 6, 3, sh.base).rect(rx, footY - 2, 6, 3, sh.base);
  p.rect(lx - 1, footY, 6, 1, sh.dark).rect(rx, footY, 6, 1, sh.dark);
  p.px(lx + 2, footY - 1, PAL.lime).px(rx + 2, footY - 1, PAL.lime);
}

function ride(p, cx, footY, L, i, f) {
  if (i === 0) {
    // Rollerblades: high white boots with teal cuffs and four gold wheels each.
    for (const x of [cx - 6, cx + 1]) {
      p.rect(x, footY - 6, 5, 6, PAL.white).rect(x, footY - 6, 5, 2, PAL.bondi).rect(x + 4, footY - 6, 1, 6, '#b8c8d0');
      p.rect(x - 1, footY - 1, 7, 1, '#c8d8e0').rect(x - 1, footY, 7, 1, '#20202a');
      for (let k = 0; k < 4; k++) p.px(x - 1 + k * 2, footY + 1, k % 2 === f % 2 ? PAL.gold : PAL.goldDark).px(x - 1 + k * 2, footY + 2, PAL.goldDark);
    }
  } else if (i === 1) {
    // Skateboard deck seen from the front, with trucks and wheels.
    p.rect(cx - 12, footY + 1, 25, 2, PAL.tangerine).rect(cx - 12, footY + 1, 25, 1, '#ffc27a');
    p.px(cx - 13, footY, PAL.tangerine).px(cx + 13, footY, PAL.tangerine);
    p.rect(cx - 10, footY + 3, 20, 1, '#3a3a44');
    p.rect(cx - 10, footY + 3, 3, 3, PAL.cream).rect(cx + 7, footY + 3, 3, 3, PAL.cream);
    p.px(cx - 9, footY + 4, '#c8b890').px(cx + 8, footY + 4, '#c8b890');
  } else if (i === 2) {
    // Slinky springs under each shoe.
    for (const x of [cx - 6, cx + 1]) {
      for (let k = 0; k < 4; k++) {
        const y = footY + 1 + k * 2 - (f % 2 ? 0 : Math.floor(k / 2));
        p.rect(x - 1, y, 7, 1, k % 2 ? PAL.steelLight : PAL.steel).px(x + 5, y, PAL.steelDark);
      }
    }
  } else if (i === 3) {
    // Pogo stick: foot pegs under the shoes, a spring, and the rubber tip.
    p.rect(cx - 1, footY + 1, 3, 8, PAL.steel).px(cx - 1, footY + 1, PAL.steelLight);
    p.rect(cx - 8, footY + 1, 17, 2, '#2a2a30').rect(cx - 8, footY + 1, 17, 1, '#5a5a66');
    for (let k = 0; k < 3; k++) p.rect(cx - 2, footY + 4 + k * 2, 5, 1, PAL.steelDark);
    p.rect(cx - 1, footY + 10, 3, 2, PAL.ink);
  } else {
    // Kick scooter: deck, two wheels and the stem up to the handlebar.
    p.rect(cx - 10, footY + 1, 22, 2, PAL.lime).rect(cx - 10, footY + 1, 22, 1, PAL.limeLight);
    p.oval(cx - 11, footY + 4, 2, 2, '#20202a').oval(cx + 12, footY + 4, 2, 2, '#20202a');
    p.px(cx - 11, footY + 4, PAL.steel).px(cx + 12, footY + 4, PAL.steel);
  }
}

function held(p, cx, hands, L, i, f, footY) {
  const [lx, ly] = hands.lh;
  const [rx, ry] = hands.rh;
  if (i === 0) {
    // Soaker at the hip.
    p.rect(rx - 7, ry - 3, 12, 4, PAL.lime).rect(rx - 7, ry - 3, 12, 1, PAL.limeLight);
    p.rect(rx - 5, ry - 7, 6, 4, PAL.tangerine).rect(rx - 4, ry - 6, 3, 2, '#8fd8ff');
    p.rect(rx + 5, ry - 2, 3, 2, PAL.gold).rect(rx - 4, ry + 1, 3, 3, PAL.lime);
  } else if (i === 1) {
    // Yo-yos swinging from both hands.
    const d = f % 2 ? 1 : 0;
    p.rect(lx, ly + 2, 1, 5 + d, PAL.cream).rect(rx, ry + 2, 1, 6 - d, PAL.cream);
    p.oval(lx, ly + 8 + d, 2, 2, PAL.pink).px(lx - 1, ly + 7 + d, PAL.pinkLight);
    p.oval(rx, ry + 9 - d, 2, 2, PAL.cyan).px(rx - 1, ry + 8 - d, PAL.bondiLight);
  } else if (i === 2) {
    // A floppy disk fanned in one hand.
    p.rect(rx - 2, ry - 6, 7, 7, PAL.bondi).rect(rx, ry - 6, 3, 2, PAL.steelLight).rect(rx - 1, ry - 2, 5, 3, PAL.cream);
    p.rect(rx - 1, ry - 1, 4, 1, PAL.strawberry);
  } else if (i === 3) {
    // Both hands on the pogo handlebar, the rocket tube over one shoulder.
    p.rect(cx - 9, ly - 1, 19, 2, PAL.strawberry).rect(cx - 9, ly - 1, 19, 1, PAL.pinkLight);
    p.rect(cx - 1, ly + 1, 3, footY - ly, PAL.steel).px(cx - 1, ly + 1, PAL.steelLight);
  } else {
    // One hand on the scooter bar, the other waving the laser pen.
    p.rect(cx + 11, ry - 2, 1, footY - ry + 3, PAL.steel).rect(cx + 12, ry - 2, 1, footY - ry + 3, PAL.steelDark);
    p.rect(cx + 6, ry - 2, 9, 2, '#2a2a30').rect(cx + 6, ry - 2, 2, 2, PAL.lime).rect(cx + 13, ry - 2, 2, 2, PAL.lime);
    p.line(lx, ly, lx - 4, ly - 6, PAL.steelLight).px(lx - 5, ly - 7, PAL.red);
    if (f % 2) p.px(lx - 6, ly - 8, '#ff909088');
  }
}

function backgear(p, cx, top, i) {
  if (i !== 3) return;
  // Gus's firework tube slung across his back.
  p.line(cx + 4, top + 20, cx + 12, top + 4, PAL.strawberry).line(cx + 5, top + 20, cx + 13, top + 4, PAL.cream);
  p.line(cx + 6, top + 20, cx + 14, top + 4, PAL.strawberryDark);
  p.rect(cx + 11, top + 2, 4, 2, '#6a3a1a');
}

// f: 0/1 idle frames. Pogo hops, everybody else breathes.
export function heroBody(i, f = 0) {
  const L = LOOKS[i];
  const p = new Pix(FW, FH);
  const cx = 22;
  const lift = i === 3 ? f * 3 : 0;
  const breath = i === 3 ? 0 : f;
  const footY = FH - 12 - lift;
  const hipY = footY - 18;
  const shoulderY = hipY - 15 + breath;
  const headY = shoulderY - 8;
  backgear(p, cx, shoulderY - 6, i);
  ride(p, cx, footY, L, i, f);
  legsAndShoes(p, cx, hipY, footY, L, i);
  shirt(p, cx, shoulderY, hipY + 1, L, i);
  p.rect(cx - 1, shoulderY - 2, 3, 2, L.skin.dark);
  const hands = armsAndHands(p, cx, shoulderY, L, i, f);
  face(p, cx, headY, L, i);
  hair(p, cx, headY, L, i);
  held(p, cx, hands, L, i, f, footY);
  p.outline(PAL.ink);
  // Rim light down the left edge, like a street lamp behind them.
  const img = p.g.getImageData(0, 0, FW, FH);
  for (let y = 0; y < FH; y++) {
    for (let x = 1; x < FW; x++) {
      const k = (y * FW + x) * 4;
      const kl = k - 4;
      if (img.data[kl + 3] === 255 && img.data[kl] === 0x14 && img.data[kl + 1] === 0x0c && img.data[k + 3] === 255 && !(img.data[k] === 0x14 && img.data[k + 1] === 0x0c)) {
        img.data[k] = Math.min(255, img.data[k] + 40);
        img.data[k + 1] = Math.min(255, img.data[k + 1] + 40);
        img.data[k + 2] = Math.min(255, img.data[k + 2] + 50);
      }
    }
  }
  p.g.putImageData(img, 0, 0);
  return p;
}

// ---------------------------------------------------------------- portraits (32x32 busts)
export function portrait(i) {
  const L = LOOKS[i];
  const s = L.skin;
  const t = L.top;
  const h = L.hair;
  const p = new Pix(32, 32);
  const cx = 16;
  // Shoulders and collar.
  p.oval(cx, 32, 13, 7, t.base).oval(cx - 3, 30, 8, 3, t.light).rect(cx + 7, 27, 6, 5, t.dark);
  p.rect(cx - 3, 22, 7, 5, s.dark).rect(cx - 3, 22, 4, 3, s.base);
  if (i === 1) micro(p, '23', cx - 3, 27, PAL.cream);
  if (i === 2) p.rect(cx - 3, 26, 7, 6, '#f4f0ff').px(cx - 4, 28, PAL.gold);
  if (i === 3) p.rect(cx - 3, 26, 7, 6, '#f4f4f4').rect(cx - 7, 27, 1, 5, t.deep).rect(cx + 6, 27, 1, 5, t.deep);
  if (i === 4) p.rect(cx, 25, 1, 7, PAL.steelLight).rect(cx - 9, 28, 1, 4, PAL.white).rect(cx + 9, 28, 1, 4, PAL.white);
  if (i === 0) p.line(cx - 10, 29, cx, 31, PAL.pink).line(cx, 31, cx + 10, 29, PAL.pink);
  // Face with three-tone shading.
  p.oval(cx, 15, 7, 8, s.base);
  p.oval(cx - 2, 13, 4, 5, s.light);
  p.oval(cx, 15, 6, 7, s.base);
  p.oval(cx - 2, 12, 2, 2, s.light).px(cx - 3, 11, s.hi);
  for (let y = -8; y <= 8; y++) {
    const hw = Math.round(7 * Math.sqrt(Math.max(0, 1 - (y * y) / 72.25)) + 0.15);
    p.px(cx + hw, 15 + y, s.dark);
    if (y > 2) p.px(cx + hw - 1, 15 + y, s.dark);
  }
  p.rect(cx - 7, 14, 1, 3, s.dark).rect(cx + 7, 14, 1, 3, s.deep);
  // Eyes, brows, nose, mouth, blush.
  p.rect(cx - 5, 15, 3, 2, PAL.white).rect(cx + 2, 15, 3, 2, PAL.white);
  p.rect(cx - 4, 15, 2, 2, PAL.ink).rect(cx + 3, 15, 2, 2, PAL.ink);
  p.px(cx - 4, 15, PAL.white).px(cx + 3, 15, PAL.white);
  p.rect(cx - 5, 13, 3, 1, h.dark).rect(cx + 2, 13, 3, 1, h.dark);
  p.px(cx, 17, s.dark).px(cx, 18, s.dark).px(cx - 1, 19, s.dark);
  p.rect(cx - 2, 21, 5, 1, s.deep).px(cx + 3, 20, s.deep).px(cx - 1, 22, s.dark);
  p.px(cx - 5, 19, mix(s.base, PAL.pink, 0.4)).px(cx + 4, 19, mix(s.base, PAL.pink, 0.4));
  if (i === 0) {
    p.oval(cx, 8, 8, 4, h.base).rect(cx - 8, 8, 2, 8, h.base).rect(cx + 7, 8, 2, 7, h.dark);
    p.oval(cx - 8, 5, 4, 4, h.base).oval(cx + 8, 5, 4, 4, h.dark).px(cx - 9, 3, h.light).px(cx - 8, 2, h.light);
    p.rect(cx - 4, 6, 6, 1, h.light).rect(cx - 6, 9, 13, 1, h.base);
    p.px(cx - 5, 10, PAL.pink).px(cx - 4, 9, PAL.cyan).px(cx - 6, 9, PAL.cyan);
    p.px(cx - 8, 19, PAL.gold).px(cx + 8, 19, PAL.gold);
  } else if (i === 1) {
    const c = t;
    p.oval(cx, 8, 8, 4, c.base).rect(cx - 8, 8, 17, 3, c.base).rect(cx - 6, 5, 6, 1, c.light);
    p.rect(cx - 12, 9, 5, 3, c.dark).rect(cx - 12, 9, 5, 1, c.base);
    p.rect(cx - 3, 9, 6, 2, c.deep).px(cx, 4, c.hi);
    p.rect(cx - 8, 11, 2, 4, h.base).rect(cx + 7, 11, 2, 4, h.base);
    p.rect(cx - 9, 22, 19, 1, '#2a2a30').rect(cx - 10, 20, 3, 4, '#3a3a44').rect(cx + 8, 20, 3, 4, '#3a3a44');
    p.px(cx - 9, 21, PAL.tangerine).px(cx + 9, 21, PAL.tangerine);
  } else if (i === 2) {
    p.oval(cx, 9, 9, 6, h.base).rect(cx - 9, 9, 3, 12, h.base).rect(cx + 7, 9, 3, 12, h.dark);
    p.rect(cx - 7, 9, 14, 3, h.base).rect(cx - 5, 5, 7, 1, h.light).px(cx - 6, 6, h.light);
    p.rect(cx - 9, 20, 3, 1, h.deep).rect(cx + 7, 20, 3, 1, h.deep);
    p.rect(cx - 6, 14, 5, 4, PAL.ink).rect(cx + 1, 14, 5, 4, PAL.ink).rect(cx - 1, 15, 2, 1, PAL.ink);
    p.rect(cx - 5, 15, 3, 2, '#9fe8f8').rect(cx + 2, 15, 3, 2, '#9fe8f8');
    p.px(cx - 4, 16, PAL.ink).px(cx + 3, 16, PAL.ink).px(cx - 5, 15, PAL.white).px(cx + 2, 15, PAL.white);
  } else if (i === 3) {
    p.oval(cx, 8, 8, 4, h.base).rect(cx - 8, 8, 2, 5, h.base).rect(cx + 7, 8, 2, 4, h.dark);
    for (let k = -7; k <= 7; k += 2) {
      const tip = 3 + ((k + 9) % 4 === 0 ? 2 : 0);
      p.rect(cx + k, 5 - tip, 2, tip + 2, h.base);
      p.rect(cx + k, 5 - tip, 2, 2, '#f6e8b0').px(cx + k, 7 - tip, '#e8cc80');
    }
    p.rect(cx - 7, 9, 15, 1, h.dark);
  } else {
    p.oval(cx, 9, 8, 5, h.base).rect(cx - 8, 9, 17, 4, h.base);
    p.rect(cx - 7, 12, 15, 1, h.dark).rect(cx - 5, 5, 7, 1, h.light).px(cx - 6, 6, h.light);
    p.rect(cx - 9, 12, 2, 6, '#2a2a30').px(cx - 9, 12, '#5a5a66');
    p.line(cx - 8, 18, cx - 3, 21, '#2a2a30').rect(cx - 3, 21, 2, 1, PAL.red);
  }
  p.outline(PAL.ink);
  return p;
}
