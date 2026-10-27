"use client";
import { useEffect, useId, useRef, useState } from "react";
import "./debug-guide.css";

type TabId = "approach" | "assistant" | "grading" | "interview";

const TABS: { id: TabId; label: string }[] = [
  { id: "approach", label: "Approach" },
  { id: "assistant", label: "Working with the assistant" },
  { id: "grading", label: "How you are graded" },
  { id: "interview", label: "In a real interview" },
];

const STEPS: { title: string; body: string; points: string[]; why: string }[] = [
  {
    title: "Reproduce before you touch anything",
    body: "Read BUG_REPORT.md, then run the failing test (Ctrl+Enter) and read the whole failure message.",
    points: [
      "Note the assertion, the expected value and the actual value.",
      "Find the function the traceback ends in, and the file it lives in.",
    ],
    why: "Editing before you can see the failure is guessing. It is also how regressions start.",
  },
  {
    title: "Say what you think is wrong",
    body: "Trace backwards from the failing line and write down one specific theory before you change code.",
    points: [
      "Shared or mutated state: a default argument, a list reused between calls.",
      "Order or timing: a step that runs too early, too late or twice.",
      "Boundaries and types: off by one, empty input, a string where a number was expected.",
    ],
    why: "A stated hypothesis can be checked, and it is what the assistant and the review both look for.",
  },
  {
    title: "Check the theory cheaply",
    body: "Use the terminal to call the code and print what you need. Ask the assistant a narrow question if you are stuck.",
    points: [
      "Print the values your theory depends on instead of re-reading the code.",
      "If the output contradicts your theory, drop the theory and form a new one.",
    ],
    why: "Evidence beats intuition, and a printed value is faster than a long chat.",
  },
  {
    title: "Make the smallest fix",
    body: "Change only what the root cause requires, usually a line or a few lines.",
    points: [
      "Fix the cause, not the symptom. Never special-case the test.",
      "Leave unrelated code, names and style alone.",
    ],
    why: "A small diff is easy to review and hard to get wrong. The review reads your diff size.",
  },
  {
    title: "Verify, then explain",
    body: "Run all tests (Ctrl+Shift+Enter), not just the failing one. Then submit with a short explanation.",
    points: [
      "Say what was wrong, why it happened, and why your change fixes it.",
      "Two or three sentences is enough. Be specific rather than long.",
    ],
    why: "The hidden regression suite catches fixes that only work for the one visible case.",
  },
];

const DIMENSIONS: { name: string; text: string }[] = [
  { name: "Reproducing the bug", text: "Did you run the failing test before editing any file?" },
  { name: "Forming a hypothesis", text: "Did you say what was wrong before trying to fix it?" },
  { name: "Keeping the fix small", text: "Is the change limited to what the cause needs, with no extra edits?" },
  { name: "Checking the fix", text: "Did you run the full suite, not only the failing test, before you submitted?" },
  { name: "Explaining the cause", text: "Does your explanation match what really happened, in your own words?" },
  { name: "Questioning the assistant", text: "Did you check its hints against the code instead of accepting them?" },
];

const LADDER: { level: string; text: string }[] = [
  { level: "1", text: "Says what the test expects and what happens instead." },
  { level: "2", text: "Narrows it to a file or function, and suggests one thing to print." },
  { level: "3", text: "Names the kind of mistake: ordering, boundary, state or sharing." },
  { level: "4", text: "Points to the code that deserves the closest look. Still no fix." },
];

const TIMELINE: { when: string; what: string }[] = [
  { when: "0 to 5 min", what: "Read the report, run the failing test, read the failure." },
  { when: "5 to 15 min", what: "Trace from the failing line, print values, settle on a theory." },
  { when: "15 to 30 min", what: "Make the smallest fix. Ask the assistant narrow questions only if stuck." },
  { when: "30 to 40 min", what: "Run all tests. Read your changes in the diff view." },
  { when: "Last 5 min", what: "Write your explanation and submit." },
];

