import React, { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { C } from "../lib/theme";
import { analyzeCoach, muscleBenchmarks } from "../lib/coach";
import BodyMap from "./BodyMap";

const LEVELS = {
  warn: { border: C.pr, bg: "#FEF6E7", label: "Fix", labelColor: C.pr },
  good: { border: C.good, bg: "#F0FDF4", label: "On track", labelColor: C.good },
  info: { border: C.line, bg: C.surface, label: "Note", labelColor: C.muted },
};

export default function CoachScreen({ workouts, activity, onExport }) {
  const insights = useMemo(() => analyzeCoach(workouts, activity), [workouts, activity]);
  const benchmarks = useMemo(() => muscleBenchmarks(workouts), [workouts]);
  const [selected, setSelected] = useState(null);

  const selectMuscle = (group) => {
    setSelected(group);
    document.getElementById(`muscle-${group}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (workouts.length < 4) {
    return (
      <div>
        <Header />
        <div style={emptyBox}>
          <Upload size={22} color={C.muted} />
          <div style={{ color: C.ink, marginTop: 8, fontWeight: 600 }}>Not enough data yet</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            Log at least 4 workouts (or import your Strong CSV from the Today tab) so the Coach has something to analyze.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
          Progress toward benchmark lifts
        </div>
        <BodyMap benchmarks={benchmarks} selected={selected} onSelect={selectMuscle} />
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 6, fontSize: 10, color: C.muted }}>
          <span><span style={{ color: C.bad }}>●</span> Low in personal range</span>
          <span><span style={{ color: C.pr }}>●</span> Mid</span>
          <span><span style={{ color: C.good }}>●</span> Near a PR</span>
        </div>
        <div style={{ color: C.muted, fontSize: 11.5, textAlign: "center", marginTop: 6 }}>
          Tap a muscle to jump to its note below. Color = where your latest e1RM sits vs. your own history — not a population comparison.
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Evidence-based analysis
        </div>
        <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 0" }}>
          Computed from your logged sets — progressive-overload trend on the big lifts, push/pull balance,
          and weekly volume landmarks. Updates automatically as you log more.
        </p>
      </div>

      {insights.map((ins, i) => {
        const lv = LEVELS[ins.lvl] || LEVELS.info;
        const isSelected = ins.key === `muscle-${selected}`;
        return (
          <div
            key={i}
            id={ins.key}
            style={{
              ...card, background: lv.bg, borderLeft: `3px solid ${lv.border}`, marginBottom: 10,
              boxShadow: isSelected ? `0 0 0 2px ${C.ink}` : C.shadow, transition: "box-shadow 0.3s",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: ins.name ? 4 : 0 }}>
              {ins.name && <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{ins.name}</span>}
              <span style={{ fontSize: 9.5, fontWeight: 800, color: lv.labelColor, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {lv.label}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.ink }}>{ins.text}</div>
          </div>
        );
      })}

      <div style={{ ...card, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Want a full periodized program?
        </div>
        <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.5, margin: "8px 0 12px" }}>
          This tab flags patterns automatically, but a real program (season periodization, grip/wrist
          progressions, deload timing) needs a full review. Export your backup, share it with the Gym
          Coach in Claude, then re-import the routines it sends back via <b>Add coach routines</b> on Today.
        </p>
        <button onClick={onExport} style={exportBtn}>
          <Download size={16} /> Export backup for full review
        </button>
      </div>
    </div>
  );
}

const Header = () => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: C.ink }}>Coach</div>
    <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Automatic checkup on your training</div>
  </div>
);

const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px", boxShadow: C.shadow };
const emptyBox = { ...card, textAlign: "center", padding: "28px 18px", marginTop: 12 };
const exportBtn = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: C.amberDim, color: C.amber, border: "none", borderRadius: 12, padding: "12px",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};
