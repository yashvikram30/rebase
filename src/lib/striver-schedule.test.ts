import { describe, expect, it } from "vitest";
import {
  MAX_REVIEWS_PER_PROBLEM,
  addDays,
  addReview,
  createScheduleForProblem,
  daysBetween,
  questionReview,
  removeReview,
  reviewDays,
  intervalsFor,
  isQuestionStage,
  parseIntervals,
  questionStageIndex,
  sanitizeIntervals,
  parseDateString,
  rescheduleMissedReviews,
  toDateString,
  updateReviewsOnStatusChange,
} from "./striver-schedule";
import type { ScheduledReview } from "./striver-types";

describe("striver-schedule", () => {
  it("formats and parses date strings correctly", () => {
    const d = new Date(2026, 9, 27); // Oct 27, 2026
    const str = toDateString(d);
    expect(str).toBe("2026-10-27");
    const parsed = parseDateString(str);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(27);
  });

  it("creates Yellow schedule with 7d, 28d and 56d intervals", () => {
    const base = new Date(2026, 9, 1); // Oct 1, 2026
    const schedule = createScheduleForProblem(42, "yellow", base);
    expect(schedule).toHaveLength(3);
    expect(schedule[0].dueDate).toBe("2026-10-08"); // +7d
    expect(schedule[0].stage).toBe(0);
    expect(schedule[1].dueDate).toBe("2026-10-29"); // +28d
    expect(schedule[1].stage).toBe(1);
    expect(schedule[2].dueDate).toBe("2026-11-26"); // +56d
    expect(schedule[2].stage).toBe(2);
  });

  it("creates Red schedule with 7d, 14d, 28d and 56d intervals", () => {
    const base = new Date(2026, 9, 1); // Oct 1, 2026
    const schedule = createScheduleForProblem(99, "red", base);
    expect(schedule).toHaveLength(4);
    expect(schedule[0].dueDate).toBe("2026-10-08"); // +7d
    expect(schedule[1].dueDate).toBe("2026-10-15"); // +14d
    expect(schedule[2].dueDate).toBe("2026-10-29"); // +28d
    expect(schedule[3].dueDate).toBe("2026-11-26"); // +56d
  });

  it("keeps pending reviews when problem is updated to green", () => {
    const base = new Date(2026, 9, 1);
    const existing = createScheduleForProblem(10, "red", base);
    const updated = updateReviewsOnStatusChange(existing, 10, "green");
    expect(updated).toHaveLength(4);
  });

  it("clears pending reviews on green only when asked to", () => {
    const base = new Date(2026, 9, 1);
    const existing = createScheduleForProblem(10, "yellow", base);
    const updated = updateReviewsOnStatusChange(existing, 10, "green", base, true);
    expect(updated).toHaveLength(0);
  });

  it("clears pending reviews when problem is reset to unattempted", () => {
    const base = new Date(2026, 9, 1);
    const existing = createScheduleForProblem(10, "red", base);
    const updated = updateReviewsOnStatusChange(existing, 10, "unattempted");
    expect(updated).toHaveLength(0);
  });

  it("reschedules missed reviews to closest day with 0 problems in next week", () => {
    const todayStr = "2026-10-10"; // Today is Oct 10
    const today = parseDateString(todayStr);

    // Overdue review due on Oct 8 (not completed)
    const overdue: ScheduledReview = {
      problemId: 1,
      status: "yellow",
      stage: 0,
      dueDate: "2026-10-08",
      scheduledFor: "2026-10-08",
      completed: false,
    };

    // Day +1 is Oct 11, Day +2 is Oct 12, etc.
    // Let's add an existing review on Oct 11 (Day +1)
    const existingOnDay1: ScheduledReview = {
      problemId: 2,
      status: "yellow",
      stage: 0,
      dueDate: "2026-10-11",
      scheduledFor: "2026-10-11",
      completed: false,
    };

    const { reviews, rescheduledCount } = rescheduleMissedReviews(
      [overdue, existingOnDay1],
      todayStr,
    );

    expect(rescheduledCount).toBe(1);
    // Since Oct 11 already has 1 problem, the closest day with 0 problems is Oct 12 (Day +2)
    const rescheduledItem = reviews.find((r) => r.problemId === 1);
    expect(rescheduledItem?.dueDate).toBe("2026-10-12");
  });

  it("distributes multiple overdue reviews across zero-load days", () => {
    const todayStr = "2026-10-10";
    const reviews: ScheduledReview[] = [
      {
        problemId: 1,
        status: "yellow",
        stage: 0,
        dueDate: "2026-10-05",
        scheduledFor: "2026-10-05",
        completed: false,
      },
      {
        problemId: 2,
        status: "red",
        stage: 0,
        dueDate: "2026-10-06",
        scheduledFor: "2026-10-06",
        completed: false,
      },
    ];

    const { reviews: updated, rescheduledCount } = rescheduleMissedReviews(reviews, todayStr);
    expect(rescheduledCount).toBe(2);
    // First goes to Oct 11 (day +1)
    expect(updated[0].dueDate).toBe("2026-10-11");
    // Second sees Oct 11 has count 1, so it chooses Oct 12 (day +2)
    expect(updated[1].dueDate).toBe("2026-10-12");
  });

  it("falls back to minimum count day if all 7 days have scheduled problems", () => {
    const todayStr = "2026-10-10";
    const today = parseDateString(todayStr);

    // Populate each day from Oct 11 to Oct 17 with 1 problem, except Oct 13 has 2
    const filled: ScheduledReview[] = [];
    for (let i = 1; i <= 7; i++) {
      const dStr = toDateString(addDays(today, i));
      filled.push({
        problemId: 100 + i,
        status: "yellow",
        stage: 0,
        dueDate: dStr,
        scheduledFor: dStr,
        completed: false,
      });
    }

    // Overdue problem
    const overdue: ScheduledReview = {
      problemId: 999,
      status: "yellow",
      stage: 0,
      dueDate: "2026-10-08",
      scheduledFor: "2026-10-08",
      completed: false,
    };

    const { reviews: updated } = rescheduleMissedReviews([...filled, overdue], todayStr);
    const moved = updated.find((r) => r.problemId === 999);
    // Closest day with min count (1) is Day +1 (Oct 11)
    expect(moved?.dueDate).toBe("2026-10-11");
  });
});

