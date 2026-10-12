import type { Activity, GymData, Meta, Routine, Workout } from "./types.ts";

/* Pure, deterministic merge of two copies of the gym data (phone vs Dropbox, or two phones).
   Rules, per the sync design:
   - workouts: union by id. They are never edited, only added or deleted, so there are no field conflicts.
   - routines: union by id, later `updated` wins. A delete is a tombstone that beats any edit older than it.
   - settings: one object, later `settingsAt` wins as a whole.
   - customExercises by name, gyms by id, activity by id: plain unions.
   - activeGym is a per-device preference: always the local side's.
   - A compact (rolled-up) workout beats its full twin. Compacting is a deliberate, one-way size decision.
   Merge never drops data except what a tombstone says was deleted. */

/** Must exceed the longest time a device can stay offline, or a deleted item reappears from it. */
export const TOMBSTONE_DAYS = 180;
const DAY = 86_400_000;

/** JSON with sorted keys, so two equal objects built in different key order compare equal. */
const canon = (x: unknown): string =>
  JSON.stringify(x, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
/** Deterministic tie-break so merge(a, b) and merge(b, a) agree. */
const pick = <T>(a: T, b: T): T => (canon(a) <= canon(b) ? a : b);

const emptyTomb = () => ({ workouts: {} as Record<string, number>, routines: {} as Record<string, number> });

function mergeTomb(a: Meta["tomb"], b: Meta["tomb"]): NonNullable<Meta["tomb"]> {
  const out = emptyTomb();
  for (const src of [a, b]) {
    for (const kind of ["workouts", "routines"] as const) {
      for (const [id, t] of Object.entries(src?.[kind] ?? {})) {
        if (!(out[kind][id] >= t)) out[kind][id] = t;
      }
    }
  }
  return out;
}

function mergeWorkout(a: Workout, b: Workout): Workout {
  if (!!a.compact !== !!b.compact) return a.compact ? a : b;
  return pick(a, b);
}

const byDateDesc = (x: { date: string; id: string }, y: { date: string; id: string }) =>
  x.date < y.date ? 1 : x.date > y.date ? -1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0;

export function mergeData(local: GymData, remote: GymData): GymData {
  const tomb = mergeTomb(local.meta.tomb, remote.meta.tomb);

  const w = new Map<string, Workout>();
  for (const x of [...local.workouts, ...remote.workouts]) {
    if (tomb.workouts[x.id]) continue;
    const have = w.get(x.id);
    w.set(x.id, have ? mergeWorkout(have, x) : x);
  }

  const r = new Map<string, Routine>();
  for (const x of [...local.meta.routines, ...remote.meta.routines]) {
    const have = r.get(x.id);
    if (!have) r.set(x.id, x);
    else {
      const ua = have.updated ?? 0;
      const ub = x.updated ?? 0;
      r.set(x.id, ua > ub ? have : ub > ua ? x : pick(have, x));
    }
  }
  for (const [id, x] of r) {
    const t = tomb.routines[id];
    if (t !== undefined && t >= (x.updated ?? 0)) r.delete(id);
  }

  const gyms = new Map<string, Meta["gyms"][number]>();
  for (const g of [...local.meta.gyms, ...remote.meta.gyms]) if (!gyms.has(g.id)) gyms.set(g.id, g);
  const custom = new Map<string, Meta["customExercises"][number]>();
  for (const c of [...local.meta.customExercises, ...remote.meta.customExercises]) if (!custom.has(c.name)) custom.set(c.name, c);

  const la = local.meta.settingsAt ?? 0;
  const ra = remote.meta.settingsAt ?? 0;
  const settings =
    la > ra ? local.meta.settings : ra > la ? remote.meta.settings : pick(local.meta.settings, remote.meta.settings);

  const act = new Map<string, Activity>();
  for (const x of [...local.activity, ...remote.activity]) {
    const have = act.get(x.id);
    act.set(x.id, have ? pick(have, x) : x);
  }

  const meta: Meta = {
    ...remote.meta,
    ...local.meta,
    gyms: [...gyms.values()],
    activeGym: local.meta.activeGym,
    routines: [...r.values()],
    customExercises: [...custom.values()],
    settings,
    settingsAt: Math.max(la, ra),
    tomb,
  };
  return { workouts: [...w.values()].sort(byDateDesc), meta, activity: [...act.values()].sort(byDateDesc) };
}

/** Order-insensitive fingerprint, ignoring per-device fields, for "did anything change?" */
function normal(d: GymData): string {
  const { activeGym: _ignored, ...meta } = d.meta;
  void _ignored;
  const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return canon({
    workouts: byId(d.workouts),
    activity: byId(d.activity),
    meta: {
      ...meta,
      routines: byId(meta.routines),
      gyms: byId(meta.gyms),
      customExercises: [...meta.customExercises].sort((a, b) => (a.name < b.name ? -1 : 1)),
      tomb: meta.tomb ?? emptyTomb(),
      settingsAt: meta.settingsAt ?? 0,
    },
  });
}
export const sameData = (a: GymData, b: GymData) => a === b || normal(a) === normal(b);

/** Drop tombstones older than TOMBSTONE_DAYS. Run before writing to Dropbox, never inside merge. */
export function pruneTombstones(d: GymData, nowMs: number): GymData {
  const t = d.meta.tomb;
  if (!t) return d;
  const cutoff = nowMs - TOMBSTONE_DAYS * DAY;
  const keep = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([, ts]) => ts >= cutoff));
  const next = { workouts: keep(t.workouts), routines: keep(t.routines) };
  const same =
    Object.keys(next.workouts).length === Object.keys(t.workouts).length &&
    Object.keys(next.routines).length === Object.keys(t.routines).length;
  return same ? d : { ...d, meta: { ...d.meta, tomb: next } };
}

/** Record a delete. Call this next to the code that removes the item. */
export function withTomb(meta: Meta, kind: "workouts" | "routines", id: string, nowMs: number): Meta {
  const t = meta.tomb ?? emptyTomb();
  return { ...meta, tomb: { ...t, [kind]: { ...t[kind], [id]: nowMs } } };
}
