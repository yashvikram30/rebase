import type { SearchEntry } from "@/components/search-dialog";
import type { NavPhase } from "@/components/nav-tree";
import { FOUNDATION_DAYS, foundationHref } from "@/data/foundations";
import { MONTHS } from "@/data/months";
import { dayHref, type Curriculum } from "./curriculum-types";

export function buildNav(c: Curriculum): NavPhase[] {
  return c.phases
    .map((p) => ({
      ...p,
      weeks: c.weeks
        .filter((w) => w.phase === p.slug)
        .map((w) => ({
          number: w.number,
          title: w.title,
          days: w.days.map((d) => ({
            index: d.globalIndex,
            id: d.id,
            week: w.number,
            day: d.numberInWeek,
            title: d.title,
          })),
        })),
    }))
    .filter((p) => p.weeks.length > 0);
}

export function buildSearch(c: Curriculum): SearchEntry[] {
  const phase = new Map(c.phases.map((p) => [p.slug, p.name]));
  const pages: SearchEntry[] = [
    { href: "/learn", title: "Today", sub: "Page", text: "dashboard continue" },
    { href: "/plan", title: "Course overview", sub: "Page", text: "how a day works rules setup" },
    { href: "/schedule", title: "Schedule", sub: "Page", text: "dates start reschedule" },
    {
      href: "/foundations",
      title: "Python Foundations",
      sub: "Part 0, optional",
      text: "optional skip start here beginners first time python from scratch freecodecamp google python class basics",
    },
    {
      href: "/python",
      title: "Learn Python",
      sub: "Page",
      text: "python tour lessons python path basics pep 8 pytest",
    },
    {
      href: "/revise",
      title: "Revise",
      sub: "Page",
      text: "quiz practice revision questions mcq fill in the blanks flashcards code snippets weeks",
    },
    { href: "/notes", title: "Notes", sub: "Page", text: "notes write markdown tags links journal" },
  ];
  const weeks = c.weeks.map((w) => ({
    href: `/week/${w.number}`,
    title: `Week ${w.number}: ${w.title}`,
    sub: phase.get(w.phase) ?? "",
    text: `${w.summary} ${w.project}`,
  }));
  const days = c.weeks.flatMap((w) =>
    w.days.map((d) => ({
      href: dayHref(w.number, d.numberInWeek),
      title: d.title,
      sub: `Week ${w.number}, day ${d.numberInWeek} · ${phase.get(w.phase) ?? ""}`,
      text: [d.why, d.dsaTitle, d.sweTitle, ...d.items.map((i) => i.title)].join(" "),
    })),
  );
  const labs = c.weeks.map((w) => ({
    href: `/week/${w.number}/lab`,
    title: `Week ${w.number} revision lab`,
    sub: `Optional fifth day · ${phase.get(w.phase) ?? ""}`,
    text: `revise review practice exercises flashcards ${w.title}`,
  }));
  const months = MONTHS.map((m) => ({
    href: `/month/${m.month}`,
    title: `Month ${m.month} review`,
    sub: "Optional monthly review",
    text: `revise review practice exercises flashcards month ${m.title}`,
  }));
  const foundations = FOUNDATION_DAYS.map((d) => ({
    href: foundationHref(d.week, d.n),
    title: d.title,
    sub: `Python Foundations, week ${d.week}, day ${d.n}`,
    text: [d.why, d.goal, ...d.learn.map((i) => i.title), ...d.practice.map((i) => i.title)].join(" "),
  }));
  return [...pages, ...foundations, ...weeks, ...days, ...labs, ...months];
}
