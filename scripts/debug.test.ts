import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Scenario } from "../src/lib/debug-types";
import { loadScenarios } from "./lib/debug";

const scenarios = loadScenarios();
const hasPython = spawnSync("python3", ["--version"]).status === 0;

function run(s: Scenario, fix: Record<string, string> | null, suite: "test_failing" | "test_regression") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "debug-"));
  try {
    const files = { ...s.files, ...(fix ?? {}) };
    for (const [name, code] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), code);
    fs.writeFileSync(path.join(dir, "test_failing.py"), s.failingTest);
    fs.writeFileSync(path.join(dir, "test_regression.py"), s.regressionTests);
    const r = spawnSync("python3", ["-B", "-m", "unittest", suite], {
      cwd: dir,
      timeout: 10_000,
      encoding: "utf8",
    });
    return r.status === 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("debug scenarios", () => {
  it("src/data/debug.json matches data/debug (run `npm run debug:build` if this fails)", () => {
    const file = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "src/data/debug.json"), "utf8"));
    expect(file).toEqual(scenarios);
  });

  it("fixes only touch files that exist", () => {
    for (const s of scenarios) {
      const fixes = [
        s.correctFix,
        ...s.wrongFixes.map((w) => w.fix),
        ...(s.transcript?.turns.map((t) => t.fix) ?? []),
      ];
      for (const fix of fixes)
        for (const name of Object.keys(fix ?? {})) expect(s.files, `${s.id}: ${name}`).toHaveProperty(name);
    }
  });

  describe.skipIf(!hasPython)("behaviour (python3)", () => {
    for (const s of scenarios) {
      it(`${s.id}: buggy code fails the failing test`, () => {
        expect(run(s, null, "test_failing")).toBe(false);
      });
      it(`${s.id}: correct fix passes both suites`, () => {
        expect(run(s, s.correctFix, "test_failing")).toBe(true);
        expect(run(s, s.correctFix, "test_regression")).toBe(true);
      });
      // Review mode marks a reviewer right when they approve a "correct" session and reject the rest, so the
      // agent's final patch has to behave the way the session's kind says it does.
      const agentFix = s.transcript?.turns.filter((t) => t.fix).at(-1)?.fix;
      if (s.transcript && agentFix) {
        const kind = s.transcript.kind;
        it(`${s.id}: the agent's ${kind} patch ${kind === "correct" ? "passes" : "does not pass"} both suites`, () => {
          const both = run(s, agentFix, "test_failing") && run(s, agentFix, "test_regression");
          expect(both).toBe(kind === "correct");
        });
      }
      s.wrongFixes.forEach((w, i) => {
        it(`${s.id}: wrong fix #${i + 1} passes the failing test but not the regression suite`, () => {
          expect(run(s, w.fix, "test_failing")).toBe(true);
          expect(run(s, w.fix, "test_regression")).toBe(false);
        });
      });
    }
  });
});
