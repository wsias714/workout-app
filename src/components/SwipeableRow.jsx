import React, { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { C } from "../lib/theme";

const REVEAL = 82;
const TRIGGER = 44;

// Swipe-left-to-delete row used for exercise cards (Screen 1) and set rows (Screen 2).
export default function SwipeableRow({ onDelete, deleteLabel = "Delete", disabled = false, radius = 0, children }) {
  const [offsetX, setOffsetX] = useState(0);
  const [active, setActive] = useState(false);
  const sX = useRef(null);
  const sY = useRef(null);
  const axis = useRef(null);

  const onStart = (cx, cy) => {
    if (disabled) return;
    sX.current = cx;
    sY.current = cy;
    axis.current = null;
    setActive(true);
  };
  const onMove = (cx, cy) => {
    if (!active || sX.current === null) return;
    const dx = cx - sX.current;
    const dy = cy - sY.current;
    if (!axis.current) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      axis.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (axis.current !== "h") return;
    setOffsetX(Math.min(0, Math.max(-REVEAL, dx)));
  };
  const onEnd = () => {
    if (!active) return;
    setActive(false);
    setOffsetX((p) => (p < -TRIGGER ? -REVEAL : 0));
    sX.current = null;
  };

  return (
    <div style={{ position: "relative", overflowX: "hidden", overflowY: "visible" }}>
      <div
        onClick={() => { setOffsetX(0); onDelete(); }}
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: REVEAL,
          background: C.bad, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer",
          borderRadius: `0 ${radius}px ${radius}px 0`,
        }}
      >
        <Trash2 size={17} color="#fff" />
        <span style={{ fontSize: 9, color: "#fff", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {deleteLabel}
        </span>
      </div>
      <div
        style={{ transform: `translateX(${offsetX}px)`, transition: active ? "none" : "transform 0.22s cubic-bezier(0.25,1,0.5,1)" }}
        onMouseDown={(e) => onStart(e.clientX, e.clientY)}
        onMouseMove={(e) => active && onMove(e.clientX, e.clientY)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={onEnd}
      >
        {children}
      </div>
    </div>
  );
}
