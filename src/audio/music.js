// A tiny chiptune player: two pulse channels, a triangle bass and a noise drum kit, sequenced
// in 16th-note steps with WebAudio lookahead scheduling. Songs are written as step strings:
// a note name starts a note, '-' holds it, '.' is a rest.
import { audio } from './sfx.js';

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function midi(tok) {
  const m = /^([A-G]#?)(\d)$/.exec(tok);
  if (!m) return null;
  return NOTE[m[1]] + (+m[2] + 1) * 12;
}
const hz = (n) => 440 * 2 ** ((n - 69) / 12);

function steps(str) {
  return str.trim().split(/\s+/);
}

// Melody written as [note, length-in-steps] pairs, expanded to step tokens.
function durs(list) {
  const out = [];
  for (const [n, len] of list) {
    out.push(n);
    for (let i = 1; i < len; i++) out.push(n === '.' ? '.' : '-');
  }
  return out;
}

function bars(...b) {
  return b.flatMap(steps);
}

// ---------------------------------------------------------------- songs
const TITLE = {
  bpm: 124,
  lead: bars(
    'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .',
    'D5 - - . C5 . B4 . A4 - - - . . . .',
    'A4 . C5 . F5 . A5 . G5 . F5 . C5 . F5 .',
    'E5 - - . D5 . C5 . D5 - - - . . . .',
    'E5 . G5 . C6 . G5 . E5 . G5 . C6 . D6 .',
    'E6 - - . D6 . C6 . B5 - - - . . . .',
    'D6 . B5 . G5 . B5 . D6 . G6 . F6 . D6 .',
    'E6 - - - D6 - C6 - B5 - - - G5 - - -',
  ),
  harm: bars(
    'E4 - - - - - - - E4 - - - - - - -', 'E4 - - - - - - - E4 - - - - - - -',
    'F4 - - - - - - - F4 - - - - - - -', 'F4 - - - - - - - F4 - - - - - - -',
    'G4 - - - - - - - G4 - - - - - - -', 'G4 - - - - - - - G4 - - - - - - -',
    'D4 - - - - - - - D4 - - - - - - -', 'D4 - - - - - - - B3 - - - - - - -',
  ),
  bass: bars(
    'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .', 'A2 . A3 . A2 . A3 . A2 . A3 . G2 . G3 .',
    'F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .', 'F2 . F3 . F2 . F3 . F2 . F3 . E2 . E3 .',
    'C3 . C4 . C3 . C4 . C3 . C4 . C3 . C4 .', 'C3 . C4 . C3 . C4 . C3 . C4 . B2 . B3 .',
    'G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 .', 'G2 . G3 . G2 . G3 . G2 . G3 . G2 . B2 .',
  ),
  drums: steps('K . h . S . h . K . h K S . h h'),
};

const ARP = (a, b, c) => `${a} ${b} ${c} ${b} ${a} ${b} ${c} ${b} ${a} ${b} ${c} ${b} ${a} ${b} ${c} ${b}`;
const PLAY = {
  bpm: 138,
  lead: bars(
    'E5 - . E5 G5 - . A5 B5 - A5 - G5 - E5 -', 'D5 - . D5 E5 - . G5 E5 - - - . . . .',
    'C5 - . C5 E5 - . G5 A5 - G5 - E5 - C5 -', 'D5 - . D5 F#5 - . A5 B5 - - - A5 - F#5 -',
    '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .',
    '. . . . . . . . . . . . . . . .', 'B4 - D#5 - F#5 - B5 - A5 - F#5 - D#5 - B4 -',
  ),
  harm: bars(ARP('E4', 'G4', 'B4'), ARP('E4', 'G4', 'B4'), ARP('C4', 'E4', 'G4'), ARP('D4', 'F#4', 'A4'), ARP('E4', 'G4', 'B4'), ARP('E4', 'G4', 'B4'), ARP('C4', 'E4', 'G4'), ARP('B3', 'D#4', 'F#4')),
  bass: bars(
    'E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 D3', 'E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2',
    'C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2', 'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2',
    'E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 D3', 'E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2',
    'C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2', 'B1 B1 B2 B1 B1 B1 B2 B1 B1 B1 B2 B1 B1 B1 B2 B1',
  ),
  drums: steps('K . h h S . h K . K h . S . h h'),
};

const BOSS = {
  bpm: 156,
  lead: bars(
    'D5 . D5 . F5 . D5 . G#5 - G5 - F5 - D5 -', 'D5 . D5 . F5 . D5 . C6 - A#5 - A5 - G#5 -',
    'D5 . D5 . F5 . D5 . G#5 - G5 - F5 - D5 -', 'A5 - - - G#5 - - - G5 - - - F#5 - - -',
  ),
  harm: bars('D4 F4 A4 D4 F4 A4 D4 F4 G#4 . G#4 . G4 . G4 .', 'D4 F4 A4 D4 F4 A4 D4 F4 A#4 . A#4 . A4 . A4 .', 'D4 F4 A4 D4 F4 A4 D4 F4 G#4 . G#4 . G4 . G4 .', 'A4 . . . G#4 . . . G4 . . . F#4 . . .'),
  bass: bars(
    'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 C#3 C#3 C3 C3', 'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 C#3 C#3 C3 C3',
    'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 C#3 C#3 C3 C3', 'A1 A1 A2 A1 G#1 G#1 G#2 G#1 G1 G1 G2 G1 F#1 F#1 F#2 F#1',
  ),
  drums: steps('K h S h K K S h K h S h K K S S'),
};

// Auld Lang Syne (traditional), for the stroke of midnight.
const MIDNIGHT = {
  bpm: 96,
  once: true,
  lead: durs([
    ['G4', 4], ['C5', 6], ['C5', 2], ['C5', 4], ['E5', 4], ['D5', 6], ['C5', 2], ['D5', 4], ['E5', 4],
    ['C5', 6], ['C5', 2], ['E5', 4], ['G5', 4], ['A5', 12], ['A5', 4], ['G5', 6], ['E5', 2], ['E5', 4], ['C5', 4],
    ['D5', 6], ['C5', 2], ['D5', 4], ['E5', 4], ['C5', 6], ['A4', 2], ['A4', 4], ['G4', 4], ['C5', 16], ['.', 8],
  ]),
  harm: durs([
    ['.', 4], ['E4', 16], ['F4', 8], ['G4', 8], ['E4', 16], ['F4', 16], ['E4', 16], ['F4', 8], ['G4', 8], ['E4', 8], ['F4', 8], ['E4', 16], ['.', 8],
  ]),
  bass: durs([
    ['.', 4], ['C3', 16], ['G2', 16], ['C3', 16], ['F2', 16], ['C3', 16], ['G2', 16], ['F2', 8], ['G2', 8], ['C3', 16], ['.', 8],
  ]),
  drums: steps('K . . . h . . . S . . . h . . .'),
};

// ---------------------------------------------------------------- story mode
// "Insert Disk 2": the patch theme. Its opening (E G A, G E D C) is the hook the story's songs
// keep coming back to. Plays on the story menu and under the cutscenes.
const ARP8 = (a, b, c) => `${a} . ${b} . ${c} . ${b} . ${a} . ${b} . ${c} . ${b} .`;
const PUMP = (r, o) => `${r} . ${o} . ${r} . ${o} . ${r} . ${o} . ${r} . ${o} .`;
const DRIVE = (r, o) => `${r} ${o} ${r} ${o} ${r} ${o} ${r} ${o} ${r} ${o} ${r} ${o} ${r} ${o} ${r} ${o}`;
const STAB = (a, b, c) => `. . ${a} . . . ${b} . . . ${a} . . . ${c} .`;

const STORY_THEME = {
  bpm: 104,
  lead: bars(
    'E5 - - . G5 . A5 - - . G5 . E5 - D5 -', 'C5 - - - - - . . D5 . E5 . G5 - - .',
    'E5 - - . G5 . A5 - - . C6 . B5 - A5 -', 'G5 - - - - - - - . . . . . . . .',
    'A5 - - . A5 . G5 - E5 - - . D5 . C5 -', 'D5 - - . E5 . G5 - - - - . E5 . D5 -',
    'C5 - - . E5 . G5 - C6 - - . B5 . G5 -', 'C6 - - - - - - - - - - - . . . .',
  ),
  harm: bars(ARP8('C4', 'E4', 'G4'), ARP8('A3', 'C4', 'E4'), ARP8('F3', 'A3', 'C4'), ARP8('G3', 'B3', 'D4'), ARP8('F3', 'A3', 'C4'), ARP8('G3', 'B3', 'D4'), ARP8('C4', 'E4', 'G4'), ARP8('C4', 'E4', 'G4')),
  bass: bars(
    'C2 . . . C3 . . . C2 . . . C3 . . .', 'A1 . . . A2 . . . A1 . . . A2 . . .',
    'F1 . . . F2 . . . F1 . . . F2 . . .', 'G1 . . . G2 . . . G1 . . . G2 . . .',
    'F1 . . . F2 . . . F1 . . . F2 . . .', 'G1 . . . G2 . . . G1 . . . G2 . . .',
    'C2 . . . C3 . . . C2 . . . C3 . . .', 'C2 . . . G1 . . . C2 . . . . . . .',
  ),
  drums: steps('K . . . h . . . S . . . h . . h'),
};

// Chapter 1, Times Square: eurodance. Explore and Pressure share the chords, bass line and
// length, so the music can switch between them on the beat without starting over.
const C1_CHORDS = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['E3', 'G#3', 'B3']];
const C1_ROOTS = [['A1', 'A2'], ['F1', 'F2'], ['C2', 'C3'], ['G1', 'G2'], ['A1', 'A2'], ['F1', 'F2'], ['C2', 'C3'], ['E1', 'E2']];
const C1_EXPLORE = {
  bpm: 132,
  group: 'c1',
  lead: bars(
    '. . . . E5 . . . A5 . . . G5 . E5 .', '. . . . F5 . . . A5 . . . C6 . A5 .',
    '. . . . E5 . . . G5 . . . C6 . G5 .', '. . . . D5 . . . G5 . . . B5 . G5 .',
    '. . . . E5 . . . A5 . . . G5 . E5 .', '. . . . F5 . . . A5 . . . C6 . A5 .',
    '. . . . G5 . . . E5 . . . C5 . E5 .', '. . . . G#5 . . . B5 . . . E5 - - .',
  ),
  harm: bars(...C1_CHORDS.map((c) => STAB(c[1], c[2], c[0]))),
  bass: bars(...C1_ROOTS.map(([r, o]) => PUMP(r, o))),
  drums: steps('K . h . K . h . K . h . K . h h'),
};
const C1_PRESSURE = {
  bpm: 132,
  group: 'c1',
  lead: bars(
    'A5 . A5 . C6 . A5 . E6 - - . D6 . C6 .', 'C6 . A5 . F5 - - . A5 . C6 . D6 - C6 -',
    'E5 . G5 . C6 . G5 . E6 - - . D6 . C6 .', 'B5 - - . G5 . B5 . D6 - - - - . . .',
    'A5 . A5 . C6 . A5 . E6 - - . G6 . E6 .', 'F6 - - . E6 . C6 . A5 - - . C6 . D6 .',
    'E6 - - . D6 . C6 . G5 - - . C6 . E6 .', 'G#5 - - . B5 . E6 - - - - - . . . .',
  ),
  harm: bars(...C1_CHORDS.map((c) => ARP(c[0], c[1], c[2]))),
  bass: bars(...C1_ROOTS.map(([r, o]) => DRIVE(r, o))),
  drums: steps('K . h S K . h . K . h S K h S h'),
};
// The Millennium Bug: its chat motif (D, C#, F#, Bb) turned into a riff.
const C1_BOSS = {
  bpm: 150,
  lead: bars(
    'D5 . C#5 . F#5 . A#4 - - . D5 . C#5 . F#5 .', 'G5 - F5 - D5 - C#5 - A#4 - - - A4 - - -',
    'D6 . C#6 . F#5 . A#5 - - . D6 . F6 . E6 .', 'D6 - - - C#6 - - - A#5 - - - A5 - - -',
  ),
  harm: bars('D4 F4 A4 D4 F4 A4 D4 F4 A#3 . A#3 . A3 . A3 .', 'D4 F4 A4 D4 F4 A4 D4 F4 G4 . G4 . C#4 . C#4 .', 'D4 F4 A4 D4 F4 A4 D4 F4 A#3 . A#3 . A3 . A3 .', 'D4 . . . C#4 . . . A#3 . . . A3 . . .'),
  bass: bars(
    'D2 D2 D3 D2 D2 D2 D3 D2 A#1 A#1 A#2 A#1 A1 A1 A2 A1', 'D2 D2 D3 D2 D2 D2 D3 D2 G1 G1 G2 G1 C#2 C#2 C#3 C#2',
    'D2 D2 D3 D2 D2 D2 D3 D2 A#1 A#1 A#2 A#1 A1 A1 A2 A1', 'D2 D2 D2 D2 C#2 C#2 C#2 C#2 A#1 A#1 A#1 A#1 A1 A1 A2 A1',
  ),
  drums: steps('K h S h K K S h K h S h K K S S'),
};

