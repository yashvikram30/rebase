export type Candidate = { id: string; slug: string; difficulty: number };

/** Unsolved cases are drawn four times as often as ones already solved. */
const UNSOLVED_WEIGHT = 4;
const SOLVED_WEIGHT = 1;

/**
 * Picks a case at random, favouring ones not solved yet and avoiding an immediate repeat.
 * `rng` returns a number in [0, 1); it is a parameter so the draw can be tested.
 */
export function pickWeighted(
  cases: Candidate[],
  solved: ReadonlySet<string>,
  last: string | null,
  rng: () => number,
): Candidate | null {
  const pool = cases.length > 1 ? cases.filter((c) => c.id !== last) : cases;
  if (pool.length === 0) return null;
  const weight = (c: Candidate) => (solved.has(c.id) ? SOLVED_WEIGHT : UNSOLVED_WEIGHT);
  const total = pool.reduce((sum, c) => sum + weight(c), 0);
  let r = rng() * total;
  for (const c of pool) {
    r -= weight(c);
    if (r < 0) return c;
  }
  return pool[pool.length - 1];
}
