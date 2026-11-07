/* Weekly coach review: written by the desktop job (ai-housekeeping, Fridays) to
   Apps/WadeGymTracker/coach.json. The phone only READS it; it is never merged, edited or
   synced back, and it does not touch data.json. See docs/sync.md. */

export const COACH_PATH = "/coach.json";

export interface CoachReview {
  /** Monday (YYYY-MM-DD) of the week the review covers. */
  week: string;
  generatedAt: string;
  headline: string;
  points: string[];
  focus: string;
  /** Upcoming-week recommendations: which workouts to focus on and why. Optional (older reviews have none). */
  plan: CoachPlanItem[];
  /** Replies to questions asked in the app, newest first. */
  answers: CoachAnswer[];
}

export interface CoachPlanItem { focus: string; why: string }
export interface CoachAnswer { id: string; q: string; a: string; at: string }

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Lenient on extras, strict on shape: returns null for anything unusable. */
export function parseCoachReview(text: string | null | undefined): CoachReview | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const week = str(r.week, 10);
  const headline = str(r.headline, 200);
  const points = Array.isArray(r.points) ? r.points.map((p) => str(p, 400)).filter(Boolean).slice(0, 6) : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !headline || points.length === 0) return null;
  const plan = Array.isArray(r.plan)
    ? r.plan
        .map((p) => (p && typeof p === "object" ? { focus: str((p as Record<string, unknown>).focus, 120), why: str((p as Record<string, unknown>).why, 300) } : null))
        .filter((p): p is CoachPlanItem => !!p && !!p.focus)
        .slice(0, 5)
    : [];
  const answers = Array.isArray(r.answers)
    ? r.answers
        .map((x) => {
          const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
          return { id: str(o.id, 64), q: str(o.q, 500), a: str(o.a, 1200), at: str(o.at, 40) };
        })
        .filter((x) => x.id && x.a)
        .slice(0, 10)
    : [];
  return { week, generatedAt: str(r.generatedAt, 40), headline, points, focus: str(r.focus, 300), plan, answers };
}
