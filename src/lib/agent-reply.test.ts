import { describe, expect, it } from "vitest";
import { splitReply, withholdPatches } from "./agent-reply";

const FILES = ["util.py"];
const REPLY =
  "The nesting is inverted.\n\n```python path=util.py\ndef clamp(x, lo, hi):\n    return max(lo, min(x, hi))\n```\n\nRun the tests next.";

describe("splitReply", () => {
  it("finds a patch for an editable file between the prose", () => {
    expect(splitReply(REPLY, FILES)).toEqual([
      { kind: "text", text: "The nesting is inverted." },
      { kind: "patch", file: "util.py", code: "def clamp(x, lo, hi):\n    return max(lo, min(x, hi))\n" },
      { kind: "text", text: "Run the tests next." },
    ]);
  });

  it("treats a path outside the editable files as plain code", () => {
    const parts = splitReply("```python path=test_failing.py\nassert True\n```", FILES);
    expect(parts).toEqual([{ kind: "code", lang: "python", code: "assert True" }]);
  });

  it("also reads the path from the first line inside the block", () => {
    const reply =
      "Fix:\n\n```python\npath=util.py\ndef clamp(x, lo, hi):\n    return max(lo, min(x, hi))\n```";
    expect(splitReply(reply, FILES)).toEqual([
      { kind: "text", text: "Fix:" },
      { kind: "patch", file: "util.py", code: "def clamp(x, lo, hi):\n    return max(lo, min(x, hi))\n" },
    ]);
    const comment = "```python\n# file: util.py\nx = 1\n```";
    expect(splitReply(comment, FILES)).toEqual([{ kind: "patch", file: "util.py", code: "x = 1\n" }]);
  });

  it("returns plain text untouched", () => {
    expect(splitReply("Just a thought.", FILES)).toEqual([{ kind: "text", text: "Just a thought." }]);
  });
});

describe("withholdPatches", () => {
  it("withholds a patch whichever way the path was written", () => {
    const { reply, withheld } = withholdPatches("```python\npath=util.py\nreturn x\n```", FILES);
    expect(withheld).toBe(1);
    expect(reply).not.toContain("return x");
  });

  it("removes patches but keeps other code", () => {
    const { reply, withheld } = withholdPatches(`${REPLY}\n\n\`\`\`python\nprint(1)\n\`\`\``, FILES);
    expect(withheld).toBe(1);
    expect(reply).not.toContain("max(lo, min(x, hi))");
    expect(reply).toContain("A patch was withheld");
    expect(reply).toContain("print(1)");
  });
});
