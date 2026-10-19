import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BehindBanner } from "@/components/behind-banner";
import { DayShortcuts } from "@/components/day-shortcuts";
import { DayStatus, DayWhen, StepList } from "@/components/day-steps";
import { getCurriculum } from "@/lib/curriculum";
import { dayHref, type Day } from "@/lib/curriculum-types";
import { findDay, stepInfo } from "@/lib/day-data";

export async function generateStaticParams() {
  const c = await getCurriculum();
  return c.weeks.flatMap((w) => w.days.map((d) => ({ n: String(w.number), d: String(d.numberInWeek) })));
}

export async function generateMetadata({ params }: PageProps<"/day/[n]/[d]">): Promise<Metadata> {
  const { n, d } = await params;
  const found = await findDay(n, d);
  return found ? { title: `${found.day.title} · Week ${n}, day ${d}`, description: found.day.why } : {};
}

function PagerLink({ day, dir }: { day: Day; dir: "prev" | "next" }) {
  return (
    <Link className={dir} href={dayHref(day.weekNumber, day.numberInWeek)} rel={dir}>
      <small>{dir === "prev" ? "Previous day" : "Next day"}</small>
      <strong>{day.title}</strong>
    </Link>
  );
}

export default async function DayPage({ params }: PageProps<"/day/[n]/[d]">) {
  const { n, d } = await params;
  const found = await findDay(n, d);
  if (!found) notFound();
  const { week, day, prev, next, total, ids } = found;

  return (
    <article className="day">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href={`/week/${week.number}`}>Week {week.number}</Link>
        <i>/</i>
        <span>Day {day.numberInWeek}</span>
      </nav>
      <h1>{day.title}</h1>
      <p className="quiet">
        Day {day.globalIndex + 1} of {total} · about 3 hours
        <DayWhen dayIds={ids} index={day.globalIndex} />
        <DayStatus dayId={day.id} />
      </p>
      <BehindBanner dayIds={ids} />
      <p className="lead">{day.why}</p>

      <div className="goal">
        <small>By the end of today</small>
        <p>{day.ship}</p>
      </div>

      <StepList week={week.number} day={day.numberInWeek} dayId={day.id} steps={stepInfo(day)} />

      <DayShortcuts
        prev={prev ? dayHref(prev.weekNumber, prev.numberInWeek) : null}
        next={next ? dayHref(next.weekNumber, next.numberInWeek) : null}
      />
      <div className="pager">
        {prev ? <PagerLink day={prev} dir="prev" /> : <span />}
        {next && <PagerLink day={next} dir="next" />}
      </div>
    </article>
  );
}
