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
}

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
  return { week, generatedAt: str(r.generatedAt, 40), headline, points, focus: str(r.focus, 300) };
}
