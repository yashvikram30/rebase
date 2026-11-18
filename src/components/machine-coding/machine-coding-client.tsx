"use client";
import { useState } from "react";
import { MC_LEVELS } from "@/data/machine-coding";
import {
  bestWeekStreak,
  dueSteps,
  itemDone,
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

function Ring({ value, size = 112 }: { value: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className="mc-ring"
      style={{ width: size, height: size }}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${pct(value)} percent complete`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} className="mc-ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="mc-ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="mc-ring-text">
        {pct(value)}%
      </text>
    </svg>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="mc-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct(value)}
    >
      <span style={{ width: `${pct(value)}%` }} />
    </div>
  );
}

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

/** Small link pills. The full label is the tooltip and the accessible name. */
function Pills({ list, lang }: { list: McResource[]; lang: McState["lang"] }) {
  const shown = visible(list, lang);
  if (!shown.length) return null;
  return (
    <span className="mc-pills">
      {shown.map((r) => (
        <a
          key={r.url + r.label}
          className={`mc-pill mc-pill-${r.kind}`}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          title={r.note ? `${r.label}. ${r.note}` : r.label}
          aria-label={r.label}
        >
          {KIND[r.kind]}
        </a>
      ))}
    </span>
  );
}

function SimpleItem({ item, s, onTouch }: { item: McItem; s: McState; onTouch: () => void }) {
  const [open, setOpen] = useState(false);
  const done = itemDone(item, s);
  return (
    <li className={"mc-row" + (done ? " is-done" : "")}>
      <Check
        checked={done}
        label={`Mark ${item.title} as done`}
        onChange={() => {
          onTouch();
          withCelebration(() => toggleItem(item.id));
        }}
      />
      <div className="mc-row-main">
        <div className="mc-row-line">
          <button type="button" className="mc-title" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {item.title}
          </button>
          {item.minutes ? <span className="mc-min">{item.minutes}m</span> : null}
          <Pills list={item.resources} lang={s.lang} />
        </div>
        {open ? <p className="mc-sum">{item.summary}</p> : null}
      </div>
    </li>
  );
}

function ProblemItem({
  item,
  s,
  today,
  onTouch,
}: {
  item: McItem;
  s: McState;
  today: string;
  onTouch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const done = itemFraction(item, s) === 1;
  const count = PROBLEM_STEPS.filter((st) => s.steps[item.id]?.[st.id]).length;
  return (
    <li className={"mc-row mc-problem" + (done ? " is-done" : "")}>
      <button
        type="button"
        className="mc-problem-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mc-dots" aria-hidden="true">
          {PROBLEM_STEPS.map((st) => (
            <i key={st.id} className={s.steps[item.id]?.[st.id] ? "on" : ""} />
          ))}
        </span>
        <span className="mc-title">{item.title}</span>
        {item.patterns?.length ? (
          <span className="mc-pat">{item.patterns.slice(0, 2).join(" · ")}</span>
        ) : null}
        <span className="mc-count">
          {count}/{PROBLEM_STEPS.length}
        </span>
      </button>
      {open ? (
        <div className="mc-panel">
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
                    <em className="mc-due">due</em>
                  ) : due && !ticked ? (
                    <em className="mc-when">{due.slice(5)}</em>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <Pills list={item.resources} lang={s.lang} />
          <textarea
            className="mc-notes"
            aria-label={`Notes for ${item.title}`}
            defaultValue={s.notes[item.id] ?? ""}
            rows={2}
            maxLength={4000}
            placeholder="Where did it get messy? Which pattern fixed it?"
            onBlur={(e) => setNote(item.id, e.target.value)}
          />
        </div>
      ) : null}
    </li>
  );
}

function Phase({
  phase,
  s,
  open,
  onToggle,
  onTouch,
  today,
}: {
  phase: McPhase;
  s: McState;
  open: boolean;
  onToggle: () => void;
  onTouch: () => void;
  today: string;
}) {
  const st = phaseStats(phase, s);
  const complete = phaseComplete(phase, s);
  const gate = !!s.gates[phase.id];
  return (
    <section className={"mc-phase" + (complete ? " is-complete" : "")} aria-labelledby={`h-${phase.id}`}>
      <button type="button" className="mc-phase-head" aria-expanded={open} onClick={onToggle}>
        <h3 id={`h-${phase.id}`}>{phase.title}</h3>
        {complete ? (
          <span className="mc-badge">Done</span>
        ) : st.done === st.total ? (
          <span className="mc-badge mc-badge-pending">Self-check</span>
        ) : null}
        <span className="mc-count">
          {st.done}/{st.total}
        </span>
        <Bar value={st.fraction} label={`${phase.title} progress`} />
      </button>
      {open ? (
        <div className="mc-phase-body">
          <ul className="mc-list">
            {phase.items.map((item) =>
              item.kind === "problem" ? (
                <ProblemItem key={item.id} item={item} s={s} today={today} onTouch={onTouch} />
              ) : (
                <SimpleItem key={item.id} item={item} s={s} onTouch={onTouch} />
              ),
            )}
          </ul>
          <div className={"mc-gate" + (gate ? " is-done" : "")}>
            <Check
              checked={gate}
              label={`Self-check for ${phase.title}`}
              onChange={() => {
                onTouch();
                withCelebration(() => toggleGate(phase.id));
              }}
            />
            <span>{phase.gate}</span>
          </div>
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
  const goalMet = week >= s.weeklyGoal;

  return (
    <div className="mc-page">
      <header className="mc-header">
        <span className="mc-eyebrow">Machine coding</span>
        <h1>Build it, then build it faster</h1>
      </header>

      <section className="mc-hero" aria-label="Your progress">
        <Ring value={overall.fraction} />
        <div className="mc-streak">
          <div className="mc-streak-top">
            <b>{streak}</b>
            <span>week streak</span>
            {best > streak ? <small>best {best}</small> : null}
          </div>
          <WeekChart s={s} today={today} />
          <div className="mc-goal">
            <span className={goalMet ? "met" : ""}>
              This week {week}/{s.weeklyGoal}
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
        <div className="mc-next">
          {next ? (
            <>
              <span className="mc-next-label">Up next</span>
              <strong>{next.item.title}</strong>
              <button
                type="button"
                className="mc-btn"
                onClick={() => {
                  setPicked(next.levelId);
                  setToggled((t) => ({ ...t, [next.phase.id]: true }));
                  requestAnimationFrame(() =>
                    document
                      .getElementById(`h-${next.phase.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
              >
                Go to it
              </button>
            </>
          ) : (
            <strong>All done</strong>
          )}
          <span className="mc-next-sub">
            {overall.done}/{overall.total} finished
          </span>
        </div>
      </section>

      {due.length ? (
        <section className="mc-due-panel" aria-label="Revisits due">
          <b>Revisit</b>
          <ul>
            {due.map((d) => (
              <li key={d.itemId + d.stepId}>
                {d.title} <span>{d.stepId === "day7" ? "day 7" : "day 28"}</span>
                {d.overdueDays > 0 ? <em>{d.overdueDays}d late</em> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mc-toolbar">
        <div className="mc-tabs" role="tablist" aria-label="Level">
          {MC_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === levelId}
              className={"mc-tab" + (l.id === levelId ? " is-active" : "")}
              onClick={() => setPicked(l.id)}
            >
              {l.name}
              <small>{pct(levelStats(l, s).fraction)}%</small>
            </button>
          ))}
        </div>
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
              className={s.lang === l ? "is-active" : ""}
              onClick={() => setLang(l)}
            >
              {l === "python" ? "Python" : "C++"}
            </button>
          ))}
        </div>
      </div>

      <section className="mc-level" aria-label={level.name}>
        <div className="mc-level-head">
          <p>{level.tagline}</p>
          <span className="mc-weeks-est">{level.weeks}</span>
        </div>
        <details className="mc-know">
          <summary>By the end you can</summary>
          <ul>
            {level.know.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </details>
        {level.phases.map((phase) => (
          <Phase
            key={phase.id}
            phase={phase}
            s={s}
            today={today}
            open={toggled[phase.id] ?? phase.id === currentPhaseId}
            onToggle={() =>
              setToggled((t) => ({ ...t, [phase.id]: !(t[phase.id] ?? phase.id === currentPhaseId) }))
            }
            onTouch={() => setToggled((t) => (t[phase.id] ? t : { ...t, [phase.id]: true }))}
          />
        ))}
      </section>

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
