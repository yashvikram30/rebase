"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { dayStatus, useGuestState } from "@/lib/guest-store";
import { useSchedule } from "@/lib/use-schedule";

export type NavDay = { index: number; id: string; week: number; day: number; title: string };
export type NavWeek = { number: number; title: string; days: NavDay[] };
export type NavPhase = { slug: string; name: string; language: string; weeks: NavWeek[] };

/** The course outline in the sidebar: how far along am I, and what is in this week. */
export function NavTree({ phases, onNavigate }: { phases: NavPhase[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const guest = useGuestState();
  const flat = phases.flatMap((p) => p.weeks.flatMap((w) => w.days)).sort((a, b) => a.index - b.index);
  const { dates, today } = useSchedule(flat.map((d) => d.id));
  const doneDays = flat.filter((d) => guest.done[d.id]).length;
  const weeks = phases.flatMap((p) => p.weeks);
  const viewing = /^\/(?:week|day)\/(\d+)/.exec(pathname)?.[1];
  // Away from a week, keep the week you are working on open.
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const current = viewing
    ? Number(viewing)
    : (weeks.find((w) => w.days.some((d) => !guest.done[d.id]))?.number ?? weeks[weeks.length - 1]?.number);

  return (
    <>
      <div className="nv-progress">
        <span>
          <b>{doneDays}</b> of {flat.length} days done
        </span>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${flat.length ? (doneDays / flat.length) * 100 : 0}%` }} />
        </div>
      </div>

      {phases.map((p) => (
        <section key={p.slug} className="nv-phase">
          <h2>{p.name}</h2>
          <ol>
            {p.weeks.map((w) => {
              const done = w.days.filter((d) => guest.done[d.id]).length;
              // Your own choice wins; otherwise only the week you are on is open.
              const open = picked[w.number] ?? current === w.number;
              const toggle = () => setPicked((p) => ({ ...p, [w.number]: !open }));
              const href = `/week/${w.number}`;
              return (
                <li key={w.number}>
                  <div className={"nv-row" + (open ? " open" : "")}>
                    <Link
                      href={href}
                      className={"nv-week" + (pathname === href ? " on" : "")}
                      aria-current={pathname === href ? "page" : undefined}
                      onClick={(e) => {
                        // An open week closes; a closed one opens and goes to its page.
                        if (open) {
                          e.preventDefault();
                          toggle();
                          return;
                        }
                        toggle();
                        onNavigate();
                      }}
                    >
                      <span className="nv-n">{w.number}</span>
                      <span className="nv-t">{w.title}</span>
                      {done === w.days.length ? (
                        <span className="nv-s done" role="img" aria-label="Week complete" />
                      ) : done > 0 ? (
                        <span className="nv-s">
                          {done}/{w.days.length}
                        </span>
                      ) : null}
                    </Link>
                    <button
                      type="button"
                      className="nv-chev"
                      aria-expanded={open}
                      aria-controls={`nv-d${w.number}`}
                      aria-label={`${open ? "Hide" : "Show"} days of week ${w.number}`}
                      onClick={toggle}
                    />
                  </div>
                  <div className={"nv-collapse" + (open ? " open" : "")} id={`nv-d${w.number}`} inert={!open}>
                    <ul className="nv-days">
                      {w.days.map((d) => {
                        const dayHref = `/day/${d.week}/${d.day}`;
                        const status = dayStatus(guest, d.id);
                        const on = pathname === dayHref || pathname.startsWith(dayHref + "/");
                        return (
                          <li key={d.id}>
                            <Link
                              href={dayHref}
                              className={on ? "on" : undefined}
                              aria-current={pathname === dayHref ? "page" : undefined}
                              onClick={onNavigate}
                            >
                              <span
                                className={"dot " + (status === "todo" ? "" : status)}
                                role="img"
                                aria-label={
                                  status === "done"
                                    ? "Done"
                                    : status === "started"
                                      ? "In progress"
                                      : "Not started"
                                }
                              />
                              <span>{d.title}</span>
                              {dates && dates[d.index] === today && <em>Today</em>}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
