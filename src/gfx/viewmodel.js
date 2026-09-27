// First-person weapons and hands modelled in 3D, drawn over the world into the same 384x216 target so
// they go through the same dither as everything else. Toon shading (a few hard bands) and an ink
// outline keep them reading as 16-bit sprites, while real perspective has them point straight at the
// crosshair. Used for Tina's Soaker 2500, Kev's laser pointer and the pogo and scooter handlebars.
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
  const d = new Uint8Array([70, 70, 70, 255, 140, 140, 140, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const RAMP = toonRamp();

// An ink hull a little over a pixel thick at any distance.
const INK = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(PAL.ink) }, thick: { value: 0.0062 } },
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

const mats = new Map();
function toon(col, opt = {}) {
  const key = col + JSON.stringify(opt);
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: RAMP, ...opt }));
  return mats.get(key);
}

function hull(geo) {
  const g = geo.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}

// A shaded mesh with its outline. opt.ink = false skips the outline (glass).
function part(geo, col, opt = {}) {
  const m = new THREE.Mesh(geo, opt.mat || toon(col, opt.transparent ? { transparent: true, opacity: opt.opacity ?? 0.5, depthWrite: false } : {}));
  if (opt.ink !== false) m.add(new THREE.Mesh(hull(geo), INK));
  return m;
}

// Geometry helpers. Tubes run along z (forward is -z), with r0 at the front and r1 at the back.
const tubeZ = (r0, r1, len, seg = 14) => new THREE.CylinderGeometry(r1, r0, len, seg).rotateX(Math.PI / 2);
const tubeX = (r, len, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
const tubeY = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg);
const box = (w, h, d, r = 0.008) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const ball = (r) => new THREE.SphereGeometry(r, 10, 8);

function at(o, x, y, z) {
  o.position.set(x, y, z);
  return o;
}

// ---------------------------------------------------------------- hands
// Each hero's sleeve: base colour and cuff details.
function sleeveFor(i) {
  const L = LOOKS[i];
  return [
    { col: L.top.base, cuff: [[PAL.pink, 0.05, 0.022], [PAL.white, 0.075, 0.008]], glove: '#20202a' },
    { col: L.skin.base, cuff: [[PAL.white, 0.03, 0.03], [PAL.tangerine, 0.02, 0.006]], bare: true },
    { col: L.top.base, cuff: [[L.top.light, 0.02, 0.03]] },
    { col: L.top.base, cuff: [[L.top.light, 0.02, 0.026], [L.top.dark, 0.07, 0.01], [L.top.dark, 0.11, 0.01]] },
    { col: L.top.base, cuff: [['#20202a', 0.015, 0.024]], stripes: true },
  ][i];
}

// A fist closed around a grip that runs along the fist's local x axis (radius gr). The back of the
// hand faces up and toward you. flip mirrors it for a left hand. The group's `wrist` is where the
// forearm starts; add the sleeve with sleeve() once the fist is placed.
function fist(heroIdx, gr, flip = false) {
  const L = LOOKS[heroIdx];
  const S = sleeveFor(heroIdx);
  const skin = L.skin.base;
  const g = new THREE.Group();
  const ft = 0.0105;
  const sx = flip ? -1 : 1;
  // Four fingers curled round the grip, over the top and front and back underneath.
  for (let k = 0; k < 4; k++) {
    const geo = new THREE.TorusGeometry(gr + ft * 0.9, ft, 6, 12, Math.PI * 1.25).rotateZ(Math.PI * 0.35).rotateY(-Math.PI / 2);
    g.add(at(part(geo, skin), sx * (k - 1.5) * 0.0215, 0, 0));
  }
  // Back of the hand, sitting behind and above the grip; fingerless gloves for Tina.
  const back = part(box(0.092, 0.032, 0.075, 0.013), S.glove || skin);
  back.rotation.x = -0.75;
  g.add(at(back, 0, gr + 0.008, gr + 0.034));
  // Thumb, wrapped under the grip on the inner side.
  const thumb = part(new THREE.CapsuleGeometry(0.0115, 0.032, 4, 8).rotateZ(Math.PI / 2), skin);
  g.add(at(thumb, -sx * 0.034, -gr * 0.4, gr + 0.012));
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
  arm.add(at(part(tubeY(0.027, 0.03, 0.08), skin), 0, 0.02, 0));
  arm.add(at(part(tubeY(0.036, 0.044, len), S.col), 0, len / 2 + (S.bare ? 0.07 : 0.04), 0));
  for (const [c, y, h] of S.cuff) arm.add(at(part(tubeY(0.0375, 0.0375, h), c, { ink: false }), 0, y + (S.bare ? 0.07 : 0.04), 0));
  if (S.stripes) for (const a of [0.4, 0.8]) {
    const st = part(box(0.008, len, 0.008, 0.002), PAL.white, { ink: false });
    st.position.set(Math.cos(a) * 0.041, len / 2 + 0.06, Math.sin(a) * 0.041);
    arm.add(st);
  }
  arm.quaternion.copy(q);
  arm.position.copy(w);
  parent.add(arm);
}

