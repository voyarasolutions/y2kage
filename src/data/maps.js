import { decorFor } from './decor.js';

// Arena maps, one per district (levels 1-10, 11-20, ...).
// Walls: # brick, S storefront, P posters, J jumbotron, L ball tower, M subway tile, G pillar,
//        R server rack, D datacentre wall, X glass tower, T parked subway train.
// Floor: . base, : sidewalk/platform, = stripes (crosswalk, tracks, cables), _ platform edge.
// Marks: @ player start, z zombie spawn. Props (solid): t taxi, o trash can, n news box,
//        x barricade, b bench, c server cabinet.


export const MAPS = [
  {
    name: 'Times Square',
    outdoor: true,
    fog: [26, 16, 52],
    floors: { '.': 'street', ':': 'walk', '=': 'stripe', _: 'walk' },
    gate: '#',
    wings: { 2: '7TH AVENUE', 3: 'DUFFY SQUARE' },
    grid: [
      '##SSSSJJJJJJJJJJSSSS##PPPS##SSPPPPSSJJJJSSS#',
      '#::::::::::::::::::::::::::#:z:::::::::::z:S',
      'S:z.......=.....=.......z::S::..t..=..t..::S',
      'S:..t.....=.....=....t....:S::.....=.....::P',
      'P:........=.....=.........:P::.##..=..##.::#',
      'P:....o...=.....=...o.....:#::.##..=..##.::J',
      '#:........=.....=.........:S::..t..=..t..::S',
      'S:...LL...............LL..:S::.....=.....::S',
      'S:...LL.......@.......LL..:2.......=.......P',
      '#:........................:2.......=.......#',
      'J:.====..............====.:2.......=.......J',
      'J:.====..............====.:J::..t..=..t..::S',
      '#:........................:#::.....=.....::S',
      'S:...LL...............LL..:S::.##..=..##.::P',
      'S:...LL.......x.......LL..:S::.##..=..##.::#',
      '#:........=.....=.........:P::.....=.....::J',
      'P:..n.....=.....=.....t...:P::.t.n.=.n.t.::S',
      'P:........=.....=.........:#::.....=.....::S',
      'S:..t.....=.....=.......n.:S::=====.=====::P',
      'S:z.......=.....=.......z.:S:z...........z:#',
      '#::::::::::::::::::::::::::#:::::::::::::::J',
      '##SSSSPPPP##3333JJJJ##SSSS##SSSSPP333PPSSSS#',
      'S::::::::::::::::::::::::::::::::::::::::::S',
      'S:z......................................z:P',
      'P:..b.....SS....................SS.....b..:#',
      '#:.........SS...n..........n...SS.........:S',
      'S:....x.............JJJJ.............x....:S',
      'S:..........t.......JJJJ.......t..........:P',
      'P:....x.............JJJJ.............x....:#',
      '#:.........SS..................SS.........:S',
      'S:..b.....SS...o............o...SS.....b..:S',
      'S:z......................................z:P',
      'P::::::::::::::::::::::::::::::::::::::::::#',
      '##SSSSPPPP####JJJJJJJJJJJJJJJJ####PPPPSSSS##',
    ],
  },
  {
    name: 'Broadway',
    outdoor: true,
    fog: [36, 14, 40],
    floors: { '.': 'street', ':': 'walk', '=': 'stripe', _: 'walk' },
    gate: '#',
    wings: { 2: 'THEATER ROW', 3: 'HERALD SQUARE' },
    grid: [
      '#SSSPPPPSSS#JJJJJJJJJJ#SSSPPPPSSS#',
      'S:z::::::z::::::::::::::z::::::z:P',
      '#:..............................:#',
      'P:..PPP....b..........b....PPP..:S',
      'S:..PPP....................PPP..:P',
      '#:.......o..............o.......:#',
      'P:..SS......SS......SS......SS..:S',
      'S:..SS..t...SS......SS...t..SS..:P',
      '#:..............................:#',
      'P:..............................:S',
      'S::::::::::::::::::::::::::::::::P',
      '#SSSP222SS#JJJJ#SSSSPPSSSS222JJSS#',
      'S::::::::::::::::::::::::::::::::S',
      'Sz..............................zS',
      '#..x.....t.........x.....t......##',
      '#.....##......##......##......b..#',
      '#.b...##..o...##...b..##..o......S',
      'S===============@================S',
      'S.......##....##....##....##.....#',
      '#..t....##....##....##....##..x..P',
      '#..............................o.P',
      'Sz..............................zS',
      'S::::::::::::::::::::::::::::::::S',
      '#PPSSSSSS#JJJJ#3333SSPP#SSSSSS#SS#',
      'S::::::::::::::::::::::::::::::::P',
      '#:..............................:#',
      'P:..##....b............b....##..:S',
      'S:..##.......n......n.......##..:P',
      '#:.......x.....JJJJ.....x.......:#',
      'P:..t..........JJJJ..........t..:S',
      'S:..##.......o......o.......##..:P',
      '#:..##....b............b....##..:#',
      'P:z............................z:S',
      'S::::z::::::::::::::::::::::z::::P',
      '#PPSSSS#JJJJSSSSSSSSSSJJJJ#SSSSPP#',
    ],
  },
  {
    name: 'Subway Platform',
    outdoor: false,
    fog: [12, 14, 18],
    floors: { '.': 'platform', ':': 'platform', '=': 'tracks', _: 'edge' },
    gate: 'M',
    wings: { 2: 'UPTOWN PLATFORM', 3: 'MEZZANINE' },
    grid: [
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'Mz==TTTTTTTTTTTTTTTTTTTTTT==zM........z_==TTTM',
      'M===TTTTTTTTTTTTTTTTTTTTTT===M..G...G.._==TTTM',
      'M____________________________M........._==TTTM',
      'M...G.....G.....G.....G....z.M...b...b._==TTTM',
      'M.........b.........b........M........._==TTTM',
      'M...G.....G.....G.....G......2........._==TTTM',
      'M..............@.............2..G...G.._==TTTM',
      'M...G.....G.....G.....G......2........._==TTTM',
      'M.........b.........b........M...b...b._==TTTM',
      'Mz..G.....G.....G.....G......M........._====zM',
      'M____________________________M..G...G.._=====M',
      'M============================M........._=====M',
      'Mz==========================zM.z......._====zM',
      'MMMMMMMMMMMMM3333MMMMMMMMMMMMMMMM333MMMMMMMMMM',
      'M............................................M',
      'M.z........................................z.M',
      'M...G.....G.....G............G.....G.....G...M',
      'M............................................M',
      'M..bb..bb..bb..bb............bb..bb..bb..bb..M',
      'M............................................M',
      'M...G.....G.....G...MMMMMM...G.....G.....G...M',
      'M...................MMMMMM...................M',
      'M...G.....G.....G...MMMMMM...G.....G.....G...M',
      'M............................................M',
      'M..bb..bb..bb..bb............bb..bb..bb..bb..M',
      'M............................................M',
      'M.z........o......................o........z.M',
      'M............................................M',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    ],
  },
  {
    name: 'Bank Server Room',
    outdoor: false,
    fog: [8, 18, 26],
    floors: { '.': 'raised', ':': 'raised', '=': 'cable', _: 'raised' },
    gate: 'D',
    wings: { 2: 'COOLING AISLE', 3: 'THE VAULT' },
    grid: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'Dz........................zD=============z.D',
      'D..RRRRRR..RRRRRR..RRRRRR..D..RRRR...RRRR..D',
      'D..........................D..RRRR...RRRR..D',
      'D..RRRRRR..RRRRRR..RRRRRR..D...............D',
      'D=====..........c.....=====D..RRRR.c.RRRR..D',
      'D..........................D..RRRR...RRRR..D',
      'D..c.....RRR....RRR.....c..D..............zD',
      'D........R........R........2.......DD......D',
      'Dz.......R...@....R.......z2=======DD======D',
      'D........R........R........2.......DD......D',
      'D..c.....RRR....RRR.....c..D...............D',
      'D..........................D..RRRR...RRRR..D',
      'D=====................=====D..RRRR.c.RRRR..D',
      'D..RRRRRR..RRRRRR..RRRRRR..D...............D',
      'D..........................D..RRRR...RRRR..D',
      'D..RRRRRR..RRRRRR..RRRRRR..D..RRRR...RRRR..D',
      'Dz........................zD=z===========z=D',
      'DDDDDDDDDDDD3333DDDDDDDDDDDDDDDDD333DDDDDDDD',
      'D..........................................D',
      'D.z......................................z.D',
      'D..c..c..c........................c..c..c..D',
      'D..........................................D',
      'DDDDDDDD...DDDDDDDDDDDDDDDDDDDDDD...DDDDDDDD',
      'D......D...D....................D...D......D',
      'D..c...D...D....RRR......RRR....D...D...c..D',
      'D..c.......D....R..........R....D.......c..D',
      'D..c.......D....R..======..R....D.......c..D',
      'D..c...D...D....R..........R....D...D...c..D',
      'D......D...D....RRR......RRR....D...D......D',
      'D......D............................D......D',
      'D.z....D...........c....c...........D....z.D',
      'D..........................................D',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ],
  },
  {
    name: 'The Ball Drop',
    outdoor: true,
    fog: [40, 12, 30],
    floors: { '.': 'roof', ':': 'stage', '=': 'stripe', _: 'stage' },
    gate: 'X',
    wings: { 2: 'LOWER ROOFTOP', 3: 'MAIN STAGE' },
    grid: [
      'XXXXXXXXXXJJJJJJXXXXXXXXXXXXXXJJJJJJJJJJXXXX',
      'Xz......................zXz.........::::::zX',
      'X...x..............x.....X..........::JJ:::X',
      'X........::::::::........X...x....x.::JJ:::J',
      'X...XX...::::::::...XX...X..........:::::::X',
      'X...XX...::::::::...XX...X..o.......:::::::X',
      'X........::LLLL::........3........x.:::::::J',
      'X..o.....::LLLL::.....o..3.........x:::::::X',
      'X........::LLLL::........3........x.:::::::X',
      'X........::LLLL::........X..........:::::::J',
      'X...XX...::::::::...XX...X..o.......::JJ:::X',
      'X...XX...::::@:::...XX...X...x....x.::JJ:::X',
      'X........::::::::........X..........:::::::J',
      'X...x..............x.....X....XX....:::::::X',
      'Xz......................zX....XX....:::::::X',
      'XXX222XXXXJJJJJJXXXX222XXX..........:::::::J',
      'X........................X..........::JJ:::X',
      'X........................X...x....x.::JJ:::X',
      'X..XX....o......o....XX..J..........:::::::J',
      'X..XX................XX..X..o.......:::::::X',
      'X.......x........x.......X........x.:::::::X',
      'X=====..............=====3.........x:::::::J',
      'X.......x........x.......3........x.:::::::X',
      'X..JJ................JJ..3..........:::::::X',
      'X..JJ....b......b....JJ..J...x....x.::JJ:::J',
      'X........................X..........::JJ:::X',
      'X.z........z..z........z.Xz.........::::::zX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    ],
  },
];

