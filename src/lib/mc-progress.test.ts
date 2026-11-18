import { describe, expect, it } from "vitest";
import { MC_ITEMS, MC_LEVELS, MC_PHASES } from "@/data/machine-coding";
import { EMPTY_MC, normalizeMc } from "./mc-normalize";
import {
  bestWeekStreak,
  dueSteps,
  itemFraction,
  nextUp,
  overallStats,
  phaseComplete,
  phaseStats,
  recentWeeks,
  stepDueDate,
  thisWeekCount,
  weekStart,
  weekStreak,
  weeklyCounts,
} from "./mc-progress";
import { PROBLEM_STEPS, type McState } from "./mc-types";
import { toDateString } from "./striver-schedule";

const DAY = 86_400_000;
const at = (daysAgo: number) => Date.now() - daysAgo * DAY;
const today = toDateString(new Date());
const firstProblem = MC_ITEMS.find((i) => i.kind === "problem")!;
const firstConcept = MC_ITEMS.find((i) => i.kind !== "problem")!;

describe("curriculum data", () => {
  it("has unique ids across items and phases", () => {
    const ids = MC_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const phases = MC_PHASES.map((p) => p.id);
    expect(new Set(phases).size).toBe(phases.length);
  });

  it("has three levels in order, each with phases and something to know", () => {
    expect(MC_LEVELS.map((l) => l.id)).toEqual(["sde1", "sde2", "beyond"]);
    for (const l of MC_LEVELS) {
      expect(l.phases.length).toBeGreaterThan(0);
      expect(l.know.length).toBeGreaterThan(0);
      for (const p of l.phases) {
        expect(p.items.length).toBeGreaterThan(0);
        expect(p.gate.length).toBeGreaterThan(10);
      }
    }
  });

  it("only links to https urls", () => {
    for (const i of MC_ITEMS) for (const r of i.resources) expect(r.url.startsWith("https://")).toBe(true);
  });

  it("gives problems patterns and a time box", () => {
    for (const i of MC_ITEMS.filter((x) => x.kind === "problem")) {
      expect(i.patterns?.length).toBeGreaterThan(0);
      expect(i.minutes).toBeGreaterThan(0);
    }
  });
});

describe("normalizeMc", () => {
  it("returns an empty python state for junk", () => {
    expect(normalizeMc(null)).toEqual(EMPTY_MC);
    expect(normalizeMc("x")).toEqual(EMPTY_MC);
    expect(EMPTY_MC.weeklyGoal).toBe(3);
    expect(normalizeMc([])).toEqual(EMPTY_MC);
  });

  it("keeps known ids and drops unknown ones, bad times and wrong-kind ticks", () => {
    const s = normalizeMc({
      lang: "cpp",
      done: { [firstConcept.id]: 5, nope: 5, [firstProblem.id]: 5, bad: "x" },
      steps: {
        [firstProblem.id]: { attempt: 7, bogus: 7, compare: -1 },
        nope: { attempt: 1 },
        [firstConcept.id]: { attempt: 1 },
      },
      notes: { [firstProblem.id]: "hello", nope: "x", [firstConcept.id]: "   " },
      gates: { "s1-oop": 9, nope: 9 },
    });
    expect(s.lang).toBe("cpp");
    expect(s.done).toEqual({ [firstConcept.id]: 5 });
    expect(s.steps).toEqual({ [firstProblem.id]: { attempt: 7 } });
    expect(s.notes).toEqual({ [firstProblem.id]: "hello" });
    expect(s.gates).toEqual({ "s1-oop": 9 });
  });

  it("clamps the weekly goal and falls back to 3 for junk", () => {
    expect(normalizeMc({ weeklyGoal: 0 }).weeklyGoal).toBe(1);
    expect(normalizeMc({ weeklyGoal: 99 }).weeklyGoal).toBe(14);
    expect(normalizeMc({ weeklyGoal: 5 }).weeklyGoal).toBe(5);
    expect(normalizeMc({ weeklyGoal: "x" }).weeklyGoal).toBe(3);
    expect(normalizeMc({ weeklyGoal: 2.5 }).weeklyGoal).toBe(3);
  });

  it("falls back to python for an unknown language", () => {
    expect(normalizeMc({ lang: "rust" }).lang).toBe("python");
  });
});

describe("progress", () => {
  it("counts a problem by its steps", () => {
    const s: McState = { ...EMPTY_MC, steps: { [firstProblem.id]: { attempt: 1, compare: 2 } } };
    expect(itemFraction(firstProblem, s)).toBeCloseTo(2 / PROBLEM_STEPS.length);
    const full: McState = {
      ...EMPTY_MC,
      steps: { [firstProblem.id]: Object.fromEntries(PROBLEM_STEPS.map((st) => [st.id, 1])) },
    };
    expect(itemFraction(firstProblem, full)).toBe(1);
  });

  it("rolls up phase and overall progress", () => {
    const phase = MC_LEVELS[0].phases[0];
    const s: McState = { ...EMPTY_MC, done: { [phase.items[0].id]: 1 } };
    const ps = phaseStats(phase, s);
    expect(ps.done).toBe(1);
    expect(ps.total).toBe(phase.items.length);
    expect(ps.fraction).toBeCloseTo(1 / phase.items.length);
    expect(overallStats(MC_LEVELS, EMPTY_MC).fraction).toBe(0);
    expect(overallStats(MC_LEVELS, EMPTY_MC).total).toBe(MC_ITEMS.length);
  });

  it("completes a phase only with every item and its self-check", () => {
    const phase = MC_LEVELS[0].phases[0];
    const done = Object.fromEntries(phase.items.map((i) => [i.id, 1]));
    expect(phaseComplete(phase, { ...EMPTY_MC, done })).toBe(false);
    expect(phaseComplete(phase, { ...EMPTY_MC, done, gates: { [phase.id]: 1 } })).toBe(true);
  });

  it("points at the first unfinished item, then the next phase", () => {
    const first = MC_LEVELS[0].phases[0];
    expect(nextUp(MC_LEVELS, EMPTY_MC)?.item.id).toBe(first.items[0].id);
    const done = Object.fromEntries(first.items.map((i) => [i.id, 1]));
    expect(nextUp(MC_LEVELS, { ...EMPTY_MC, done })?.phase.id).toBe(MC_LEVELS[0].phases[1].id);
  });
});

