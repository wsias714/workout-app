import { useCallback, useEffect, useRef, useState } from "react";
import { dropboxRemote, finishAuthFromUrl, isConnected } from "./dropbox.ts";
import { mergeData, sameData } from "./merge.ts";
import { readArchives, syncGym } from "./remote.ts";
import type { Usage } from "./remote.ts";
import type { GymData, Workout } from "./types.ts";

export type SyncState = "off" | "idle" | "syncing" | "offline" | "error";

const MIGRATED = "gym-dbx-migrated";
const flag = (): boolean => {
  try {
    return window.localStorage.getItem(MIGRATED) === "1";
  } catch {
    return true;
  }
};
const setFlag = () => {
  try {
    window.localStorage.setItem(MIGRATED, "1");
  } catch {
    /* ignore */
  }
};

export interface Sync {
  state: SyncState;
  error: string;
  lastSync: string;
  usage: Usage | null;
  connected: boolean;
  syncNow: () => void;
  refreshConnection: () => void;
  /** Full-detail workouts that were rolled up and moved to Dropbox archives. */
  fetchArchive: () => Promise<Workout[]>;
}

/**
 * `getLib` returns the app's current data; `applyLib` takes an updater over it. Both are
 * supplied by App.jsx, which keeps workouts / meta / activity in three pieces of state.
 */
export function useSync(
  lib: GymData,
  applyLib: (fn: (cur: GymData) => GymData) => void,
  flash: (m: string) => void,
  ready: boolean,
): Sync {
  const [state, setState] = useState<SyncState>(isConnected() ? "idle" : "off");
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [connected, setConnected] = useState(isConnected());

  const libRef = useRef(lib);
  libRef.current = lib;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const synced = useRef<GymData | null>(null); // what Dropbox last held
  const busy = useRef(false);
  const again = useRef(false);
  const measured = useRef(false);

  const run = useCallback(async () => {
    if (!isConnected() || !readyRef.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setState("syncing");
    try {
      const remote = dropboxRemote();
      const res = await syncGym(remote, libRef.current, { snapshotLocal: !flag(), measure: !measured.current });
      setFlag();
      measured.current = true;
      synced.current = res.data;
      applyLib((cur) => {
        const merged = mergeData(cur, res.data);
        return sameData(merged, cur) ? cur : merged;
      });
      if (res.archivedWorkouts) flash(`${res.archivedWorkouts} old workouts archived to Dropbox to save space.`);
      if (res.pushed || res.usage.folderBytes) setUsage(res.usage);
      setLastSync(new Date().toISOString());
      setError("");
      setState("idle");
    } catch (e) {
      const offline = !navigator.onLine || (e instanceof TypeError && /fetch|network/i.test(e.message));
      setState(offline ? "offline" : "error");
      setError(offline ? "" : e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(run, 500);
      }
    }
  }, [applyLib, flash]);

  /* finish an OAuth redirect, then first sync */
  useEffect(() => {
    if (!ready) return;
    finishAuthFromUrl()
      .then((r) => {
        if (r === "connected") {
          setConnected(true);
          flash("Dropbox connected.");
        }
      })
      .catch((e: Error) => {
        setState("error");
        setError(e.message);
      })
      .finally(() => void run());
  }, [ready, run, flash]);

  /* local edits -> debounce -> sync */
  useEffect(() => {
    if (!connected || !ready) return;
    if (synced.current && sameData(lib, synced.current)) return;
    const t = setTimeout(() => void run(), 1500);
    return () => clearTimeout(t);
  }, [lib, connected, ready, run]);

  /* come back to the app / regain network -> sync */
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [run]);

  const refreshConnection = useCallback(() => {
    const c = isConnected();
    setConnected(c);
    setState(c ? "idle" : "off");
    if (c) void run();
  }, [run]);

  const fetchArchive = useCallback(() => readArchives(dropboxRemote()), []);

  return { state, error, lastSync, usage, connected, syncNow: () => void run(), refreshConnection, fetchArchive };
}
