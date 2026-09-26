// The Y2Kage palette. Everything the game draws by hand picks from here, so the whole
// game reads as one 16-bit cart: iMac flavours, Windows 98 greys, party neon, zombie greens.
export const PAL = {
  black: '#000000',
  ink: '#140c1c',
  night: '#1a1030',
  dusk: '#2b1a4a',
  purple: '#3b1f5c',
  grape: '#6a3a9c',
  lilac: '#a67bd8',
  pink: '#ff2e88',
  pinkLight: '#ff8fc4',
  cyan: '#3de0e0',
  cyanDark: '#1b8a9c',
  bondi: '#0096b4',
  bondiLight: '#7fdcec',
  tangerine: '#ff8a2a',
  tangerineDark: '#b8520e',
  strawberry: '#e8344e',
  strawberryDark: '#8e1a36',
  lime: '#7ac943',
  limeLight: '#c3f06a',
  gold: '#f6c945',
  goldDark: '#a8701a',
  cream: '#fff4d6',
  white: '#ffffff',
  red: '#ff3b3b',
  blood: '#9be04a',
  // Windows 98
  winFace: '#c0c0c0',
  winLight: '#dfdfdf',
  winShadow: '#808080',
  winDark: '#404040',
  winNavy: '#000080',
  winBlue: '#1084d0',
  winTeal: '#008080',
  winTip: '#ffffe1',
  bsod: '#0000aa',
  // skin and cloth
  zSkin: '#8fb35a',
  zSkinLight: '#b7d67a',
  zSkinDark: '#56722e',
  zSkinDeep: '#34471c',
  eye: '#fff36a',
  tux: '#1c1830',
  tuxLight: '#3a3452',
  denim: '#2d5aa8',
  denimLight: '#4f86d6',
  denimDark: '#1a3468',
  steel: '#9aa3b5',
  steelDark: '#5b6275',
  steelLight: '#d7dde8',
};

// iMac G3 flavours, one per hero card.
export const FLAVOURS = [
  { name: 'Bondi Blue', base: '#0096b4', light: '#7fdcec', dark: '#005a6e' },
  { name: 'Tangerine', base: '#ff8a2a', light: '#ffc27a', dark: '#b8520e' },
  { name: 'Grape', base: '#7a3fb0', light: '#b48ae0', dark: '#43206a' },
  { name: 'Strawberry', base: '#e8344e', light: '#ff8a9c', dark: '#8e1a36' },
  { name: 'Lime', base: '#6fbf3a', light: '#b8ec7c', dark: '#3a6e1a' },
];

export const PARTY = ['#ff2e88', '#f6c945', '#3de0e0', '#fff4d6', '#7ac943', '#ff8a2a', '#a67bd8'];

export function hex(c) {
  return parseInt(c.slice(1), 16);
}

export function rgb(c) {
  const n = hex(c);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
