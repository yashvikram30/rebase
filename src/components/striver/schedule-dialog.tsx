"use client";
import { useState } from "react";
import {
  MAX_INTERVALS,
  MAX_INTERVAL_DAYS,
  intervalsFor,
  parseIntervals,
} from "@/lib/striver-schedule";

const PRESETS: { name: string; days: number[] }[] = [
  { name: "Fast", days: [3, 7, 14, 30] },
  { name: "Relaxed", days: [14, 45, 90] },
];

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/**
 * Edits one problem's review gaps. Saving a list equal to the colour's default stores nothing, so the problem
 * keeps following the default.
 */
export function ScheduleDialog({
  label,
  status,
  custom,
  onSave,
  onClose,
}: {
  label: string;
  status: "yellow" | "red";
  custom?: readonly number[];
  /** `null` means follow the colour's default. */
  onSave: (intervals: number[] | null) => void;
  onClose: () => void;
}) {
  const fallback = intervalsFor(status);
  const [text, setText] = useState((custom ?? fallback).join(", "));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed = parseIntervals(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onSave(same(parsed.intervals, fallback) ? null : parsed.intervals);
    onClose();
  }

  const options = [{ name: `Default (${status})`, days: [...fallback] }, ...PRESETS];

  return (
    <div className="striver-ask-backdrop" onClick={onClose}>
      <div
        className="striver-ask striver-sched"
        role="dialog"
        aria-modal="true"
        aria-labelledby="striver-sched-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h3 id="striver-sched-title">Review schedule</h3>
        <p>
          {label}: how many days after today each review comes back. Saving restarts its unfinished reviews from today.
        </p>
        <div className="striver-sched-presets" role="group" aria-label="Presets">
          {options.map((o) => {
            const current = parseIntervals(text);
            const on = current.ok && same(current.intervals, o.days);
            return (
              <button
                key={o.name}
                type="button"
                aria-pressed={on}
                className={"striver-sched-preset" + (on ? " is-on" : "")}
                onClick={() => {
                  setText(o.days.join(", "));
                  setError(null);
                }}
              >
                <b>{o.name}</b>
                <span>{o.days.join(" · ")} days</span>
              </button>
            );
          })}
        </div>
        <label className="striver-sched-field">
          <span>Custom days, comma separated</span>
          <input
            type="text"
            inputMode="numeric"
            value={text}
            autoFocus
            aria-invalid={error !== null}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="3, 10, 30"
          />
          <small>
            Up to {MAX_INTERVALS} reviews, each longer than the last, at most {MAX_INTERVAL_DAYS} days.
          </small>
        </label>
        <p className="striver-sched-error" role="alert">
          {error}
        </p>
        <div className="striver-ask-actions">
          <button type="button" className="striver-answer is-green" onClick={save}>
            Save schedule
          </button>
          <button type="button" className="striver-answer" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
