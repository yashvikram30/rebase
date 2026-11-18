import { describe, expect, it } from "vitest";
import { STRIVER_PROBLEMS, toEmailItems } from "./striver-problems";
import type { ScheduledReview } from "./striver-types";

const id = STRIVER_PROBLEMS[0].id;
const rev = (over: Partial<ScheduledReview>): ScheduledReview => ({
  problemId: id,
  status: "yellow",
  stage: 0,
  dueDate: "2026-12-01",
  scheduledFor: "2026-12-01",
  completed: false,
  ...over,
});

describe("toEmailItems", () => {
  it("labels default yellow reviews the way the schedule always did", () => {
    const all = [0, 1, 2].map((stage) =>
      rev({ stage, dueDate: `2026-12-0${stage + 1}`, days: [7, 28, 56][stage] }),
    );
    const items = toEmailItems(all, undefined, undefined, all);
    expect(items.map((i) => [i.days, i.isLast, i.isQuestion])).toEqual([
      [7, false, false],
      [28, false, true],
      [56, true, false],
    ]);
  });

  it("reads gaps from the list for reviews saved before they carried their own", () => {
    const all = [0, 1, 2].map((stage) => rev({ stage, dueDate: `2026-12-0${stage + 1}` }));
    expect(toEmailItems(all).map((i) => i.days)).toEqual([7, 28, 56]);
  });

  it("handles a mastered problem and a review added by hand", () => {
    const all = [
      rev({ status: "green", stage: 0, days: 10 }),
      rev({ status: "green", stage: 1, dueDate: "2026-12-20", days: 29 }),
    ];
    const [first, second] = toEmailItems(all, undefined, undefined, all);
    expect(first).toMatchObject({ status: "green", days: 10, isLast: false, isQuestion: false });
    expect(second).toMatchObject({ days: 29, isLast: true, isQuestion: true });
  });

  it("judges a due review against the problem's whole list, not only what is due", () => {
    const all = [rev({ stage: 0, days: 7 }), rev({ stage: 1, dueDate: "2026-12-29", days: 28 })];
    const [due] = toEmailItems([all[0]], undefined, undefined, all);
    expect(due).toMatchObject({ isLast: false, isQuestion: false });
  });

  it("ignores finished reviews when deciding which is last, and drops unknown problems", () => {
    const all = [
      rev({ stage: 0, days: 7 }),
      rev({ stage: 1, dueDate: "2026-12-29", days: 28, completed: true }),
    ];
    expect(toEmailItems([all[0]], undefined, undefined, all)[0].isLast).toBe(true);
    expect(toEmailItems([rev({ problemId: -42 })])).toEqual([]);
  });
});