describe("weekly streak", () => {
  // Wednesday 2026-11-18 is in the week starting Monday 2026-11-16.
  const wed = "2026-11-18";
  const ts = (iso: string, hour = 12) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00`).getTime();
  const withTicks = (isos: string[], goal = 3): McState => ({
    ...EMPTY_MC,
    weeklyGoal: goal,
    done: Object.fromEntries(isos.map((d, i) => [`t${i}`, ts(d)])),
  });

  it("finds the Monday of any day, including Sunday", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-18")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });

  it("is zero with no activity", () => {
    expect(weekStreak(EMPTY_MC, wed)).toBe(0);
    expect(bestWeekStreak(EMPTY_MC)).toBe(0);
  });

  it("counts a week only when it reaches the goal", () => {
    const s = withTicks(["2026-11-16", "2026-11-17"]);
    expect(thisWeekCount(s, wed)).toBe(2);
    expect(weekStreak(s, wed)).toBe(0);
    expect(weekStreak(withTicks(["2026-11-16", "2026-11-17", "2026-11-18"]), wed)).toBe(1);
  });

  it("keeps the streak alive while the current week is still short of the goal", () => {
    const lastTwo = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09", "2026-11-10", "2026-11-11"];
    expect(weekStreak(withTicks(lastTwo), wed)).toBe(2);
    expect(weekStreak(withTicks([...lastTwo, "2026-11-16", "2026-11-17", "2026-11-18"]), wed)).toBe(3);
  });

  it("breaks on a missed week", () => {
    const s = withTicks(["2026-10-26", "2026-10-27", "2026-10-28", "2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(weekStreak(s, wed)).toBe(1);
    expect(bestWeekStreak(s)).toBe(1);
  });

  it("reports the best run across history", () => {
    const run = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-14", "2026-09-15", "2026-09-16"];
    const later = ["2026-11-09", "2026-11-10", "2026-11-11"];
    expect(bestWeekStreak(withTicks([...run, ...later]))).toBe(2);
  });

  it("honours a different goal", () => {
    const s = withTicks(["2026-11-16"], 1);
    expect(weekStreak(s, wed)).toBe(1);
  });

  it("charts the last weeks oldest first, marking the current one", () => {
    const bars = recentWeeks(withTicks(["2026-11-16", "2026-11-17", "2026-11-18"]), wed, 4);
    expect(bars).toHaveLength(4);
    expect(bars[3]).toMatchObject({ start: "2026-11-16", count: 3, met: true, current: true });
    expect(bars[0]).toMatchObject({ start: "2026-10-26", count: 0, met: false, current: false });
  });

  it("counts steps and self-checks as ticks too", () => {
    const s: McState = {
      ...EMPTY_MC,
      steps: { x: { attempt: ts("2026-11-16"), compare: ts("2026-11-17") } },
      gates: { g: ts("2026-11-18") },
    };
    expect(weeklyCounts(s)["2026-11-16"]).toBe(3);
  });
});

describe("timed revisits", () => {
  it("makes day-7 and day-28 due relative to the cold attempt", () => {
    const s: McState = { ...EMPTY_MC, steps: { [firstProblem.id]: { attempt: at(8) } } };
    const due = dueSteps(MC_LEVELS, s, today);
    expect(due.map((d) => d.stepId)).toEqual(["day7"]);
    expect(due[0].overdueDays).toBe(1);
    const later: McState = { ...EMPTY_MC, steps: { [firstProblem.id]: { attempt: at(30), day7: at(20) } } };
    expect(dueSteps(MC_LEVELS, later, today).map((d) => d.stepId)).toEqual(["day28"]);
  });

  it("shows nothing before the cold attempt or before the due date", () => {
    expect(dueSteps(MC_LEVELS, EMPTY_MC, today)).toEqual([]);
    const fresh: McState = { ...EMPTY_MC, steps: { [firstProblem.id]: { attempt: at(1) } } };
    expect(dueSteps(MC_LEVELS, fresh, today)).toEqual([]);
  });

  it("reports a step's due date only once the attempt is done", () => {
    expect(stepDueDate(firstProblem.id, "day7", EMPTY_MC)).toBeNull();
    const s: McState = { ...EMPTY_MC, steps: { [firstProblem.id]: { attempt: at(0) } } };
    expect(stepDueDate(firstProblem.id, "day7", s)).not.toBeNull();
    expect(stepDueDate(firstProblem.id, "compare", s)).toBeNull();
  });
});
