import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, ReferenceLine, ReferenceArea } from "recharts";
import { C, MONO } from "../lib/theme";
import { epley, fmtShort, personalPercentile } from "../lib/helpers";

function HistoryRow({ session, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const setsStr = session.sets.map((s) => `${s.weight}×${s.reps}`).join(" / ");

  return (
    <div style={{ borderBottom: !isLast ? `1px solid ${C.line}` : "none" }}>
      <div onClick={() => setExpanded((p) => !p)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: MONO, width: 42, flexShrink: 0 }}>{fmtShort(session.date)}</span>
        <span style={{ fontSize: 11, fontFamily: MONO, flex: 1, color: isFirst ? C.ink : C.muted, fontWeight: isFirst ? 600 : 400 }}>{setsStr}</span>
        <span style={{ fontSize: 11, fontFamily: MONO, color: C.amber, flexShrink: 0, fontWeight: 600 }}>{Math.round(session.e1rm)}</span>
        <span style={{ color: C.muted, flexShrink: 0, marginLeft: 4 }}>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>
      {expanded && (
        <div style={{ paddingBottom: 8, paddingLeft: 50, display: "flex", flexDirection: "column", gap: 4 }}>
          {session.sets.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: MONO, width: 20 }}>S{i + 1}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: C.ink }}>{s.weight}</span>
                <span style={{ fontSize: 10, color: C.muted }}>lbs</span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: MONO, margin: "0 2px" }}>×</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: C.amber }}>{s.reps}</span>
                <span style={{ fontSize: 10, color: C.muted }}>reps</span>
              </div>
              <span style={{ fontSize: 10, color: C.muted, fontFamily: MONO, marginLeft: "auto" }}>
                {epley(s.weight, s.reps).toFixed(1)} est.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPanel({ sessions }) {
  const last5 = sessions.slice(-5);
  const newestFirst = [...last5].reverse();
  const chartData = last5.map((s) => ({ date: fmtShort(s.date), e1rm: Math.round(s.e1rm) }));

  // Personal (not population) reference points, computed from ALL history —
  // not just the last 5 points charted — so the PR line and bands don't
  // shift as older sessions roll off the visible window.
  const allE1rms = sessions.map((s) => s.e1rm).filter((v) => v > 0);
  const allTimeMax = allE1rms.length ? Math.max(...allE1rms) : 0;
  const allTimeMin = allE1rms.length ? Math.min(...allE1rms) : 0;
  const band1 = allTimeMin + (allTimeMax - allTimeMin) * 0.35; // low/mid boundary
  const band2 = allTimeMin + (allTimeMax - allTimeMin) * 0.7;  // mid/high boundary
  const currentPct = personalPercentile(sessions);

  const e1rms = chartData.map((d) => d.e1rm);
  const yMin = e1rms.length ? Math.floor(Math.min(...e1rms, allTimeMin) / 10) * 10 - 5 : 0;
  const yMax = e1rms.length ? Math.ceil(Math.max(...e1rms, allTimeMax) / 10) * 10 + 5 : 10;

  return (
    <div style={{ flex: 1, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted }}>Your History</span>
        <span style={{ fontSize: 10, color: C.amber, fontWeight: 700, fontFamily: MONO }}>
          est. 1RM → {currentPct !== null && `· ${currentPct}th pctl (you)`}
        </span>
      </div>

      {!newestFirst.length && (
        <div style={{ padding: "0 20px", color: C.muted, fontSize: 13 }}>No prior sessions logged for this exercise yet.</div>
      )}

      <div style={{ padding: "0 20px", overflowY: "auto", flexShrink: 0 }}>
        {newestFirst.map((s, i) => (
          <HistoryRow key={s.date} session={s} isFirst={i === 0} isLast={i === newestFirst.length - 1} />
        ))}
      </div>

      {chartData.length > 1 && (
        <div style={{ height: 90, flexShrink: 0, padding: "6px 8px 4px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
              <YAxis domain={[yMin, yMax]} hide />
              {allTimeMax > allTimeMin && (
                <>
                  <ReferenceArea y1={yMin} y2={band1} fill={C.bad} fillOpacity={0.07} strokeWidth={0} />
                  <ReferenceArea y1={band1} y2={band2} fill={C.pr} fillOpacity={0.07} strokeWidth={0} />
                  <ReferenceArea y1={band2} y2={yMax} fill={C.good} fillOpacity={0.07} strokeWidth={0} />
                </>
              )}
              {allTimeMax > 0 && (
                <ReferenceLine
                  y={allTimeMax}
                  stroke={C.pr}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: `PR ${Math.round(allTimeMax)}`, position: "insideTopRight", fontSize: 9, fill: C.pr, fontWeight: 700 }}
                />
              )}
              <Line type="monotone" dataKey="e1rm" stroke={C.amber} strokeWidth={2.5} dot={{ r: 3.5, fill: C.amber, strokeWidth: 0 }} isAnimationActive={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: MONO, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 8px" }}
                formatter={(v) => [`${v} lbs`, "Est. 1RM"]}
                labelStyle={{ color: C.muted, fontSize: 10 }}
                itemStyle={{ color: C.amber }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
