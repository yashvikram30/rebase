import { PROBLEM_STEPS, type McItem, type McLevel, type McPhase, type McState } from "./mc-types";
import { addDays, weekdayOf } from "./schedule";
import { toDateString } from "./striver-schedule";

/** How much of one item is done, from 0 to 1. A problem counts its steps; everything else is a tick. */
export function itemFraction(item: McItem, s: McState): number {
  if (item.kind === "problem") {
    const done = PROBLEM_STEPS.filter((st) => s.steps[item.id]?.[st.id]).length;
    return done / PROBLEM_STEPS.length;
  }
  return s.done[item.id] ? 1 : 0;
}

export const itemDone = (item: McItem, s: McState) => itemFraction(item, s) === 1;

export type Stats = { done: number; total: number; fraction: number };

function stats(items: McItem[], s: McState): Stats {
  const total = items.length;
  const done = items.filter((i) => itemDone(i, s)).length;
  const fraction = total ? items.reduce((sum, i) => sum + itemFraction(i, s), 0) / total : 0;
  return { done, total, fraction };
}

export const phaseStats = (phase: McPhase, s: McState): Stats => stats(phase.items, s);
export const levelStats = (level: McLevel, s: McState): Stats =>
  stats(
    level.phases.flatMap((p) => p.items),
    s,
  );
export const overallStats = (levels: McLevel[], s: McState): Stats =>
  stats(
    levels.flatMap((l) => l.phases.flatMap((p) => p.items)),
    s,
  );

/** A phase is complete when every item is done and its self-check is ticked. */
export const phaseComplete = (phase: McPhase, s: McState) =>
  phaseStats(phase, s).done === phase.items.length && !!s.gates[phase.id];

export type NextUp = { levelId: McLevel["id"]; phase: McPhase; item: McItem } | null;

/** The first item, in curriculum order, that is not finished. */
export function nextUp(levels: McLevel[], s: McState): NextUp {
  for (const level of levels) {
    for (const phase of level.phases) {
      const item = phase.items.find((i) => !itemDone(i, s));
      if (item) return { levelId: level.id, phase, item };
    }
  }
  return null;
}

/** Every moment the learner ticked something. */
function tickTimes(s: McState): number[] {
  return [
    ...Object.values(s.done),
    ...Object.values(s.gates),
    ...Object.values(s.steps).flatMap((m) => Object.values(m)),
  ];
}

/** The Monday of the week a date falls in. Weeks run Monday to Sunday. */
export function weekStart(iso: string): string {
  return addDays(iso, -((weekdayOf(iso) + 6) % 7));
}

/** Ticks per week, keyed by that week's Monday. */
export function weeklyCounts(s: McState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tickTimes(s)) {
    const w = weekStart(toDateString(new Date(t)));
    out[w] = (out[w] ?? 0) + 1;
  }
  return out;
}

export const thisWeekCount = (s: McState, today: string) => weeklyCounts(s)[weekStart(today)] ?? 0;

/**
 * Weeks in a row that reached the goal, ending with this week. This week stays open: until it ends, a week still
 * short of the goal does not break a streak that ran up to last week.
 */
export function weekStreak(s: McState, today: string): number {
  const counts = weeklyCounts(s);
  const met = (w: string) => (counts[w] ?? 0) >= s.weeklyGoal;
  let w = weekStart(today);
  if (!met(w)) w = addDays(w, -7);
  let n = 0;
  while (met(w)) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

/** The longest run of goal-meeting weeks ever. */
export function bestWeekStreak(s: McState): number {
  const counts = weeklyCounts(s);
  const weeks = Object.keys(counts)
    .filter((w) => counts[w] >= s.weeklyGoal)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

export type WeekBar = { start: string; count: number; met: boolean; current: boolean };

/** The last few weeks, oldest first, for the small chart. */
export function recentWeeks(s: McState, today: string, n = 8): WeekBar[] {
  const counts = weeklyCounts(s);
  const cur = weekStart(today);
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(cur, -7 * (n - 1 - i));
    const count = counts[start] ?? 0;
    return { start, count, met: count >= s.weeklyGoal, current: start === cur };
  });
}

export type DueStep = {
  itemId: string;
  title: string;
  stepId: string;
  label: string;
  dueDate: string;
  overdueDays: number;
};

/** The timed revisits that have come due: a problem's day-7 and day-28 steps, counted from its cold attempt. */
export function dueSteps(levels: McLevel[], s: McState, today: string): DueStep[] {
  const out: DueStep[] = [];
  for (const level of levels) {
    for (const phase of level.phases) {
      for (const item of phase.items) {
        if (item.kind !== "problem") continue;
        const attempt = s.steps[item.id]?.attempt;
        if (!attempt) continue;
        for (const st of PROBLEM_STEPS) {
          if (!st.dueAfterDays || s.steps[item.id]?.[st.id]) continue;
          const dueDate = addDays(toDateString(new Date(attempt)), st.dueAfterDays);
          if (dueDate > today) continue;
          const overdueDays = Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
          out.push({
            itemId: item.id,
            title: item.title,
            stepId: st.id,
            label: st.label,
            dueDate,
            overdueDays,
          });
        }
      }
    }
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}

/** When a step becomes due, or null if it has no timer or the cold attempt is not done yet. */
export function stepDueDate(itemId: string, stepId: string, s: McState): string | null {
  const st = PROBLEM_STEPS.find((x) => x.id === stepId);
  const attempt = s.steps[itemId]?.attempt;
  if (!st?.dueAfterDays || !attempt) return null;
  return addDays(toDateString(new Date(attempt)), st.dueAfterDays);
}
