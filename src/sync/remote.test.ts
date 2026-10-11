import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHIVE_DIR, ConflictError, DATA_PATH, readArchives, syncGym } from "./remote.ts";
import type { Remote, RemoteEntry, RemoteFile } from "./remote.ts";
import type { GymData, Workout } from "./types.ts";

class FakeRemote implements Remote {
  files = new Map<string, { text: string; rev: number; modified: string }>();
  onNextWrite?: () => void;
  async read(path: string): Promise<RemoteFile | null> {
    const f = this.files.get(path);
    return f ? { text: f.text, rev: String(f.rev) } : null;
  }
  async write(path: string, text: string, rev: string | null) {
    this.onNextWrite?.();
    this.onNextWrite = undefined;
    const f = this.files.get(path);
    if ((f ? String(f.rev) : null) !== rev) throw new ConflictError();
    const next = (f?.rev ?? 0) + 1;
    this.files.set(path, { text, rev: next, modified: new Date().toISOString() });
    return { rev: String(next) };
  }
  async list(dir: string): Promise<RemoteEntry[]> {
    return [...this.files].filter(([p]) => p.startsWith(dir + "/")).map(([path, f]) => ({ path, modified: f.modified, size: f.text.length }));
  }
  async remove(path: string) {
    this.files.delete(path);
  }
}

const NOW = Date.UTC(2026, 9, 11);
const wk = (id: string, date = "2026-09-01T10:00:00.000Z"): Workout => ({
  id, name: "Upper", date, gym: "main", exercises: [{ name: "Bench Press (Barbell)", sets: [{ weight: 135, reps: 8 }, { weight: 155, reps: 5 }] }],
});
const data = (workouts: Workout[]): GymData => ({
  workouts, activity: [], meta: { gyms: [{ id: "main", name: "Main Gym" }], activeGym: "main", routines: [], customExercises: [], settings: {} },
});
const saved = (r: FakeRemote): GymData => JSON.parse(r.files.get(DATA_PATH)!.text);

test("first connect uploads local data and takes a pre-migration snapshot", async () => {
  const r = new FakeRemote();
  const res = await syncGym(r, data([wk("a"), wk("b")]), { snapshotLocal: true, now: NOW });
  assert.equal(res.pushed, true);
  assert.equal(saved(r).workouts.length, 2);
  assert.ok([...r.files.keys()].some((p) => p.startsWith("/backups/premigration-")));
});

test("second device merges instead of overwriting; unchanged sync pushes nothing", async () => {
  const r = new FakeRemote();
  await syncGym(r, data([wk("a")]), { now: NOW });
  const res = await syncGym(r, data([wk("b")]), { now: NOW });
  assert.deepEqual(saved(r).workouts.map((w) => w.id).sort(), ["a", "b"]);
  assert.deepEqual(res.data.workouts.map((w) => w.id).sort(), ["a", "b"]);
  const rev = r.files.get(DATA_PATH)!.rev;
  const again = await syncGym(r, res.data, { now: NOW });
  assert.equal(again.pushed, false);
  assert.equal(r.files.get(DATA_PATH)!.rev, rev);
});

test("a write that races a newer remote file is re-merged, never clobbering", async () => {
  const r = new FakeRemote();
  await syncGym(r, data([wk("a")]), { now: NOW });
  r.onNextWrite = () => {
    const cur = saved(r);
    cur.workouts.push(wk("from-other-device"));
    const f = r.files.get(DATA_PATH)!;
    r.files.set(DATA_PATH, { ...f, text: JSON.stringify(cur), rev: f.rev + 1 });
  };
  await syncGym(r, data([wk("a"), wk("mine")]), { now: NOW });
  assert.deepEqual(saved(r).workouts.map((w) => w.id).sort(), ["a", "from-other-device", "mine"]);
});

test("a weekly auto backup of the replaced file is written, and not twice in a week", async () => {
  const r = new FakeRemote();
  await syncGym(r, data([wk("a")]), { now: NOW });
  await syncGym(r, data([wk("a"), wk("b")]), { now: NOW });
  const autos = () => [...r.files.keys()].filter((p) => p.startsWith("/backups/auto-"));
  assert.equal(autos().length, 1);
  await syncGym(r, data([wk("a"), wk("b"), wk("c")]), { now: NOW + 86_400_000 });
  assert.equal(autos().length, 1);
});

test("over budget: old workouts archived first, data.json shrinks, best sets survive, archive is readable", async () => {
  const r = new FakeRemote();
  const old = Array.from({ length: 60 }, (_, i) => wk("o" + i, `2022-0${(i % 9) + 1}-10T10:00:00.000Z`));
  const full = data([...old, wk("recent", "2026-09-30T10:00:00.000Z")]);
  const res = await syncGym(r, full, { now: NOW, budget: 5_000 });
  assert.equal(res.archivedWorkouts, 60);
  const hot = saved(r);
  assert.equal(hot.workouts.length, 61);
  assert.equal(hot.workouts.filter((w) => w.compact).length, 60);
  assert.deepEqual(hot.workouts.find((w) => w.id === "o0")!.exercises[0].sets, [{ weight: 155, reps: 5 }]);
  const arch = await readArchives(r);
  assert.equal(arch.length, 60);
  assert.equal(arch[0].exercises[0].sets.length, 2); // full detail kept in the archive
  assert.ok(r.files.get(DATA_PATH)!.text.length < JSON.stringify(full).length);
  // a stale phone that still has the full copies merges back to compact, not re-bloated
  const stale = await syncGym(r, full, { now: NOW, budget: 5_000 });
  assert.equal(stale.data.workouts.filter((w) => w.compact).length, 60);
});

test("a deleted workout does not come back from another device's stale copy", async () => {
  const r = new FakeRemote();
  await syncGym(r, data([wk("a"), wk("b")]), { now: NOW });
  const afterDelete = data([wk("b")]);
  afterDelete.meta.tomb = { workouts: { a: NOW }, routines: {} };
  await syncGym(r, afterDelete, { now: NOW });
  const res = await syncGym(r, data([wk("a"), wk("b")]), { now: NOW }); // stale device
  assert.deepEqual(res.data.workouts.map((w) => w.id), ["b"]);
});

test("readArchives returns [] with no archive folder", async () => {
  assert.deepEqual(await readArchives(new FakeRemote()), []);
  assert.equal(ARCHIVE_DIR, "/archive");
});
