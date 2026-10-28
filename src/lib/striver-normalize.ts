import type {
  ProblemProgress,
  ProblemStatus,
  ScheduledReview,
  StriverStoreState,
} from "./striver-types";

/** Kept apart from the client store so the cron and API routes can import it on the server. */
export function normalizeStriver(raw: unknown): StriverStoreState {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    statuses?: unknown;
    reviews?: unknown;
    reminders?: unknown;
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

  return { statuses, reviews, reminders: r.reminders !== false };
}
