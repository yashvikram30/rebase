"use client";
import { createLocalStore, useLocalStore } from "./local-store";

/** One finished review of a pre-recorded agent session. */
export type ReviewRecord = {
  at: number;
  /** Did the reviewer accept the agent's final fix? */
  accepted: boolean;
  /** Was that the right call? */
  correct: boolean;
  /** Did they run the regression suite on the agent's patch before deciding? */
  ranRegression: boolean;
  notes: string;
};

/** A case solved in the workbench: when, and how long the round took. */
export type SolveRecord = { at: number; ms: number };

/** What the debugging round remembers on this device. Sessions and reports join this in a later phase. */
export type DebugState = { reviews: Record<string, ReviewRecord>; solves: Record<string, SolveRecord> };
const EMPTY: DebugState = { reviews: {}, solves: {} };

export function normalizeDebug(raw: unknown): DebugState {
  const r = (raw && typeof raw === "object" ? raw : {}) as { reviews?: unknown; solves?: unknown };
  const reviews: DebugState["reviews"] = {};
  const solves: DebugState["solves"] = {};
  if (r.solves && typeof r.solves === "object")
    for (const [id, v] of Object.entries(r.solves)) {
      const x = v as Partial<SolveRecord> | null;
      if (x && Number.isFinite(x.at) && Number.isFinite(x.ms) && x.ms! >= 0)
        solves[id] = { at: x.at!, ms: x.ms! };
    }
  if (r.reviews && typeof r.reviews === "object")
    for (const [id, v] of Object.entries(r.reviews)) {
      const x = v as Partial<ReviewRecord> | null;
      if (x && typeof x.at === "number" && typeof x.accepted === "boolean" && typeof x.correct === "boolean")
        reviews[id] = {
          at: x.at,
          accepted: x.accepted,
          correct: x.correct,
          ranRegression: x.ranRegression === true,
          notes: typeof x.notes === "string" ? x.notes.slice(0, 4000) : "",
        };
    }
  return { reviews, solves };
}

const store = createLocalStore<DebugState>("csplan.debug", EMPTY, normalizeDebug);
export const useDebug = () => useLocalStore(store);

export function recordReview(id: string, review: ReviewRecord) {
  const cur = store.get();
  store.set({ ...cur, reviews: { ...cur.reviews, [id]: review } });
}

export function recordSolve(id: string, ms: number) {
  const cur = store.get();
  // Keep the first solve: replaying a case should not overwrite the original time.
  if (cur.solves[id]) return;
  store.set({ ...cur, solves: { ...cur.solves, [id]: { at: Date.now(), ms } } });
}
