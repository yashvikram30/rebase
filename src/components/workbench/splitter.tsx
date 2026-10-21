"use client";
import { useRef } from "react";

/**
 * A draggable divider between two panes. `value` is the size of the pane it resizes, in pixels;
 * `grow` says which way dragging enlarges it (+1 right/down, -1 left/up). Arrow keys nudge it.
 */
export function Splitter({
  orientation,
  value,
  min,
  max,
  grow,
  label,
  onLive,
  onCommit,
}: {
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  grow: 1 | -1;
  label: string;
  onLive: (n: number) => void;
  onCommit: (n: number) => void;
}) {
  const drag = useRef<{ from: number; start: number; now: number } | null>(null);
  const vertical = orientation === "vertical";
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

  return (
    <div
      className="wb-split"
      data-orientation={orientation}
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { from: vertical ? e.clientX : e.clientY, start: value, now: value };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.now = clamp(d.start + grow * ((vertical ? e.clientX : e.clientY) - d.from));
        onLive(d.now);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d) onCommit(d.now);
      }}
      onKeyDown={(e) => {
        const [less, more] = vertical ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (e.key !== less && e.key !== more) return;
        e.preventDefault();
        onCommit(clamp(value + grow * (e.key === more ? 16 : -16)));
      }}
    />
  );
}
