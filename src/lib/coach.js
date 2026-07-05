/* ----------------------------- coach analysis ----------------------------- */
// Evidence-based training checks computed from the logged history: plateau
// detection on the big lifts, push/pull balance, weekly volume landmarks
// (Renaissance Periodization MEV heuristic), and a grip-work check (a known
// limiter on bench and deadlift for this lifter).
import { setsForExercise } from "./helpers";

// Rough muscle-group classifier for exercise names as they appear in Strong
// exports. Only needs to be good enough for push/pull and volume grouping.
export function muscleOf(name) {
  const n = name.toLowerCase();
  if (/squat|leg|calf|lunge|hack|hip|glute|deadlift/.test(n)) return "Legs";
  if (/bench|chest|pec|press \(plate|decline press|incline chest|push up|dip|fly/.test(n)) return "Chest";
  if (/row|pulldown|pull up|lat |shrug|back ext/.test(n)) return "Back";
  if (/shoulder|deltoid|overhead|arnold|raise/.test(n)) return "Shoulders";
  if (/curl|bicep/.test(n) && !/leg|wrist/.test(n)) return "Biceps";
  if (/tricep|pushdown/.test(n)) return "Triceps";
  if (/wrist|grip/.test(n)) return "Forearms";
  if (/crunch|ab|plank/.test(n)) return "Core";
  return "Other";
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const BIG_LIFTS = ["Squat (Barbell)", "Bench Press (Barbell)", "Deadlift (Barbell)"];

// Returns [{ lvl: "warn"|"good"|"info", name?, text }]
export function analyzeCoach(workouts, activity = []) {
  const insights = [];
  const cutoff = Date.now() - 30 * 86400000;
  const recentWorkouts = workouts.filter((w) => new Date(w.date).getTime() > cutoff);

  // 1) Plateau detection: best e1RM of the last 4 sessions vs the prior 4.
  BIG_LIFTS.forEach((name) => {
    const sessions = setsForExercise(workouts, name); // ascending by date
    if (sessions.length < 5) return;
    const recent = sessions.slice(-4).map((s) => s.e1rm);
    const prior = sessions.slice(-8, -4).map((s) => s.e1rm);
    const pct = ((avg(recent) - avg(prior)) / avg(prior)) * 100;
    if (pct < 2) {
      insights.push({
        lvl: "warn", name,
        text: `Est. 1RM is flat (${pct.toFixed(1)}% over the last 4 sessions vs the prior 4). Evidence-based next step: a deload week at ~60% for 5×5, or a 2–3 week rep-range wave (e.g. 5×5 instead of 3×8) before resuming linear progression.`,
      });
    } else {
      insights.push({
        lvl: "good", name,
        text: `Trending up ${pct.toFixed(1)}% over the last 4 sessions. Continue current progression.`,
      });
    }
  });

  // 2) Push/pull volume balance over the last 30 days.
  const byMuscle = {};
  recentWorkouts.forEach((w) =>
    w.exercises.forEach((ex) => {
      const m = muscleOf(ex.name);
      byMuscle[m] = (byMuscle[m] || 0) + ex.sets.length;
    })
  );
  const push = (byMuscle.Chest || 0) + (byMuscle.Shoulders || 0) + (byMuscle.Triceps || 0);
  const pull = (byMuscle.Back || 0) + (byMuscle.Biceps || 0);
  if (push && pull) {
    const ratio = push / pull;
    if (ratio > 1.3) {
      insights.push({
        lvl: "warn", name: "Push : pull balance",
        text: `Push:pull volume is ${ratio.toFixed(1)}:1 over 30 days (${push} vs ${pull} sets). A ~1:1 ratio is the standard recommendation for shoulder health — add 1–2 back sets per week.`,
      });
    } else if (ratio < 0.77) {
      insights.push({
        lvl: "info", name: "Push : pull balance",
        text: `Pull:push volume is ${(pull / push).toFixed(1)}:1 — fine for posture, just confirm chest/shoulder volume still supports your growth goals.`,
      });
    } else {
      insights.push({
        lvl: "good", name: "Push : pull balance",
        text: `Balanced at ${ratio.toFixed(2)}:1 over the last 30 days (${push} push vs ${pull} pull sets).`,
      });
    }
  }

  // 3) Volume landmarks — flag muscles under ~8 hard sets/week (MEV ≈ 10/wk).
  Object.entries(byMuscle).forEach(([m, total]) => {
    if (m === "Other") return;
    const perWeek = total / (30 / 7);
    if (perWeek < 8) {
      insights.push({
        lvl: "warn", name: m,
        text: `~${perWeek.toFixed(1)} sets/week — below the typical minimum effective volume (~10/wk) for continued hypertrophy at your training age.`,
      });
    }
  });

  // 4) Grip/wrist work check.
  const gripWork = recentWorkouts.some((w) => w.exercises.some((e) => /wrist|grip/i.test(e.name)));
  insights.push(
    gripWork
      ? { lvl: "good", name: "Grip / wrist", text: "Grip or wrist work is present in your recent training. Keep it up — this is your known limiter on bench and deadlift." }
      : { lvl: "warn", name: "Grip / wrist", text: "No grip or wrist work logged in 30 days. Since grip has limited your bench and deadlift, add 2×/week: farmer carries, dead hangs, or wrist curls (3×15–20)." }
  );

  // 5) Frequency, including Apple Health cardio if imported.
  const recentActivity = activity.filter((a) => new Date(a.date).getTime() > cutoff);
  let freq = `${recentWorkouts.length} lifting sessions in the last 30 days (~${(recentWorkouts.length / 4.3).toFixed(1)}/week).`;
  if (recentActivity.length) freq += ` Apple Health adds ${recentActivity.length} cardio/activity sessions in the same window.`;
  insights.push({ lvl: "info", name: "Frequency", text: freq });

  return insights;
}
