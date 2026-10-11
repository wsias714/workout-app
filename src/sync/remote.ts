import { FOLDER_BUDGET, WARN_AT, DATA_BUDGET, autoBackupDue, autoBackupPath, backupsToDelete, compactIfOver, mergeArchive, sizeOf } from "./archive.ts";
import { mergeData, pruneTombstones, sameData } from "./merge.ts";
import type { GymData, Workout } from "./types.ts";

/* Sync engine, written against a tiny `Remote` interface so it can be tested with an
   in-memory fake and run against Dropbox in the app. Same pattern as ListenMore. */

export const DATA_PATH = "/data.json";
export const ARCHIVE_DIR = "/archive";
export const BACKUP_DIR = "/backups";

/** Thrown by Remote.write when the file's rev moved since it was read. */
export class ConflictError extends Error {
  constructor() {
    super("remote file changed since it was read");
  }
}

export interface RemoteFile {
  text: string;
  rev: string;
}
export interface RemoteEntry {
  path: string;
  modified: string; // ISO
  size: number;
}
export interface Remote {
  read(path: string): Promise<RemoteFile | null>;
  /** rev=null means "create, and fail with ConflictError if it already exists". */
  write(path: string, text: string, rev: string | null): Promise<{ rev: string }>;
  list(dir: string): Promise<RemoteEntry[]>;
  remove(path: string): Promise<void>;
}

export interface Usage {
  dataBytes: number;
  folderBytes: number;
  /** "ok", or a short human line when a budget is getting close. */
  warning: string;
}
export interface SyncResult {
  data: GymData;
  pushed: boolean;
  usage: Usage;
  archivedWorkouts: number;
}

const MAX_ATTEMPTS = 5;

export function parseData(text: string): GymData {
  const p = JSON.parse(text) as Partial<GymData>;
  if (!p || !Array.isArray(p.workouts) || !p.meta || typeof p.meta !== "object") {
    throw new Error("data.json is not a Gym Tracker file");
  }
  return { workouts: p.workouts, meta: p.meta, activity: Array.isArray(p.activity) ? p.activity : [] };
}

export function describeUsage(dataBytes: number, folderBytes: number): Usage {
  const mb = (n: number) => (n / 1e6).toFixed(n < 1e5 ? 2 : 1) + " MB";
  let warning = "";
  if (dataBytes >= DATA_BUDGET * WARN_AT) warning = `Data file is ${mb(dataBytes)} of ${mb(DATA_BUDGET)}; old workouts will be archived.`;
  else if (folderBytes >= FOLDER_BUDGET * WARN_AT) warning = `Dropbox folder is ${mb(folderBytes)} of ${mb(FOLDER_BUDGET)}.`;
  return { dataBytes, folderBytes, warning };
}

async function measure(remote: Remote, dataBytes: number): Promise<Usage> {
  let folder = dataBytes;
  for (const dir of [BACKUP_DIR, ARCHIVE_DIR]) {
    for (const e of await remote.list(dir)) folder += e.size;
  }
  return describeUsage(dataBytes, folder);
}

/** Merge a year's worth of full workouts into archive/<year>.json (read, union, rev-checked write). */
async function writeArchive(remote: Remote, year: string, incoming: Workout[]): Promise<void> {
  const path = `${ARCHIVE_DIR}/${year}.json`;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const cur = await remote.read(path);
    const existing = cur ? (JSON.parse(cur.text) as { workouts?: Workout[] }).workouts ?? [] : [];
    const text = JSON.stringify({ year, workouts: mergeArchive(existing, incoming) });
    try {
      await remote.write(path, text, cur?.rev ?? null);
      return;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error(`Couldn't write the ${year} archive; Dropbox kept changing.`);
}

/** Every archived workout, full detail, for "Export everything". */
export async function readArchives(remote: Remote): Promise<Workout[]> {
  const out: Workout[] = [];
  for (const e of await remote.list(ARCHIVE_DIR)) {
    const f = await remote.read(e.path);
    if (f) out.push(...((JSON.parse(f.text) as { workouts?: Workout[] }).workouts ?? []));
  }
  return out;
}

/**
 * Pull remote, merge with `local`, and push only if that changed anything. Rev-based writes:
 * if the file moved underneath us we re-read, re-merge and retry, so a write can never
 * silently overwrite a newer file. Over budget, old workouts are rolled up and their full
 * copies written to the archive BEFORE data.json shrinks.
 */
export async function syncGym(
  remote: Remote,
  local: GymData,
  opts: { snapshotLocal?: boolean; measure?: boolean; now?: number; budget?: number } = {},
): Promise<SyncResult> {
  const now = opts.now ?? Date.now();
  let working = local;
  let snapshot = !!opts.snapshotLocal;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const r = await remote.read(DATA_PATH);
    const remoteData: GymData | null = r ? parseData(r.text) : null;

    if (snapshot && working.workouts.length) {
      // One-time safety copy of the phone's data before it merges into Dropbox.
      const name = `${BACKUP_DIR}/premigration-${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`;
      try {
        await remote.write(name, JSON.stringify(working), null);
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
      }
    }
    snapshot = false;

    const merged = pruneTombstones(remoteData ? mergeData(working, remoteData) : working, now);
    const comp = compactIfOver(merged, now, opts.budget);
    const final = comp.data;

    if (r && remoteData && sameData(final, remoteData)) {
      const usage = opts.measure ? await measure(remote, sizeOf(r.text)) : describeUsage(sizeOf(r.text), 0);
      return { data: final, pushed: false, usage, archivedWorkouts: 0 };
    }

    // Weekly safety copy of what is about to be replaced.
    let backups: string[] = [];
    if (r) {
      backups = (await remote.list(BACKUP_DIR)).map((e) => e.path);
      if (autoBackupDue(backups, now)) {
        try {
          await remote.write(autoBackupPath(now), r.text, null);
          backups.push(autoBackupPath(now));
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e;
        }
      }
    }

    let archivedWorkouts = 0;
    for (const [year, ws] of Object.entries(comp.archived)) {
      await writeArchive(remote, year, ws);
      archivedWorkouts += ws.length;
    }

    const text = JSON.stringify(final);
    try {
      await remote.write(DATA_PATH, text, r?.rev ?? null);
    } catch (e) {
      if (e instanceof ConflictError) {
        working = final;
        continue;
      }
      throw e;
    }
    for (const p of backupsToDelete(backups, now)) {
      try {
        await remote.remove(p);
      } catch {
        /* a leftover old backup is harmless */
      }
    }
    return { data: final, pushed: true, usage: await measure(remote, sizeOf(text)), archivedWorkouts };
  }
  throw new Error("Dropbox kept changing underneath the sync; try again in a moment.");
}
