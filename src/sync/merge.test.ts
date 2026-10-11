import { test } from "node:test";
import assert from "node:assert/strict";
import { TOMBSTONE_DAYS, mergeData, pruneTombstones, sameData, withTomb } from "./merge.ts";
import type { GymData, Meta, Routine, Workout } from "./types.ts";

const baseMeta = (over: Partial<Meta> = {}): Meta => ({
  gyms: [{ id: "main", name: "Main Gym" }, { id: "hoa", name: "HOA Gym" }],
  activeGym: "main", routines: [], customExercises: [], settings: { unit: "lb", increment: 5 }, ...over,
});
const wk = (id: string, date = "2026-03-01T10:00:00.000Z"): Workout => ({
  id, name: "Upper", date, gym: "main", exercises: [{ name: "Bench Press (Barbell)", sets: [{ weight: 135, reps: 8 }] }],
});
const data = (over: Partial<GymData> = {}): GymData => ({ workouts: [], meta: baseMeta(), activity: [], ...over });
const routine = (id: string, name: string, updated?: number): Routine => ({ id, name, gym: "main", exercises: [], updated });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

test("workouts union by id, newest first, nothing dropped", () => {
  const a = data({ workouts: [wk("a", "2026-01-01T00:00:00.000Z"), wk("c", "2026-03-01T00:00:00.000Z")] });
  const b = data({ workouts: [wk("b", "2026-02-01T00:00:00.000Z"), wk("c", "2026-03-01T00:00:00.000Z")] });
  const m = mergeData(a, b);
  assert.deepEqual(m.workouts.map((w) => w.id), ["c", "b", "a"]);
});

test("merge is commutative (apart from activeGym), idempotent and associative-safe", () => {
  const a = data({
    workouts: [wk("a")],
    meta: baseMeta({ routines: [routine("r1", "A", 5)], settingsAt: 3, customExercises: [{ name: "Zercher" }] }),
    activity: [{ id: "ah_1", date: "2026-02-01", type: "Running" }],
  });
  const b = data({
    workouts: [wk("b")],
    meta: baseMeta({ activeGym: "hoa", routines: [routine("r1", "B", 9), routine("r2", "C", 1)], settingsAt: 7, settings: { unit: "kg" } }),
  });
  assert.ok(sameData(mergeData(a, b), mergeData(b, a)));
  const m = mergeData(a, b);
  assert.ok(sameData(mergeData(m, b), m));
  assert.ok(sameData(mergeData(m, m), m));
  assert.equal(mergeData(a, b).meta.activeGym, "main"); // local side's
  assert.equal(mergeData(b, a).meta.activeGym, "hoa");
});

test("a deleted workout stays deleted, even from a stale copy", () => {
  const stale = data({ workouts: [wk("a"), wk("b")] });
  const fresh = data({ workouts: [wk("b")], meta: withTomb(baseMeta(), "workouts", "a", 1000) });
  const m = mergeData(stale, fresh);
  assert.deepEqual(ids(m.workouts), ["b"]);
  assert.deepEqual(ids(mergeData(fresh, stale).workouts), ["b"]);
});

test("routines: later edit wins; delete beats an older edit but not a newer one", () => {
  const a = data({ meta: baseMeta({ routines: [routine("r1", "old", 10)] }) });
  const b = data({ meta: baseMeta({ routines: [routine("r1", "renamed", 20)] }) });
  assert.equal(mergeData(a, b).meta.routines[0].name, "renamed");
  assert.equal(mergeData(b, a).meta.routines[0].name, "renamed");

  const deleted = data({ meta: withTomb(baseMeta(), "routines", "r1", 15) });
  assert.equal(mergeData(a, deleted).meta.routines.length, 0); // edit at 10 < delete at 15
  assert.equal(mergeData(b, deleted).meta.routines.length, 1); // edit at 20 > delete at 15
});

test("legacy routines with no `updated` merge deterministically", () => {
  const a = data({ meta: baseMeta({ routines: [routine("r1", "x")] }) });
  const b = data({ meta: baseMeta({ routines: [routine("r1", "y")] }) });
  assert.ok(sameData(mergeData(a, b), mergeData(b, a)));
});

test("settings: later settingsAt wins as a whole", () => {
  const a = data({ meta: baseMeta({ settings: { unit: "lb", increment: 5 }, settingsAt: 100 }) });
  const b = data({ meta: baseMeta({ settings: { unit: "kg", increment: 2.5 }, settingsAt: 200 }) });
  assert.deepEqual(mergeData(a, b).meta.settings, { unit: "kg", increment: 2.5 });
  assert.deepEqual(mergeData(b, a).meta.settings, { unit: "kg", increment: 2.5 });
});

test("a compact workout beats its full twin, both ways", () => {
  const full = wk("a");
  const compact = { ...wk("a"), compact: true };
  assert.equal(mergeData(data({ workouts: [full] }), data({ workouts: [compact] })).workouts[0].compact, true);
  assert.equal(mergeData(data({ workouts: [compact] }), data({ workouts: [full] })).workouts[0].compact, true);
});

test("tombstones expire after TOMBSTONE_DAYS", () => {
  const now = Date.UTC(2026, 9, 11);
  const d = data({ meta: { ...baseMeta(), tomb: { workouts: { old: now - (TOMBSTONE_DAYS + 1) * 86_400_000, fresh: now - 86_400_000 }, routines: {} } } });
  const p = pruneTombstones(d, now);
  assert.deepEqual(Object.keys(p.meta.tomb!.workouts), ["fresh"]);
  assert.equal(pruneTombstones(p, now), p); // nothing to prune -> same object
});

test("old data with no tomb/settingsAt fields merges fine", () => {
  const legacy = { workouts: [wk("a")], meta: { gyms: baseMeta().gyms, activeGym: "main", routines: [], customExercises: [], settings: {} } as Meta, activity: [] };
  const m = mergeData(legacy, data());
  assert.deepEqual(ids(m.workouts), ["a"]);
});
