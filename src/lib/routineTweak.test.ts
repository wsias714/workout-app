import test from "node:test";
import assert from "node:assert/strict";
import { applyTweak, storedWeight } from "./routineTweak.ts";

const routines = [
  { id: "r1", name: "Leg Day", updated: 5, exercises: [{ name: "Squat", sets: 3, reps: 12, weight: 255 }, { name: "Leg Press", sets: 3, reps: 12, weight: 360 }] },
  { id: "r2", name: "Other", exercises: [{ name: "Squat", sets: 3, reps: 8, weight: 200 }] },
];

test("changes only the named exercise in the named routine and stamps updated", () => {
  const out = applyTweak(routines, { routine: "r1", exercise: "Squat", weight: 260, reps: 8 }, 99);
  assert.deepEqual(out[0].exercises[0], { name: "Squat", sets: 3, reps: 8, weight: 260 });
  assert.deepEqual(out[0].exercises[1], routines[0].exercises[1]);
  assert.equal(out[0].updated, 99);
  assert.equal(out[1], routines[1]);
  assert.equal(routines[0].exercises[0].weight, 255); // input untouched
});

test("keeps reps when the tweak has none", () => {
  const out = applyTweak(routines, { routine: "r1", exercise: "Leg Press", weight: 370 }, 1);
  assert.equal((out[0].exercises[1] as { reps: number }).reps, 12);
});

test("unknown routine or exercise is a no-op", () => {
  assert.equal(applyTweak(routines, { routine: "zz", exercise: "Squat", weight: 1 }, 1), routines);
  assert.equal(applyTweak(routines, { routine: "r1", exercise: "Nope", weight: 1 }, 1), routines);
  assert.equal(storedWeight(routines, { routine: "r1", exercise: "Nope", weight: 1 }), null);
  assert.equal(storedWeight(routines, { routine: "r1", exercise: "Squat", weight: 1 }), 255);
});
