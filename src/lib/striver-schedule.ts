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

/**
 * Creates scheduled reviews for a newly classified problem.
 * Yellow: +7d, +28d
 * Red: +7d, +14d, +28d
 */
export function createScheduleForProblem(
  problemId: number,
  status: "yellow" | "red",
  fromDate: Date = new Date(),
): ScheduledReview[] {
  const intervals = status === "yellow" ? YELLOW_INTERVALS_DAYS : RED_INTERVALS_DAYS;
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
    };
  });
}

/**
 * Updates an existing review list when a problem's status changes.
 * - If green / unattempted: clears all active uncompleted reviews for this problem.
 * - If yellow / red: clears uncompleted reviews for this problem and creates the new schedule.
 */
export function updateReviewsOnStatusChange(
  currentReviews: ScheduledReview[],
  problemId: number,
  newStatus: ProblemStatus,
  fromDate: Date = new Date(),
): ScheduledReview[] {
  // Keep reviews for other problems, and keep completed reviews for history
  const filtered = currentReviews.filter((r) => r.problemId !== problemId || r.completed);

  if (newStatus === "green" || newStatus === "unattempted") {
    return filtered;
  }

  const newReviews = createScheduleForProblem(problemId, newStatus, fromDate);
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
