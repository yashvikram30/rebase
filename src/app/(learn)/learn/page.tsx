import type { Metadata } from "next";
import Link from "next/link";
import { TodayView } from "@/components/today-view";
import { getCurriculum } from "@/lib/curriculum";
import { planDays } from "@/lib/plan-days";

export const metadata: Metadata = { title: "Today" };

/**
 * Learn's home inside the app. With a plan it is the Today dashboard; without one it says how to begin.
 * The pitch for the course lives on the platform home, so this page never repeats it.
 */
export default async function LearnToday() {
  const c = await getCurriculum();
  const days = planDays(c);
  const notStarted = (
    <article className="start-here">
      <h1>Today</h1>
      <p className="lead">
        You have not started the course yet. Pick a start date and every day gets a date.
      </p>
      <div className="start-card">
        <h2>Start the course</h2>
        <p>
          {days.length} days over {c.weeks.length} weeks, four days a week. You can change the date and your
          study days later, and nothing is lost if you fall behind.
        </p>
        <p className="start-actions">
          <Link className="btn primary big" href="/start">
            Pick your start date
          </Link>
          <Link className="btn big" href="/plan">
            See the course
          </Link>
        </p>
      </div>
      <p className="start-more">
        Not ready to commit? <Link href="/day/1/1">Read day 1 now</Link>. New to programming? Begin with{" "}
        <Link href="/foundations">Part 0: Python Foundations</Link>.
      </p>
    </article>
  );
  return <TodayView days={days} landing={notStarted} />;
}
