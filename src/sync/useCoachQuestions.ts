import { useCallback, useEffect, useRef, useState } from "react";
import { dropboxRemote, isConnected } from "./dropbox.ts";
import { ConflictError } from "./remote.ts";
import { MAX_KEPT, newQuestion, parseAsked, questionFile, questionPath } from "./coachQuestions.ts";
import type { AskedQuestion } from "./coachQuestions.ts";

const KEY = "gym-coach-asked"; // device-local; never synced

const load = (): AskedQuestion[] => {
  try {
    return parseAsked(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
};

/** Ask-coach list. A question is saved on the phone at once and uploaded when Dropbox is reachable
    (now, or after the next sync). Answered ones are trimmed away once their reply is in coach.json. */
export function useCoachQuestions(connected: boolean, lastSync: string, answeredIds: string[]) {
  const [asked, setAsked] = useState<AskedQuestion[]>(load);
  const busy = useRef(false);

  const store = (next: AskedQuestion[]) => {
    setAsked(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const flush = useCallback(async (list: AskedQuestion[]) => {
    if (busy.current || !isConnected() || !list.some((x) => !x.sent)) return;
    busy.current = true;
    let cur = list;
    for (const x of list.filter((y) => !y.sent)) {
      try {
        await dropboxRemote().write(questionPath(x.id), questionFile(x), null);
      } catch (e) {
        if (!(e instanceof ConflictError)) break; // already there counts as sent
      }
      cur = cur.map((y) => (y.id === x.id ? { ...y, sent: true } : y));
      store(cur);
    }
    busy.current = false;
  }, []);

  useEffect(() => {
    if (connected && lastSync) void flush(load());
  }, [connected, lastSync, flush]);

  // forget questions whose answer has arrived (the answer card keeps the text)
  useEffect(() => {
    const cur = load();
    const keep = cur.filter((x) => !answeredIds.includes(x.id));
    if (keep.length !== cur.length) store(keep);
  }, [answeredIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = useCallback(
    (text: string): boolean => {
      const id = Array.from(window.crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
      const q = newQuestion(text, id, new Date());
      if (!q) return false;
      const next = [q, ...load()].slice(0, MAX_KEPT);
      store(next);
      void flush(next);
      return true;
    },
    [flush],
  );

  return { asked, ask };
}
