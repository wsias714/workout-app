import type { Activity, GymData, Workout } from "./types.ts";

/* Size budget and cleanup. Dropbox space is limited and a fat JSON slows every phone sync, so
   the hot file (data.json) is kept under DATA_BUDGET. Past that, old workouts are rolled up to
   each exercise's best set (same shape, so charts, PRs and progression keep working) and the
   full originals move to archive/<year>.json, which is only read on export. */

export const DATA_BUDGET = 1_000_000; // bytes, active file
export const FOLDER_BUDGET = 25_000_000; // bytes, whole app folder
export const WARN_AT = 0.7;
export const KEEP_WINDOWS = [24, 12, 6, 3]; // months of full detail to keep, tried in order
const DAY = 86_400_000;

export const sizeOf = (x: unknown) => new TextEncoder().encode(typeof x === "string" ? x : JSON.stringify(x)).length;

// Epley, same as src/lib/helpers.js (ignores impossible rep counts).
const epley = (w: number, r: number) => (r > 0 && r <= 30 ? w * (1 + r / 30) : 0);

export function compactWorkout(w: Workout): Workout {
  if (w.compact) return w;
  return {
    ...w,
    compact: true,
    exercises: w.exercises.map((e) => {
      let best = e.sets[0];
      let bestE = -1;
      for (const s of e.sets) {
        const v = epley(s.weight, s.reps);
        if (v > bestE) {
          bestE = v;
          best = s;
        }
      }
      return { name: e.name, n: e.sets.length, sets: best ? [{ weight: best.weight, reps: best.reps }] : [] };
    }),
  };
}

export interface Compaction {
  data: GymData;
  /** Full originals by year, to be merged into archive/<year>.json. Empty when nothing moved. */
  archived: Record<string, Workout[]>;
}

/** Roll old workouts (and, if still over budget, old activity) up. No-op while under budget.
    The keep window shrinks (24, 12, 6, 3 months) until the file fits, so a very dense history
    still lands under budget. Whatever moves is returned in full so it can be archived first. */
export function compactIfOver(d: GymData, nowMs: number, budget = DATA_BUDGET, windows: number[] = KEEP_WINDOWS): Compaction {
  if (sizeOf(d) <= budget) return { data: d, archived: {} };

  const moved = new Map<string, Workout>();
  let cur = d;
  for (const months of windows) {
    const cutoff = new Date(nowMs - months * 30.4 * DAY).toISOString();
    let changed = false;
    const workouts = cur.workouts.map((w) => {
      if (w.compact || w.date >= cutoff) return w;
      moved.set(w.id, w);
      changed = true;
      return compactWorkout(w);
    });
    if (changed) cur = { ...cur, workouts };
    if (sizeOf(cur) <= budget) break;
  }
  if (sizeOf(cur) > budget) cur = { ...cur, activity: rollActivity(cur.activity, nowMs) };

  const archived: Record<string, Workout[]> = {};
  for (const w of moved.values()) (archived[w.date.slice(0, 4)] ??= []).push(w);
  return { data: cur, archived };
}

/** Sessions older than 12 months collapse to one entry per month and type. */
export function rollActivity(acts: Activity[], nowMs: number): Activity[] {
  const cutoff = new Date(nowMs - 365 * DAY).toISOString();
  const keep: Activity[] = [];
  const months = new Map<string, Activity>();
  for (const a of acts) {
    if (a.date >= cutoff || a.id.startsWith("am_")) {
      keep.push(a);
      continue;
    }
    const key = `am_${a.date.slice(0, 7)}_${a.type}`;
    const m = months.get(key);
    months.set(key, {
      id: key,
      date: `${a.date.slice(0, 7)}-01T00:00:00.000Z`,
      type: a.type,
      count: (m?.count ?? 0) + (a.count ?? 1),
      duration: (m?.duration ?? 0) + (a.duration ?? 0),
      calories: (m?.calories ?? 0) + (a.calories ?? 0),
    });
  }
  // Fold in monthly entries that already exist (from an earlier roll-up).
  for (const a of keep.filter((x) => x.id.startsWith("am_"))) {
    const m = months.get(a.id);
    if (m) months.set(a.id, { ...m, count: (m.count ?? 0) + (a.count ?? 0), duration: (m.duration ?? 0) + (a.duration ?? 0), calories: (m.calories ?? 0) + (a.calories ?? 0) });
  }
  const kept = keep.filter((x) => !months.has(x.id));
  return [...kept, ...months.values()].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}

/** Union full workouts into an archive file's contents. Deterministic, never drops. */
export function mergeArchive(existing: Workout[], incoming: Workout[]): Workout[] {
  const m = new Map<string, Workout>();
  for (const w of [...existing, ...incoming]) if (!m.has(w.id)) m.set(w.id, w);
  return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));
}

/* ---- backups ---- */

const AUTO = /\/auto-(\d{4})-(\d{2})-(\d{2})\.json$/;

/** Weekly auto backups: keep the newest 3, plus the newest of each of the last 6 months.
    Pre-migration copies are never touched. Returns the paths to delete. */
export function backupsToDelete(paths: string[], nowMs: number): string[] {
  const autos = paths
    .map((p) => ({ p, m: p.match(AUTO) }))
    .filter((x) => x.m)
    .map((x) => ({ p: x.p, day: `${x.m![1]}-${x.m![2]}-${x.m![3]}`, month: `${x.m![1]}-${x.m![2]}` }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
  const keep = new Set(autos.slice(0, 3).map((a) => a.p));
  const now = new Date(nowMs);
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const first = autos.find((a) => a.month === month);
    if (first) keep.add(first.p);
  }
  return autos.filter((a) => !keep.has(a.p)).map((a) => a.p);
}

/** True when the newest auto backup is older than `days` (or none exists). */
export function autoBackupDue(paths: string[], nowMs: number, days = 7): boolean {
  const newest = paths
    .map((p) => p.match(AUTO))
    .filter(Boolean)
    .map((m) => Date.UTC(+m![1], +m![2] - 1, +m![3]))
    .sort((a, b) => b - a)[0];
  return newest === undefined || nowMs - newest >= days * DAY;
}

export const autoBackupPath = (nowMs: number) => `/backups/auto-${new Date(nowMs).toISOString().slice(0, 10)}.json`;
