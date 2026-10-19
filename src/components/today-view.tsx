"use client";
import Link from "next/link";
import { checkedCount, dayStatus, useGuestState } from "@/lib/guest-store";
import { useHydrated } from "@/lib/plan-store";
import { dayOnDate, formatDate, WEEKDAY_LABELS, weekdayOf, addDays } from "@/lib/schedule";
import type { PlanDay } from "@/lib/plan-days";
import { currentStreak, bestStreak } from "@/lib/streak";
import { useSchedule } from "@/lib/use-schedule";
import { BehindBanner } from "./behind-banner";

/** Today dashboard when a plan exists in this browser; otherwise the landing content from the server. */
export function TodayView({ days, landing }: { days: PlanDay[]; landing: React.ReactNode }) {
  const hydrated = useHydrated();
  const ids = days.map((d) => d.id);
  const { plan, dates, today, doneCount, firstUnfinished, isDone } = useSchedule(ids);
  const guest = useGuestState();

  if (!hydrated || !plan || !dates || !today) return <>{landing}</>;

  if (firstUnfinished === null) {
    return (
      <article>
        <h1>Plan complete</h1>
        <p className="lead">
          You finished all {days.length} days, with a streak of {bestStreak(guest.activity, plan.studyDays)}{" "}
          at best. Now test it: Debug hands you broken code and a failing test, the way an AI-enabled
          interview does.
        </p>
        <p>
          <Link className="btn primary" href="/debug">
            Try a Debug case
          </Link>{" "}
          <Link className="btn" href="/schedule">
            See the schedule
          </Link>
        </p>
      </article>
    );
  }

  const todayIdx = dayOnDate(dates, today);
  const focusIdx = todayIdx !== null && !isDone(todayIdx) ? todayIdx : firstUnfinished;
  const focus = days[focusIdx];
  const isToday = focusIdx === todayIdx;
  const checked = checkedCount(guest, focus.id);
  const streak = currentStreak(guest.activity, plan.studyDays, today);
  const best = Math.max(streak, bestStreak(guest.activity, plan.studyDays));
  const upcoming = days.slice(focusIdx + 1, focusIdx + 3);
  const weeks = [
    ...Map.groupBy(
      days.map((d, i) => ({ d, i })),
      (x) => x.d.week,
    ),
  ].map(([week, ds]) => ({ week, title: ds[0].d.weekTitle, days: ds }));
  const href = (d: PlanDay) => `/day/${d.week}/${d.day}`;

  // The week strip: the schedule's days that fall in the current calendar week (Mon-Sun).
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).flatMap((date) => {
    const i = dayOnDate(dates, date);
    return i === null ? [] : [{ date, i }];
  });

  return (
    <article>
      <h1>Today</h1>
      <p className="lead">{formatDate(today, { year: true })}</p>
      <BehindBanner dayIds={ids} />
      <div className="today-card">
        <small>{isToday ? "Scheduled today" : `Next up, scheduled ${formatDate(dates[focusIdx])}`}</small>
        <h2>{focus.title}</h2>
        <p>
          Week {focus.week}, day {focus.day}: {focus.weekTitle}. {checked} of {focus.itemCount} items done.
        </p>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${(checked / focus.itemCount) * 100}%` }} />
        </div>
        <p style={{ marginTop: 14, marginBottom: 0 }}>
          <Link className="btn primary" href={href(focus)}>
            {checked > 0 ? "Continue" : "Start"}
          </Link>
        </p>
      </div>

      <div className="cards">
        <div className="card">
          <small>Plan progress</small>
          <b>
            {doneCount} / {days.length}
          </b>{" "}
          days
        </div>
        <div className="card">
          <small>Streak</small>
          <b>{streak}</b> {streak === 1 ? "day" : "days"}
          <span className="host" style={{ display: "block" }}>
            Best {best}. Rest days keep it alive.
          </span>
        </div>
        <div className="card">
          <small>This week</small>
          {week.length === 0 ? (
            <span className="host">Rest week</span>
          ) : (
            <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {week.map(({ date, i }) => (
                <Link key={date} href={href(days[i])} title={days[i].title}>
                  {WEEKDAY_LABELS[weekdayOf(date)]} {isDone(i) ? "✓" : date === today ? "•" : "○"}
                </Link>
              ))}
            </span>
          )}
        </div>
      </div>

      {upcoming.length > 0 && (
        <>
          <h2 id="next">Up next</h2>
          <ul className="daylist">
            {upcoming.map((d, k) => (
              <li key={d.id}>
                <Link href={href(d)}>
                  <span />
                  <span>
                    <span className="dtt">
                      Week {d.week}, day {d.day}: {d.title}
                    </span>
                    <span className="dd">{d.why}</span>
                  </span>
                  <span className="st">{formatDate(dates[focusIdx + 1 + k])}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 id="map">Your {days.length} days</h2>
      <p className="host" style={{ margin: "0 0 12px" }}>
        Ends {formatDate(dates[days.length - 1], { year: true })}. Each square is a day; filled means
        complete.
      </p>
      <div className="daygrid">
        {weeks.map((w) => (
          <div key={w.week} className="daygrid-row">
            <Link href={`/week/${w.week}`} className="daygrid-week" title={w.title}>
              W{w.week}
            </Link>
            {w.days.map(({ d, i }) => (
              <Link
                key={d.id}
                href={href(d)}
                className={
                  "sq " +
                  (isDone(i) ? "done" : dayStatus(guest, d.id) === "started" ? "started" : "") +
                  (i === focusIdx ? " now" : "")
                }
                title={`${d.title} · ${formatDate(dates[i])}`}
                aria-label={`Week ${d.week} day ${d.day}: ${d.title}, ${isDone(i) ? "done" : "not done"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}