// ---------------------------------------------------------------- the Soaker 2500
function soaker(heroIdx) {
  const lime = PAL.lime;
  const org = PAL.tangerine;
  const grape = PAL.grape;
  const gun = new THREE.Group();
  // Receiver and rear grip.
  gun.add(at(part(box(0.1, 0.11, 0.34, 0.02), lime), 0, 0, 0.02));
  gun.add(at(part(box(0.104, 0.02, 0.3, 0.006), grape), 0, -0.04, 0.02));
  gun.add(at(part(box(0.106, 0.012, 0.25, 0.004), org, { ink: false }), 0, 0.022, 0.02));
  const grip = part(box(0.06, 0.13, 0.07, 0.015), '#5aa032');
  grip.rotation.x = 0.35;
  gun.add(at(grip, 0, -0.1, 0.14));
  gun.add(at(part(box(0.014, 0.04, 0.014, 0.004), org), 0, -0.07, 0.07));
  // Pressure chamber slung under the front of the body.
  gun.add(at(part(tubeZ(0.05, 0.05, 0.2), PAL.gold), 0, -0.075, -0.13));
  for (const z of [-0.225, -0.035]) gun.add(at(part(tubeZ(0.052, 0.052, 0.014), grape, { ink: false }), 0, -0.075, z));
  // Barrel, collars and the nozzle.
  gun.add(at(part(tubeZ(0.024, 0.028, 0.44), lime), 0, 0.028, -0.36));
  gun.add(at(part(tubeZ(0.032, 0.032, 0.02), grape), 0, 0.028, -0.18));
  gun.add(at(part(tubeZ(0.032, 0.032, 0.02), grape), 0, 0.028, -0.52));
  gun.add(at(part(tubeZ(0.022, 0.03, 0.06), org), 0, 0.028, -0.56));
  gun.add(at(part(tubeZ(0.009, 0.009, 0.012), '#20202a', { ink: false }), 0, 0.028, -0.594));
  const muzzle = at(new THREE.Object3D(), 0, 0.028, -0.6);
  gun.add(muzzle);
  // Pump rod and the sliding pump with its ribs; her left hand rides on it.
  gun.add(at(part(tubeZ(0.007, 0.007, 0.26), PAL.steel), 0, -0.018, -0.32));
  const pump = new THREE.Group();
  pump.add(part(tubeZ(0.036, 0.04, 0.13), org));
  for (let k = 0; k < 5; k++) pump.add(at(part(tubeZ(0.041, 0.041, 0.008), PAL.tangerineDark, { ink: false }), 0, 0, -0.05 + k * 0.025));
  // Left hand under the pump, fingers over its left side, forearm back toward her.
  const lh = fist(heroIdx, 0.04, true);
  lh.rotation.set(0, Math.PI / 2, -2.3);
  pump.add(at(lh, 0, 0, 0.01));
  sleeve(pump, lh, new THREE.Vector3(-0.35, -0.55, 1));
  gun.add(at(pump, 0, -0.018, -0.36));
  // The reservoir on top: a clear tank with the water inside, straps and a screw cap.
  const tank = new THREE.Group();
  tank.add(part(tubeZ(0.034, 0.034, 0.2, 18), '#bfe8ff', { transparent: true, opacity: 0.45, ink: false }));
  const water = part(tubeZ(0.03, 0.03, 0.19, 18), '#3a8ae8', { ink: false });
  tank.add(water);
  for (const z of [-0.07, 0.06]) tank.add(at(part(tubeZ(0.037, 0.037, 0.014), grape), 0, 0, z));
  tank.add(at(part(tubeZ(0.022, 0.026, 0.022), grape), 0, 0, 0.11));
  gun.add(at(tank, 0, 0.078, 0.05));
  gun.add(at(part(box(0.05, 0.03, 0.14, 0.006), grape), 0, 0.058, 0.03));
  // The badge on the back of the receiver, facing you.
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 16;
  const c = cv.getContext('2d');
  c.fillStyle = PAL.grape;
  c.fillRect(0, 0, 32, 16);
  c.fillStyle = PAL.gold;
  c.font = 'bold 7px monospace';
  c.fillText('SOAKER', 1, 7);
  c.fillStyle = PAL.white;
  c.fillText('2500', 8, 15);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  gun.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshBasicMaterial({ map: tex })), 0, 0.012, 0.192));
  // Her right hand round the grip, arm coming in from the lower right.
  const rh = fist(heroIdx, 0.034);
  rh.rotation.set(0.35, -Math.PI / 2, Math.PI / 2);
  gun.add(at(rh, 0.004, -0.1, 0.14));
  sleeve(gun, rh, new THREE.Vector3(0.3, -0.6, 1));
  return { root: gun, muzzle, pump, water };
}

