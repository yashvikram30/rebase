import Link from "next/link";
import { ContinueStrip } from "@/components/continue-strip";
import { PatchReview } from "@/components/patch-review";
import { QUESTIONS } from "@/data/revision";
import { getCurriculum } from "@/lib/curriculum";
import { allScenarios } from "@/lib/debug";
import { DSA_ENABLED } from "@/lib/day-steps";
import { planDays } from "@/lib/plan-days";
import { GITHUB_URL } from "@/lib/site";
import type { CSSProperties } from "react";
import "./platform.css";

/** 0 for the first layer up to 100 for the last: drives the ink-to-cobalt colour of the course map. */
const tone = (i: number, n: number): CSSProperties =>
  ({ "--t": n > 1 ? Math.round((i / (n - 1)) * 100) : 0 }) as CSSProperties;

export default async function PlatformHome() {
  const c = await getCurriculum();
  const scenarios = allScenarios();
  const cases = scenarios.length;
  const days = planDays(c).map(({ id, week, day, title }) => ({ id, week, day, title }));
  const layers = c.phases
    .map((p) => ({ p, weeks: c.weeks.filter((w) => w.phase === p.slug) }))
    .filter((l) => l.weeks.length > 0);

  return (
    <div className="plt">
      <section className="plt-hero">
        <div className="plt-wrap">
          <p className="plt-pill">Practice for AI-enabled interviews</p>
          <h1>Can you tell when the AI is wrong?</h1>
          <p className="plt-sub">
            Fix real broken code, judge an AI&apos;s patches, and learn how the machine works underneath.
          </p>
          <div className="plt-cta">
            <Link className="btn primary big" href="/debug">
              Try a broken case
            </Link>
            <Link className="btn big" href="/plan">
              See the course
            </Link>
          </div>
          <p className="plt-fine">Free. No account needed.</p>
        </div>
        <div className="plt-wrap plt-demo-wrap">
          <PatchReview />
        </div>
      </section>

      <ContinueStrip days={days} cases={scenarios.map(({ id, title }) => ({ id, title }))} />

      <section className="plt-proof" aria-label="Rebase in numbers">
        <div className="plt-wrap">
          <dl className="plt-proof-list">
            <div>
              <dt>{days.length}</dt>
              <dd>days of lessons and builds</dd>
            </div>
            <div>
              <dt>{QUESTIONS.length}</dt>
              <dd>revision questions</dd>
            </div>
            <div>
              <dt>{cases}</dt>
              <dd>broken programs to debug</dd>
            </div>
            <div>
              <dt>Free</dt>
              <dd>and open source</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="plt-row">
        <div className="plt-wrap plt-row-grid">
          <div className="plt-copy">
            <h2>Learn how computers work, one small day at a time.</h2>
            <p>
              Each day is{" "}
              {DSA_ENABLED ? "five short pages: learn, build, DSA" : "four short pages: learn, build"},
              engineering and a check. You start at the machine and end with an AI system you built yourself.
            </p>
            <ul>
              <li>About three hours a day, four days a week, for sixteen weeks.</li>
              <li>Fall behind and reschedule from today. Nothing you finished moves.</li>
              <li>Linked notes and a revision set made from what you are about to forget.</li>
            </ul>
            <p>
              <Link className="plt-link" href="/plan">
                Open the course
              </Link>
            </p>
          </div>
          <div className="plt-mock plt-day" aria-hidden="true">
            <div className="plt-mock-bar">
              <b>Scheduling and context switching</b>
              <span>Day 10 of 64</span>
            </div>
            {[
              ["Learn", "Read how the OS picks the next process", 3, 3],
              ["Build", "Write a round-robin scheduler", 2, 5],
              ["Engineering", "Why the slow request was not the culprit", 0, 1],
              ["Check", "Explain a context switch from memory", 0, 4],
            ].map(([name, text, done, total]) => (
              <div key={name as string} className="plt-day-row">
                <span className={"plt-dot" + (done === total ? " is-done" : "")} />
                <span>
                  <b>{name}</b>
                  <small>{text}</small>
                </span>
                <span className="plt-count">
                  {done} of {total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="plt-row plt-row-flip">
        <div className="plt-wrap plt-row-grid">
          <div className="plt-mock plt-bench" aria-hidden="true">
            <div className="plt-tabs">
              <span className="on">store.py</span>
              <span>service.py</span>
              <span>test_failing.py</span>
              <span className="plt-run">Run failing test</span>
            </div>
            <pre>
              <code>
                {`def write(self, account_id, balance, expected_version):
    row = self._rows[account_id]
    row["balance"] = balance
    row["version"] += 1`}
              </code>
            </pre>
            <div className="plt-term">
              <span className="bad">FAIL</span> test_no_withdrawal_is_lost
              <br />
              AssertionError: 70 != 20
            </div>
            <div className="plt-assist">
              <b>Assistant</b> Say what you think is wrong first. Then I can help.
            </div>
          </div>
          <div className="plt-copy">
            <h2>Practice the debugging round, with an assistant in the room.</h2>
            <p>
              You get broken code and a failing test, the way an AI-enabled interview hands it to you. Fix it
              in an editor that runs Python in your browser, then see what you missed.
            </p>
            <ul>
              <li>The assistant will not write the fix until you say what you think is wrong.</li>
              <li>A hidden regression suite checks that you did not break something else.</li>
              <li>Or read an agent&apos;s patch, run it, and decide whether to approve it.</li>
            </ul>
            <p>
              <Link className="plt-link" href="/debug">
                Browse the {cases} cases
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="plt-map">
        <div className="plt-wrap">
          <h2>Seven layers, each built on the one below.</h2>
          <ol className="plt-layers" aria-label="The course, in order">
            {layers.map((l, i) => (
              <li key={l.p.slug} style={{ ...tone(i, layers.length), flexGrow: l.weeks.length }}>
                <b>{l.p.name}</b>
                <span>
                  {l.weeks.length === 1
                    ? `Week ${l.weeks[0].number}`
                    : `Weeks ${l.weeks[0].number} to ${l.weeks[l.weeks.length - 1].number}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="plt-end">
        <div className="plt-wrap">
          <h2>Start with one broken program. It takes ten minutes.</h2>
          <div className="plt-cta">
            <Link className="btn primary big" href="/debug">
              Try a broken case
            </Link>
            <Link className="btn big" href="/plan">
              Start the course
            </Link>
          </div>
        </div>
      </section>

      <footer className="plt-foot">
        <div className="plt-wrap plt-foot-grid">
          <p className="plt-foot-brand">
            <b>Rebase</b>
            <span>Learn how computers work, then prove it on broken code.</span>
          </p>
          <nav aria-label="Learn">
            <h2>Learn</h2>
            <Link href="/learn">Today</Link>
            <Link href="/plan">Course</Link>
            <Link href="/revise">Revise</Link>
            <Link href="/notes">Notes</Link>
            <Link href="/foundations">Part 0: Python Foundations</Link>
          </nav>
          <nav aria-label="Debug">
            <h2>Debug</h2>
            <Link href="/debug">All cases</Link>
            <Link href="/debug/random">Random round</Link>
          </nav>
          <nav aria-label="Account and project">
            <h2>Rebase</h2>
            <Link href="/profile">Profile</Link>
            <Link href="/settings">Settings</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              Source on GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
