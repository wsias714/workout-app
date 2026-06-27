import React, { useMemo, useState } from "react";
import { Search, X, GripVertical, ChevronRight, Plus, Check } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { C, MONO } from "../lib/theme";
import { setsForExercise } from "../lib/helpers";
import SwipeableRow from "./SwipeableRow";

function lastSummary(workouts, name) {
  const sessions = setsForExercise(workouts, name);
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  const setsStr = last.sets.map((s) => `${s.weight}×${s.reps}`).join(" / ");
  return { date: last.date, setsStr, e1rm: Math.round(last.e1rm) };
}

function ExerciseCard({ ex, ei, group, workouts, onOpen, onRemove }) {
  const doneCt = ex.sets.filter((s) => s.done).length;
  const isDone = ex.sets.length > 0 && doneCt === ex.sets.length;
  const isActive = doneCt > 0 && !isDone;
  const accent = isDone ? C.good : isActive ? C.amber : C.line;
  const summary = lastSummary(workouts, ex.name);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SwipeableRow deleteLabel="Remove" onDelete={() => onRemove(ei)} radius={14}>
        <div
          onClick={() => onOpen(ei)}
          style={{
            background: C.surface, borderRadius: 14, boxShadow: C.shadow,
            display: "flex", alignItems: "stretch", overflow: "hidden", cursor: "pointer",
            borderLeft: `3px solid ${accent}`,
          }}
        >
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "0 10px", display: "flex", alignItems: "center", cursor: "grab",
              color: C.muted, flexShrink: 0, background: "transparent", border: "none", touchAction: "none",
            }}
            aria-label="reorder"
          >
            <GripVertical size={18} />
          </button>
          <div style={{ flex: 1, padding: "13px 0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.015em" }}>{ex.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em",
                background: isDone ? "#F0FDF4" : isActive ? C.amberDim : C.surface2, padding: "2px 6px", borderRadius: 4,
              }}>
                {isDone ? "Done" : isActive ? `${doneCt}/${ex.sets.length} sets` : (group?.group || "Other")}
              </span>
              {!isDone && !isActive && <span style={{ fontSize: 10, color: C.muted }}>{ex.sets.length} sets</span>}
            </div>
            {summary && (
              <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }}>
                {Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(summary.date))} · {summary.setsStr}
              </div>
            )}
          </div>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 2, flexShrink: 0 }}>
            {summary && (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO, color: isDone ? C.good : C.amber }}>{summary.e1rm}</div>
                <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>1RM</div>
              </>
            )}
            {isDone ? <Check size={14} color={C.good} style={{ marginTop: 4 }} /> : <ChevronRight size={14} color={C.muted} style={{ marginTop: 4 }} />}
          </div>
        </div>
      </SwipeableRow>
    </div>
  );
}

export default function WorkoutListScreen({ session, workouts, catalog, onOpen, onReorder, onRemoveExercise, onAddExercise, onSaveAsRoutine, onDiscard }) {
  const [search, setSearch] = useState("");

  const groupByName = useMemo(() => {
    const m = new Map();
    catalog.forEach((c) => m.set(c.name, c));
    return m;
  }, [catalog]);

  const query = search.toLowerCase().trim();
  const visible = query
    ? session.exercises.filter((ex) => {
        const group = (groupByName.get(ex.name)?.group || "").toLowerCase();
        return ex.name.toLowerCase().includes(query) || group.includes(query);
      })
    : session.exercises;

  const totalSets = session.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const doneSets = session.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.done).length, 0);
  const completedEx = session.exercises.filter((ex) => ex.sets.length > 0 && ex.sets.every((s) => s.done)).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = session.exercises.findIndex((e) => e.id === active.id);
    const newIndex = session.exercises.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(session.exercises, oldIndex, newIndex));
  };

  const ctaLabel = doneSets === 0 ? "Start Workout →" : doneSets < totalSets ? "Resume Workout →" : "Review & Finish ✓";
  const startCta = () => {
    const firstIncomplete = session.exercises.findIndex((ex) => ex.sets.some((s) => !s.done));
    onOpen(firstIncomplete >= 0 ? firstIncomplete : 0);
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em" }}>{session.name}</div>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{doneSets} / {totalSets} sets</span>
            <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>{completedEx}/{session.exercises.length} exercises</span>
          </div>
          <div style={{ height: 4, background: C.line, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`,
              background: doneSets === totalSets && totalSets > 0 ? C.good : C.amber,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface2, borderRadius: 11, padding: "9px 12px", border: `1.5px solid ${search ? C.amber : C.line}`, transition: "border-color 0.2s", marginBottom: 12 }}>
        <Search size={14} color={C.muted} style={{ flexShrink: 0 }} />
        <input
          type="text" placeholder="Search exercises…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, color: C.ink }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0, display: "flex" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 14 }}>No exercises match "{search}"</div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={session.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((ex) => {
              const ei = session.exercises.indexOf(ex);
              return (
                <ExerciseCard
                  key={ex.id} ex={ex} ei={ei} group={groupByName.get(ex.name)} workouts={workouts}
                  onOpen={onOpen} onRemove={onRemoveExercise}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <button onClick={onAddExercise} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: C.surface, color: C.amber, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: "13px", marginTop: 12, cursor: "pointer", fontSize: 14, fontWeight: 600,
      }}>
        <Plus size={16} /> Add exercise
      </button>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button onClick={onSaveAsRoutine} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, cursor: "pointer",
        }}>
          Save as routine
        </button>
        <button onClick={onDiscard} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          background: C.surface, color: C.bad, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, cursor: "pointer",
        }}>
          Discard
        </button>
      </div>

      <div style={{ position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom))", left: 0, right: 0, maxWidth: 480, margin: "0 auto", padding: "0 16px", zIndex: 35 }}>
        <button
          onClick={startCta}
          style={{
            width: "100%", padding: "14px", border: "none", borderRadius: 13, fontSize: 15, fontWeight: 800,
            cursor: "pointer", letterSpacing: "-0.01em", color: "#fff",
            background: doneSets === 0 ? C.ink : doneSets < totalSets ? C.amber : C.good,
            boxShadow: "0 6px 20px rgba(0,0,0,.18)",
          }}
        >
          {ctaLabel}
        </button>
      </div>
      <div style={{ height: 64 }} />
    </div>
  );
}
