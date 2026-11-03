// Personal records, derived on the fly from workout history (nothing is stored).
// Two kinds per exercise: "e1rm" (best estimated 1RM from any set) and
// "volume" (total weight lifted across all sets x reps in one workout).
// The first time an exercise is logged sets the baseline, not a PR.

export type PRKind = "e1rm" | "volume";
export interface PR { name: string; kind: PRKind; prior: number; current: number }
interface SetLike { weight: number; reps: number }
interface WorkoutLike { id: string; date: string; exercises: { name: string; sets: SetLike[] }[] }

const epley = (w: number, r: number) => (r > 0 && r <= 30 ? w * (1 + r / 30) : 0);

export function exerciseStats(sets: SetLike[]) {
  const valid = sets.filter((s) => s.reps > 0);
  return {
    e1rm: valid.reduce((m, s) => Math.max(m, epley(s.weight, s.reps)), 0),
    volume: valid.reduce((a, s) => a + s.weight * s.reps, 0),
  };
}

// PRs earned in `sets` for `name`, versus the prior workouts given.
export function prsFor(name: string, sets: SetLike[], prior: WorkoutLike[]): PR[] {
  let bestE = 0, bestV = 0, seen = false;
  for (const w of prior) {
    for (const e of w.exercises) {
      if (e.name !== name) continue;
      const st = exerciseStats(e.sets);
      if (st.volume <= 0 && st.e1rm <= 0) continue;
      seen = true;
      bestE = Math.max(bestE, st.e1rm);
      bestV = Math.max(bestV, st.volume);
    }
  }
  if (!seen) return [];
  const cur = exerciseStats(sets);
  const out: PR[] = [];
  if (cur.e1rm > bestE) out.push({ name, kind: "e1rm", prior: Math.round(bestE), current: Math.round(cur.e1rm) });
  if (cur.volume > bestV) out.push({ name, kind: "volume", prior: Math.round(bestV), current: Math.round(cur.volume) });
  return out;
}

// workout id -> PRs it set, walking history oldest to newest.
export function prsByWorkout(workouts: WorkoutLike[]): Map<string, PR[]> {
  const sorted = [...workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const result = new Map<string, PR[]>();
  sorted.forEach((w, i) => {
    const prior = sorted.slice(0, i);
    const list = w.exercises.flatMap((e) => prsFor(e.name, e.sets, prior));
    if (list.length) result.set(w.id, list);
  });
  return result;
}
