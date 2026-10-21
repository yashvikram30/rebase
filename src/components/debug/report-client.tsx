"use client";
import Link from "next/link";
import { useState } from "react";
import { revealAnswer } from "@/app/(debug)/debug/actions";
import type { AnswerKey } from "@/lib/debug";
import { DIMENSIONS, type Rating, type Suggestion } from "@/lib/debug-report-types";
import { describeEvent } from "@/lib/debug-session";
import { requestReview } from "@/lib/review-request";
import { useNowSeconds } from "@/components/workbench/use-now";
import { useChats, useDrafts } from "@/lib/workbench-store";
import { ReportSkeleton } from "./report-skeleton";
import { Diff } from "./results";

const RATING: Record<Rating, { label: string; glyph: string }> = {
  strong: { label: "Strong", glyph: "✓" },
  fair: { label: "Fair", glyph: "~" },
  weak: { label: "Needs work", glyph: "✗" },
  "not shown": { label: "Not shown", glyph: "–" },
};

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Search links, never the model's own URLs, which could be wrong. */
const searchHref = (s: Suggestion) =>
  s.kind === "video"
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(s.title)}`
    : `https://www.google.com/search?q=${encodeURIComponent(s.title)}`;

export function ReportClient({
  id,
  original,
  topic,
}: {
  id: string;
  original: Record<string, string>;
  topic: { domain: string; concept: string };
}) {
  const chat = useChats()[id];
  const draft = useDrafts()[id];
  const [key, setKey] = useState<AnswerKey | null>(null);
  const stored = chat?.report;
  const now = useNowSeconds();
  const pending = chat?.review;
  // A request that is still "loading" long after it started was lost (the tab closed mid-request).
  const lost = !!pending && !pending.error && now > 0 && now * 1000 - pending.at > 150_000;

  if (!stored && pending && !pending.error && !lost) return <ReportSkeleton />;

  if (!stored && pending) {
    const retry = () =>
      void requestReview(
        id,
        Object.fromEntries(Object.keys(original).map((f) => [f, draft?.files[f] ?? original[f]])),
        pending.explanation,
      );
    return (
      <>
        <p className="lead">{pending.error ?? "The review took too long and was lost."}</p>
        <p className="dbg-report-actions">
          <button type="button" className="dbg-btn" onClick={retry}>
            Try again
          </button>
          <Link className="dbg-link" href={`/debug/${id}`}>
            Open the workbench
          </Link>
        </p>
      </>
    );
  }

  if (!stored) {
    return (
      <>
        <p className="lead">There is no review for this case yet.</p>
        <p>
          <Link className="dbg-btn" href={`/debug/${id}`}>
            Open the workbench
          </Link>
        </p>
      </>
    );
  }

  const { report, course } = stored;
  const files = Object.fromEntries(Object.keys(original).map((f) => [f, draft?.files[f] ?? original[f]]));
  const changed = Object.keys(original).filter((f) => files[f] !== original[f]);

  return (
    <div className="dbg-report">
      {stored.source === "basic" && (
        <p className="dbg-note" role="note">
          {stored.note ?? "This is the basic report."} It is built from what you did in the round, with fixed
          rules.
        </p>
      )}
      <p className="lead">{report.summary}</p>
      <p className="dbg-topic">
        This case was about <strong>{topic.concept}</strong> ({topic.domain}).
      </p>

      <section aria-labelledby="rep-how">
        <h2 id="rep-how">How you worked</h2>
        <dl className="dbg-dims">
          {DIMENSIONS.map(([k, label]) => {
            const d = report.dimensions[k];
            const r = RATING[d.rating];
            return (
              <div key={k} className="dbg-dim">
                <dt>{label}</dt>
                <dd className={`dbg-rating is-${d.rating.replace(" ", "-")}`}>
                  <span aria-hidden="true">{r.glyph}</span> {r.label}
                </dd>
                <dd className="dbg-dim-why">{d.evidence}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <div className="dbg-two">
        {report.strengths.length > 0 && (
          <section aria-labelledby="rep-good">
            <h2 id="rep-good">What went well</h2>
            <ul>
              {report.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}
        {report.improvements.length > 0 && (
          <section aria-labelledby="rep-next">
            <h2 id="rep-next">What to do next time</h2>
            <ul>
              {report.improvements.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section aria-labelledby="rep-ai">
        <h2 id="rep-ai">Using the assistant</h2>
        <p>{report.aiUsage.summary}</p>
      </section>

      <section aria-labelledby="rep-change">
        <h2 id="rep-change">What you changed</h2>
        {changed.length === 0 ? (
          <p className="dbg-muted">You did not change any code.</p>
        ) : (
          changed.map((f) => <Diff key={f} name={f} before={original[f]} after={files[f]} />)
        )}
        <details className="dbg-explain">
          <summary>Your explanation</summary>
          <p>{stored.explanation}</p>
        </details>
      </section>

      <section aria-labelledby="rep-why">
        <h2 id="rep-why">What was actually wrong</h2>
        {key ? (
          <div className="dbg-reveal">
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
          <button type="button" className="dbg-btn" onClick={async () => setKey(await revealAnswer(id))}>
            Show the root cause
          </button>
        )}
      </section>

      <section aria-labelledby="rep-revisit">
        <h2 id="rep-revisit">What to revisit</h2>
        <h3 className="dbg-sub">From the course</h3>
        <ul className="dbg-course">
          {course.map((c) => (
            <li key={c.tag}>
              <strong>{c.label}</strong>
              <span>
                {c.days
                  .filter((d) => typeof d.href === "string")
                  .map((d) => (
                    <Link key={d.href} href={d.href}>
                      {d.label}
                    </Link>
                  ))}
              </span>
            </li>
          ))}
        </ul>
        {report.revisit.length > 0 && (
          <>
            <h3 className="dbg-sub">
              Suggested by the mentor <small>(AI-written, not checked)</small>
            </h3>
            <ul className="dbg-course">
              {report.revisit.map((s) => (
                <li key={s.title}>
                  <strong>{s.title}</strong>
                  <span>
                    {s.why}{" "}
                    <a href={searchHref(s)} target="_blank" rel="noopener noreferrer">
                      Search for {s.kind === "video" ? "videos" : "this topic"}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="rep-time">
        <details className="dbg-timeline">
          <summary id="rep-time">Timeline ({chat.events.length} events)</summary>
          <ol>
            {chat.events.map((e, i) => (
              <li key={i}>
                <time>{clock(e.at - chat.started)}</time> {describeEvent(e)}
              </li>
            ))}
          </ol>
        </details>
      </section>

      <p className="dbg-report-actions">
        <Link className="dbg-btn" href="/debug">
          All cases
        </Link>
      </p>
    </div>
  );
}
