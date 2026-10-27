"use client";
import { createLocalStore, useLocalStore } from "./local-store";
import {
  rescheduleMissedReviews,
  toDateString,
  updateReviewsOnStatusChange,
} from "./striver-schedule";
import type {
  ProblemProgress,
  ProblemStatus,
  ScheduledReview,
  StriverStoreState,
} from "./striver-types";

const EMPTY: StriverStoreState = {
  statuses: {},
  reviews: [],
  email: undefined,
};

export function normalizeStriver(raw: unknown): StriverStoreState {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    statuses?: unknown;
    reviews?: unknown;
    email?: unknown;
  };

  const statuses: Record<number, ProblemProgress> = {};
  if (r.statuses && typeof r.statuses === "object") {
    for (const [idStr, val] of Object.entries(r.statuses)) {
      const pid = Number(idStr);
      const v = val as Partial<ProblemProgress> | null;
      if (
        Number.isInteger(pid) &&
        v &&
        ["unattempted", "green", "yellow", "red"].includes(v.status as string)
      ) {
        statuses[pid] = {
          status: v.status as ProblemStatus,
          updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
          notes: typeof v.notes === "string" ? v.notes.slice(0, 4000) : undefined,
        };
      }
    }
  }

  const reviews: ScheduledReview[] = [];
  if (Array.isArray(r.reviews)) {
    for (const item of r.reviews) {
      if (
        item &&
        typeof item.problemId === "number" &&
        ["yellow", "red"].includes(item.status) &&
        typeof item.dueDate === "string" &&
        typeof item.stage === "number"
      ) {
        reviews.push({
          problemId: item.problemId,
          status: item.status,
          stage: item.stage,
          dueDate: item.dueDate,
          scheduledFor: item.scheduledFor || item.dueDate,
          completed: item.completed === true,
          completedAt: typeof item.completedAt === "number" ? item.completedAt : undefined,
        });
      }
    }
  }

  const email = typeof r.email === "string" && r.email.includes("@") ? r.email : undefined;

  return { statuses, reviews, email };
}

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

export function setUserEmail(email: string) {
  const cur = store.get();
  store.set({ ...cur, email });
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
