// Where each weapon's muzzle sits on screen (in the 384x216 frame). The first-person weapon art is
// drawn around these points, and the sim spawns shots at the same spot in 3D, so every shot leaves
// from the weapon you see.
import { W, H } from '../core/util.js';

export const MUZZLE = {
  // Tina's green starter Soaker, and the CPS 2500 upgrade held at her right hip.
  soaker: { x: 226, y: 98 },
  soaker2: { x: 236, y: 110 },
  rocket: { x: 240, y: 114 },
  laser: { x: 236, y: 128 },
  floppy: { x: 298, y: 128 },
  yoyo: [{ x: 70, y: 150 }, { x: 314, y: 150 }],
  // Gus's dual Roman candles (the rocket upgrade): left and right fists.
  candle: [{ x: 134, y: 124 }, { x: 250, y: 124 }],
};

// Must match the camera in world.js.
const TAN_V = Math.tan(((62 / 2) * Math.PI) / 180);
const TAN_H = (TAN_V * W) / H;

export function muzzleScreen(kind, hand = 0) {
  const m = MUZZLE[kind];
  return Array.isArray(m) ? m[hand ? 1 : 0] : m || { x: W / 2, y: H / 2 };
}

// The muzzle in view space, `fwd` ahead of the eye: how far right and how far down it sits.
export function muzzleOffset(kind, hand = 0, fwd = 0.45) {
  const m = muzzleScreen(kind, hand);
  return { f: fwd, r: ((m.x - W / 2) / (W / 2)) * fwd * TAN_H, d: ((m.y - H / 2) / (H / 2)) * fwd * TAN_V };
}

// The muzzle in the world for a player at (x, y, eye height) looking along yaw a with the given pitch.
export function muzzleWorld(kind, hand, x, y, eye, a, pitch = 0) {
  const m = muzzleOffset(kind, hand);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const ahead = m.f * cp + m.d * sp;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  return { x: x + dx * ahead - dy * m.r, y: y + dy * ahead + dx * m.r, z: eye + m.f * sp - m.d * cp, r: m.r };
}
