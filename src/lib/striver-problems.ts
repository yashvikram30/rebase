import rawProblems from "@/data/striver-180.json";
import type { EmailProblemItem } from "./email";
import { intervalsFor, questionReview, reviewDays } from "./striver-schedule";
import type { ProblemProgress, ScheduledReview, StriverProblem } from "./striver-types";

export const STRIVER_PROBLEMS = rawProblems as StriverProblem[];
const byId = new Map(STRIVER_PROBLEMS.map((p) => [p.id, p]));

/** Joins reviews with their problems for the email, dropping any whose problem is no longer in the sheet. */
export function toEmailItems(
  reviews: ScheduledReview[],
  extraProblems?: StriverProblem[],
  statuses?: Record<number, ProblemProgress>,
  /** Every review of every problem, so a review can tell whether it is the last or the one carrying questions. Defaults to `reviews`. */
  all: ScheduledReview[] = reviews,
): EmailProblemItem[] {
  const extraMap = extraProblems ? new Map(extraProblems.map((p) => [p.id, p])) : null;
  const items: EmailProblemItem[] = [];
  for (const r of reviews) {
    const problem = extraMap?.get(r.problemId) ?? byId.get(r.problemId);
    if (!problem) continue;
    const custom = statuses?.[r.problemId]?.intervals;
    const intervals = r.status === "green" ? (custom ?? []) : intervalsFor(r.status, custom);
    const mine = all.filter((x) => x.problemId === r.problemId);
    const pending = mine.filter((x) => !x.completed);
    const latest = [...pending].sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.stage - a.stage)[0];
    const q = questionReview(mine, intervals);
    items.push({
      problem,
      status: r.status,
      stage: r.stage,
      intervals,
      days: reviewDays(r, intervals),
      isLast: !latest || (latest.stage === r.stage && latest.dueDate === r.dueDate),
      isQuestion: !!q && q.stage === r.stage,
    });
  }
  return items;
}
