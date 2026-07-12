import React from "react";
import { C } from "../lib/theme";

// Color scale driven by personal-range percentile (not population data):
// red = near historical low, amber = mid-range, green = near an all-time PR.
function colorFor(pct) {
  if (pct === null || pct === undefined) return C.line;
  if (pct >= 70) return C.good;
  if (pct <= 35) return C.bad;
  return C.pr;
}

function Zone({ shape, x, y, w, h, rx, cx, cy, r, group, benchmarks, onSelect, selected }) {
  const b = benchmarks[group];
  const fill = colorFor(b?.percentile);
  const dim = selected && selected !== group;
  const common = {
    fill,
    opacity: dim ? 0.3 : 1,
    stroke: selected === group ? C.ink : "none",
    strokeWidth: selected === group ? 2 : 0,
    onClick: () => onSelect(group),
    style: { cursor: "pointer", transition: "opacity 0.2s" },
  };
  if (shape === "rect") return <rect x={x} y={y} width={w} height={h} rx={rx || 6} {...common} />;
  return <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.3} {...common} />;
}

const bodyShellStyle = { fill: C.surface2 };

export default function BodyMap({ benchmarks, selected, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 20, justifyContent: "center", padding: "6px 0 2px" }}>
      <div style={{ textAlign: "center" }}>
        <svg viewBox="0 0 120 220" width="120" height="220">
          <circle cx="60" cy="18" r="14" style={bodyShellStyle} />
          <rect x="53" y="30" width="14" height="10" style={bodyShellStyle} />
          <Zone shape="ellipse" cx={30} cy={48} r={12} group="Shoulders" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="ellipse" cx={90} cy={48} r={12} group="Shoulders" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={35} y={46} w={50} h={34} rx={10} group="Chest" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={14} y={52} w={14} h={34} rx={7} group="Biceps" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={92} y={52} w={14} h={34} rx={7} group="Biceps" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={12} y={88} w={13} h={30} rx={6} group="Forearms" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={95} y={88} w={13} h={30} rx={6} group="Forearms" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={38} y={82} w={44} h={34} rx={8} group="Core" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={36} y={118} w={18} h={80} rx={9} group="Legs" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={66} y={118} w={18} h={80} rx={9} group="Legs" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
        </svg>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>Front</div>
      </div>

      <div style={{ textAlign: "center" }}>
        <svg viewBox="0 0 120 220" width="120" height="220">
          <circle cx="60" cy="18" r="14" style={bodyShellStyle} />
          <rect x="53" y="30" width="14" height="10" style={bodyShellStyle} />
          <Zone shape="rect" x={34} y={46} w={52} h={36} rx={10} group="Back" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={14} y={52} w={14} h={34} rx={7} group="Triceps" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={92} y={52} w={14} h={34} rx={7} group="Triceps" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={12} y={88} w={13} h={30} rx={6} group="Forearms" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={95} y={88} w={13} h={30} rx={6} group="Forearms" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={36} y={118} w={18} h={80} rx={9} group="Legs" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
          <Zone shape="rect" x={66} y={118} w={18} h={80} rx={9} group="Legs" benchmarks={benchmarks} onSelect={onSelect} selected={selected} />
        </svg>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>Back</div>
      </div>
    </div>
  );
}
