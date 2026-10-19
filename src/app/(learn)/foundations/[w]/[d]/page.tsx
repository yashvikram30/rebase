import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteBar, ItemRow, Notes } from "@/components/day-client";
import { DayShortcuts } from "@/components/day-shortcuts";
import { DayStatus } from "@/components/day-steps";
import { InlineCode } from "@/components/inline-code";
import { getNotes } from "@/lib/day-notes";
import { Markdown } from "@/lib/markdown";
import {
  FOUNDATION_DAYS,
  FOUNDATION_WEEKS,
  findFoundationDay,
  foundationHref,
  type FoundationDay,
} from "@/data/foundations";

const resolve = () => ({ href: "/notes", kind: "missing" as const });

export function generateStaticParams() {
  return FOUNDATION_DAYS.map((d) => ({ w: String(d.week), d: String(d.n) }));
}

export async function generateMetadata({ params }: PageProps<"/foundations/[w]/[d]">): Promise<Metadata> {
  const { w, d } = await params;
  const day = findFoundationDay(w, d);
  return day ? { title: `${day.title} · Foundations`, description: day.why } : {};
}

function Pager({ day, dir }: { day: FoundationDay; dir: "prev" | "next" }) {
  return (
    <Link className={dir} href={foundationHref(day.week, day.n)} rel={dir}>
      <small>{dir === "prev" ? "Previous day" : "Next day"}</small>
      <strong>{day.title}</strong>
    </Link>
  );
}

export default async function FoundationDayPage({ params }: PageProps<"/foundations/[w]/[d]">) {
  const { w, d } = await params;
  const day = findFoundationDay(w, d);
  if (!day) notFound();
  const week = FOUNDATION_WEEKS.find((x) => x.number === day.week)!;
  const i = FOUNDATION_DAYS.findIndex((x) => x.id === day.id);
  const prev = FOUNDATION_DAYS[i - 1] ?? null;
  const next = FOUNDATION_DAYS[i + 1] ?? null;
  const total = day.learn.length + day.practice.length;
  const lesson = getNotes(day.id).learn?.body;

  return (
    <article className="day step-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/foundations">Python Foundations</Link>
        <i>/</i>
        <span>
          Week {week.number}, day {day.n}
        </span>
      </nav>
      <h1>{day.title}</h1>
      <p className="quiet">
        Day {i + 1} of {FOUNDATION_DAYS.length} · about {Math.round((day.minutes / 60) * 2) / 2} hours
        <DayStatus dayId={day.id} />
      </p>
      <p className="lead">
        <InlineCode text={day.why} />
      </p>

      <div className="goal">
        <small>By the end of today you can</small>
        <p>
          <InlineCode text={day.goal} />
        </p>
      </div>

      <h2 id="learn">1. Learn</h2>
      <p className="quiet">
        Read the lesson first. It covers what you need for today, so the links after it are optional.
      </p>
      {lesson && (
        <section className="day-notes" aria-label="Lesson">
          <Markdown text={lesson} resolve={resolve} />
        </section>
      )}
      <h3 className="optional-head">Go deeper (optional)</h3>
      <p className="quiet">One block per topic. Tick a block when you have used it.</p>
      <ul className="list">
        {day.learn.map((item) => (
          <ItemRow key={item.key} item={item} />
        ))}
      </ul>

      <h2 id="practice">2. Practice</h2>
      <p className="quiet">
        Type everything. When you are stuck for 20 minutes, note what you tried and move on.
      </p>
      <ul className="list">
        {day.practice.map((item) => (
          <ItemRow key={item.key} item={item} />
        ))}
      </ul>

      <div className="goal">
        <small>Before you stop</small>
        <p>
          <InlineCode text={day.ship} />
        </p>
      </div>

      <h2 id="check">3. Check yourself</h2>
      <p className="quiet">Answer out loud, then write down anything you could not say.</p>
      <ol className="questions">
        {day.check.map((q) => (
          <li key={q}>
            <InlineCode text={q} />
          </li>
        ))}
      </ol>
      <h2>In your own words</h2>
      <Notes dayId={day.id} />

      <DayShortcuts
        prev={prev ? foundationHref(prev.week, prev.n) : null}
        next={next ? foundationHref(next.week, next.n) : null}
      />
      <CompleteBar
        dayId={day.id}
        total={total}
        next={
          next
            ? { href: foundationHref(next.week, next.n), title: next.title }
            : { href: "/week/1", title: "Week 1" }
        }
      />
      <div className="pager">
        {prev ? <Pager day={prev} dir="prev" /> : <span />}
        {next ? (
          <Pager day={next} dir="next" />
        ) : (
          <Link className="next" href="/week/1">
            <small>Next</small>
            <strong>Week 1: the machine, in Python</strong>
          </Link>
        )}
      </div>
    </article>
  );
}
