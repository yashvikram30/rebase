/** Which part of a course day a link points at. */
export type Slot = "main" | "engineering" | "dsa";

/** A day of the Learn course, by week and day number, and the part of it that covers the concept. */
export type CourseDay = { week: number; day: number; slot: Slot };

const day = (week: number, d: number, slot: Slot = "main"): CourseDay => ({ week, day: d, slot });

/**
 * What each concept tag on a debugging scenario means in the course. The report links to these days, and a
 * test checks every one exists in the curriculum. DSA links are kept here but not shown while the course
 * hides its DSA step (see DSA_ENABLED in lib/day-steps.ts), so nobody is sent to a page they cannot open.
 */
export const CONCEPTS: Record<string, { label: string; days: CourseDay[] }> = {
  "graph-traversal": { label: "Graph traversal", days: [day(11, 3, "dsa")] },
  "visited-set": { label: "Tracking visited nodes", days: [day(11, 3, "dsa"), day(12, 1, "dsa")] },
  "recursion-call-stack": { label: "Recursion and the call stack", days: [day(1, 4), day(1, 2, "dsa")] },
  "global-state": { label: "Shared and global state", days: [day(8, 1, "engineering"), day(11, 1)] },
  "grid-coordinates": { label: "Grids and coordinates", days: [day(11, 4, "dsa"), day(12, 4, "dsa")] },
  "shortest-path-bfs": { label: "Shortest paths with BFS", days: [day(11, 4, "dsa"), day(12, 3, "dsa")] },
  "path-reconstruction": { label: "Rebuilding a path from parents", days: [day(12, 3, "dsa")] },
  "aliasing-mutable-state": { label: "Aliasing and mutable objects", days: [day(1, 2), day(1, 1)] },
  "python-defaults": { label: "Python default arguments", days: [day(1, 1)] },
  "off-by-one": { label: "Off-by-one errors", days: [day(2, 3, "engineering"), day(1, 3, "dsa")] },
  "sliding-window": { label: "Sliding windows", days: [day(6, 3, "dsa"), day(6, 4, "dsa")] },
  "early-return": { label: "Control flow and early returns", days: [day(1, 1)] },
  "hashing-dedupe": { label: "Hashing and de-duplication", days: [day(2, 3, "dsa")] },
  "boundary-conditions": {
    label: "Boundary conditions",
    days: [day(8, 1, "engineering"), day(2, 3, "engineering"), day(1, 3, "dsa")],
  },
  "lru-cache": { label: "LRU caches", days: [day(8, 4, "dsa")] },
  "cache-eviction": {
    label: "Cache eviction",
    days: [day(2, 1), day(16, 1, "engineering"), day(8, 4, "dsa")],
  },
  "bounded-memory-streaming": { label: "Streaming with bounded memory", days: [day(7, 1), day(7, 2, "dsa")] },
  "edge-case-testing": { label: "Testing edge cases", days: [day(2, 3, "engineering"), day(11, 2)] },
  "rate-limiting": { label: "Rate limiting", days: [day(6, 2), day(14, 4)] },
  "retries-backoff": { label: "Retries and backoff", days: [day(10, 3), day(5, 2, "engineering")] },
  idempotency: { label: "Idempotency", days: [day(10, 3), day(15, 2, "engineering")] },
  "defensive-copying": { label: "Copying data you do not own", days: [day(11, 1), day(1, 2)] },
  "equality-hashing": { label: "Equality and hashing", days: [day(11, 1), day(1, 1)] },
  "check-then-act-races": { label: "Check-then-act races", days: [day(4, 1), day(4, 1, "engineering")] },
  "deadlock-lock-ordering": { label: "Deadlock and lock ordering", days: [day(4, 2)] },
  "falsy-vs-missing": { label: "Falsy values versus missing ones", days: [day(1, 1)] },
  "event-time-watermark": { label: "Event time and watermarks", days: [day(9, 2)] },
  "n-plus-one-queries": { label: "N+1 queries", days: [day(7, 2, "engineering"), day(8, 4)] },
  "lost-update": { label: "Lost updates and optimistic locking", days: [day(8, 2), day(8, 3)] },
  "chunking-overlap": { label: "Chunking and overlap for retrieval", days: [day(15, 2)] },
  "citation-offsets": { label: "Citations and source offsets", days: [day(15, 3)] },
  "floating-point-money": { label: "Floats, decimals and money", days: [day(1, 2)] },
  "integer-division": { label: "Integer and float division", days: [day(1, 2)] },
  "keyset-pagination": { label: "Paginating by a unique key", days: [day(7, 2), day(8, 4)] },
  "config-parsing": { label: "Reading configuration safely", days: [day(11, 4), day(1, 1)] },
  "closures-late-binding": { label: "Closures and late binding", days: [day(1, 4)] },
  "path-traversal": { label: "Path traversal and file access", days: [day(6, 4)] },
  "mutation-during-iteration": {
    label: "Changing a list while looping over it",
    days: [day(1, 2), day(1, 1)],
  },
  timezones: { label: "Time zones and calendar days", days: [day(9, 2)] },
  // Process concepts the report can point to whatever the scenario was.
  "debugging-process": {
    label: "Debugging method",
    days: [day(1, 4, "engineering"), day(8, 2, "engineering")],
  },
  "regression-testing": { label: "Regression testing", days: [day(11, 2), day(8, 3, "engineering")] },
};

export const conceptLabel = (tag: string) => CONCEPTS[tag]?.label ?? tag;
