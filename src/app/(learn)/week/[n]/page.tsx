import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WeekDayList } from "@/components/week-days";
import { LabCard, MonthCard } from "@/components/lab-card";
import { getCurriculum } from "@/lib/curriculum";
import { DSA_ENABLED } from "@/lib/day-steps";
import { labFor } from "@/data/labs";
import { MONTHS, WEEKS_PER_MONTH, monthExercises } from "@/data/months";

export async function generateStaticParams() {
  const c = await getCurriculum();
  return c.weeks.map((w) => ({ n: String(w.number) }));
}

export async function generateMetadata({ params }: PageProps<"/week/[n]">): Promise<Metadata> {
  const { n } = await params;
  const week = (await getCurriculum()).weeks.find((w) => String(w.number) === n);
  return week ? { title: `Week ${n}: ${week.title}`, description: week.summary } : {};
}

export default async function WeekPage({ params }: PageProps<"/week/[n]">) {
  const { n } = await params;
  const c = await getCurriculum();
  const week = c.weeks.find((w) => String(w.number) === n);
  if (!week) notFound();
  const phase = c.phases.find((p) => p.slug === week.phase)!;
  const prev = c.weeks.find((w) => w.number === week.number - 1);
  const next = c.weeks.find((w) => w.number === week.number + 1);
  const dsa = [...new Set(week.days.map((d) => d.dsaTitle))];
  const swe = [...new Set(week.days.map((d) => d.sweTitle))];
  const lab = labFor(week.number);
  const review =
    week.number % WEEKS_PER_MONTH === 0
      ? MONTHS.find((m) => m.month === week.number / WEEKS_PER_MONTH)
      : undefined;

  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/plan">Course</Link>
        <i>/</i>
        <span>{phase.name}</span>
        <i>/</i>
        <span>Week {week.number}</span>
      </nav>
      <h1>{week.title}</h1>
      <p className="quiet">
        Week {week.number} of {c.weeks.length} · {phase.name} · {phase.language}
      </p>
      <p className="lead">{week.summary}</p>
      {week.number === 1 && (
        <div className="callout">
          <b>New to programming?</b>
          The optional four-week <Link href="/foundations">Part 0: Python Foundations</Link> is for people who
          do not know basic programming yet. If you can already write functions, loops and classes, skip it.
        </div>
      )}
      <div className="callout">
        <b>Project</b>
        {week.project}
      </div>
      <h2 id="days">Days</h2>
      <WeekDayList
        days={week.days.map((d) => ({
          id: d.id,
          week: week.number,
          day: d.numberInWeek,
          title: d.title,
          why: d.why,
        }))}
      />
      {lab && <LabCard week={week.number} focus={lab.focus} count={lab.exercises.length} />}
      <p>
        <Link href={`/revise?w=${week.number}`}>Quiz yourself on this week</Link>
        <span className="quiet"> · mixed questions, flashcards and code snippets</span>
      </p>
      {review && (
        <MonthCard month={review.month} focus={review.focus} count={monthExercises(review).length} />
      )}
      <h2 id="parallel">Running in parallel</h2>
      <div className="cols">
        {DSA_ENABLED && (
          <div>
            <h3>DSA in Python</h3>
            <ul className="plain">
              {dsa.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3>Engineering slot</h3>
          <ul className="plain">
            {swe.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="pager">
        {prev ? (
          <Link className="prev" href={`/week/${prev.number}`}>
            <small>Previous week</small>
            <strong>{prev.title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="next" href={`/week/${next.number}`}>
            <small>Next week</small>
            <strong>{next.title}</strong>
          </Link>
        )}
      </div>
    </article>
  );
}
