import test from "node:test";
import assert from "node:assert/strict";
import { parseCoachReview } from "./coachReview.ts";

const good = { week: "2026-11-02", generatedAt: "2026-11-06T18:00:00Z", headline: "Strong week", points: ["Squat up 10 lb", "Pull volume low"], focus: "Add rows" };

test("parses a valid review", () => {
  const r = parseCoachReview(JSON.stringify(good));
  assert.equal(r?.headline, "Strong week");
  assert.equal(r?.points.length, 2);
});

test("rejects missing, malformed or empty reviews", () => {
  assert.equal(parseCoachReview(null), null);
  assert.equal(parseCoachReview("not json"), null);
  assert.equal(parseCoachReview(JSON.stringify({ ...good, points: [] })), null);
  assert.equal(parseCoachReview(JSON.stringify({ ...good, week: "soon" })), null);
  assert.equal(parseCoachReview(JSON.stringify({ ...good, headline: "" })), null);
});

test("drops blank points and caps the list", () => {
  const r = parseCoachReview(JSON.stringify({ ...good, points: ["a", " ", 5, "b", "c", "d", "e", "f", "g"] }));
  assert.deepEqual(r?.points, ["a", "b", "c", "d", "e", "f"]);
});

test("parses plan items and answers, tolerating junk", () => {
  const r = parseCoachReview(JSON.stringify({
    ...good,
    plan: [{ focus: "Pull day", why: "Rows are thin" }, { focus: "" }, 7],
    answers: [{ id: "ab12", q: "Wrist?", a: "Keep it neutral.", at: "2026-11-06T18:00:00Z" }, { id: "", a: "x" }, { id: "z", a: "" }],
  }));
  assert.deepEqual(r?.plan, [{ focus: "Pull day", why: "Rows are thin" }]);
  assert.equal(r?.answers.length, 1);
  assert.equal(r?.answers[0].a, "Keep it neutral.");
});

test("older reviews with no plan or answers still parse", () => {
  const r = parseCoachReview(JSON.stringify(good));
  assert.deepEqual(r?.plan, []);
  assert.deepEqual(r?.answers, []);
});
