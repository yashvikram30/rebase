import { describe, expect, it } from "vitest";
import { addEvent, deriveFacts, MAX_EVENTS, type DebugEvent } from "./debug-session";

const edit = (at: number): DebugEvent => ({ at, type: "edit", file: "util.py", added: 1, removed: 1 });
const run = (at: number, failingOk: boolean, regressionOk?: boolean): DebugEvent => ({
  at,
  type: "run",
  suite: regressionOk === undefined ? "failing" : "all",
  failingOk,
  regressionOk,
});
const apply = (at: number): DebugEvent => ({ at, type: "patch-applied", file: "util.py" });
const ask = (at: number, hypothesis?: string): DebugEvent => ({
  at,
  type: "chat-user",
  phase: hypothesis ? "fix" : "explore",
  text: "help",
  hypothesis,
});

describe("addEvent", () => {
  it("keeps only the newest events", () => {
    let events: DebugEvent[] = [];
    for (let i = 0; i < MAX_EVENTS + 5; i++) events = addEvent(events, edit(i));
    expect(events).toHaveLength(MAX_EVENTS);
    expect(events[events.length - 1].at).toBe(MAX_EVENTS + 4);
  });
});

describe("deriveFacts", () => {
  it("reads a careful round: run first, hypothesis, fix, verify everything", () => {
    const f = deriveFacts(
      [
        run(1000, false),
        ask(2000),
        ask(3000, "min and max are nested backwards"),
        edit(4000),
        run(5000, true, true),
      ],
      0,
    );
    expect(f.firstRunMs).toBe(1000);
    expect(f.editsBeforeFirstRun).toBe(0);
    expect(f.hypotheses).toBe(1);
    expect(f.messagesSent).toBe(2);
    expect(f.regressionRuns).toBe(1);
    expect(f.lazyFinish).toBe(false);
    expect(f.durationMs).toBe(5000);
  });

  it("flags an agent patch applied and never tested", () => {
    expect(deriveFacts([ask(1), apply(2)], 0).blindPatches).toBe(1);
    expect(deriveFacts([apply(1), run(2, true, true)], 0).blindPatches).toBe(0);
    expect(deriveFacts([apply(1), apply(2), run(3, true, true)], 0).blindPatches).toBe(1);
  });

  it("calls a finish lazy when the failing test passes but the regression suite fails or never ran", () => {
    expect(deriveFacts([run(1, true, false)], 0).lazyFinish).toBe(true);
    expect(deriveFacts([run(1, true)], 0).lazyFinish).toBe(true);
    expect(deriveFacts([run(1, false)], 0).lazyFinish).toBe(false);
  });

  it("counts edits made before asking for a patch and before the first run", () => {
    const f = deriveFacts([edit(1), edit(2), run(3, false), ask(4, "a real hypothesis here")], 0);
    expect(f.editsBeforeFirstRun).toBe(2);
    expect(f.editsBeforeHypothesis).toBe(2);
  });

  it("copes with an empty round", () => {
    const f = deriveFacts([], 0);
    expect(f.firstRunMs).toBeNull();
    expect(f.lastRun).toBeNull();
    expect(f.editsBeforeHypothesis).toBeNull();
    expect(f.lazyFinish).toBe(false);
  });
});
