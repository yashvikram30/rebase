export type McLang = "python" | "cpp";

export type McResource = {
  label: string;
  url: string;
  kind: "video" | "read" | "code";
  /** The language the resource is written in. "java" and untagged ones always show; python and cpp follow the language picker. */
  lang?: "java" | "python" | "cpp";
  /** Anything the reader should know before clicking, such as an unconfirmed channel. */
  note?: string;
};

export type McItemKind = "concept" | "pattern" | "method" | "problem";

export type McItem = {
  id: string;
  kind: McItemKind;
  title: string;
  summary: string;
  /** Rough study time in minutes, shown on the row. */
  minutes?: number;
  resources: McResource[];
  /** Problems only: the patterns it exercises. */
  patterns?: string[];
};

export type McPhase = {
  id: string;
  title: string;
  blurb: string;
  /** A self-check the learner ticks when the phase is truly done. */
  gate: string;
  items: McItem[];
};

export type McLevelId = "sde1" | "sde2" | "beyond";

export type McLevel = {
  id: McLevelId;
  name: string;
  tagline: string;
  /** Rough pace, at about 1.5 hours a day. */
  weeks: string;
  /** What the learner can do by the end of the level. */
  know: string[];
  phases: McPhase[];
};

export type McStep = { id: string; label: string; hint: string; dueAfterDays?: number };

/** Every problem is worked through the same loop. The two timed steps come due relative to the cold attempt. */
export const PROBLEM_STEPS: McStep[] = [
  {
    id: "attempt",
    label: "Attempt cold, timed",
    hint: "90 minutes, no reference. Requirements, design, runnable code, a driver.",
  },
  {
    id: "compare",
    label: "Compare and note the mess",
    hint: "Read a reference solution. Write down where your design got messy.",
  },
  {
    id: "refactor",
    label: "Refactor with the pattern you missed",
    hint: "Apply it in your own code, not by copying the reference.",
  },
  {
    id: "day7",
    label: "Rewrite in your other language",
    hint: "A week later, from scratch, in the language you did not use.",
    dueAfterDays: 7,
  },
  {
    id: "day28",
    label: "Timed re-attempt",
    hint: "Four weeks after the first try. Same 90 minutes.",
    dueAfterDays: 28,
  },
];

export const DEFAULT_WEEKLY_GOAL = 3;
export const MAX_WEEKLY_GOAL = 14;

export type McState = {
  lang: McLang;
  /** Ticks needed in a Monday-to-Sunday week for it to count towards the week streak. */
  weeklyGoal: number;
  /** Item id -> when it was ticked. Used for concept, pattern and method items. */
  done: Record<string, number>;
  /** Problem id -> step id -> when it was ticked. */
  steps: Record<string, Record<string, number>>;
  notes: Record<string, string>;
  /** Phase id -> when its self-check was ticked. */
  gates: Record<string, number>;
};
