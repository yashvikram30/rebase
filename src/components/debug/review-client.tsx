"use client";
import { useState } from "react";
import { revealAnswer } from "@/app/(debug)/debug/actions";
import type { AnswerKey, PublicScenario } from "@/lib/debug";
import { runSuite, type SuiteResult } from "@/lib/debug-sandbox";
import { recordReview, useDebug } from "@/lib/debug-store";
import { Diff, TestRun } from "./results";

type Ran = { failing: SuiteResult; regression: SuiteResult };

function Code({ name, code }: { name: string; code: string }) {
  return (
    <figure className="dbg-file">
      <figcaption>
        <code>{name}</code>
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

const WHO = { user: "You asked", agent: "Agent", tool: "Test run" } as const;

export function ReviewClient({ scenario }: { scenario: PublicScenario }) {
  const turns = scenario.transcript?.turns ?? [];
  const saved = useDebug().reviews[scenario.id];

  const [ran, setRan] = useState<Record<number, Ran>>({});
  const [running, setRunning] = useState<number | null>(null);
  const [approve, setApprove] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [key, setKey] = useState<AnswerKey | null>(null);
  const [error, setError] = useState("");

  async function run(i: number) {
    const fix = turns[i].fix;
    if (!fix) return;
    setRunning(i);
    const files = { ...scenario.files, ...fix };
    const failing = await runSuite(files, scenario, "test_failing");
    const regression = await runSuite(files, scenario, "test_regression");
    setRan((r) => ({ ...r, [i]: { failing, regression } }));
    setRunning(null);
  }

  async function submit() {
    if (approve === null) return;
    setError("");
    const answer = await revealAnswer(scenario.id);
    if (!answer) return setError("Could not load the answer. Try again.");
    setKey(answer);
    recordReview(scenario.id, {
      at: Date.now(),
      accepted: approve,
      correct: approve === (answer.kind === "correct"),
      ranRegression: Object.keys(ran).length > 0,
      notes,
    });
  }

  const correct = key ? approve === (key.kind === "correct") : false;

  return (
    <div className="dbg-split">
      <div className="dbg-session">
        <h2 className="dbg-sr">The agent&apos;s session</h2>
        <ol className="dbg-rail">
          {turns.map((t, i) => (
            <li key={i} className={`dbg-turn is-${t.role}`}>
              <span className="dbg-node" aria-hidden="true" />
              <p className="dbg-who">{WHO[t.role]}</p>
              {t.role === "tool" ? (
                <pre className="dbg-tool">{t.text}</pre>
              ) : (
                <p className="dbg-say">{t.text}</p>
              )}
              {t.fix && (
                <div className="dbg-patch">
                  {Object.entries(t.fix).map(([name, code]) => (
                    <Diff key={name} name={name} before={scenario.files[name] ?? ""} after={code} />
                  ))}
                  <button
                    type="button"
                    className="dbg-btn"
                    onClick={() => run(i)}
                    disabled={running !== null}
                  >
                    {running === i ? "Running…" : ran[i] ? "Run again" : "Run both test suites"}
                  </button>
                  {ran[i] && (
                    <div className="dbg-runs" aria-live="polite">
                      <TestRun label="Failing test" r={ran[i].failing} />
                      <TestRun label="Regression suite" r={ran[i].regression} />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>

        <section className="dbg-verdict" aria-labelledby="dbg-verdict-h">
          <h2 id="dbg-verdict-h">Your review</h2>
          {key ? (
            <div className="dbg-reveal" role="status">
              <p className={"dbg-outcome " + (correct ? "is-pass" : "is-fail")}>
                <span aria-hidden="true">{correct ? "✓" : "✗"}</span>
                {correct ? "Right call." : "Not quite."} You {approve ? "approved" : "asked for changes on"} a
                fix that was {key.kind === "correct" ? "sound" : "flawed"}.
              </p>
              <h3>What a careful reviewer flags</h3>
              <p>{key.verdict}</p>
              <h3>Root cause</h3>
              <p>{key.rootCause}</p>
              <h3>Check yourself</h3>
              <dl>
                {key.grading.map((g) => (
                  <div key={g.question}>
                    <dt>{g.question}</dt>
                    <dd>{g.ideal}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset className="dbg-choice">
                <legend>Would you merge the agent&apos;s final patch?</legend>
                <label>
                  <input
                    type="radio"
                    name="verdict"
                    checked={approve === true}
                    onChange={() => setApprove(true)}
                  />
                  <span>Approve</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="verdict"
                    checked={approve === false}
                    onChange={() => setApprove(false)}
                  />
                  <span>Request changes</span>
                </label>
              </fieldset>
              <label className="dbg-notes">
                Review comment
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="What did the agent get right, and what did it miss?"
                />
              </label>
              {Object.keys(ran).length === 0 && (
                <p className="dbg-muted">Run the patch against both suites before you decide.</p>
              )}
              <button type="submit" className="dbg-btn" disabled={approve === null}>
                Submit review
              </button>
              {error && <p className="dbg-error">{error}</p>}
              {saved && (
                <p className="dbg-muted">You reviewed this before. Submitting again replaces that result.</p>
              )}
            </form>
          )}
        </section>
      </div>

      <aside className="dbg-casefile" aria-label="Case file">
        <h2>Case file</h2>
        <h3>Bug report</h3>
        <p>{scenario.symptom}</p>
        <details>
          <summary>The failing test</summary>
          <Code name="test_failing.py" code={scenario.failingTest} />
        </details>
        <details>
          <summary>Original code</summary>
          {Object.entries(scenario.files).map(([name, code]) => (
            <Code key={name} name={name} code={code} />
          ))}
        </details>
      </aside>
    </div>
  );
}
