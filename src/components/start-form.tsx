"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { savePlan, usePlan, useToday } from "@/lib/plan-store";
import {
  DEFAULT_STUDY_DAYS,
  WEEKDAY_LABELS,
  dateForDay,
  formatDate,
  isISODate,
  newPlan,
} from "@/lib/schedule";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function StartForm({ totalDays }: { totalDays: number }) {
  const router = useRouter();
  const existing = usePlan();
  const today = useToday();
  const [date, setDate] = useState<string | null>(null);
  const [days, setDays] = useState<number[] | null>(null);

  const startDate = date ?? existing?.startDate ?? today ?? "";
  const studyDays = days ?? existing?.studyDays ?? DEFAULT_STUDY_DAYS;
  const valid = isISODate(startDate) && studyDays.length > 0;
  const plan = valid ? newPlan(startDate, studyDays) : null;

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!plan) return;
        savePlan(plan);
        router.push("/learn");
      }}
    >
      <div className="field">
        <label htmlFor="start">Start date</label>
        <input id="start" type="date" value={startDate} onChange={(e) => setDate(e.target.value)} required />
        <p className="hint">
          Any date works. If it is not one of your study days, day 1 moves to the next one.
        </p>
      </div>
      <div className="field">
        <span className="lbl" id="study-lbl">
          Study days
        </span>
        <div className="weekdays" role="group" aria-labelledby="study-lbl">
          {ORDER.map((d) => (
            <label key={d}>
              <input
                type="checkbox"
                checked={studyDays.includes(d)}
                onChange={(e) =>
                  setDays(e.target.checked ? [...studyDays, d] : studyDays.filter((x) => x !== d))
                }
              />
              <span>{WEEKDAY_LABELS[d]}</span>
            </label>
          ))}
        </div>
        <p className="hint">
          The plan has 4 days a week. Pick the days you will actually study; rest days keep your streak.
        </p>
      </div>
      <p aria-live="polite">
        {plan ? (
          <>
            Day 1 on <b>{formatDate(dateForDay(plan, 0))}</b>, day {totalDays} on{" "}
            <b>{formatDate(dateForDay(plan, totalDays - 1), { year: true })}</b>.
          </>
        ) : (
          <span className="err">Choose a start date and at least one study day.</span>
        )}
      </p>
      <div>
        <button className="btn primary" type="submit" disabled={!plan}>
          {existing ? "Update plan" : "Start plan"}
        </button>
      </div>
      {existing && <p className="hint">Updating moves every day to the new dates. Your progress is kept.</p>}
    </form>
  );
}
