// First-person weapons and hands, all five modelled in 3D and drawn over the world into the same
// 384x216 target so they go through the same dither as everything else. Toon shading (a few hard
// bands), pixel-art canvas textures for decals and wear, an ink outline and a rim light keep them
// reading as 16-bit sprites while real perspective has them point at the crosshair. The layer also
// handles the feel: sway when you turn, breathing, bob, per-weapon recoil and a muzzle light.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, FLAVOURS } from '../core/palette.js';
import { LOOKS } from './heroart.js';
import { MUZZLE } from '../data/muzzles.js';
import { W, H } from '../core/util.js';
import { sfx } from '../audio/sfx.js';

// Four hard light bands.
function toonRamp() {
  const d = new Uint8Array([62, 62, 62, 255, 130, 130, 130, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const RAMP = toonRamp();

// An ink hull a little over a pixel thick at any distance.
const INK = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(PAL.ink) }, thick: { value: 0.0058 } },
  vertexShader: /* glsl */ `
    uniform float thick;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * thick * -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});

// ---------------------------------------------------------------- materials and textures
// Pixel-art textures painted on a canvas at build time. draw(c, w, h) paints; they are cached by key.
const texCache = new Map();
function ptex(key, w, h, draw, repeat = false) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const fill = (c, col, x, y, w, h) => {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};
// Tiny 3x5 pixel font for decals, so labels stay crisp at texture size.
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111',
  1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100110101010', 7: '111001010010010', 8: '010101010101010', 9: '010101011001110', '.': '000000000000010',
  '!': '010010010000010', '-': '000000111000000', '/': '001001010100100', ' ': '000000000000000',
};
function pxText(c, str, x, y, col) {
  c.fillStyle = col;
  for (const ch of str.toUpperCase()) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
    x += 4;
  }
}

const mats = new Map();
function toon(col, opt = {}) {
  const key = col + JSON.stringify(opt, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: RAMP, ...opt }));
  return mats.get(key);
}
const textured = (map, col = '#ffffff') => toon(col, { map });

function hull(geo) {
  const g = geo.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}

// A shaded mesh with its outline. opt.ink = false skips the outline (decals, glass, small trim).
function part(geo, col, opt = {}) {
  const mat = opt.mat || (opt.map ? textured(opt.map, col) : toon(col, opt.transparent ? { transparent: true, opacity: opt.opacity ?? 0.5, depthWrite: false } : {}));
  const m = new THREE.Mesh(geo, mat);
  if (opt.ink !== false) m.add(new THREE.Mesh(hull(geo), INK));
  return m;
}
// A flat decal just off a surface; faces +z unless turned.
function decal(map, w, h) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon('#ffffff', { map, transparent: true, alphaTest: 0.5 }));
}

// Geometry helpers. Tubes run along z (forward is -z), with r0 at the front and r1 at the back.
const tubeZ = (r0, r1, len, seg = 14) => new THREE.CylinderGeometry(r1, r0, len, seg).rotateX(Math.PI / 2);
const tubeX = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
const tubeY = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg);
const box = (w, h, d, r = 0.008) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const ball = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
const ring = (r, t, seg = 16) => new THREE.TorusGeometry(r, t, 6, seg);

function at(o, x, y, z) {
  o.position.set(x, y, z);
  return o;
}
function rot(o, x, y, z) {
  o.rotation.set(x, y, z);
  return o;
}

// ---------------------------------------------------------------- hands
// Each hero's sleeve: base colour and cuff details.
function sleeveFor(i) {
  const L = LOOKS[i];
  return [
    { col: L.top.base, cuff: [[PAL.pink, 0.05, 0.022], [PAL.white, 0.075, 0.008]], glove: '#26263a' },
    { col: L.skin.base, cuff: [[PAL.white, 0.03, 0.03], [PAL.tangerine, 0.02, 0.006]], bare: true },
    { col: L.top.base, cuff: [[L.top.light, 0.02, 0.03]], knit: true },
    { col: L.top.base, cuff: [[L.top.light, 0.02, 0.026], [L.top.dark, 0.07, 0.01], [L.top.dark, 0.11, 0.01]], plaid: true },
    { col: L.top.base, cuff: [['#20202a', 0.015, 0.024]], stripes: true },
  ][i];
}

// Sleeve cloth: plaid for Gus, a knit rib for Dot, plain otherwise (the toon bands do the rest).
function clothTex(i) {
  const L = LOOKS[i];
  const S = sleeveFor(i);
  if (S.plaid)
    return ptex('plaid' + i, 16, 16, (c) => {
      fill(c, L.top.base, 0, 0, 16, 16);
      for (let k = 0; k < 16; k += 8) {
        fill(c, L.top.dark, k + 2, 0, 2, 16);
        fill(c, L.top.dark, 0, k + 5, 16, 2);
        fill(c, L.top.deep || L.top.dark, k + 2, k + 5, 2, 2);
      }
      fill(c, L.top.light, 0, 1, 16, 1);
    }, true);
  if (S.knit)
    return ptex('knit' + i, 8, 8, (c) => {
      fill(c, L.top.base, 0, 0, 8, 8);
      for (let k = 0; k < 8; k += 2) fill(c, L.top.dark, k, 0, 1, 8);
    }, true);
  return null;
}

// A fist closed around a grip that runs along the fist's local x axis (radius gr). The back of the
// hand faces up and toward you. flip mirrors it for a left hand. The group's `wrist` is where the
// forearm starts; add the sleeve with sleeve() once the fist is placed. opt.point leaves the index
// finger straight along the grip (Kev's thumb-on-the-button pen grip).
function fist(heroIdx, gr, flip = false, opt = {}) {
  const L = LOOKS[heroIdx];
  const S = sleeveFor(heroIdx);
  const skin = L.skin.base;
  const g = new THREE.Group();
  const ft = 0.0112;
  const sx = flip ? -1 : 1;
  for (let k = 0; k < 4; k++) {
    const x = sx * (k - 1.5) * 0.0222;
    if (opt.point && k === (flip ? 3 : 0)) {
      // The index finger lies straight along the grip, pointing ahead.
      const f = part(new THREE.CapsuleGeometry(ft, 0.05, 4, 8).rotateX(Math.PI / 2), skin);
      g.add(at(f, x - sx * 0.004, gr + ft * 0.6, -0.02));
      continue;
    }
    // Two knuckle segments curled round the grip, the little finger a touch shorter and lower.
    const r = gr + ft * 0.95 - (k === 3 ? 0.001 : 0);
    const geo = new THREE.TorusGeometry(r, ft * (k === 3 ? 0.9 : 1), 6, 12, Math.PI * 1.3).rotateZ(Math.PI * 0.32).rotateY(-Math.PI / 2);
    g.add(at(part(geo, skin), x, 0, 0));
    // The knuckle catching the light on top.
    g.add(at(part(ball(ft * 1.12, 8, 6), L.skin.light, { ink: false }), x, r * 0.62, r * 0.72));
  }
  // Back of the hand, behind and above the grip; fingerless gloves for Tina.
  const back = part(box(0.094, 0.034, 0.078, 0.014), S.glove || skin);
  back.rotation.x = -0.75;
  g.add(at(back, 0, gr + 0.009, gr + 0.035));
  if (S.glove) {
    // Velcro strap with a pink tab across the glove.
    const strap = part(box(0.096, 0.012, 0.03, 0.004), '#3a3a52', { ink: false });
    strap.rotation.x = -0.75;
    g.add(at(strap, 0, gr + 0.026, gr + 0.05));
    g.add(at(part(box(0.018, 0.013, 0.02, 0.003), PAL.pink, { ink: false }), sx * 0.04, gr + 0.028, gr + 0.052));
  }
  // Thumb in two segments, wrapped under the grip on the inner side.
  const t1 = part(new THREE.CapsuleGeometry(0.0125, 0.026, 4, 8).rotateZ(Math.PI / 2).rotateY(0.5 * sx), skin);
  g.add(at(t1, -sx * 0.042, -gr * 0.1, gr + 0.024));
  const t2 = part(new THREE.CapsuleGeometry(0.0115, 0.022, 4, 8).rotateZ(Math.PI / 2), skin);
  g.add(at(t2, -sx * 0.03, -gr * 0.45, gr * 0.5 + 0.004));
  g.wrist = new THREE.Vector3(0, gr * 0.3, gr + 0.07);
  g.hero = heroIdx;
  return g;
}

// The forearm from a placed fist's wrist, heading along dir (in the parent's frame) off screen.
function sleeve(parent, f, dir) {
  const S = sleeveFor(f.hero);
  const skin = LOOKS[f.hero].skin.base;
  f.updateMatrix();
  const w = f.wrist.clone().applyMatrix4(f.matrix);
  const d = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const arm = new THREE.Group();
  const len = 0.6;
  const cloth = clothTex(f.hero);
  if (cloth) cloth.repeat.set(3, 6);
  arm.add(at(part(tubeY(0.027, 0.031, 0.09), skin), 0, 0.025, 0));
  arm.add(at(part(tubeY(0.037, 0.046, len, 14), S.col, cloth ? { map: cloth } : {}), 0, len / 2 + (S.bare ? 0.07 : 0.04), 0));
  for (const [c, y, h] of S.cuff) arm.add(at(part(tubeY(0.0385, 0.0385, h, 14), c, { ink: false }), 0, y + (S.bare ? 0.07 : 0.04), 0));
  if (S.bare) {
    // Marcus: a veined forearm with a highlight down the top.
    arm.add(at(part(box(0.012, len * 0.6, 0.006, 0.002), LOOKS[f.hero].skin.light, { ink: false }), -0.02, len * 0.4, 0.034));
  }
  if (S.stripes)
    for (const a of [0.4, 0.8]) {
      const st = part(box(0.008, len, 0.008, 0.002), PAL.white, { ink: false });
      st.position.set(Math.cos(a) * 0.042, len / 2 + 0.06, Math.sin(a) * 0.042);
      arm.add(st);
    }
  arm.quaternion.copy(q);
  arm.position.copy(w);
  parent.add(arm);
}

// ---------------------------------------------------------------- the Soaker 2500
// Where the pump rests: just ahead of the pressure chamber, so her front hand sits mid-gun. It slides forward to pump.
const PUMP_Z = -0.3;

// The Soaker's left side: panel seams, screws, a sticker and the logo.
function soakerSideTex() {
  return ptex('soakerSide', 64, 24, (c) => {
    fill(c, PAL.lime, 0, 0, 64, 24);
    fill(c, PAL.limeLight, 0, 0, 64, 2);
    fill(c, '#4f8e2a', 0, 21, 64, 3);
    // Seams and screws.
    fill(c, '#4f8e2a', 20, 2, 1, 19);
    fill(c, '#4f8e2a', 46, 2, 1, 19);
    for (const [x, y] of [[3, 4], [3, 17], [60, 4], [60, 17], [23, 17], [43, 17]]) {
      fill(c, '#3a6e1a', x, y, 2, 2);
      fill(c, PAL.limeLight, x, y, 1, 1);
    }
    // Logo plate.
    fill(c, PAL.grape, 23, 4, 22, 11);
    fill(c, PAL.lilac, 23, 4, 22, 1);
    pxText(c, 'SOAK', 26, 5, PAL.gold);
    pxText(c, '2500', 26, 11, PAL.white);
    // Warning stripe and a splash sticker.
    for (let k = 0; k < 8; k++) fill(c, k % 2 ? PAL.ink : PAL.gold, 6 + k * 2, 18, 2, 2);
    fill(c, PAL.bondiLight, 50, 6, 8, 6);
    fill(c, PAL.white, 51, 7, 3, 2);
    fill(c, PAL.bondi, 55, 9, 2, 2);
  });
}
function gaugeTex() {
  return ptex('gauge', 16, 16, (c) => {
    c.fillStyle = PAL.white;
    c.beginPath();
    c.arc(8, 8, 7, 0, Math.PI * 2);
    c.fill();
    fill(c, PAL.red, 11, 4, 2, 2);
    fill(c, PAL.lime, 3, 4, 2, 2);
    fill(c, PAL.ink, 7, 7, 2, 2);
  });
}

function soaker(heroIdx) {
  const lime = PAL.lime;
  const org = PAL.tangerine;
  const grape = PAL.grape;
  const gun = new THREE.Group();
  const side = soakerSideTex();
  // Receiver, with a lower grape rail and an orange trim line.
  gun.add(at(part(box(0.1, 0.11, 0.34, 0.022), lime), 0, 0, 0.02));
  const dl = decal(side, 0.32, 0.105);
  dl.rotation.y = -Math.PI / 2;
  gun.add(at(dl, -0.0512, 0, 0.02));
  gun.add(at(part(box(0.104, 0.022, 0.3, 0.006), grape), 0, -0.042, 0.02));
  gun.add(at(part(box(0.106, 0.012, 0.25, 0.004), org, { ink: false }), 0, 0.024, 0.02));
  // Rear grip with finger grooves, the trigger and its guard.
  const grip = part(box(0.062, 0.14, 0.072, 0.016), '#5aa032');
  grip.rotation.x = 0.35;
  gun.add(at(grip, 0, -0.1, 0.14));
  for (let k = 0; k < 3; k++) gun.add(at(rot(part(box(0.064, 0.006, 0.02, 0.002), '#3a6e1a', { ink: false }), 0.35, 0, 0), 0, -0.07 - k * 0.028, 0.11 - k * 0.01));
  gun.add(at(part(box(0.016, 0.042, 0.016, 0.005), org), 0, -0.072, 0.07));
  gun.add(at(rot(part(ring(0.03, 0.005, 12), grape), 0, Math.PI / 2, 0), 0, -0.08, 0.075));
  // Pressure chamber slung under the front, gold with grape bands, and a gauge on its side.
  gun.add(at(part(tubeZ(0.052, 0.052, 0.2, 16), PAL.gold), 0, -0.078, -0.13));
  for (const z of [-0.225, -0.035]) gun.add(at(part(tubeZ(0.054, 0.054, 0.014, 16), grape, { ink: false }), 0, -0.078, z));
  const gauge = new THREE.Group();
  gauge.add(part(tubeX(0.022, 0.012, 14), PAL.steelDark));
  const face = decal(gaugeTex(), 0.036, 0.036);
  face.rotation.y = -Math.PI / 2;
  gauge.add(at(face, -0.0065, 0, 0));
  const needle = part(box(0.002, 0.016, 0.003, 0.001), PAL.red, { ink: false });
  needle.geometry.translate(0, 0.008, 0);
  gauge.add(at(needle, -0.008, 0, 0));
  gun.add(at(gauge, -0.058, -0.06, -0.08));
  // Barrel, collars and the nozzle.
  gun.add(at(part(tubeZ(0.025, 0.029, 0.44, 16), lime), 0, 0.03, -0.36));
  gun.add(at(part(box(0.012, 0.01, 0.4, 0.003), PAL.limeLight, { ink: false }), 0, 0.058, -0.36));
  for (const z of [-0.18, -0.52]) gun.add(at(part(tubeZ(0.034, 0.034, 0.022, 16), grape), 0, 0.03, z));
  gun.add(at(part(tubeZ(0.022, 0.032, 0.065, 16), org), 0, 0.03, -0.565));
  gun.add(at(part(tubeZ(0.01, 0.01, 0.012), '#20202a', { ink: false }), 0, 0.03, -0.6));
  const muzzle = at(new THREE.Object3D(), 0, 0.03, -0.61);
  gun.add(muzzle);
  // Front sight.
  gun.add(at(part(box(0.012, 0.024, 0.02, 0.003), org), 0, 0.066, -0.53));
  // Pump rod and the sliding pump with its ribs; her left hand rides on it.
  gun.add(at(part(tubeZ(0.007, 0.007, 0.3), PAL.steel), 0, -0.018, -0.32));
  const pump = new THREE.Group();
  pump.add(part(tubeZ(0.037, 0.041, 0.13, 16), org));
  for (let k = 0; k < 5; k++) pump.add(at(part(tubeZ(0.043, 0.043, 0.008, 16), PAL.tangerineDark, { ink: false }), 0, 0, -0.05 + k * 0.025));
  const lh = fist(heroIdx, 0.041, true);
  lh.rotation.set(0, Math.PI / 2, -2.3);
  pump.add(at(lh, 0, 0, 0.01));
  sleeve(pump, lh, new THREE.Vector3(-1, -0.5, 0.35));
  gun.add(at(pump, 0, -0.018, PUMP_Z));
  // The reservoir: a clear tank with the water inside, a highlight, straps and a screw cap.
  const tank = new THREE.Group();
  tank.add(part(tubeZ(0.034, 0.034, 0.2, 20), '#bfe8ff', { transparent: true, opacity: 0.4, ink: false }));
  tank.add(new THREE.Mesh(hull(tubeZ(0.034, 0.034, 0.2, 20)), INK));
  const water = part(tubeZ(0.03, 0.03, 0.19, 20), '#3a8ae8', { ink: false });
  tank.add(water);
  tank.add(at(part(box(0.005, 0.005, 0.16, 0.002), PAL.white, { ink: false }), -0.02, 0.024, 0));
  for (const z of [-0.07, 0.06]) tank.add(at(part(tubeZ(0.037, 0.037, 0.014, 20), grape), 0, 0, z));
  tank.add(at(part(tubeZ(0.02, 0.024, 0.02, 16), grape), 0, 0, 0.11));
  gun.add(at(tank, 0, 0.078, 0.05));
  gun.add(at(part(box(0.05, 0.03, 0.15, 0.006), grape), 0, 0.058, 0.03));
  // Her right hand round the grip, arm coming in from the lower right.
  const rh = fist(heroIdx, 0.035);
  rh.rotation.set(0.35, -Math.PI / 2, Math.PI / 2);
  gun.add(at(rh, 0.004, -0.1, 0.14));
  sleeve(gun, rh, new THREE.Vector3(0.3, -0.6, 1));
  return { root: gun, muzzle, pump, water, needle, flash: 0x7fd8ff };
}

// ---------------------------------------------------------------- Kev's laser pointer
function laser(heroIdx) {
  const pen = new THREE.Group();
  const chrome = PAL.steelLight;
  const body = ptex('laserBody', 32, 8, (c) => {
    fill(c, PAL.steel, 0, 0, 32, 8);
    fill(c, PAL.steelLight, 0, 1, 32, 2);
    fill(c, PAL.steelDark, 0, 6, 32, 2);
    pxText(c, 'LASER', 4, 2, PAL.strawberryDark);
  });
  pen.add(at(part(tubeZ(0.018, 0.02, 0.26, 16), chrome, { map: body }), 0, 0, -0.04));
  // Knurled grip rings.
  for (let k = 0; k < 7; k++) pen.add(at(part(tubeZ(0.0205, 0.0205, 0.006, 16), PAL.steelDark, { ink: false }), 0, 0, 0.0 + k * 0.012));
  pen.add(at(part(tubeZ(0.0192, 0.0192, 0.012, 16), PAL.lime), 0, 0, -0.1));
  // Lens housing and the red lens.
  pen.add(at(part(tubeZ(0.022, 0.019, 0.04, 16), '#2a2a34'), 0, 0, -0.185));
  pen.add(at(part(tubeZ(0.01, 0.01, 0.006), PAL.red, { ink: false }), 0, 0, -0.206));
  const muzzle = at(new THREE.Object3D(), 0, 0, -0.212);
  pen.add(muzzle);
  // Pocket clip and the button under his index finger.
  pen.add(at(part(box(0.008, 0.006, 0.11, 0.002), chrome), -0.015, 0.018, 0.02));
  const button = part(box(0.013, 0.009, 0.022, 0.003), PAL.strawberry);
  pen.add(at(button, 0, 0.02, -0.06));
  // End cap with a keyring loop.
  pen.add(at(part(tubeZ(0.02, 0.017, 0.02, 16), chrome), 0, 0, 0.1));
  pen.add(at(rot(part(ring(0.012, 0.003, 10), PAL.steel), 0, Math.PI / 2, 0), 0, 0, 0.12));
  const glow = new THREE.Mesh(ball(0.018), new THREE.MeshBasicMaterial({ color: 0xff5050 }));
  glow.position.copy(muzzle.position);
  glow.visible = false;
  pen.add(glow);
  const hand = fist(heroIdx, 0.021, false, { point: true });
  hand.rotation.set(0, Math.PI / 2, 0.25);
  hand.scale.setScalar(0.88);
  pen.add(at(hand, 0.002, -0.004, 0.035));
  sleeve(pen, hand, new THREE.Vector3(0.3, -0.6, 1));
  return { root: pen, muzzle, glow, button, flash: 0xff4040 };
}

// ---------------------------------------------------------------- handlebars
// The left half of a handlebar, from the grip in the left fist to the stem in the middle.
function handlebar(heroIdx, kind) {
  const g = new THREE.Group();
  const pogo = kind === 'pogo';
  const gripCol = pogo ? PAL.strawberry : PAL.lime;
  const bar = ptex('bar', 16, 4, (c) => {
    fill(c, PAL.steel, 0, 0, 16, 4);
    fill(c, PAL.steelLight, 0, 1, 16, 1);
    fill(c, PAL.steelDark, 5, 0, 1, 4);
  }, true);
  g.add(at(part(tubeX(0.016, 0.3), PAL.steel, { map: bar }), 0.1, 0, 0));
  // Foam or rubber grip with ribs, and an end cap.
  g.add(at(part(tubeX(0.027, 0.12, 14), gripCol), -0.03, 0, 0));
  for (let k = 0; k < 6; k++) g.add(at(part(tubeX(0.0285, 0.006, 14), pogo ? FLAVOURS[3].dark : '#3a6e1a', { ink: false }), -0.08 + k * 0.02, 0, 0));
  g.add(at(part(tubeX(0.025, 0.014), '#20202a'), -0.096, 0, 0));
  // Clamp with bolts, and the stem dropping out of view.
  g.add(at(part(box(0.05, 0.05, 0.05, 0.01), '#2a2a30'), 0.25, 0, 0));
  for (const y of [-0.012, 0.012]) g.add(at(part(tubeZ(0.006, 0.006, 0.008), PAL.steelLight, { ink: false }), 0.25, y, 0.027));
  const stem = part(tubeY(0.022, 0.022, 0.6), PAL.steel, { map: bar });
  stem.rotation.x = -0.25;
  g.add(at(stem, 0.25, -0.3, 0.07));
  if (!pogo) {
    // Scooter brake lever in front of the grip, and a bell.
    const lever = part(box(0.11, 0.008, 0.012, 0.003), '#2a2a30');
    lever.rotation.y = 0.2;
    g.add(at(lever, -0.02, 0.004, -0.045));
    g.add(at(part(ball(0.018), PAL.steelLight), 0.07, 0.025, -0.01));
  } else {
    // Pogo: a spring collar showing below the clamp.
    for (let k = 0; k < 3; k++) g.add(at(part(ring(0.028, 0.006, 12).rotateX(Math.PI / 2), PAL.gold), 0.25, -0.05 - k * 0.018, 0.012 * k));
  }
  const hand = fist(heroIdx, 0.027, true);
  g.add(at(hand, -0.03, 0, 0));
  sleeve(g, hand, new THREE.Vector3(-0.3, -0.6, 1));
  return { root: g };
}

// ---------------------------------------------------------------- Marcus's yo-yos
function yoyoFace(col, rim) {
  return ptex('yoface' + col, 24, 24, (c) => {
    c.fillStyle = rim;
    c.beginPath();
    c.arc(12, 12, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = col;
    c.beginPath();
    c.arc(12, 12, 10, 0, Math.PI * 2);
    c.fill();
    // A four-point star sticker (it turns as the yo-yo spins) and a number.
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      for (let r = 2; r < 9; r++) fill(c, k % 2 ? PAL.gold : PAL.white, Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), 1, 1);
    }
    fill(c, PAL.white, 5, 5, 2, 1);
    fill(c, PAL.white, 4, 6, 1, 2);
    pxText(c, '23', 9, 16, PAL.ink);
  });
}

// A yo-yo resting on the fist, face turned toward the middle of the screen, string round the middle finger.
function yoyoHand(heroIdx, flip, col, rim) {
  const g = new THREE.Group();
  const hand = fist(heroIdx, 0.016, flip);
  // Knuckles tipped toward you so the fingers read, like a hand on a handlebar.
  hand.rotation.set(0.75, flip ? 0.25 : -0.25, 0);
  g.add(hand);
  sleeve(g, hand, new THREE.Vector3(flip ? -0.3 : 0.3, -0.7, 1));
  const yo = new THREE.Group();
  const spin = new THREE.Group();
  const face = yoyoFace(col, rim);
  // Two halves with a gap for the string, axle along x.
  for (const s of [-1, 1]) {
    const half = part(tubeX(0.036, 0.016, 20), col);
    spin.add(at(half, s * 0.011, 0, 0));
    spin.add(at(part(ring(0.036, 0.004, 20).rotateY(Math.PI / 2), rim, { ink: false }), s * 0.019, 0, 0));
    const fd = decal(face, 0.068, 0.068);
    fd.rotation.y = (s * Math.PI) / 2;
    spin.add(at(fd, s * 0.0195, 0, 0));
    spin.add(at(part(ball(0.008, 8, 6), PAL.steelLight), s * 0.021, 0, 0));
  }
  spin.add(part(tubeX(0.015, 0.007, 12), '#1a1030', { ink: false }));
  yo.add(spin);
  // Turn the face in toward the centre so you see it and the rim.
  yo.rotation.y = flip ? -0.7 : 0.7;
  g.add(at(yo, flip ? 0.01 : -0.01, 0.075, -0.01));
  // String from the axle down over the knuckles.
  const str = part(tubeY(0.0016, 0.0016, 0.06, 4), PAL.cream, { ink: false });
  g.add(at(str, 0, 0.042, 0.004));
  // When thrown: the string out toward the crosshair.
  const line = part(tubeZ(0.0016, 0.0016, 1, 4), PAL.cream, { ink: false });
  line.geometry.translate(0, 0, -0.5);
  line.visible = false;
  g.add(at(line, 0, 0.02, 0));
  return { root: g, yo, spin, line, muzzle: yo };
}

function yoyos(heroIdx) {
  const root = new THREE.Group();
  const L = yoyoHand(heroIdx, true, PAL.pink, PAL.strawberryDark);
  const R = yoyoHand(heroIdx, false, PAL.cyan, PAL.cyanDark);
  L.root.position.set(-0.19, 0, 0);
  R.root.position.set(0.19, 0, 0);
  root.add(L.root, R.root);
  return { root, L, R, muzzle: L.muzzle, muzzle2: R.muzzle, flash: 0xffffff };
}

// ---------------------------------------------------------------- Dot's floppies
const DISKS = [
  [FLAVOURS[2].base, 'DOOM'], [PAL.strawberry, 'WIN98'], [PAL.bondi, 'MYST'], [PAL.gold, 'OREGON'], [PAL.lime, 'TAXES'], ['#26263a', 'BACKUP'],
];
function floppyTex(k) {
  const [col, label] = DISKS[k % DISKS.length];
  return ptex('floppy' + k, 32, 32, (c) => {
    fill(c, col, 0, 0, 32, 32);
    fill(c, 'rgba(255,255,255,0.35)', 0, 0, 32, 1);
    fill(c, 'rgba(255,255,255,0.35)', 0, 0, 1, 32);
    fill(c, 'rgba(0,0,0,0.35)', 31, 0, 1, 32);
    fill(c, 'rgba(0,0,0,0.35)', 0, 31, 32, 1);
    // Metal shutter with the window onto the disk.
    fill(c, PAL.steel, 8, 0, 16, 11);
    fill(c, PAL.steelLight, 8, 0, 16, 1);
    fill(c, PAL.steelDark, 8, 10, 16, 1);
    fill(c, '#1a1030', 17, 2, 4, 7);
    fill(c, '#6a3a1a', 18, 3, 2, 5);
    // Label with ruled lines and the name in marker.
    fill(c, PAL.white, 4, 14, 24, 16);
    fill(c, '#9ab0e0', 5, 20, 22, 1);
    fill(c, '#9ab0e0', 5, 25, 22, 1);
    pxText(c, label, 5, 15, PAL.strawberryDark);
    fill(c, '#1a1030', 1, 27, 2, 3);
    fill(c, '#1a1030', 29, 27, 2, 3);
  });
}
function floppy(k) {
  const t = floppyTex(k);
  const d = new THREE.Group();
  d.add(part(box(0.09, 0.094, 0.004, 0.002), DISKS[k % DISKS.length][0]));
  const f = decal(t, 0.089, 0.093);
  d.add(at(f, 0, 0, 0.0022));
  return d;
}

function floppies(heroIdx) {
  const root = new THREE.Group();
  // Right hand: a disk pinched upright, face toward you.
  const R = new THREE.Group();
  const rh = fist(heroIdx, 0.012);
  R.add(rh);
  sleeve(R, rh, new THREE.Vector3(0.35, -0.7, 1));
  const disk = floppy(0);
  rot(disk, -0.25, -0.35, 0);
  R.add(at(disk, 0, 0.06, -0.012));
  R.position.set(0.17, 0, 0);
  // Left hand: a stack of spares held by their edge.
  const Lg = new THREE.Group();
  const lh = fist(heroIdx, 0.024, true);
  Lg.add(lh);
  sleeve(Lg, lh, new THREE.Vector3(-0.35, -0.7, 1));
  const stack = new THREE.Group();
  // Fanned out like a hand of cards, the back ones peeking out above and to the side.
  for (let k = 0; k < 4; k++) {
    const d = floppy(k + 1);
    rot(d, -0.25, 0.35, (1.5 - k) * 0.22);
    stack.add(at(d, (1.5 - k) * -0.012, 0.004 * k, -0.006 * k));
  }
  Lg.add(at(stack, 0, 0.058, -0.012));
  Lg.position.set(-0.18, -0.005, 0);
  Lg.rotation.set(0, 0, 0);
  root.add(R, Lg);
  return { root, R, disk, muzzle: disk, flash: 0xffffff, rBase: R.position.clone() };
}

// ---------------------------------------------------------------- Gus's firework launcher
function tubeWrap() {
  return ptex('fireworkWrap', 32, 32, (c) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) fill(c, Math.floor((x + y) / 4) % 2 ? PAL.strawberry : PAL.cream, x, y, 1, 1);
    // A label band with stars and BOOM.
    fill(c, PAL.purple, 0, 11, 32, 10);
    fill(c, PAL.gold, 0, 11, 32, 1);
    fill(c, PAL.gold, 0, 20, 32, 1);
    pxText(c, 'BOOM', 8, 13, PAL.gold);
    for (const [x, y] of [[3, 15], [28, 15]]) {
      fill(c, PAL.white, x, y - 1, 1, 3);
      fill(c, PAL.white, x - 1, y, 3, 1);
    }
  }, true);
}
function rocketLauncher(heroIdx) {
  const g = new THREE.Group();
  const wrap = tubeWrap();
  wrap.repeat.set(2, 2);
  // The mortar tube, a cardboard back end and a gold lip.
  g.add(at(part(tubeZ(0.058, 0.062, 0.52, 18), PAL.white, { map: wrap }), 0, 0, -0.08));
  g.add(at(part(tubeZ(0.064, 0.064, 0.03, 18), PAL.gold), 0, 0, -0.33));
  g.add(at(part(tubeZ(0.047, 0.047, 0.01, 18), '#1a1030', { ink: false }), 0, 0, -0.346));
  g.add(at(part(tubeZ(0.066, 0.063, 0.05, 18), '#9a6a3a'), 0, 0, 0.19));
  // Straps, a sight post and a fuse coiling out of the back.
  for (const z of [-0.2, 0.06]) g.add(at(part(tubeZ(0.065, 0.065, 0.02, 18), '#3a2a1a'), 0, 0, z));
  g.add(at(part(box(0.012, 0.04, 0.012, 0.003), PAL.gold), 0, 0.075, -0.28));
  const fuse = part(new THREE.TorusGeometry(0.03, 0.004, 4, 10, Math.PI * 1.2), '#3a2a1a', { ink: false });
  g.add(at(rot(fuse, 0, Math.PI / 2, 0), 0, 0.05, 0.22));
  // The rocket sitting in the mouth, nose toward the crosshair.
  const rocket = new THREE.Group();
  const rb = ptex('rocketBody', 16, 8, (c) => {
    fill(c, PAL.red, 0, 0, 16, 8);
    fill(c, PAL.cream, 0, 3, 16, 2);
    fill(c, '#ff8a8a', 0, 0, 16, 1);
  }, true);
  rocket.add(part(tubeZ(0.04, 0.04, 0.12, 14), PAL.white, { map: rb }));
  rocket.add(at(part(new THREE.ConeGeometry(0.041, 0.08, 14).rotateX(-Math.PI / 2), PAL.gold), 0, 0, -0.1));
  g.add(at(rocket, 0, 0, -0.36));
  const muzzle = at(new THREE.Object3D(), 0, 0, -0.36);
  g.add(muzzle);
  // A wooden pistol grip under the tube, and his right hand on it.
  const grip = part(box(0.05, 0.13, 0.065, 0.014), '#9a6a3a');
  grip.rotation.x = 0.35;
  g.add(at(grip, 0, -0.1, 0.02));
  g.add(at(part(box(0.014, 0.036, 0.014, 0.004), PAL.gold), 0, -0.075, -0.04));
  const rh = fist(heroIdx, 0.03);
  rh.rotation.set(0.35, -Math.PI / 2, Math.PI / 2);
  g.add(at(rh, 0.004, -0.1, 0.02));
  sleeve(g, rh, new THREE.Vector3(0.3, -0.6, 1));
  return { root: g, rocket, muzzle, flash: 0xffa040 };
}

// ---------------------------------------------------------------- the layer
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 5);
    this.amb = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.amb);
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(-0.6, 1, 0.7);
    this.scene.add(sun);
    // A cool rim from behind so edges pick out against the dark street.
    this.rim = new THREE.DirectionalLight(0x9ad8ff, 0.7);
    this.rim.position.set(0.8, 0.4, -1);
    this.scene.add(this.rim);
    // Muzzle light, flashed when firing.
    this.flash = new THREE.PointLight(0xffffff, 0, 0.5, 2);
    this.scene.add(this.flash);
    this.fixed = this.scene.children.length;
    this.cache = {};
    this.shown = null;
    this.pumpPh = 0;
    this.pumpHalf = 0;
    this.sway = { x: 0, y: 0, vx: 0, vy: 0 };
    this.kick = 0;
    this.kickV = 0;
    this.lastA = null;
    this.lastFire = 0;
    this.yoSpin = 0;
    this.diskT = 0;
    // Work out where the muzzles land on screen so the sim fires from there.
    const where = (o) => {
      const p = o.getWorldPosition(new THREE.Vector3()).project(this.camera);
      return { x: Math.round((p.x + 1) * 0.5 * W), y: Math.round((1 - p.y) * 0.5 * H) };
    };
    for (const [k, hi] of [['soaker', 0], ['laser', 4], ['rocket', 3], ['floppy', 2], ['yoyo', 1]]) {
      const m = this.build(hi, k);
      this.scene.add(m.hold);
      m.hold.updateMatrixWorld(true);
      MUZZLE[k] = k === 'yoyo' ? [where(m.parts.muzzle), where(m.parts.muzzle2)] : where(m.parts.muzzle);
      this.scene.remove(m.hold);
    }
  }

  // Which 3D models a hero's first-person view uses.
  static kinds(gun) {
    if (gun === 'soaker') return ['soaker'];
    if (gun === 'laser') return ['laser', 'scooter'];
    if (gun === 'rocket') return ['rocket', 'pogo'];
    if (gun === 'yoyo') return ['yoyo'];
    if (gun === 'floppy') return ['floppy'];
    return [];
  }

  build(heroIdx, kind) {
    const key = heroIdx + kind;
    if (this.cache[key]) return this.cache[key];
    const hold = new THREE.Group();
    let parts;
    // Held low and to the right, parallel-ish to the view with a slight turn in, so you see the left
    // side of the weapon while it still points at the crosshair.
    if (kind === 'soaker') {
      parts = soaker(heroIdx);
      hold.position.set(0.17, -0.18, -0.64);
      hold.rotation.set(0.1, 0.3, 0);
    } else if (kind === 'laser') {
      parts = laser(heroIdx);
      hold.position.set(0.16, -0.16, -0.62);
      hold.rotation.set(0.12, 0.33, 0.1);
    } else if (kind === 'rocket') {
      parts = rocketLauncher(heroIdx);
      hold.position.set(0.18, -0.17, -0.6);
      hold.rotation.set(0.1, 0.28, 0);
    } else if (kind === 'yoyo') {
      parts = yoyos(heroIdx);
      hold.position.set(0, -0.15, -0.5);
      hold.rotation.set(0.2, 0, 0);
    } else if (kind === 'floppy') {
      parts = floppies(heroIdx);
      hold.position.set(0.02, -0.145, -0.5);
      hold.rotation.set(0.15, 0, 0);
    } else {
      parts = handlebar(heroIdx, kind);
      hold.position.set(-0.26, -0.16, -0.55);
      hold.rotation.set(0.8, 0.15, 0.05);
    }
    hold.add(parts.root);
    return (this.cache[key] = { hold, parts, base: hold.position.clone(), baseRot: hold.rotation.clone(), kind });
  }

  // Tint the lights to the district, and dim them for a Blackout.
  light(world) {
    if (!world?.amb) return;
    const a = world.amb;
    const m = Math.max(a[0], a[1], a[2]) || 1;
    const k = Math.min(1, m / 0.3);
    this.amb.color.setRGB(0.55 + 0.45 * (a[0] / m), 0.55 + 0.45 * (a[1] / m), 0.55 + 0.45 * (a[2] / m));
    this.amb.intensity = 0.45 + 0.35 * k;
    const f = world.scene?.fog?.color;
    if (f) this.rim.color.setRGB(Math.min(1, 0.4 + f.r * 2.5), Math.min(1, 0.4 + f.g * 2.5), Math.min(1, 0.5 + f.b * 2.5));
  }

  // Set up this frame's view models; returns the overlay to draw, or null.
  frame(sim, t, dt, bob, world) {
    const P = sim.player;
    const kinds = ViewModel.kinds(P.hero.gun.kind);
    const want = kinds.map((k) => this.build(P.heroIdx, k));
    if (this.shown !== want.map((m) => m.hold.uuid).join()) {
      while (this.scene.children.length > this.fixed) this.scene.remove(this.scene.children[this.fixed]);
      for (const m of want) this.scene.add(m.hold);
      this.shown = want.map((m) => m.hold.uuid).join();
    }
    if (!want.length || P.down) return null;
    this.light(world);
    const G = P.hero.gun;
    dt = Math.min(dt, 0.05);
    // Sway: the weapon lags behind when you turn or look up and down, then springs back.
    const da = this.lastA == null ? 0 : wrapA(P.a - this.lastA);
    const dp = this.lastP == null ? 0 : (P.pitch || 0) - this.lastP;
    this.lastA = P.a;
    this.lastP = P.pitch || 0;
    const S0 = this.sway;
    const tx = Math.max(-0.035, Math.min(0.035, (-da / Math.max(dt, 1e-3)) * 0.006));
    const ty = Math.max(-0.025, Math.min(0.025, (dp / Math.max(dt, 1e-3)) * 0.006));
    S0.vx += ((tx - S0.x) * 90 - S0.vx * 14) * dt;
    S0.vy += ((ty - S0.y) * 90 - S0.vy * 14) * dt;
    S0.x += S0.vx * dt;
    S0.y += S0.vy * dt;
    // Recoil: each shot kicks, a spring brings it back.
    const firing = P.fireAnim > 0;
    if (firing && !this.lastFire) this.kickV += { soaker: 0.6, laser: 0.2, rocket: 3.2, yoyo: 1.2, floppy: 1.4 }[G.kind] || 0.5;
    if (firing && G.kind === 'soaker') this.kickV += dt * 6;
    this.lastFire = firing ? 1 : 0;
    this.kickV += (-this.kick * 220 - this.kickV * 22) * dt;
    this.kick += this.kickV * dt;
    const kick = this.kick;
    // Idle breathing and the ride's bob (bob comes in pixels; about 0.0021 view units each).
    const br = Math.sin(t * 1.7);
    const bx = bob.bx * 0.0021 + S0.x;
    const by = -bob.by * 0.0021 + S0.y + br * 0.0025;
    for (const m of want) {
      const bar = m.kind === 'pogo' || m.kind === 'scooter';
      const k = bar ? 0.25 : 1;
      m.hold.position.set(m.base.x + bx, m.base.y + by, m.base.z + kick * 0.035 * k);
      m.hold.rotation.set(m.baseRot.x + kick * 0.18 * k + br * 0.006 - S0.y * 1.5, m.baseRot.y + S0.x * 2.2, m.baseRot.z - S0.x * 1.2);
    }
    const S = want[0].parts;
    if (G.kind === 'soaker') {
      // Refilling pressure: she works the pump until the tank is full again.
      const pumping = P.pumpT <= 0 && P.tank < G.tank - 0.5;
      this.pumpPh = pumping ? this.pumpPh + dt * 7 : 0;
      const stroke = pumping ? 0.5 - 0.5 * Math.cos(this.pumpPh) : 0;
      const half = Math.floor(this.pumpPh / Math.PI);
      if (pumping && half !== this.pumpHalf) sfx.pump(half % 2 === 0);
      this.pumpHalf = half;
      S.pump.position.z = PUMP_Z - stroke * 0.07;
      const f = Math.max(0.02, P.tank / G.tank);
      S.water.scale.set(1, f, 1);
      S.water.position.y = -0.03 * (1 - f);
      S.needle.rotation.x = 0;
      S.needle.rotation.z = -1.2 + 2.4 * f;
    }
    if (G.kind === 'laser') {
      S.glow.visible = !!sim.laser;
      S.button.position.y = sim.laser ? 0.016 : 0.02;
    }
    if (G.kind === 'yoyo') {
      // Yo-yos spin in the hand; a thrown one leaves just the string running out to it.
      this.yoSpin += dt * 14;
      const out = new Set(sim.projs.filter((p) => p.kind === 'yoyo' && p.o === sim.local && !p.orbit).map((p) => p.hand));
      [S.L, S.R].forEach((h, i) => {
        const gone = out.has(i);
        h.yo.visible = !gone;
        h.line.visible = false;
        h.spin.rotation.x = this.yoSpin * (i ? 1 : -1);
        h.root.position.z = gone ? -0.05 : 0;
        h.root.position.y = gone ? 0.02 : 0;
        if (gone) {
          const pr = sim.projs.find((p) => p.kind === 'yoyo' && p.o === sim.local && p.hand === i);
          const d = pr ? Math.hypot(pr.x - P.x, pr.y - P.y) : 1;
          h.line.scale.set(1, 1, Math.min(3, d * 0.5));
        }
      });
    }
    if (G.kind === 'floppy') {
      // Throw: the right hand flicks forward and the disk is gone; the next one pops up from below.
      const throwing = firing;
      const reload = !throwing && P.fireCd > 0.05;
      S.disk.visible = !throwing && !reload;
      S.R.position.set(S.rBase.x - (throwing ? 0.02 : 0), S.rBase.y + (throwing ? 0.02 : reload ? -0.05 : 0), S.rBase.z - (throwing ? 0.05 : 0));
      S.R.rotation.x = throwing ? -0.3 : 0;
    }
    if (G.kind === 'rocket') S.rocket.visible = P.fireCd <= 0.05;
    // Muzzle light.
    const mz = S.muzzle;
    if (mz && firing && G.kind !== 'laser') {
      mz.getWorldPosition(this.flash.position);
      this.flash.color.setHex(S.flash || 0xffffff);
      this.flash.intensity = G.kind === 'rocket' ? 1.6 : G.kind === 'soaker' ? 0.6 : 0;
    } else if (G.kind === 'laser' && sim.laser) {
      S.muzzle.getWorldPosition(this.flash.position);
      this.flash.color.setHex(0xff3030);
      this.flash.intensity = 1.2 + Math.random() * 0.4;
    } else this.flash.intensity *= 0.6;
    return { scene: this.scene, camera: this.camera };
  }
}
