// The 3D city. A level's ASCII map becomes real geometry: storefronts under towers of lit windows,
// jumbotrons, subway tile, server racks. Lighting is baked into vertex colours from streetlamps,
// neon and fluorescents (like the sector lighting of the old shooters), then fog fades it to night.
import * as THREE from 'three';
import { TPU, drawJumbo, drawRack, NEON_WORDS } from '../gfx/textures.js';
import { PAL, PARTY, rgb } from '../core/palette.js';
import { hash2, mulberry32, TAU } from '../core/util.js';

// Wall styles by map character. h = [min, max] height; bands = [fromY, texture, texture height in units].
const WALLS = {
  '#': { h: [3, 6], bands: [[0, 'brick', 2], [1.25, 'brickUpper', 4]] },
  S: { h: [4, 9], bands: [[0, 'shop', 1.25], [1.25, 'shopUpper', 4]] },
  P: { h: [3, 6], bands: [[0, 'poster', 1.25], [1.25, 'posterUpper', 4]] },
  J: { h: [5, 7], bands: [[0, 'shop', 1.25], [1.25, 'jumbo', 2], [3.25, 'shopUpper', 4]] },
  L: { h: [8, 8], bands: [[0, 'tower', 8]] },
  X: { h: [7, 13], bands: [[0, 'glass', 2]] },
  M: { h: [1.75, 1.75], bands: [[0, 'tile', 1.75]] },
  G: { h: [1.75, 1.75], bands: [[0, 'pillar', 1.75]] },
  R: { h: [1.5, 1.5], bands: [[0, 'rack', 1.5]] },
  D: { h: [1.6, 1.6], bands: [[0, 'dataWall', 1.5]] },
  T: { h: [1.4, 1.4], bands: [[0, 'train', 1.4]] },
};
const TEX_W = { brick: 2, brickUpper: 4, shop: 8, shopUpper: 4, poster: 4, posterUpper: 4, jumbo: 3, tower: 2, glass: 2, tile: 2, pillar: 1, rack: 2, dataWall: 2, train: 4 };
const FLOOR_TEX = { street: ['street', 2], walk: ['walk', 1], stripe: ['stripe', 2], platform: ['platform', 1], tracks: ['tracks', 1], edge: ['edge', 1], raised: ['raised', 1], cable: ['cable', 1], roof: ['roof', 1], stage: ['stage', 1] };

const INDOOR = {
  'Subway Platform': { ceil: 1.75, ceilTex: 'subwayCeil', ceilW: 2, amb: [0.5, 0.52, 0.5] },
  'Bank Server Room': { ceil: 1.6, ceilTex: 'dropCeil', ceilW: 1, amb: [0.42, 0.5, 0.6] },
};
const OUT_AMB = {
  'Times Square': [0.5, 0.42, 0.7],
  Broadway: [0.54, 0.4, 0.62],
  'The Ball Drop': [0.56, 0.4, 0.6],
};

const col3 = (c, k = 1) => rgb(c).map((v) => (v / 255) * k);

class GeoBuilder {
  constructor() {
    this.parts = new Map();
  }
  part(key) {
    let p = this.parts.get(key);
    if (!p) {
      p = { pos: [], uv: [], col: [], idx: [] };
      this.parts.set(key, p);
    }
    return p;
  }
  // Quad from four corners (counter-clockwise seen from the front) with uvs and colours.
  quad(key, v, uv, c) {
    const p = this.part(key);
    const base = p.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      p.pos.push(v[i][0], v[i][1], v[i][2]);
      p.uv.push(uv[i][0], uv[i][1]);
      p.col.push(c[i][0], c[i][1], c[i][2]);
    }
    p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build(textures, group) {
    for (const [key, p] of this.parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
      g.setIndex(p.idx);
      g.computeBoundingSphere();
      const m = new THREE.MeshBasicMaterial({ map: textures[key], vertexColors: true, fog: true });
      const mesh = new THREE.Mesh(g, m);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }
}

export class World {
  constructor(textures, sprites) {
    this.T = textures;
    this.S = sprites;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.05, 160);
    this.camera.rotation.order = 'YXZ';
    this.level = null;
    this.t = 0;
    this.buildDynamic();
  }

