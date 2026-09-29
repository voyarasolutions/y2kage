// Story mode missions: the step-by-step objectives of a mission (find parts, fix things, hold a
// spot, enter a code, beat the boss) played on top of the Sim instead of numbered waves. The horde
// never stops: zombies trickle in the whole time, and some steps set off a rush.
import { ITEMS, STATIONS } from '../data/story.js';
import { heroById } from '../data/heroes.js';
import { weightsFor, scaleFor, clockFor } from '../data/levels.js';
import { heroXp } from '../data/progress.js';
import { weaponTier } from '../data/shop.js';
import { rand } from '../core/util.js';

// How close you have to be to grab an item or work a station.
export const ITEM_R = 0.8;
export const USE_R = 1.35;
const CHAT_T = 4.2;
// Parts show a marker within this many metres, or anywhere once you've searched this long.
const SEE_R = 11;
const HINT_T = 22;
const NEXT_T = 1.2;
// Seconds a crashed player waits to reboot while the crew is still standing.
const REBOOT_T = 9;
const OUTRO_T = 2.6;
const RUSH_EVERY = 0.28;
// How much longer a line stays up per character, so long ones can be read.
const CHAT_PER_CHAR = 0.035;

// The horde's stats for a mission at story minute n: the campaign's scaling for that minute, with
// fewer of them around, a bit tougher and hitting a little harder.
export function storyConfig(M, n) {
  const sc = scaleFor(n);
  return {
    level: n,
    dIdx: M.chapter.district,
    bossIdx: M.chapter.district,
    clock: clockFor(n),
    isBoss: !!M.boss,
    story: true,
    waves: [],
    ...sc,
    hpMul: sc.hpMul * 1.12,
    damageMul: sc.damageMul * 1.08,
    radio: '',
  };
}

export class Mission {
  constructor(sim, def) {
    this.sim = sim;
    this.def = def;
    this.stepI = -1;
    this.step = null;
    this.items = [];
    this.stations = [];
    this.npc = null;
    this.chat = [];
    this.chatNow = null;
    this.rush = 0;
    this.rushT = 0;
    this.trickleT = 2.5;
    this.nextT = 2.4;
    this.done = false;
    this.alarmT = 0;
    this.useHeld = false;
    this.usePrev = false;
    this.keypad = null;
    this.completed = 0;
    sim.lv.phase = 'story';
  }

  // A chat line (AIM window, pager, or a hero talking) that shows without stopping the game.
  say(line) {
    this.chat.push(line);
  }

  // Everything the player can see about the current step, for the HUD.
  get text() {
    return this.step?.text || '';
  }

  progress() {
    const S = this.step;
    if (!S) return null;
    if (S.type === 'collect') {
      const got = this.items.filter((i) => i.got).length;
      return { label: `${ITEMS[S.item].name}${this.items.length > 1 ? 'S' : ''} ${got}/${this.items.length}`, frac: got / this.items.length };
    }
    if (S.type === 'use' && this.stations.length > 1) {
      const got = this.stations.filter((s) => s.done).length;
      return { label: `${got}/${this.stations.length} DONE`, frac: got / this.stations.length };
    }
    if (S.type === 'kill') {
      const got = Math.min(S.n, this.sim.lv.kills - this.killsAt);
      return { label: `${got}/${S.n} DOWN`, frac: got / S.n };
    }
    if (S.type === 'hold') return { label: this.inZone ? 'HOLDING' : 'GET BACK IN THE ZONE', frac: this.prog, warn: !this.inZone };
    if (S.type === 'survive') return { label: `${Math.ceil(Math.max(0, this.left))}s`, frac: 1 - this.left / S.time };
    return null;
  }

