import { describe, expect, it } from "vitest";
import { normalizeStriver } from "./striver-normalize";
import { createScheduleForProblem } from "./striver-schedule";

describe("normalizeStriver", () => {
  it("defaults to reminders on and drops unknown fields such as a stored email", () => {
    const s = normalizeStriver({ email: "someone@else.com" });
    expect(s).toEqual({ statuses: {}, reviews: [], reminders: true });
  });

  it("keeps an explicit opt-out and discards malformed entries", () => {
    const s = normalizeStriver({
      reminders: false,
      statuses: { 1: { status: "red", updatedAt: 5 }, x: { status: "green" }, 2: { status: "bogus" } },
      reviews: [{ problemId: 1, status: "red", stage: 0, dueDate: "2026-11-04" }, { problemId: "1" }],
    });
    expect(s.reminders).toBe(false);
    expect(Object.keys(s.statuses)).toEqual(["1"]);
    expect(s.reviews).toHaveLength(1);
  });
});

describe("createScheduleForProblem", () => {
  it("does not change the date it was given", () => {
    const from = new Date(2026, 9, 28, 15, 30);
    createScheduleForProblem(1, "red", from);
    expect(from.getHours()).toBe(15);
  });
});
