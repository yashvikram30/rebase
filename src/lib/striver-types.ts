export type ProblemStatus = "unattempted" | "green" | "yellow" | "red";

export type StriverProblem = {
  id: number;
  order: number | string;
  label: string;
  slug: string;
  topic: string;
  subtopic: string;
  topicPath: string[];
  difficulty: "core" | "easy" | "medium" | "hard";
  leetcodeLink?: string | null;
  youtubeLink?: string | null;
  articleLink?: string | null;
  isCustom?: boolean;
};

/**
 * Natural numeric comparator for decimal/sub-version problem numbers.
 * Correctly orders: 18, 18.1, 18.2, 18.10, 19, 20, 20.1, 20.2, 21.
 */
export function compareProblemNumbers(a: number | string, b: number | string): number {
  const parsePart = (p: string) => {
    const n = Number(p);
    return isNaN(n) ? p : n;
  };
  const partsA = String(a).split(".").map(parsePart);
  const partsB = String(b).split(".").map(parsePart);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pA = partsA[i];
    const pB = partsB[i];
    if (pA === undefined) return -1;
    if (pB === undefined) return 1;
    if (typeof pA === "number" && typeof pB === "number") {
      if (pA !== pB) return pA - pB;
    } else {
      const s = String(pA).localeCompare(String(pB), undefined, { numeric: true });
      if (s !== 0) return s;
    }
  }
  return 0;
}

export type ProblemProgress = {
  status: ProblemStatus;
  updatedAt: number;
  notes?: string;
};

export type ScheduledReview = {
  problemId: number;
  status: "yellow" | "red";
  stage: number; // 0 = 7d, 1 = 14d (red only), 2 = 28d
  dueDate: string; // "YYYY-MM-DD"
  scheduledFor: string; // Original target date
  completed: boolean;
  completedAt?: number;
};

export type StriverStoreState = {
  statuses: Record<number, ProblemProgress>;
  reviews: ScheduledReview[];
  /** Daily revision email to the signed-in account's address. On unless the user turns it off. */
  reminders: boolean;
};

export const YELLOW_INTERVALS_DAYS = [7, 28, 56] as const;
export const RED_INTERVALS_DAYS = [7, 14, 28, 56] as const;
