"use client";
import { createLocalStore, useLocalStore } from "./local-store";
import { normalizeStriver } from "./striver-normalize";
import {
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
    },
  };

  // If status is changed, update active reviews
  const updatedReviews = updateReviewsOnStatusChange(
    cur.reviews,
    problemId,
    status,
    new Date(now),
    clearPending,
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
