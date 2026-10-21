"use client";
import Link from "next/link";
import { useState } from "react";

type Choice = "merge" | "changes";

const CASE = "account-lost-update";

const FILES = [
  { group: "Case", names: ["BUG_REPORT.md", "test_failing.py"] },
  { group: "Code", names: ["sched.py", "service.py", "store.py"] },
];

/**
 * The home page's demo, drawn as the Debug workbench: an AI agent's patch that passes its test but is half a
 * fix. The visitor decides whether to merge it, then sees why. Built from the real `account-lost-update` case.
 */
export function PatchReview() {
  const [choice, setChoice] = useState<Choice | null>(null);

  return (
    <section className="pw" aria-label="Try it: review a patch an AI agent wrote">
      <div className="pw-bar" aria-hidden="true">
        <span className="pw-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="pw-path">rebase / debug / {CASE}</span>
      </div>

      <div className="pw-body">
        <nav className="pw-files" aria-hidden="true">
          {FILES.map((g) => (
            <div key={g.group}>
              <small>{g.group}</small>
              {g.names.map((n) => (
                <span key={n} className={n === "store.py" ? "on" : undefined}>
                  {n}
                  {n === "store.py" && <i title="Changed" />}
                </span>
              ))}
            </div>
          ))}
        </nav>

        <div className="pw-code">
          <div className="pw-tab" aria-hidden="true">
            store.py
          </div>
          <pre
            role="img"
            aria-label="Diff of store.py: write now raises Conflict when the row's version has changed"
          >
            <code>
              <span>{"def write(self, account_id, balance, expected_version):"}</span>
              <span>{"    row = self._rows[account_id]"}</span>
              <span className="add">{'+   if row["version"] != expected_version:'}</span>
              <span className="add">{"+       raise Conflict(account_id)"}</span>
              <span>{'    row["balance"] = balance'}</span>
              <span>{'    row["version"] += 1'}</span>
            </code>
          </pre>
          <p className="pw-pass">
            <span aria-hidden="true">✓</span> test_no_withdrawal_is_lost passes
          </p>
        </div>

        <div className="pw-side">
          <p className="pw-agent">
            <b>Agent</b>
            Two withdrawals overwrote each other. I added optimistic locking, so a stale write is rejected.
          </p>
          {choice === null ? (
            <div className="pw-ask">
              <p>Would you merge this?</p>
              <div className="pw-actions">
                <button type="button" className="btn" onClick={() => setChoice("merge")}>
                  Merge
                </button>
                <button type="button" className="btn" onClick={() => setChoice("changes")}>
                  Request changes
                </button>
              </div>
            </div>
          ) : null}
          <div className="pw-result" aria-live="polite">
            {choice ? (
              <>
                <h3 className={choice === "changes" ? "is-right" : "is-wrong"}>
                  {choice === "merge" ? "Not yet: it is half a fix." : "Right call: it is half a fix."}
                </h3>
                <p>Nothing retries the rejected write, so one customer gets an error and no money.</p>
                <div className="pw-actions">
                  <Link className="btn primary" href={`/debug/${CASE}`}>
                    Fix it yourself
                  </Link>
                  <button type="button" className="pw-again" onClick={() => setChoice(null)}>
                    Try again
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
