import { describe, expect, it } from "vitest";
import { diffStats, lineDiff, withContext } from "./line-diff";

describe("lineDiff", () => {
  it("marks identical text as unchanged", () => {
    expect(lineDiff("a\nb\n", "a\nb\n").every((l) => l.kind === "same")).toBe(true);
  });

  it("reports a replaced line as a removal then an addition", () => {
    expect(lineDiff("a\nb\nc\n", "a\nX\nc\n")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "X" },
      { kind: "same", text: "c" },
    ]);
  });

  it("counts additions and removals", () => {
    expect(diffStats(lineDiff("a\nb\n", "a\nb\nc\nd\n"))).toEqual({ added: 2, removed: 0 });
    expect(diffStats(lineDiff("a\nb\nc\n", "a\n"))).toEqual({ added: 0, removed: 2 });
  });

  it("ignores the trailing newline", () => {
    expect(diffStats(lineDiff("a\nb", "a\nb\n"))).toEqual({ added: 0, removed: 0 });
  });
});

describe("withContext", () => {
  const text = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");

  it("shows nothing when nothing changed", () => {
    expect(withContext(lineDiff(text(5), text(5)))).toEqual([]);
  });

  it("collapses long unchanged runs around a change", () => {
    const changed = text(20).replace("line 10", "CHANGED");
    const items = withContext(lineDiff(text(20), changed), 2);
    expect(items[0]).toEqual({ kind: "gap", count: 8 });
    expect(items.filter((i) => i.kind === "add")).toHaveLength(1);
    expect(items[items.length - 1]).toEqual({ kind: "gap", count: 7 });
  });
});
