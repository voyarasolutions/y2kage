// Synthesised sound (WebAudio): chip-style effects, the dial-up handshake, the BIOS beep.
// No audio files. Audio unlocks on the first key, click or tap.
let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let muted = false;
let vol = { music: 0.8, sfx: 1 };
try {
  muted = localStorage.getItem('y2kage16.muted') === '1';
} catch (e) {}

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9 * vol.sfx;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.4 * vol.music;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

export function audio() {
  return ctx && ctx.state === 'running' ? { ctx, musicBus, noiseBuf } : null;
}

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function noise(dur, freq, q, peak, type = 'bandpass', delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.004, peak, dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.05);
}

function tone(freq, dur, type, peak, slideTo, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.006, peak, dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Two tones held together with a flat envelope (modem and phone sounds).
function hold(freqs, start, dur, peak, type = 'sine') {
  if (!ctx || muted) return;
  const t = ctx.currentTime + start;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.01);
  g.gain.setValueAtTime(peak, t + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, t + dur);
  g.connect(sfxBus);
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

export const sfx = {
  unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  },
  setVolumes(music, fx) {
    vol = { music, sfx: fx };
    if (sfxBus) sfxBus.gain.value = 0.9 * fx;
    if (musicBus) musicBus.gain.value = 0.4 * music;
  },
  levelUp() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.12, 'square', 0.12, null, i * 0.07));
    tone(1568, 0.4, 'triangle', 0.12, null, 0.35);
  },
  // Rising arpeggio, one step higher for every combo tier.
  combo(tier) {
    const root = 523 * Math.pow(2, tier / 6);
    [1, 1.26, 1.5, 2].forEach((m, i) => tone(root * m, 0.09, 'square', 0.1, null, i * 0.05));
  },
  get muted() {
    return muted;
  },
  toggleMute() {
    muted = !muted;
    try {
      localStorage.setItem('y2kage16.muted', muted ? '1' : '0');
    } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  shoot(weapon) {
    if (weapon === 'soaker') noise(0.09, 3800, 0.5, 0.1, 'highpass');
    else if (weapon === 'yoyo') {
      tone(500, 0.16, 'triangle', 0.12, 900);
      noise(0.1, 1500, 2, 0.08);
    } else if (weapon === 'floppy') {
      tone(1200, 0.04, 'square', 0.08);
      noise(0.12, 2400, 1.2, 0.14);
    } else if (weapon === 'rocket') {
      tone(400, 0.5, 'sawtooth', 0.07, 1800);
      noise(0.35, 2000, 0.5, 0.2);
    } else if (weapon === 'laser') tone(1400 + Math.random() * 300, 0.06, 'square', 0.03);
  },
  // The Soaker's pump: a plastic slide and a hiss of air on each stroke.
  pump(back) {
    noise(0.07, back ? 900 : 1300, 1.4, 0.09);
    if (back) noise(0.12, 5200, 0.6, 0.03, 'highpass', 0.04);
  },
  splash() {
    noise(0.08, 2600, 1, 0.07);
  },
  // Reloading: Dot's box snaps open, Gus drags rockets off his back rack.
  reload(weapon) {
    if (weapon === 'floppy') {
      noise(0.06, 1800, 2, 0.1);
      tone(700, 0.05, 'square', 0.05, null, 0.08);
    } else {
      noise(0.18, 700, 1, 0.12);
      tone(180, 0.1, 'square', 0.06, 120, 0.1);
    }
  },
  reloaded(weapon) {
    noise(0.05, weapon === 'floppy' ? 2600 : 1100, 2, 0.14);
    tone(weapon === 'floppy' ? 1500 : 520, 0.05, 'square', 0.06, null, 0.04);
  },
  meleeSwish(kind) {
    noise(0.14, kind === 'keyboard' ? 2400 : 1400, 0.8, 0.1, 'bandpass');
  },
  meleeHit(kind) {
    if (kind === 'bat') {
      tone(900, 0.12, 'triangle', 0.14, 500);
      noise(0.12, 600, 1, 0.35);
    } else if (kind === 'keyboard') {
      for (let i = 0; i < 4; i++) tone(2600 + Math.random() * 900, 0.02, 'square', 0.05, null, i * 0.025);
      noise(0.08, 900, 1.5, 0.25);
    } else if (kind === 'bottle') {
      tone(1300, 0.18, 'sine', 0.1, 1100);
      noise(0.1, 500, 1, 0.3);
    } else noise(0.08, 400, 1.2, 0.25);
  },
  meleeBreak(kind) {
    if (kind === 'keyboard') for (let i = 0; i < 10; i++) tone(2000 + Math.random() * 1600, 0.03, 'square', 0.04, null, i * 0.03);
    else if (kind === 'bat') {
      noise(0.25, 900, 0.8, 0.35);
      tone(300, 0.2, 'sawtooth', 0.06, 90);
    }
  },
  // The champagne cork going off, then the fizz.
  pop() {
    tone(900, 0.06, 'square', 0.15, 300);
    noise(0.9, 5200, 0.5, 0.12, 'highpass', 0.05);
  },
  explode() {
    noise(0.7, 400, 0.4, 0.7, 'lowpass');
    tone(90, 0.4, 'square', 0.2, 30);
    [1500, 1900, 2300].forEach((f, i) => tone(f, 0.05, 'square', 0.04, null, 0.12 + i * 0.07));
  },
  jump() {
    tone(300, 0.15, 'square', 0.08, 700);
  },
  land() {
    noise(0.1, 300, 1, 0.2, 'lowpass');
  },
  spring() {
    tone(200, 0.35, 'triangle', 0.18, 1200);
  },
  boing() {
    tone(260, 0.12, 'triangle', 0.05, 420);
  },
  stomp() {
    noise(0.5, 160, 0.4, 0.8, 'lowpass');
    tone(70, 0.4, 'square', 0.25, 35);
  },
  overheat() {
    [800, 600, 400].forEach((f, i) => tone(f, 0.12, 'square', 0.1, null, i * 0.1));
  },
  hit() {
    noise(0.06, 500, 1.5, 0.25);
  },
  tick() {
    tone(2200, 0.03, 'square', 0.05);
  },
  die() {
    tone(180, 0.35, 'sawtooth', 0.15, 50);
    noise(0.2, 300, 1, 0.25, 'lowpass');
  },
  groan() {
    tone(90 + Math.random() * 40, 0.7, 'sawtooth', 0.04, 60);
  },
  bossRoar() {
    tone(110, 0.9, 'sawtooth', 0.2, 55);
    tone(116, 0.9, 'square', 0.1, 58);
    noise(0.9, 250, 0.8, 0.3, 'lowpass');
  },
  hurt() {
    tone(220, 0.2, 'square', 0.2, 110);
  },
  // Low health: a lub-dub.
  heartbeat() {
    tone(70, 0.12, 'sine', 0.35, 50);
    tone(62, 0.14, 'sine', 0.28, 44, 0.16);
  },
  // Wave cleared: a rising fanfare; the last wave of a level gets a longer one with a cymbal.
  waveClear(last) {
    const notes = last ? [523, 659, 784, 1046, 1318, 1568] : [659, 784, 1046, 1318];
    notes.forEach((f, i) => tone(f, 0.14, 'square', 0.12, null, i * 0.08));
    tone(notes[notes.length - 1] * 1.5, last ? 0.7 : 0.4, 'triangle', 0.12, null, notes.length * 0.08);
    noise(last ? 1.2 : 0.6, 6000, 0.4, 0.08, 'highpass', notes.length * 0.08);
  },
  // Break countdown: 3, 2, 1 low beeps, then a high GO.
  countdown(n) {
    if (n > 0) tone(660, 0.1, 'square', 0.1);
    else tone(1320, 0.3, 'square', 0.12);
  },
  // A lethal headshot: a wet pop and a bright ding.
  headshot() {
    noise(0.12, 900, 1.2, 0.26, 'bandpass');
    tone(220, 0.1, 'square', 0.1, 90);
    tone(1760, 0.18, 'triangle', 0.14, null, 0.04);
    tone(2637, 0.22, 'triangle', 0.08, null, 0.08);
  },
  // A non-lethal hit to the head.
  headTick() {
    tone(2093, 0.05, 'triangle', 0.08);
  },
  // Meter full: a bright two-note chime.
  spReady() {
    tone(1318, 0.08, 'square', 0.1);
    tone(1760, 0.16, 'square', 0.1, null, 0.08);
  },
  // Special attack: a whoosh up into a chord, flavoured by the weapon.
  special(kind) {
    noise(0.5, 900, 0.4, 0.22, 'bandpass');
    tone(180, 0.45, 'sawtooth', 0.12, 720);
    const chord = { soaker: [392, 494, 587], yoyo: [440, 554, 659], floppy: [523, 659, 784], rocket: [349, 440, 523], laser: [587, 740, 880] }[kind] || [440, 554, 659];
    chord.forEach((f, i) => tone(f, 0.5, 'square', 0.09, null, 0.25 + i * 0.04));
    if (kind === 'soaker') noise(1.2, 2600, 0.4, 0.14, 'highpass', 0.1);
    if (kind === 'laser') tone(1200, 0.9, 'sawtooth', 0.05, 2400, 0.2);
  },
  pickup() {
    tone(660, 0.08, 'square', 0.14);
    tone(990, 0.12, 'square', 0.14, null, 0.08);
  },
  dash() {
    noise(0.15, 3000, 0.4, 0.18, 'highpass');
  },
  wave() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.12, null, i * 0.1));
  },
  clear() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.13, null, i * 0.09));
  },
  boom() {
    noise(0.9, 180, 0.5, 0.3, 'lowpass');
  },
  // Boss moves: a ground rumble before an eruption, a charging whine, a volley of packets.
  rumble() {
    noise(0.9, 90, 0.7, 0.35, 'lowpass');
    tone(55, 0.9, 'sawtooth', 0.12, 40);
  },
  charge() {
    tone(300, 0.5, 'square', 0.08, 1400);
  },
  zap() {
    tone(1600, 0.18, 'square', 0.1, 400);
    noise(0.12, 5000, 0.8, 0.08, 'highpass');
  },
  // Trophy earned: the classic three-note "tada".
  achievement() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.12, 'square', 0.12, null, i * 0.1));
    tone(2349, 0.4, 'triangle', 0.08, null, 0.4);
  },
  // A small electric crackle for Dial-Up Chain arcs.
  arc() {
    tone(2400, 0.06, 'square', 0.05, 900);
  },
  // Combo hits Overdrive: a rising synth stab.
  overdrive() {
    tone(220, 0.35, 'sawtooth', 0.1, 880);
    [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'square', 0.1, null, 0.1 + i * 0.06));
  },
  // The Jackpot zombie shows up: a slot-machine trill.
  jackpotSpot() {
    [1047, 1319, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.06, 'square', 0.08, null, i * 0.06));
  },
  // ...and goes down: coins everywhere.
  jackpot() {
    for (let i = 0; i < 10; i++) tone(1568 + (i % 3) * 400, 0.07, 'square', 0.07, null, i * 0.05);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, null, 0.5 + i * 0.08));
  },
  // Shuffling the upgrade cards.
  reroll() {
    [440, 660, 550, 880].forEach((f, i) => tone(f, 0.05, 'square', 0.09, null, i * 0.04));
  },
  // A legendary card turned up: a shimmering fanfare.
  legendary() {
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, null, 0.15 + i * 0.07));
    noise(0.6, 6000, 0.4, 0.06, 'highpass', 0.15);
  },
  // Picking an upgrade.
  upgrade() {
    [659, 880, 1109, 1319].forEach((f, i) => tone(f, 0.1, 'triangle', 0.14, null, i * 0.05));
  },
  glitch() {
    tone(1800 + Math.random() * 1200, 0.05, 'square', 0.05);
  },
  // Story mode chat: AIM's door-open chime, a pager's double chirp, and the Bug's detuned motif
  // (four notes that slide the wrong way, with static).
  imChime() {
    tone(1319, 0.08, 'triangle', 0.1);
    tone(1760, 0.14, 'triangle', 0.1, null, 0.08);
  },
  pager() {
    for (let i = 0; i < 2; i++) {
      tone(2637, 0.07, 'square', 0.06, null, i * 0.16);
      tone(3136, 0.07, 'square', 0.06, null, i * 0.16 + 0.07);
    }
  },
  bugChat() {
    [587, 554, 740, 466].forEach((f, i) => tone(f, 0.16, 'sawtooth', 0.07, f * (i % 2 ? 1.06 : 0.94), i * 0.15));
    noise(0.6, 2400, 1.5, 0.04, 'bandpass', 0.05);
  },
  // The bag-check alarm and the payphone ringing out.
  alarm() {
    for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.18, 'square', 0.09, null, i * 0.2);
  },
  ring() {
    hold([440, 480], 0, 1.2, 0.05);
  },
  click() {
    tone(1800, 0.02, 'square', 0.06);
  },
  select() {
    tone(880, 0.05, 'square', 0.08);
    tone(1320, 0.07, 'square', 0.08, null, 0.05);
  },
  key() {
    noise(0.03, 3000, 2, 0.05);
  },
  postBeep() {
    tone(1000, 0.18, 'square', 0.12);
  },
  // The Windows 98-ish "something went wrong" chord.
  bsod() {
    [196, 247, 294].forEach((f) => tone(f, 0.7, 'triangle', 0.14));
    tone(98, 0.8, 'square', 0.08);
  },
  // A compressed 56k handshake: dial tone, DTMF dialing, answer tone, then the screech.
  dialup() {
    if (!ctx || muted) return 5.2;
    hold([350, 440], 0, 0.7, 0.06);
    const digits = [[697, 1209], [770, 1336], [852, 1477], [941, 1336], [697, 1336], [770, 1209], [852, 1209]];
    digits.forEach((d, i) => hold(d, 0.8 + i * 0.12, 0.08, 0.07));
    hold([2100], 1.75, 0.9, 0.05);
    hold([1650, 1850], 2.7, 0.5, 0.035, 'square');
    for (let i = 0; i < 14; i++) hold([980 + Math.random() * 1400], 3.2 + i * 0.07, 0.06, 0.03, 'square');
    noise(1.2, 1800, 0.6, 0.08, 'bandpass', 3.4);
    hold([1200, 2400], 4.1, 0.6, 0.03, 'sawtooth');
    noise(0.6, 3000, 0.4, 0.06, 'highpass', 4.3);
    return 5.2;
  },
};
