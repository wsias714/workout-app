import { test } from "node:test";
import assert from "node:assert/strict";
import { autoBackupDue, backupsToDelete, compactIfOver, compactWorkout, mergeArchive, rollActivity, sizeOf } from "./archive.ts";
import type { Activity, GymData, Workout } from "./types.ts";

const NOW = Date.UTC(2026, 9, 11);
const wk = (id: string, date: string): Workout => ({
  id, name: "Upper", date, gym: "main",
  exercises: [{ name: "Bench Press (Barbell)", sets: [{ weight: 135, reps: 10 }, { weight: 185, reps: 5 }, { weight: 95, reps: 12 }] }],
});
const data = (workouts: Workout[], activity: Activity[] = []): GymData => ({
  workouts, activity, meta: { gyms: [], activeGym: "main", routines: [], customExercises: [], settings: {} },
});

test("compactWorkout keeps the best-e1RM set and the set count", () => {
  const c = compactWorkout(wk("a", "2020-01-01T00:00:00.000Z"));
  assert.equal(c.compact, true);
  assert.deepEqual(c.exercises[0].sets, [{ weight: 185, reps: 5 }]); // 185x5 ≈ 216 beats 135x10 ≈ 180
  assert.equal(c.exercises[0].n, 3);
  assert.equal(compactWorkout(c), c);
});

test("under budget: nothing moves", () => {
  const d = data([wk("a", "2020-01-01T00:00:00.000Z")]);
  const r = compactIfOver(d, NOW);
  assert.equal(r.data, d);
  assert.deepEqual(r.archived, {});
});

test("over budget: only workouts older than the keep window are rolled up and archived by year", () => {
  const d = data([wk("new", "2026-06-01T00:00:00.000Z"), wk("old1", "2022-03-01T00:00:00.000Z"), wk("old2", "2023-05-01T00:00:00.000Z")]);
  const r = compactIfOver(d, NOW, 100, [24]);
  assert.equal(r.data.workouts.find((w) => w.id === "new")!.compact, undefined);
  assert.equal(r.data.workouts.find((w) => w.id === "old1")!.compact, true);
  assert.deepEqual(Object.keys(r.archived).sort(), ["2022", "2023"]);
  assert.equal(r.archived["2022"][0].exercises[0].sets.length, 3); // full originals archived
  assert.ok(sizeOf(r.data) < sizeOf(d));
  // running it again changes nothing and archives nothing
  const again = compactIfOver(r.data, NOW, 100, [24]);
  assert.deepEqual(again.archived, {});
});

test("a dense history keeps shrinking the full-detail window until it fits", () => {
  const realistic = (id: string, date: string): Workout => ({
    ...wk(id, date),
    exercises: ["Bench", "Squat", "Row", "Curl", "Press"].map((name) => ({ name, sets: [1, 2, 3, 4].map((k) => ({ weight: 100 + k * 5, reps: 8 })) })),
  });
  const many = Array.from({ length: 400 }, (_, i) => realistic("w" + i, new Date(NOW - i * 86_400_000).toISOString()));
  const d = data(many);
  const target = Math.floor(sizeOf(d) * 0.75);
  const r = compactIfOver(d, NOW, target);
  assert.ok(sizeOf(r.data) <= target);
  const full = r.data.workouts.filter((w) => !w.compact).length;
  assert.ok(full > 0 && full < 400, `kept some full-detail recent workouts (${full})`);
  assert.equal(Object.values(r.archived).flat().length, 400 - full);
});

test("roll-up preserves what charts use: the best e1RM per exercise-session", () => {
  const e1 = (w: Workout) => Math.max(...w.exercises[0].sets.map((s) => s.weight * (1 + s.reps / 30)));
  const full = wk("a", "2021-01-01T00:00:00.000Z");
  assert.equal(e1(compactWorkout(full)), e1(full));
});

test("activity older than 12 months rolls up per month and type, recent stays", () => {
  const acts: Activity[] = [
    { id: "1", date: "2024-03-02T00:00:00.000Z", type: "Running", duration: 30, calories: 300 },
    { id: "2", date: "2024-03-20T00:00:00.000Z", type: "Running", duration: 40, calories: 400 },
    { id: "3", date: "2026-09-01T00:00:00.000Z", type: "Running", duration: 20, calories: 200 },
  ];
  const r = rollActivity(acts, NOW);
  assert.equal(r.length, 2);
  const m = r.find((a) => a.id === "am_2024-03_Running")!;
  assert.deepEqual([m.count, m.duration, m.calories], [2, 70, 700]);
  assert.deepEqual(rollActivity(r, NOW).length, 2); // idempotent
});

test("archive merge is a union by id", () => {
  const m = mergeArchive([wk("a", "2022-01-01T00:00:00.000Z")], [wk("a", "2022-01-01T00:00:00.000Z"), wk("b", "2022-02-01T00:00:00.000Z")]);
  assert.deepEqual(m.map((w) => w.id), ["b", "a"]);
});

test("backup rotation keeps newest 3 plus newest per recent month, spares premigration", () => {
  const paths = [
    "/backups/premigration-2026-01-01T00-00-00-000Z.json",
    ...["2026-10-10", "2026-10-03", "2026-09-26", "2026-09-19", "2026-09-12", "2026-08-29", "2026-08-22", "2025-01-05"].map((d) => `/backups/auto-${d}.json`),
  ];
  const del = backupsToDelete(paths, NOW);
  assert.ok(!del.some((p) => p.includes("premigration")));
  assert.ok(!del.includes("/backups/auto-2026-10-10.json"));
  assert.ok(!del.includes("/backups/auto-2026-09-26.json")); // newest in September
  assert.ok(!del.includes("/backups/auto-2026-08-29.json")); // newest in August
  assert.ok(del.includes("/backups/auto-2026-09-12.json"));
  assert.ok(del.includes("/backups/auto-2025-01-05.json"));
});

test("auto backup is due weekly", () => {
  assert.equal(autoBackupDue([], NOW), true);
  assert.equal(autoBackupDue(["/backups/auto-2026-10-09.json"], NOW), false);
  assert.equal(autoBackupDue(["/backups/auto-2026-10-01.json"], NOW), true);
});
