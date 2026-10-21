import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteBar, ItemRow, Notes } from "@/components/day-client";
import { DayShortcuts } from "@/components/day-shortcuts";
import { StepNav } from "@/components/day-steps";
import { getCurriculum } from "@/lib/curriculum";
import { dayHref, type Item } from "@/lib/curriculum-types";
import { Markdown } from "@/lib/markdown";
import { dedupeRefs, getNotes } from "@/lib/day-notes";
import { findDay, itemsFor, stepInfo } from "@/lib/day-data";
import { isStep, STEPS, stepHref } from "@/lib/day-steps";

export async function generateStaticParams() {
  const c = await getCurriculum();
  return c.weeks.flatMap((w) =>
    w.days.flatMap((d) =>
      STEPS.map((s) => ({ n: String(w.number), d: String(d.numberInWeek), step: s.slug })),
    ),
  );
}

export async function generateMetadata({ params }: PageProps<"/day/[n]/[d]/[step]">): Promise<Metadata> {
  const { n, d, step } = await params;
  const found = await findDay(n, d);
  const meta = STEPS.find((s) => s.slug === step);
  return found && meta ? { title: `${meta.label} · ${found.day.title}`, description: meta.blurb } : {};
}

const resolve = () => ({ href: "/notes", kind: "missing" as const });

const List = ({ items }: { items: Item[] }) => (
  <ul className="list">
    {items.map((i) => (
      <ItemRow key={i.key} item={i} />
    ))}
  </ul>
);

export default async function StepPage({ params }: PageProps<"/day/[n]/[d]/[step]">) {
  const { n, d, step } = await params;
  const found = await findDay(n, d);
  if (!found || !isStep(step)) notFound();
  const { week, day, next } = found;
  const idx = STEPS.findIndex((s) => s.slug === step);
  const meta = STEPS[idx];
  const prevStep = STEPS[idx - 1];
  const nextStep = STEPS[idx + 1];
  const items = itemsFor(day, step);
  const here = dayHref(week.number, day.numberInWeek);
  const prevHref = prevStep ? stepHref(week.number, day.numberInWeek, prevStep.slug) : here;
  const nextHref = nextStep ? stepHref(week.number, day.numberInWeek, nextStep.slug) : null;

  const notes = getNotes(day.id)[step];
  const listed = items.flatMap((i) => [i.url, ...(i.links?.map((l) => l.url) ?? [])]).filter((u) => !!u);
  const refs = notes?.refs ? dedupeRefs(notes.refs, listed as string[]) : "";

  const lead: Record<typeof step, string> = {
    learn:
      "Start with the summary: it covers what you need for today. The links after it are optional, for going deeper or practising.",
    build: "Keep it small and get it working before you make it nice.",
    dsa: day.dsaTitle,
    engineering: day.sweTitle,
    check: "Say each answer out loud before you look anything up. Then write down what you want to remember.",
  };

  return (
    <article className="day step-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href={`/week/${week.number}`}>Week {week.number}</Link>
        <i>/</i>
        <Link href={here}>{day.title}</Link>
      </nav>
      <StepNav
        week={week.number}
        day={day.numberInWeek}
        dayId={day.id}
        steps={stepInfo(day)}
        current={step}
      />
      <h1>{meta.label}</h1>
      <p className="quiet">About {meta.minutes} minutes</p>
      <p className="lead">{lead[step]}</p>

      {notes?.body && step !== "check" && (
        <section className="day-notes" aria-label="Summary">
          <Markdown text={notes.body} resolve={resolve} />
        </section>
      )}

      {step === "dsa" ? (
        <>
          <h2>Watch first</h2>
          <List items={items.filter((i) => i.section === "dsa_learn")} />
          <h2>Then solve</h2>
          <List items={items.filter((i) => i.section === "dsa_problem")} />
        </>
      ) : step === "check" ? (
        <>
          <ol className="questions">
            {day.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          {notes?.body && (
            <details className="day-notes">
              <summary>Model answers and key points (try first, then open)</summary>
              <Markdown text={notes.body} resolve={resolve} />
            </details>
          )}
          <h2>In your own words</h2>
          <Notes dayId={day.id} />
        </>
      ) : (
        <>
          {step === "learn" && (
            <>
              <h2 className="optional-head">Go deeper (optional)</h2>
              <p className="quiet">One block per topic. Tick a block when you have used it.</p>
            </>
          )}
          <List items={items} />
        </>
      )}

      {step === "build" && (
        <div className="goal">
          <small>Before you stop</small>
          <p>{day.ship}</p>
        </div>
      )}

      {refs && (
        <section className="day-refs" aria-label="Further reading">
          <Markdown text={"# Further reading\n\n" + refs} resolve={resolve} />
        </section>
      )}

      <DayShortcuts prev={prevHref} next={nextHref} />
      {step === "check" ? (
        <CompleteBar
          dayId={day.id}
          total={day.items.length}
          next={next ? { href: dayHref(next.weekNumber, next.numberInWeek), title: next.title } : null}
        />
      ) : null}
      <div className="step-foot">
        <Link className="btn" href={prevHref}>
          {prevStep ? `Back: ${prevStep.label}` : "Back to the day"}
        </Link>
        {nextStep && nextHref && (
          <Link className="btn primary" href={nextHref}>
            Next: {nextStep.label}
          </Link>
        )}
      </div>
    </article>
  );
}
