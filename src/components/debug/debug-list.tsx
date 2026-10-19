"use client";
import Link from "next/link";
import { useState } from "react";
import { useDebug } from "@/lib/debug-store";
import { useChats } from "@/lib/workbench-store";

type Item = {
  id: string;
  title: string;
  domain: string;
  difficulty: number;
  symptom: string;
  failing: string;
  reviewable: boolean;
};

function Level({ n }: { n: number }) {
  return (
    <span className="dbg-level" role="img" aria-label={`Difficulty ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? "on" : undefined} />
      ))}
    </span>
  );
}

export function DebugList({ scenarios, labels }: { scenarios: Item[]; labels: Record<string, string> }) {
  const { reviews, solves } = useDebug();
  const chats = useChats();
  const [filter, setFilter] = useState("all");

  const domains = [...new Set(scenarios.map((s) => s.domain))];
  const shown = filter === "all" ? scenarios : scenarios.filter((s) => s.domain === filter);
  const next = scenarios.find((s) => !solves[s.id]);
  const solved = scenarios.filter((s) => solves[s.id]).length;

  return (
    <>
      <section className="dbg-next" aria-labelledby="dbg-next-h">
        <h2 id="dbg-next-h">Next case</h2>
        {next ? (
          <div className="dbg-fail">
            <p className="dbg-fail-name">
              <span aria-hidden="true">✗</span>
              <code>{next.failing}</code>
            </p>
            <p className="dbg-fail-title">{next.title}</p>
            <p className="dbg-fail-text">{next.symptom}</p>
            <div className="dbg-fail-actions">
              <Link className="dbg-btn" href={`/debug/${next.id}`}>
                Open in workbench
              </Link>
              {next.reviewable && (
                <Link className="dbg-link" href={`/debug/${next.id}/review`}>
                  Review the agent&apos;s session instead
                </Link>
              )}
            </div>
          </div>
        ) : (
          <p className="dbg-muted">You have solved every case. More are on the way.</p>
        )}
      </section>

      <section className="dbg-cases" aria-labelledby="dbg-cases-h">
        <div className="dbg-cases-head">
          <h2 id="dbg-cases-h">All cases</h2>
          <p className="dbg-muted">
            {solved} of {scenarios.length} solved
          </p>
        </div>
        <div className="dbg-filter" role="group" aria-label="Filter by topic">
          {["all", ...domains].map((d) => (
            <button key={d} type="button" aria-pressed={filter === d} onClick={() => setFilter(d)}>
              {d === "all" ? "All" : (labels[d] ?? d)}
              <span>{d === "all" ? scenarios.length : scenarios.filter((s) => s.domain === d).length}</span>
            </button>
          ))}
        </div>
        <ul className="dbg-rows">
          {shown.map((s) => {
            const done = solves[s.id];
            const review = reviews[s.id];
            return (
              <li key={s.id} className="dbg-row is-link">
                <span
                  className={"dbg-status" + (done ? " is-right" : "")}
                  role="img"
                  aria-label={done ? "Solved" : "Not solved yet"}
                >
                  {done ? "✓" : ""}
                </span>
                <div className="dbg-row-main">
                  <p className="dbg-row-title">
                    <Link href={`/debug/${s.id}`}>{s.title}</Link>
                  </p>
                  <p className="dbg-row-text">{s.symptom}</p>
                  <p className="dbg-row-meta">
                    <span>{labels[s.domain] ?? s.domain}</span>
                    {s.reviewable && (
                      <Link href={`/debug/${s.id}/review`}>Review the agent&apos;s session</Link>
                    )}
                    {chats[s.id]?.report && <Link href={`/debug/${s.id}/report`}>View your review</Link>}
                    {review && <span>{review.correct ? "Reviewed: right call" : "Reviewed: missed it"}</span>}
                  </p>
                </div>
                <Level n={s.difficulty} />
                <p className="dbg-row-act">{done ? "Open again" : "Open"}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