export const SONGS = { title: TITLE, play: PLAY, boss: BOSS, midnight: MIDNIGHT, storyTheme: STORY_THEME, c1Explore: C1_EXPLORE, c1Pressure: C1_PRESSURE, c1Boss: C1_BOSS };

// ---------------------------------------------------------------- player
let pulse = null;
function pulseWave(ctx) {
  if (pulse) return pulse;
  // 25% duty pulse, the classic NES/Game Boy lead tone.
  const N = 64;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  const d = 0.25;
  for (let n = 1; n < N; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * d);
    imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * d));
  }
  pulse = ctx.createPeriodicWave(real, imag);
  return pulse;
}

export class Music {
  constructor() {
    this.song = null;
    this.name = null;
    this.step = 0;
    this.next = 0;
    this.transpose = 0;
    this.tempo = 1;
  }

  // `segue`: switching between two songs of the same group (a chapter's explore and pressure
  // tracks) keeps the beat, so the new one comes in mid-phrase instead of starting over.
  play(name, { transpose = 0, tempo = 1, segue = false } = {}) {
    if (this.name === name && this.transpose === transpose && this.tempo === tempo) return;
    const song = SONGS[name];
    const keep = segue && this.song && song.group && song.group === this.song.group;
    this.name = name;
    this.song = song;
    this.transpose = transpose;
    this.tempo = tempo;
    if (keep) return;
    this.step = 0;
    this.next = 0;
  }

