/** Fixed pattern names, so the "which technique" card can draw distractors from a closed, sensible list. */
export const DRILL_PATTERNS = [
  "Brute force enumeration",
  "Hashing / frequency map",
  "Prefix sum",
  "Two pointers",
  "Sliding window",
  "Binary search",
  "Binary search on the answer",
  "Sorting + scan",
  "Greedy",
  "Stack / monotonic stack",
  "Queue / deque",
  "Heap / priority queue",
  "Recursion",
  "Backtracking",
  "Divide and conquer",
  "Dynamic programming",
  "Linked list pointer manipulation",
  "Fast and slow pointers",
  "Tree traversal (DFS)",
  "Tree traversal (BFS / level order)",
  "Binary search tree property",
  "Graph BFS",
  "Graph DFS",
  "Topological sort",
  "Shortest path (Dijkstra / Bellman-Ford)",
  "Union-Find",
  "Minimum spanning tree",
  "Trie",
  "Bit manipulation",
  "Math / number theory",
  "Simulation / in-place rearrangement",
] as const;

/** What the drill knows about one problem. Written once offline (scripts/build-drill.ts) and checked by hand. */
export type DrillEntry = {
  id: number;
  /** The key insight, in one or two sentences, with no code. */
  idea: string;
  /** The obvious first attempt and why it is too slow or wrong. */
  brute: string;
  /** One of DRILL_PATTERNS. */
  pattern: string;
  time: string;
  space: string;
  /** One sentence on why the time and space are what they are. */
  whyComplexity: string;
  /** The edge case or mistake that most often breaks a solution. */
  pitfall: string;
};

export type CardKind = "intuition" | "brute" | "pattern" | "complexity" | "pitfall";

/** Self-rating after revealing an answer: 0 missed, 1 partly, 2 got it. */
export type Rating = 0 | 1 | 2;

export type CardRecord = { rating: Rating; at: number; seen: number };

export type DrillState = {
  /** Keyed "<problemId>:<kind>". */
  cards: Record<string, CardRecord>;
  /** Cards finished per local day, "YYYY-MM-DD". */
  days: Record<string, number>;
};
