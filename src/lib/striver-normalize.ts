import type {
  ProblemProgress,
  StriverProblem,
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
    customProblems?: unknown;
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

  return { statuses, reviews, reminders: r.reminders !== false, customProblems: normalizeCustomProblems(r.customProblems) };
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const link = (v: unknown) => {
  const t = text(v, 500);
  return /^https?:\/\//i.test(t) ? t : null;
};

function normalizeCustomProblems(raw: unknown): StriverProblem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: StriverProblem[] = [];
  for (const item of raw.slice(0, 1000)) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const label = text(v.label, 200);
    const topic = text(v.topic, 100);
    const subtopic = text(v.subtopic, 100);
    const order = typeof v.order === "number" ? v.order : text(v.order, 20);
    if (!Number.isInteger(v.id) || seen.has(v.id as number) || !label || !topic || !subtopic || order === "") continue;
    seen.add(v.id as number);
    out.push({
      id: v.id as number,
      order,
      label,
      slug: text(v.slug, 200),
      topic,
      subtopic,
      topicPath: [topic, subtopic],
      difficulty: ["core", "easy", "medium", "hard"].includes(v.difficulty as string)
        ? (v.difficulty as StriverProblem["difficulty"])
        : "medium",
      leetcodeLink: link(v.leetcodeLink),
      youtubeLink: link(v.youtubeLink),
      articleLink: link(v.articleLink),
      isCustom: true,
    });
  }
  return out;
}
