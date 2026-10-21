import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LabCard, LabProblem } from "@/components/lab-client";
import { MonthClient, type SkippedExercise } from "@/components/month-client";
import { labFor, labKey } from "@/data/labs";
import { MONTHS, monthExercises, monthFor, monthWeeks } from "@/data/months";
import { getCurriculum } from "@/lib/curriculum";
import { dayHref } from "@/lib/curriculum-types";
import { DSA_ENABLED } from "@/lib/day-steps";

export function generateStaticParams() {
  return MONTHS.map((m) => ({ m: String(m.month) }));
}

export async function generateMetadata({ params }: PageProps<"/month/[m]">): Promise<Metadata> {
  const { m } = await params;
  const review = monthFor(Number(m));
  return review
    ? {
        title: `Month ${m} review`,
        description: `Optional review of month ${m}: ${review.title}, with questions from earlier months too.`,
      }
    : {};
}

export default async function MonthPage({ params }: PageProps<"/month/[m]">) {
  const { m } = await params;
  const review = monthFor(Number(m));
  if (!review) notFound();
  const c = await getCurriculum();
  const [from, to] = monthWeeks(review.month);
  const upTo = c.weeks.filter((w) => w.number <= to);

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
  const skipped: SkippedExercise[] = upTo.flatMap((w) =>
    (labFor(w.number)?.exercises ?? []).map((e, i) => ({
      key: labKey(w.number, i),
      week: w.number,
      title: e.title,
      kind: e.kind,
    })),
  );
  const prev = MONTHS.find((x) => x.month === review.month - 1);
  const next = MONTHS.find((x) => x.month === review.month + 1);
  const minutes = monthExercises(review).reduce((n, e) => n + e.minutes, 0);

  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/plan">Course</Link>
        <i>/</i>
        <span>Month {review.month}</span>
        <i>/</i>
        <span>Review</span>
      </nav>
      <h1>Month {review.month} review</h1>
      <p className="quiet">
        Optional · weeks {from} to {to} · about {Math.round(minutes / 60)} hours
      </p>
      <p className="lead">{review.focus}</p>
      <MonthClient review={review} from={from} to={to} cards={cards} problems={problems} skipped={skipped} />
      <div className="pager">
        {prev ? (
          <Link className="prev" href={`/month/${prev.month}`}>
            <small>Previous review</small>
            <strong>Month {prev.month}</strong>
          </Link>
        ) : (
          <Link className="prev" href={`/week/${to}`}>
            <small>Back to</small>
            <strong>Week {to}</strong>
          </Link>
        )}
        {next && (
          <Link className="next" href={`/month/${next.month}`}>
            <small>Next review</small>
            <strong>Month {next.month}</strong>
          </Link>
        )}
      </div>
    </article>
  );
}
