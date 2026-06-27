import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, Check, Trophy } from "lucide-react";
import { C, MONO } from "../lib/theme";
import { epley, setsForExercise } from "../lib/helpers";
import SwipeableRow from "./SwipeableRow";
import HistoryPanel from "./HistoryPanel";

const inputBase = {
  textAlign: "center", fontSize: 22, fontWeight: 700, fontFamily: MONO, borderRadius: 10,
  padding: "9px 4px", outline: "none", width: "100%", boxSizing: "border-box",
};

function SetRow({ ex, ei, si, isLast, canDelete, maxHistE1rm, onUpdate, onToggle, onDelete }) {
  const st = ex.sets[si];
  const isPR = !st.done && maxHistE1rm > 0 && epley(st.weight, st.reps) > maxHistE1rm;

  return (
    <SwipeableRow onDelete={() => canDelete && onDelete(ei, si)} deleteLabel="Delete" disabled={!canDelete}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, padding: "2px 0" }}>
        <div style={{ width: 28, textAlign: "center", fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: MONO, letterSpacing: "0.04em", flexShrink: 0, opacity: st.done ? 0.45 : 1, transition: "opacity 0.25s" }}>S{si + 1}</div>
        <input
          type="number" value={st.weight || ""} onChange={(e) => onUpdate(ei, si, { weight: +e.target.value || 0 })}
          style={{ ...inputBase, flex: 1, color: st.done ? C.muted : C.ink, background: st.done ? C.surface2 : C.bg, border: `1.5px solid ${st.done ? C.line : C.amberDim}` }}
        />
        <span style={{ color: C.muted, fontSize: 15, flexShrink: 0, fontFamily: MONO, opacity: st.done ? 0.45 : 1, transition: "opacity 0.25s" }}>×</span>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="number" value={st.reps || ""} onChange={(e) => onUpdate(ei, si, { reps: +e.target.value || 0 })}
            style={{
              ...inputBase, color: st.done ? C.muted : isLast ? C.pr : C.ink,
              background: st.done ? C.surface2 : isLast ? "#FFFBEB" : C.bg,
              border: `1.5px solid ${st.done ? C.line : isLast ? "#FCD34D" : C.amberDim}`,
            }}
          />
          {isLast && !st.done && (
            <div style={{ position: "absolute", bottom: -13, left: 0, right: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: C.pr, letterSpacing: "0.06em", textTransform: "uppercase" }}>+1 Target</div>
          )}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {isPR && <div style={{ position: "absolute", inset: -4, borderRadius: 14, pointerEvents: "none", animation: "prPulse 1.6s ease-in-out infinite" }} />}
          <button
            onClick={() => onToggle(ei, si)}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
              background: st.done ? C.good : isPR ? C.ink : C.amber, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", position: "relative",
            }}
          >
            {isPR && !st.done ? <Trophy size={15} strokeWidth={2} /> : <Check size={15} strokeWidth={2.5} />}
          </button>
          {isPR && (
            <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 8, fontWeight: 800, color: C.pr, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
              🏆 PR
            </div>
          )}
        </div>
      </div>
    </SwipeableRow>
  );
}

export default function WorkoutDetailScreen({
  session, workouts, exIdx, catalog, onUpdateSet, onToggleSet, onRemoveSet, onBack, onJump, onFinish,
}) {
  const ex = session.exercises[exIdx];
  const ei = exIdx;
  const lastIdx = ex.sets.length - 1;
  const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done);
  const isLastExercise = exIdx === session.exercises.length - 1;
  const group = catalog.find((c) => c.name === ex.name)?.group || "Other";

  const maxHistE1rm = useMemo(() => {
    const sessions = setsForExercise(workouts, ex.name);
    return sessions.length ? Math.max(...sessions.map((s) => s.e1rm)) : 0;
  }, [workouts, ex.name]);

  const historySessions = useMemo(() => setsForExercise(workouts, ex.name), [workouts, ex.name]);

  const goPrev = () => exIdx > 0 && onJump(exIdx - 1);
  const goNext = () => {
    if (isLastExercise) return;
    onJump(exIdx + 1);
  };
  const handleCta = () => {
    if (!allDone) return;
    if (isLastExercise) onFinish();
    else goNext();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 92px)" }}>
      <style>{`
        @keyframes prPulse {
          0%,100% { box-shadow: 0 0 0 2.5px #F59E0B, 0 0 10px rgba(245,158,11,0.3); }
          50%      { box-shadow: 0 0 0 4px   #F59E0B, 0 0 20px rgba(245,158,11,0.55); }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: C.surface2, border: "none", borderRadius: 9, padding: "7px 9px", cursor: "pointer", color: C.ink, display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={15} /><span style={{ fontSize: 12, fontWeight: 600 }}>List</span>
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.name}
        </div>
        <div style={{ fontSize: 12, fontFamily: MONO, color: C.muted, fontWeight: 600, background: C.surface2, padding: "6px 10px", borderRadius: 8 }}>
          {exIdx + 1}/{session.exercises.length}
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 16, padding: "14px 16px 12px", boxShadow: C.shadow }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={goPrev} disabled={exIdx === 0} style={{ background: "none", border: "none", cursor: exIdx === 0 ? "default" : "pointer", opacity: exIdx === 0 ? 0.2 : 1, color: C.amber, padding: 4 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 2 }}>{group}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.ink, letterSpacing: "-0.025em", lineHeight: 1.2 }}>{ex.name}</div>
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 8 }}>
              {session.exercises.map((_, i) => (
                <div
                  key={i} onClick={() => onJump(i)}
                  style={{ cursor: "pointer", width: i === exIdx ? 20 : 6, height: 6, borderRadius: 3, background: i < exIdx ? C.good : i === exIdx ? C.amber : C.line, transition: "all 0.25s" }}
                />
              ))}
            </div>
          </div>
          <button onClick={goNext} disabled={isLastExercise} style={{ background: "none", border: "none", cursor: isLastExercise ? "default" : "pointer", opacity: isLastExercise ? 0.2 : 1, color: C.amber, padding: 4 }}>
            <ChevronRight size={22} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, paddingLeft: 36, marginBottom: 6 }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Weight (lbs)</div>
          <div style={{ width: 16 }} />
          <div style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Reps</div>
          <div style={{ width: 46 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ex.sets.map((_, si) => (
            <SetRow
              key={si} ex={ex} ei={ei} si={si} isLast={si === lastIdx} canDelete={ex.sets.length > 1}
              maxHistE1rm={maxHistE1rm} onUpdate={onUpdateSet} onToggle={onToggleSet} onDelete={onRemoveSet}
            />
          ))}
        </div>

        <button
          onClick={handleCta}
          style={{
            marginTop: 16, width: "100%", padding: "13px", color: "#fff", border: "none", borderRadius: 13,
            fontSize: 15, fontWeight: 800, cursor: allDone ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background 0.3s", letterSpacing: "-0.01em", opacity: allDone ? 1 : 0.7,
            background: allDone ? C.good : C.amber,
          }}
        >
          {allDone && <Check size={15} strokeWidth={2.5} />}
          {allDone ? (isLastExercise ? "Finish Workout ✓" : "Done · Next Exercise →") : "Check off sets above"}
        </button>
      </div>

      <div style={{ height: 1, background: C.line, margin: "12px 0" }} />
      <HistoryPanel sessions={historySessions} />
    </div>
  );
}
