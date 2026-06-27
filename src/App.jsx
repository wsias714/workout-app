import React, { useState, useEffect, useRef, useMemo } from "react";
import Papa from "papaparse";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Dumbbell, Plus, Minus, Check, Clock, TrendingUp, History as HistoryIcon,
  ListChecks, Upload, Download, X, Search, Flame, Trash2,
  Play, RotateCcw, Settings as SettingsIcon, Sparkles,
} from "lucide-react";
import { C, MONO, SANS } from "./lib/theme";
import { uid, num, epley, fmtDate, fmtShort, dayKey, setsForExercise } from "./lib/helpers";
import WorkoutListScreen from "./components/WorkoutListScreen";
import WorkoutDetailScreen from "./components/WorkoutDetailScreen";

/* ------------------------------ storage ---------------------------------- */
// Persists to localStorage when running as a real PWA, and to window.storage
// when previewed inside a Claude artifact. Falls back to memory if both fail.
const _mem = {};
async function loadKey(key, fallback) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : fallback;
    }
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return key in _mem ? _mem[key] : fallback;
  }
}
async function saveKey(key, val) {
  try {
    _mem[key] = val;
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(key, JSON.stringify(val));
      return;
    }
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* memory fallback already set */
  }
}

/* -------------------------- Strong CSV import ---------------------------- */
// Flexible header mapping — handles comma/semicolon delimiters and kg/lb columns.
function findIdx(headers, names) {
  const low = headers.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = low.findIndex((h) => h === n.toLowerCase());
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = low.findIndex((h) => h.includes(n.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

// Robust parser: handles comma/semicolon delimiters AND realigns rows where an
// unquoted comma in Duration (a known Strong bug, e.g. "2,811h 41m") shifts every
// later column. Any surplus fields are merged back into Duration before mapping.
function parseStrong(csvText) {
  const res = Papa.parse(csvText.trim(), { skipEmptyLines: true, delimiter: "" });
  const all = res.data;
  if (!all.length) return { workouts: [], unit: "lb", count: 0, repaired: 0 };

  const headers = all[0];
  const H = headers.length;
  const idx = {
    date: findIdx(headers, ["Date"]),
    name: findIdx(headers, ["Workout Name"]),
    dur: findIdx(headers, ["Duration"]),
    ex: findIdx(headers, ["Exercise Name", "Exercise"]),
    w: findIdx(headers, ["Weight"]),
    r: findIdx(headers, ["Reps"]),
    dist: findIdx(headers, ["Distance"]),
    sec: findIdx(headers, ["Seconds"]),
    rpe: findIdx(headers, ["RPE"]),
  };
  let unit = "lb";
  if (headers.some((h) => /kg/i.test(h))) unit = "kg";

  let repaired = 0;
  const groups = {};
  for (let i = 1; i < all.length; i++) {
    let row = all[i];
    if (row.length === 1 && row[0] === "") continue;
    // realign comma-shifted rows by collapsing surplus into Duration
    if (row.length > H && idx.dur >= 0) {
      const surplus = row.length - H;
      const merged = row.slice(idx.dur, idx.dur + surplus + 1).join(",");
      row = [...row.slice(0, idx.dur), merged, ...row.slice(idx.dur + surplus + 1)];
      repaired++;
    }
    const exercise = (row[idx.ex] || "").trim();
    const date = (row[idx.date] || "").trim();
    if (!exercise || !date) continue;
    const weight = num(row[idx.w]);
    const reps = num(row[idx.r]);
    const rpe = idx.rpe >= 0 ? num(row[idx.rpe]) : 0;
    const dist = idx.dist >= 0 ? num(row[idx.dist]) : 0;
    const secs = idx.sec >= 0 ? num(row[idx.sec]) : 0;
    if (reps === 0 && weight === 0 && dist === 0 && secs === 0) continue;

    const wName = (row[idx.name] || "Workout").trim();
    const gk = `${date}|${wName}`;
    if (!groups[gk]) groups[gk] = { date, name: wName, exMap: {} };
    const g = groups[gk];
    if (!g.exMap[exercise]) g.exMap[exercise] = [];
    g.exMap[exercise].push({ weight, reps, rpe, done: true });
  }

  const workouts = Object.values(groups).map((g) => ({
    id: uid(),
    name: g.name,
    date: new Date(g.date).toISOString(),
    imported: true,
    gym: "main",
    exercises: Object.entries(g.exMap).map(([name, sets]) => ({ name, sets })),
  }));
  workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { workouts, unit, count: workouts.length, repaired };
}

/* --------------------------- exercise library ---------------------------- */
const LIB = [
  ["Barbell Bench Press", "Chest", "barbell"],
  ["Incline Bench Press", "Chest", "barbell"],
  ["Dumbbell Bench Press", "Chest", "dumbbell"],
  ["Push Up", "Chest", "bodyweight"],
  ["Squat", "Legs", "barbell"],
  ["Front Squat", "Legs", "barbell"],
  ["Leg Press", "Legs", "machine"],
  ["Romanian Deadlift", "Legs", "barbell"],
  ["Leg Curl", "Legs", "machine"],
  ["Leg Extension", "Legs", "machine"],
  ["Deadlift", "Back", "barbell"],
  ["Barbell Row", "Back", "barbell"],
  ["Pull Up", "Back", "bodyweight"],
  ["Lat Pulldown", "Back", "cable"],
  ["Seated Cable Row", "Back", "cable"],
  ["Overhead Press", "Shoulders", "barbell"],
  ["Dumbbell Shoulder Press", "Shoulders", "dumbbell"],
  ["Lateral Raise", "Shoulders", "dumbbell"],
  ["Face Pull", "Shoulders", "cable"],
  ["Bicep Curl", "Arms", "dumbbell"],
  ["Hammer Curl", "Arms", "dumbbell"],
  ["Tricep Pushdown", "Arms", "cable"],
  ["Tricep Extension", "Arms", "dumbbell"],
  ["Plank", "Core", "bodyweight"],
  ["Hanging Leg Raise", "Core", "bodyweight"],
].map(([name, group, type]) => ({ name, group, type }));

const DEFAULT_GYMS = [
  { id: "main", name: "Main Gym" },
  { id: "hoa", name: "HOA Gym" },
];
const DEFAULT_META = {
  gyms: DEFAULT_GYMS,
  activeGym: "main",
  routines: [],
  customExercises: [],
  settings: { unit: "lb", increment: 5, repLow: 8, repHigh: 12, restDefault: 120 },
};

// Starter routines: Main Gym = your real barbell split from imported history.
// HOA Gym = dumbbell/machine substitutes (a starting guess — edit to match its kit).
const STARTERS = {
  main: [
    { name: "Evening Upper Body", ex: ["Bench Press (Barbell)", "Shoulder Press (Plate Loaded)", "Lat Pulldown (Cable)", "High Row (Plated)", "Bicep Curl (Cable)"] },
    { name: "Leg Day", ex: ["Squat (Barbell)", "Leg Press", "Leg Extension (Machine)", "Seated Leg Curl (Machine)", "Seated Calf Raise (Plate Loaded)"] },
    { name: "Sunday Full Body", ex: ["Bench Press (Barbell)", "Squat (Barbell)", "Deadlift (Barbell)", "Leg Press", "Lat Pulldown (Machine)", "Seated Row (Machine)"] },
  ],
  hoa: [
    { name: "HOA Upper (edit me)", ex: ["Dumbbell Bench Press", "Dumbbell Shoulder Press", "Lat Pulldown", "Seated Cable Row", "Hammer Curl"] },
    { name: "HOA Lower (edit me)", ex: ["Goblet Squat", "Leg Press", "Leg Extension", "Leg Curl", "Romanian Deadlift"] },
  ],
};

/* ----------------------- progression / analytics ------------------------- */
function suggestTarget(workouts, name, settings) {
  const sessions = setsForExercise(workouts, name);
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  const working = last.sets;
  const { repLow, repHigh, increment } = settings;
  const allAtTop = working.every((s) => s.reps >= repHigh);
  const topWeight = Math.max(...working.map((s) => s.weight));
  const setCount = Math.max(working.length, 3);
  if (allAtTop) {
    return {
      sets: setCount,
      reps: repLow,
      weight: topWeight + increment,
      note: "Hit the top of your range last time — add weight.",
      beat: last.e1rm,
    };
  }
  // progress reps within range on the top set's weight
  const minReps = Math.min(...working.map((s) => s.reps));
  return {
    sets: setCount,
    reps: Math.min(minReps + 1, repHigh),
    weight: topWeight,
    note: "Add a rep toward the top of your range.",
    beat: last.e1rm,
  };
}

/* ------------------------------ UI atoms --------------------------------- */
const Stat = ({ label, value, unit, color = C.ink }) => (
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 11, color: C.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
      {value}
      {unit ? <span style={{ fontSize: 13, color: C.muted, marginLeft: 3 }}>{unit}</span> : null}
    </div>
  </div>
);

const Stepper = ({ value, onChange, step = 1, suffix }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <button
      onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}
      style={stepBtn}
      aria-label="decrease"
    >
      <Minus size={18} />
    </button>
    <div style={{ minWidth: 64, textAlign: "center", fontFamily: MONO, fontSize: 22, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
      {value}
      {suffix ? <span style={{ fontSize: 12, color: C.muted, marginLeft: 2 }}>{suffix}</span> : null}
    </div>
    <button onClick={() => onChange(+(value + step).toFixed(2))} style={stepBtn} aria-label="increase">
      <Plus size={18} />
    </button>
  </div>
);

const stepBtn = {
  width: 40, height: 40, borderRadius: 12, border: `1px solid ${C.line}`,
  background: C.surface2, color: C.ink, display: "flex", alignItems: "center",
  justifyContent: "center", cursor: "pointer",
};

const SettingRow = ({ label, hint, children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
    <div style={{ flex: 1 }}>
      <div style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>{label}</div>
      {hint && <div style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>{hint}</div>}
    </div>
    {children}
  </div>
);

/* ================================ APP ==================================== */
export default function App() {
  const [tab, setTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const loaded = useRef(false);

  // active session
  const [session, setSession] = useState(null); // {name, startedAt, exercises:[{id,name,sets:[{weight,reps,done}]}]}
  const [workoutScreen, setWorkoutScreen] = useState("list"); // "list" | "detail"
  const [exIdx, setExIdx] = useState(0);
  const [picker, setPicker] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // rest timer
  const [rest, setRest] = useState({ left: 0, total: 0, running: false });

  /* load */
  useEffect(() => {
    (async () => {
      const w = await loadKey("gym:workouts", []);
      const m = await loadKey("gym:meta", DEFAULT_META);
      setWorkouts(w);
      setMeta({ ...DEFAULT_META, ...m, settings: { ...DEFAULT_META.settings, ...(m.settings || {}) } });
      loaded.current = true;
      setLoading(false);
    })();
  }, []);
  useEffect(() => { if (loaded.current) saveKey("gym:workouts", workouts); }, [workouts]);
  useEffect(() => { if (loaded.current) saveKey("gym:meta", meta); }, [meta]);

  /* rest timer tick */
  useEffect(() => {
    if (!rest.running) return;
    const t = setInterval(() => {
      setRest((r) => {
        if (r.left <= 1) return { ...r, left: 0, running: false };
        return { ...r, left: r.left - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rest.running]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1600); };

  /* derived: full exercise catalog */
  const catalog = useMemo(() => {
    const map = new Map();
    LIB.forEach((e) => map.set(e.name, e));
    meta.customExercises.forEach((e) => map.set(e.name, e));
    workouts.forEach((w) => w.exercises.forEach((e) => {
      if (!map.has(e.name)) map.set(e.name, { name: e.name, group: "Other", type: "barbell" });
    }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts, meta.customExercises]);

  const settings = meta.settings;
  const U = settings.unit;
  const setSetting = (k, v) => setMeta((m) => ({ ...m, settings: { ...m.settings, [k]: v } }));
  const gymName = (id) => meta.gyms.find((g) => g.id === id)?.name || "Gym";
  const GymSwitch = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {meta.gyms.map((g) => (
        <button key={g.id} onClick={() => setMeta((m) => ({ ...m, activeGym: g.id }))}
          style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1px solid ${meta.activeGym === g.id ? C.amber : C.line}`, background: meta.activeGym === g.id ? C.amberDim : C.surface, color: meta.activeGym === g.id ? C.amber : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {g.name}
        </button>
      ))}
    </div>
  );
  const loadStarters = () => {
    const mk = (gymId) =>
      STARTERS[gymId].map((r) => ({
        id: uid(), gym: gymId, name: r.name,
        exercises: r.ex.map((n) => ({ name: n, sets: 3, reps: settings.repHigh, weight: 0 })),
      }));
    setMeta((m) => ({ ...m, routines: [...m.routines, ...mk("main"), ...mk("hoa")] }));
    flash("Starter routines added for both gyms.");
  };

  /* ----------------------------- actions --------------------------------- */
  const handleCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { workouts: imported, unit, count, repaired } = parseStrong(String(e.target.result));
      if (!count) { flash("No sets found in that file."); return; }
      // merge: keep existing, drop dup imported by date+name
      setWorkouts((prev) => {
        const keys = new Set(prev.map((w) => `${dayKey(w.date)}|${w.name}`));
        const fresh = imported.filter((w) => !keys.has(`${dayKey(w.date)}|${w.name}`));
        const all = [...prev, ...fresh].sort((a, b) => new Date(b.date) - new Date(a.date));
        return all;
      });
      setMeta((m) => ({ ...m, settings: { ...m.settings, unit } }));
      flash(repaired ? `Imported ${count} workouts · auto-fixed ${repaired} rows` : `Imported ${count} workouts (${unit}).`);
    };
    reader.readAsText(file);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ workouts, meta }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gym-backup-${dayKey(new Date().toISOString())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const d = JSON.parse(String(e.target.result));
        if (d.workouts) setWorkouts(d.workouts);
        if (d.meta) setMeta({ ...DEFAULT_META, ...d.meta });
        flash("Backup restored.");
      } catch { flash("Couldn't read that backup."); }
    };
    reader.readAsText(file);
  };

  // Import coach-generated routines (from the Gym Coach skill in Claude).
  // Expected: { type:"gymtracker-routines", routines:[{name,gym,exercises:[{name,sets,reps,weight}]}] }
  const importRoutines = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const d = JSON.parse(String(e.target.result));
        const incoming = Array.isArray(d) ? d : d.routines;
        if (!Array.isArray(incoming) || !incoming.length) { flash("No routines found in that file."); return; }
        const gymIds = new Set(meta.gyms.map((g) => g.id));
        const clean = incoming.map((r) => ({
          id: uid(),
          name: String(r.name || "Coach Routine"),
          gym: gymIds.has(r.gym) ? r.gym : "main",
          coach: true,
          exercises: (r.exercises || []).map((ex) => ({
            name: String(ex.name),
            sets: Number(ex.sets) || 3,
            reps: Number(ex.reps) || settings.repHigh,
            weight: Number(ex.weight) || 0,
          })),
        })).filter((r) => r.exercises.length);
        setMeta((m) => {
          const have = new Set(m.routines.map((r) => `${r.gym}|${r.name}`));
          const fresh = clean.filter((r) => !have.has(`${r.gym}|${r.name}`));
          return { ...m, routines: [...m.routines, ...fresh] };
        });
        flash(`Added ${clean.length} coach routine${clean.length > 1 ? "s" : ""}.`);
        setTab("routines");
      } catch { flash("Couldn't read that routines file."); }
    };
    reader.readAsText(file);
  };

  const startSession = (routine) => {
    const exercises = (routine?.exercises || []).map((re) => {
      const target = suggestTarget(workouts, re.name, settings);
      const n = re.sets || target?.sets || 3;
      const weight = re.weight || target?.weight || 0;
      const reps = re.reps || target?.reps || settings.repLow;
      return { id: uid(), name: re.name, sets: Array.from({ length: n }, () => ({ weight, reps, done: false })) };
    });
    setSession({ name: routine?.name || "Quick Session", startedAt: Date.now(), routine: !!routine, gym: routine?.gym || meta.activeGym, exercises });
    setWorkoutScreen("list");
    setExIdx(0);
    setTab("today");
  };

  // Auto-load last workout: clone the most recent session (preferring this gym),
  // with weights/reps advanced by the progression engine.
  const repeatLast = () => {
    const last = workouts.find((w) => (w.gym || "main") === meta.activeGym) || workouts[0];
    if (!last) { flash("No past workout to repeat yet."); return; }
    startSession({
      name: last.name,
      gym: last.gym || meta.activeGym,
      exercises: last.exercises.map((e) => ({ name: e.name, sets: e.sets.length })),
    });
  };

  const lastWorkout = useMemo(
    () => workouts.find((w) => (w.gym || "main") === meta.activeGym) || workouts[0] || null,
    [workouts, meta.activeGym]
  );

  const addExercise = (name) => {
    const target = suggestTarget(workouts, name, settings);
    const n = target?.sets || 3;
    const weight = target?.weight ?? 0;
    const reps = target?.reps ?? settings.repLow;
    setSession((s) => ({
      ...s,
      exercises: [...s.exercises, { id: uid(), name, sets: Array.from({ length: n }, () => ({ weight, reps, done: false })) }],
    }));
    setPicker(false);
    setPickerQ("");
  };

  const reorderExercises = (newExercises) =>
    setSession((s) => ({ ...s, exercises: newExercises }));

  const removeSetRow = (ei, si) =>
    setSession((s) => {
      const ex = s.exercises.map((e, i) => {
        if (i !== ei || e.sets.length <= 1) return e;
        return { ...e, sets: e.sets.filter((_, j) => j !== si) };
      });
      return { ...s, exercises: ex };
    });

  const updateSet = (ei, si, patch) =>
    setSession((s) => {
      const ex = s.exercises.map((e, i) =>
        i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j !== si ? st : { ...st, ...patch })) }
      );
      return { ...s, exercises: ex };
    });

  const completeSet = (ei, si) => {
    const set = session.exercises[ei].sets[si];
    updateSet(ei, si, { done: !set.done });
    if (!set.done) {
      setRest({ left: settings.restDefault, total: settings.restDefault, running: true });
    }
  };

  const removeExercise = (ei) =>
    setSession((s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== ei) }));

  const finishSession = () => {
    const exercises = session.exercises
      .map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.done && s.reps > 0) }))
      .filter((e) => e.sets.length);
    if (!exercises.length) { setSession(null); flash("Session discarded — no completed sets."); return; }
    const w = { id: uid(), name: session.name, date: new Date().toISOString(), gym: session.gym || meta.activeGym, exercises };
    setWorkouts((prev) => [w, ...prev]);
    setSession(null);
    setWorkoutScreen("list");
    setExIdx(0);
    setRest({ left: 0, total: 0, running: false });
    flash("Workout saved.");
    setTab("history");
  };

  const discardSession = () => {
    setSession(null);
    setWorkoutScreen("list");
    setExIdx(0);
    setRest({ left: 0, total: 0, running: false });
  };

  const saveAsRoutine = () => {
    const exercises = session.exercises.map((e) => ({
      name: e.name,
      sets: e.sets.length,
      reps: e.sets[0]?.reps || settings.repLow,
      weight: e.sets[0]?.weight || 0,
    }));
    const name = session.name === "Quick Session" ? `Routine ${meta.routines.length + 1}` : session.name;
    setMeta((m) => ({ ...m, routines: [...m.routines, { id: uid(), gym: session.gym || m.activeGym, name, exercises }] }));
    flash("Saved as routine.");
  };

  const deleteWorkout = (id) => setWorkouts((prev) => prev.filter((w) => w.id !== id));
  const deleteRoutine = (id) => setMeta((m) => ({ ...m, routines: m.routines.filter((r) => r.id !== id) }));

  /* ------------------------------ screens -------------------------------- */
  if (loading)
    return (
      <Shell>
        <div style={{ display: "grid", placeItems: "center", height: "70vh", color: C.muted }}>
          <Dumbbell size={28} />
        </div>
      </Shell>
    );

  return (
    <Shell>
      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", top: "calc(14px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: C.amber, color: C.onAccent, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, zIndex: 50, boxShadow: "0 6px 20px rgba(0,0,0,.4)" }}>
          {toast}
        </div>
      )}

      {/* rest timer bar */}
      {rest.running && (
        <div style={{ position: "fixed", bottom: "calc(70px + env(safe-area-inset-bottom))", left: 0, right: 0, maxWidth: 480, margin: "0 auto", padding: "0 16px", zIndex: 40 }}>
          <div style={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <Clock size={18} color={C.cyan} />
            <div style={{ fontFamily: MONO, fontSize: 20, color: C.ink, fontVariantNumeric: "tabular-nums", minWidth: 56 }}>
              {String(Math.floor(rest.left / 60)).padStart(1, "0")}:{String(rest.left % 60).padStart(2, "0")}
            </div>
            <div style={{ flex: 1, height: 4, background: C.line, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(rest.left / rest.total) * 100}%`, background: C.cyan }} />
            </div>
            <button onClick={() => setRest((r) => ({ ...r, left: r.left + 30 }))} style={miniBtn}>+30</button>
            <button onClick={() => setRest({ left: 0, total: 0, running: false })} style={miniBtn}>Skip</button>
          </div>
        </div>
      )}

      <div style={{ padding: `calc(16px + env(safe-area-inset-top)) 16px ${rest.running ? 160 : 92}px` }}>
        {tab === "today" &&
          (session ? (
            workoutScreen === "list" ? (
              <WorkoutListScreen
                session={session}
                workouts={workouts}
                catalog={catalog}
                onOpen={(ei) => { setExIdx(ei); setWorkoutScreen("detail"); }}
                onReorder={reorderExercises}
                onRemoveExercise={removeExercise}
                onAddExercise={() => setPicker(true)}
                onSaveAsRoutine={saveAsRoutine}
                onDiscard={discardSession}
              />
            ) : (
              <WorkoutDetailScreen
                session={session}
                workouts={workouts}
                exIdx={exIdx}
                catalog={catalog}
                onUpdateSet={updateSet}
                onToggleSet={completeSet}
                onRemoveSet={removeSetRow}
                onBack={() => setWorkoutScreen("list")}
                onJump={setExIdx}
                onFinish={finishSession}
              />
            )
          ) : (
            <TodayHome />
          ))}
        {tab === "history" && <HistoryScreen />}
        {tab === "progress" && <ProgressScreen />}
        {tab === "routines" && <RoutinesScreen />}
      </div>

      {/* exercise picker */}
      {picker && (
        <Sheet onClose={() => setPicker(false)} title="Add exercise">
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
            <Search size={16} color={C.muted} />
            <input
              autoFocus
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="Search or type a new name"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.ink, fontSize: 15 }}
            />
          </div>
          <div style={{ maxHeight: "48vh", overflowY: "auto" }}>
            {catalog
              .filter((e) => e.name.toLowerCase().includes(pickerQ.toLowerCase()))
              .map((e) => (
                <button key={e.name} onClick={() => addExercise(e.name)} style={rowBtn}>
                  <div>
                    <div style={{ color: C.ink, fontSize: 15 }}>{e.name}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{e.group} · {e.type}</div>
                  </div>
                  <Plus size={18} color={C.amber} />
                </button>
              ))}
            {pickerQ && !catalog.some((e) => e.name.toLowerCase() === pickerQ.toLowerCase()) && (
              <button
                onClick={() => {
                  setMeta((m) => ({ ...m, customExercises: [...m.customExercises, { name: pickerQ, group: "Other", type: "barbell" }] }));
                  addExercise(pickerQ);
                }}
                style={{ ...rowBtn, color: C.amber }}
              >
                <span>Create “{pickerQ}”</span>
                <Plus size={18} color={C.amber} />
              </button>
            )}
          </div>
        </Sheet>
      )}

      {/* settings */}
      {showSettings && (
        <Sheet onClose={() => setShowSettings(false)} title="Settings">
          <SettingRow label="Weight increment" hint="Step size for the +/- buttons">
            <Stepper value={settings.increment} step={2.5} suffix={U} onChange={(v) => setSetting("increment", v || 2.5)} />
          </SettingRow>
          <SettingRow label="Rest timer" hint="Auto-starts when you complete a set">
            <Stepper value={settings.restDefault} step={15} suffix="s" onChange={(v) => setSetting("restDefault", v || 15)} />
          </SettingRow>
          <SettingRow label="Rep range — low" hint="Bottom of your target range">
            <Stepper value={settings.repLow} step={1} onChange={(v) => setSetting("repLow", v || 1)} />
          </SettingRow>
          <SettingRow label="Rep range — high" hint="Add weight once every set hits this">
            <Stepper value={settings.repHigh} step={1} onChange={(v) => setSetting("repHigh", v || settings.repLow + 1)} />
          </SettingRow>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {[["lb", "Pounds"], ["kg", "Kilograms"]].map(([u, lbl]) => (
              <button key={u} onClick={() => setSetting("unit", u)} style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${settings.unit === u ? C.amber : C.line}`, background: settings.unit === u ? C.amberDim : C.surface, color: settings.unit === u ? C.amber : C.muted }}>
                {lbl}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* bottom nav */}
      <nav style={navWrap}>
        {[
          ["today", "Today", Dumbbell],
          ["history", "History", HistoryIcon],
          ["progress", "Progress", TrendingUp],
          ["routines", "Routines", ListChecks],
        ].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} style={navBtn(tab === id)}>
            <Icon size={20} />
            <span style={{ fontSize: 10, marginTop: 2 }}>{label}</span>
          </button>
        ))}
      </nav>
    </Shell>
  );

  /* --------------------------- screen renderers -------------------------- */
  function TodayHome() {
    const rs = meta.routines.filter((r) => (r.gym || "main") === meta.activeGym);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Header title="Today" sub={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
          <button onClick={() => setShowSettings(true)} style={{ ...miniBtn, padding: "8px" }} aria-label="settings"><SettingsIcon size={16} /></button>
        </div>

        <GymSwitch />

        {/* Repeat last — auto-loads the most recent session here, progressed */}
        {lastWorkout && (
          <button onClick={repeatLast} style={primaryBtn}>
            <RotateCcw size={18} /> Repeat last: {lastWorkout.name}
          </button>
        )}

        {/* One-tap routine selection */}
        {rs.length > 0 && (
          <>
            <SubLabel>{gymName(meta.activeGym)} routines</SubLabel>
            {rs.map((r) => (
              <button key={r.id} onClick={() => startSession(r)} style={card}>
                <div>
                  <div style={{ color: C.ink, fontSize: 15, fontWeight: 600 }}>
                    {r.name}
                    {r.coach && <span style={{ fontSize: 9, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 6, padding: "1px 5px", marginLeft: 6, verticalAlign: 2 }}>coach</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{r.exercises.map((e) => e.name).join(" · ")}</div>
                </div>
                <Play size={18} color={C.amber} />
              </button>
            ))}
          </>
        )}

        <button onClick={() => startSession(null)} style={{ ...ghostBtn, width: "100%", justifyContent: "center", marginTop: 6 }}>
          <Plus size={16} /> Start empty workout
        </button>

        {workouts.length === 0 && (
          <div style={emptyBox}>
            <Upload size={22} color={C.muted} />
            <div style={{ color: C.ink, marginTop: 8, fontWeight: 600 }}>No history yet</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
              Import your Strong export to unlock progress charts and auto progressions.
            </div>
            <FileButton label="Import Strong CSV" accept=".csv,text/csv" onFile={handleCSV} style={{ marginTop: 12 }} />
          </div>
        )}

        <SubLabel>Data &amp; coach</SubLabel>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <FileButton label="Import Strong CSV" accept=".csv,text/csv" onFile={handleCSV} />
          <FileButton label="Add coach routines" accept=".json" onFile={importRoutines} icon={Sparkles} />
          <button onClick={exportJSON} style={ghostBtn}><Download size={16} /> Backup / share with coach</button>
          <FileButton label="Restore" accept=".json" onFile={importJSON} icon={Upload} />
        </div>
        <div style={{ color: C.muted, fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          Tip: tap <b>Backup</b> to hand your history to the Gym Coach in Claude, then drop the routines it sends back in via <b>Add coach routines</b>.
        </div>
      </div>
    );
  }

  function HistoryScreen() {
    return (
      <div>
        <Header title="History" sub={`${workouts.length} workouts`} />
        {workouts.length === 0 && <div style={emptyBox}><div style={{ color: C.muted }}>Nothing logged yet. Start a workout or import your Strong history.</div></div>}
        {workouts.map((w) => {
          const totalSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
          const vol = w.exercises.reduce((a, e) => a + e.sets.reduce((x, s) => x + s.weight * s.reps, 0), 0);
          return (
            <div key={w.id} style={{ ...cardStatic, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: C.ink, fontSize: 15, fontWeight: 600 }}>
                    {w.name} {w.imported && <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 6, padding: "1px 5px", marginLeft: 4 }}>imported</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{fmtDate(w.date)}{w.gym ? ` · ${gymName(w.gym)}` : ""}</div>
                </div>
                <button onClick={() => deleteWorkout(w.id)} style={miniBtn}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <Stat label="Exercises" value={w.exercises.length} />
                <Stat label="Sets" value={totalSets} />
                <Stat label="Volume" value={Math.round(vol).toLocaleString()} unit={U} color={C.cyan} />
              </div>
              <div style={{ marginTop: 8, color: C.muted, fontSize: 12 }}>
                {w.exercises.map((e) => e.name).join(" · ")}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function ProgressScreen() {
    const names = useMemo(() => {
      const counts = {};
      workouts.forEach((w) => w.exercises.forEach((e) => (counts[e.name] = (counts[e.name] || 0) + 1)));
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    }, [workouts]);
    const [sel, setSel] = useState(names[0] || "");
    const current = sel || names[0] || "";
    const sessions = current ? setsForExercise(workouts, current) : [];
    const data = sessions.map((s) => ({ d: fmtShort(s.date), e1rm: Math.round(s.e1rm), top: Math.max(...s.sets.map((x) => x.weight)) }));
    const bestE = sessions.length ? Math.max(...sessions.map((s) => s.e1rm)) : 0;
    const bestW = sessions.length ? Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.weight))) : 0;
    const maxR = sessions.length ? Math.max(...sessions.flatMap((s) => s.sets.map((x) => x.reps))) : 0;
    const target = current ? suggestTarget(workouts, current, settings) : null;

    if (!names.length)
      return (
        <div>
          <Header title="Progress" />
          <div style={emptyBox}><div style={{ color: C.muted }}>Log or import workouts to see your strength curve.</div></div>
        </div>
      );

    return (
      <div>
        <Header title="Progress" />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
          {names.map((n) => (
            <button key={n} onClick={() => setSel(n)} style={{ whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 999, border: `1px solid ${current === n ? C.amber : C.line}`, background: current === n ? C.amberDim : C.surface, color: current === n ? C.amber : C.muted, fontSize: 13, cursor: "pointer" }}>
              {n}
            </button>
          ))}
        </div>

        <div style={{ ...cardStatic, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <Stat label="Best e1RM" value={Math.round(bestE)} unit={U} color={C.amber} />
            <Stat label="Top weight" value={bestW} unit={U} />
            <Stat label="Max reps" value={maxR} color={C.cyan} />
          </div>
          {target && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: C.cyanDim, borderRadius: 10, color: C.cyan, fontSize: 13 }}>
              <Flame size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Next: <b>{target.sets}×{target.reps} @ {target.weight}{U}</b> — {target.note}
            </div>
          )}
        </div>

        {data.length > 1 ? (
          <div style={{ ...cardStatic, height: 240 }}>
            <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Estimated 1RM over time</div>
            <ResponsiveContainer width="100%" height="86%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="d" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: C.line }} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink }} labelStyle={{ color: C.muted }} />
                <Line type="monotone" dataKey="e1rm" stroke={C.amber} strokeWidth={2.5} dot={{ r: 2, fill: C.amber }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={emptyBox}><div style={{ color: C.muted }}>Need at least two sessions of {current} to chart a trend.</div></div>
        )}
      </div>
    );
  }

  function RoutinesScreen() {
    const RoutineCard = (r) => (
      <div key={r.id} style={{ ...cardStatic, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: C.ink, fontSize: 15, fontWeight: 600 }}>{r.name}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => startSession(r)} style={{ ...miniBtn, color: C.amber, borderColor: C.amber }}><Play size={14} /></button>
            <button onClick={() => deleteRoutine(r.id)} style={miniBtn}><Trash2 size={14} /></button>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          {r.exercises.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: C.muted, fontSize: 13 }}>
              <span style={{ color: C.ink }}>{e.name}</span>
              <span style={{ fontFamily: MONO }}>{e.sets}×{e.reps}</span>
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <div>
        <Header title="Routines" sub={`${meta.routines.length} saved`} />
        {meta.routines.length === 0 && (
          <div style={emptyBox}>
            <div style={{ color: C.ink, fontWeight: 600 }}>No routines yet</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Load starters built from your history, or finish any workout and tap “Save as routine.”</div>
            <button onClick={loadStarters} style={{ ...primaryBtn, marginTop: 14 }}>Load starter routines (Main + HOA)</button>
          </div>
        )}
        {meta.gyms.map((g) => {
          const rs = meta.routines.filter((r) => (r.gym || "main") === g.id);
          if (!rs.length) return null;
          return (
            <div key={g.id}>
              <SubLabel>{g.name}</SubLabel>
              {rs.map(RoutineCard)}
            </div>
          );
        })}
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
          To edit a routine: start it, adjust exercises in the session, then “Save as routine.”
        </div>
      </div>
    );
  }
}

/* ------------------------------ shells/atoms ----------------------------- */
function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>{children}</div>
    </div>
  );
}
const Header = ({ title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{title}</div>
    {sub && <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{sub}</div>}
  </div>
);
const SubLabel = ({ children }) => (
  <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 8px" }}>{children}</div>
);
function Sheet({ children, onClose, title }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: `1px solid ${C.line}`, padding: 16, maxHeight: "80vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={miniBtn}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function FileButton({ label, accept, onFile, icon: Icon = Upload, style }) {
  const ref = useRef();
  return (
    <>
      <button onClick={() => ref.current.click()} style={{ ...ghostBtn, ...style }}>
        <Icon size={16} /> {label}
      </button>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
    </>
  );
}

/* styles */
const primaryBtn = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.amber, color: C.onAccent, border: "none", borderRadius: 16, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", margin: "4px 0", boxShadow: "0 2px 8px rgba(37,99,235,.22)" };
const ghostBtn = { display: "flex", alignItems: "center", gap: 6, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, cursor: "pointer" };
const card = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px", marginBottom: 10, cursor: "pointer", textAlign: "left", boxShadow: C.shadow };
const cardStatic = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px", boxShadow: C.shadow };
const rowBtn = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`, padding: "12px 2px", cursor: "pointer", textAlign: "left" };
const miniBtn = { background: C.surface2, border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: "6px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 };
const emptyBox = { ...cardStatic, textAlign: "center", padding: "28px 18px", marginTop: 12 };
const navWrap = { position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", background: C.surface, borderTop: `1px solid ${C.line}`, display: "flex", padding: "8px 0 calc(12px + env(safe-area-inset-bottom))", zIndex: 30, boxShadow: "0 -2px 12px rgba(20,22,30,.05)" };
const navBtn = (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "transparent", border: "none", color: active ? C.amber : C.muted, cursor: "pointer", padding: "4px 0" });
