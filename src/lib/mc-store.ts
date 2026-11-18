"use client";
import { MC_ITEMS } from "@/data/machine-coding";
import { createLocalStore, useLocalStore } from "./local-store";
import { EMPTY_MC, normalizeMc } from "./mc-normalize";
import { MAX_WEEKLY_GOAL, PROBLEM_STEPS, type McLang, type McState } from "./mc-types";

const store = createLocalStore<McState>("csplan.mc", EMPTY_MC, normalizeMc);
export const useMc = () => useLocalStore(store);
export const getMc = () => store.get();

const without = <T>(rec: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _gone, ...rest } = rec;
  void _gone;
  return rest;
};

/** Ticks or unticks a concept, pattern or method item. */
export function toggleItem(id: string) {
  const cur = store.get();
  const item = MC_ITEMS.find((i) => i.id === id);
  if (!item || item.kind === "problem") return;
  store.set({ ...cur, done: cur.done[id] ? without(cur.done, id) : { ...cur.done, [id]: Date.now() } });
}

/** Ticks or unticks one step of a problem. */
export function toggleStep(itemId: string, stepId: string) {
  const cur = store.get();
  if (!PROBLEM_STEPS.some((s) => s.id === stepId)) return;
  if (!MC_ITEMS.some((i) => i.id === itemId && i.kind === "problem")) return;
  const mine = cur.steps[itemId] ?? {};
  const next = mine[stepId] ? without(mine, stepId) : { ...mine, [stepId]: Date.now() };
  const steps = Object.keys(next).length ? { ...cur.steps, [itemId]: next } : without(cur.steps, itemId);
  store.set({ ...cur, steps });
}

export function toggleGate(phaseId: string) {
  const cur = store.get();
  store.set({
    ...cur,
    gates: cur.gates[phaseId] ? without(cur.gates, phaseId) : { ...cur.gates, [phaseId]: Date.now() },
  });
}

export function setNote(id: string, text: string) {
  const cur = store.get();
  store.set({
    ...cur,
    notes: text.trim() ? { ...cur.notes, [id]: text.slice(0, 4000) } : without(cur.notes, id),
  });
}

export function setLang(lang: McLang) {
  store.set({ ...store.get(), lang });
}

export function setWeeklyGoal(goal: number) {
  store.set({ ...store.get(), weeklyGoal: Math.min(MAX_WEEKLY_GOAL, Math.max(1, Math.round(goal))) });
}

export function resetMc() {
  store.set({ ...EMPTY_MC, lang: store.get().lang, weeklyGoal: store.get().weeklyGoal });
}