// ---------------------------------------------------------------- Kev's laser pointer
function laser(heroIdx) {
  const pen = new THREE.Group();
  const chrome = PAL.steelLight;
  pen.add(at(part(tubeZ(0.017, 0.019, 0.26, 16), chrome), 0, 0, -0.04));
  // Knurled grip rings.
  for (let k = 0; k < 7; k++) pen.add(at(part(tubeZ(0.0195, 0.0195, 0.006), PAL.steelDark, { ink: false }), 0, 0, 0.0 + k * 0.012));
  pen.add(at(part(tubeZ(0.0185, 0.0185, 0.012), PAL.lime), 0, 0, -0.1));
  // Lens housing and the red lens.
  pen.add(at(part(tubeZ(0.02, 0.018, 0.04), '#2a2a34'), 0, 0, -0.185));
  pen.add(at(part(tubeZ(0.009, 0.009, 0.006), PAL.red, { ink: false }), 0, 0, -0.206));
  const muzzle = at(new THREE.Object3D(), 0, 0, -0.212);
  pen.add(muzzle);
  // Pocket clip and the button under his thumb.
  pen.add(at(part(box(0.008, 0.006, 0.11, 0.002), chrome), -0.014, 0.017, 0.02));
  pen.add(at(part(box(0.012, 0.008, 0.02, 0.003), PAL.strawberry), 0, 0.019, -0.07));
  // End cap.
  pen.add(at(part(tubeZ(0.019, 0.016, 0.02), chrome), 0, 0, 0.1));
  const glow = new THREE.Mesh(ball(0.016), new THREE.MeshBasicMaterial({ color: 0xff5050 }));
  glow.position.copy(muzzle.position);
  glow.visible = false;
  pen.add(glow);
  const hand = fist(heroIdx, 0.02);
  hand.rotation.set(0, Math.PI / 2, 0.25);
  pen.add(at(hand, 0.002, -0.004, 0.03));
  sleeve(pen, hand, new THREE.Vector3(0.3, -0.6, 1));
  return { root: pen, muzzle, glow };
}

