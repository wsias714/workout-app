import test from "node:test";
import assert from "node:assert/strict";
import { newQuestion, parseAsked, questionFile, questionPath, waiting } from "./coachQuestions.ts";

const now = new Date("2026-11-07T12:00:00Z");

test("newQuestion trims, collapses whitespace, caps length and rejects blanks", () => {
  assert.equal(newQuestion("   ", "a1", now), null);
  assert.equal(newQuestion("  left   wrist\nhurts ", "a1", now)?.q, "left wrist hurts");
  assert.equal(newQuestion("x".repeat(900), "a1", now)?.q.length, 500);
});

test("the uploaded file holds only id, question and time, under its own path", () => {
  const q = newQuestion("wrist", "ab12", now)!;
  assert.equal(questionPath(q.id), "/coach-questions/ab12.json");
  assert.deepEqual(JSON.parse(questionFile(q)), { v: 1, id: "ab12", q: "wrist", at: now.toISOString() });
});

test("parseAsked survives junk and waiting() drops answered ids", () => {
  assert.deepEqual(parseAsked("nope"), []);
  const list = parseAsked(JSON.stringify([{ id: "a", q: "one", at: "t", sent: true }, { id: "b", q: "two", at: "t" }, { bad: 1 }]));
  assert.equal(list.length, 2);
  assert.equal(list[1].sent, false);
  assert.deepEqual(waiting(list, ["a"]).map((x) => x.id), ["b"]);
});
