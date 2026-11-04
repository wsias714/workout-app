import { useEffect, useState } from "react";
import { dropboxRemote, isConnected } from "./dropbox.ts";
import { COACH_PATH, parseCoachReview } from "./coachReview.ts";
import type { CoachReview } from "./coachReview.ts";

const CACHE = "gym-coach-review"; // device-local copy so the card shows offline; never synced

const cached = (): CoachReview | null => {
  try {
    return parseCoachReview(window.localStorage.getItem(CACHE));
  } catch {
    return null;
  }
};

/** Reads coach.json after each successful sync. Read-only; any failure keeps the cached copy. */
export function useCoachReview(connected: boolean, lastSync: string): CoachReview | null {
  const [review, setReview] = useState<CoachReview | null>(cached);
  useEffect(() => {
    if (!connected || !lastSync || !isConnected()) return;
    let live = true;
    dropboxRemote()
      .read(COACH_PATH)
      .then((f) => {
        const r = parseCoachReview(f?.text);
        if (!r || !live) return;
        setReview(r);
        try {
          window.localStorage.setItem(CACHE, JSON.stringify(r));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [connected, lastSync]);
  return review;
}
