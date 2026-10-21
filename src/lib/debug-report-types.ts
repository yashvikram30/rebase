/** What the mentor report says, shared by the server that builds it and the page that shows it. */
export type Rating = "strong" | "fair" | "weak" | "not shown";

export const DIMENSIONS = [
  ["reproduce", "Reproducing the bug"],
  ["hypothesis", "Forming a hypothesis"],
  ["minimalFix", "Keeping the fix small"],
  ["verify", "Checking the fix"],
  ["explain", "Explaining the cause"],
  ["skepticism", "Questioning the assistant"],
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number][0];

export type Dimension = { rating: Rating; evidence: string };

/** A topic or video the model suggests. Not checked: the page shows a search link, never the model's own URL. */
export type Suggestion = { kind: "topic" | "video"; title: string; why: string };

export type Report = {
  summary: string;
  dimensions: Record<DimensionKey, Dimension>;
  strengths: string[];
  improvements: string[];
  aiUsage: { summary: string; overReliance: boolean };
  revisit: Suggestion[];
};

/** Course days to revisit for one concept, from the verified map. */
export type CourseRec = { tag: string; label: string; days: { href: string; label: string }[] };

export type StoredReport = {
  at: number;
  /** "mentor" when the model wrote it, "basic" for the built-in report. */
  source: "mentor" | "basic";
  note?: string;
  report: Report;
  course: CourseRec[];
  explanation: string;
};
