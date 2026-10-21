"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { WorkbenchScenario } from "@/lib/debug";
import { runCode, runSuite, type SuiteResult } from "@/lib/debug-sandbox";
import { recordSolve } from "@/lib/debug-store";
import { diffStats, lineDiff } from "@/lib/line-diff";
import {
  clearDraft,
  getChat,
  resetChatLog,
  recordEvent,
  useChats,
  saveDraft,
  setLayout,
  useDrafts,
  useLayout,
  type Layout,
} from "@/lib/workbench-store";
import { Diff, TestRun } from "../debug/results";
import { ChatPanel } from "./chat-panel";
import { FinishDialog } from "./finish-dialog";
import { Editor } from "./editor";
import { Splitter } from "./splitter";
import { Terminal } from "./terminal";
import { useNowSeconds } from "./use-now";

const BUG = "BUG_REPORT.md";
const TEST = "test_failing.py";

type Panel = "tests" | "terminal" | "changes";
type View = "files" | "editor" | "output" | "chat";
type Results = { failing: SuiteResult; regression?: SuiteResult };

const bugText = (s: WorkbenchScenario) =>
  `# ${s.title}\n\n${s.symptom}\n\nHow to work\n` +
  `- Run the failing test with Ctrl+Enter and read what it says.\n` +
  `- Use the terminal to call your code and print what you need.\n` +
  `- Make the smallest fix, then run all tests with Ctrl+Shift+Enter to check you broke nothing else.\n`;

const noSubscribe = () => () => {};

/** When this workbench opened. Reads 0 on the server, so nothing time-based is baked into the prerender. */
function usePageStart() {
  const [clock] = useState(() => {
    let t = 0;
    return { read: () => (t ||= Date.now()) };
  });
  return useSyncExternalStore(noSubscribe, clock.read, () => 0);
}

