"use client";
import Link from "next/link";
import { useDebug } from "@/lib/debug-store";
import { useHydrated } from "@/lib/plan-store";
import { useSchedule } from "@/lib/use-schedule";

type Day = { id: string; week: number; day: number; title: string };
type Case = { id: string; title: string };

/**
 * "Pick up where you left off" on the platform home, for anyone with a plan or a solved case in this
 * browser. New visitors see nothing, so the hero stays the first thing they read.
 */
export function ContinueStrip({ days, cases }: { days: Day[]; cases: Case[] }) {
  const hydrated = useHydrated();
  const ids = days.map((d) => d.id);
  const { plan, doneCount, firstUnfinished } = useSchedule(ids);
  const { solves, reviews } = useDebug();
  if (!hydrated) return null;

  const solved = cases.filter((c) => solves[c.id]).length;
  const touchedDebug = solved > 0 || Object.keys(reviews).length > 0;
  const nextDay = plan && firstUnfinished !== null ? days[firstUnfinished] : null;
  const nextCase = touchedDebug ? cases.find((c) => !solves[c.id]) : undefined;
  if (!nextDay && !nextCase) return null;

  return (
    <section className="plt-continue" aria-labelledby="plt-continue-h">
      <div className="plt-wrap">
        <h2 id="plt-continue-h">Pick up where you left off</h2>
        <div className="plt-continue-grid">
          {nextDay && (
            <Link className="plt-continue-card" href={`/day/${nextDay.week}/${nextDay.day}`}>
              <span className="plt-continue-product">Learn</span>
              <b>{nextDay.title}</b>
              <span>
                Week {nextDay.week}, day {nextDay.day}. {doneCount} of {days.length} days done.
              </span>
            </Link>
          )}
          {nextCase && (
            <Link className="plt-continue-card" href={`/debug/${nextCase.id}`}>
              <span className="plt-continue-product">Debug</span>
              <b>{nextCase.title}</b>
              <span>
                {solved} of {cases.length} cases solved.
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
