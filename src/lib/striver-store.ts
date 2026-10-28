"use client";
import { createLocalStore, useLocalStore } from "./local-store";
import { normalizeStriver } from "./striver-normalize";
import {
  rescheduleMissedReviews,
  toDateString,
  updateReviewsOnStatusChange,
} from "./striver-schedule";
import type { ProblemStatus, StriverStoreState } from "./striver-types";

const EMPTY: StriverStoreState = { statuses: {}, reviews: [], reminders: true };

const store = createLocalStore<StriverStoreState>("csplan.striver", EMPTY, normalizeStriver);
export const useStriver = () => useLocalStore(store);
export const getStriver = () => store.get();
export const setStriver = (s: StriverStoreState) => store.set(normalizeStriver(s));

export function setProblemStatus(
  problemId: number,
  status: ProblemStatus,
  notes?: string,
) {
  const cur = store.get();
  const now = Date.now();
  const todayStr = toDateString(new Date(now));

  // Clicking the status a problem already has must not restart its schedule, unless a review is due.
  const sameStatus = (cur.statuses[problemId]?.status ?? "unattempted") === status;
  const reviewDue = cur.reviews.some((r) => r.problemId === problemId && !r.completed && r.dueDate <= todayStr);
  if (sameStatus && !reviewDue && notes === undefined) return;

  // Update status record
  const statuses = {
    ...cur.statuses,
    [problemId]: {
      status,
      updatedAt: now,
      notes: notes !== undefined ? notes : cur.statuses[problemId]?.notes,
    },
  };

  // If status is changed, update active reviews
  const updatedReviews = updateReviewsOnStatusChange(
    cur.reviews,
    problemId,
    status,
    new Date(now),
  );

  // If there was an active review due today or overdue for this problem, mark it as completed
  const finalReviews = updatedReviews.map((r) => {
    if (r.problemId === problemId && !r.completed && r.dueDate <= todayStr) {
      return { ...r, completed: true, completedAt: now };
    }
    return r;
  });

  store.set({ ...cur, statuses, reviews: finalReviews });
}

export function saveProblemNotes(problemId: number, notes: string) {
  const cur = store.get();
  const existing = cur.statuses[problemId];
  if (!existing) {
    store.set({
      ...cur,
      statuses: {
        ...cur.statuses,
        [problemId]: { status: "unattempted", updatedAt: Date.now(), notes },
      },
    });
  } else {
    store.set({
      ...cur,
      statuses: {
        ...cur.statuses,
        [problemId]: { ...existing, notes, updatedAt: Date.now() },
      },
    });
  }
}

export function setReminders(reminders: boolean) {
  store.set({ ...store.get(), reminders });
}

/**
 * Checks for any missed overdue reviews and auto-reschedules them according to the 0-problem day rule.
 */
export function checkAndLevelMissedReviews(): number {
  const cur = store.get();
  const todayStr = toDateString(new Date());
  const { reviews, rescheduledCount } = rescheduleMissedReviews(cur.reviews, todayStr);
  if (rescheduledCount > 0) {
    store.set({ ...cur, reviews });
  }
  return rescheduledCount;
}
