import type { Metadata } from "next";
import Link from "next/link";
import { FoundationDayList, FoundationProgress } from "@/components/foundation-days";
import { FOUNDATION_DAYS, FOUNDATION_SOURCES, FOUNDATION_WEEKS, foundationHref } from "@/data/foundations";

export const metadata: Metadata = {
  title: "Python Foundations",
  description:
    "Part 0, optional: a four-week start-from-zero Python course for people who do not know basic programming yet. Built from freeCodeCamp, Google's Python Class and a video course. If you can already code, skip to Week 1.",
};

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function FoundationsPage() {
  const hours = Math.round(FOUNDATION_DAYS.reduce((n, d) => n + d.minutes, 0) / 60);
  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/plan">Course</Link>
        <i>/</i>
        <span>Python Foundations</span>
      </nav>
      <h1>Python Foundations</h1>
      <p className="quiet">
        Part 0 (optional) · {FOUNDATION_WEEKS.length} weeks · 4 days a week · about{" "}
        {Math.round(hours / FOUNDATION_DAYS.length)} hours a day · {FOUNDATION_DAYS.length} days in all
      </p>
      <p className="lead">
        This part is optional. It is for people who do not know basic programming yet; if you can already code
        in Python, skip it. In four weeks you go from installing Python to a finished project in a git repo.
        Then Week 1 of the main plan assumes you can write the code in it.
      </p>

      <div className="callout">
        <b>Can you skip it?</b>
        If you can already write a function that loops over a list, read a file, and catch an error, skip to{" "}
        <Link href="/week/1">Week 1</Link>. Day 4 of week 4 has a short readiness check: take it first.
      </div>

      <FoundationProgress ids={FOUNDATION_DAYS.map((d) => d.id)} />

      <h2 id="how">How a day works</h2>
      <ol className="plain">
        <li>
          <b>Learn (about 60 to 90 minutes).</b> Start with the gentle freeCodeCamp lecture. Then the same
          topic in Google&apos;s Python Class, and a chapter of the video course if you want to see someone do
          it. Type every example yourself; do not paste.
        </li>
        <li>
          <b>Practice (about 60 to 90 minutes).</b> A freeCodeCamp workshop or lab, a Google exercise, and a
          small program of your own. This is the part that makes it stick, so never skip it.
        </li>
        <li>
          <b>Check (10 minutes).</b> Answer three questions out loud from memory, then tick the day complete.
        </li>
      </ol>
      <p>
        If you are stuck for more than 20 minutes, write down what you tried, take a break, and move on. Come
        back after you have slept on it. Everyone gets stuck; the goal is to get unstuck without being told
        the answer.
      </p>

      <h2 id="sources">What it is built from</h2>
      <div className="cols">
        {FOUNDATION_SOURCES.map((s) => (
          <div key={s.url}>
            <h3>
              <a href={s.url} {...ext}>
                {s.title}
              </a>
            </h3>
            <p>{s.why}</p>
          </div>
        ))}
      </div>

      <h2 id="weeks">The four weeks</h2>
      {FOUNDATION_WEEKS.map((w) => (
        <section key={w.number} aria-labelledby={`fw${w.number}`}>
          <h3 id={`fw${w.number}`}>
            Week {w.number}: {w.title}
          </h3>
          <p>{w.summary}</p>
          <FoundationDayList
            days={w.days.map((d) => ({
              id: d.id,
              href: foundationHref(d.week, d.n),
              n: d.n,
              title: d.title,
              why: d.goal,
            }))}
          />
          <div className="callout">
            <b>End of week {w.number}</b>
            {w.checkpoint}
          </div>
        </section>
      ))}

      <h2 id="next">When you are done</h2>
      <p>
        Move on to <Link href="/week/1">Week 1: the machine, in Python</Link>. It re-uses what you learned
        here and starts to look underneath it. If a topic there feels shaky, come back to the matching day
        above.
      </p>
    </article>
  );
}
