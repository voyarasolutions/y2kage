// Story mode's side of the Game: the chapter picker, cutscenes between missions, starting a
// mission on its own map with its own crew, and what happens when one is won or lost.
// Mixed into Game (game.js), so `this` is the game.
import { Sim } from './sim.js';
import { Mission, storyConfig } from './mission.js';
import { CHAPTERS, STATIONS, missionById } from '../data/story.js';
import { MAPS, parseMap } from '../data/maps.js';
import { heroById } from '../data/heroes.js';
import { heroXp, heroSp } from '../data/progress.js';
import { perkMods, weaponTier } from '../data/shop.js';
import { gradeFor } from '../data/grades.js';
import { cheats } from '../data/achievements.js';
import { settings } from '../core/settings.js';
import { store, clamp } from '../core/util.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { TYPE_CPS } from '../ui/story.js';

const GRADE_RANK = { S: 4, A: 3, B: 2, C: 1 };
// Tokens for a mission: a base, a bonus for the grade, and more the first time through.
const GRADE_PAY = { S: 15, A: 8, B: 3, C: 0 };

export const StoryMode = {
  // Best grade for every mission cleared: { '1-1': 'A', ... }.
  storyProgress() {
    return store.get('story', {}) || {};
  },

  // A chapter's first mission is always open; after that, clear one to open the next.
  missionOpen(M) {
    const C = CHAPTERS.find((c) => c.missions.some((m) => m.id === M.id));
    const i = C.missions.findIndex((m) => m.id === M.id);
    return i === 0 || !!this.storyProgress()[C.missions[i - 1].id];
  },

  openStory() {
    this.story = null;
    this.sim = null;
    this.input.unlock();
    this.storyCh = clamp(this.storyCh || 0, 0, CHAPTERS.length - 1);
    this.setMode('story');
    // Land on the first mission not yet cleared.
    const C = CHAPTERS[this.storyCh];
    const prog = this.storyProgress();
    const k = C.missions.findIndex((M) => !prog[M.id]);
    this.focus = k < 0 ? 0 : k;
    music.play('storyTheme');
  },

  pickChapter(k) {
    if (!CHAPTERS[k]) return;
    this.storyCh = k;
    this.focus = 0;
    sfx.click();
  },

  storyKey(code) {
    const C = CHAPTERS[this.storyCh];
    const n = C.missions.length;
    if (code === 'Escape' || code === 'Backspace') return this.setMode('title');
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.focus = (this.focus + 1) % n;
    if (code === 'ArrowUp' || code === 'KeyW') this.focus = (this.focus + n - 1) % n;
    if (code === 'ArrowLeft' || code === 'KeyA') this.pickChapter(Math.max(0, this.storyCh - 1));
    if (code === 'ArrowRight' || code === 'KeyD') this.pickChapter(Math.min(CHAPTERS.length - 1, this.storyCh + 1));
    if (code === 'Enter' || code === 'Space') {
      const M = C.missions[this.focus];
      if (M && this.missionOpen(M)) this.startMission(M.id);
      else sfx.bsod();
    }
    if (/^Arrow|Key[WS]|Tab/.test(code)) sfx.click();
  },

  // Play a mission: its intro scene first, then the level.
  startMission(id, skipIntro = false) {
    const M = missionById(id);
    if (!M) return;
    this.story = M;
    this.storyCh = CHAPTERS.indexOf(M.chapter);
    sfx.select();
    if (skipIntro || !M.intro?.length) return this.launchMission();
    this.playScene(M.intro, () => this.launchMission());
  },

  // ------------------------------------------------------------ cutscenes
  playScene(lines, then) {
    this.input.unlock();
    this.scene = { lines, i: 0, t: 0, then };
    this.setMode('scene');
    music.play('storyTheme');
    this.sceneCue();
  },

  sceneLine() {
    return this.scene?.lines[this.scene.i];
  },

  sceneShown() {
    const L = this.sceneLine();
    return L?.text ? Math.floor(this.scene.t * TYPE_CPS) : 0;
  },

  sceneCue() {
    const L = this.sceneLine();
    if (!L) return;
    if (L.k === 'pager') sfx.pager();
    else if (L.k === 'aim') L.from?.startsWith('MillenniumBug') ? sfx.bugChat() : sfx.imChime();
    else if (L.k === 'card') sfx.clear();
    else if (L.k === 'news') sfx.glitch();
    else if (L.k === 'result') sfx.waveClear(true);
  },

  // ENTER finishes the line being typed, then moves on; ESC skips the whole scene.
  sceneKey(code) {
    const S = this.scene;
    if (!S) return;
    if (code === 'Escape') return this.endScene();
    if (!['Enter', 'Space', 'Press'].includes(code)) return;
    const L = this.sceneLine();
    if (L?.text && this.sceneShown() < L.text.length) {
      S.t = L.text.length / TYPE_CPS + 0.01;
      return;
    }
    S.i++;
    S.t = 0;
    sfx.click();
    if (S.i >= S.lines.length) return this.endScene();
    this.sceneCue();
  },

  endScene() {
    const then = this.scene?.then;
    this.scene = null;
    if (then) then();
  },

  // ------------------------------------------------------------ playing a mission
  launchMission() {
    const M = this.story;
    this.saveXp();
    const C = M.chapter;
    this.hero = heroById(M.crew[0]);
    this.heroId = this.hero.id;
    this.endless = false;
    this.daily = null;
    this.runScore = 0;
    this.runUps = [];
    // The mission's own copy of the district map: its start point, and props for its stations.
    const map = parseMap(MAPS[C.district], M.stage);
    if (M.start) map.start = { x: M.start[0], y: M.start[1] };
    for (const S of M.steps) {
      const D = STATIONS[S.station]?.decor;
      if (D && S.prop) map.decor.push({ kind: D, x: S.prop[0], y: S.prop[1], rot: S.prop[2] || 0, r: 0.2 });
    }
    const levelN = M.minute - 9;
    this.levelN = levelN;
    this.mapIdx = C.district;
    this.map = map;
    this.world.load(map, levelN, {});
    const party = M.crew.map((id, i) => {
      const hero = heroById(id);
      return i === 0
        ? { hero, xp: heroXp(id), sp: heroSp(id), name: 'YOU', ups: [], perk: perkMods(), tier: weaponTier(id) }
        : { hero, xp: heroXp(id), sp: 0, name: hero.name, ups: [], bot: true, tier: weaponTier(id) };
    });
    this.sim = new Sim(map, storyConfig(M, levelN), party, levelN, { cheats: cheats(), diff: settings.diff });
    this.sim.mission = new Mission(this.sim, M);
    this.sim.banner = { kind: 'mission', t: 3, dur: 3 };
    this.levelStartScore = 0;
    this.keypadCursor = 5;
    this.setMode('play');
    music.play(C.music[0]);
    this.input.lock();
  },

  // Each frame in a mission: the USE key, touch auto-use when standing still, and the music.
  storyTick() {
    const sim = this.sim;
    const Ms = sim?.mission;
    if (!Ms) return;
    const inp = this.input;
    Ms.useHeld = this.mode === 'play' && (inp.keys.has('KeyE') || !!inp.pad.use);
    const P = sim.player;
    Ms.autoUse = inp.touch.on && Math.hypot(P.vx || 0, P.vy || 0) < 0.4;
    if (this.mode !== 'play') return;
    const tracks = Ms.def.chapter.music;
    if (sim.boss) music.play(tracks[2]);
    else music.play(Ms.pressure() ? tracks[1] : tracks[0], { segue: true });
  },

  storyDigit(code) {
    const Ms = this.sim?.mission;
    if (!Ms?.keypad) return false;
    const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (m) {
      Ms.enterDigit(+m[1]);
      return true;
    }
    if (code === 'PadLeft' || code === 'PadDown') this.keypadCursor = (this.keypadCursor + 9) % 10;
    else if (code === 'PadRight' || code === 'PadUp') this.keypadCursor = (this.keypadCursor + 1) % 10;
    else if (code === 'Use') Ms.enterDigit(this.keypadCursor);
    else return false;
    sfx.click();
    return true;
  },

  // Won: grade it, pay out, save it, then the outro scene and on to the next mission.
  storyClear() {
    const s = this.sim;
    const M = this.story;
    this.saveXp();
    const gr = gradeFor({ hurt: s.hurtTaken, maxHp: s.player.maxHp * s.players.length, kills: s.lv.kills, time: s.lv.time, combo: s.lv.bestCombo }).letter;
    const prog = this.storyProgress();
    const first = !prog[M.id];
    const best = first || GRADE_RANK[gr] > GRADE_RANK[prog[M.id]];
    if (best) {
      prog[M.id] = gr;
      store.set('story', prog);
    }
    const tokens = this.earnTokens(10 + GRADE_PAY[gr] + (first ? 10 : 0));
    this.countKills(s.lv.kills);
    this.checkRank();
    for (let i = 0; i < 6; i++) this.launchBurst();
    const stats = { id: M.id, name: M.name, grade: gr, kills: s.lv.kills, time: s.lv.time, combo: s.lv.bestCombo, score: s.score, tokens, best: best && !first };
    const next = M.chapter.missions[M.idx + 1];
    const lines = [{ k: 'result', stats }, ...(M.outro || [])];
    this.playScene(lines, () => (next ? this.startMission(next.id) : this.openStory()));
  },

  // Lost: the Blue Screen, with where in the mission it happened.
  storyDead() {
    const s = this.sim;
    const Ms = s.mission;
    this.deadStats.story = { id: this.story.id, name: this.story.name, step: Math.max(1, Ms.stepI + 1), steps: this.story.steps.length, text: Ms.step?.text || '' };
    this.deadStats.checkpoint = false;
  },
};

