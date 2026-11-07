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

export default function CoachScreen({ workouts, activity, onExport, review, asked = [], onAsk }) {
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
        <AskCoach review={review} asked={asked} onAsk={onAsk} />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <WeeklyReview review={review} />
      <AskCoach review={review} asked={asked} onAsk={onAsk} />

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

const WeeklyReview = ({ review }) => {
  if (!review) return null;
  const when = new Date(review.generatedAt || review.week + "T12:00:00");
  return (
    <div style={{ ...card, marginBottom: 12, borderLeft: `3px solid ${C.amber}` }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
        Weekly coach review{isNaN(when) ? "" : ` · ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: "6px 0 6px" }}>{review.headline}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: C.ink }}>
        {review.points.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
      {review.focus && (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: C.ink, marginTop: 8 }}><b>Next week:</b> {review.focus}</div>
      )}
      {review.plan?.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Plan for next week</div>
          {review.plan.map((p, i) => (
            <div key={i} style={{ fontSize: 13, lineHeight: 1.5, color: C.ink, marginBottom: 6 }}>
              <b>{p.focus}</b>{p.why ? <span style={{ color: C.muted }}> — {p.why}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AskCoach = ({ review, asked, onAsk }) => {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const answers = review?.answers || [];
  const waiting = asked.filter((x) => !answers.some((a) => a.id === x.id));
  const submit = () => {
    if (onAsk && onAsk(text)) {
      setText("");
      setNote("Saved. The coach answers in the next weekly review.");
    }
  };
  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Ask coach</div>
      <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 8px" }}>
        Form, aches, programming. For example: "Modest discomfort in my left wrist on bench press. What is the best way to address it?"
        Questions are answered once a week, in the Friday review.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setNote(""); }}
        maxLength={500}
        rows={3}
        placeholder="Type your question"
        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "inherit", color: C.ink, background: C.surface, resize: "vertical" }}
      />
      <button onClick={submit} disabled={!text.trim()} style={{ ...exportBtn, marginTop: 8, opacity: text.trim() ? 1 : 0.5 }}>Send to coach</button>
      {note && <div style={{ color: C.good, fontSize: 12.5, marginTop: 6 }}>{note}</div>}
      {waiting.map((x) => (
        <div key={x.id} style={{ marginTop: 10, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
          <b>You asked:</b> {x.q}
          <div style={{ color: C.muted, fontSize: 12 }}>{x.sent ? "Waiting for the next weekly review" : "Will send when you're online"}</div>
        </div>
      ))}
      {answers.map((a) => (
        <div key={a.id} style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}`, fontSize: 13, lineHeight: 1.55, color: C.ink }}>
          <div style={{ color: C.muted }}><b>You asked:</b> {a.q}</div>
          <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}><b>Coach:</b> {a.a}</div>
        </div>
      ))}
    </div>
  );
};

const Header = () => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: C.ink }}>Coach</div>
    <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Automatic checkup on your training</div>
  </div>
);

const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px", boxShadow: C.shadow };
const emptyBox = { ...card, textAlign: "center", padding: "28px 18px", marginTop: 12, marginBottom: 12 };
const exportBtn = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: C.amberDim, color: C.amber, border: "none", borderRadius: 12, padding: "12px",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};
