import type { ProblemStatus, ScheduledReview } from "./striver-types";
import { RED_INTERVALS_DAYS, YELLOW_INTERVALS_DAYS } from "./striver-types";

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export const MAX_INTERVALS = 6;
export const MAX_INTERVAL_DAYS = 365;

/** The review gaps for a status: the problem's own list when it has one, else the default for that colour. */
export function intervalsFor(status: "yellow" | "red", custom?: readonly number[]): readonly number[] {
  if (custom && custom.length > 0) return custom;
  return status === "yellow" ? YELLOW_INTERVALS_DAYS : RED_INTERVALS_DAYS;
}

/** Keeps a stored interval list only if it is 1-6 whole days, each 1-365 and strictly increasing; else undefined. */
export function sanitizeIntervals(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_INTERVALS) return undefined;
  let prev = 0;
  for (const d of raw) {
    if (!Number.isInteger(d) || d <= prev || d > MAX_INTERVAL_DAYS) return undefined;
    prev = d;
  }
  return [...raw];
}

/** Reads "3, 10, 30" (commas or spaces) into an interval list, or says what is wrong with it. */
export function parseIntervals(text: string): { ok: true; intervals: number[] } | { ok: false; error: string } {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter at least one number of days." };
  if (parts.length > MAX_INTERVALS) return { ok: false, error: `Use at most ${MAX_INTERVALS} reviews.` };
  const nums = parts.map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > MAX_INTERVAL_DAYS)) {
    return { ok: false, error: `Each gap must be a whole number from 1 to ${MAX_INTERVAL_DAYS} days.` };
  }
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1]) return { ok: false, error: "Gaps must get longer, e.g. 3, 10, 30." };
  }
  return { ok: true, intervals: nums };
}

/**
 * Creates scheduled reviews for a newly classified problem.
 * Default yellow: +7d, +28d, +56d. Default red: +7d, +14d, +28d, +56d. `custom` replaces those gaps.
 */
export function createScheduleForProblem(
  problemId: number,
  status: "yellow" | "red" | "green",
  fromDate: Date = new Date(),
  custom?: readonly number[],
): ScheduledReview[] {
  // A mastered problem has no default list: it only gets reviews from gaps the user chose.
  const intervals = status === "green" ? (custom ?? []) : intervalsFor(status, custom);
  const now = new Date(fromDate.getTime());
  now.setHours(0, 0, 0, 0);

  return intervals.map((days, stage) => {
    const target = addDays(now, days);
    const dateStr = toDateString(target);
    return {
      problemId,
      status,
      stage,
      dueDate: dateStr,
      scheduledFor: dateStr,
      completed: false,
      days,
    };
  });
}

/** At most this many reviews per problem, finished ones included, so a list never grows without end. */
export const MAX_REVIEWS_PER_PROBLEM = 12;

const MS_DAY = 86_400_000;

/** Whole days from one date string to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateString(to).getTime() - parseDateString(from).getTime()) / MS_DAY);
}

/**
 * Adds one review for a problem on a chosen date. Returns the list unchanged if the date is in the past, is not a
 * date, already has a review for this problem, or the problem is full. `reason` says why, for the dialog to show.
 */
export function addReview(
  reviews: ScheduledReview[],
  problemId: number,
  status: "yellow" | "red" | "green",
  dueDate: string,
  todayStr: string,
): { reviews: ScheduledReview[]; added: boolean; reason?: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || toDateString(parseDateString(dueDate)) !== dueDate) {
    return { reviews, added: false, reason: "Pick a date." };
  }
  if (dueDate < todayStr) return { reviews, added: false, reason: "Pick today or a later date." };
  const mine = reviews.filter((r) => r.problemId === problemId);
  if (mine.some((r) => !r.completed && r.dueDate === dueDate)) {
    return { reviews, added: false, reason: "There is already a review on that day." };
  }
  if (mine.length >= MAX_REVIEWS_PER_PROBLEM) {
    return { reviews, added: false, reason: `A problem can have at most ${MAX_REVIEWS_PER_PROBLEM} reviews.` };
  }
  const stage = mine.reduce((m, r) => Math.max(m, r.stage), -1) + 1;
  const days = Math.max(1, daysBetween(todayStr, dueDate));
  const review: ScheduledReview = { problemId, status, stage, dueDate, scheduledFor: dueDate, completed: false, days };
  return { reviews: [...reviews, review], added: true };
}

/** Removes one review of a problem, finished or not. */
export function removeReview(reviews: ScheduledReview[], problemId: number, stage: number): ScheduledReview[] {
  return reviews.filter((r) => !(r.problemId === problemId && r.stage === stage));
}

/** A review's gap in days: the one it carries, else the problem's list at its position, else the last gap. */
export function reviewDays(r: ScheduledReview, intervals: readonly number[]): number {
  return r.days ?? intervals[r.stage] ?? intervals[intervals.length - 1] ?? 0;
}

