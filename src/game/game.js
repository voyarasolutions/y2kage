// The whole program: boot sequence, menus, the run through 50 levels, and rendering each frame.
import * as THREE from 'three';
import { Pipeline } from '../gfx/pipeline.js';
import { buildTextures } from '../gfx/textures.js';
import { buildSprites } from '../gfx/sprites.js';
import { buildHorde } from '../gfx/horde.js';
import { buildBosses, packetPix, moundPix } from '../gfx/bosses.js';
import { tex as pixTex } from '../gfx/sprites.js';
import { settings, saveSettings, SENS_STEPS } from '../core/settings.js';
import { heroXp, saveHeroXp, heroSp, saveHeroSp, rankFor } from '../data/progress.js';
import { offer, upgradeById, UPGRADES, rarityOf } from '../data/upgrades.js';
import { perkMods, addTokens, clearTokens, buyPerk, PERKS } from '../data/shop.js';
import { dailyFor, dailyStarted, dailyFinished, dailyRecord } from '../data/daily.js';
import { grant, achById, cheats, addStat, stat, markHeroCleared, extraUnlocked, EXTRAS, toggleCheat } from '../data/achievements.js';
import { World } from '../world/world.js';
import { Sim, EYE, ZRAD, ZHEIGHT, MAX_PITCH, hitR, DIFFS } from './sim.js';
import { Input } from '../core/input.js';
import { W, H, TAU, rand, clamp, store, pickOne } from '../core/util.js';
import { PAL, PARTY } from '../core/palette.js';
import { MAPS, parseMap, stageFor } from '../data/maps.js';
import { HEROES, heroById } from '../data/heroes.js';
import { levelConfig, endlessConfig, clockFor, TOTAL_LEVELS, DISTRICTS, eventFor } from '../data/levels.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { WeaponView, weaponBob } from '../ui/weapon.js';
import { ViewModel } from '../gfx/viewmodel.js';
import { muzzleWorld } from '../data/muzzles.js';
import { hit } from '../ui/win98.js';
import * as HUD from '../ui/hud.js';
import * as SCR from '../ui/screens.js';
import { Net } from '../net/net.js';

// The Jackpot zombie's gold plating (a multiply tint on its sprite).
const GOLD_TINT = [1, 0.74, 0.08];
const ELITE_TINT = [1, 0.55, 0.5];
const DIFF_IDS = ['easy', 'normal', 'hard'];
const MENU_COUNT = { title: 7, paused: 4, clear: 2, dead: 2, mp: 3 };

