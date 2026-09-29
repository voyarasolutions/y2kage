// Checks every story mission's coordinates are open, reachable floor on its map.
globalThis.window = globalThis; globalThis.localStorage = { getItem(){return null}, setItem(){} };
globalThis.document = { createElement(){ return { getContext(){ return new Proxy({}, {get:()=>()=>({})}) } } }, addEventListener(){} };
const { MAPS, parseMap } = await import('../src/data/maps.js');
const { MISSIONS } = await import('../src/data/story.js');
let bad = 0;
for (const M of MISSIONS) {
  const m = parseMap(MAPS[M.chapter.district], M.stage);
  const s = M.start ? { x: M.start[0], y: M.start[1] } : m.start;
  // flood from start
  const seen = new Uint8Array(m.w * m.h); const q = [Math.floor(s.y) * m.w + Math.floor(s.x)]; seen[q[0]] = 1;
  while (q.length) { const i = q.pop(); for (const j of [i-1,i+1,i-m.w,i+m.w]) if (!seen[j] && !m.walls[j]) { seen[j]=1; q.push(j); } }
  const pts = [['start', [s.x, s.y]]];
  for (const S of M.steps) {
    const at = S.at ? (Array.isArray(S.at[0]) ? S.at : [S.at]) : [];
    at.forEach((p) => pts.push([`${S.type}`, p]));
    if (S.npc) pts.push(['npc', S.npc.at]);
  }
  for (const [k, [x, y]] of pts) {
    const i = Math.floor(y) * m.w + Math.floor(x);
    const ok = seen[i] || (k === 'use' && [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b]) => seen[i + a + b * m.w]));
    if (!ok) { bad++; console.log(M.id, k, x, y, 'char', m.grid[Math.floor(y)][Math.floor(x)], 'NOT REACHABLE'); }
  }
}
console.log(bad ? `${bad} bad` : 'all story coordinates reachable');