  // ------------------------------------------------------------ static level
  load(map, levelN) {
    if (this.level) {
      this.scene.remove(this.level);
      this.level.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) if (!m.userData.keep) m.dispose();
      });
    }
    this.map = map;
    this.levelN = levelN;
    const g = new THREE.Group();
    this.level = g;
    const indoor = INDOOR[map.name];
    this.indoor = indoor;
    const fog = map.fog.map((v) => v / 255);
    const fogCol = new THREE.Color(fog[0], fog[1], fog[2]);
    this.scene.fog = indoor ? new THREE.Fog(fogCol, 2.5, 17) : new THREE.Fog(fogCol, 7, 42);
    this.scene.background = fogCol;
    this.amb = indoor ? indoor.amb : OUT_AMB[map.name] || [0.3, 0.25, 0.4];
    this.heights = this.computeHeights(map);
    this.lights = this.placeLights(map);
    const B = new GeoBuilder();
    this.buildWalls(B, map);
    this.buildFloor(B, map);
    if (!indoor) this.buildCurbs(B, map);
    B.build(this.T, g);
    this.buildProps(g, map);
    this.buildDecor(g, map);
    this.buildLamps(g, map);
    this.beams = [];
    this.neonFlicker = [];
    if (!indoor) {
      this.buildSky(g, map);
      this.buildNeon(g, map);
      this.buildSearchlights(g, map);
    } else if (map.name === 'Subway Platform') this.buildSubway(g, map);
    else this.buildServerRoom(g, map);
    if (map.name === 'The Ball Drop') this.buildBall(g, map);
    this.jumboRuns = map.walls.some((w, i) => map.wallChar[i] === 'J');
    this.scene.add(g);
  }

  computeHeights(map) {
    const hs = new Float32Array(map.w * map.h);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        if (!map.walls[i]) continue;
        const def = WALLS[map.wallChar[i]];
        const [a, b] = def.h;
        // Buildings come in blocks of three cells so the skyline steps like real frontage.
        const r = hash2(Math.floor(x / 3) + map.w, Math.floor(y / 3) + map.h * 7);
        hs[i] = a === b ? a : Math.round((a + (b - a) * r) * 2) / 2;
      }
    }
    return hs;
  }

  placeLights(map) {
    const L = [];
    const add = (x, y, z, r, c, k = 1) => L.push({ x, y, z, r, c: typeof c === 'string' ? col3(c) : c, k });
    const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? '#' : map.wallChar[y * map.w + x] || '.');
    this.lampSpots = [];
    if (this.indoor) {
      const cool = map.name === 'Subway Platform' ? [0.9, 1, 0.85] : [0.75, 0.95, 1];
      for (let y = 1; y < map.h - 1; y += 3) {
        for (let x = 2; x < map.w - 1; x += 4) {
          if (!map.walls[y * map.w + x]) add(x + 0.5, this.indoor.ceil - 0.05, y + 0.5, 4.2, cool, 0.85);
        }
      }
      if (map.name === 'Bank Server Room') {
        for (let i = 0; i < map.w * map.h; i++) {
          if (map.wallChar[i] === 'R' && i % 3 === 0) add((i % map.w) + 0.5, 1, Math.floor(i / map.w) + 0.5, 2.2, PAL.lime, 0.35);
        }
      }
      // Emergency red at the spawn tunnels.
      for (const s of map.spawns) add(s.x, 1.2, s.y, 3.2, PAL.red, 0.6);
      return L;
    }
    // Outdoors: sodium streetlamps along the sidewalks, neon off the storefronts, jumbotron glow.
    for (let y = 1; y < map.h - 1; y++) {
      for (let x = 1; x < map.w - 1; x++) {
        const i = y * map.w + x;
        if (map.walls[i]) continue;
        const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => map.walls[(y + oy) * map.w + x + ox]);
        if (map.grid[y][x] === ':' && nearWall && (x * 7 + y * 3) % 9 === 0) {
          add(x + 0.5, 2.2, y + 0.5, 5.5, [1.0, 0.62, 0.3], 1.1);
          this.lampSpots.push({ x: x + 0.5, y: y + 0.5 });
        }
      }
    }
    const neon = [PAL.pink, PAL.cyan, PAL.gold, PAL.lilac];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const ch = at(x, y);
        if (!'SPJ'.includes(ch) || (x + y) % 3) continue;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (map.walls[(y + oy) * map.w + x + ox] !== 0 || x + ox < 0 || y + oy < 0 || x + ox >= map.w || y + oy >= map.h) continue;
          if (ch === 'J') add(x + 0.5 + ox * 0.9, 2.2, y + 0.5 + oy * 0.9, 5, [0.55, 0.85, 1], 0.9);
          else add(x + 0.5 + ox * 0.7, 1.1, y + 0.5 + oy * 0.7, 3, neon[(x * 3 + y) % neon.length], 0.8);
        }
      }
    }
    if (map.name === 'The Ball Drop') {
      add(13, 3, 8, 9, [1, 0.9, 1], 0.8);
      for (const s of map.spawns) add(s.x, 1.2, s.y, 3, PAL.pink, 0.5);
    }
    return L;
  }

  lightAt(x, y, z, nx, ny, nz) {
    const a = this.amb;
    const shade = ny > 0.5 ? 1 : ny < -0.5 ? 0.75 : Math.abs(nx) > 0.5 ? 0.9 : 0.72;
    let r = a[0] * shade;
    let g = a[1] * shade;
    let b = a[2] * shade;
    for (const L of this.lights) {
      const dx = L.x - x;
      const dy = L.y - y;
      const dz = L.z - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > L.r * L.r) continue;
      const d = Math.sqrt(d2) || 0.001;
      const att = (1 - d / L.r) ** 2;
      const lam = Math.max(0, (dx * nx + dy * ny + dz * nz) / d) * 0.75 + 0.25;
      const k = att * lam * L.k;
      r += L.c[0] * k;
      g += L.c[1] * k;
      b += L.c[2] * k;
    }
    return [Math.min(1.5, r), Math.min(1.5, g), Math.min(1.5, b)];
  }

  buildWalls(B, map) {
    const { w, h } = map;
    const H = this.heights;
    const hAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 999 : H[y * w + x]);
    const faces = [
      // [dx, dy, normal, corner offsets along the face (a then b), right-vector sign]
      { ox: 0, oy: -1, n: [0, 0, -1], a: [1, 0], b: [0, 0], ru: [-1, 0] },
      { ox: 0, oy: 1, n: [0, 0, 1], a: [0, 1], b: [1, 1], ru: [1, 0] },
      { ox: -1, oy: 0, n: [-1, 0, 0], a: [0, 0], b: [0, 1], ru: [0, 1] },
      { ox: 1, oy: 0, n: [1, 0, 0], a: [1, 1], b: [1, 0], ru: [0, -1] },
    ];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!map.walls[i]) continue;
        const ch = map.wallChar[i];
        const def = WALLS[ch];
        const top = H[i];
        for (const f of faces) {
          const nh = hAt(x + f.ox, y + f.oy);
          if (nh >= top) continue;
          const ax = x + f.a[0];
          const az = y + f.a[1];
          const bx = x + f.b[0];
          const bz = y + f.b[1];
          // u runs left to right as seen from outside the face.
          const ua = ax * f.ru[0] + az * f.ru[1];
          const ub = bx * f.ru[0] + az * 0 + bz * f.ru[1];
          const bands = def.bands;
          for (let bi = 0; bi < bands.length; bi++) {
            const [from, tex, texH] = bands[bi];
            const to = bi + 1 < bands.length ? bands[bi + 1][0] : top;
            const y0 = Math.max(from, nh);
            const y1 = Math.min(to, top);
            if (y1 <= y0) continue;
            const tw = TEX_W[tex];
            // Split tall bands into one-unit rows so the baked light can vary with height.
            for (let s0 = y0; s0 < y1 - 1e-4; s0 = Math.min(y1, Math.floor(s0 + 1))) {
              const s1 = Math.min(y1, Math.floor(s0 + 1));
              const v0 = (s0 - from) / texH;
              const v1 = (s1 - from) / texH;
              const high = s0 >= 2;
              const lit = (px, py, pz) => {
                const c = this.lightAt(px + f.n[0] * 0.05, py, pz + f.n[2] * 0.05, f.n[0], 0, f.n[2]);
                // Screens light themselves; upper storeys glow with their own windows.
                if (tex === 'jumbo') return [1.25, 1.25, 1.25];
                return high ? c.map((v) => Math.max(v, 0.62)) : c;
              };
              B.quad(
                tex,
                [[ax, s0, az], [bx, s0, bz], [bx, s1, bz], [ax, s1, az]],
                [[ua / tw, v0], [ub / tw, v0], [ub / tw, v1], [ua / tw, v1]],
                [lit(ax, s0, az), lit(bx, s0, bz), lit(bx, s1, bz), lit(ax, s1, az)],
              );
            }
          }
        }
        // Roofs only where you might see them (low racks, pillars under a ceiling are hidden).
        if (!this.indoor && top < 4) {
          const c = this.lightAt(x + 0.5, top + 0.1, y + 0.5, 0, 1, 0);
          B.quad(def.bands[def.bands.length - 1][1], [[x, top, y + 1], [x + 1, top, y + 1], [x + 1, top, y], [x, top, y]], [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]], [c, c, c, c]);
        }
      }
    }
  }

  buildFloor(B, map) {
    const { w, h } = map;
    const cache = new Map();
    const lit = (x, z) => {
      const k = x * 1000 + z;
      let c = cache.get(k);
      if (!c) {
        c = this.lightAt(x, 0, z, 0, 1, 0);
        cache.set(k, c);
      }
      return c;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (map.walls[i]) continue;
        const [tex, tw] = FLOOR_TEX[map.floorKind[i]] || FLOOR_TEX.street;
        B.quad(
          tex,
          [[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y]],
          [[x / tw, -(y + 1) / tw], [(x + 1) / tw, -(y + 1) / tw], [(x + 1) / tw, -y / tw], [x / tw, -y / tw]],
          [lit(x, y + 1), lit(x + 1, y + 1), lit(x + 1, y), lit(x, y)],
        );
        if (this.indoor) {
          const ch = this.indoor.ceil;
          const cw = this.indoor.ceilW;
          const isLight = this.indoor.ceilTex === 'dropCeil' && x % 4 === 2 && y % 3 === 1;
          const cc = (px, pz) => this.lightAt(px, ch - 0.05, pz, 0, -1, 0).map((v) => v * 0.8);
          B.quad(
            isLight ? 'lightPanel' : this.indoor.ceilTex,
            [[x, ch, y], [x + 1, ch, y], [x + 1, ch, y + 1], [x, ch, y + 1]],
            [[x / cw, y / cw], [(x + 1) / cw, y / cw], [(x + 1) / cw, (y + 1) / cw], [x / cw, (y + 1) / cw]],
            isLight ? [[1.2, 1.2, 1.2], [1.2, 1.2, 1.2], [1.2, 1.2, 1.2], [1.2, 1.2, 1.2]] : [cc(x, y), cc(x + 1, y), cc(x + 1, y + 1), cc(x, y + 1)],
          );
        }
      }
    }
  }

  // ------------------------------------------------------------ props
  mat(key) {
    this.mats = this.mats || {};
    if (!this.mats[key]) {
      this.mats[key] = new THREE.MeshBasicMaterial({ map: this.T[key], vertexColors: true, fog: true });
      this.mats[key].userData.keep = true;
    }
    return this.mats[key];
  }

  // Box with per-face textures and baked light. faces: [px, nx, py, ny, pz, nz] texture keys.
  box(w, h, d, faces, x, y, z, rot = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const col = [];
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const nx = nrm.getX(i);
      const nz = nrm.getZ(i);
      const wx = x + lx * c + lz * s;
      const wz = z - lx * s + lz * c;
      const l = this.lightAt(wx, y + pos.getY(i), wz, nx * c + nz * s, nrm.getY(i), -nx * s + nz * c);
      col.push(l[0], l[1], l[2]);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mats = (Array.isArray(faces) ? faces : [faces, faces, faces, faces, faces, faces]).map((k) => this.mat(k));
    const m = new THREE.Mesh(g, mats);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    return m;
  }

  cylinder(rt, rb, h, key, topKey, x, z) {
    const g = new THREE.CylinderGeometry(rt, rb, h, 8, 1, false);
    g.translate(0, h / 2, 0);
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const col = [];
    for (let i = 0; i < pos.count; i++) {
      const l = this.lightAt(x + pos.getX(i), pos.getY(i), z + pos.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      col.push(l[0], l[1], l[2]);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, [this.mat(key), this.mat(topKey), this.mat(key)]);
    m.position.set(x, 0, z);
    return m;
  }

  buildProps(group, map) {
    for (const p of map.props) {
      const r = hash2(p.x * 10, p.y * 10);
      const x = p.x;
      const z = p.y;
      if (p.ch === 't') {
        const rot = r < 0.5 ? 0 : Math.PI;
        const car = new THREE.Group();
        car.add(this.box(1.9, 0.5, 0.86, ['taxiFront', 'taxiFront', 'gold', 'iron', 'taxiSide', 'taxiSide'], x, 0.1, z, rot));
        car.add(this.box(1.0, 0.34, 0.8, ['gold', 'gold', 'gold', 'gold', 'taxiCabin', 'taxiCabin'], x - Math.cos(rot) * 0.1, 0.6, z, rot));
        car.add(this.box(0.34, 0.12, 0.12, 'newsBox', x, 0.94, z, rot));
        car.add(this.box(1.7, 0.1, 0.8, 'iron', x, 0, z, rot));
        group.add(car);
      } else if (p.ch === 'o') {
        group.add(this.cylinder(0.27, 0.22, 0.75, 'can', 'trashTop', x, z));
      } else if (p.ch === 'n') {
        group.add(this.box(0.5, 0.85, 0.45, ['red', 'red', 'red', 'red', 'newsBox', 'red'], x, 0, z, r * 0.6 - 0.3));
      } else if (p.ch === 'x') {
        const rot = r < 0.5 ? 0 : Math.PI / 2;
        const bx = new THREE.Group();
        for (const s of [-0.6, 0.6]) {
          bx.add(this.box(0.08, 0.8, 0.5, 'iron', x + Math.cos(rot) * s, 0, z - Math.sin(rot) * s, rot));
        }
        bx.add(this.box(1.5, 0.2, 0.06, 'barricade', x, 0.55, z, rot));
        bx.add(this.box(1.5, 0.2, 0.06, 'barricade', x, 0.22, z, rot));
        group.add(bx);
      } else if (p.ch === 'b') {
        const rot = map.name === 'Subway Platform' ? 0 : r < 0.5 ? 0 : Math.PI / 2;
        const bench = new THREE.Group();
        bench.add(this.box(1.3, 0.06, 0.45, 'wood', x, 0.4, z, rot));
        bench.add(this.box(1.3, 0.3, 0.06, 'wood', x - Math.sin(rot) * 0.2, 0.5, z - Math.cos(rot) * 0.2, rot));
        for (const s of [-0.55, 0.55]) bench.add(this.box(0.08, 0.4, 0.4, 'iron', x + Math.cos(rot) * s, 0, z - Math.sin(rot) * s, rot));
        group.add(bench);
      } else if (p.ch === 'c') {
        group.add(this.box(0.72, 1.05, 0.72, ['server', 'server', 'darkMetal', 'darkMetal', 'server', 'server'], x, 0, z, 0));
      }
    }
  }

  // Fullbright material (neon, lit signs): ignores baked light, still fogs.
  glow(key) {
    this.glows = this.glows || {};
    if (!this.glows[key]) {
      this.glows[key] = new THREE.MeshBasicMaterial({ map: this.T[key], fog: true });
      this.glows[key].userData.keep = true;
    }
    return this.glows[key];
  }

  // Low-poly lump (trash bags), shaded by the baked light.
  lump(r, sy, key, x, z, seed) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, sy, 1);
    g.translate(0, r * sy * 0.8, 0);
    g.rotateY(seed * TAU);
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const col = [];
    for (let i = 0; i < pos.count; i++) {
      const l = this.lightAt(x + pos.getX(i), pos.getY(i), z + pos.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      col.push(l[0], l[1], l[2]);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, this.mat(key));
    m.position.set(x, 0, z);
    return m;
  }

  buildDecor(group, map) {
    this.vents = [];
    for (const d of map.decor || []) {
      const { x, y: z, rot } = d;
      const r = hash2(x * 31, z * 17);
      const fwd = (k) => [x + Math.sin(rot) * k, z + Math.cos(rot) * k];
      if (d.kind === 'hydrant') {
        group.add(this.cylinder(0.11, 0.13, 0.42, 'red', 'red', x, z));
        group.add(this.box(0.3, 0.07, 0.07, 'red', x, 0.26, z, rot + Math.PI / 2));
        group.add(this.box(0.12, 0.08, 0.12, 'gold', x, 0.42, z, rot));
      } else if (d.kind === 'payphone') {
        group.add(this.box(0.06, 1.3, 0.06, 'steel', x, 0, z, rot));
        group.add(this.box(0.42, 0.6, 0.2, ['steel', 'steel', 'blue', 'steel', 'payphone', 'steel'], ...[fwd(0.06)[0]], 0.72, fwd(0.06)[1], rot));
        group.add(this.box(0.5, 0.08, 0.28, 'blue', fwd(0.06)[0], 1.32, fwd(0.06)[1], rot));
      } else if (d.kind === 'mailbox') {
        group.add(this.box(0.46, 0.72, 0.4, ['blue', 'blue', 'blue', 'blue', 'mailbox', 'blue'], x, 0.08, z, rot));
        for (const s of [-0.18, 0.18]) group.add(this.box(0.05, 0.1, 0.36, 'iron', x + Math.cos(rot) * s, 0, z - Math.sin(rot) * s, rot));
      } else if (d.kind === 'endSign') {
        const m = this.box(0.5, 0.72, 0.06, ['wood', 'wood', 'wood', 'wood', 'endSign', 'endSign'], x, 0, z, rot + (r - 0.5) * 0.6);
        group.add(m);
      } else if (d.kind === 'bags') {
        const n = 2 + Math.floor(r * 3);
        for (let k = 0; k < n; k++) {
          const a = k * 2.1 + r * 5;
          group.add(this.lump(0.18 + ((k * 7) % 3) * 0.03, 0.75, 'bag', x + Math.cos(a) * 0.18, z + Math.sin(a) * 0.18, r + k));
        }
      } else if (d.kind === 'manhole') {
        const m = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ map: this.T.manhole, transparent: true, alphaTest: 0.5, fog: true, color: new THREE.Color(...this.lightAt(x, 0, z, 0, 1, 0)) }));
        m.scale.set(0.9, 1, 0.9);
        m.position.set(x, 0.012, z);
        group.add(m);
        this.vents.push({ x, z, seed: r });
      } else if (d.kind === 'crtPile') {
        const keys = ['crtBlue', 'crtOff', 'crtGreen'];
        const n = 2 + Math.floor(r * 2);
        for (let k = 0; k < n; k++) {
          const s = 0.34;
          const ox = k === 2 ? 0 : (k - 0.5) * 0.36;
          const y = k === 2 ? s : 0;
          group.add(this.box(s, s, s, ['beige', 'beige', 'beige', 'beige', keys[(k + Math.floor(r * 3)) % 3], 'beige'], x + Math.cos(rot) * ox, y, z - Math.sin(rot) * ox, rot + (k - 1) * 0.25));
        }
      } else if (d.kind === 'desk') {
        group.add(this.box(0.9, 0.05, 0.5, 'wood', x, 0.68, z, rot));
        for (const s of [-0.4, 0.4]) group.add(this.box(0.05, 0.68, 0.44, 'darkMetal', x + Math.cos(rot) * s, 0, z - Math.sin(rot) * s, rot));
        group.add(this.box(0.34, 0.32, 0.32, ['beige', 'beige', 'beige', 'beige', r < 0.5 ? 'crtBlue' : 'crtGreen', 'beige'], x, 0.73, z, rot));
        group.add(this.box(0.4, 0.03, 0.14, 'beige', fwd(0.2)[0], 0.73, fwd(0.2)[1], rot));
      } else if (d.kind === 'extinguisher') {
        group.add(this.cylinder(0.07, 0.07, 0.42, 'red', 'darkMetal', x, z));
      } else if (d.kind === 'ac') {
        group.add(this.box(0.8, 0.62, 0.6, ['acSide', 'acSide', 'acTop', 'iron', 'acSide', 'acSide'], x, 0, z, rot));
      } else if (d.kind === 'speakers') {
        group.add(this.box(0.56, 0.9, 0.46, ['iron', 'iron', 'iron', 'iron', 'speaker', 'iron'], x, 0, z, rot));
        group.add(this.box(0.5, 0.8, 0.42, ['iron', 'iron', 'iron', 'iron', 'speaker', 'iron'], x, 0.9, z, rot + 0.1));
      } else if (d.kind === 'vending') {
        const mats = ['darkMetal', 'darkMetal', 'red', 'iron', 'vending', 'vending'].map((k) => (k === 'vending' ? this.glow(k) : this.mat(k)));
        const m = this.box(0.6, 1.25, 0.5, 'red', x, 0, z, rot);
        m.material = mats;
        group.add(m);
      }
    }
  }

  // Neon blade signs sticking out of the storefronts, a few of them on the blink.
  buildNeon(group, map) {
    this.neonFlicker = [];
    let n = 0;
    for (let y = 1; y < map.h - 1; y++) {
      for (let x = 1; x < map.w - 1; x++) {
        const i = y * map.w + x;
        if (!map.walls[i] || !'SP'.includes(map.wallChar[i]) || hash2(x * 5 + 1, y * 3 + 2) > 0.3) continue;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + oy) * map.w + x + ox;
          if (map.walls[j] || map.grid[y + oy][x + ox] !== ':') continue;
          const [word] = NEON_WORDS[(x * 3 + y * 5) % NEON_WORDS.length];
          const key = 'neon' + word;
          const tex = this.T[key];
          const hgt = (tex.image.height / 12) * 0.42;
          // The sign's broad faces run perpendicular to the wall.
          const rot = ox !== 0 ? 0 : Math.PI / 2;
          const px = x + 0.5 + ox * 0.62;
          const pz = y + 0.5 + oy * 0.62;
          const g = new THREE.BoxGeometry(0.34, hgt * 0.8, 0.05);
          g.translate(0, hgt / 2, 0);
          const mat = this.glow(key);
          const side = this.mat('iron');
          const m = new THREE.Mesh(g, [side, side, side, side, mat, mat]);
          m.position.set(px, 1.7, pz);
          m.rotation.y = rot + Math.PI / 2;
          group.add(m);
          group.add(this.box(0.24, 0.04, 0.04, 'iron', x + 0.5 + ox * 0.5, 1.7 + hgt - 0.1, y + 0.5 + oy * 0.5, rot));
          if (n++ % 3 === 0) this.neonFlicker.push(mat);
          break;
        }
      }
    }
  }

  // Curbs where the sidewalk meets the street.
  buildCurbs(B, map) {
    const street = (x, y) => !map.walls[y * map.w + x] && map.grid[y][x] !== ':';
    const H = 0.07;
    for (let y = 1; y < map.h - 1; y++) {
      for (let x = 1; x < map.w - 1; x++) {
        if (map.walls[y * map.w + x] || map.grid[y][x] !== ':') continue;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!street(x + ox, y + oy)) continue;
          // Edge on the street side of this cell.
          const ex = ox === 1 ? x + 1 : ox === -1 ? x : null;
          const ez = oy === 1 ? y + 1 : oy === -1 ? y : null;
          const a = ex !== null ? [ex, ez ?? y] : [x, ez];
          const b = ex !== null ? [ex, y + 1] : [x + 1, ez];
          const c = this.lightAt(a[0] + ox * 0.1, 0.05, a[1] + oy * 0.1, ox, 0, oy).map((v) => v * 1.25);
          const top = this.lightAt(a[0], 0.1, a[1], 0, 1, 0).map((v) => v * 1.35);
          B.quad('edge', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], [a[0], H, a[1]]], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], [c, c, c, c]);
          B.quad('edge', [[b[0], 0, b[1]], [a[0], 0, a[1]], [a[0], H, a[1]], [b[0], H, b[1]]], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], [c, c, c, c]);
          const ix = -ox * 0.12;
          const iz = -oy * 0.12;
          B.quad('edge', [[a[0], H, a[1]], [b[0], H, b[1]], [b[0] + ix, H, b[1] + iz], [a[0] + ix, H, a[1] + iz]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], [top, top, top, top]);
          B.quad('edge', [[a[0] + ix, H, a[1] + iz], [b[0] + ix, H, b[1] + iz], [b[0], H, b[1]], [a[0], H, a[1]]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], [top, top, top, top]);
        }
      }
    }
  }

  // Searchlights sweeping the sky behind the skyline.
  buildSearchlights(group, map) {
    this.beams = [];
    const g = new THREE.CylinderGeometry(4, 0.4, 70, 10, 1, true);
    g.translate(0, 35, 0);
    const spots = [[-14, -10], [map.w + 14, -8], [map.w / 2, map.h + 16]];
    spots.forEach(([x, z], k) => {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: k === 1 ? 0xffd8f0 : 0xd8f0ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.set(x, -2, z);
      m.userData.ph = k * 2.1;
      this.beams.push(m);
      group.add(m);
    });
  }

  // Subway: overhead pipes, hanging line signs.
  buildSubway(group, map) {
    const c = this.indoor.ceil;
    for (const z of [3.7, 7.5, 11.3]) {
      const m = this.box(map.w - 2, 0.1, 0.1, 'darkMetal', map.w / 2, c - 0.16, z, 0);
      group.add(m);
    }
    group.add(this.box(map.w - 2, 0.06, 0.06, 'red', map.w / 2, c - 0.26, 3.9, 0));
    for (let x = 6.5; x < map.w - 2; x += 6) {
      for (const [z, key] of [[3.6, 'signDown'], [11.4, 'signUp']]) {
        group.add(this.box(0.02, 0.2, 0.02, 'iron', x - 0.5, c - 0.2, z, 0));
        group.add(this.box(0.02, 0.2, 0.02, 'iron', x + 0.5, c - 0.2, z, 0));
        const s = this.box(1.3, 0.3, 0.04, 'iron', x, c - 0.5, z, 0);
        s.material = [this.mat('iron'), this.mat('iron'), this.mat('iron'), this.mat('iron'), this.glow(key), this.glow(key)];
        group.add(s);
      }
    }
  }

  // Server room: cable trays over the aisles, a slow red beacon.
  buildServerRoom(group, map) {
    const c = this.indoor.ceil;
    for (const z of [3.5, 15.5, 6.5, 12.5]) group.add(this.box(map.w - 3, 0.05, 0.4, ['darkMetal', 'darkMetal', 'cable', 'darkMetal', 'darkMetal', 'darkMetal'], map.w / 2, c - 0.2, z, 0));
    for (const x of [4, 14, 24]) for (const z of [3.5, 15.5]) group.add(this.box(0.03, 0.15, 0.03, 'iron', x, c - 0.15, z, 0));
  }

  // Stateless ambient particles: steam from the manholes, confetti drifting down outdoors.
  ambient(t, cx, cz) {
    for (const v of this.vents || []) {
      for (let k = 0; k < 7; k++) {
        const f = (t * 0.45 + k / 7 + v.seed) % 1;
        const w = Math.sin(t * 1.3 + k * 1.7 + v.seed * 9) * 0.12 * f;
        this.particle(v.x + w + Math.sin(k * 2.3) * 0.12 * f, f * 1.8, v.z + Math.cos(k * 3.1) * 0.12 * f, f < 0.5 ? '#c8c8d8' : '#8a8aa0');
      }
    }
    if (this.indoor) return;
    const R = 16;
    for (let k = 0; k < 180; k++) {
      const sx = hash2(k, 11) * R * 2;
      const sz = hash2(k, 29) * R * 2;
      const sp = 0.35 + hash2(k, 7) * 0.4;
      const y = 7 - ((t * sp + hash2(k, 3) * 7) % 7);
      // Wrap the flakes into a box that follows the camera.
      const x = cx - R + ((sx - cx + R * 64) % (R * 2)) + Math.sin(t * 2 + k) * 0.15;
      const z = cz - R + ((sz - cz + R * 64) % (R * 2)) + Math.cos(t * 1.7 + k) * 0.15;
      this.particle(x, y, z, PARTY[k % PARTY.length]);
    }
  }

  buildLamps(group, map) {
    if (this.indoor) return;
    for (const s of this.lampSpots) {
      group.add(this.box(0.08, 2.3, 0.08, 'iron', s.x, 0, s.y));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.26), new THREE.MeshBasicMaterial({ color: 0xffd08a, fog: true }));
      head.position.set(s.x, 2.32, s.y);
      group.add(head);
    }
  }

  buildSky(group, map) {
    const idx = map.name === 'Broadway' ? 1 : map.name === 'The Ball Drop' ? 4 : 0;
    const tex = this.T.skies[idx];
    tex.repeat.set(3, 1);
    const g = new THREE.CylinderGeometry(110, 110, 80, 48, 1, true);
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    m.userData.keep = true;
    const sky = new THREE.Mesh(g, m);
    sky.position.y = 28;
    sky.renderOrder = -10;
    this.sky = sky;
    group.add(sky);
    // Dark cap so the top of the cylinder never shows through.
    const cap = new THREE.Mesh(new THREE.CircleGeometry(110, 24), new THREE.MeshBasicMaterial({ color: 0x05030e, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    cap.rotation.x = Math.PI / 2;
    cap.position.y = 67;
    cap.renderOrder = -10;
    sky.add(cap);
    cap.position.set(0, 39, 0);
  }

  buildBall(group, map) {
    // The Times Square ball, faceted crystal in party colours. It creeps down as midnight nears.
    const g = new THREE.IcosahedronGeometry(1.25, 1);
    const col = [];
    const rnd = mulberry32(2000);
    for (let i = 0; i < g.attributes.position.count; i += 3) {
      const c = col3(PARTY[Math.floor(rnd() * PARTY.length)], 0.8 + rnd() * 0.5);
      for (let k = 0; k < 3; k++) col.push(...c);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.ball = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    const t = Math.max(0, Math.min(1, (this.levelN - 41) / 9));
    this.ball.position.set(13, 13.5 - t * 4.2, 8);
    group.add(this.ball);
    // The flagpole it rides down.
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 0.2), new THREE.MeshBasicMaterial({ color: 0x8a8aa0, fog: true }));
    pole.position.set(13, 11, 8);
    group.add(pole);
  }

  // ------------------------------------------------------------ dynamic things (sprites, particles, beams)
  buildDynamic() {
    this.spritePool = [];
    this.spriteUsed = 0;
    this.decalPool = [];
    this.decalUsed = 0;
    this.decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const MAXP = 2000;
    this.pGeo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAXP * 3);
    this.pCol = new Float32Array(MAXP * 3);
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(this.pGeo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, sizeAttenuation: true, fog: true }));
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    // Fireworks live in the sky, far away and unfogged.
    this.fGeo = new THREE.BufferGeometry();
    this.fPos = new Float32Array(MAXP * 3);
    this.fCol = new Float32Array(MAXP * 3);
    this.fGeo.setAttribute('position', new THREE.BufferAttribute(this.fPos, 3));
    this.fGeo.setAttribute('color', new THREE.BufferAttribute(this.fCol, 3));
    this.fireworks = new THREE.Points(this.fGeo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, sizeAttenuation: true, fog: false, depthWrite: false }));
    this.fireworks.frustumCulled = false;
    this.fireworks.renderOrder = -5;
    this.scene.add(this.fireworks);
    // Lines: laser beams and yo-yo strings.
    this.lGeo = new THREE.BufferGeometry();
    this.lPos = new Float32Array(64 * 3);
    this.lCol = new Float32Array(64 * 3);
    this.lGeo.setAttribute('position', new THREE.BufferAttribute(this.lPos, 3));
    this.lGeo.setAttribute('color', new THREE.BufferAttribute(this.lCol, 3));
    this.lines = new THREE.LineSegments(this.lGeo, new THREE.LineBasicMaterial({ vertexColors: true, fog: false }));
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  beginFrame() {
    this.spriteUsed = 0;
    this.decalUsed = 0;
    this.pCount = 0;
    this.fCount = 0;
    this.lCount = 0;
  }

  // Billboard anchored at its feet. x/z are map coordinates, y is height.
  sprite(tex, x, y, z, w, h, tint) {
    let s = this.spritePool[this.spriteUsed];
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false, fog: true }));
      s.center.set(0.5, 0);
      this.spritePool.push(s);
      this.scene.add(s);
    }
    this.spriteUsed++;
    s.visible = true;
    if (s.material.map !== tex) s.material.map = tex;
    s.material.color.setRGB(tint ? tint[0] : 1, tint ? tint[1] : 1, tint ? tint[2] : 1);
    s.position.set(x, y, z);
    s.scale.set(w, h, 1);
    // Pooled sprites are reused, so reset anything a caller may have changed last frame.
    s.material.rotation = 0;
    s.center.set(0.5, 0);
    return s;
  }

  decal(tex, x, z, size, rot = 0, opacity = 1) {
    let d = this.decalPool[this.decalUsed];
    if (!d) {
      d = new THREE.Mesh(this.decalGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      d.renderOrder = 1;
      this.decalPool.push(d);
      this.scene.add(d);
    }
    this.decalUsed++;
    d.visible = true;
    if (d.material.map !== tex) d.material.map = tex;
    d.material.opacity = opacity;
    d.position.set(x, 0.01 + this.decalUsed * 0.0005, z);
    d.scale.set(size, 1, size);
    d.rotation.y = rot;
    return d;
  }

  particle(x, y, z, color) {
    if (this.pCount >= 2000) return;
    const i = this.pCount++ * 3;
    this.pPos[i] = x;
    this.pPos[i + 1] = y;
    this.pPos[i + 2] = z;
    const c = colCache(color);
    this.pCol[i] = c[0];
    this.pCol[i + 1] = c[1];
    this.pCol[i + 2] = c[2];
  }

  spark(x, y, z, color) {
    if (this.fCount >= 2000) return;
    const i = this.fCount++ * 3;
    this.fPos[i] = x;
    this.fPos[i + 1] = y;
    this.fPos[i + 2] = z;
    const c = colCache(color);
    this.fCol[i] = c[0];
    this.fCol[i + 1] = c[1];
    this.fCol[i + 2] = c[2];
  }

  line(a, b, color) {
    if (this.lCount >= 62) return;
    const c = colCache(color);
    for (const p of [a, b]) {
      const i = this.lCount++ * 3;
      this.lPos[i] = p[0];
      this.lPos[i + 1] = p[1];
      this.lPos[i + 2] = p[2];
      this.lCol[i] = c[0];
      this.lCol[i + 1] = c[1];
      this.lCol[i + 2] = c[2];
    }
  }

  endFrame() {
    for (let i = this.spriteUsed; i < this.spritePool.length; i++) this.spritePool[i].visible = false;
    for (let i = this.decalUsed; i < this.decalPool.length; i++) this.decalPool[i].visible = false;
    this.pGeo.setDrawRange(0, this.pCount);
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;
    this.fGeo.setDrawRange(0, this.fCount);
    this.fGeo.attributes.position.needsUpdate = true;
    this.fGeo.attributes.color.needsUpdate = true;
    this.lGeo.setDrawRange(0, this.lCount);
    this.lGeo.attributes.position.needsUpdate = true;
    this.lGeo.attributes.color.needsUpdate = true;
  }

  setCamera(x, y, z, yaw, pitch = 0, roll = 0) {
    const c = this.camera;
    c.position.set(x, y, z);
    // Yaw first, then pitch, like any first-person camera.
    c.rotation.order = 'YXZ';
    // Map heading a: forward is (cos a, sin a) in x/z. Three's camera looks down -z, so yaw = -a - 90deg.
    c.rotation.set(pitch, -yaw - Math.PI / 2, roll);
    if (this.sky) this.sky.position.set(x, 28, z);
  }

  // Live textures: jumbotron clock, blinking server LEDs.
  tick(dt, info) {
    this.t += dt;
    if (this.jumboRuns) {
      const key = info.jumboKey;
      if (key !== this.lastJumbo) {
        this.lastJumbo = key;
        drawJumbo(this.T.jumbo.userData.pix, info.clock, info.sub, this.t, info.jumboMode);
        this.T.jumbo.needsUpdate = true;
      }
    }
    if (this.map && this.map.name === 'Bank Server Room') {
      const k = Math.floor(this.t * 4);
      if (k !== this.lastRack) {
        this.lastRack = k;
        drawRack(this.T.rack.userData.pix, this.t);
        this.T.rack.needsUpdate = true;
      }
    }
    if (this.ball) this.ball.rotation.y += dt * 0.4;
    for (const b of this.beams) {
      const a = this.t * 0.35 + b.userData.ph;
      b.rotation.set(Math.sin(a) * 0.45, 0, Math.cos(a * 0.8) * 0.35 - 0.1);
    }
    // Neon on the blink: mostly on, now and then a stutter.
    this.neonFlicker.forEach((m, k) => {
      const ph = (this.t * 0.7 + k * 0.37) % 1;
      const off = ph > 0.9 && Math.floor(this.t * 20) % 2;
      m.color.setScalar(off ? 0.3 : 1);
    });
  }
}

const cc = new Map();
function colCache(c) {
  let v = cc.get(c);
  if (!v) {
    v = col3(c.slice(0, 7));
    cc.set(c, v);
  }
  return v;
}

export { WALLS };