export class Game {
  constructor(glCanvas, uiCanvas) {
    this.pipe = new Pipeline(glCanvas);
    this.T = buildTextures();
    this.S = buildSprites();
    this.S.horde = buildHorde();
    this.S.bosses = buildBosses(this.S.zombies.boss);
    this.S.packet = [pixTex(packetPix(0)), pixTex(packetPix(1))];
    this.S.mound = [0, 1, 2].map((f) => pixTex(moundPix(f)));
    this.world = new World(this.T, this.S);
    // Each district's map at each of its three stages (it opens up as the night goes on).
    this.maps = MAPS.map((m) => [1, 2, 3].map((st) => parseMap(m, st)));
    this.cv = uiCanvas;
    this.g = uiCanvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.weapon = new WeaponView();
    this.vm = new ViewModel();
    this.best = store.get('best', 1);
    this.bestScore = store.get('bestScore', 0);
    this.heroId = store.get('hero', 'tina');
    this.pickLevel = this.best;
    // Upgrades picked this run, Endless mode, trophy pop-ups waiting to show.
    this.runUps = [];
    // CPU teammates for offline play, and the upgrades each one has picked this run.
    this.cpu = clamp(store.get('cpu', 0) || 0, 0, 3);
    this.botUps = [[], [], []];
    this.endless = false;
    this.endlessOn = false;
    this.pickDistrict = 0;
    this.achQ = [];
    this.buttons = [];
    this.focus = 0;
    this.skyBursts = [];
    this.t = 0;
    this.modeT = 0;
    this.mode = 'power';
    this.sim = null;
    this.loadWorld(0, 1);
    this.input = new Input(uiCanvas, {
      key: (code) => this.onKey(code),
      keyUp: (code) => {
        if (code === 'Space' && this.sim && this.mode === 'play') this.sim.releaseJump();
      },
      press: (x, y, via) => this.onPress(x, y, via),
      lockLost: () => this.pause(),
      touchButton: (x, y) => {
        for (const k in HUD.TOUCH) {
          const b = HUD.TOUCH[k];
          if (Math.hypot(x - b.x, y - b.y) <= b.r + 3) {
            if (k === 'boost' && !['board', 'scooter'].includes(this.sim?.hero.move.type)) continue;
            if (k === 'special' && !this.input.spReady) continue;
            return k;
          }
        }
        return null;
      },
    });
    this.options = false;
    this.applySettings();
    this.setupNet();
    const skip = new URLSearchParams(location.search).get('skip');
    if (skip) this.setMode(skip);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------ options
  applySettings() {
    sfx.setVolumes(settings.music / 10, settings.sfx / 10);
    document.getElementById('stage')?.classList.toggle('scan', !!settings.scanlines);
  }

  openOptions() {
    this.options = true;
    this.optFocus = 0;
  }

  closeOptions() {
    this.options = false;
    saveSettings();
    sfx.click();
  }

  optAdjust(i, d) {
    if (i === 0) {
      const k = SENS_STEPS.indexOf(settings.sens);
      settings.sens = SENS_STEPS[Math.max(0, Math.min(SENS_STEPS.length - 1, (k < 0 ? 3 : k) + d))];
    }
    if (i === 1) settings.music = Math.max(0, Math.min(10, settings.music + d));
    if (i === 2) settings.sfx = Math.max(0, Math.min(10, settings.sfx + d));
    if (i === 3) settings.scanlines = !settings.scanlines;
    if (i === 4) settings.glitch = !settings.glitch;
    if (i === 5) settings.diff = DIFF_IDS[(DIFF_IDS.indexOf(settings.diff) + (d < 0 ? 2 : 1)) % 3];
    this.applySettings();
    saveSettings();
    sfx.click();
  }

  optionsKey(code) {
    const n = 7;
    if (code === 'Escape' || code === 'KeyP') return this.closeOptions();
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.optFocus = (this.optFocus + 1) % n;
    if (code === 'ArrowUp' || code === 'KeyW') this.optFocus = (this.optFocus + n - 1) % n;
    if (this.optFocus < 6) {
      if (code === 'ArrowLeft' || code === 'KeyA') this.optAdjust(this.optFocus, -1);
      if (code === 'ArrowRight' || code === 'KeyD') this.optAdjust(this.optFocus, 1);
      if ((code === 'Enter' || code === 'Space') && this.optFocus >= 3) this.optAdjust(this.optFocus, 1);
    } else if (code === 'Enter' || code === 'Space') this.closeOptions();
  }

  // ------------------------------------------------------------ helpers
  muted() {
    return sfx.muted;
  }

  toggleMute() {
    sfx.toggleMute();
  }

  setMode(m) {
    if (m !== this.mode && ['mp', 'join', 'lobby', 'title'].includes(m)) {
      this.netStatus = '';
      this.netError = false;
    }
    this.mode = m;
    this.modeT = 0;
    this.focus = 0;
    this.input.playing = m === 'play';
    this.cv.classList.toggle('play', m === 'play');
    if (m === 'title' || m === 'select' || m === 'howto' || m === 'mp' || m === 'lobby' || m === 'trophies' || m === 'shop') music.play('title');
    if (m === 'title' && this.pendingJoin) {
      this.joinCode = this.pendingJoin;
      this.pendingJoin = null;
      this.setMode('join');
      this.joinOnline();
    }
    if (m === 'dialup') this.dialLen = sfx.dialup();
    if (m === 'dead') {
      music.stop();
      sfx.bsod();
    }
  }

  loadWorld(mapIdx, levelN) {
    this.mapIdx = mapIdx;
    this.map = this.maps[mapIdx][(this.endless ? 3 : stageFor(levelN)) - 1];
    this.world.load(this.map, levelN, { dark: !this.endless && eventFor(levelN)?.id === 'blackout' });
  }

  addButton(b, on, idx) {
    this.buttons.push({ ...b, on, idx });
  }

  // ------------------------------------------------------------ flow
  toSelect() {
    this.saveXp();
    if (this.net.role === 'host') return this.backToLobby();
    if (this.net.role === 'guest') return this.leaveOnline();
    this.input.unlock();
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.sim = null;
    this.daily = null;
    this.pickLevel = clamp(this.pickLevel, 1, this.best);
    this.setMode('select');
  }

  pickHero(id) {
    this.heroId = id;
    sfx.click();
  }

  stepLevel(d) {
    if (this.endlessOn && extraUnlocked('endless')) this.pickDistrict = clamp(this.pickDistrict + d, 0, this.endlessMax());
    else this.pickLevel = clamp(this.pickLevel + d, 1, this.best);
    sfx.click();
  }

  startRun() {
    store.set('hero', this.heroId);
    this.hero = heroById(this.heroId);
    this.runScore = 0;
    this.runUps = this.headStart();
    this.botUps = [[], [], []];
    this.sim = null;
    this.daily = null;
    sfx.select();
    if (this.endlessOn && extraUnlocked('endless')) return this.startEndless(this.pickDistrict);
    this.startLevel(this.pickLevel);
  }

  // Head Start perk: a random common upgrade per tier at the start of a run.
  headStart() {
    const commons = UPGRADES.filter((u) => rarityOf(u) === 'common');
    const out = [];
    for (let i = 0; i < perkMods().head; i++) out.push(pickOne(commons).id);
    return out;
  }

  earnTokens(n) {
    n = Math.round(n * (this.sim?.diff || DIFFS.normal).tokens);
    this.tokensEarned = (this.tokensEarned || 0) + n;
    return addTokens(n);
  }

  // Endless mode (solo): one district, waves until you drop.
  startEndless(d) {
    this.saveXp();
    this.endless = true;
    this.endlessD = d;
    this.levelN = d * 10 + 1;
    this.runScore = 0;
    const D = this.daily;
    this.runUps = D ? D.ups.slice() : this.headStart();
    this.levelStartUps = [];
    // The daily starts gentle in any district, so it is fair on day one.
    const cfg = endlessConfig(d, D ? 4 + d * 2 : null);
    cfg.daily = !!D;
    if (D) cfg.radio = `DAILY BUG REPORT ${D.key}: ${D.twist.name}. ${D.twist.desc}`;
    this.loadWorld(d, this.levelN);
    this.botUps = [[], [], []];
    this.sim = new Sim(this.map, cfg, this.soloParty(this.runUps.slice()), this.levelN, { cheats: D ? { ...D.twist.cheats } : cheats(), diff: D ? 'normal' : settings.diff });
    this.levelStartScore = 0;
    this.setMode('play');
    music.play('play', { transpose: [0, 2, -2, 3, 5][d], tempo: 1 + d * 0.04 });
    this.input.lock();
  }

  // The Daily Bug Report: today's hero, district, twist and starting upgrades, the same for everyone.
  startDaily() {
    const D = dailyFor();
    this.daily = D;
    this.hero = D.hero;
    this.runScore = 0;
    this.sim = null;
    this.dailyStreak = dailyStarted();
    sfx.select();
    this.startEndless(D.district);
  }

  // Endless districts you can pick: any you have reached in the campaign.
  endlessMax() {
    return Math.min(DISTRICTS.length - 1, Math.floor((this.best - 1) / 10));
  }

  toggleEndless() {
    if (!extraUnlocked('endless')) return;
    this.endlessOn = !this.endlessOn;
    this.pickDistrict = clamp(this.pickDistrict, 0, this.endlessMax());
    sfx.click();
  }

  cycleCpu() {
    this.cpu = (this.cpu + 1) % 4;
    store.set('cpu', this.cpu);
    sfx.click();
  }

  // Offline party: you, then a CPU teammate on each of the next heroes in the roster.
  soloParty(ups, prev) {
    const party = [{ hero: this.hero, xp: heroXp(this.hero.id), sp: heroSp(this.hero.id), name: 'YOU', ups, perk: perkMods() }];
    const i = HEROES.findIndex((h) => h.id === this.hero.id);
    for (let k = 1; k <= this.cpu; k++) {
      const hero = HEROES[(i + k) % HEROES.length];
      const was = prev?.find((Q) => Q.bot && Q.hero.id === hero.id);
      party.push({ hero, xp: heroXp(hero.id), sp: was && !was.spKind ? was.sp : 0, name: hero.name, ups: this.botUps[k - 1].slice(), bot: true });
    }
    return party;
  }

  startLevel(n) {
    this.saveXp();
    this.endless = false;
    this.levelN = n;
    this.levelStartUps = this.runUps.slice();
    this.levelStartBotUps = this.botUps.map((l) => l.slice());
    const cfg = levelConfig(n);
    const mapIdx = Math.min(this.maps.length - 1, Math.floor((n - 1) / 10));
    this.loadWorld(mapIdx, n);
    if (this.net.role === 'host') {
      // Online host: everyone in the lobby joins the level; each guest learns which slot is theirs.
      const party = this.lobbyPlayers();
      // Special meters carry over from the level just played.
      const prev = this.sim?.players;
      if (prev && prev.length === party.length) party.forEach((p, i) => (p.sp = prev[i].spKind ? 0 : prev[i].sp));
      this.net.guests.forEach((g, i) => (g.slot = i + 1));
      const ch = cheats();
      this.sim = new Sim(this.map, cfg, party.map((p, i) => ({ hero: heroById(p.heroId), xp: p.xp, sp: p.sp, name: p.name, ups: p.ups, perk: i === 0 ? perkMods() : null })), n, { mode: 'host', local: 0, cheats: ch, diff: settings.diff });
      this.sim.out = [];
      this.net.guests.forEach((g) => this.net.send({ t: 'start', level: n, party, you: g.slot, cheats: ch }, g));
      this.snapT = 0;
    } else this.sim = new Sim(this.map, cfg, this.soloParty(this.runUps, this.sim?.players), n, { cheats: cheats(), diff: settings.diff });
    this.levelStartScore = this.runScore;
    this.setMode('play');
    const d = Math.floor((n - 1) / 10);
    music.play('play', { transpose: [0, 2, -2, 3, 5][d], tempo: 1 + d * 0.04 });
    this.input.lock();
  }

  levelClear(stats) {
    const s = this.sim;
    this.runScore += s.score;
    const n = this.levelN;
    this.clearStats = stats || { level: n, kills: s.lv.kills, time: s.lv.time, levelScore: s.score, score: this.runScore, combo: s.lv.bestCombo, headshots: s.lv.headshots || 0 };
    if (this.net.role === 'host') {
      this.net.send(s.snapshot());
      this.net.send({ t: 'end', kind: 'clear', stats: this.clearStats });
    }
    if (n + 1 > this.best && n < TOTAL_LEVELS) {
      this.best = n + 1;
      store.set('best', this.best);
    }
    this.bestScore = Math.max(this.bestScore, this.runScore);
    store.set('bestScore', this.bestScore);
    this.pickLevel = Math.min(this.best, n + 1);
    this.upOffer = n < TOTAL_LEVELS ? offer(this.runUps, 3, n, perkMods().luck) : [];
    this.rerolls = 1 + perkMods().rerolls;
    // Tokens for the shop: a few per level, more for bosses and the Jackpot. Guests earn theirs too.
    const jack = s.lv.jackpots || 0;
    this.clearStats.tokens = this.earnTokens(clearTokens(n) + 10 * jack);
    // CPU teammates take one of their own three.
    if (n < TOTAL_LEVELS) for (const l of this.botUps) l.push(...offer(l, 1, n));
    this.upPicked = null;
    this.checkClearAch(s, this.clearStats);
    this.input.unlock();
    sfx.clear();
    for (let i = 0; i < 6; i++) this.launchBurst();
    if (n >= TOTAL_LEVELS) {
      this.setMode('ending');
      this.endStats = { hero: this.hero.name, score: this.runScore };
      music.play('midnight');
      return;
    }
    music.stop();
    this.setMode('clear');
    this.upRevealT = this.t;
    if (this.upOffer.some((id) => upgradeById(id).rarity === 'legendary')) sfx.legendary();
  }

  // Endless and the Daily: an upgrade pick after every boss wave, while the break is on hold.
  openEndlessPick(wave) {
    const pm = perkMods();
    this.pickWave = wave;
    this.upOffer = offer(this.runUps, 3, 10 + wave * 2, pm.luck);
    this.rerolls = 1 + pm.rerolls;
    this.upPicked = null;
    this.upFocus = 0;
    this.upRevealT = this.t;
    // CPU teammates take one of their own three.
    this.sim.players.forEach((P, i) => {
      if (!P.bot) return;
      const l = this.botUps[i - 1];
      l.push(...offer(l, 1, 10 + wave * 2));
      this.sim.setUps(i, l);
    });
    this.input.mouse.down = false;
    this.input.unlock();
    this.setMode('pick');
    sfx.clear();
    if (this.upOffer.some((id) => upgradeById(id).rarity === 'legendary')) sfx.legendary();
  }

  // Take one of the three upgrades offered on the level-clear screen.
  pickUpgrade(id) {
    if (this.upPicked || !this.upOffer?.includes(id)) return;
    this.upPicked = id;
    this.runUps.push(id);
    sfx.upgrade();
    this.focus = 0;
    if (this.net.role === 'guest') this.net.send({ t: 'ups', ups: this.runUps });
    if (this.runUps.length >= 10) this.award('loaded');
    if (this.mode === 'pick') {
      this.sim.setUps(this.sim.local, this.runUps);
      this.sim.fx_toast?.('UPGRADE INSTALLED', upgradeById(id).name.toUpperCase());
      this.resume();
    }
  }

  // Swap the three cards for three new ones, once per cleared level.
  rerollUpgrades() {
    if (this.upPicked || !(this.rerolls > 0) || !this.upOffer?.length) return;
    this.rerolls--;
    this.upOffer = offer(this.runUps, 3, this.levelN, perkMods().luck);
    this.upRevealT = this.t;
    sfx.reroll();
  }

  nextLevel() {
    if (this.net.role === 'guest') return;
    this.startLevel(Math.min(TOTAL_LEVELS, this.levelN + 1));
  }

  retry() {
    if (this.net.role === 'guest') return;
    if (this.daily) return this.startDaily();
    if (this.endless) return this.startEndless(this.endlessD);
    this.runScore = this.levelStartScore;
    this.runUps = (this.levelStartUps || []).slice();
    if (this.levelStartBotUps) this.botUps = this.levelStartBotUps.map((l) => l.slice());
    this.startLevel(this.levelN);
  }

  buyPerk(id) {
    const p = PERKS.find((q) => q.id === id);
    const ok = buyPerk(id);
    this.shopFlash = { t: this.t, ok, text: ok ? `${p.name} installed!` : 'Not enough tokens' };
    if (ok) sfx.upgrade();
    else sfx.click();
  }

  // ------------------------------------------------------------ trophies
  award(id) {
    if (!grant(id)) return;
    const a = achById(id);
    const reward = a.reward ? EXTRAS.find((e) => e.id === a.reward) : null;
    this.achQ.push({ name: a.name, desc: a.desc, reward: reward ? reward.name : null, t: 0 });
    sfx.achievement();
  }

  // Trophies judged when a level is cleared (from this player's side of the screen).
  checkClearAch(sim, st) {
    if (sim.cfg.isBoss) this.award(`boss${Math.min(5, Math.floor((st.level - 1) / 10) + 1)}`);
    if (st.level >= TOTAL_LEVELS) this.award('boss5');
    if (st.level >= 5 && !sim.localHurt) this.award('flawless');
    if ((st.headshots || 0) >= 25) this.award('heads');
    if ((st.combo || 0) >= 40) this.award('combo');
    if (st.level >= 5 && st.time < 75) this.award('fast');
    if (this.net.active) this.award('lan');
    if (markHeroCleared(this.hero.id) >= 5) this.award('roster');
    this.countKills(st.kills);
    this.checkRank();
  }

  countKills(n) {
    const k = addStat('kills', n || 0);
    if (k >= 1000) this.award('kills1k');
    if (k >= 10000) this.award('kills10k');
  }

  checkRank() {
    if (this.hero && rankFor(Math.max(heroXp(this.hero.id), this.sim?.xp || 0)) >= 10) this.award('rank10');
  }

  // The Trophy Case: toggle an unlocked cheat.
  flipCheat(id) {
    if (!extraUnlocked(id)) return sfx.bsod();
    toggleCheat(id);
    sfx.click();
  }

  pause() {
    if (this.mode !== 'play') return;
    this.setMode('paused');
    this.input.mouse.down = false;
    this.input.unlock();
  }

  resume() {
    this.setMode('play');
    this.input.lock();
  }

  // ------------------------------------------------------------ input
  onKey(code) {
    sfx.unlock();
    if (code === 'KeyM') return this.toggleMute();
    if (this.options) return this.optionsKey(code);
    const m = this.mode;
    if (m === 'power') return this.powerOn();
    if (m === 'crt') return;
    if (m === 'bios') return this.setMode('dialup');
    if (m === 'dialup') return this.setMode('title');
    if (this.notice) {
      if (code === 'Enter' || code === 'Space' || code === 'Escape') this.dismissNotice();
      return;
    }
    if (m === 'join') return this.joinKey(code);
    if (m === 'lobby') return this.lobbyKey(code);
    if (m === 'mp' && code === 'Escape') return this.setMode('title');
    if (m === 'play') {
      if (code === 'Space') this.sim.pressJump();
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.sim.pressBoost();
      if ((code === 'KeyR' || code === 'Special') && this.sim.pressSpecial() && addStat('specials') >= 25) this.award('specials');
      if (code === 'KeyP' || code === 'Escape') this.pause();
      return;
    }
    if (m === 'ending') {
      if (this.modeT > 26) this.toTitle();
      return;
    }
    if (m === 'howto') {
      if (code === 'Enter' || code === 'Escape' || code === 'Space') this.setMode('title');
      return;
    }
    if (m === 'shop') {
      const n = PERKS.length;
      if (code === 'Escape' || code === 'Backspace') return this.setMode('title');
      if (code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.focus = (this.focus + 1) % (n + 1);
      if (code === 'ArrowUp' || code === 'KeyW') this.focus = (this.focus + n) % (n + 1);
      if (code === 'Enter' || code === 'Space') {
        if (this.focus === n) return this.setMode('title');
        this.buyPerk(PERKS[this.focus].id);
      }
      return;
    }
    if (m === 'trophies') {
      const n = EXTRAS.length - 1;
      if (code === 'Escape' || code === 'Backspace') return this.setMode('title');
      if (code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.focus = (this.focus + 1) % (n + 1);
      if (code === 'ArrowUp' || code === 'KeyW') this.focus = (this.focus + n) % (n + 1);
      if (code === 'Enter' || code === 'Space') {
        if (this.focus === n) return this.setMode('title');
        this.flipCheat(EXTRAS[this.focus + 1].id);
      }
      return;
    }
    if (m === 'select') {
      const i = HEROES.findIndex((h) => h.id === this.heroId);
      if (/^Digit[1-5]$/.test(code)) this.pickHero(HEROES[+code.slice(5) - 1].id);
      if (code === 'ArrowRight' || code === 'KeyD') this.pickHero(HEROES[(i + 1) % HEROES.length].id);
      if (code === 'ArrowLeft' || code === 'KeyA') this.pickHero(HEROES[(i + HEROES.length - 1) % HEROES.length].id);
      if (code === 'ArrowUp' || code === 'KeyW') this.stepLevel(1);
      if (code === 'ArrowDown' || code === 'KeyS') this.stepLevel(-1);
      if (code === 'Enter' || code === 'Space') this.startRun();
      if (code === 'Tab' || code === 'KeyE') this.toggleEndless();
      if (code === 'KeyC') this.cycleCpu();
      if (code === 'Escape') this.setMode('title');
      return;
    }
    if ((m === 'clear' || m === 'pick') && this.upOffer?.length && !this.upPicked) {
      // Pick an upgrade first: left/right move between the cards, Enter takes one.
      const n = this.upOffer.length;
      if (/^Digit[1-3]$/.test(code)) return this.pickUpgrade(this.upOffer[+code.slice(5) - 1]);
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'Tab' || code === 'ArrowDown') this.upFocus = ((this.upFocus || 0) + 1) % n;
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp') this.upFocus = ((this.upFocus || 0) + n - 1) % n;
      if (code === 'Enter' || code === 'Space') this.pickUpgrade(this.upOffer[this.upFocus || 0]);
      if (code === 'KeyR' || code === 'KeyC') this.rerollUpgrades();
      if (code === 'Escape' && m === 'clear') this.toSelect();
      sfx.click();
      return;
    }
    if (m === 'dead') {
      if (code === 'Escape') return this.toSelect();
      if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Tab') return (this.focus = 1 - this.focus);
      if (code === 'Enter' || code === 'Space') return this.focus ? this.toSelect() : this.retry();
      return this.retry();
    }
    if (m === 'paused' && (code === 'KeyP' || code === 'Escape')) return this.resume();
    if (m === 'clear' && code === 'Escape') return this.toSelect();
    const n = MENU_COUNT[m];
    if (n) {
      if (code === 'ArrowDown' || code === 'ArrowRight' || code === 'Tab' || code === 'KeyS') {
        this.focus = (this.focus + 1) % n;
        sfx.click();
      }
      if (code === 'ArrowUp' || code === 'ArrowLeft' || code === 'KeyW') {
        this.focus = (this.focus + n - 1) % n;
        sfx.click();
      }
      if (code === 'Enter' || code === 'Space') {
        const b = this.buttons.find((b) => b.idx === this.focus);
        if (b) {
          sfx.click();
          b.on();
        }
      }
    }
  }

  onPress(x, y) {
    sfx.unlock();
    const m = this.mode;
    if (m === 'power') return this.powerOn();
    if (m === 'bios') return this.setMode('dialup');
    if (m === 'dialup') return this.setMode('title');
    if (m === 'play') {
      this.input.lock();
      return;
    }
    if (m === 'ending') {
      if (this.modeT > 26) this.toTitle();
      return;
    }
    for (const b of this.buttons) {
      if (hit(b, x, y)) {
        sfx.click();
        b.on();
        return;
      }
    }
    if (m === 'dead') this.retry();
  }

  powerOn() {
    sfx.unlock();
    this.setMode('crt');
  }

  toTitle() {
    this.saveXp();
    if (this.net.active) this.net.leave();
    this.sim = null;
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.setMode('title');
  }

  // ------------------------------------------------------------ online co-op
  setupNet() {
    this.joinCode = '';
    this.net = new Net({
      locked: () => this.mode !== 'lobby',
      fromGuest: (g, m) => this.fromGuest(g, m),
      guestLeft: (g) => this.guestLeft(g),
      fromHost: (m) => this.fromHost(m),
      hostLeft: () => this.hostLeft(),
      error: (msg) => this.netNote(msg, true),
    });
    const join = new URLSearchParams(location.search).get('join');
    if (join) this.pendingJoin = join.toUpperCase().slice(0, 5);
  }

  isGuest() {
    return this.net.role === 'guest';
  }

  netNote(msg, err = false) {
    this.netStatus = msg;
    this.netError = err;
  }

  showNotice(title, text) {
    this.notice = { title, text };
  }

  dismissNotice() {
    this.notice = null;
    sfx.click();
  }

  async hostOnline() {
    if (this.netBusy) return;
    this.netBusy = true;
    this.netNote('Dialing the matchmaker...');
    try {
      const code = await this.net.host();
      this.lobby = { code, you: 0, level: clamp(this.pickLevel, 1, this.best), players: [] };
      this.lobby.players = this.lobbyPlayers();
      this.setMode('lobby');
      sfx.select();
    } catch (e) {
      this.netNote(String(e), true);
    }
    this.netBusy = false;
  }

  promptCode() {
    // Phones have no keyboard on a canvas, so fall back to the browser's own prompt.
    if (!this.input.touch.on) return;
    const v = window.prompt('Room code', this.joinCode);
    if (v != null) this.joinCode = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  }

  joinKey(code) {
    if (code === 'Escape') return this.cancelJoin();
    if (code === 'Enter') return this.joinOnline();
    if (code === 'Backspace') this.joinCode = this.joinCode.slice(0, -1);
    const k = /^Key([A-Z])$/.exec(code) || /^Digit([0-9])$/.exec(code);
    if (k && this.joinCode.length < 5) {
      this.joinCode += k[1];
      sfx.key();
    }
  }

  cancelJoin() {
    this.net.leave();
    this.netBusy = false;
    this.setMode('mp');
  }

  async joinOnline() {
    if (this.netBusy || this.joinCode.length < 5) return;
    this.netBusy = true;
    this.netNote('Dialing...');
    try {
      await this.net.join(this.joinCode);
      this.netNote('Connected! Saying hello...');
      this.net.send({ t: 'hello', hero: this.heroId, xp: heroXp(this.heroId), sp: heroSp(this.heroId) });
    } catch (e) {
      this.netNote(String(e), true);
    }
    this.netBusy = false;
  }

  leaveOnline() {
    this.saveXp();
    this.net.leave();
    this.lobby = null;
    this.sim = null;
    this.input.unlock();
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.setMode('mp');
  }

  // Host: the lobby roster, host first then guests in join order.
  lobbyPlayers() {
    const list = [{ name: 'P1', heroId: this.heroId, xp: heroXp(this.heroId), sp: heroSp(this.heroId), ups: this.runUps.slice() }];
    this.net.guests.forEach((g, i) => list.push({ name: `P${i + 2}`, heroId: g.info?.heroId || 'tina', xp: g.info?.xp || 0, sp: g.info?.sp || 0, ups: (g.info?.ups || []).slice() }));
    return list;
  }

  broadcastLobby() {
    if (this.net.role !== 'host' || !this.lobby) return;
    const players = this.lobbyPlayers();
    this.lobby.players = players;
    this.net.guests.forEach((g, i) => this.net.send({ t: 'lobby', code: this.net.code, level: this.lobby.level, players, you: i + 1 }, g));
  }

  backToLobby() {
    this.saveXp();
    this.sim = null;
    this.input.unlock();
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.lobby.level = clamp(this.levelN ? Math.min(this.best, this.levelN + 1) : this.lobby.level, 1, this.best);
    this.setMode('lobby');
    this.broadcastLobby();
  }

  lobbyHero(d) {
    const i = HEROES.findIndex((h) => h.id === this.heroId);
    this.heroId = HEROES[(i + d + HEROES.length) % HEROES.length].id;
    store.set('hero', this.heroId);
    sfx.click();
    if (this.net.role === 'host') this.broadcastLobby();
    else {
      this.net.send({ t: 'pick', hero: this.heroId, xp: heroXp(this.heroId), sp: heroSp(this.heroId) });
      // Show the change straight away; the host's next roster confirms it.
      const me = this.lobby?.players[this.lobby.you];
      if (me) {
        me.heroId = this.heroId;
        me.xp = heroXp(this.heroId);
      }
    }
  }

  lobbyLevel(d) {
    if (this.net.role !== 'host') return;
    this.lobby.level = clamp(this.lobby.level + d, 1, this.best);
    sfx.click();
    this.broadcastLobby();
  }

  lobbyKey(code) {
    if (code === 'Escape') return this.leaveOnline();
    if (code === 'ArrowLeft' || code === 'KeyA') this.lobbyHero(-1);
    if (code === 'ArrowRight' || code === 'KeyD') this.lobbyHero(1);
    if (code === 'ArrowUp' || code === 'KeyW') this.lobbyLevel(1);
    if (code === 'ArrowDown' || code === 'KeyS') this.lobbyLevel(-1);
    if ((code === 'Enter' || code === 'Space') && this.net.role === 'host') this.startOnline();
  }

  startOnline() {
    if (this.net.role !== 'host') return;
    this.hero = heroById(this.heroId);
    this.runScore = 0;
    this.runUps = [];
    this.net.guests.forEach((g) => g.info && (g.info.ups = []));
    sfx.select();
    this.startLevel(this.lobby.level);
  }

  copyJoinLink() {
    const url = `${location.origin}${location.pathname}?join=${this.net.code}`;
    const done = () => {
      this.copiedT = 2;
      sfx.click();
    };
    try {
      navigator.clipboard.writeText(url).then(done, () => window.prompt('Send this link to your friends', url));
    } catch (e) {
      window.prompt('Send this link to your friends', url);
    }
  }

  fromGuest(g, m) {
    if (m.t === 'hello' || m.t === 'pick') {
      g.info = { heroId: heroById(m.hero).id, xp: Math.max(0, Number(m.xp) || 0), sp: Math.max(0, Math.min(100, Number(m.sp) || 0)), ups: g.info?.ups || [] };
      this.broadcastLobby();
    } else if (m.t === 'ups') {
      if (g.info && Array.isArray(m.ups)) g.info.ups = m.ups.filter((id) => upgradeById(id)).slice(0, 60);
    } else if (m.t === 'in') {
      if (this.sim && g.slot != null && Array.isArray(m.p) && Array.isArray(m.v)) this.sim.applyRemoteInput(g.slot, m);
    } else if (m.t === 'act') {
      if (this.sim && g.slot != null && this.mode !== 'clear' && this.mode !== 'dead') this.sim.remoteAct(g.slot, m.a, ...(m.args || []));
    }
  }

  guestLeft(g) {
    if (this.mode === 'lobby') return this.broadcastLobby();
    const P = this.sim?.players[g.slot];
    if (P) {
      P.gone = true;
      P.down = true;
      P.hp = 0;
      this.sim.toast(`${P.name} DISCONNECTED`, 'Carry on without them');
      if (!this.sim.alive().length && this.sim.lv.phase !== 'done') {
        this.sim.lv.phase = 'done';
        this.sim.emit('dead');
      }
    }
  }

  fromHost(m) {
    if (m.t === 'lobby') {
      const first = !this.lobby;
      this.lobby = { code: m.code, level: m.level, players: m.players, you: m.you };
      if (this.mode !== 'lobby') {
        this.saveXp();
        this.sim = null;
        this.input.unlock();
        if (this.mapIdx !== 0) this.loadWorld(0, 1);
        this.setMode('lobby');
        if (first) sfx.select();
        else this.net.send({ t: 'pick', hero: this.heroId, xp: heroXp(this.heroId), sp: heroSp(this.heroId) });
      }
    } else if (m.t === 'start') {
      this.saveXp();
      const me = m.party[m.you];
      this.heroId = me.heroId;
      this.hero = heroById(me.heroId);
      this.levelN = m.level;
      const cfg = levelConfig(m.level);
      this.loadWorld(Math.min(this.maps.length - 1, Math.floor((m.level - 1) / 10)), m.level);
      this.runUps = (me.ups || []).filter((id) => upgradeById(id));
      this.levelStartUps = this.runUps.slice();
      this.endless = false;
      this.sim = new Sim(this.map, cfg, m.party.map((p) => ({ hero: heroById(p.heroId), xp: p.xp, sp: p.sp, name: p.name, ups: (p.ups || []).filter((id) => upgradeById(id)) })), m.level, { mode: 'client', local: m.you, cheats: m.cheats || {} });
      this.sim.act = (a, ...args) => this.net.send({ t: 'act', a, args });
      this.runScore = this.runScore || 0;
      this.levelStartScore = this.runScore;
      this.sendT = 0;
      this.setMode('play');
      const d = Math.floor((m.level - 1) / 10);
      music.play('play', { transpose: [0, 2, -2, 3, 5][d], tempo: 1 + d * 0.04 });
      this.input.lock();
    } else if (m.t === 'snap') {
      if (this.sim && this.sim.mode === 'client') this.sim.applySnapshot(m);
    } else if (m.t === 'end') {
      if (!this.sim) return;
      this.saveXp();
      if (m.kind === 'clear') {
        this.runScore = m.stats.score - this.sim.score;
        this.levelClear(m.stats);
      } else {
        this.deadStats = { ...m.stats, tokens: this.earnTokens(m.stats.tokens || 0) };
        this.input.unlock();
        this.setMode('dead');
      }
    } else if (m.t === 'full') {
      this.net.leave();
      this.setMode('join');
      this.netNote('That room is full or already playing.', true);
    }
  }

  hostLeft() {
    this.saveXp();
    this.lobby = null;
    this.sim = null;
    this.input.unlock();
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.setMode('mp');
    this.showNotice('Connection lost', 'The host closed the room or dropped offline.');
  }

  // Host sends snapshots about 20 times a second; guests send their movement about 30.
  netTick(dt) {
    const sim = this.sim;
    if (!sim) return;
    if (this.net.role === 'host') {
      this.snapT = (this.snapT || 0) + dt;
      if (this.snapT >= 0.05) {
        this.snapT = 0;
        if (this.net.guests.length) this.net.send(sim.snapshot());
        else sim.out = [];
      }
    } else if (this.net.role === 'guest') {
      this.sendT = (this.sendT || 0) + dt;
      if (this.sendT >= 1 / 30) {
        this.sendT = 0;
        this.net.send(sim.inputState());
      }
    }
  }

  // Test hook: run the game forward without drawing (headless playtests).
  ff(seconds, input = {}) {
    const dt = 1 / 30;
    for (let i = 0; i < seconds * 30 && this.mode === 'play'; i++) {
      this.input.lookDX = 0;
      const inp = { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0, ...input };
      this.sim.update(dt, inp);
      this.modeT += dt;
      this.t += dt;
      this.handleEvents();
    }
    return this.mode;
  }

  // ------------------------------------------------------------ loop
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.modeT += dt;
    try {
      this.update(dt);
      this.render(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    music.tick();
    this.input.pollPad(dt);
    const m = this.mode;
    if (m === 'crt' && this.modeT > 0.5) {
      sfx.postBeep();
      this.setMode('bios');
    }
    if (m === 'bios' && this.modeT > 3.9) this.setMode('dialup');
    if (m === 'dialup' && this.modeT > (this.dialLen || 5.2)) this.setMode('title');
    this.copiedT = Math.max(0, (this.copiedT || 0) - dt);
    // Online, the level keeps running behind the pause menu.
    const online = this.net.active && this.sim && m === 'paused';
    if (m === 'play' || online) {
      const inp = m === 'play' ? this.input.state() : { move: { f: 0, s: 0 }, turn: 0, fire: false, look: 0 };
      const LP = this.sim.player;
      LP.a += inp.look * 0.0026 * settings.sens;
      LP.pitch = clamp((LP.pitch || 0) - (inp.lookY || 0) * 0.0026 * settings.sens, -MAX_PITCH, MAX_PITCH);
      this.input.spReady = this.sim.player.sp >= 100 && !this.sim.player.spKind;
      // Hit-stop: the world holds still for a beat on a big kill (offline only; online keeps time).
      if (this.sim.hitStop > 0 && !this.net.active) this.sim.hitStop -= dt;
      else this.sim.update(this.sim.cheats.turbo ? dt * 1.25 : dt, inp);
      if (this.endless && this.sim.lv.wave + 1 >= 20) this.award('wave20');
      this.netTick(dt);
      this.handleEvents();
      if (this.sim && this.mode === 'play') {
        if (this.sim.boss) music.play('boss', { transpose: 0, tempo: 1 });
        else if (music.name === 'boss') {
          const d = Math.floor((this.levelN - 1) / 10);
          music.play('play', { transpose: [0, 2, -2, 3, 5][d], tempo: 1 + d * 0.04 });
        }
      }
    }
    this.updateBursts(dt);
    // Trophy pop-ups slide in one at a time.
    if (this.achQ.length) {
      this.achQ[0].t += dt;
      if (this.achQ[0].t > 4) this.achQ.shift();
    }
  }

  saveXp() {
    if (this.sim && this.hero) {
      saveHeroXp(this.hero.id, this.sim.xp);
      const P = this.sim.player;
      if (P.hero.id === this.hero.id) saveHeroSp(this.hero.id, P.spKind ? 0 : P.sp);
    }
  }

  handleEvents() {
    if (!this.sim) return;
    for (const e of this.sim.events.splice(0)) {
      if (e.type === 'levelup' || e.type === 'dead' || e.type === 'clear') this.saveXp();
      if (e.type === 'dead') {
        this.deadStats = { level: this.levelN, kills: this.sim.lv.kills, score: this.runScore + this.sim.score, hero: this.sim.players.length > 1 ? 'The crew' : this.hero.name, wave: this.sim.lv.wave + 1, waves: this.sim.cfg.waves.length, left: this.sim.remaining(), xp: this.sim.player.xp, me: this.hero.name, best: this.best };
        if (this.daily) {
          const wave = this.sim.lv.wave + 1;
          const score = this.runScore + this.sim.score;
          const newBest = dailyFinished(wave, score);
          const rec = dailyRecord();
          this.deadStats.daily = { wave, newBest, best: rec.today.best, streak: rec.streak, key: this.daily.key, twist: this.daily.twist.name };
        } else if (this.endless) {
          const wave = this.sim.lv.wave + 1;
          const best = store.get('endless', {}) || {};
          this.deadStats.endless = { wave, district: DISTRICTS[this.endlessD].name, best: Math.max(wave, best[this.endlessD] || 0), newBest: wave > (best[this.endlessD] || 0) };
          best[this.endlessD] = this.deadStats.endless.best;
          store.set('endless', best);
        }
        // Tokens even when you fall: two per Endless wave, or one per 25 kills in the campaign.
        const ds = this.deadStats;
        ds.tokens = this.earnTokens(ds.daily || ds.endless ? (ds.wave - 1) * 2 + Math.floor(ds.kills / 25) : Math.floor(ds.kills / 25) + 10 * (this.sim.lv.jackpots || 0));
        this.countKills(this.sim.lv.kills);
        this.checkRank();
        if (this.net.role === 'host') {
          this.net.send(this.sim.snapshot());
          this.net.send({ t: 'end', kind: 'dead', stats: this.deadStats });
        }
        this.bestScore = Math.max(this.bestScore, this.runScore + this.sim.score);
        store.set('bestScore', this.bestScore);
        this.input.unlock();
        this.setMode('dead');
      }
      if (e.type === 'clear') this.levelClear();
      if (e.type === 'bossDown') for (let i = 0; i < 5; i++) this.launchBurst();
      if (e.type === 'jackpot') this.award('jackpot');
      if (e.type === 'endlessPick' && this.mode === 'play') this.openEndlessPick(e.wave);
      if (e.type === 'overdrive') this.award('overdrive');
    }
  }

  // Fireworks over the skyline.
  launchBurst() {
    const cols = [pickOne(PARTY), pickOne(PARTY)];
    const n = 50;
    const parts = [];
    const b = rand(0, TAU);
    const dist = rand(45, 70);
    const cx = (this.camX || 0) + Math.cos(b) * dist;
    const cz = (this.camZ || 0) + Math.sin(b) * dist;
    const cy = rand(16, 30);
    for (let i = 0; i < n; i++) {
      const u = rand(-1, 1);
      const th = rand(0, TAU);
      const r = Math.sqrt(1 - u * u);
      const s = rand(7, 10);
      parts.push({ x: cx, y: cy, z: cz, vx: r * Math.cos(th) * s, vy: u * s, vz: r * Math.sin(th) * s, life: rand(1.2, 2), c: cols[i % 2] });
    }
    this.skyBursts.push(parts);
    if (this.mode !== 'play' || Math.random() < 0.3) sfx.boom();
  }

  updateBursts(dt) {
    const outdoor = !this.world.indoor;
    const rate = this.mode === 'ending' ? 5 : this.mode === 'play' ? 0.6 : 1.1;
    if (outdoor && Math.random() < dt * rate) this.launchBurst();
    for (const parts of this.skyBursts) {
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 1 - dt * 1.4;
        p.vz *= 1 - dt * 1.4;
        p.vy = p.vy * (1 - dt * 1.4) - 3 * dt;
        p.life -= dt;
      }
    }
    this.skyBursts = this.skyBursts.map((ps) => ps.filter((p) => p.life > 0)).filter((ps) => ps.length);
  }

  // ------------------------------------------------------------ render
  render(dt) {
    const W3 = this.world;
    const g = this.g;
    const m = this.mode;
    W3.beginFrame();
    let fx = { time: this.t };
    const sim = this.sim;
    if (sim && (m === 'play' || m === 'paused' || m === 'pick' || m === 'dead' || m === 'clear')) {
      fx = this.renderPlay(sim, fx);
    } else if (m === 'ending') {
      this.renderEnding();
    } else {
      // Attract mode: a slow turn around Times Square.
      const s = this.map.start;
      const a = this.t * 0.12;
      this.camX = s.x;
      this.camZ = s.y;
      W3.setCamera(s.x, EYE + 0.1, s.y, a, 0.05);
    }
    for (const parts of this.skyBursts) for (const p of parts) W3.spark(p.x, p.y, p.z, p.life < 0.4 && Math.random() < 0.5 ? PAL.cream : p.c);
    const clock = sim ? sim.cfg.clock : clockFor(0);
    W3.tick(dt, {
      jumboKey: `${sim ? sim.levelN : 0}:${sim?.boss ? 'b' : ''}:${Math.floor(this.t / 4)}`,
      clock: `11:${String(clock.m).padStart(2, '0')}`,
      sub: `T-${clock.minutesLeft} MIN`,
      jumboMode: sim?.boss ? 'boss' : null,
    });
    W3.endFrame();
    if (m === 'power' || m === 'crt' || m === 'bios') fx.fade = 0;
    if (m === 'dialup' || m === 'howto') fx.fade = 0.4;
    if (m === 'dead') fx.fade = 0;
    if (!settings.glitch) fx.glitch = 0;
    // 3D first-person weapons ride on top of the world in the same pixel pass.
    const overlay = sim && (m === 'play' || m === 'paused' || m === 'pick') ? this.vm.frame(sim, this.t, dt, weaponBob(sim.player), this.world) : null;
    this.pipe.render(W3.scene, W3.camera, fx, overlay);
    this.drawUI(g);
  }

  renderPlay(sim, fx) {
    const W3 = this.world;
    const S = this.S;
    const P = sim.player;
    const shake = sim.shake;
    const sx = shake > 0 ? rand(-1, 1) * shake * 0.06 : 0;
    const sy = shake > 0 ? rand(-1, 1) * shake * 0.04 : 0;
    const M = sim.hero.move;
    let roll = 0;
    if ((M.type === 'skate' || M.type === 'board') && P.onGround) {
      const side = -Math.sin(P.a) * P.vx + Math.cos(P.a) * P.vy;
      roll = clamp(side * 0.02, -0.06, 0.06);
    }
    const eye = EYE + P.z + P.bob;
    this.camX = P.x;
    this.camZ = P.y;
    W3.setCamera(P.x + sx, eye + sy, P.y, P.a, P.pitch || 0, roll);
    const cam = W3.camera;
    cam.updateMatrixWorld();
    // Zombies.
    const dIdx = Math.min(4, Math.floor((this.levelN - 1) / 10));
    const look = (z) => {
      if (z.kind === 'boss') return S.bosses[sim.bossIdx] || S.zombies.boss;
      const list = S.horde[z.kind]?.[dIdx];
      return list ? list[z.look % list.length] : S.zombies[z.kind];
    };
    const bigHead = sim.cheats.bighead;
    for (const z of sim.zombies) {
      // A burrowed boss is just a moving mound of dirt; surfacing, the street cracks in a red ring.
      if (z.bs) {
        W3.decal(S.shadow, z.x, z.y, z.bs === 2 ? 2.4 : 1.4, 0, 0.6);
        const heave = z.bs === 2 ? 2 : Math.floor(this.t * 8) % 2;
        W3.sprite(S.mound[heave], z.x, 0, z.y, z.bs === 2 ? 1.8 : 1.3, z.bs === 2 ? 0.8 : 0.55);
        for (let k = 0; k < 6; k++) W3.particle(z.x + rand(-0.5, 0.5), rand(0, 0.25), z.y + rand(-0.5, 0.5), k % 2 ? '#6a5a44' : '#a89878');
        if (z.bs === 2) this.floorRing(z.x, z.y, 1.9, Math.floor(this.t * 12) % 2 ? PAL.red : PAL.gold);
        continue;
      }
      const Z = look(z);
      let tex;
      if (z.hurtT > 0 && Math.floor(this.t * 16) % 2 === 0) tex = Z.flash[0];
      else if (z.state === 'attack') tex = Z.atk[z.atkT > 0.18 ? 0 : 1];
      else if (z.state === 'windup') tex = Z.atk[1];
      else tex = Z.walk[Math.floor(z.anim) % 4];
      const h = ZHEIGHT[z.kind] * (Z.hmul || 1) * (z.sc || 1);
      const grow = z.spawnT > 0 ? 1 - z.spawnT / 0.6 : 1;
      W3.sprite(tex, z.x, 0, z.y, h * Z.aspect, h * grow, z.gold ? GOLD_TINT : z.elite ? ELITE_TINT : undefined);
      W3.decal(S.shadow, z.x, z.y, hitR(z) * 2.6, 0, 0.45);
      // Big Heads cheat: a swollen copy of the head over the real one.
      if (bigHead && z.kind !== 'boss' && z.kind !== 'crawler' && grow >= 1) {
        const hd = this.headOf(Z.walk[0]);
        const hh = h * hd.frac * 1.9;
        W3.sprite(hd.tex, z.x - Math.cos(P.a) * 0.02, h * (1 - hd.frac * 1.35), z.y - Math.sin(P.a) * 0.02, hh * hd.aspect, hh, z.hurtT > 0 ? [1.6, 1.6, 1.6] : undefined);
      }
    }
    // Boss shockwaves roll along the floor; packets fly at chest height.
    for (const g of sim.rings) {
      this.floorRing(g.x, g.y, g.r, PAL.pink, 0.04);
      this.floorRing(g.x, g.y, g.r, PAL.cyan, 0.22);
      // A wall of sparks along the wave so it reads from a distance.
      const n = Math.round(g.r * 9);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.t;
        W3.particle(g.x + Math.cos(a) * g.r, 0.05 + Math.random() * 0.17, g.y + Math.sin(a) * g.r, PARTY[i % PARTY.length]);
      }
    }
    for (const b of sim.bolts) W3.sprite(S.packet[b.c ? 1 : 0], b.x, b.z - 0.12, b.y, 0.26, 0.26);
    for (const c of sim.corpses) {
      const Z = look(c);
      const h = ZHEIGHT[c.kind] * (Z.hmul || 1) * (c.sc || 1);
      if (c.headless) {
        // Stands headless for a beat, twitching, then crumples into the goo.
        const body = this.headless(Z.walk[0]);
        const k = c.t < 0.4 ? 1 : Math.max(0, 1 - (c.t - 0.4) / 0.5);
        const jx = c.t < 0.4 ? Math.sin(c.t * 60) * 0.02 : 0;
        if (k > 0.05) W3.sprite(body, c.x + jx, 0, c.y, h * Z.aspect * (1 + (1 - k) * 0.5), h * k);
      } else W3.sprite(Z.die[Math.min(2, Math.floor(c.t / 0.17))], c.x, 0, c.y, h * Z.aspect, h);
    }
    for (const hd of sim.heads) {
      const Z = look(hd);
      const h = ZHEIGHT[hd.kind] * (Z.hmul || 1) * (hd.sc || 1);
      const head = this.headOf(Z.walk[0]);
      const hh = h * head.frac;
      const sp = W3.sprite(head.tex, hd.x, hd.z, hd.y, hh * head.aspect, hh);
      sp.center.set(0.5, 0.5);
      sp.material.rotation = hd.spin;
      W3.decal(S.shadow, hd.x, hd.y, 0.3, 0, 0.35);
    }
    for (const s of sim.splats) W3.decal(s.big ? S.gooBig : S.goo, s.x, s.y, s.big ? 1.6 : 0.9, s.rot, Math.min(1, s.t / 2));
    for (const p of sim.pickups) {
      if (p.t < 3 && Math.floor(p.t * 8) % 2) continue;
      const tex = S.pickups[p.kind];
      const w = p.kind === 'health' ? 0.22 : p.kind === 'cad' ? 0.4 : 0.3;
      const hh = (w * tex.image.height) / tex.image.width;
      W3.sprite(tex, p.x, 0.1 + Math.sin(this.t * 3 + p.ph) * 0.05, p.y, w, hh);
      W3.decal(S.shadow, p.x, p.y, 0.4, 0, 0.3);
    }
    // Teammates, standing on their rides.
    for (const Q of sim.players) {
      if (Q === P) continue;
      const set = S.heroTex[Q.heroIdx];
      const tex = set[Math.floor(this.t * 2.5) & 1];
      const hop = Q.z || 0;
      if (Q.down) {
        W3.sprite(S.heroTex[Q.heroIdx][0], Q.x, 0, Q.y, 0.7, 1.08, [0.35, 0.35, 1]);
      } else W3.sprite(tex, Q.x, hop, Q.y, 0.7, 1.08, Q.iT > 0 && Math.floor(this.t * 10) % 2 ? [0.6, 1, 0.6] : undefined);
      W3.decal(S.shadow, Q.x, Q.y, 0.6, 0, 0.45);
    }
    // Projectiles.
    const right = { x: -Math.sin(P.a), y: Math.cos(P.a) };
    for (const p of sim.projs) {
      if (p.kind === 'water') W3.sprite(S.water, p.x, p.z - 0.05, p.y, 0.1, 0.1);
      else if (p.kind === 'yoyo') {
        const set = p.hand ? S.yoyo2 : S.yoyo;
        W3.sprite(set[Math.floor(p.spin) % 4], p.x, p.z - 0.1, p.y, 0.22, 0.22);
        // The string runs back to the hand that threw it (on screen, the yo-yo hand).
        const O = sim.players[p.o] || P;
        const h = muzzleWorld('yoyo', p.hand ? 1 : 0, O.x, O.y, O === P ? eye : EYE + (O.z || 0), O.a, O.pitch || 0);
        W3.line([h.x, h.z, h.y], [p.x, p.z, p.y], PAL.cream);
      } else if (p.kind === 'floppy') W3.sprite(S.floppy[Math.floor(p.spin) % 4], p.x, p.z - 0.12, p.y, 0.24, 0.24);
      else if (p.kind === 'rocket') W3.sprite(S.flare[Math.floor(this.t * 20) % 2], p.x, p.z - 0.14, p.y, 0.28, 0.28);
    }
    for (const q of sim.particles) W3.particle(q.x, q.z, q.y, q.color);
    W3.ambient(this.t, P.x, P.y);
    for (const l of sim.lasers) {
      const mine = l.o === sim.local;
      // Our own pointer beam starts at the hand on screen; everything else from the owner's body.
      const ox = mine ? P.x : l.x;
      const oy = mine ? P.y : l.y;
      const oe = mine ? eye : l.z;
      const fx2 = Math.cos(l.a);
      const fy2 = Math.sin(l.a);
      // Our own pointer's beam starts at the pen tip on screen.
      const tip = mine && !l.sp ? muzzleWorld('laser', 0, ox, oy, oe, l.a, l.pt || 0) : null;
      const mx = tip ? tip.x : ox + fx2 * 0.3;
      const my = tip ? tip.y : oy + fy2 * 0.3;
      const hx = ox + fx2 * l.d;
      const hy = oy + fy2 * l.d;
      const top = l.sp ? oe - 0.3 : tip ? tip.z : oe - 0.17;
      const end = l.sp ? oe - 0.3 : oe + l.d * Math.tan(l.pt || 0) - (mine ? 0.02 : 0.08);
      if (l.sp) {
        // Light Show beams cycle through the party colours and are drawn thick.
        const c = PARTY[(Math.floor(this.t * 8) + Math.round(l.a * 3)) % PARTY.length];
        for (let k = -2; k <= 2; k++) W3.line([mx, top + k * 0.01, my], [hx, end + k * 0.01, hy], k ? c : PAL.white);
      } else {
        W3.line([mx, top, my], [hx, end, hy], PAL.red);
        W3.line([mx, top - 0.005, my], [hx, end - 0.005, hy], '#ff9090');
      }
      W3.sprite(S.flare[1], hx - fx2 * 0.05, end - 0.12, hy - fy2 * 0.05, 0.14, 0.14, [1, 0.3, 0.3]);
    }
    fx.glitch = sim.glitchT > 0 ? 0.6 : 0;
    if (sim.flash) {
      fx.flash = sim.flash.color;
      fx.flashAmt = sim.flash.amt * (sim.flash.t / 0.2);
    }
    return fx;
  }

  renderEnding() {
    const W3 = this.world;
    if (this.mapIdx !== 4) this.loadWorld(4, 50);
    const t = this.modeT;
    const bx = 13;
    const bz = 8;
    this.camX = 13;
    this.camZ = 14.6;
    const by = Math.max(9.3, 13.5 - Math.min(10, t) * 0.42);
    if (W3.ball) W3.ball.position.y = by;
    const cam = W3.camera;
    cam.position.set(13, 0.6, 14.6);
    cam.lookAt(bx, by - 2.5, bz);
    if (W3.sky) W3.sky.position.set(13, 28, 14.6);
  }

  drawUI(g) {
    this.drawScreen(g);
    if (this.achQ.length) SCR.drawAchPop(g, this.achQ[0]);
    if (this.notice) {
      this.buttons = [];
      SCR.drawNotice(g, this, this.notice);
    }
    if (this.options) {
      this.buttons = [];
      const keep = this.focus;
      this.focus = this.optFocus;
      SCR.drawOptions(g, this, this.t, settings);
      this.focus = keep;
    }
  }

  drawScreen(g) {
    g.clearRect(0, 0, W, H);
    this.buttons = [];
    const m = this.mode;
    const t = this.modeT;
    const ui = this;
    ui.game = this;
    if (m === 'power') return SCR.drawPower(g, this.t);
    if (m === 'crt') return SCR.drawCrtOn(g, t);
    if (m === 'bios') return SCR.drawBios(g, t);
    if (m === 'dialup') return SCR.drawDialup(g, t);
    if (m === 'title') return SCR.drawTitle(g, ui, this.t);
    if (m === 'howto') return SCR.drawHowto(g, ui, this.t);
    if (m === 'trophies') return SCR.drawTrophies(g, ui, this.t);
    if (m === 'shop') return SCR.drawShop(g, ui, this.t);
    if (m === 'select') return SCR.drawSelect(g, ui, this.t, this.S);
    if (m === 'ending') return SCR.drawEnding(g, ui, t, this.endStats);
    if (m === 'mp') return SCR.drawMp(g, ui, this.t);
    if (m === 'join') return SCR.drawJoin(g, ui, this.t);
    if (m === 'lobby') return SCR.drawLobby(g, ui, this.t, this.S);
    const sim = this.sim;
    if (!sim) return;
    if (m === 'dead') return SCR.drawBsod(g, ui, this.t, this.deadStats);
    sim.totalScore = this.runScore + (m === 'clear' ? 0 : sim.score);
    const heroIdx = HEROES.findIndex((h) => h.id === this.hero.id);
    if (m === 'play' || m === 'paused' || m === 'pick') {
      this.weapon.draw(g, sim, heroIdx, this.t);
      HUD.drawCrosshair(g, sim.hero.gun.kind, this.aimingAtZombie(sim), sim.hitT, sim.headT);
      HUD.drawPopups(g, this.projectPopups(sim));
    }
    HUD.drawHurt(g, sim, this.t);
    HUD.drawTopHud(g, sim, this.t);
    HUD.drawBossBar(g, sim, this.t);
    if (m === 'play') HUD.drawStragglers(g, this.projectStragglers(sim), this.t);
    if (m === 'play') HUD.drawJackpot(g, this.projectJackpot(sim), sim, this.t);
    if (m === 'play' || m === 'paused' || m === 'pick') {
      HUD.drawBuffFx(g, sim, this.S, this.t);
      HUD.drawBuffs(g, sim, this.S, this.t);
      HUD.drawXpBar(g, sim, this.t);
      HUD.drawSpecial(g, sim, this.t, this.input.touch.on);
      HUD.drawTeam(g, sim, this.S, this.t);
      HUD.drawNameTags(g, this.projectNames(sim));
    }
    if (m === 'play') HUD.drawSpCall(g, sim, this.t);
    if (m === 'play' || m === 'paused' || m === 'pick') HUD.drawDowned(g, sim, this.t);
    if (m === 'play') HUD.drawLevelUp(g, sim, this.t);
    if (m === 'play') HUD.drawCombo(g, sim, this.t, 2.2);
    if (m === 'play') HUD.drawBanner(g, sim, this.t);
    HUD.drawToast(g, sim, this.input.touch.on);
    HUD.drawTaskbar(g, sim, this.S, heroIdx, this.t);
    if (m === 'play') HUD.drawTouch(g, this.input, sim.hero);
    if (sim.glitchT > 0 && settings.glitch) HUD.drawGlitch(g, sim.glitchT);
    if (m === 'paused') SCR.drawPause(g, ui, this.t);
    if (m === 'clear') SCR.drawClear(g, ui, this.t, this.clearStats);
    if (m === 'pick') SCR.drawPick(g, ui, this.t, this.pickWave);
  }

  // World-space score popups to screen space.
  projectPopups(sim) {
    const cam = this.world.camera;
    const v = this._pv || (this._pv = new THREE.Vector3());
    const out = [];
    for (const p of sim.popups) {
      v.set(p.x, p.z, p.y).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      out.push({ sx: ((v.x + 1) / 2) * W, sy: ((1 - v.y) / 2) * H, text: p.text, t: p.t, big: p.big });
    }
    return out;
  }

  // Where the last few zombies of a wave are: on screen, or which way to turn.
  projectStragglers(sim) {
    const cam = this.world.camera;
    const v = this._pv || (this._pv = new THREE.Vector3());
    const P = sim.player;
    const out = [];
    for (const z of sim.stragglers()) {
      v.set(z.x, ZHEIGHT[z.kind] * (z.sc || 1) + 0.15, z.y).project(cam);
      if (v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9) out.push({ sx: ((v.x + 1) / 2) * W, sy: ((1 - v.y) / 2) * H });
      else out.push({ rel: Math.atan2(Math.sin(Math.atan2(z.y - P.y, z.x - P.x) - P.a), Math.cos(Math.atan2(z.y - P.y, z.x - P.x) - P.a)) });
    }
    return out;
  }

  // Where the Jackpot zombie is, on screen or which way to turn.
  projectJackpot(sim) {
    const z = sim.zombies.find((q) => q.gold);
    if (!z) return null;
    const v = this._pv || (this._pv = new THREE.Vector3());
    const P = sim.player;
    v.set(z.x, ZHEIGHT[z.kind] * (z.sc || 1) + 0.2, z.y).project(this.world.camera);
    if (v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9) return { z, sx: ((v.x + 1) / 2) * W, sy: ((1 - v.y) / 2) * H };
    const a = Math.atan2(z.y - P.y, z.x - P.x) - P.a;
    return { z, rel: Math.atan2(Math.sin(a), Math.cos(a)) };
  }

  // Teammates' names over their heads.
  projectNames(sim) {
    const cam = this.world.camera;
    const v = this._pv || (this._pv = new THREE.Vector3());
    const out = [];
    for (const Q of sim.players) {
      if (Q === sim.player) continue;
      v.set(Q.x, 1.25 + (Q.z || 0), Q.y).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      out.push({ sx: ((v.x + 1) / 2) * W, sy: ((1 - v.y) / 2) * H, text: Q.name, down: Q.down });
    }
    return out;
  }

  // What the crosshair is over: 'head', true for any other part, or false.
  aimingAtZombie(sim) {
    const P = sim.player;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);
    const eyeZ = EYE + P.z;
    const slope = Math.tan(P.pitch || 0);
    const wall = sim.wallDistance(P.x, P.y, P.a, 16);
    let best = null;
    let bestT = wall;
    for (const z of sim.zombies) {
      const rx = z.x - P.x;
      const ry = z.y - P.y;
      const t = rx * dx + ry * dy;
      if (t > 0 && t < bestT && Math.abs(rx * dy - ry * dx) < hitR(z) && sim.inHeight(z, eyeZ + t * slope)) {
        best = z;
        bestT = t;
      }
    }
    if (!best) return false;
    return sim.zoneAt(best, eyeZ + bestT * slope) === 'head' ? 'head' : true;
  }

