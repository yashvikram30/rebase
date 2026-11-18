"use client";
import { useState } from "react";
import { MC_LEVELS } from "@/data/machine-coding";
import {
  bestWeekStreak,
  dueSteps,
  itemFraction,
  levelStats,
  nextUp,
  overallStats,
  phaseComplete,
  phaseStats,
  recentWeeks,
  stepDueDate,
  thisWeekCount,
  weekStreak,
} from "@/lib/mc-progress";
import {
  getMc,
  resetMc,
  setLang,
  setNote,
  setWeeklyGoal,
  toggleGate,
  toggleItem,
  toggleStep,
  useMc,
} from "@/lib/mc-store";
import {
  MAX_WEEKLY_GOAL,
  PROBLEM_STEPS,
  type McItem,
  type McLevel,
  type McLevelId,
  type McPhase,
  type McResource,
  type McState,
} from "@/lib/mc-types";
import { toDateString } from "@/lib/striver-schedule";
import { toast } from "@/lib/toast";

const pct = (f: number) => Math.round(f * 100);
const KIND: Record<McResource["kind"], string> = { video: "Video", read: "Read", code: "Code" };
const KIND_CHIP: Record<McItem["kind"], string | null> = {
  concept: "Concept",
  pattern: "Pattern",
  method: "Method",
  problem: null,
};

/** Applies a change, then celebrates if it just finished a phase or a whole level. */
function withCelebration(change: () => void) {
  const before = getMc();
  change();
  const after = getMc();
  for (const level of MC_LEVELS) {
    for (const phase of level.phases) {
      if (!phaseComplete(phase, before) && phaseComplete(phase, after)) {
        const levelDone = level.phases.every((p) => phaseComplete(p, after));
        toast(levelDone ? `${level.name} complete` : `${phase.title} complete`, 4200);
      }
    }
  }
}

const visible = (resources: McResource[], lang: McState["lang"]) =>
  resources.filter((r) => !r.lang || r.lang === "java" || r.lang === lang);

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      className="mc-check"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
    </button>
  );
}

function Links({ list, lang }: { list: McResource[]; lang: McState["lang"] }) {
  return visible(list, lang).map((r) => (
    <a
      key={r.url + r.label}
      className="problem-link-icon"
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      title={r.note ? `${r.label}. ${r.note}` : r.label}
      aria-label={r.label}
    >
      {KIND[r.kind]} ↗
    </a>
  ));
}

type Tone = "todo" | "doing" | "done";

/** The status cell: a bordered button with a dot, like the Striver sheet's "How it went" menu. */
function StatusButton({
  tone,
  label,
  onClick,
  ...aria
}: {
  tone: Tone;
  label: string;
  onClick: () => void;
} & React.AriaAttributes & { role?: string }) {
  return (
    <button type="button" className="mc-status" onClick={onClick} {...aria}>
      <i className={`mc-dot is-${tone}`} aria-hidden="true" />
      {label}
    </button>
  );
}

