// Headless story playtest: an autopilot walks the local hero to each objective (fighting on the
// way, holding USE at stations, typing the keypad code) and logs how each mission goes.
globalThis.window = globalThis; globalThis.localStorage = { getItem(){return null}, setItem(){} };
globalThis.document = { createElement(){ return { getContext(){ return new Proxy({}, {get:()=>()=>({})}) } } }, addEventListener(){} };
const { Sim } = await import('../src/game/sim.js');
const { Mission, storyConfig } = await import('../src/game/mission.js');
const { MAPS, parseMap } = await import('../src/data/maps.js');
const { MISSIONS } = await import('../src/data/story.js');
const { heroById } = await import('../src/data/heroes.js');
const only = process.env.ONLY;
const TRIES = +(process.env.TRIES || 3);
for (const M of MISSIONS) {
  if (only && M.id !== only) continue;
  for (let a = 0; a < TRIES; a++) {
    const map = parseMap(MAPS[M.chapter.district], M.stage);
    if (M.start) map.start = { x: M.start[0], y: M.start[1] };
    const n = M.minute - 9;
    const party = M.crew.map((id, i) => ({ hero: heroById(id), xp: +(process.env.XP || 0), name: id, ups: [], bot: i > 0 }));
    const sim = new Sim(map, storyConfig(M, n), party, n, { diff: process.env.DIFF || 'normal' });
    const ms = new Mission(sim, M);
    sim.mission = ms;
    const dt = 1 / 30;
    let t = 0, res = null, log = [], lastStep = -1;
    const w = map.w;
    const bfs = (tx, ty) => {
      const dist = new Int32Array(map.w * map.h).fill(-1);
      const q = [Math.floor(ty) * w + Math.floor(tx)]; dist[q[0]] = 0;
      for (let h = 0; h < q.length; h++) { const c = q[h]; for (const j of [c-1,c+1,c-w,c+w]) if (dist[j] < 0 && !sim.blocked[j]) { dist[j] = dist[c] + 1; q.push(j); } }
      return dist;
    };
    let fieldKey = '', field = null;
    while (t < 600) {
      const P = sim.player;
      const S = ms.step;
      if (ms.stepI !== lastStep) { log.push(`${ms.stepI + 1}@${Math.round(t)}s`); lastStep = ms.stepI; }
      let goal = ms.targets()[0];
      if (!goal && S && (S.type === 'hold' || S.type === 'reach')) goal = { x: S.at[0], y: S.at[1] };
      // Aim at the nearest zombie in reach; walk toward the goal (or kite a bit if none).
      let near = null, nd = 9;
      for (const z of sim.zombies) { const d = Math.hypot(z.x - P.x, z.y - P.y); if (d < nd && !z.bs) { nd = d; near = z; } }
      let mdir = null;
      if (goal) {
        const gd = Math.hypot(goal.x - P.x, goal.y - P.y);
        if (gd > 0.5) {
          const key = `${Math.floor(goal.x)},${Math.floor(goal.y)}`;
          if (key !== fieldKey) { fieldKey = key; field = bfs(goal.x, goal.y); }
          const cx = Math.floor(P.x), cy = Math.floor(P.y);
          let best = null, bd = field[cy * w + cx] < 0 ? 1e9 : field[cy * w + cx];
          for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const v = field[(cy + oy) * w + cx + ox]; if (v >= 0 && v < bd) { bd = v; best = [cx + ox + 0.5, cy + oy + 0.5]; } }
          mdir = best ? Math.atan2(best[1] - P.y, best[0] - P.x) : Math.atan2(goal.y - P.y, goal.x - P.x);
        }
      }
      if (near) P.a = Math.atan2(near.y - P.y, near.x - P.x);
      else if (mdir != null) P.a = mdir;
      let f = 0, s = 0;
      if (mdir != null) { f = Math.cos(mdir - P.a); s = Math.sin(mdir - P.a); }
      else if (near && nd < 2.5) { f = -1; }
      ms.useHeld = true;
      if (ms.keypad && ms.entry.length < 4) ms.enterDigit(ms.code[ms.entry.length]);
      sim.update(dt, { move: { f, s }, turn: 0, fire: !!near, look: 0 });
      t += dt;
      let stop = false;
      for (const e of sim.events.splice(0)) { if (e.type === 'clear') { res = 'CLEAR'; stop = true; } if (e.type === 'dead') { res = 'DEAD'; stop = true; } }
      if (stop) break;
    }
    console.log(M.id, res || 'TIMEOUT', `${Math.round(t)}s`, `kills ${sim.lv.kills}`, `hurt ${Math.round(sim.hurtTaken)}`, `crew ${sim.players.length}`, 'steps', log.join(' '), res ? '' : `stuck on ${ms.stepI + 1} ${ms.step?.type} at ${sim.player.x.toFixed(1)},${sim.player.y.toFixed(1)}`);
  }
}
