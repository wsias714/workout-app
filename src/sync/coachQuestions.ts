/* "Ask coach": questions typed on the Coach tab. Each one is written ONCE as its own new file,
   coach-questions/<id>.json, in the app folder (create-only, so no write can ever collide), and the weekly
   desktop job (ai-housekeeping `bin/coach_review.py`) answers it into coach.json `answers`. The phone keeps its
   own list in localStorage only to show "waiting" until the answer arrives. Never merged into data.json. */

export const QUESTION_DIR = "/coach-questions";
export const MAX_QUESTION = 500;
export const MAX_KEPT = 20;

export interface AskedQuestion {
  id: string;
  q: string;
  at: string;
  /** true once the file is in Dropbox; false = still waiting for a connection. */
  sent: boolean;
}

export const questionPath = (id: string) => `${QUESTION_DIR}/${id}.json`;

/** The file the desktop job reads. Text only: no names, no workout data. */
export const questionFile = (q: AskedQuestion) => JSON.stringify({ v: 1, id: q.id, q: q.q, at: q.at });

export function newQuestion(text: string, id: string, now: Date): AskedQuestion | null {
  const q = text.trim().replace(/\s+/g, " ").slice(0, MAX_QUESTION);
  return q ? { id, q, at: now.toISOString(), sent: false } : null;
}

export function parseAsked(text: string | null | undefined): AskedQuestion[] {
  try {
    const raw = JSON.parse(text || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x) => x && typeof x.id === "string" && typeof x.q === "string" && typeof x.at === "string")
      .map((x) => ({ id: x.id, q: x.q, at: x.at, sent: x.sent === true }))
      .slice(0, MAX_KEPT);
  } catch {
    return [];
  }
}

/** Questions the coach hasn't replied to yet (matched by id against review.answers). */
export const waiting = (asked: AskedQuestion[], answeredIds: string[]) => asked.filter((x) => !answeredIds.includes(x.id));