// ---------------------------------------------------------------- handlebars
// The left half of a handlebar, from the grip in her left fist to the stem in the middle.
function handlebar(heroIdx, kind) {
  const g = new THREE.Group();
  const pogo = kind === 'pogo';
  const gripCol = pogo ? PAL.strawberry : PAL.lime;
  g.add(at(part(tubeX(0.016, 0.3), PAL.steel), 0.1, 0, 0));
  // Foam or rubber grip with ribs, and an end cap.
  g.add(at(part(tubeX(0.026, 0.12), gripCol), -0.03, 0, 0));
  for (let k = 0; k < 6; k++) g.add(at(part(tubeX(0.0275, 0.006), pogo ? FLAVOURS[3].dark : '#3a6e1a', { ink: false }), -0.08 + k * 0.02, 0, 0));
  g.add(at(part(tubeX(0.024, 0.014), '#20202a'), -0.096, 0, 0));
  // Clamp and the stem dropping out of view.
  g.add(at(part(box(0.05, 0.05, 0.05, 0.01), '#2a2a30'), 0.25, 0, 0));
  const stem = part(tubeY(0.022, 0.022, 0.6), PAL.steel);
  stem.rotation.x = -0.25;
  g.add(at(stem, 0.25, -0.3, 0.07));
  if (!pogo) {
    // Scooter brake lever in front of the grip.
    const lever = part(box(0.11, 0.008, 0.012, 0.003), '#2a2a30');
    lever.rotation.y = 0.2;
    g.add(at(lever, -0.02, 0.004, -0.045));
  } else {
    // Pogo: a spring collar showing below the clamp.
    for (let k = 0; k < 3; k++) g.add(at(part(new THREE.TorusGeometry(0.028, 0.006, 5, 12).rotateX(Math.PI / 2), PAL.gold), 0.25, -0.05 - k * 0.018, 0.012 * k));
  }
  const hand = fist(heroIdx, 0.026, true);
  g.add(at(hand, -0.03, 0, 0));
  sleeve(g, hand, new THREE.Vector3(-0.3, -0.6, 1));
  return { root: g };
}

// ---------------------------------------------------------------- the layer
export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 5);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(-0.6, 1, 0.7);
    this.scene.add(sun);
    this.cache = {};
    this.shown = null;
    this.pumpPh = 0;
    this.pumpHalf = 0;
    // Work out where the muzzles land on screen so the sim fires from there.
    for (const k of ['soaker', 'laser']) {
      const m = this.build(k === 'soaker' ? 0 : 4, k);
      this.scene.add(m.hold);
      m.hold.updateMatrixWorld(true);
      const p = m.parts.muzzle.getWorldPosition(new THREE.Vector3()).project(this.camera);
      MUZZLE[k] = { x: Math.round((p.x + 1) * 0.5 * W), y: Math.round((1 - p.y) * 0.5 * H) };
      this.scene.remove(m.hold);
    }
  }

  // Which 3D models a hero's first-person view uses.
  static kinds(gun) {
    if (gun === 'soaker') return ['soaker'];
    if (gun === 'laser') return ['laser', 'scooter'];
    if (gun === 'rocket') return ['pogo'];
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
      hold.position.set(0.18, -0.2, -0.7);
      hold.rotation.set(0.1, 0.3, 0);
    } else if (kind === 'laser') {
      parts = laser(heroIdx);
      hold.position.set(0.15, -0.17, -0.55);
      hold.rotation.set(0.15, 0.35, 0.1);
    } else {
      parts = handlebar(heroIdx, kind);
      hold.position.set(-0.26, -0.16, -0.55);
      hold.rotation.set(0.8, 0.15, 0.05);
    }
    hold.add(parts.root);
    return (this.cache[key] = { hold, parts, base: hold.position.clone() });
  }

  // Set up this frame's view models; returns the overlay to draw, or null.
  frame(sim, t, dt, bob) {
    const P = sim.player;
    const kinds = ViewModel.kinds(P.hero.gun.kind);
    const want = kinds.map((k) => this.build(P.heroIdx, k));
    if (this.shown !== want.map((m) => m.hold.uuid).join()) {
      while (this.scene.children.length > 2) this.scene.remove(this.scene.children[2]);
      for (const m of want) this.scene.add(m.hold);
      this.shown = want.map((m) => m.hold.uuid).join();
    }
    if (!want.length || P.down) return null;
    const G = P.hero.gun;
    const kick = P.fireAnim > 0 ? 1 : 0;
    // Pixel bob from the ride, in view units (about 0.0022 per pixel at this depth).
    const bx = bob.bx * 0.0021;
    const by = -bob.by * 0.0021;
    for (const m of want) {
      m.hold.position.set(m.base.x + bx, m.base.y + by, m.base.z + kick * 0.012);
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
      S.pump.position.z = -0.36 + stroke * 0.08;
      const f = Math.max(0.02, P.tank / G.tank);
      S.water.scale.set(1, f, 1);
      S.water.position.y = -0.03 * (1 - f);
    }
    if (G.kind === 'laser') S.glow.visible = !!sim.laser;
    return { scene: this.scene, camera: this.camera };
  }
}