  stop() {
    this.song = null;
    this.name = null;
  }

  tick() {
    const A = audio();
    if (!A || !this.song) return;
    const { ctx } = A;
    const s = this.song;
    const dur = 60 / (s.bpm * this.tempo) / 4;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.15) {
      const len = s.lead.length;
      if (s.once && this.step >= len) {
        this.song = null;
        return;
      }
      this.schedule(A, this.step, this.next, dur);
      this.step++;
      this.next += dur;
    }
  }

  voice(A, chan, i, t, dur) {
    const tok = chan[i % chan.length];
    const n = midi(tok);
    if (n == null) return null;
    let k = 1;
    while (chan[(i + k) % chan.length] === '-' && k < 64) k++;
    return { f: hz(n + this.transpose), len: k * dur };
  }

  note(A, f, t, len, type, peak) {
    const { ctx, musicBus } = A;
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulseWave(ctx));
    else o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.setValueAtTime(peak, t + Math.max(0.01, len - 0.03));
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  drum(A, kind, t) {
    const { ctx, musicBus, noiseBuf } = A;
    if (kind === 'K') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(musicBus);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'h' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'h' ? 7000 : 1800;
    const g = ctx.createGain();
    const len = kind === 'h' ? 0.04 : 0.14;
    g.gain.setValueAtTime(kind === 'h' ? 0.25 : 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.01);
  }

  schedule(A, i, t, dur) {
    const s = this.song;
    const lead = this.voice(A, s.lead, i, t, dur);
    if (lead) this.note(A, lead.f, t, lead.len, 'pulse', 0.14);
    const harm = this.voice(A, s.harm, i, t, dur);
    if (harm) this.note(A, harm.f, t, harm.len, 'square', 0.045);
    const bass = this.voice(A, s.bass, i, t, dur);
    if (bass) this.note(A, bass.f, t, Math.min(bass.len, dur * 0.9), 'triangle', 0.35);
    const d = s.drums[i % s.drums.length];
    if (d && d !== '.') this.drum(A, d, t);
  }
}

export const music = new Music();
