// A letter grade for every cleared level, from how much you got hurt, how fast you cleared it and how
// long you kept a combo going. Best grades are saved per level; the first A and S on a level pay tokens.
import { store } from '../core/util.js';

export const GRADES = ['C', 'B', 'A', 'S'];
export const GRADE_COL = { S: '#f6c945', A: '#7ac943', B: '#4ab8ff', C: '#a0a0b0' };

// st: { hurt, maxHp, kills, time, combo }. Returns the letter and the three parts (0-40, 0-30, 0-30).
export function gradeFor(st) {
  const hf = (st.hurt || 0) / Math.max(1, st.maxHp || 100);
  const safe = hf <= 0 ? 40 : hf < 0.25 ? 30 : hf < 0.5 ? 20 : hf < 1 ? 10 : 0;
  const kpm = (st.kills || 0) / Math.max(0.5, (st.time || 60) / 60);
  const speed = kpm >= 50 ? 30 : kpm >= 38 ? 20 : kpm >= 26 ? 10 : 0;
  const cr = (st.combo || 0) / Math.max(1, st.kills || 1);
  const combo = cr >= 0.35 ? 30 : cr >= 0.22 ? 20 : cr >= 0.12 ? 10 : 0;
  const pts = safe + speed + combo;
  const letter = pts >= 85 ? 'S' : pts >= 65 ? 'A' : pts >= 40 ? 'B' : 'C';
  return { letter, pts, safe, speed, combo };
}

export const grades = () => store.get('grades', {}) || {};
export const gradeOf = (n) => grades()[n] || null;

// Save a grade if it beats the old one. Returns tokens owed for a first A (+15) or first S (+30 more).
export function recordGrade(n, letter) {
  const all = grades();
  const old = all[n];
  const rank = (l) => (l ? GRADES.indexOf(l) : -1);
  if (rank(letter) <= rank(old)) return 0;
  all[n] = letter;
  store.set('grades', all);
  let pay = 0;
  if (rank(letter) >= 2 && rank(old) < 2) pay += 15;
  if (letter === 'S') pay += 30;
  return pay;
}

// Every level of district d (0-4) graded S.
export const districtAllS = (d) => {
  const all = grades();
  for (let n = d * 10 + 1; n <= d * 10 + 10; n++) if (all[n] !== 'S') return false;
  return true;
};
