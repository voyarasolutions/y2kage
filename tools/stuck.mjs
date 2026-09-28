globalThis.window = globalThis; globalThis.localStorage = { getItem(){return null}, setItem(){} };
globalThis.document = { createElement(){ return { getContext(){ return new Proxy({}, {get:()=>()=>({})}) } } }, addEventListener(){} };
const { Sim } = await import('../src/game/sim.js');
const { MAPS, parseMap } = await import('../src/data/maps.js');
const { levelConfig } = await import('../src/data/levels.js');
const { HEROES } = await import('../src/data/heroes.js');
const maps = MAPS.map((m) => parseMap(m, 3));
const n = 39;
for (let trial = 0; trial < 12; trial++) {
  const sim = new Sim(maps[3], levelConfig(n), [{ hero: HEROES[2], xp: 110000, ups: ['dmg','dmg','rate','hp'], name: 'dot', bot: true }], n, { botSkill: 0.4 });
  let t = 0, done = false;
  while (t < 400 && !done) { sim.update(1/30, { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0 }); t += 1/30; for (const e of sim.events.splice(0)) if (e.type==='clear'||e.type==='dead') done = true; }
  if (!done) { const P = sim.player; console.log('STUCK trial', trial, 'phase', sim.lv.phase, 'queue', sim.lv.queue.length, 'player', P.x.toFixed(1), P.y.toFixed(1)); for (const z of sim.zombies) console.log(z.kind, z.x.toFixed(2), z.y.toFixed(2), z.state, 'hp', Math.round(z.hp), 'bs', z.bs, 'cell', sim.map.walls[Math.floor(z.y)*sim.map.w+Math.floor(z.x)], sim.blocked[Math.floor(z.y)*sim.map.w+Math.floor(z.x)]); console.log(MAPS[3].grid.join('\n')); break; }
  else console.log('trial', trial, 'ok', Math.round(t));
}