describe("isQuestionStage", () => {
  it("picks the 28-day review for each colour", () => {
    expect([0, 1, 2].map((s) => isQuestionStage("yellow", s))).toEqual([false, true, false]);
    expect([0, 1, 2, 3].map((s) => isQuestionStage("red", s))).toEqual([false, false, true, false]);
  });
});

describe("custom per-problem intervals", () => {
  const from = new Date(2026, 10, 16);

  it("builds the schedule from the problem's own gaps", () => {
    const r = createScheduleForProblem(5, "red", from, [3, 10, 30]);
    expect(r.map((x) => x.dueDate)).toEqual(["2026-11-19", "2026-11-26", "2026-12-16"]);
    expect(r.map((x) => x.stage)).toEqual([0, 1, 2]);
  });

  it("falls back to the colour's default without custom gaps", () => {
    expect(intervalsFor("yellow")).toEqual([7, 28, 56]);
    expect(intervalsFor("red", [])).toEqual([7, 14, 28, 56]);
    expect(createScheduleForProblem(5, "yellow", from)).toHaveLength(3);
  });

  it("rebuilds only unfinished reviews with the new gaps, keeping completed ones", () => {
    const done = { ...createScheduleForProblem(5, "yellow", from)[0], completed: true };
    const pending = createScheduleForProblem(5, "yellow", from).slice(1);
    const other = createScheduleForProblem(6, "red", from);
    const out = updateReviewsOnStatusChange([done, ...pending, ...other], 5, "yellow", from, false, [2, 5]);
    expect(out.filter((r) => r.problemId === 5 && !r.completed).map((r) => r.dueDate)).toEqual(["2026-11-18", "2026-11-21"]);
    expect(out.filter((r) => r.problemId === 5 && r.completed)).toHaveLength(1);
    expect(out.filter((r) => r.problemId === 6)).toHaveLength(4);
  });

  it("puts the interview questions on the 28-day review, or the first gap of 28+ days, else the last", () => {
    expect(questionStageIndex([7, 28, 56])).toBe(1);
    expect(questionStageIndex([3, 10, 30, 90])).toBe(2);
    expect(questionStageIndex([2, 5, 9])).toBe(2);
    expect([0, 1, 2].map((s) => isQuestionStage("yellow", s, [3, 10, 30]))).toEqual([false, false, true]);
  });

  it("parses and validates typed gaps", () => {
    expect(parseIntervals("3, 10 30")).toEqual({ ok: true, intervals: [3, 10, 30] });
    for (const bad of ["", "abc", "0, 5", "5, 5", "10, 3", "1.5", "400", "1,2,3,4,5,6,7"]) {
      expect(parseIntervals(bad).ok).toBe(false);
    }
  });

  it("drops stored interval lists that are not valid", () => {
    expect(sanitizeIntervals([3, 10])).toEqual([3, 10]);
    for (const bad of [undefined, [], [5, 3], [0], ["7"], [1.5], [400], "7"]) expect(sanitizeIntervals(bad)).toBeUndefined();
  });
});

