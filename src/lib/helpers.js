/* ------------------------------- helpers --------------------------------- */
export const uid = () => Math.random().toString(36).slice(2, 10);
export const num = (v) => {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
};
// estimated 1RM (Epley). Ignore impossible/typo rep counts (>30) so one bad
// entry can't create a fake PR; Epley is also meaningless past ~30 reps.
export const epley = (w, r) => (r > 0 && r <= 30 ? w * (1 + r / 30) : 0);
export const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
export const fmtShort = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
export const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

/* ----------------------- progression / analytics ------------------------- */
export function setsForExercise(workouts, name) {
  // returns sessions: [{date, sets:[{weight,reps}], best e1RM}]
  const sessions = [];
  for (const w of workouts) {
    const ex = w.exercises.find((e) => e.name === name);
    if (!ex) continue;
    const sets = ex.sets.filter((s) => s.reps > 0);
    if (!sets.length) continue;
    let best = 0,
      bestSet = null;
    for (const s of sets) {
      const e = epley(s.weight, s.reps);
      if (e > best) {
        best = e;
        bestSet = s;
      }
    }
    sessions.push({ date: w.date, sets, e1rm: best, bestSet });
  }
  sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
  return sessions;
}

// Percentile of the most recent e1RM within the exercise's own historical
// range (personal, not population-based). 100 = current session is an
// all-time PR for this lift; 0 = at the historical low.
export function personalPercentile(sessions) {
  if (!sessions.length) return null;
  const vals = sessions.map((s) => s.e1rm).filter((v) => v > 0);
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const current = sessions[sessions.length - 1].e1rm;
  if (max === min) return 100;
  return Math.round(((current - min) / (max - min)) * 100);
}
