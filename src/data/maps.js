// Arena maps, one per district (levels 1-10, 11-20, ...).
// Walls: # brick, S storefront, P posters, J jumbotron, L ball tower, M subway tile, G pillar,
//        R server rack, D datacentre wall, X glass tower.
// Floor: . base, : sidewalk/platform, = stripes (crosswalk, tracks, cables), _ platform edge.
// Marks: @ player start, z zombie spawn. Props (solid): t taxi, o trash can, n news box,
//        x barricade, b bench, c server cabinet.


export const MAPS = [
  {
    name: 'Times Square',
    outdoor: true,
    fog: [26, 16, 52],
    floors: { '.': 'street', ':': 'walk', '=': 'stripe', _: 'walk' },
    grid: [
      '##SSSSJJJJJJJJJJSSSS##PPPS##',
      '#::::::::::::::::::::::::::#',
      'S:z.......=.....=.......z::S',
      'S:..t.....=.....=....t....:S',
      'P:........=.....=.........:P',
      'P:....o...=.....=...o.....:#',
      '#:........=.....=.........:S',
      'S:...LL...............LL..:S',
      'S:...LL.......@.......LL..:S',
      '#:........................:J',
      'J:.====..............====.:J',
      'J:.====..............====.:J',
      '#:........................:#',
      'S:...LL...............LL..:S',
      'S:...LL.......x.......LL..:S',
      '#:........=.....=.........:P',
      'P:..n.....=.....=.....t...:P',
      'P:........=.....=.........:#',
      'S:..t.....=.....=.......n.:S',
      'S:z.......=.....=.......z.:S',
      '#::::::::::::::::::::::::::#',
      '##SSSSPPPP####JJJJJJ##SSSS##',
    ],
  },
  {
    name: 'Broadway',
    outdoor: true,
    fog: [36, 14, 40],
    floors: { '.': 'street', ':': 'walk', '=': 'stripe', _: 'walk' },
    grid: [
      '#SSSPPSSSS#JJJJ#SSSSPPSSSS#JJJJSS#',
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
      '#PPSSSSSS#JJJJ#SSSSSSPP#SSSSSS#SS#',
    ],
  },
  {
    name: 'Subway Platform',
    outdoor: false,
    fog: [12, 14, 18],
    floors: { '.': 'platform', ':': 'platform', '=': 'tracks', _: 'edge' },
    grid: [
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'Mz==========================zM',
      'M============================M',
      'M____________________________M',
      'M...G.....G.....G.....G....z.M',
      'M.........b.........b........M',
      'M...G.....G.....G.....G......M',
      'M..............@.............M',
      'M...G.....G.....G.....G......M',
      'M.........b.........b........M',
      'Mz..G.....G.....G.....G......M',
      'M____________________________M',
      'M============================M',
      'Mz==========================zM',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    ],
  },
  {
    name: 'Bank Server Room',
    outdoor: false,
    fog: [8, 18, 26],
    floors: { '.': 'raised', ':': 'raised', '=': 'cable', _: 'raised' },
    grid: [
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'Dz........................zD',
      'D..RRRRRR..RRRRRR..RRRRRR..D',
      'D..........................D',
      'D..RRRRRR..RRRRRR..RRRRRR..D',
      'D=====..........c.....=====D',
      'D..........................D',
      'D..c.....RRR....RRR.....c..D',
      'D........R........R........D',
      'Dz.......R...@....R.......zD',
      'D........R........R........D',
      'D..c.....RRR....RRR.....c..D',
      'D..........................D',
      'D=====................=====D',
      'D..RRRRRR..RRRRRR..RRRRRR..D',
      'D..........................D',
      'D..RRRRRR..RRRRRR..RRRRRR..D',
      'Dz........................zD',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ],
  },
  {
    name: 'The Ball Drop',
    outdoor: true,
    fog: [40, 12, 30],
    floors: { '.': 'roof', ':': 'stage', '=': 'stripe', _: 'stage' },
    grid: [
      'XXXXXXXXXXJJJJJJXXXXXXXXXX',
      'Xz......................zX',
      'X...x..............x.....X',
      'X........::::::::........X',
      'X...XX...::::::::...XX...X',
      'X...XX...::::::::...XX...X',
      'X........::LLLL::........J',
      'X..o.....::LLLL::.....o..J',
      'X........::LLLL::........J',
      'X........::LLLL::........X',
      'X...XX...::::::::...XX...X',
      'X...XX...::::@:::...XX...X',
      'X........::::::::........X',
      'X...x..............x.....X',
      'Xz......................zX',
      'XXXXXXXXXXJJJJJJXXXXXXXXXX',
    ],
  },
];

const WALLS = '#SPJLMGRDX';
const PROPS = { t: 0.85, o: 0.35, n: 0.35, x: 0.7, b: 0.55, c: 0.45 };
export const PROP_KIND = { t: 'taxi', o: 'trash', n: 'newsbox', x: 'barricade', b: 'bench', c: 'serverbox' };
export const PROP_SIZE = { t: [2.1, 1.1], o: [0.6, 0.8], n: [0.6, 0.95], x: [1.5, 0.85], b: [1.4, 0.7], c: [0.75, 1.05] };

// Parse a map into a wall grid, spawn points, props and the player start.
export function parseMap(m) {
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
  return { ...m, w, h, walls, wallChar, floorKind, spawns, props, start };
}
