// Headless playtest: a CPU bot plays the campaign as the local player and we log pacing stats.
globalThis.window = globalThis; globalThis.localStorage = { getItem(){return null}, setItem(){} };
globalThis.document = { createElement(){ return { getContext(){ return new Proxy({}, {get:()=>()=>({})}) } } }, addEventListener(){} };
const { Sim } = await import('../src/game/sim.js');
const { MAPS, parseMap, stageFor } = await import('../src/data/maps.js');
const { levelConfig } = await import('../src/data/levels.js');
const { offer } = await import('../src/data/upgrades.js');
const { HEROES } = await import('../src/data/heroes.js');
const heroes = (process.env.HEROES || 'tina,marcus,dot,gus,kev').split(',');
const L0 = +(process.env.FROM || 1), L1 = +(process.env.TO || 50), TRIES = +(process.env.TRIES || 3);
const maps = MAPS.map((m) => parseMap(m, 3));
const out = {};
for (const hid of heroes) {
  const hero = HEROES.find(h => h.id === hid);
  let xp = +(process.env.XP || 0), ups = [], sp = 0; const rows = [];
  for (let n = L0; n <= L1; n++) {
    let res;
    for (let a = 1; a <= TRIES; a++) {
      const sim = new Sim(parseMap(MAPS[Math.min(4, Math.floor((n - 1) / 10))], stageFor(n)), levelConfig(n), [{ hero, xp, ups, sp, name: hid, bot: true }], n, { botSkill: +(process.env.SKILL || 1), diff: process.env.DIFF || 'normal' });
      const dt = 1 / 30; let t = 0, idle = 0, minHp = 999, hurt = 0, lastHp = sim.player.hp, clear = false, dead = false, breakT = 0, specials = 0, pickups = 0;
      const pk = sim.pickups?.length ?? 0;
      while (t < 900) {
        const was = sim.player.spKind;
        sim.update(dt, { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0 });
        if (!was && sim.player.spKind) specials++;
        t += dt;
        const P = sim.player;
        if (P.hp < lastHp) hurt += lastHp - P.hp; lastHp = P.hp; minHp = Math.min(minHp, P.hp);
        if (sim.lv.phase === 'wave') { const near = sim.zombies.some(z => Math.hypot(z.x - P.x, z.y - P.y) < 9); if (!near) idle += dt; }
        if (sim.lv.phase === 'break') breakT += dt;
        let stop = false;
        for (const e of sim.events.splice(0)) { if (e.type === 'clear') { clear = true; stop = true; } if (e.type === 'dead') { dead = true; stop = true; } }
        if (stop) break;
      }
      res = { n, a, clear, dead, t: Math.round(t), idle: Math.round(idle), brk: Math.round(breakT), kills: sim.lv.kills, hurt: Math.round(sim.hurtTaken), minHp: Math.round(minHp), maxHp: sim.player.maxHp, combo: sim.lv.bestCombo, hs: sim.lv.headshots || 0, sp: specials, score: sim.score, wave: sim.lv.wave + 1, rank: sim.player.rank, xp: Math.round(sim.player.xp), jp: sim.lv.jackpots || 0 };
      xp = sim.player.xp; sp = sim.player.spKind ? 0 : sim.player.sp;
      if (clear) break;
    }
    rows.push(res);
    console.log(hid, JSON.stringify(res));
    if (!res.clear) break;
    ups = ups.concat(offer(ups, 1, n));
  }
  out[hid] = rows;
}
import('fs').then(fs => fs.writeFileSync(process.env.OUT || 'playtest.json', JSON.stringify(out)));