function ItemRows({
  item,
  n,
  s,
  today,
  onTouch,
}: {
  item: McItem;
  n: number;
  s: McState;
  today: string;
  onTouch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isProblem = item.kind === "problem";
  const done = itemFraction(item, s) === 1;
  const steps = PROBLEM_STEPS.filter((st) => s.steps[item.id]?.[st.id]).length;
  const tone: Tone = done ? "done" : steps > 0 ? "doing" : "todo";
  const chip = KIND_CHIP[item.kind];

  return (
    <>
      <tr className={done ? "is-done" : ""}>
        <td className="c-order">{n}</td>
        <td className="c-topic">
          <button type="button" className="mc-title" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {item.title}
          </button>
          <div className="problem-tags">
            {chip ? (
              <span className={`problem-diff-pill ${item.kind === "pattern" ? "diff-core" : "diff-plain"}`}>
                {chip}
              </span>
            ) : null}
            {item.patterns?.map((p) => (
              <span key={p} className="problem-diff-pill diff-core">
                {p}
              </span>
            ))}
            <Links list={item.resources} lang={s.lang} />
          </div>
          {open && !isProblem ? <p className="mc-sum">{item.summary}</p> : null}
        </td>
        <td className="c-status">
          {isProblem ? (
            <StatusButton
              tone={tone}
              label={done ? "Done" : steps ? `${steps} of ${PROBLEM_STEPS.length}` : "Not started"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            />
          ) : (
            <StatusButton
              tone={tone}
              label={done ? "Done" : "Not started"}
              role="checkbox"
              aria-checked={done}
              aria-label={`${item.title}: ${done ? "done" : "not started"}`}
              onClick={() => {
                onTouch();
                withCelebration(() => toggleItem(item.id));
              }}
            />
          )}
        </td>
        <td className="c-time">{item.minutes ? `${item.minutes} min` : ""}</td>
      </tr>
      {open && isProblem ? (
        <tr className="mc-panel-row">
          <td />
          <td colSpan={3}>
            <p className="mc-sum">{item.summary}</p>
            <ol className="mc-steps">
              {PROBLEM_STEPS.map((st) => {
                const ticked = !!s.steps[item.id]?.[st.id];
                const due = stepDueDate(item.id, st.id, s);
                const isDue = !!due && !ticked && due <= today;
                return (
                  <li key={st.id} className={ticked ? "is-done" : ""} title={st.hint}>
                    <Check
                      checked={ticked}
                      label={`${st.label}, ${item.title}`}
                      onChange={() => {
                        onTouch();
                        withCelebration(() => toggleStep(item.id, st.id));
                      }}
                    />
                    <span>{st.label}</span>
                    {isDue ? (
                      <span className="sched-badge is-due">Due now</span>
                    ) : due && !ticked ? (
                      <span className="sched-badge">Due {due.slice(5)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <textarea
              className="mc-notes"
              aria-label={`Notes for ${item.title}`}
              defaultValue={s.notes[item.id] ?? ""}
              rows={2}
              maxLength={4000}
              placeholder="Where did it get messy? Which pattern fixed it?"
              onBlur={(e) => setNote(item.id, e.target.value)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Phase({
  phase,
  index,
  s,
  open,
  onToggle,
  onTouch,
  today,
}: {
  phase: McPhase;
  index: number;
  s: McState;
  open: boolean;
  onToggle: () => void;
  onTouch: () => void;
  today: string;
}) {
  const st = phaseStats(phase, s);
  const complete = phaseComplete(phase, s);
  const pending = !complete && st.done === st.total;
  const gate = !!s.gates[phase.id];
  return (
    <section
      className={"striver-topic-card" + (open ? " is-expanded" : "")}
      aria-labelledby={`h-${phase.id}`}
    >
      <button type="button" className="striver-topic-head" aria-expanded={open} onClick={onToggle}>
        <span className="striver-chevron" aria-hidden="true" />
        <span className="striver-topic-name">
          <span className="striver-topic-n">{index + 1}</span>
          <span id={`h-${phase.id}`}>{phase.title}</span>
          {complete ? (
            <span className="mc-flag is-done">Done</span>
          ) : pending ? (
            <span className="mc-flag">Self-check</span>
          ) : null}
        </span>
        <span className="striver-topic-meta">
          <span className="striver-topic-counter">
            {st.done}/{st.total}
          </span>
          <span
            className="striver-meter striver-meter-sm mc-mini"
            role="progressbar"
            aria-label={`${phase.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(st.fraction)}
          >
            <i style={{ width: `${pct(st.fraction)}%` }} />
          </span>
        </span>
      </button>
      {open ? (
        <div className="striver-table-wrap">
          <table className="striver-table mc-table">
            <thead>
              <tr>
                <th className="c-order">#</th>
                <th>Topic</th>
                <th className="c-status">Status</th>
                <th className="c-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {phase.items.map((item, i) => (
                <ItemRows key={item.id} item={item} n={i + 1} s={s} today={today} onTouch={onTouch} />
              ))}
              <tr className="mc-gate-row">
                <td className="c-order" />
                <td className="c-topic">
                  <span className="mc-gate-label">Self-check</span> {phase.gate}
                </td>
                <td className="c-status">
                  <StatusButton
                    tone={gate ? "done" : "todo"}
                    label={gate ? "Done" : "Not yet"}
                    role="checkbox"
                    aria-checked={gate}
                    aria-label={`Self-check for ${phase.title}`}
                    onClick={() => {
                      onTouch();
                      withCelebration(() => toggleGate(phase.id));
                    }}
                  />
                </td>
                <td className="c-time" />
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function WeekChart({ s, today }: { s: McState; today: string }) {
  const weeks = recentWeeks(s, today, 10);
  const max = Math.max(s.weeklyGoal, ...weeks.map((w) => w.count));
  return (
    <div
      className="mc-weeks"
      role="img"
      aria-label={`Ticks per week for the last ${weeks.length} weeks, goal ${s.weeklyGoal}`}
    >
      {weeks.map((w) => (
        <span
          key={w.start}
          className={"mc-week" + (w.met ? " met" : "") + (w.current ? " current" : "")}
          title={`Week of ${w.start}: ${w.count}`}
        >
          <i style={{ height: `${Math.max(w.count ? 14 : 4, (w.count / max) * 100)}%` }} />
        </span>
      ))}
      <span
        className="mc-goal-line"
        style={{ bottom: `${(s.weeklyGoal / max) * 100}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function MachineCodingClient() {
  const s = useMc();
  const [picked, setPicked] = useState<McLevelId | null>(null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const today = toDateString(new Date());
  const overall = overallStats(MC_LEVELS, s);
  const next = nextUp(MC_LEVELS, s);
  const streak = weekStreak(s, today);
  const best = bestWeekStreak(s);
  const week = thisWeekCount(s, today);
  const due = dueSteps(MC_LEVELS, s, today);
  const levelId = picked ?? next?.levelId ?? MC_LEVELS[MC_LEVELS.length - 1].id;
  const level: McLevel = MC_LEVELS.find((l) => l.id === levelId) ?? MC_LEVELS[0];
  // The first phase with unfinished items opens by default. A phase you tick in stays open until you close it,
  // so finishing its last item never hides its own self-check.
  const allPhases = MC_LEVELS.flatMap((l) => l.phases);
  const currentPhaseId = (
    allPhases.find((p) => phaseStats(p, s).done < p.items.length) ??
    allPhases.find((p) => !phaseComplete(p, s))
  )?.id;
  const isOpen = (id: string) => toggled[id] ?? id === currentPhaseId;
  const allOpen = level.phases.every((p) => isOpen(p.id));
  const goalMet = week >= s.weeklyGoal;

  function goToNext() {
    if (!next) return;
    setPicked(next.levelId);
    setToggled((t) => ({ ...t, [next.phase.id]: true }));
    requestAnimationFrame(() =>
      document.getElementById(`h-${next.phase.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  return (
    <div className="striver-page mc-page">
      <header className="striver-header">
        <span className="striver-eyebrow">Machine coding</span>
        <h1>Machine coding course</h1>
        <p className="striver-lead">
          From classes to concurrent systems in three levels. Tick things off as you finish them, and revisits
          come due on their own.
        </p>
      </header>

      <section className="striver-overview" aria-label="Your progress">
        <div className="striver-overview-top">
          <div className="striver-overview-num">
            <b>{overall.done}</b>
            <span>of {overall.total} finished</span>
          </div>
          <div className="striver-legend" role="tablist" aria-label="Level">
            {MC_LEVELS.map((l) => {
              const ls = levelStats(l, s);
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={l.id === levelId}
                  className={"striver-legend-item" + (l.id === levelId ? " is-on" : "")}
                  onClick={() => setPicked(l.id)}
                >
                  {l.name} <b>{ls.done}</b>
                  <span className="mc-of">/{ls.total}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          className="striver-meter"
          role="progressbar"
          aria-label="Overall progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct(overall.fraction)}
        >
          <i className="mc-meter-fill" style={{ width: `${pct(overall.fraction)}%` }} />
        </div>
        <div className="mc-streak-row">
          <div className="mc-streak">
            <div className="mc-streak-num">
              <b>{streak}</b>
              <span>week streak</span>
              {best > streak ? <small>best {best}</small> : null}
            </div>
            <div className="mc-goal">
              <span className={goalMet ? "met" : ""}>
                This week {week} of {s.weeklyGoal}
                {goalMet ? " ✓" : ""}
              </span>
              <span className="mc-stepper" role="group" aria-label="Weekly goal">
                <button
                  type="button"
                  aria-label="Lower the weekly goal"
                  disabled={s.weeklyGoal <= 1}
                  onClick={() => setWeeklyGoal(s.weeklyGoal - 1)}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="Raise the weekly goal"
                  disabled={s.weeklyGoal >= MAX_WEEKLY_GOAL}
                  onClick={() => setWeeklyGoal(s.weeklyGoal + 1)}
                >
                  +
                </button>
              </span>
            </div>
          </div>
          <WeekChart s={s} today={today} />
        </div>
      </section>

      {due.length ? (
        <section className="mc-due" aria-label="Revisits due">
          <b>Revisit</b>
          {due.map((d) => (
            <span key={d.itemId + d.stepId} className="sched-badge is-due">
              {d.title} · {d.stepId === "day7" ? "day 7" : "day 28"}
              {d.overdueDays > 0 ? ` · ${d.overdueDays}d late` : ""}
            </span>
          ))}
        </section>
      ) : null}

      <div className="striver-bar mc-toolbar">
        <div
          className="mc-lang"
          role="group"
          aria-label="Your language"
          title="Videos use Java. Rewrite each design in your language."
        >
          {(["python", "cpp"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={s.lang === l}
              className={"striver-btn" + (s.lang === l ? " is-set" : "")}
              onClick={() => setLang(l)}
            >
              {l === "python" ? "Python" : "C++"}
            </button>
          ))}
        </div>
        <span className="mc-toolbar-gap" />
        {next ? (
          <button type="button" className="striver-btn striver-btn-primary" onClick={goToNext}>
            Up next: {next.item.title}
          </button>
        ) : null}
        <button
          type="button"
          className="striver-btn"
          onClick={() =>
            setToggled((t) => ({ ...t, ...Object.fromEntries(level.phases.map((p) => [p.id, !allOpen])) }))
          }
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <p className="mc-level-line">
        {level.tagline} <span>{level.weeks}</span>
      </p>
      <details className="mc-know">
        <summary>By the end of {level.name} you can</summary>
        <ul>
          {level.know.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </details>

      <div className="striver-accordion-list">
        {level.phases.map((phase, i) => (
          <Phase
            key={phase.id}
            phase={phase}
            index={i}
            s={s}
            today={today}
            open={isOpen(phase.id)}
            onToggle={() => setToggled((t) => ({ ...t, [phase.id]: !isOpen(phase.id) }))}
            onTouch={() => setToggled((t) => (t[phase.id] ? t : { ...t, [phase.id]: true }))}
          />
        ))}
      </div>

      <footer className="mc-foot">
        {confirmReset ? (
          <span>
            Clear all progress?{" "}
            <button
              type="button"
              onClick={() => {
                resetMc();
                setConfirmReset(false);
                toast("Progress cleared");
              }}
            >
              Clear
            </button>
            <button type="button" onClick={() => setConfirmReset(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)}>
            Reset progress
          </button>
        )}
      </footer>
    </div>
  );
}
