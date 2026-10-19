export type TestLine = { name: string; status: "pass" | "fail" | "error" | "skip" };

// unittest -v prints one "test_name (module.Class.test_name) ... ok" line per test.
const LINE = /^(test\w*) \([\w.]+\) \.\.\. (ok|FAIL|ERROR|skipped\b.*)$/;

/** Pulls the per-test results out of verbose unittest output. Empty when the run never got that far. */
export function parseUnittest(output: string): TestLine[] {
  const tests: TestLine[] = [];
  for (const raw of output.split("\n")) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const word = m[2];
    tests.push({
      name: m[1],
      status: word === "ok" ? "pass" : word === "FAIL" ? "fail" : word === "ERROR" ? "error" : "skip",
    });
  }
  return tests;
}

/** test_goal_walled_off -> "goal walled off". */
export const prettyTestName = (name: string) => name.replace(/^test_?/, "").replace(/_/g, " ") || name;
