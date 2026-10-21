/** One thing that happened in a round. The timeline the mentor report is built from. */
export type DebugEvent = { at: number } & (
  | { type: "open" }
  | { type: "chat-user"; phase: "explore" | "fix"; text: string; hypothesis?: string }
  | { type: "chat-agent"; text: string; patches: string[] }
  | { type: "edit"; file: string; added: number; removed: number }
  | { type: "run"; suite: "failing" | "all"; failingOk: boolean; regressionOk?: boolean }
  | { type: "patch-applied"; file: string }
  | { type: "terminal"; code: string }
  | { type: "finish" }
);

export const MAX_EVENTS = 400;

export function addEvent(events: DebugEvent[], e: DebugEvent): DebugEvent[] {
  const next = [...events, e];
  return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
}

export type Facts = {
  messagesSent: number;
  /** Patch requests that came with a written hypothesis. */
  hypotheses: number;
  /** Milliseconds from the start to the first test run, or null if tests were never run. */
  firstRunMs: number | null;
  editsBeforeFirstRun: number;
  /** File edits made before the first patch request, or null if one was never made. */
  editsBeforeHypothesis: number | null;
  patchesApplied: number;
  /** Agent patches applied and not followed by a test run before the next patch or the end. */
  blindPatches: number;
  regressionRuns: number;
  terminalCommands: number;
  /** The result of the last test run, if there was one. */
  lastRun: { failingOk: boolean; regressionOk?: boolean } | null;
  /** The failing test passes but the regression suite fails, or was never run. */
  lazyFinish: boolean;
  durationMs: number;
};

/** The measurable parts of how a round went: grounded facts for the report, not opinions. */
export function deriveFacts(events: DebugEvent[], started: number): Facts {
  const runs = events.filter((e) => e.type === "run");
  const firstRun = runs[0];
  const firstFix = events.findIndex((e) => e.type === "chat-user" && e.phase === "fix");
  const countEdits = (list: DebugEvent[]) => list.filter((e) => e.type === "edit").length;

  let blind = 0;
  let pending = false;
  for (const e of events) {
    if (e.type === "patch-applied") {
      if (pending) blind++;
      pending = true;
    } else if (e.type === "run") pending = false;
  }
  if (pending) blind++;

  const last = runs[runs.length - 1];
  const lastRun =
    last?.type === "run" ? { failingOk: last.failingOk, regressionOk: last.regressionOk } : null;
  return {
    messagesSent: events.filter((e) => e.type === "chat-user").length,
    hypotheses: events.filter((e) => e.type === "chat-user" && e.phase === "fix" && !!e.hypothesis).length,
    firstRunMs: firstRun ? firstRun.at - started : null,
    editsBeforeFirstRun: countEdits(firstRun ? events.slice(0, events.indexOf(firstRun)) : events),
    editsBeforeHypothesis: firstFix === -1 ? null : countEdits(events.slice(0, firstFix)),
    patchesApplied: events.filter((e) => e.type === "patch-applied").length,
    blindPatches: blind,
    regressionRuns: runs.filter((e) => e.type === "run" && e.suite === "all").length,
    terminalCommands: events.filter((e) => e.type === "terminal").length,
    lastRun,
    lazyFinish: !!lastRun && lastRun.failingOk && lastRun.regressionOk !== true,
    durationMs: events.length ? events[events.length - 1].at - started : 0,
  };
}

/** One line saying what an event was, for the review prompt and for the timeline on the report page. */
export const describeEvent = (e: DebugEvent): string => {
  switch (e.type) {
    case "open":
      return "opened the case";
    case "chat-user":
      return `asked the assistant (${e.phase === "fix" ? `asked for a patch; hypothesis: "${(e.hypothesis ?? "").slice(0, 300)}"` : "asking for help"}): "${e.text.slice(0, 300)}"`;
    case "chat-agent":
      return `assistant replied${e.patches.length ? ` and proposed a patch for ${e.patches.join(", ")}` : ""}`;
    case "edit":
      return `edited ${e.file} (+${e.added} −${e.removed} compared with the original)`;
    case "run":
      return `ran ${e.suite === "all" ? "all tests" : "the failing test"}: failing test ${e.failingOk ? "passes" : "fails"}${e.regressionOk === undefined ? "" : `, regression suite ${e.regressionOk ? "passes" : "fails"}`}`;
    case "patch-applied":
      return `applied the assistant's patch to ${e.file}`;
    case "terminal":
      return `ran in the terminal: ${e.code.slice(0, 120)}`;
    case "finish":
      return "finished the round";
  }
};