function Approach() {
  return (
    <>
      <p className="dbg-g-lead">
        Interviewers watch how you work as much as whether the test turns green. Follow the same five steps
        every time.
      </p>
      <ol className="dbg-g-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="dbg-g-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
              <ul>
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="dbg-g-why">
                <b>Why it matters.</b> {s.why}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function Assistant() {
  return (
    <>
      <p className="dbg-g-lead">
        The assistant is a hint-giver, never a fixer. You get 12 messages and 45 minutes a round, so make each
        message count.
      </p>
      <div className="dbg-g-compare">
        <section className="dbg-g-card is-weak" aria-label="Weak prompts">
          <h4>Weak prompts</h4>
          <blockquote>Fix this bug for me.</blockquote>
          <p>It will decline, and you spend a message and show nothing of your own thinking.</p>
          <blockquote>What is wrong with the code?</blockquote>
          <p>Too broad. You get a generic reading of the files, not progress.</p>
        </section>
        <section className="dbg-g-card is-strong" aria-label="Strong prompts">
          <h4>Strong prompts</h4>
          <blockquote>
            I think the cart keeps items between calls because of a shared default list. Does that fit what the
            test shows?
          </blockquote>
          <p>States a theory, so the assistant can say whether it holds, partly holds or does not.</p>
          <blockquote>
            The test fails only for an empty input. What should the function return when there is nothing to
            count?
          </blockquote>
          <p>Asks about intended behaviour and leaves the coding to you.</p>
        </section>
      </div>
      <h4 className="dbg-g-sub">How hints sharpen</h4>
      <p className="dbg-g-muted">
        Each time you ask for help the hint gets slightly more specific. It never reaches the answer.
      </p>
      <ol className="dbg-g-ladder">
        {LADDER.map((l) => (
          <li key={l.level}>
            <span>Level {l.level}</span>
            <p>{l.text}</p>
          </li>
        ))}
      </ol>
      <p className="dbg-g-note">
        Treat every hint as a claim to check, not an instruction. Run something that confirms it before you act
        on it.
      </p>
    </>
  );
}

function Grading() {
  return (
    <>
      <p className="dbg-g-lead">
        When you submit, a mentor report rates six things from your timeline: what you ran, what you asked, what
        you changed and what you wrote.
      </p>
      <dl className="dbg-g-dims">
        {DIMENSIONS.map((d) => (
          <div key={d.name}>
            <dt>{d.name}</dt>
            <dd>{d.text}</dd>
          </div>
        ))}
      </dl>
      <p className="dbg-g-note">
        Each is rated strong, fair, weak or not shown. A correct fix reached without showing your reasoning
        still scores low on the process.
      </p>
    </>
  );
}

function Interview() {
  return (
    <>
      <p className="dbg-g-lead">
        In a live round the same habits apply. A human is watching, so say your thinking out loud.
      </p>
      <h4 className="dbg-g-sub">A suggested 45-minute shape</h4>
      <ol className="dbg-g-time">
        {TIMELINE.map((t) => (
          <li key={t.when}>
            <span>{t.when}</span>
            <p>{t.what}</p>
          </li>
        ))}
      </ol>
      <h4 className="dbg-g-sub">Habits that read well</h4>
      <ul className="dbg-g-list">
        <li>
          Narrate: &ldquo;The test expects 3 but gets 2, so I suspect the loop stops one item early. I will
          print the index to check.&rdquo;
        </li>
        <li>Ask clarifying questions about intended behaviour before you decide what correct means.</li>
        <li>Use AI the way you would use a colleague: ask narrow questions, and verify the answers.</li>
        <li>If your first theory is wrong, say so and move on. Changing your mind on evidence is a good sign.</li>
        <li>Finish by stating what you changed, why it works, and what you ran to be sure.</li>
      </ul>
    </>
  );
}

const PANELS: Record<TabId, () => React.ReactElement> = {
  approach: Approach,
  assistant: Assistant,
  grading: Grading,
  interview: Interview,
};

export function DebugGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabId>("approach");
  const uid = useId();

  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  function pick(next: TabId) {
    setTab(next);
    bodyRef.current?.scrollTo({ top: 0 });
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + step + TABS.length) % TABS.length;
    pick(TABS[n].id);
    document.getElementById(`${uid}-tab-${TABS[n].id}`)?.focus();
  }

  const Panel = PANELS[tab];

  return (
    <dialog
      ref={dlgRef}
      className="dbg-guide-dlg"
      aria-labelledby={`${uid}-title`}
      onClose={onClose}
      onClick={(e) => e.target === dlgRef.current && onClose()}
    >
      <div className="dbg-g-wrap">
        <header className="dbg-g-head">
          <div>
            <p className="dbg-g-eyebrow">Interview guide</p>
            <h2 id={`${uid}-title`}>How to approach an AI-enabled debugging round</h2>
          </div>
          <button type="button" className="dbg-g-close" onClick={onClose} aria-label="Close guide">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="dbg-g-tabs" role="tablist" aria-label="Guide sections">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`${uid}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? "is-active" : undefined}
              onClick={() => pick(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          ref={bodyRef}
          className="dbg-g-body"
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${tab}`}
          tabIndex={0}
        >
          <Panel />
        </div>

        <footer className="dbg-g-foot">
          <p>
            <kbd>Ctrl</kbd> <kbd>Enter</kbd> runs the failing test. <kbd>Ctrl</kbd> <kbd>Shift</kbd>{" "}
            <kbd>Enter</kbd> runs all tests.
          </p>
          <button type="button" className="dbg-g-done" onClick={onClose}>
            Start practising
          </button>
        </footer>
      </div>
    </dialog>
  );
}

/** The trigger button placed in the top navigation bar. */
export function DebugGuideButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className ? `dbg-guide-top-btn ${className}` : "dbg-guide-top-btn"}
        onClick={() => setOpen(true)}
        title="How to approach an AI-enabled interview"
        aria-label="Open interview guide"
        aria-haspopup="dialog"
      >
        <svg
          className="dbg-guide-top-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
          <path d="M4 21V5" />
          <path d="M9 8h6" />
        </svg>
        <span className="dbg-guide-top-label">Interview guide</span>
      </button>
      <DebugGuideDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
