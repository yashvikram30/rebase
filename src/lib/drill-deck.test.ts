import { describe, expect, it } from "vitest";
import {
  buildDeck,
  canonComplexity,
  cardWeight,
  gradeChoices,
  makeOptions,
  makePatternOptions,
  normalizeDrill,
  rng,
  streak,
} from "./drill-deck";
import type { DrillEntry } from "./drill-types";
import type { StriverProblem } from "./striver-types";

const entry = (id: number, time = "O(n)"): DrillEntry => ({
  id,
  idea: "i",
  brute: "b",
  pattern: "Two pointers",
  time,
  space: "O(1)",
  whyComplexity: "w",
  pitfall: "p",
});
const problem = (id: number): StriverProblem => ({
  id,
  order: id,
  label: `P${id}`,
  slug: `p${id}`,
  topic: "Arrays",
  subtopic: "x",
  topicPath: ["Arrays", "x"],
  difficulty: "core",
});
const bank = Object.fromEntries([1, 2, 3, 4].map((i) => [i, entry(i)]));
const problems = [1, 2, 3, 4].map(problem);
const NOW = Date.UTC(2026, 10, 13);

describe("buildDeck", () => {
  const base = { bank, problems, drill: { cards: {}, days: {} }, size: 6, seed: "a", now: NOW };

  it("keeps to attempted problems and is reproducible for a seed", () => {
    const statuses = { 1: { status: "red" as const }, 2: { status: "green" as const } };
    const a = buildDeck({ ...base, statuses, scope: "attempted" });
    expect(a.every((c) => c.problemId === 1 || c.problemId === 2)).toBe(true);
    expect(buildDeck({ ...base, statuses, scope: "attempted" })).toEqual(a);
    expect(buildDeck({ ...base, statuses, scope: "attempted", seed: "b" })).not.toEqual(a);
  });

  it("never puts more than two cards of one problem in a deck, nor repeats a card", () => {
    const deck = buildDeck({ ...base, statuses: { 1: { status: "red" } }, scope: "all", size: 8 });
    const per: Record<number, number> = {};
    for (const c of deck) per[c.problemId] = (per[c.problemId] ?? 0) + 1;
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(2);
    expect(new Set(deck.map((c) => `${c.problemId}:${c.kind}`)).size).toBe(deck.length);
  });

  it("is empty when nothing has been attempted", () => {
    expect(buildDeck({ ...base, statuses: {}, scope: "attempted" })).toEqual([]);
  });
});

describe("cardWeight", () => {
  it("weighs a red problem above a green one and a missed card above a known one", () => {
    expect(cardWeight("red", undefined, NOW)).toBeGreaterThan(cardWeight("green", undefined, NOW));
    const missed = { rating: 0 as const, at: NOW - 3 * 86_400_000, seen: 1 };
    const known = { rating: 2 as const, at: NOW - 3 * 86_400_000, seen: 1 };
    expect(cardWeight("yellow", missed, NOW)).toBeGreaterThan(cardWeight("yellow", known, NOW));
  });
  it("lets a card just answered fade, then come back", () => {
    const rec = { rating: 2 as const, at: NOW, seen: 1 };
    const fresh = cardWeight("yellow", rec, NOW);
    expect(cardWeight("yellow", rec, NOW + 12 * 86_400_000)).toBeGreaterThan(fresh * 5);
  });
});

describe("options", () => {
  it("includes the answer once, and no other spelling of it", () => {
    const opts = makeOptions("O(n^2)", ["O(n²)", "O(n)", "O(log n)", "O(1)"], rng("x"));
    expect(opts).toHaveLength(4);
    expect(opts.filter((o) => canonComplexity(o) === canonComplexity("O(n^2)"))).toHaveLength(1);
  });
  it("still gives four options from a tiny pool", () => {
    expect(makeOptions("O(V + E)", [], rng("y"))).toHaveLength(4);
  });
  it("offers distinct patterns including the right one", () => {
    const opts = makePatternOptions("Two pointers", ["Sliding window"], rng("z"));
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain("Two pointers");
  });
});

describe("grading, normalising and streaks", () => {
  it("grades a choice set", () => {
    expect([gradeChoices(2, 2), gradeChoices(1, 2), gradeChoices(0, 2)]).toEqual([2, 1, 0]);
  });
  it("drops junk from saved state", () => {
    const s = normalizeDrill({
      cards: { "1:pattern": { rating: 2, at: 5 }, "x:pattern": { rating: 2, at: 5 }, "1:nope": { rating: 2, at: 5 }, "2:brute": { rating: 9, at: 5 } },
      days: { "2026-11-13": 3, bad: 2 },
    });
    expect(Object.keys(s.cards)).toEqual(["1:pattern"]);
    expect(s.days).toEqual({ "2026-11-13": 3 });
  });
  it("counts consecutive days, allowing today to be empty", () => {
    const days = { "2026-11-11": 2, "2026-11-12": 1 };
    expect(streak(days, "2026-11-13")).toBe(2);
    expect(streak({ ...days, "2026-11-13": 4 }, "2026-11-13")).toBe(3);
    expect(streak({}, "2026-11-13")).toBe(0);
  });
});
