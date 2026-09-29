// Weapon bench: hold fire for 20 seconds at a stationary tough zombie (and at a pack of six),
// and report the damage each hero's weapon actually deals, resource limits included.
globalThis.window = globalThis; globalThis.localStorage = { getItem(){return null}, setItem(){} };
globalThis.document = { createElement(){ return { getContext(){ return new Proxy({}, {get:()=>()=>({})}) } } }, addEventListener(){} };
const { Sim } = await import('../src/game/sim.js');
const { MAPS, parseMap, stageFor } = await import('../src/data/maps.js');
const { levelConfig } = await import('../src/data/levels.js');
const { HEROES } = await import('../src/data/heroes.js');
const T = +(process.env.T || 20), tier = +(process.env.TIER || 0);
const rows = [];
for (const hero of HEROES) {
  const r = { hero: hero.id };
  for (const [label, n] of [['single', 1], ['pack6', 6]]) {
    const sim = new Sim(parseMap(MAPS[0], stageFor(1)), levelConfig(1), [{ hero, name: hero.id, tier }], 1, {});
    const P = sim.player;
    sim.lv.phase = 'bench';
    for (let k = 0; k < n; k++) {
      const d = 4.5 + (k >> 1) * 0.8, side = n > 1 ? ((k & 1) ? 0.35 : -0.35) : 0;
      sim.spawnZombie('brute', { x: P.x + Math.cos(P.a) * d - Math.sin(P.a) * side, y: P.y + Math.sin(P.a) * d + Math.cos(P.a) * side });
    }
    for (const z of sim.zombies) { z.hp = z.max = 1e7; z.speed = 0; z.dmg = 0; z.affix = 0; z.spawnT = 0; }
    const x0 = P.x, y0 = P.y;
    let t = 0; const dt = 1 / 60;
    while (t < T) {
      P.x = x0; P.y = y0; P.vx = P.vy = 0; P.sp = 0;
      P.input = { move: { f: 0, s: 0 }, turn: 0, fire: true, look: 0 };
      sim.tickPlayer(P, dt); sim.updateWeapon(P, dt); sim.updateProjs(dt);
      t += dt;
    }
    const dmg = sim.zombies.reduce((s, z) => s + (z.max - z.hp), 0);
    r[label] = Math.round(dmg / T);
  }
  rows.push(r);
}
console.table(rows);
