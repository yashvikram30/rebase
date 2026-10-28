export type ProblemStatus = "unattempted" | "green" | "yellow" | "red";

export type StriverProblem = {
  id: number;
  order: number;
  label: string;
  slug: string;
  topic: string;
  subtopic: string;
  topicPath: string[];
  difficulty: "core" | "easy" | "medium" | "hard";
  leetcodeLink?: string | null;
  youtubeLink?: string | null;
  articleLink?: string | null;
};

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

export const YELLOW_INTERVALS_DAYS = [7, 28] as const;
export const RED_INTERVALS_DAYS = [7, 14, 28] as const;
