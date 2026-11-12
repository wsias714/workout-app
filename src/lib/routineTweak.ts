/* Apply one coach tweak to a routine. Pure. Edits the stored weight (and optionally reps) of one exercise and
   stamps `updated`, so sync merge treats it as a normal routine edit (docs/sync.md). Returns the same array when
   the routine or exercise is gone. The phone shows from -> to and the lifter taps Apply. */

export interface TweakLike { routine: string; exercise: string; weight: number; reps?: number }
interface RoutineLike { id: string; exercises: unknown[]; updated?: number; [k: string]: unknown }

export function applyTweak<R extends RoutineLike>(routines: R[], t: TweakLike, now: number): R[] {
  const r = routines.find((x) => x.id === t.routine);
  if (!r) return routines;
  const hit = r.exercises.findIndex((e) => !!e && typeof e === "object" && (e as { name?: unknown }).name === t.exercise);
  if (hit < 0) return routines;
  const exercises = r.exercises.map((e, i) => (i === hit ? { ...(e as object), weight: t.weight, ...(t.reps ? { reps: t.reps } : {}) } : e));
  return routines.map((x) => (x.id === r.id ? { ...x, exercises, updated: now } : x));
}

/** The stored weight of the exercise, or null when the routine/exercise isn't there. */
export function storedWeight(routines: RoutineLike[], t: TweakLike): number | null {
  const r = routines.find((x) => x.id === t.routine);
  const e = r?.exercises.find((x) => !!x && typeof x === "object" && (x as { name?: unknown }).name === t.exercise) as { weight?: unknown } | undefined;
  return e ? Number(e.weight) || 0 : null;
}