/** Seconds since `started`, ticking once a second. Reads 0 on the server so hydration matches. */
function useElapsed(started: number) {
  const now = useNowSeconds();
  return now ? Math.max(0, now - Math.floor(started / 1000)) : 0;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Workbench({ scenario }: { scenario: WorkbenchScenario }) {
  const srcFiles = Object.keys(scenario.files);
  const draft = useDrafts()[scenario.id];
  const [edits, setEdits] = useState<Record<string, string> | null>(null);
  const pageStart = usePageStart();
  const [resetAt, setResetAt] = useState<number | null>(null);

  // What is on screen: this session's edits, else the saved draft, else the original.
  const base = draft
    ? Object.fromEntries(srcFiles.map((f) => [f, draft.files[f] ?? scenario.files[f]]))
    : scenario.files;
  const files = edits ?? base;
  const started = draft?.started ?? resetAt ?? pageStart;
  const elapsed = useElapsed(started);
  const [showClock, setShowClock] = useState(true);

  const [open, setOpen] = useState<string[]>([BUG, ...srcFiles]);
  const [active, setActive] = useState(BUG);
  const [panel, setPanel] = useState<Panel>("tests");
  const [view, setView] = useState<View>("editor");
  const [results, setResults] = useState<Results | null>(null);
  const [running, setRunning] = useState<"failing" | "all" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const stored = useLayout();
  const [live, setLive] = useState<Layout | null>(null);
  const layout = live ?? stored;
  const [chatOpen, setChatOpen] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const hasReport = !!useChats()[scenario.id]?.report;
  const logged = useRef<Record<string, string>>({});

  const readOnly = active === BUG || active === TEST;
  const content =
    active === BUG ? bugText(scenario) : active === TEST ? scenario.failingTest : (files[active] ?? "");
  const changed = srcFiles.filter((f) => files[f] !== scenario.files[f]);
  const solved = !!results?.failing.ok && !!results.regression?.ok;
  const testOutput = results
    ? [results.failing.output, results.regression?.output].filter(Boolean).join("\n")
    : "";

  // The first time a case is opened, the timeline starts.
  // Opening a case starts a fresh conversation with the assistant (before paint, so old messages never flash).
  useLayoutEffect(() => {
    resetChatLog(scenario.id);
  }, [scenario.id]);

  useEffect(() => {
    if (!getChat(scenario.id)?.events.length) recordEvent(scenario.id, { at: Date.now(), type: "open" });
  }, [scenario.id]);

  // Save the draft shortly after the last keystroke.
  useEffect(() => {
    if (!edits) return;
    const t = setTimeout(() => {
      saveDraft(scenario.id, edits, started);
      setSavedAt(Date.now());
      // One timeline entry per file whose change has moved on since the last one.
      for (const f of Object.keys(scenario.files)) {
        if (edits[f] === scenario.files[f]) continue;
        const { added, removed } = diffStats(lineDiff(scenario.files[f], edits[f]));
        const mark = `${added}:${removed}:${edits[f].length}`;
        if (logged.current[f] === mark) continue;
        logged.current[f] = mark;
        recordEvent(scenario.id, { at: Date.now(), type: "edit", file: f, added, removed });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [edits, scenario.id, scenario.files, started]);

  async function run(all: boolean) {
    if (running) return;
    setRunning(all ? "all" : "failing");
    setPanel("tests");
    setView("output");
    const failing = await runSuite(files, scenario, "test_failing");
    const regression = all ? await runSuite(files, scenario, "test_regression") : undefined;
    setResults({ failing, regression });
    setRunning(null);
    recordEvent(scenario.id, {
      at: Date.now(),
      type: "run",
      suite: all ? "all" : "failing",
      failingOk: failing.ok,
      regressionOk: regression?.ok,
    });
    if (failing.ok && regression?.ok) recordSolve(scenario.id, Date.now() - started);
  }

  // Run shortcuts also work when focus is outside the editor. The editor handles its own and prevents default.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || !(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      e.preventDefault();
      void run(e.shiftKey);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openFile(path: string) {
    setOpen((o) => (o.includes(path) ? o : [...o, path]));
    setActive(path);
    setView("editor");
  }

  function closeTab(path: string) {
    const rest = open.filter((p) => p !== path);
    if (!rest.length) return;
    setOpen(rest);
    if (active === path) setActive(rest[Math.max(0, open.indexOf(path) - 1)] ?? rest[0]);
  }

  function resetCase() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    clearDraft(scenario.id);
    setEdits(null);
    setResults(null);
    setSavedAt(null);
    setResetAt(Date.now());
    setConfirmReset(false);
  }

  function applyPatch(file: string, code: string) {
    setEdits({ ...files, [file]: code });
    openFile(file);
    setPanel("changes");
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    } catch {
      // No Fullscreen API: the workbench already fills the window.
    }
  }

  const status = running
    ? "Running…"
    : solved
      ? "All tests pass"
      : results
        ? results.failing.ok
          ? "Failing test passes"
          : "Tests failing"
        : "Ready";

  return (
    <div
      className="wb-app"
      data-view={view}
      style={
        {
          "--wb-explorer": `${layout.explorer}px`,
          "--wb-panel": `${layout.panel}px`,
          "--wb-chat": `${layout.chat}px`,
        } as CSSProperties
      }
    >
      <header className="wb-title">
        <Link className="wb-back" href="/debug">
          <span aria-hidden="true">←</span> Cases
        </Link>
        <h1>{scenario.title}</h1>
        <span className="wb-grow" />
        <button
          type="button"
          className="wb-clock"
          aria-pressed={!showClock}
          aria-label={showClock ? "Hide the timer" : "Show the timer"}
          title={showClock ? "Hide the timer" : "Show the timer"}
          onClick={() => setShowClock((v) => !v)}
        >
          {showClock ? clock(elapsed) : "Timer"}
        </button>
        <button
          type="button"
          className="wb-btn is-primary"
          onClick={() => void run(false)}
          disabled={!!running}
          title="Run the failing test (Ctrl+Enter)"
        >
          Run failing test
        </button>
        <button
          type="button"
          className="wb-btn"
          onClick={() => void run(true)}
          disabled={!!running}
          title="Run all tests (Ctrl+Shift+Enter)"
        >
          Run all tests
        </button>
        <button type="button" className="wb-btn" onClick={resetCase}>
          {confirmReset ? "Click again to reset" : "Reset case"}
        </button>
        <button
          type="button"
          className="wb-btn is-icon"
          onClick={toggleFullscreen}
          aria-label="Toggle full screen"
          title="Full screen"
        >
          ⤢
        </button>
        {hasReport && (
          <Link className="wb-btn" href={`/debug/${scenario.id}/report`}>
            View report
          </Link>
        )}
        <button type="button" className="wb-btn" onClick={() => setFinishing(true)}>
          Finish round
        </button>
        <button
          type="button"
          className="wb-btn"
          aria-pressed={chatOpen}
          onClick={() => setChatOpen((o) => !o)}
          title="Show or hide the assistant"
        >
          Assistant
        </button>
        <ThemeToggle />
      </header>

      <div className="wb-mtabs" role="tablist" aria-label="Workbench views">
        {(["files", "editor", "output", "chat"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {v === "files" ? "Files" : v === "editor" ? "Editor" : v === "output" ? "Output" : "Assistant"}
          </button>
        ))}
      </div>

      <div className="wb-body" data-chat={chatOpen ? "open" : "closed"}>
        <nav className="wb-explorer" aria-label="Files">
          <p className="wb-group">Case</p>
          <ul>
            {[BUG, TEST].map((f) => (
              <li key={f}>
                <button
                  type="button"
                  aria-current={active === f ? "true" : undefined}
                  onClick={() => openFile(f)}
                >
                  <span>{f}</span>
                  <small>read-only</small>
                </button>
              </li>
            ))}
          </ul>
          <p className="wb-group">Code</p>
          <ul>
            {srcFiles.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  aria-current={active === f ? "true" : undefined}
                  onClick={() => openFile(f)}
                >
                  <span>{f}</span>
                  {changed.includes(f) && <i className="wb-dirty" title="Changed" aria-label="Changed" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <Splitter
          orientation="vertical"
          value={layout.explorer}
          min={160}
          max={480}
          grow={1}
          label="Resize the file list"
          onLive={(n) => setLive({ ...layout, explorer: n })}
          onCommit={(n) => {
            setLayout({ ...layout, explorer: n });
            setLive(null);
          }}
        />

        <div className="wb-main">
          <section className="wb-editor-pane" aria-label="Editor">
            <div className="wb-tabs" role="tablist" aria-label="Open files">
              {open.map((f) => (
                <div key={f} className={"wb-tab" + (active === f ? " is-active" : "")}>
                  <button type="button" role="tab" aria-selected={active === f} onClick={() => setActive(f)}>
                    {f}
                    {changed.includes(f) && <i className="wb-dirty" aria-label="Changed" />}
                  </button>
                  {open.length > 1 && (
                    <button
                      type="button"
                      className="wb-x"
                      aria-label={`Close ${f}`}
                      onClick={() => closeTab(f)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <span className="wb-grow" />
              {changed.includes(active) && (
                <button
                  type="button"
                  className="wb-link"
                  onClick={() => setEdits({ ...files, [active]: scenario.files[active] })}
                >
                  Reset file
                </button>
              )}
            </div>
            <Editor
              path={active}
              value={content}
              readOnly={readOnly}
              onChange={(code) => {
                if (!readOnly) setEdits({ ...files, [active]: code });
              }}
              onRun={() => void run(false)}
              onRunAll={() => void run(true)}
            />
          </section>

          <Splitter
            orientation="horizontal"
            value={layout.panel}
            min={120}
            max={640}
            grow={-1}
            label="Resize the output panel"
            onLive={(n) => setLive({ ...layout, panel: n })}
            onCommit={(n) => {
              setLayout({ ...layout, panel: n });
              setLive(null);
            }}
          />

          <section className="wb-panel" aria-label="Output">
            <div className="wb-ptabs" role="tablist" aria-label="Output panels">
              {(
                [
                  ["tests", "Tests"],
                  ["terminal", "Terminal"],
                  ["changes", changed.length ? `Changes (${changed.length})` : "Changes"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={panel === id}
                  onClick={() => setPanel(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="wb-pbody" role="tabpanel">
              {panel === "tests" && (
                <div className="wb-tests">
                  {running && <p className="wb-hint">Running…</p>}
                  {!running && !results && (
                    <p className="wb-hint">
                      Run the failing test to see what breaks. <kbd>Ctrl</kbd> <kbd>Enter</kbd>
                    </p>
                  )}
                  {solved && (
                    <p className="wb-solved" role="status">
                      <span aria-hidden="true">✓</span> All tests pass. Solved in {clock(elapsed)}.
                    </p>
                  )}
                  {results && !running && (
                    <div className="dbg-runs" aria-live="polite">
                      <TestRun label="Failing test" r={results.failing} />
                      {results.regression && <TestRun label="Regression suite" r={results.regression} />}
                    </div>
                  )}
                </div>
              )}
              {panel === "terminal" && (
                <Terminal
                  exec={(code) => {
                    recordEvent(scenario.id, { at: Date.now(), type: "terminal", code: code.slice(0, 500) });
                    return runCode(files, code);
                  }}
                />
              )}
              {panel === "changes" && (
                <div className="wb-changes">
                  {changed.length === 0 && (
                    <p className="wb-hint">No changes yet. Edit a file and they show up here.</p>
                  )}
                  {changed.map((f) => (
                    <Diff key={f} name={f} before={scenario.files[f]} after={files[f]} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {chatOpen && (
          <>
            <Splitter
              orientation="vertical"
              value={layout.chat}
              min={260}
              max={560}
              grow={-1}
              label="Resize the assistant"
              onLive={(n) => setLive({ ...layout, chat: n })}
              onCommit={(n) => {
                setLayout({ ...layout, chat: n });
                setLive(null);
              }}
            />
            <ChatPanel scenarioId={scenario.id} files={files} testOutput={testOutput} onApply={applyPatch} />
          </>
        )}
      </div>

      {finishing && (
        <FinishDialog scenarioId={scenario.id} files={files} onClose={() => setFinishing(false)} />
      )}

      <footer className="wb-status">
        <span>{status}</span>
        <span className="wb-grow" />
        {savedAt && <span>Draft saved</span>}
        <span>Python 3.12 in the browser</span>
      </footer>
    </div>
  );
}
