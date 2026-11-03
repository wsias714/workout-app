import { test } from "node:test";
import assert from "node:assert/strict";
import { prsByWorkout, prsFor } from "./prs.ts";

const w = (id: string, date: string, sets: { weight: number; reps: number }[]) => ({ id, date, exercises: [{ name: "Bench", sets }] });

test("first log of an exercise is a baseline, not a PR", () => {
  assert.equal(prsByWorkout([w("a", "2026-01-01", [{ weight: 100, reps: 5 }])]).size, 0);
});

test("more reps at same weight is a volume PR and an e1RM PR", () => {
  const m = prsByWorkout([w("a", "2026-01-01", [{ weight: 100, reps: 5 }]), w("b", "2026-01-08", [{ weight: 100, reps: 8 }])]);
  assert.deepEqual(m.get("b")!.map((p) => p.kind).sort(), ["e1rm", "volume"]);
});

test("extra sets raise total volume without an e1RM PR", () => {
  const m = prsByWorkout([
    w("a", "2026-01-01", [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }]),
    w("b", "2026-01-08", [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }, { weight: 100, reps: 5 }]),
  ]);
  assert.deepEqual(m.get("b")!.map((p) => p.kind), ["volume"]);
});

test("order of input does not matter and ties are not PRs", () => {
  const m = prsByWorkout([w("b", "2026-01-08", [{ weight: 100, reps: 5 }]), w("a", "2026-01-01", [{ weight: 100, reps: 5 }])]);
  assert.equal(m.size, 0);
});

test("prsFor with no history returns nothing", () => {
  assert.deepEqual(prsFor("Bench", [{ weight: 100, reps: 5 }], []), []);
});
