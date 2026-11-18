"use client";
import { createLocalStore, useLocalStore } from "./local-store";
import { normalizeStriver } from "./striver-normalize";
import {
  addReview,
  createScheduleForProblem,
  removeReview,
  rescheduleMissedReviews,
  toDateString,
  updateReviewsOnStatusChange,
} from "./striver-schedule";
import { STRIVER_PROBLEMS } from "./striver-problems";
import type { ProblemStatus, StriverProblem, StriverStoreState } from "./striver-types";

const EMPTY: StriverStoreState = { statuses: {}, reviews: [], reminders: true, customProblems: [] };

const store = createLocalStore<StriverStoreState>("csplan.striver", EMPTY, normalizeStriver);
export const useStriver = () => useLocalStore(store);
export const getStriver = () => store.get();
export const setStriver = (s: StriverStoreState) => store.set(normalizeStriver(s));

export function setProblemStatus(
  problemId: number,
  status: ProblemStatus,
  notes?: string,
  /** Only for green: drop the reviews still queued instead of keeping them. */
  clearPending = false,
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
      intervals: cur.statuses[problemId]?.intervals,
    },
  };

  // If status is changed, update active reviews
  const updatedReviews = updateReviewsOnStatusChange(
    cur.reviews,
    problemId,
    status,
    new Date(now),
    clearPending,
    cur.statuses[problemId]?.intervals,
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

/**
 * Sets this problem's own review gaps in days (null goes back to the colour's default). A yellow or red problem
 * has its unfinished reviews rebuilt from today. A mastered problem has none by default, so a list gives it reviews
 * at those gaps and null clears the unfinished ones. Any other status just remembers the choice for next time.
 */
export function setProblemSchedule(problemId: number, intervals: number[] | null) {
  const cur = store.get();
  const now = Date.now();
  const existing = cur.statuses[problemId] ?? { status: "unattempted" as ProblemStatus, updatedAt: now };
  const next = { ...existing, intervals: intervals ?? undefined };
  let reviews = cur.reviews;
  if (existing.status === "yellow" || existing.status === "red") {
    reviews = updateReviewsOnStatusChange(cur.reviews, problemId, existing.status, new Date(now), false, intervals ?? undefined);
  } else if (existing.status === "green") {
    const kept = cur.reviews.filter((r) => r.problemId !== problemId || r.completed);
    reviews = intervals ? [...kept, ...createScheduleForProblem(problemId, "green", new Date(now), intervals)] : kept;
  }
  store.set({ ...cur, statuses: { ...cur.statuses, [problemId]: next }, reviews });
}

/** Adds one review on a date for a problem that has a colour. Returns an error message, or null when it was added. */
export function addProblemReview(problemId: number, dueDate: string): string | null {
  const cur = store.get();
  const status = cur.statuses[problemId]?.status;
  if (status !== "yellow" && status !== "red" && status !== "green") return "Mark the problem first.";
  const res = addReview(cur.reviews, problemId, status, dueDate, toDateString(new Date()));
  if (!res.added) return res.reason ?? "Could not add that review.";
  store.set({ ...cur, reviews: res.reviews });
  return null;
}

/** Removes one review of a problem. */
export function removeProblemReview(problemId: number, stage: number) {
  const cur = store.get();
  store.set({ ...cur, reviews: removeReview(cur.reviews, problemId, stage) });
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

export type NewCustomProblem = Omit<StriverProblem, "id" | "isCustom" | "slug">;

/** Adds a problem to the sheet. Ids count up from the highest one in use, so they never collide. */
export function addCustomProblem(p: NewCustomProblem): number {
  const cur = store.get();
  const maxId = Math.max(100000, ...STRIVER_PROBLEMS.map((x) => x.id), ...cur.customProblems.map((x) => x.id));
  const id = maxId + 1;
  const slug = p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  store.set({ ...cur, customProblems: [...cur.customProblems, { ...p, id, slug, isCustom: true }] });
  return id;
}

/** Removes a custom problem along with its status, notes and queued reviews. */
export function deleteCustomProblem(id: number) {
  const cur = store.get();
  const { [id]: _gone, ...statuses } = cur.statuses;
  void _gone;
  store.set({
    ...cur,
    customProblems: cur.customProblems.filter((p) => p.id !== id),
    statuses,
    reviews: cur.reviews.filter((r) => r.problemId !== id),
  });
}

/** One-time move of problems saved under the old separate key into the synced store. */
export function migrateLegacyCustomProblems() {
  if (typeof window === "undefined") return;
  const KEY = "csplan.striver.user_problems.v1";
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw);
    const cur = store.get();
    if (Array.isArray(legacy)) {
      const have = new Set(cur.customProblems.map((p) => p.id));
      const taken = new Set(STRIVER_PROBLEMS.map((p) => p.id));
      const fresh = legacy.filter((p) => p && !have.has(p.id) && !taken.has(p.id));
      if (fresh.length) setStriver({ ...cur, customProblems: [...cur.customProblems, ...fresh] });
    }
    localStorage.removeItem(KEY);
  } catch {
    // leave the old key in place if it cannot be read
  }
}
