"use client";
import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/lib/plan-store";
import { toDateString } from "@/lib/striver-schedule";
import {
  checkAndLevelMissedReviews,
  saveProblemNotes,
  setProblemStatus,
  setReminders,
  useStriver,
} from "@/lib/striver-store";
import type { ProblemStatus, StriverProblem } from "@/lib/striver-types";
import { TopicMenu } from "./topic-menu";

type SubtopicGroup = { subtopic: string; problems: StriverProblem[] };
type TopicGroup = { topic: string; subtopics: SubtopicGroup[]; totalCount: number };
type Next = { dueDate: string; stage: number; isOverdue: boolean; isDueToday: boolean };

const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);

export function StriverClient({ problems, email }: { problems: StriverProblem[]; email: string }) {
  const store = useStriver();
  const hydrated = useHydrated();
  const todayStr = hydrated ? toDateString(new Date()) : "";
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [collapsedSubtopics, setCollapsedSubtopics] = useState<Record<string, boolean>>({});
  const [openNotes, setOpenNotes] = useState<Record<number, boolean>>({});
  const [testState, setTestState] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });

  // Reviews missed while away move to the quietest days of the coming week, as the daily job does for the server copy.
  useEffect(() => {
    checkAndLevelMissedReviews();
  }, []);

  const nextReviewByProblem = useMemo(() => {
    const map = new Map<number, Next>();
    if (!todayStr) return map;
    for (const r of store.reviews) {
      if (r.completed) continue;
      const existing = map.get(r.problemId);
      if (!existing || r.dueDate < existing.dueDate) {
        map.set(r.problemId, {
          dueDate: r.dueDate,
          stage: r.stage,
          isOverdue: r.dueDate < todayStr,
          isDueToday: r.dueDate === todayStr,
        });
      }
    }
    return map;
  }, [store.reviews, todayStr]);

  // Due today or overdue: a review stays on the list until it is answered.
  const dueProblems = useMemo(
    () => problems.filter((p) => {
      const n = nextReviewByProblem.get(p.id);
      return n && (n.isDueToday || n.isOverdue);
    }),
    [problems, nextReviewByProblem],
  );

  const counts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, unattempted: 0, total: problems.length };
    for (const p of problems) c[store.statuses[p.id]?.status ?? "unattempted"]++;
    return c;
  }, [problems, store.statuses]);

  const topicGroups = useMemo(() => {
    const map = new Map<string, Map<string, StriverProblem[]>>();
    for (const p of problems) {
      const sub = map.get(p.topic) ?? new Map<string, StriverProblem[]>();
      sub.set(p.subtopic, [...(sub.get(p.subtopic) ?? []), p]);
      map.set(p.topic, sub);
    }
    const groups: TopicGroup[] = [];
    for (const [topic, sub] of map) {
      const subtopics = [...sub].map(([subtopic, list]) => ({ subtopic, problems: list }));
      groups.push({ topic, subtopics, totalCount: subtopics.reduce((n, s) => n + s.problems.length, 0) });
    }
    return groups;
  }, [problems]);

  const filtering = query.trim() !== "" || topicFilter !== "all" || statusFilter !== "all";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const set = new Set<number>();
    for (const p of problems) {
      const status = store.statuses[p.id]?.status ?? "unattempted";
      if (q && !`${p.label} ${p.topic} ${p.subtopic}`.toLowerCase().includes(q)) continue;
      if (topicFilter !== "all" && p.topic !== topicFilter) continue;
      if (statusFilter !== "all" && status !== statusFilter) continue;
      set.add(p.id);
    }
    return set;
  }, [problems, query, topicFilter, statusFilter, store.statuses]);

  // While searching or filtering, every group with a match is open; otherwise the user's own toggles apply.
  const topicOpen = (t: string) => filtering || (expandedTopics[t] ?? t === topicGroups[0]?.topic);
  const subOpen = (t: string, s: string) => !collapsedSubtopics[`${t}::${s}`];

  function expandAll() {
    setExpandedTopics(Object.fromEntries(topicGroups.map((g) => [g.topic, true])));
    setCollapsedSubtopics({});
  }

  const allOpen = topicGroups.every((g) => topicOpen(g.topic));
  function collapseAll() {
    setExpandedTopics(Object.fromEntries(topicGroups.map((g) => [g.topic, false])));
  }

  async function sendTest() {
    setTestState({ busy: true, msg: null });
    let msg: string;
    try {
      const res = await fetch("/api/striver/test-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: store.reviews, today: toDateString(new Date()) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) msg = data.error || "Could not send the email.";
      else if (data.count === 0) msg = "Nothing to send yet. Mark a problem Hint or Struggled first.";
      else if (data.skipped) msg = "Email isn't configured on this server yet (SMTP settings missing).";
      else msg = `Sent ${data.count} problem${data.count > 1 ? "s" : ""} to ${data.to}.`;
    } catch {
      msg = "Could not reach the server.";
    }
    setTestState({ busy: false, msg });
  }

  function groupStats(list: StriverProblem[]) {
    let green = 0, yellow = 0, red = 0;
    for (const p of list) {
      const s = store.statuses[p.id]?.status;
      if (s === "green") green++;
      else if (s === "yellow") yellow++;
      else if (s === "red") red++;
    }
    return { green, yellow, red, solved: green + yellow + red, total: list.length };
  }

  const solved = counts.green + counts.yellow + counts.red;

  return (
    <div className="striver-page">
      <header className="striver-header">
        <span className="striver-eyebrow">DSA practice</span>
        <h1>Striver {problems.length} sheet</h1>
        <p className="striver-lead">
          Mark each problem by how it went. A hint schedules reviews at 7 and 28 days, a struggle at 7, 14 and 28.
          A daily email tells you what to redo.
        </p>
      </header>

      <section className="striver-overview" aria-label="Progress">
        <div className="striver-overview-top">
          <div className="striver-overview-num">
            <b>{solved}</b>
            <span>of {counts.total} attempted</span>
          </div>
          <div className="striver-legend">
            {(
              [
                ["green", "Mastered", counts.green],
                ["yellow", "Needed a hint", counts.yellow],
                ["red", "Struggled", counts.red],
                ["unattempted", "Not started", counts.unattempted],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                className={"striver-legend-item" + (statusFilter === key ? " is-on" : "")}
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              >
                <i className={"dot dot-" + key} aria-hidden="true" />
                {label} <b>{n}</b>
              </button>
            ))}
          </div>
        </div>
        <div
          className="striver-meter"
          role="img"
          aria-label={`${counts.green} mastered, ${counts.yellow} needed a hint, ${counts.red} struggled, ${counts.unattempted} not started`}
        >
          <i className="dot-green" style={{ width: `${pct(counts.green, counts.total)}%` }} />
          <i className="dot-yellow" style={{ width: `${pct(counts.yellow, counts.total)}%` }} />
          <i className="dot-red" style={{ width: `${pct(counts.red, counts.total)}%` }} />
        </div>
        <div className="striver-reminder">
          <p>
            <b>Daily email</b>{" "}
            <span>
              {store.reminders ? "to " : "paused for "}
              {email}
            </span>
          </p>
          <div className="striver-reminder-actions">
            <button type="button" className="striver-linkbtn" disabled={testState.busy} onClick={sendTest}>
              {testState.busy ? "Sending…" : "Send a test"}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={store.reminders}
              aria-label="Daily email reminder"
              className={"striver-switch" + (store.reminders ? " is-on" : "")}
              onClick={() => setReminders(!store.reminders)}
            >
              <i />
            </button>
          </div>
          <p className="striver-reminder-msg" role="status">
            {testState.msg}
          </p>
        </div>
      </section>

      {dueProblems.length > 0 && (
        <section className="striver-due" aria-label="Due for review">
          <div className="striver-due-head">
            <h2>
              <span className="striver-due-badge">{dueProblems.length}</span> Due for review
            </h2>
            <p>Solve it again, then say how it went. That sets the next review.</p>
          </div>
          <ul className="striver-due-list">
            {dueProblems.map((p) => {
              const n = nextReviewByProblem.get(p.id);
              return (
                <li key={p.id} className="striver-due-item">
                  <div className="striver-due-info">
                    <a
                      className="striver-due-title"
                      href={p.leetcodeLink || p.articleLink || undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.label} <span aria-hidden="true">↗</span>
                    </a>
                    <small>
                      {p.topic} › {p.subtopic}
                      {n?.isOverdue ? ` · overdue since ${n.dueDate}` : ""}
                    </small>
                  </div>
                  <div className="striver-due-actions" role="group" aria-label={`How did ${p.label} go?`}>
                    <button type="button" className="striver-answer is-green" onClick={() => setProblemStatus(p.id, "green")}>
                      Mastered
                    </button>
                    <button
                      type="button"
                      className="striver-answer is-yellow"
                      title="Review again in 7 and 28 days"
                      onClick={() => setProblemStatus(p.id, "yellow")}
                    >
                      Needed a hint
                    </button>
                    <button
                      type="button"
                      className="striver-answer is-red"
                      title="Review again in 7, 14 and 28 days"
                      onClick={() => setProblemStatus(p.id, "red")}
                    >
                      Struggled
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="striver-bar">
        <input
          type="search"
          className="striver-search"
          placeholder={`Search ${problems.length} problems…`}
          aria-label="Search problems"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <TopicMenu
          value={topicFilter}
          total={problems.length}
          options={topicGroups.map((g) => ({ value: g.topic, label: g.topic, count: g.totalCount }))}
          onChange={setTopicFilter}
        />
        {filtering ? (
          <button
            type="button"
            className="striver-btn"
            onClick={() => {
              setQuery("");
              setTopicFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear
          </button>
        ) : (
          <button type="button" className="striver-btn" onClick={allOpen ? collapseAll : expandAll}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      <div className="striver-accordion-list">
        {topicGroups.map((tg, tIdx) => {
          const subs = tg.subtopics
            .map((sg) => ({ ...sg, problems: sg.problems.filter((p) => visible.has(p.id)) }))
            .filter((sg) => sg.problems.length > 0);
          if (subs.length === 0) return null;

          const open = topicOpen(tg.topic);
          const stats = groupStats(tg.subtopics.flatMap((s) => s.problems));

          return (
            <section key={tg.topic} className={"striver-topic-card" + (open ? " is-expanded" : "")}>
              <h2 className="striver-topic-title">
                <button
                  type="button"
                  className="striver-topic-head"
                  aria-expanded={open}
                  onClick={() => setExpandedTopics((prev) => ({ ...prev, [tg.topic]: !open }))}
                >
                  <span className="striver-chevron" aria-hidden="true" />
                  <span className="striver-topic-name">
                    <span className="striver-topic-n">{tIdx + 1}</span>
                    {tg.topic}
                  </span>
                  <span className="striver-topic-meta">
                    <span className="striver-topic-counter">
                      {stats.solved}/{stats.total}
                    </span>
                    <span className="striver-meter striver-meter-sm" aria-hidden="true">
                      <i className="dot-green" style={{ width: `${pct(stats.green, stats.total)}%` }} />
                      <i className="dot-yellow" style={{ width: `${pct(stats.yellow, stats.total)}%` }} />
                      <i className="dot-red" style={{ width: `${pct(stats.red, stats.total)}%` }} />
                    </span>
                  </span>
                </button>
              </h2>

              {open && (
                <div className="striver-subtopics-container">
                  {subs.map((sg) => {
                    const sOpen = subOpen(tg.topic, sg.subtopic);
                    const ss = groupStats(sg.problems);
                    return (
                      <div key={sg.subtopic} className="striver-subtopic-card">
                        <h3 className="striver-subtopic-title">
                          <button
                            type="button"
                            className="striver-subtopic-head"
                            aria-expanded={sOpen}
                            onClick={() =>
                              setCollapsedSubtopics((prev) => ({
                                ...prev,
                                [`${tg.topic}::${sg.subtopic}`]: sOpen,
                              }))
                            }
                          >
                            <span className="striver-chevron" aria-hidden="true" />
                            <span>{sg.subtopic}</span>
                            <span className="striver-subtopic-badge">
                              {ss.solved}/{ss.total}
                            </span>
                          </button>
                        </h3>

                        {sOpen && (
                          <div className="striver-table-wrap">
                            <table className="striver-table">
                              <thead>
                                <tr>
                                  <th className="c-order">#</th>
                                  <th className="c-problem">Problem</th>
                                  <th className="c-classify">How it went</th>
                                  <th className="c-schedule">Next review</th>
                                  <th className="c-notes">
                                    <span className="sr-only">Note</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sg.problems.map((p) => (
                                  <ProblemRow
                                    key={p.id}
                                    problem={p}
                                    status={store.statuses[p.id]?.status ?? "unattempted"}
                                    notes={store.statuses[p.id]?.notes}
                                    next={nextReviewByProblem.get(p.id)}
                                    notesOpen={Boolean(openNotes[p.id])}
                                    onToggleNotes={() => setOpenNotes((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {visible.size === 0 && (
          <p className="striver-empty">No problems match. Try a different search or clear the filters.</p>
        )}
      </div>
    </div>
  );
}

function ProblemRow({
  problem: p,
  status,
  notes,
  next,
  notesOpen,
  onToggleNotes,
}: {
  problem: StriverProblem;
  status: ProblemStatus;
  notes?: string;
  next?: Next;
  notesOpen: boolean;
  onToggleNotes: () => void;
}) {
  const choices: { value: ProblemStatus; label: string; title: string }[] = [
    { value: "green", label: "Green", title: "Solved on your own" },
    { value: "yellow", label: "Yellow", title: "Needed a hint: review in 7 and 28 days" },
    { value: "red", label: "Red", title: "Couldn't solve it: review in 7, 14 and 28 days" },
  ];

  return (
    <tr>
      <td className="c-order">{p.order}</td>
      <td className="c-problem">
        <a
          href={p.leetcodeLink || p.articleLink || undefined}
          target="_blank"
          rel="noreferrer"
          className="problem-title-link"
        >
          {p.label}
        </a>
        <div className="problem-tags">
          <span className={"problem-diff-pill diff-" + p.difficulty}>{p.difficulty}</span>
          {p.leetcodeLink && (
            <a href={p.leetcodeLink} target="_blank" rel="noreferrer" className="problem-link-icon">
              LeetCode ↗
            </a>
          )}
          {p.youtubeLink && (
            <a href={p.youtubeLink} target="_blank" rel="noreferrer" className="problem-link-icon">
              Video ↗
            </a>
          )}
          {p.articleLink && (
            <a href={p.articleLink} target="_blank" rel="noreferrer" className="problem-link-icon">
              Article ↗
            </a>
          )}
        </div>
        {notesOpen && (
          <textarea
            className="notes-textarea"
            aria-label={`Notes for ${p.label}`}
            placeholder="Key idea, edge cases, time and space complexity…"
            defaultValue={notes || ""}
            onBlur={(e) => saveProblemNotes(p.id, e.target.value)}
          />
        )}
      </td>
      <td className="c-classify">
        <div className="status-pill-group" role="group" aria-label={`Status of ${p.label}`}>
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              className={"status-pill" + (status === c.value ? " is-" + c.value : "")}
              aria-pressed={status === c.value}
              title={c.title}
              onClick={() => setProblemStatus(p.id, c.value)}
            >
              {c.label}
            </button>
          ))}
          {status !== "unattempted" && (
            <button
              type="button"
              className="status-pill status-reset"
              aria-label={`Reset ${p.label}`}
              title="Reset"
              onClick={() => setProblemStatus(p.id, "unattempted")}
            >
              ×
            </button>
          )}
        </div>
      </td>
      <td className="c-schedule">
        {status === "green" ? (
          <span className="sched-badge is-mastered">Mastered</span>
        ) : status === "unattempted" || !next ? (
          <span className="sched-none">—</span>
        ) : (
          <span className={"sched-badge" + (next.isDueToday ? " is-due" : next.isOverdue ? " is-overdue" : "")}>
            {next.isDueToday ? "Today" : next.isOverdue ? `Overdue · ${next.dueDate}` : next.dueDate}
          </span>
        )}
      </td>
      <td className="c-notes">
        <button
          type="button"
          className={"notes-btn" + (notes ? " has-notes" : "")}
          aria-expanded={notesOpen}
          onClick={onToggleNotes}
        >
          {notes ? "Note ✓" : "+ Note"}
        </button>
      </td>
    </tr>
  );
}