  // Where the HUD points: whatever is left to do in this step.
  targets() {
    const S = this.step;
    if (!S || this.nextT > 0) return [];
    if (S.type === 'collect') {
      // Parts are marked once you're close; from further off, only after a while without finding one.
      const P = this.sim.player;
      const left = this.items.filter((i) => !i.got);
      left.sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
      const hint = this.searchT > HINT_T;
      return left.filter((i, k) => Math.hypot(i.x - P.x, i.y - P.y) < SEE_R || (hint && k === 0)).map((i) => ({ x: i.x, y: i.y, h: 0.6 }));
    }
    if (S.type === 'use' || S.type === 'code') return this.stations.filter((s) => !s.done).map((s) => ({ x: s.x, y: s.y, h: 1.2 }));
    if (S.type === 'hold') return this.inZone ? [] : [{ x: S.at[0], y: S.at[1], h: 0.4 }];
    if (S.type === 'reach') return [{ x: S.at[0], y: S.at[1], h: this.npc ? 1.3 : 0.4 }];
    return [];
  }

  // The station you are standing at, if any.
  stationHere() {
    const P = this.sim.player;
    if (P.down || this.nextT > 0) return null;
    let best = null;
    let bd = USE_R;
    for (const s of this.stations) {
      if (s.done) continue;
      const d = Math.hypot(s.x - P.x, s.y - P.y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // Would a fight be on right now? The music leans in when it is.
  pressure() {
    const S = this.step;
    return this.rush > 0 || this.sim.zombies.length >= 7 || S?.type === 'hold' || S?.type === 'survive';
  }

  begin(i) {
    const sim = this.sim;
    const S = this.def.steps[i];
    this.stepI = i;
    this.step = S;
    this.stepT = 0;
    this.prog = 0;
    this.items = [];
    this.stations = [];
    this.keypad = null;
    this.midShown = 0;
    this.inZone = false;
    sim.reviveAll();
    for (const l of S.say || []) this.say(l);
    if (S.rush) this.rush += Math.round(S.rush * sim.diff.count * (1 + 0.5 * (sim.players.length - 1)));
    if (S.npc) this.npc = { id: S.npc.id, x: S.npc.at[0], y: S.npc.at[1] };
    if (S.type === 'collect') this.items = S.at.map(([x, y]) => ({ kind: S.item, x, y, got: false, ph: rand(0, 6) }));
    this.searchT = 0;
    if (S.type === 'use') this.stations = S.at.map(([x, y]) => ({ kind: S.station, x, y, prog: 0, done: false }));
    if (S.type === 'code') {
      this.stations = [{ kind: S.station, x: S.at[0], y: S.at[1], prog: 0, done: false, code: true }];
      this.code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
      this.entry = [];
      this.ticker = this.makeTicker(S.ticker || []);
    } else this.ticker = null;
    if (S.type === 'kill') this.killsAt = sim.lv.kills;
    if (S.type === 'survive') this.left = S.time;
    if (S.type === 'boss') this.bossT = 1.6;
    sim.snd('wave');
  }

  // The news ticker for a code step: headlines, with the lost-and-found notice slipped in between.
  makeTicker(heads) {
    const out = [];
    const hs = heads.length ? heads : ['STAY TUNED'];
    this.code.forEach((d, k) => {
      out.push(hs[k % hs.length]);
      out.push(`LOST+FOUND: BAG CHECK CODE, DIGIT ${k + 1} IS ${d}`);
    });
    return out.join('   +++   ');
  }

  finishStep() {
    const sim = this.sim;
    const S = this.step;
    this.completed++;
    if (S.join) this.join(S.join);
    if (S.npc) this.npc = null;
    this.stations = [];
    this.items = [];
    this.keypad = null;
    this.ticker = null;
    const last = this.stepI + 1 >= this.def.steps.length;
    sim.snd('waveClear', last);
    sim.score += 150 * (this.stepI + 1);
    sim.fx('flash', '#f6c945', 0.2, 0.25);
    for (const P of sim.alive()) sim.chargeSpecial(P, 10);
    if (last) {
      this.done = true;
      this.step = null;
      sim.lv.phase = 'outro';
      sim.lv.t = OUTRO_T;
      sim.fx('waveClear', this.stepI + 1, 1);
      sim.banner = { kind: 'mission', t: 2.6, dur: 2.6, done: true };
      // Anyone still shambling around stays out of the way of the victory lap.
      for (const z of sim.zombies) z.hp = Math.min(z.hp, 1);
      return;
    }
    sim.banner = { kind: 'objective', t: 1.8, dur: 1.8 };
    this.step = null;
    this.nextT = NEXT_T;
  }

  // A hero turns up and fights alongside you as a CPU teammate.
  join(id) {
    const sim = this.sim;
    if (sim.players.some((P) => P.hero.id === id)) return;
    const hero = heroById(id);
    const P0 = sim.player;
    const at = this.npc ? { x: this.npc.x, y: this.npc.y } : { x: P0.x, y: P0.y };
    const P = sim.makePlayer({ hero, xp: heroXp(id), name: hero.name, ups: [], bot: true, tier: weaponTier(id) }, sim.players.length, 1, at, P0.a);
    sim.players.push(P);
    sim.toast(`${hero.name} JOINED`, 'Your crew just got bigger');
  }

  // What counts as the crew for "everyone": the ones still standing.
  update(dt) {
    const sim = this.sim;
    const L = sim.lv;
    if (L.phase === 'done') return;
    this.updateChat(dt);
    this.alarmT = Math.max(0, this.alarmT - dt);
    if (L.phase === 'outro') {
      L.t -= dt;
      if (L.t <= 0) {
        L.phase = 'done';
        sim.emit('clear');
      }
      return;
    }
    this.spawns(dt);
    this.reboots(dt);
    if (!this.step) {
      this.nextT -= dt;
      if (this.nextT <= 0) this.begin(this.stepI + 1);
      this.usePrev = this.useHeld;
      return;
    }
    const S = this.step;
    const P = sim.player;
    const t = S.type;
    this.stepT += dt;
    if (t === 'kill' && L.kills - this.killsAt >= S.n) return this.finishStep();
    if (t === 'survive') {
      this.left -= dt;
      if (this.left <= 0) return this.finishStep();
    }
    if (t === 'collect') {
      this.searchT += dt;
      if (this.searchT > HINT_T && !this.hinted) {
        this.hinted = true;
        sim.toast('HINT', 'Follow the marker to the next one');
      }
      for (const it of this.items) {
        if (it.got) continue;
        const Q = sim.alive().find((Q) => !Q.bot && Math.hypot(it.x - Q.x, it.y - Q.y) < ITEM_R && Q.z < 0.8);
        if (!Q) continue;
        it.got = true;
        this.searchT = 0;
        this.hinted = false;
        const got = this.items.filter((i) => i.got).length;
        sim.snd('pickup');
        sim.toast(`${ITEMS[it.kind].name} ${got}/${this.items.length}`, ITEMS[it.kind].tip);
        sim.fx('flash', '#f6c945', 0.1, 0.15);
      }
      if (this.items.every((i) => i.got)) return this.finishStep();
    }
    if (t === 'use') {
      const here = this.stationHere();
      for (const s of this.stations) {
        if (s.done) continue;
        if (s === here && (this.useHeld || this.autoUse)) {
          s.prog += dt / S.hold;
          if (Math.random() < dt * 6) sim.snd('tick');
          if (s.prog >= 1) {
            s.done = true;
            s.prog = 1;
            sim.snd(s.kind === 'payphone' ? 'ring' : 'arc');
            sim.toast(`${STATIONS[s.kind].name} DONE`, this.stations.every((q) => q.done) ? 'Objective complete' : `${this.stations.filter((q) => !q.done).length} to go`);
          }
        } else s.prog = Math.max(0, s.prog - dt * 0.35);
      }
      if (this.stations.every((s) => s.done)) return this.finishStep();
    }
    if (t === 'code') {
      const here = this.stationHere();
      // Walk up to the keypad and it opens; walk away and it closes.
      if (here && !this.keypad) this.keypad = { open: true };
      if (!here) this.keypad = null;
    }
    if (t === 'hold') {
      const [x, y] = S.at;
      this.inZone = sim.alive().some((Q) => !Q.bot && Math.hypot(Q.x - x, Q.y - y) < S.r);
      if (this.inZone) this.prog = Math.min(1, this.prog + dt / S.time);
      while (S.mid && this.midShown < S.mid.length && this.prog >= S.mid[this.midShown][0]) this.say(S.mid[this.midShown++][1]);
      if (this.prog >= 1) return this.finishStep();
    }
    if (t === 'reach') {
      const [x, y] = S.at;
      const me = !P.down && Math.hypot(P.x - x, P.y - y) < S.r;
      const crew = !S.all || sim.alive().every((Q) => Math.hypot(Q.x - x, Q.y - y) < S.r + 1.6);
      if (me && crew) return this.finishStep();
    }
    if (t === 'boss') {
      if (this.bossT > 0) {
        this.bossT -= dt;
        if (this.bossT <= 0) {
          sim.spawnZombie('boss', { x: S.at[0], y: S.at[1] });
          this.bossUp = true;
        }
      } else if (this.bossUp && !sim.zombies.some((z) => z.kind === 'boss')) return this.finishStep();
    }
    this.usePrev = this.useHeld;
  }

  // Anyone who crashes reboots beside a teammate after a few seconds, so an objective that needs
  // you (a hold, a station) never stalls while your CPU crew fights on.
  reboots(dt) {
    const sim = this.sim;
    const up = sim.alive();
    for (const P of sim.players) {
      if (!P.down) {
        P.downT = 0;
        continue;
      }
      P.downT = (P.downT || 0) + dt;
      const buddy = up.find((Q) => Q !== P);
      if (P.downT < REBOOT_T || !buddy) continue;
      P.x = buddy.x;
      P.y = buddy.y;
      P.down = false;
      P.hp = Math.min(P.maxHp, 60);
      P.iT = 2;
      P.downT = 0;
      sim.personal(P, 'revive');
    }
  }

  rebootIn(P) {
    return REBOOT_T - (P.downT || 0);
  }

  // A digit typed on the bag-check keypad. Four digits and it checks them.
  enterDigit(d) {
    if (!this.keypad || this.step?.type !== 'code') return;
    const sim = this.sim;
    this.entry.push(d);
    sim.snd('key');
    if (this.entry.length < 4) return;
    if (this.entry.every((v, i) => v === this.code[i])) {
      sim.toast('ACCESS GRANTED', 'The locker pops open');
      this.stations[0].done = true;
      this.entry = [];
      return this.finishStep();
    }
    // Wrong: the alarm goes off and the horde comes running.
    this.entry = [];
    this.alarmT = 1.2;
    this.rush += Math.round(6 * sim.diff.count);
    sim.toast('ACCESS DENIED', 'The alarm is bringing company');
    sim.snd('alarm');
    sim.fx('flash', '#ff3b3b', 0.25, 0.35);
  }

  // Zombies trickle in all mission long; a rush pours them in fast.
  spawns(dt) {
    const sim = this.sim;
    const T = this.def.trickle || { every: 2, max: 10 };
    // While the boss is up, the trickle eases off so the fight is about the boss.
    const cap = Math.round(T.max * (1 + 0.45 * (sim.players.length - 1)) * sim.diff.count * (sim.boss ? 0.5 : 1));
    const kinds = weightsFor(sim.levelN);
    const roll = () => {
      let tot = 0;
      for (const k in kinds) tot += kinds[k];
      let r = Math.random() * tot;
      for (const k in kinds) if ((r -= kinds[k]) <= 0) return k;
      return 'shambler';
    };
    if (this.rush > 0) {
      this.rushT -= dt;
      if (this.rushT <= 0 && sim.zombies.length < cap * 1.8) {
        this.rushT = RUSH_EVERY;
        this.rush--;
        sim.spawnZombie(roll());
        sim.lv.total++;
      }
    }
    this.trickleT -= dt;
    if (this.trickleT <= 0) {
      this.trickleT = T.every * rand(0.7, 1.3) / sim.diff.count;
      if (sim.zombies.length < cap && !this.done) {
        sim.spawnZombie(roll());
        sim.lv.total++;
      }
    }
  }

  updateChat(dt) {
    if (this.chatNow) {
      this.chatNow.t -= dt;
      if (this.chatNow.t > 0) return;
      this.chatNow = null;
    }
    const line = this.chat.shift();
    if (!line) return;
    const dur = CHAT_T + (line.text?.length || 0) * CHAT_PER_CHAR;
    this.chatNow = { line, t: dur, dur };
    this.sim.snd(line.k === 'aim' ? (line.from?.startsWith('MillenniumBug') ? 'bugChat' : 'imChime') : line.k === 'pager' ? 'pager' : 'click');
  }
}