describe("reviews set by hand", () => {
  const today = "2026-11-19";
  const rev = (over: Partial<ScheduledReview>): ScheduledReview => ({
    problemId: 1,
    status: "green",
    stage: 0,
    dueDate: "2026-11-26",
    scheduledFor: "2026-11-26",
    completed: false,
    ...over,
  });

  it("gives a mastered problem reviews only from gaps it is given", () => {
    expect(createScheduleForProblem(5, "green", new Date(2026, 10, 19))).toEqual([]);
    const made = createScheduleForProblem(5, "green", new Date(2026, 10, 19), [14, 60]);
    expect(made.map((r) => [r.status, r.stage, r.dueDate, r.days])).toEqual([
      ["green", 0, "2026-12-03", 14],
      ["green", 1, "2027-01-18", 60],
    ]);
  });

  it("records each default review's gap", () => {
    expect(createScheduleForProblem(1, "yellow", new Date(2026, 10, 19)).map((r) => r.days)).toEqual([7, 28, 56]);
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-11-19", "2026-11-26")).toBe(7);
    expect(daysBetween("2026-11-19", "2026-11-19")).toBe(0);
    expect(daysBetween("2026-11-19", "2026-11-18")).toBe(-1);
  });

  it("adds a review on a future date with the next stage number and its gap", () => {
    const res = addReview([rev({ stage: 0 }), rev({ stage: 3, dueDate: "2026-12-30" })], 1, "green", "2026-12-05", today);
    expect(res.added).toBe(true);
    const added = res.reviews[res.reviews.length - 1];
    expect(added).toMatchObject({ problemId: 1, status: "green", stage: 4, dueDate: "2026-12-05", days: 16, completed: false });
  });

  it("allows today", () => {
    expect(addReview([], 1, "yellow", today, today).added).toBe(true);
  });

  it("refuses a past date, a bad date, a repeated day and a full problem, and says why", () => {
    const base = [rev({})];
    expect(addReview(base, 1, "green", "2026-11-18", today)).toMatchObject({ added: false, reviews: base });
    expect(addReview(base, 1, "green", "2026-02-30", today).added).toBe(false);
    expect(addReview(base, 1, "green", "soon", today).reason).toBeTruthy();
    expect(addReview(base, 1, "green", "2026-11-26", today).reason).toMatch(/already/);
    const full = Array.from({ length: MAX_REVIEWS_PER_PROBLEM }, (_, i) =>
      rev({ stage: i, dueDate: addDays(new Date(2026, 11, 1), i).toISOString().slice(0, 10) }),
    );
    expect(addReview(full, 1, "green", "2027-06-01", today).reason).toMatch(/at most/);
  });

  it("lets a finished review's day be used again, and counts reviews per problem", () => {
    expect(addReview([rev({ completed: true })], 1, "green", "2026-11-26", today).added).toBe(true);
    expect(addReview([rev({ problemId: 2 })], 1, "green", "2026-11-26", today).added).toBe(true);
  });

  it("removes one review of one problem and leaves the rest", () => {
    const list = [rev({ stage: 0 }), rev({ stage: 1 }), rev({ problemId: 2, stage: 1 })];
    expect(removeReview(list, 1, 1).map((r) => [r.problemId, r.stage])).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(removeReview(list, 9, 0)).toHaveLength(3);
  });

  it("reads a review's gap from itself, else from the list", () => {
    expect(reviewDays(rev({ days: 16 }), [7, 28])).toBe(16);
    expect(reviewDays(rev({ days: undefined, stage: 1 }), [7, 28, 56])).toBe(28);
    expect(reviewDays(rev({ days: undefined, stage: 9 }), [7, 28, 56])).toBe(56);
  });

  it("picks the question review by gap, whatever order they were added in", () => {
    const mine = [
      rev({ stage: 2, dueDate: "2026-12-31", days: 42 }),
      rev({ stage: 0, dueDate: "2026-11-26", days: 7 }),
      rev({ stage: 1, dueDate: "2026-12-17", days: 28 }),
    ];
    expect(questionReview(mine, [])?.stage).toBe(1);
    expect(questionReview([rev({ stage: 0, days: 3 }), rev({ stage: 1, dueDate: "2026-12-10", days: 10 })], [])?.stage).toBe(1);
    expect(questionReview([], [])).toBeUndefined();
  });

  it("matches the old default for yellow and red lists without stored gaps", () => {
    const yellow = [0, 1, 2].map((stage) => rev({ status: "yellow", stage, dueDate: `2026-12-0${stage + 1}`, days: undefined }));
    expect(questionReview(yellow, [7, 28, 56])?.stage).toBe(1);
    const red = [0, 1, 2, 3].map((stage) => rev({ status: "red", stage, dueDate: `2026-12-0${stage + 1}`, days: undefined }));
    expect(questionReview(red, [7, 14, 28, 56])?.stage).toBe(2);
  });
});
