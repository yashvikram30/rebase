"use client";
import { useState } from "react";
import {
  MAX_INTERVALS,
  MAX_INTERVAL_DAYS,
  MAX_REVIEWS_PER_PROBLEM,
  addDays,
  daysBetween,
  intervalsFor,
  parseDateString,
  parseIntervals,
  toDateString,
} from "@/lib/striver-schedule";
import type { ScheduledReview } from "@/lib/striver-types";

const PRESETS: { name: string; days: number[] }[] = [
  { name: "Fast", days: [3, 7, 14, 30] },
  { name: "Relaxed", days: [14, 45, 90] },
];

const QUICK_ADD_DAYS = [3, 7, 14, 30, 60];

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((d, i) => d === b[i]);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "in 7 days", "today", "3 days late" or "done", for a review on a date. */
function whenLabel(
  r: ScheduledReview,
  today: string,
): { text: string; tone: "done" | "late" | "today" | "soon" } {
  if (r.completed) return { text: "Done", tone: "done" };
  const d = daysBetween(today, r.dueDate);
  if (d === 0) return { text: "Today", tone: "today" };
  if (d < 0) return { text: `${plural(-d, "day")} late`, tone: "late" };
  return { text: `In ${plural(d, "day")}`, tone: "soon" };
}

/**
 * One problem's reviews. The list and the add controls change the schedule as you click, with no Save step.
 * "Replace all" below them rebuilds every unfinished review from today, from a preset or your own gaps.
 * Mastered problems have no default gaps, so they start empty and only get what you add.
 */
export function ScheduleDialog({
  label,
  status,
  custom,
  reviews,
  today,
  onSave,
  onAdd,
  onRemove,
  onClose,
}: {
  label: string;
  status: "yellow" | "red" | "green";
  custom?: readonly number[];
  /** Every review of this problem, finished ones included. */
  reviews: readonly ScheduledReview[];
  today: string;
  /** Rebuilds the unfinished reviews from these gaps. `null` means the colour's default, or none for a mastered problem. */
  onSave: (intervals: number[] | null) => void;
  /** Adds a review on a date. Returns an error message, or null when it was added. */
  onAdd: (dueDate: string) => string | null;
  onRemove: (stage: number) => void;
  onClose: () => void;
}) {
  const mastered = status === "green";
  const fallback = mastered ? [] : intervalsFor(status);
  const [text, setText] = useState((custom ?? fallback).join(", "));
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [date, setDate] = useState(toDateString(addDays(parseDateString(today), 7)));
  const [addError, setAddError] = useState<string | null>(null);

  const sorted = [...reviews].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.stage - b.stage);
  const pending = sorted.filter((r) => !r.completed).length;
  const full = sorted.length >= MAX_REVIEWS_PER_PROBLEM;

  function add(dueDate: string) {
    setAddError(onAdd(dueDate));
  }

  function replaceAll() {
    if (mastered && text.trim() === "") {
      onSave(null);
      onClose();
      return;
    }
    const parsed = parseIntervals(text);
    if (!parsed.ok) {
      setReplaceError(parsed.error);
      return;
    }
    onSave(!mastered && same(parsed.intervals, fallback) ? null : parsed.intervals);
    onClose();
  }

  const options = mastered ? PRESETS : [{ name: `Default (${status})`, days: [...fallback] }, ...PRESETS];

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
          {label}
          {mastered ? ": mastered, so no reviews unless you add them." : "."}
        </p>

        <section className="sched-section" aria-label="Scheduled reviews">
          <h4>
            Scheduled <small>{pending === 0 ? "none pending" : `${pending} pending`}</small>
          </h4>
          {sorted.length === 0 ? (
            <p className="sched-empty">No reviews yet. Add one below.</p>
          ) : (
            <ul className="sched-list">
              {sorted.map((r) => {
                const w = whenLabel(r, today);
                return (
                  <li key={r.stage} className={"sched-item is-" + w.tone}>
                    <span className="sched-date">{r.dueDate}</span>
                    <span className="sched-when">{w.text}</span>
                    <button
                      type="button"
                      className="sched-remove"
                      aria-label={`Remove the review on ${r.dueDate}`}
                      onClick={() => {
                        setAddError(null);
                        onRemove(r.stage);
                      }}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="sched-section" aria-label="Add a review">
          <h4>Add a review</h4>
          <div className="sched-add">
            <input
              type="date"
              value={date}
              min={today}
              aria-label="Review date"
              onChange={(e) => {
                setDate(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && add(date)}
            />
            <button
              type="button"
              className="striver-answer is-green"
              disabled={full}
              onClick={() => add(date)}
            >
              Add
            </button>
          </div>
          <div className="sched-quick" role="group" aria-label="Add a review in a number of days">
            {QUICK_ADD_DAYS.map((n) => (
              <button
                key={n}
                type="button"
                className="sched-chip"
                disabled={full}
                onClick={() => add(toDateString(addDays(parseDateString(today), n)))}
              >
                +{n}d
              </button>
            ))}
          </div>
          <p className="striver-sched-error" role="alert">
            {addError ??
              (full
                ? `A problem can have at most ${MAX_REVIEWS_PER_PROBLEM} reviews. Remove one to add another.`
                : "")}
          </p>
        </section>

        <section className="sched-section" aria-label="Replace all reviews">
          <h4>Replace all unfinished reviews</h4>
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
                    setReplaceError(null);
                  }}
                >
                  <b>{o.name}</b>
                  <span>{o.days.join(" · ")} days</span>
                </button>
              );
            })}
          </div>
          <label className="striver-sched-field">
            <span>Custom days from today, comma separated</span>
            <input
              type="text"
              inputMode="numeric"
              value={text}
              aria-invalid={replaceError !== null}
              onChange={(e) => {
                setText(e.target.value);
                setReplaceError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && replaceAll()}
              placeholder={mastered ? "Leave empty to clear" : "3, 10, 30"}
            />
            <small>
              Up to {MAX_INTERVALS} reviews, each longer than the last, at most {MAX_INTERVAL_DAYS} days.
              {mastered ? " Empty removes every unfinished review." : ""}
            </small>
          </label>
          <p className="striver-sched-error" role="alert">
            {replaceError}
          </p>
        </section>

        <div className="striver-ask-actions">
          <button type="button" className="striver-answer" onClick={replaceAll}>
            {mastered && text.trim() === "" ? "Clear unfinished reviews" : "Replace all"}
          </button>
          <button type="button" className="striver-answer is-green" autoFocus onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
