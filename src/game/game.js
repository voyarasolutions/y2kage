// The whole program: boot sequence, menus, the run through 50 levels, and rendering each frame.
import * as THREE from 'three';
import { Pipeline } from '../gfx/pipeline.js';
import { buildTextures } from '../gfx/textures.js';
import { buildSprites } from '../gfx/sprites.js';
import { buildHorde } from '../gfx/horde.js';
import { settings, saveSettings, SENS_STEPS } from '../core/settings.js';
import { World } from '../world/world.js';
import { Sim, EYE, ZRAD, ZHEIGHT } from './sim.js';
import { Input } from '../core/input.js';
import { W, H, TAU, rand, clamp, store, pickOne } from '../core/util.js';
import { PAL, PARTY } from '../core/palette.js';
import { MAPS, parseMap } from '../data/maps.js';
import { HEROES, heroById } from '../data/heroes.js';
import { levelConfig, clockFor, TOTAL_LEVELS } from '../data/levels.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { WeaponView } from '../ui/weapon.js';
import { hit } from '../ui/win98.js';
import * as HUD from '../ui/hud.js';
import * as SCR from '../ui/screens.js';

const MENU_COUNT = { title: 4, paused: 4, clear: 2, dead: 2 };

export class Game {
  constructor(glCanvas, uiCanvas) {
    this.pipe = new Pipeline(glCanvas);
    this.T = buildTextures();
    this.S = buildSprites();
    this.S.horde = buildHorde();
    this.world = new World(this.T, this.S);
    this.maps = MAPS.map(parseMap);
    this.cv = uiCanvas;
    this.g = uiCanvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.weapon = new WeaponView();
    this.best = store.get('best', 1);
    this.bestScore = store.get('bestScore', 0);
    this.heroId = store.get('hero', 'tina');
    this.pickLevel = this.best;
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
            return k;
          }
        }
        return null;
      },
    });
    this.options = false;
    this.applySettings();
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
    this.applySettings();
    saveSettings();
    sfx.click();
  }

  optionsKey(code) {
    const n = 6;
    if (code === 'Escape' || code === 'KeyP') return this.closeOptions();
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.optFocus = (this.optFocus + 1) % n;
    if (code === 'ArrowUp' || code === 'KeyW') this.optFocus = (this.optFocus + n - 1) % n;
    if (this.optFocus < 5) {
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
    this.mode = m;
    this.modeT = 0;
    this.focus = 0;
    this.input.playing = m === 'play';
    this.cv.classList.toggle('play', m === 'play');
    if (m === 'title' || m === 'select' || m === 'howto') music.play('title');
    if (m === 'dialup') this.dialLen = sfx.dialup();
    if (m === 'dead') {
      music.stop();
      sfx.bsod();
    }
  }

  loadWorld(mapIdx, levelN) {
    this.mapIdx = mapIdx;
    this.map = this.maps[mapIdx];
    this.world.load(this.map, levelN);
  }

  addButton(b, on, idx) {
    this.buttons.push({ ...b, on, idx });
  }

  // ------------------------------------------------------------ flow
  toSelect() {
    this.input.unlock();
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.sim = null;
    this.pickLevel = clamp(this.pickLevel, 1, this.best);
    this.setMode('select');
  }

  pickHero(id) {
    this.heroId = id;
    sfx.click();
  }

  stepLevel(d) {
    this.pickLevel = clamp(this.pickLevel + d, 1, this.best);
    sfx.click();
  }

  startRun() {
    store.set('hero', this.heroId);
    this.hero = heroById(this.heroId);
    this.runScore = 0;
    sfx.select();
    this.startLevel(this.pickLevel);
  }

  startLevel(n) {
    this.levelN = n;
    const cfg = levelConfig(n);
    const mapIdx = Math.min(this.maps.length - 1, Math.floor((n - 1) / 10));
    this.loadWorld(mapIdx, n);
    this.sim = new Sim(this.map, cfg, this.hero, n);
    this.levelStartScore = this.runScore;
    this.setMode('play');
    const d = Math.floor((n - 1) / 10);
    music.play('play', { transpose: [0, 2, -2, 3, 5][d], tempo: 1 + d * 0.04 });
    this.input.lock();
  }

  levelClear() {
    const s = this.sim;
    this.runScore += s.score;
    const n = this.levelN;
    this.clearStats = { level: n, kills: s.lv.kills, time: s.lv.time, levelScore: s.score, score: this.runScore, combo: s.lv.bestCombo };
    if (n + 1 > this.best && n < TOTAL_LEVELS) {
      this.best = n + 1;
      store.set('best', this.best);
    }
    this.bestScore = Math.max(this.bestScore, this.runScore);
    store.set('bestScore', this.bestScore);
    this.pickLevel = Math.min(this.best, n + 1);
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
  }

  nextLevel() {
    this.startLevel(Math.min(TOTAL_LEVELS, this.levelN + 1));
  }

  retry() {
    this.runScore = this.levelStartScore;
    this.startLevel(this.levelN);
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
    if (m === 'play') {
      if (code === 'Space') this.sim.pressJump();
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.sim.pressBoost();
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
    if (m === 'select') {
      const i = HEROES.findIndex((h) => h.id === this.heroId);
      if (/^Digit[1-5]$/.test(code)) this.pickHero(HEROES[+code.slice(5) - 1].id);
      if (code === 'ArrowRight' || code === 'KeyD') this.pickHero(HEROES[(i + 1) % HEROES.length].id);
      if (code === 'ArrowLeft' || code === 'KeyA') this.pickHero(HEROES[(i + HEROES.length - 1) % HEROES.length].id);
      if (code === 'ArrowUp' || code === 'KeyW') this.stepLevel(1);
      if (code === 'ArrowDown' || code === 'KeyS') this.stepLevel(-1);
      if (code === 'Enter' || code === 'Space') this.startRun();
      if (code === 'Escape') this.setMode('title');
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
    this.sim = null;
    if (this.mapIdx !== 0) this.loadWorld(0, 1);
    this.setMode('title');
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
    const m = this.mode;
    if (m === 'crt' && this.modeT > 0.5) {
      sfx.postBeep();
      this.setMode('bios');
    }
    if (m === 'bios' && this.modeT > 3.9) this.setMode('dialup');
    if (m === 'dialup' && this.modeT > (this.dialLen || 5.2)) this.setMode('title');
    if (m === 'play') {
      const inp = this.input.state();
      this.sim.player.a += inp.look * 0.0026 * settings.sens;
      this.sim.update(dt, inp);
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
  }

  handleEvents() {
    for (const e of this.sim.events.splice(0)) {
      if (e.type === 'dead') {
        this.deadStats = { level: this.levelN, kills: this.sim.lv.kills, score: this.runScore + this.sim.score, hero: this.hero.name };
        this.bestScore = Math.max(this.bestScore, this.runScore + this.sim.score);
        store.set('bestScore', this.bestScore);
        this.input.unlock();
        this.setMode('dead');
      }
      if (e.type === 'clear') this.levelClear();
      if (e.type === 'bossDown') for (let i = 0; i < 5; i++) this.launchBurst();
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
    if (sim && (m === 'play' || m === 'paused' || m === 'dead' || m === 'clear')) {
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
    this.pipe.render(W3.scene, W3.camera, fx);
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
    W3.setCamera(P.x + sx, eye + sy, P.y, P.a, 0, roll);
    const cam = W3.camera;
    cam.updateMatrixWorld();
    // Zombies.
    const dIdx = Math.min(4, Math.floor((this.levelN - 1) / 10));
    const look = (z) => {
      const list = S.horde[z.kind]?.[dIdx];
      return list ? list[z.look % list.length] : S.zombies[z.kind];
    };
    for (const z of sim.zombies) {
      const Z = look(z);
      let tex;
      if (z.hurtT > 0 && Math.floor(this.t * 16) % 2 === 0) tex = Z.flash[0];
      else if (z.state === 'attack') tex = Z.atk[z.atkT > 0.18 ? 0 : 1];
      else if (z.state === 'windup') tex = Z.atk[1];
      else tex = Z.walk[Math.floor(z.anim) % 4];
      const h = ZHEIGHT[z.kind] * (Z.hmul || 1) * (z.sc || 1);
      const grow = z.spawnT > 0 ? 1 - z.spawnT / 0.6 : 1;
      W3.sprite(tex, z.x, 0, z.y, h * Z.aspect, h * grow);
      W3.decal(S.shadow, z.x, z.y, ZRAD[z.kind] * 2.6, 0, 0.45);
    }
    for (const c of sim.corpses) {
      const Z = look(c);
      const h = ZHEIGHT[c.kind] * (Z.hmul || 1) * (c.sc || 1);
      W3.sprite(Z.die[Math.min(2, Math.floor(c.t / 0.17))], c.x, 0, c.y, h * Z.aspect, h);
    }
    for (const s of sim.splats) W3.decal(s.big ? S.gooBig : S.goo, s.x, s.y, s.big ? 1.6 : 0.9, s.rot, Math.min(1, s.t / 2));
    for (const p of sim.pickups) {
      if (p.t < 3 && Math.floor(p.t * 8) % 2) continue;
      const tex = S.pickups[p.kind];
      const w = p.kind === 'health' ? 0.22 : 0.3;
      const hh = (w * tex.image.height) / tex.image.width;
      W3.sprite(tex, p.x, 0.1 + Math.sin(this.t * 3 + p.ph) * 0.05, p.y, w, hh);
      W3.decal(S.shadow, p.x, p.y, 0.4, 0, 0.3);
    }
    // Projectiles.
    const right = { x: -Math.sin(P.a), y: Math.cos(P.a) };
    for (const p of sim.projs) {
      if (p.kind === 'water') W3.sprite(S.water, p.x, p.z - 0.05, p.y, 0.1, 0.1);
      else if (p.kind === 'yoyo') {
        const set = p.hand ? S.yoyo2 : S.yoyo;
        W3.sprite(set[Math.floor(p.spin) % 4], p.x, p.z - 0.1, p.y, 0.22, 0.22);
        const side = p.hand ? 1 : -1;
        const hx = P.x + Math.cos(P.a) * 0.25 + right.x * 0.2 * side;
        const hy = P.y + Math.sin(P.a) * 0.25 + right.y * 0.2 * side;
        W3.line([hx, eye - 0.28, hy], [p.x, p.z, p.y], PAL.cream);
      } else if (p.kind === 'floppy') W3.sprite(S.floppy[Math.floor(p.spin) % 4], p.x, p.z - 0.12, p.y, 0.24, 0.24);
      else if (p.kind === 'rocket') W3.sprite(S.flare[Math.floor(this.t * 20) % 2], p.x, p.z - 0.14, p.y, 0.28, 0.28);
    }
    for (const q of sim.particles) W3.particle(q.x, q.z, q.y, q.color);
    W3.ambient(this.t, P.x, P.y);
    if (sim.laser) {
      const d = sim.laser.d;
      const fx2 = Math.cos(P.a);
      const fy2 = Math.sin(P.a);
      const mx = P.x + fx2 * 0.3 + right.x * 0.12;
      const my = P.y + fy2 * 0.3 + right.y * 0.12;
      const hx = P.x + fx2 * d;
      const hy = P.y + fy2 * d;
      W3.line([mx, eye - 0.17, my], [hx, eye - 0.08, hy], PAL.red);
      W3.line([mx, eye - 0.175, my], [hx, eye - 0.085, hy], '#ff9090');
      W3.sprite(S.flare[1], hx - fx2 * 0.05, eye - 0.2, hy - fy2 * 0.05, 0.14, 0.14, [1, 0.3, 0.3]);
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
    if (m === 'select') return SCR.drawSelect(g, ui, this.t, this.S);
    if (m === 'ending') return SCR.drawEnding(g, ui, t, this.endStats);
    const sim = this.sim;
    if (!sim) return;
    if (m === 'dead') return SCR.drawBsod(g, ui, this.t, this.deadStats);
    sim.totalScore = this.runScore + (m === 'clear' ? 0 : sim.score);
    const heroIdx = HEROES.findIndex((h) => h.id === this.hero.id);
    if (m === 'play' || m === 'paused') {
      this.weapon.draw(g, sim, heroIdx, this.t);
      HUD.drawCrosshair(g, sim.hero.gun.kind, this.aimingAtZombie(sim), sim.hitT);
      HUD.drawPopups(g, this.projectPopups(sim));
    }
    HUD.drawHurt(g, sim, this.t);
    HUD.drawTopHud(g, sim, this.t);
    HUD.drawBossBar(g, sim, this.t);
    if (m === 'play') HUD.drawCombo(g, sim, this.t, 2.2);
    if (m === 'play') HUD.drawBanner(g, sim, this.t);
    HUD.drawToast(g, sim, this.input.touch.on);
    HUD.drawTaskbar(g, sim, this.S, heroIdx, this.t);
    if (m === 'play') HUD.drawTouch(g, this.input, sim.hero);
    if (sim.glitchT > 0 && settings.glitch) HUD.drawGlitch(g, sim.glitchT);
    if (m === 'paused') SCR.drawPause(g, ui, this.t);
    if (m === 'clear') SCR.drawClear(g, ui, this.t, this.clearStats);
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

  aimingAtZombie(sim) {
    const P = sim.player;
    const dx = Math.cos(P.a);
    const dy = Math.sin(P.a);
    const wall = sim.wallDistance(P.x, P.y, P.a, 16);
    for (const z of sim.zombies) {
      const rx = z.x - P.x;
      const ry = z.y - P.y;
      const t = rx * dx + ry * dy;
      if (t > 0 && t < wall && Math.abs(rx * dy - ry * dx) < ZRAD[z.kind]) return true;
    }
    return false;
  }
}
