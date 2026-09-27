// Keyboard, mouse (with pointer lock) and touch, mapped onto the 384x216 screen grid.
import { W, H, clamp } from './util.js';

export class Input {
  constructor(canvas, handlers) {
    this.cv = canvas;
    this.h = handlers;
    this.keys = new Set();
    this.mouse = { x: W / 2, y: H / 2, down: false, dx: 0 };
    this.touch = { on: false, move: null, look: null, fire: null, jump: null, mo: null, vec: { x: 0, y: 0 }, lx: 0, knob: null };
    this.lookDX = 0;
    this.noLock = false;
    this.playing = false;
    this.spReady = false;
    this.bind();
  }

  toScreen(cx, cy) {
    const b = this.cv.getBoundingClientRect();
    return { x: ((cx - b.left) * W) / b.width, y: ((cy - b.top) * H) / b.height };
  }

  bind() {
    const cv = this.cv;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.h.key(e.code, e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.h.keyUp(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    cv.addEventListener('mousemove', (e) => {
      const p = this.toScreen(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      if (this.playing && (document.pointerLockElement === cv || this.mouse.down || this.noLock)) this.lookDX += e.movementX;
    });
    cv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      cv.focus();
      const p = this.toScreen(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      // Right button fires the special while playing.
      if (e.button === 2 && this.playing) return this.h.key('Special');
      this.mouse.down = true;
      this.h.press(p.x, p.y, 'mouse');
    });
    window.addEventListener('mouseup', () => (this.mouse.down = false));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockerror', () => (this.noLock = true));
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === cv;
      if (!locked && this.hadLock) this.h.lockLost();
      this.hadLock = locked;
    });

    const start = (e) => {
      e.preventDefault();
      this.touch.on = true;
      for (const t of e.changedTouches) {
        const p = this.toScreen(t.clientX, t.clientY);
        if (!this.playing) {
          this.h.press(p.x, p.y, 'touch');
          continue;
        }
        const btn = this.h.touchButton(p.x, p.y);
        if (btn === 'fire') this.touch.fire = t.identifier;
        else if (btn === 'jump') {
          this.touch.jump = t.identifier;
          this.h.key('Space');
        } else if (btn === 'boost') this.h.key('ShiftLeft');
        else if (btn === 'special') this.h.key('Special');
        else if (btn === 'pause') this.h.key('Escape');
        else if (p.x < W * 0.42 && this.touch.move == null) {
          this.touch.move = t.identifier;
          this.touch.mo = p;
          this.touch.knob = p;
          this.touch.vec = { x: 0, y: 0 };
        } else if (this.touch.look == null) {
          this.touch.look = t.identifier;
          this.touch.lx = p.x;
        }
      }
    };
    const move = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const p = this.toScreen(t.clientX, t.clientY);
        if (t.identifier === this.touch.move) {
          const dx = (p.x - this.touch.mo.x) / 24;
          const dy = (p.y - this.touch.mo.y) / 24;
          const m = Math.hypot(dx, dy);
          this.touch.vec = m > 1 ? { x: dx / m, y: dy / m } : { x: dx, y: dy };
          this.touch.knob = { x: this.touch.mo.x + this.touch.vec.x * 24, y: this.touch.mo.y + this.touch.vec.y * 24 };
        } else if (t.identifier === this.touch.look) {
          this.lookDX += (p.x - this.touch.lx) * 4.2;
          this.touch.lx = p.x;
        }
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.move) {
          this.touch.move = null;
          this.touch.vec = { x: 0, y: 0 };
          this.touch.knob = null;
        }
        if (t.identifier === this.touch.look) this.touch.look = null;
        if (t.identifier === this.touch.fire) this.touch.fire = null;
        if (t.identifier === this.touch.jump) {
          this.touch.jump = null;
          this.h.keyUp('Space');
        }
      }
    };
    cv.addEventListener('touchstart', start, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', end);
    cv.addEventListener('touchcancel', end);
  }

  lock() {
    if (this.touch.on || document.pointerLockElement === this.cv) return;
    try {
      const p = this.cv.requestPointerLock();
      if (p && p.catch) p.catch(() => (this.noLock = true));
    } catch (e) {
      this.noLock = true;
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Snapshot for the sim.
  state() {
    const k = this.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (this.touch.move != null) {
      f -= this.touch.vec.y;
      s += this.touch.vec.x;
    }
    const turn = (k.has('ArrowLeft') || k.has('KeyQ') ? -1 : 0) + (k.has('ArrowRight') || k.has('KeyE') ? 1 : 0);
    const fire = this.mouse.down || this.touch.fire != null || k.has('KeyF') || k.has('ControlLeft') || k.has('Enter');
    const look = this.lookDX;
    this.lookDX = 0;
    return { move: { f: clamp(f, -1, 1), s: clamp(s, -1, 1) }, turn, fire, look };
  }
}
