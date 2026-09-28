globalThis.window = globalThis; globalThis.localStorage = { getItem(){return null}, setItem(){} };
globalThis.document = { createElement(){ return { getContext(){ return new Proxy({}, {get:()=>()=>({})}) } } }, addEventListener(){} };
const { Sim } = await import('../src/game/sim.js');
const { MAPS, parseMap } = await import('../src/data/maps.js');
const { levelConfig } = await import('../src/data/levels.js');
const { HEROES } = await import('../src/data/heroes.js');
const maps = MAPS.map(parseMap);
const n = +(process.env.N || 10), hero = HEROES.find(h => h.id === (process.env.H || 'dot'));
for (let trial = 0; trial < 14; trial++) {
  const sim = new Sim(maps[Math.floor((n-1)/10)], levelConfig(n), [{ hero, xp: +(process.env.XP||7000), ups: (await import('../src/data/upgrades.js')).offer([], 3, 5).concat(['hp','dmg','rate','hp','dmg','armor']), name: 'x', bot: true }], n, { botSkill: +(process.env.SKILL||1) });
  let t = 0, done = null, log = [];
  while (t < 600 && !done) { sim.update(1/30, { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0 }); t += 1/30;
    for (const e of sim.events.splice(0)) if (e.type==='clear'||e.type==='dead') done = e.type;
    if (sim.boss && Math.round(t*30) % 150 === 0) { const b = sim.boss, P = sim.player; log.push(`${Math.round(t)}s boss ${b.x.toFixed(1)},${b.y.toFixed(1)} hp ${Math.round(100*b.hp/b.max)}% st ${b.state} ch ${b.chargeLeft?.toFixed?.(1)} P ${P.x.toFixed(1)},${P.y.toFixed(1)} d ${Math.hypot(b.x-P.x,b.y-P.y).toFixed(1)} zs ${sim.zombies.length} tgt ${P.ai?.target?.kind}`); } }
  console.log('trial', trial, done, Math.round(t));
  if (t > 250) { console.log(log.slice(0, 60).join('\n')); break; }
}
