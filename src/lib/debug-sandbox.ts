"use client";

export type SuiteName = "test_failing" | "test_regression";
export type SuiteResult = { ok: boolean; output: string; timedOut: boolean };

const WORKER_URL = "/debug/pyodide-worker.js";
/** First run also downloads Pyodide, so give it longer than later runs. */
const COLD_TIMEOUT_MS = 60_000;
const WARM_TIMEOUT_MS = 8_000;

let worker: Worker | null = null;
let warm = false;
let nextId = 1;
let queue: Promise<unknown> = Promise.resolve();

function start() {
  worker = new Worker(WORKER_URL);
  warm = false;
  worker.addEventListener("message", (e) => {
    if (e.data?.ready) warm = true;
  });
  return worker;
}

type Job = { files: Record<string, string> } & ({ suite: SuiteName } | { kind: "exec"; code: string });

function runOnce(job: Job): Promise<SuiteResult> {
  const w = worker ?? start();
  const id = nextId++;
  const limit = warm ? WARM_TIMEOUT_MS : COLD_TIMEOUT_MS;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // Runaway code: the only way to stop it is to throw the worker away.
      w.terminate();
      if (worker === w) worker = null;
      resolve({
        ok: false,
        output: `Timed out after ${limit / 1000}s. Is there an infinite loop?`,
        timedOut: true,
      });
    }, limit);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      resolve({ ok: !!e.data.ok, output: String(e.data.output ?? ""), timedOut: false });
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, ...job });
  });
}

/** Runs one suite against the given files. Calls are serialised so a timeout cannot kill someone else's run. */
export function runSuite(
  files: Record<string, string>,
  tests: { failingTest: string; regressionTests: string },
  suite: SuiteName,
): Promise<SuiteResult> {
  const all = { ...files, "test_failing.py": tests.failingTest, "test_regression.py": tests.regressionTests };
  return enqueue({ files: all, suite });
}

/** Runs a snippet with the project's modules importable, for the workbench terminal. */
export function runCode(files: Record<string, string>, code: string): Promise<SuiteResult> {
  return enqueue({ files, kind: "exec", code });
}

function enqueue(job: Job) {
  const run = queue.then(() => runOnce(job));
  queue = run.catch(() => undefined);
  return run;
}