/**
 * Which of a problem's reviews carries the interview questions: the first (by date) whose gap is 28 days or more,
 * else the last one. `mine` is every review of that one problem.
 */
export function questionReview(mine: readonly ScheduledReview[], intervals: readonly number[]): ScheduledReview | undefined {
  const sorted = [...mine].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.stage - b.stage);
  return sorted.find((r) => reviewDays(r, intervals) >= QUESTION_INTERVAL_DAYS) ?? sorted[sorted.length - 1];
}

/**
 * Updates an existing review list when a problem's status changes.
 * - Unattempted (reset): clears all active uncompleted reviews for this problem.
 * - Green: keeps the pending reviews unless `clearPending` is set (the user chose to drop them).
 * - Yellow / red: clears uncompleted reviews for this problem and creates the new schedule
 *   (from the problem's own gaps when `custom` is given).
 */
export function updateReviewsOnStatusChange(
  currentReviews: ScheduledReview[],
  problemId: number,
  newStatus: ProblemStatus,
  fromDate: Date = new Date(),
  clearPending = false,
  custom?: readonly number[],
): ScheduledReview[] {
  if (newStatus === "green" && !clearPending) return currentReviews;

  // Keep reviews for other problems, and keep completed reviews for history
  const filtered = currentReviews.filter((r) => r.problemId !== problemId || r.completed);

  if (newStatus === "green" || newStatus === "unattempted") {
    return filtered;
  }

  const newReviews = createScheduleForProblem(problemId, newStatus, fromDate, custom);
  return [...filtered, ...newReviews];
}

/**
 * Missed Problem Rescheduling (Leveling):
 * "if the user does not provide any [update] send it again to the day closest and 0 scheduled problems within the next week."
 *
 * For each review with dueDate < todayStr and completed == false:
 * - Scans days [today + 1, today + 7].
 * - Finds the day with count == 0 closest to today + 1.
 * - If all days have >= 1 problems, picks the day with the minimum problem count closest to today + 1.
 * - Updates the review's dueDate to that target day.
 */
export function rescheduleMissedReviews(
  reviews: ScheduledReview[],
  todayStr: string,
): { reviews: ScheduledReview[]; rescheduledCount: number } {
  const today = parseDateString(todayStr);

  // Separate overdue active reviews from others
  const isOverdue = (r: ScheduledReview) => !r.completed && r.dueDate < todayStr;
  const overdueIndices: number[] = [];
  const updated = reviews.map((r, i) => {
    if (isOverdue(r)) {
      overdueIndices.push(i);
    }
    return { ...r };
  });

  if (overdueIndices.length === 0) {
    return { reviews: updated, rescheduledCount: 0 };
  }

  // Count active reviews on the next 7 days: [today+1, ..., today+7]
  const next7Days: string[] = [];
  const counts: Record<string, number> = {};
  for (let i = 1; i <= 7; i++) {
    const dayStr = toDateString(addDays(today, i));
    next7Days.push(dayStr);
    counts[dayStr] = 0;
  }

  // Count existing non-overdue active reviews in that 7-day window
  for (const r of updated) {
    if (!r.completed && counts[r.dueDate] !== undefined) {
      counts[r.dueDate]++;
    }
  }

  // Reschedule each overdue review one by one, updating counts dynamically
  let rescheduledCount = 0;
  for (const idx of overdueIndices) {
    // 1. Look for a day with 0 problems
    let targetDay = next7Days.find((d) => counts[d] === 0);

    // 2. If all have >= 1, pick the day with minimum count closest to today + 1
    if (!targetDay) {
      let minCount = Infinity;
      for (const d of next7Days) {
        if (counts[d] < minCount) {
          minCount = counts[d];
          targetDay = d;
        }
      }
    }

    if (targetDay) {
      updated[idx].dueDate = targetDay;
      counts[targetDay]++;
      rescheduledCount++;
    }
  }

  return { reviews: updated, rescheduledCount };
}

/**
 * Returns all active reviews due exactly on targetDateStr.
 */
export function getDueReviews(
  reviews: ScheduledReview[],
  targetDateStr: string,
): ScheduledReview[] {
  return reviews.filter((r) => !r.completed && r.dueDate === targetDateStr);
}

/** The review whose interval is this many days gets the model-written interview questions (once per problem). */
export const QUESTION_INTERVAL_DAYS = 28;

/** The review that carries the questions: the 28-day one, or for a custom list the first gap of 28+ days, else the last. */
export function questionStageIndex(intervals: readonly number[]): number {
  const i = intervals.findIndex((d) => d >= QUESTION_INTERVAL_DAYS);
  return i === -1 ? intervals.length - 1 : i;
}

/** True for the question review: stage 1 for default yellow (7/28/56), stage 2 for default red (7/14/28/56). */
export function isQuestionStage(status: "yellow" | "red", stage: number, custom?: readonly number[]): boolean {
  return stage === questionStageIndex(intervalsFor(status, custom));
}
