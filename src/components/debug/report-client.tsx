"use client";
import Link from "next/link";
import { useState } from "react";
import { revealAnswer } from "@/app/(debug)/debug/actions";
import type { AnswerKey } from "@/lib/debug";
import { DIMENSIONS, type Rating, type Suggestion } from "@/lib/debug-report-types";
import { describeEvent } from "@/lib/debug-session";
import { requestReview } from "@/lib/review-request";
import { useNowSeconds } from "@/components/workbench/use-now";
import { allReports, useChats, useDrafts } from "@/lib/workbench-store";
import { ReportSkeleton } from "./report-skeleton";
import { Diff } from "./results";

const RATING: Record<Rating, { label: string; glyph: string }> = {
  strong: { label: "Strong", glyph: "✓" },
  fair: { label: "Fair", glyph: "~" },
  weak: { label: "Needs work", glyph: "✗" },
  "not shown": { label: "Not shown", glyph: "–" },
};

const TALLY: Rating[] = ["strong", "fair", "weak", "not shown"];

/** The sections of the review, for the jump bar. */
const JUMP = [
  ["#rep-how", "How you worked"],
  ["#rep-take", "Takeaways"],
  ["#rep-ai", "Assistant"],
  ["#rep-change", "Changes"],
  ["#rep-why", "Root cause"],
  ["#rep-revisit", "Revisit"],
  ["#rep-time", "Timeline"],
] as const;

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
  at,
}: {
  id: string;
  /** Which review to show, by its timestamp. The newest one when left out. */
  at?: number;
  original: Record<string, string>;
  topic: { domain: string; concept: string };
}) {
  const chat = useChats()[id];
  const draft = useDrafts()[id];
  const [key, setKey] = useState<AnswerKey | null>(null);
  const reports = allReports(chat);
  const stored = at === undefined ? chat?.report : reports.find((r) => r.at === at);
  const isLatest = !!stored && stored === chat?.report;
  const now = useNowSeconds();
  const pending = at === undefined ? chat?.review : undefined;
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
        <p className="lead">
          {at === undefined ? "There is no review for this case yet." : "That review is not on this device."}
        </p>
        <p className="dbg-report-actions">
          <Link className="dbg-btn" href={`/debug/${id}`}>
            Open the workbench
          </Link>
          {reports.length > 0 && (
            <Link className="dbg-link" href={`/debug/${id}/reviews`}>
              All reviews for this case
            </Link>
          )}
        </p>
      </>
    );
  }

  const { report, course } = stored;
  const files = Object.fromEntries(
    Object.keys(original).map((f) => [f, stored.files?.[f] ?? draft?.files[f] ?? original[f]]),
  );
  const changed = Object.keys(original).filter((f) => files[f] !== original[f]);
  const counts = Object.fromEntries(TALLY.map((r) => [r, 0])) as Record<Rating, number>;
  for (const [k] of DIMENSIONS) counts[report.dimensions[k].rating]++;
  // A review keeps the timeline of the visit it was written from. Older ones did not, so the newest falls back
  // to the stored timeline.
  const events = stored.events ?? (isLatest ? chat?.events : undefined);
  const started = stored.started ?? chat?.started ?? 0;
  const asked = events?.filter((e) => e.type === "chat-user").length ?? 0;
  const applied = events?.filter((e) => e.type === "patch-applied").length ?? 0;
  const runs = events?.filter((e) => e.type === "run").length ?? 0;
  const last = events?.[events.length - 1];
  const glance: [string, string | number][] = [
    ["Time", last ? clock(last.at - started) : "–"],
    ["Test runs", runs],
    ["Assistant questions", asked],
    ["Patches applied", applied],
    ["Files changed", changed.length],
  ];

  return (
    <div className="dbg-report">
      {stored.source === "basic" && (
        <p className="dbg-note" role="note">
          {stored.note ?? "This is the basic report."} It is built from what you did in the round, with fixed
          rules.
        </p>
      )}
      <header className="dbg-hero">
        <p className="dbg-hero-kicker">
          {topic.concept} <span aria-hidden="true">·</span> {topic.domain}
        </p>
        <p className="dbg-hero-summary">{report.summary}</p>
        <ul className="dbg-tally" aria-label="Ratings at a glance">
          {TALLY.map((r) => (
            <li key={r} className={`dbg-chip is-${r.replace(" ", "-")}`}>
              <b>{counts[r]}</b> {RATING[r].label}
            </li>
          ))}
        </ul>
        <dl className="dbg-glance">
          {glance.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <nav className="dbg-jump" aria-label="Sections of this review">
        {JUMP.filter(([href]) => href !== "#rep-time" || (events && events.length > 0)).map(
          ([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ),
        )}
      </nav>

      <section aria-labelledby="rep-how" className="dbg-sec">
        <h2 id="rep-how">How you worked</h2>
        <dl className="dbg-dims">
          {DIMENSIONS.map(([k, label]) => {
            const d = report.dimensions[k];
            const r = RATING[d.rating];
            return (
              <div key={k} className={`dbg-dim is-${d.rating.replace(" ", "-")}`}>
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

      {(report.strengths.length > 0 || report.improvements.length > 0) && (
        <section aria-labelledby="rep-take" className="dbg-sec">
          <h2 id="rep-take">Takeaways</h2>
          <div className="dbg-two">
            {report.strengths.length > 0 && (
              <div className="dbg-card is-good">
                <h3>What went well</h3>
                <ul>
                  {report.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.improvements.length > 0 && (
              <div className="dbg-card is-next">
                <h3>What to do next time</h3>
                <ul>
                  {report.improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="rep-ai" className="dbg-sec">
        <h2 id="rep-ai">
          Using the assistant
          <span className={`dbg-badge ${report.aiUsage.overReliance ? "is-warn" : asked ? "is-ok" : ""}`}>
            {report.aiUsage.overReliance ? "Leaned on it" : asked ? "Used well" : "Not used"}
          </span>
        </h2>
        <p className="dbg-prose">{report.aiUsage.summary}</p>
      </section>

      <section aria-labelledby="rep-change" className="dbg-sec">
        <h2 id="rep-change">
          What you changed
          <small>
            {changed.length === 0 ? "no files" : `${changed.length} file${changed.length > 1 ? "s" : ""}`}
          </small>
        </h2>
        {changed.length === 0 ? (
          <p className="dbg-empty">You did not change any code.</p>
        ) : (
          changed.map((f) => <Diff key={f} name={f} before={original[f]} after={files[f]} />)
        )}
        <h3 className="dbg-sub">Your explanation</h3>
        {stored.explanation.trim() ? (
          <blockquote className="dbg-quote">{stored.explanation}</blockquote>
        ) : (
          <p className="dbg-empty">You did not write an explanation.</p>
        )}
      </section>

      <section aria-labelledby="rep-why" className="dbg-sec">
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
          <div className="dbg-empty dbg-empty-act">
            <span>Compare it with your own explanation above, then check.</span>
            <button type="button" className="dbg-btn" onClick={async () => setKey(await revealAnswer(id))}>
              Show the root cause
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="rep-revisit" className="dbg-sec">
        <h2 id="rep-revisit">What to revisit</h2>
        <h3 className="dbg-sub">From the course</h3>
        {course.map((c) => (
          <div key={c.tag} className="dbg-concept">
            <h4>{c.label}</h4>
            <ul className="daylist dbg-daylist">
              {c.days
                .filter((d) => typeof d.href === "string")
                .map((d) => {
                  // "Week 4, day 2, engineering: Title" becomes a title and a where-line.
                  const cut = d.label.indexOf(": ");
                  const where = cut === -1 ? "" : d.label.slice(0, cut);
                  const title = cut === -1 ? d.label : d.label.slice(cut + 2);
                  return (
                    <li key={d.href}>
                      <Link href={d.href}>
                        <span>
                          <span className="dtt">{title}</span>
                          {where && <span className="dd">{where}</span>}
                        </span>
                        <span className="st" aria-hidden="true">
                          Open →
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {report.revisit.length > 0 && (
          <>
            <h3 className="dbg-sub">
              Suggested by the mentor <small>(AI-written, not checked)</small>
            </h3>
            <ul className="daylist dbg-daylist">
              {report.revisit.map((s) => (
                <li key={s.title}>
                  <a href={searchHref(s)} target="_blank" rel="noopener noreferrer">
                    <span>
                      <span className="dtt">{s.title}</span>
                      <span className="dd">{s.why}</span>
                    </span>
                    <span className="st" aria-hidden="true">
                      Search {s.kind === "video" ? "videos" : "topic"} ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {events && events.length > 0 && (
        <section aria-labelledby="rep-time" className="dbg-sec">
          <details className="dbg-timeline">
            <summary>
              <h2 id="rep-time">
                Timeline <small>{events.length} events</small>
              </h2>
            </summary>
            <ol>
              {events.map((e, i) => (
                <li key={i} className={`is-${e.type}`}>
                  <time>{clock(e.at - started)}</time>
                  <span>{describeEvent(e)}</span>
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}

      <p className="dbg-report-actions">
        <Link className="dbg-btn" href="/debug">
          All cases
        </Link>
        {reports.length > 1 && (
          <Link className="dbg-link" href={`/debug/${id}/reviews`}>
            All reviews for this case ({reports.length})
          </Link>
        )}
      </p>
    </div>
  );
}
