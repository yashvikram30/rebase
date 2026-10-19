import { describe, expect, it } from "vitest";
import { pickWeighted, type Candidate } from "./random-pick";

const a: Candidate = { id: "a", slug: "sa", difficulty: 1 };
const b: Candidate = { id: "b", slug: "sb", difficulty: 2 };
const c: Candidate = { id: "c", slug: "sc", difficulty: 3 };

describe("pickWeighted", () => {
  it("favours cases that are not solved: four to one", () => {
    const solved = new Set(["b"]);
    expect(pickWeighted([a, b], solved, null, () => 0)?.id).toBe("a");
    expect(pickWeighted([a, b], solved, null, () => 0.79)?.id).toBe("a");
    expect(pickWeighted([a, b], solved, null, () => 0.8)?.id).toBe("b");
    expect(pickWeighted([a, b], solved, null, () => 0.999)?.id).toBe("b");
  });

  it("does not repeat the last case when there is a choice", () => {
    for (const r of [0, 0.3, 0.6, 0.99])
      expect(pickWeighted([a, b, c], new Set(), "a", () => r)?.id).not.toBe("a");
  });

  it("still returns the only case there is, even if it was the last", () => {
    expect(pickWeighted([a], new Set(), "a", () => 0.5)?.id).toBe("a");
  });

  it("returns null for an empty pool", () => {
    expect(pickWeighted([], new Set(), null, () => 0.5)).toBeNull();
  });

  it("can reach every case", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(pickWeighted([a, b, c], new Set(), null, () => i / 100)!.id);
    expect(seen).toEqual(new Set(["a", "b", "c"]));
  });
});
