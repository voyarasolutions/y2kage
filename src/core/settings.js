// Player options, saved between sessions: look sensitivity, volumes, the CRT overlay and a
// switch for the screen-glitch effects (for anyone sensitive to flashing and tearing).
import { store } from './util.js';

const DEFAULTS = { sens: 1, music: 8, sfx: 10, scanlines: true, glitch: true, diff: 'normal' };

export const settings = { ...DEFAULTS, ...(store.get('settings') || {}) };

export function saveSettings() {
  store.set('settings', settings);
}

export const SENS_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
