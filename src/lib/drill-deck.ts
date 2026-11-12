import { DRILL_PATTERNS, type CardKind, type CardRecord, type DrillEntry, type DrillState, type Rating } from "./drill-types";
import type { ProblemStatus, StriverProblem } from "./striver-types";

export const CARD_KINDS: CardKind[] = ["intuition", "brute", "pattern", "complexity", "pitfall"];

export const KIND_LABEL: Record<CardKind, string> = {
  intuition: "Intuition",
  brute: "Brute force",
  pattern: "Pattern",
  complexity: "Complexity",
  pitfall: "Pitfall",
};

const DAY_MS = 86_400_000;
const MAX_PER_PROBLEM = 2;

/** Mulberry32: a small seeded generator, so a day's deck is reproducible and testable. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STATUS_WEIGHT: Record<ProblemStatus, number> = { red: 3, yellow: 2, green: 1, unattempted: 0.6 };
const RATING_WEIGHT: Record<Rating, number> = { 0: 2.5, 1: 1.6, 2: 0.6 };
/** Days before a card of that last rating is fully due again. */
const RECOVER_DAYS: Record<Rating, number> = { 0: 1, 1: 3, 2: 10 };
const NEVER_SEEN_WEIGHT = 1.5;

/** How much a card deserves a place in the deck: weak problems and weak, stale cards weigh more. */
export function cardWeight(status: ProblemStatus, rec: CardRecord | undefined, now: number): number {
  const s = STATUS_WEIGHT[status];
  if (!rec) return s * NEVER_SEEN_WEIGHT;
  const age = Math.max(0, (now - rec.at) / DAY_MS);
  const recency = Math.min(1, Math.max(0.05, age / RECOVER_DAYS[rec.rating]));
  return s * RATING_WEIGHT[rec.rating] * recency;
}

export type DeckCard = { problemId: number; kind: CardKind };

export type DeckOptions = {
  bank: Record<string, DrillEntry>;
  problems: StriverProblem[];
  statuses: Record<number, { status: ProblemStatus }>;
  drill: DrillState;
  /** "attempted" keeps to problems already marked green, yellow or red; "all" takes the whole sheet. */
  scope: "attempted" | "all";
  size: number;
  seed: string;
  now: number;
};

/** The problems a scope draws from (only those the bank covers). */
export function poolProblems(o: Pick<DeckOptions, "bank" | "problems" | "statuses" | "scope">): StriverProblem[] {
  return o.problems.filter((p) => {
    if (!o.bank[p.id]) return false;
    if (o.scope === "all") return true;
    const s = o.statuses[p.id]?.status ?? "unattempted";
    return s !== "unattempted";
  });
}

/**
 * Picks the day's cards by weighted sampling without replacement (Efraimidis-Spirakis), at most two cards per
 * problem so one problem cannot fill the deck, then shuffles the order.
 */
export function buildDeck(o: DeckOptions): DeckCard[] {
  const rand = rng(o.seed);
  const scored: { card: DeckCard; key: number }[] = [];
  for (const p of poolProblems(o)) {
    const status = o.statuses[p.id]?.status ?? "unattempted";
    for (const kind of CARD_KINDS) {
      const w = cardWeight(status, o.drill.cards[`${p.id}:${kind}`], o.now);
      scored.push({ card: { problemId: p.id, kind }, key: Math.pow(rand(), 1 / w) });
    }
  }
  scored.sort((a, b) => b.key - a.key);
  const perProblem = new Map<number, number>();
  const picked: DeckCard[] = [];
  for (const { card } of scored) {
    if (picked.length >= o.size) break;
    const n = perProblem.get(card.problemId) ?? 0;
    if (n >= MAX_PER_PROBLEM) continue;
    perProblem.set(card.problemId, n + 1);
    picked.push(card);
  }
  return shuffle(picked, rand);
}

/** Two notations of one complexity ("O(n^2)" and "O(n²)") must not both show up as options. */
export function canonComplexity(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/ⁿ/g, "^n")
    .replace(/\*/g, "")
    .replace(/log2/g, "log")
    .replace(/log₂/g, "log");
}

const FALLBACK_COMPLEXITY = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n^2)", "O(2^n)", "O(n!)"];

/** The right answer plus up to three wrong ones, shuffled. Wrong ones come from other problems in the bank. */
export function makeOptions(correct: string, pool: string[], rand: () => number, total = 4): string[] {
  const seen = new Set([canonComplexity(correct)]);
  const wrong: string[] = [];
  for (const c of shuffle([...new Set(pool)], rand).concat(shuffle(FALLBACK_COMPLEXITY, rand))) {
    const k = canonComplexity(c);
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push(c);
    if (wrong.length >= total - 1) break;
  }
  return shuffle([correct, ...wrong], rand);
}

/** Pattern options: the right one plus wrong ones, preferring patterns used elsewhere in the same topic. */
export function makePatternOptions(
  correct: string,
  sameTopic: string[],
  rand: () => number,
  total = 4,
): string[] {
  const wrong: string[] = [];
  const seen = new Set([correct]);
  for (const p of shuffle([...new Set(sameTopic)], rand).concat(shuffle([...DRILL_PATTERNS], rand))) {
    if (seen.has(p)) continue;
    seen.add(p);
    wrong.push(p);
    if (wrong.length >= total - 1) break;
  }
  return shuffle([correct, ...wrong], rand);
}

/** Grades a typed choice set: 2 when everything is right, 1 when half is, 0 otherwise. */
export function gradeChoices(right: number, total: number): Rating {
  return right === total ? 2 : right > 0 ? 1 : 0;
}

export function normalizeDrill(raw: unknown): DrillState {
  const r = (raw && typeof raw === "object" ? raw : {}) as { cards?: unknown; days?: unknown };
  const cards: DrillState["cards"] = {};
  if (r.cards && typeof r.cards === "object") {
    for (const [k, v] of Object.entries(r.cards)) {
      const [id, kind] = k.split(":");
      const c = v as Partial<CardRecord> | null;
      if (
        Number.isInteger(Number(id)) &&
        (CARD_KINDS as string[]).includes(kind) &&
        c &&
        (c.rating === 0 || c.rating === 1 || c.rating === 2) &&
        typeof c.at === "number"
      ) {
        cards[k] = { rating: c.rating, at: c.at, seen: typeof c.seen === "number" ? c.seen : 1 };
      }
    }
  }
  const days: DrillState["days"] = {};
  if (r.days && typeof r.days === "object") {
    for (const [d, n] of Object.entries(r.days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof n === "number" && n > 0) days[d] = Math.floor(n);
    }
  }
  return { cards, days };
}

/** Consecutive days up to today (or yesterday, if today is still empty) with at least one card done. */
export function streak(days: Record<string, number>, todayStr: string): number {
  const d = new Date(todayStr + "T00:00:00");
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (!days[fmt(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[fmt(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