  // A circle of line segments on the floor (shockwaves, eruption warnings).
  floorRing(x, y, r, color, z = 0.05) {
    const n = Math.max(12, Math.min(28, Math.round(r * 5)));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      const a1 = ((i + 1) / n) * TAU;
      this.world.line([x + Math.cos(a0) * r, z, y + Math.sin(a0) * r], [x + Math.cos(a1) * r, z, y + Math.sin(a1) * r], color);
    }
  }

  // Top rows of a zombie frame (its head) as a separate texture, for headshot pops.
  headOf(tex) {
    if (tex.userData.head) return tex.userData.head;
    const src = tex.image;
    const { top, bh } = spriteBounds(src);
    const hh = Math.max(3, Math.round(bh * 0.26));
    const g0 = src.getContext('2d').getImageData(0, top, src.width, hh).data;
    let minX = src.width;
    let maxX = 0;
    for (let y = 0; y < hh; y++) for (let x = 0; x < src.width; x++) if (g0[(y * src.width + x) * 4 + 3] > 0) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (maxX < minX) {
      minX = 0;
      maxX = src.width - 1;
    }
    const c = document.createElement('canvas');
    c.width = maxX - minX + 1;
    c.height = hh;
    c.getContext('2d').drawImage(src, minX, top, c.width, hh, 0, 0, c.width, hh);
    const t = pixelTex(c);
    tex.userData.head = { tex: t, aspect: c.width / hh, frac: hh / src.height };
    return tex.userData.head;
  }

  // The same frame with the head cleared away.
  headless(tex) {
    if (tex.userData.headless) return tex.userData.headless;
    const src = tex.image;
    const { top, bh } = spriteBounds(src);
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.clearRect(0, 0, c.width, top + Math.round(bh * 0.24));
    tex.userData.headless = pixelTex(c);
    return tex.userData.headless;
  }
}

// First opaque row of a sprite canvas and the height from there to the bottom.
function spriteBounds(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let top = 0;
  outer: for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 0) {
        top = y;
        break outer;
      }
    }
  }
  return { top, bh: c.height - top };
}

function pixelTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
