import { MC_ITEMS, MC_PHASES } from "@/data/machine-coding";
import { DEFAULT_WEEKLY_GOAL, MAX_WEEKLY_GOAL, PROBLEM_STEPS, type McState } from "./mc-types";

export const EMPTY_MC: McState = {
  lang: "python",
  weeklyGoal: DEFAULT_WEEKLY_GOAL,
  done: {},
  steps: {},
  notes: {},
  gates: {},
};

const isTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Reads whatever was stored and keeps only ids that still exist in the curriculum, so a reworded plan never breaks old progress. */
export function normalizeMc(raw: unknown): McState {
  const r = isRecord(raw) ? raw : {};
  const itemIds = new Set(MC_ITEMS.map((i) => i.id));
  const problemIds = new Set(MC_ITEMS.filter((i) => i.kind === "problem").map((i) => i.id));
  const phaseIds = new Set(MC_PHASES.map((p) => p.id));
  const stepIds = new Set(PROBLEM_STEPS.map((s) => s.id));

  const done: McState["done"] = {};
  if (isRecord(r.done)) {
    for (const [id, t] of Object.entries(r.done)) {
      if (itemIds.has(id) && !problemIds.has(id) && isTime(t)) done[id] = t;
    }
  }

  const steps: McState["steps"] = {};
  if (isRecord(r.steps)) {
    for (const [id, map] of Object.entries(r.steps)) {
      if (!problemIds.has(id) || !isRecord(map)) continue;
      const kept: Record<string, number> = {};
      for (const [sid, t] of Object.entries(map)) if (stepIds.has(sid) && isTime(t)) kept[sid] = t;
      if (Object.keys(kept).length) steps[id] = kept;
    }
  }

  const notes: McState["notes"] = {};
  if (isRecord(r.notes)) {
    for (const [id, text] of Object.entries(r.notes)) {
      if (itemIds.has(id) && typeof text === "string" && text.trim()) notes[id] = text.slice(0, 4000);
    }
  }

  const gates: McState["gates"] = {};
  if (isRecord(r.gates)) {
    for (const [id, t] of Object.entries(r.gates)) if (phaseIds.has(id) && isTime(t)) gates[id] = t;
  }

  const goal =
    typeof r.weeklyGoal === "number" && Number.isInteger(r.weeklyGoal) ? r.weeklyGoal : DEFAULT_WEEKLY_GOAL;
  const weeklyGoal = Math.min(MAX_WEEKLY_GOAL, Math.max(1, goal));

  return { lang: r.lang === "cpp" ? "cpp" : "python", weeklyGoal, done, steps, notes, gates };
}