const WALLS = '#SPJLMGRDXT';
const PROPS = { t: 0.85, o: 0.35, n: 0.35, x: 0.7, b: 0.55, c: 0.45 };
export const PROP_KIND = { t: 'taxi', o: 'trash', n: 'newsbox', x: 'barricade', b: 'bench', c: 'serverbox' };
export const PROP_SIZE = { t: [2.1, 1.1], o: [0.6, 0.8], n: [0.6, 0.95], x: [1.5, 0.85], b: [1.4, 0.7], c: [0.75, 1.05] };

// Districts grow as the night goes on: gate cells '2' and '3' are solid (drawn as the map's
// `gate` wall) until stage 2 (the district's 4th level) or stage 3 (its 7th), then open floor.
export const stageFor = (n) => {
  const k = (n - 1) % 10;
  return k >= 6 ? 3 : k >= 3 ? 2 : 1;
};

// Parse a map (at a stage) into a wall grid, spawn points, props and the player start. Anything
// the player cannot reach from the start (a wing still behind its gate) spawns nothing.
export function parseMap(m, stage = 3) {
  m = { ...m, stage, grid: m.grid.map((row) => row.replace(/[23]/g, (d) => (+d <= stage ? '.' : m.gate || '#'))) };
  const h = m.grid.length;
  const w = m.grid[0].length;
  const walls = new Uint8Array(w * h);
  const wallChar = new Array(w * h).fill('');
  const floorKind = new Array(w * h).fill(m.floors['.']);
  const spawns = [];
  const props = [];
  let start = { x: w / 2, y: h / 2 };
  for (let y = 0; y < h; y++) {
    const row = m.grid[y];
    if (row.length !== w) throw new Error(`${m.name}: row ${y} is ${row.length} wide, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (WALLS.includes(ch)) {
        walls[i] = 1;
        wallChar[i] = ch;
        continue;
      }
      if (m.floors[ch]) floorKind[i] = m.floors[ch];
      if (ch === 'z') spawns.push({ x: x + 0.5, y: y + 0.5 });
      if (ch === '@') start = { x: x + 0.5, y: y + 0.5 };
      if (PROPS[ch]) props.push({ ch, x: x + 0.5, y: y + 0.5, r: PROPS[ch] });
    }
  }
  // Border must be solid so rays and zombies never leave the map.
  for (let x = 0; x < w; x++) {
    if (!walls[x] || !walls[(h - 1) * w + x]) throw new Error(`${m.name}: open border at column ${x}`);
  }
  for (let y = 0; y < h; y++) {
    if (!walls[y * w] || !walls[y * w + w - 1]) throw new Error(`${m.name}: open border at row ${y}`);
  }
  // Flood fill from the start; drop spawns and props in sealed-off wings.
  const seen = new Uint8Array(w * h);
  const q = [Math.floor(start.y) * w + Math.floor(start.x)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    for (const j of [i - 1, i + 1, i - w, i + w]) if (!seen[j] && !walls[j]) (seen[j] = 1), q.push(j);
  }
  const open = (p) => seen[Math.floor(p.y) * w + Math.floor(p.x)];
  const map = { ...m, w, h, walls, wallChar, floorKind, spawns: spawns.filter(open), props: props.filter(open), start, reach: seen };
  map.decor = decorFor(map);
  return map;
}
