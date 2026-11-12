import { describe, expect, it } from "vitest";
import {
  addDays,
  createScheduleForProblem,
  isQuestionStage,
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
