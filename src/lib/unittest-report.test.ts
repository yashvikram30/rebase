import { describe, expect, it } from "vitest";
import { parseUnittest, prettyTestName } from "./unittest-report";

const OUTPUT = `test_corridor (test_regression.Regression.test_corridor) ... ok
test_detour_around_wall (test_regression.Regression.test_detour_around_wall) ... FAIL
test_boom (test_regression.Regression.test_boom) ... ERROR
test_later (test_regression.Regression.test_later) ... skipped 'not yet'

======================================================================
FAIL: test_detour_around_wall (test_regression.Regression.test_detour_around_wall)
----------------------------------------------------------------------
AssertionError: False is not true
`;

describe("parseUnittest", () => {
  it("reads each test's status and ignores the failure report", () => {
    expect(parseUnittest(OUTPUT)).toEqual([
      { name: "test_corridor", status: "pass" },
      { name: "test_detour_around_wall", status: "fail" },
      { name: "test_boom", status: "error" },
      { name: "test_later", status: "skip" },
    ]);
  });

  it("returns nothing for a run that never started", () => {
    expect(parseUnittest("Timed out after 8s. Is there an infinite loop?")).toEqual([]);
  });
});

describe("prettyTestName", () => {
  it("drops the prefix and the underscores", () => {
    expect(prettyTestName("test_goal_walled_off")).toBe("goal walled off");
    expect(prettyTestName("test")).toBe("test");
  });
});
