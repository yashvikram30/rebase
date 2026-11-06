import rawProblems from "@/data/striver-180.json";
import type { EmailProblemItem } from "./email";
import type { ScheduledReview, StriverProblem } from "./striver-types";

export const STRIVER_PROBLEMS = rawProblems as StriverProblem[];
const byId = new Map(STRIVER_PROBLEMS.map((p) => [p.id, p]));

/** Joins reviews with their problems for the email, dropping any whose problem is no longer in the sheet. */
export function toEmailItems(reviews: ScheduledReview[], extraProblems?: StriverProblem[]): EmailProblemItem[] {
  const extraMap = extraProblems ? new Map(extraProblems.map((p) => [p.id, p])) : null;
  const items: EmailProblemItem[] = [];
  for (const r of reviews) {
    const problem = extraMap?.get(r.problemId) ?? byId.get(r.problemId);
    if (problem) items.push({ problem, status: r.status, stage: r.stage });
  }
  return items;
}
