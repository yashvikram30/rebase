"use client";
import { createLocalStore, useLocalStore } from "./local-store";
import { normalizeDrill } from "./drill-deck";
import type { CardKind, DrillState, Rating } from "./drill-types";
import { toDateString } from "./striver-schedule";

const EMPTY: DrillState = { cards: {}, days: {} };

const store = createLocalStore<DrillState>("csplan.drill", EMPTY, normalizeDrill);
export const useDrill = () => useLocalStore(store);
export const getDrill = () => store.get();

/** Saves how one card went and counts it toward today. */
export function recordCard(problemId: number, kind: CardKind, rating: Rating) {
  const cur = store.get();
  const now = Date.now();
  const key = `${problemId}:${kind}`;
  const today = toDateString(new Date(now));
  store.set({
    cards: { ...cur.cards, [key]: { rating, at: now, seen: (cur.cards[key]?.seen ?? 0) + 1 } },
    days: { ...cur.days, [today]: (cur.days[today] ?? 0) + 1 },
  });
}
