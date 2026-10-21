import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabClient, type LabCard, type LabProblem } from "@/components/lab-client";
import { getCurriculum } from "@/lib/curriculum";
import { dayHref } from "@/lib/curriculum-types";
import { DSA_ENABLED } from "@/lib/day-steps";
import { labFor } from "@/data/labs";

export async function generateStaticParams() {
  const c = await getCurriculum();
  return c.weeks.map((w) => ({ n: String(w.number) }));
}

export async function generateMetadata({ params }: PageProps<"/week/[n]/lab">): Promise<Metadata> {
  const { n } = await params;
  const week = (await getCurriculum()).weeks.find((w) => String(w.number) === n);
  return week
    ? {
        title: `Week ${n} revision lab`,
        description: `Optional hands-on review for week ${n}: ${week.title}.`,
      }
    : {};
}

export default async function LabPage({ params }: PageProps<"/week/[n]/lab">) {
  const { n } = await params;
  const c = await getCurriculum();
  const week = c.weeks.find((w) => String(w.number) === n);
  const lab = week ? labFor(week.number) : undefined;
  if (!week || !lab) notFound();
  const phase = c.phases.find((p) => p.slug === week.phase)!;

  const upTo = c.weeks.filter((w) => w.number <= week.number);
  const cards: LabCard[] = upTo.flatMap((w) =>
    w.days.flatMap((d) =>
      d.questions.map((q, i) => ({
        id: `${d.id}:q${i}`,
        q,
        week: w.number,
        dayTitle: d.title,
        href: dayHref(w.number, d.numberInWeek),
      })),
    ),
  );
  const problems: LabProblem[] = upTo.flatMap((w) =>
    w.days.flatMap((d) =>
      d.items
        .filter((i) => DSA_ENABLED && i.section === "dsa_problem")
        .map((i) => ({
          key: i.key,
          title: i.title,
          url: i.url,
          difficulty: i.difficulty,
          week: w.number,
          topic: d.dsaTitle,
        })),
    ),
  );

  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/plan">Course</Link>
        <i>/</i>
        <span>{phase.name}</span>
        <i>/</i>
        <Link href={`/week/${week.number}`}>Week {week.number}</Link>
        <i>/</i>
        <span>Revision lab</span>
      </nav>
      <h1>Week {week.number} revision lab</h1>
      <p className="quiet">Optional fifth day · about 2 hours</p>
      <p className="lead">{lab.focus}</p>
      <LabClient
        week={week.number}
        weekTitle={week.title}
        exercises={lab.exercises}
        cards={cards}
        problems={problems}
        days={week.days.map((d) => ({
          id: d.id,
          title: d.title,
          href: dayHref(week.number, d.numberInWeek),
        }))}
      />
      <div className="pager">
        <Link className="prev" href={`/week/${week.number}`}>
          <small>Back to</small>
          <strong>
            Week {week.number}: {week.title}
          </strong>
        </Link>
        {week.number < c.weeks.length && (
          <Link className="next" href={`/week/${week.number + 1}`}>
            <small>Next week</small>
            <strong>{c.weeks[week.number].title}</strong>
          </Link>
        )}
      </div>
    </article>
  );
}
