"use client";
import { useEffect, useMemo, useState } from "react";
import { useHydrated } from "@/lib/plan-store";
import { toDateString } from "@/lib/striver-schedule";
import {
  addCustomProblem,
  checkAndLevelMissedReviews,
  deleteCustomProblem,
  migrateLegacyCustomProblems,
  saveProblemNotes,
  setProblemStatus,
  setReminders,
  useStriver,
} from "@/lib/striver-store";
import type { ProblemStatus, StriverProblem } from "@/lib/striver-types";
import { compareProblemNumbers } from "@/lib/striver-types";
import { StatusMenu } from "./status-menu";
import { TopicMenu } from "./topic-menu";
import { SelectMenu } from "./select-menu";

type SubtopicGroup = { subtopic: string; problems: StriverProblem[] };
type TopicGroup = { topic: string; subtopics: SubtopicGroup[]; totalCount: number };
type Next = { dueDate: string; stage: number; isOverdue: boolean; isDueToday: boolean };

const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);

export function StriverClient({ problems, email }: { problems: StriverProblem[]; email: string }) {
  const store = useStriver();
  const hydrated = useHydrated();
  const userProblems = store.customProblems;
  const addUserProblem = addCustomProblem;
  const deleteUserProblem = deleteCustomProblem;

  // Merge predefined static sheet with user-added problems
  const allProblems = useMemo(() => {
    return [...problems, ...userProblems];
  }, [problems, userProblems]);

  const todayStr = hydrated ? toDateString(new Date()) : "";
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [collapsedSubtopics, setCollapsedSubtopics] = useState<Record<string, boolean>>({});
  const [openNotes, setOpenNotes] = useState<Record<number, boolean>>({});
  const [testState, setTestState] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });
  // Set when marking green would leave reviews queued: the user is asked once whether to keep them.
  const [greenAsk, setGreenAsk] = useState<{ problem: StriverProblem; queued: number } | null>(null);

  // Add Problem modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTopic, setAddTopic] = useState("");
  const [addSubtopic, setAddSubtopic] = useState("");
  const [isNewTopic, setIsNewTopic] = useState(false);
  const [isNewSubtopic, setIsNewSubtopic] = useState(false);
  const [customTopicName, setCustomTopicName] = useState("");
  const [customSubtopicName, setCustomSubtopicName] = useState("");
  const [addOrder, setAddOrder] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addDiff, setAddDiff] = useState<"core" | "easy" | "medium" | "hard">("medium");
  const [addLeetcode, setAddLeetcode] = useState("");
  const [addYoutube, setAddYoutube] = useState("");
  const [addArticle, setAddArticle] = useState("");
  const [addError, setAddError] = useState("");

  // Map of existing topics and subtopics for quick selection
  const existingTopicMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of allProblems) {
      if (!map.has(p.topic)) map.set(p.topic, []);
      const subList = map.get(p.topic)!;
      if (!subList.includes(p.subtopic)) subList.push(p.subtopic);
    }
    return map;
  }, [allProblems]);

  const availableTopics = useMemo(() => Array.from(existingTopicMap.keys()), [existingTopicMap]);

  useEffect(() => {
    if (!addModalOpen) return;
    // Escape closes an open menu first (its own handler does that), and only then the dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".striver-modal .st-menu-pop")) setAddModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addModalOpen]);

  function openAddModal(defaultTopic?: string, defaultSubtopic?: string) {
    const top = defaultTopic || (topicFilter !== "all" ? topicFilter : availableTopics[0] || "Binary Search");
    const subList = existingTopicMap.get(top) || [];
    const sub = defaultSubtopic || subList[0] || top;

    setAddTopic(top);
    setAddSubtopic(sub);
    setIsNewTopic(false);
    setIsNewSubtopic(false);
    setCustomTopicName("");
    setCustomSubtopicName("");
    setAddOrder("");
    setAddLabel("");
    setAddDiff("medium");
    setAddLeetcode("");
    setAddYoutube("");
    setAddArticle("");
    setAddError("");
    setAddModalOpen(true);
  }

  function handleAddProblem(e: React.FormEvent) {
    e.preventDefault();
    const finalTopic = (isNewTopic ? customTopicName : addTopic).trim();
    const finalSubtopic = (isNewSubtopic ? customSubtopicName : addSubtopic).trim();
    const finalOrder = addOrder.trim();
    const finalLabel = addLabel.trim();

    if (!finalLabel) {
      setAddError("Please enter a problem title.");
      return;
    }
    if (!finalOrder) {
      setAddError("Please enter an order number (e.g. 18.1, 20.1).");
      return;
    }
    if (!finalTopic) {
      setAddError("Please select or enter a section.");
      return;
    }
    if (!finalSubtopic) {
      setAddError("Please select or enter a subtopic.");
      return;
    }

    const badLink = [
      ["LeetCode", addLeetcode],
      ["Video", addYoutube],
      ["Article", addArticle],
    ].find(([, v]) => v.trim() && !/^https?:\/\//i.test(v.trim()));
    if (badLink) {
      setAddError(`${badLink[0]} link must start with http:// or https://`);
      return;
    }

    addUserProblem({
      order: finalOrder,
      label: finalLabel,
      topic: finalTopic,
      subtopic: finalSubtopic,
      topicPath: [finalTopic, finalSubtopic],
      difficulty: addDiff,
      leetcodeLink: addLeetcode.trim() || null,
      youtubeLink: addYoutube.trim() || null,
      articleLink: addArticle.trim() || null,
    });

    setExpandedTopics((prev) => ({ ...prev, [finalTopic]: true }));
    setCollapsedSubtopics((prev) => ({ ...prev, [`${finalTopic}::${finalSubtopic}`]: false }));
    setAddModalOpen(false);
  }

  // Reviews missed while away move to the quietest days of the coming week, as the daily job does for the server copy.
  useEffect(() => {
    migrateLegacyCustomProblems();
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
    () => allProblems.filter((p) => {
      const n = nextReviewByProblem.get(p.id);
      return n && (n.isDueToday || n.isOverdue);
    }),
    [allProblems, nextReviewByProblem],
  );

  const counts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, unattempted: 0, total: allProblems.length };
    for (const p of allProblems) c[store.statuses[p.id]?.status ?? "unattempted"]++;
    return c;
  }, [allProblems, store.statuses]);

  const topicGroups = useMemo(() => {
    const map = new Map<string, Map<string, StriverProblem[]>>();
    for (const p of allProblems) {
      const sub = map.get(p.topic) ?? new Map<string, StriverProblem[]>();
      sub.set(p.subtopic, [...(sub.get(p.subtopic) ?? []), p]);
      map.set(p.topic, sub);
    }
    const groups: TopicGroup[] = [];
    for (const [topic, sub] of map) {
      const subtopics = [...sub].map(([subtopic, list]) => ({
        subtopic,
        problems: [...list].sort((a, b) => compareProblemNumbers(a.order, b.order)),
      }));
      groups.push({ topic, subtopics, totalCount: subtopics.reduce((n, s) => n + s.problems.length, 0) });
    }
    return groups;
  }, [allProblems]);

  const filtering = query.trim() !== "" || topicFilter !== "all" || statusFilter !== "all";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const set = new Set<number>();
    for (const p of allProblems) {
      const status = store.statuses[p.id]?.status ?? "unattempted";
      if (q && !`${p.label} ${p.topic} ${p.subtopic} ${p.order}`.toLowerCase().includes(q)) continue;
      if (topicFilter !== "all" && p.topic !== topicFilter) continue;
      if (statusFilter !== "all" && status !== statusFilter) continue;
      set.add(p.id);
    }
    return set;
  }, [allProblems, query, topicFilter, statusFilter, store.statuses]);

  // While searching or filtering, every group with a match is open; otherwise the user's own toggles apply.
  const topicOpen = (t: string) => filtering || (expandedTopics[t] ?? false);
  const subOpen = (t: string, s: string) => !collapsedSubtopics[`${t}::${s}`];

  // Green never deletes the queue silently. If reviews would stay queued, ask once whether to keep them.
  function chooseStatus(p: StriverProblem, status: ProblemStatus) {
    if (status === "green") {
      const current = store.statuses[p.id]?.status ?? "unattempted";
      const hasDue = store.reviews.some((r) => r.problemId === p.id && !r.completed && r.dueDate <= todayStr);
      const queued = store.reviews.filter((r) => r.problemId === p.id && !r.completed && r.dueDate > todayStr).length;
      if (queued > 0 && (current !== "green" || hasDue)) {
        setGreenAsk({ problem: p, queued });
        return;
      }
    }
    setProblemStatus(p.id, status);
  }

  function answerGreenAsk(clearPending: boolean) {
    if (greenAsk) setProblemStatus(greenAsk.problem.id, "green", undefined, clearPending);
    setGreenAsk(null);
  }

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
        body: JSON.stringify({
          reviews: store.reviews,
          today: toDateString(new Date()),
          customProblems: userProblems,
        }),
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
        <h1>Striver {allProblems.length} sheet</h1>
        <p className="striver-lead">
          Mark each problem by how it went. A hint schedules reviews at 7, 28 and 56 days, a struggle at 7, 14, 28 and 56.
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
                    <button type="button" className="striver-answer is-green" onClick={() => chooseStatus(p, "green")}>
                      Mastered
                    </button>
                    <button
                      type="button"
                      className="striver-answer is-yellow"
                      title="Review again in 7, 28 and 56 days"
                      onClick={() => chooseStatus(p, "yellow")}
                    >
                      Needed a hint
                    </button>
                    <button
                      type="button"
                      className="striver-answer is-red"
                      title="Review again in 7, 14, 28 and 56 days"
                      onClick={() => chooseStatus(p, "red")}
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
          placeholder={`Search ${allProblems.length} problems…`}
          aria-label="Search problems"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <TopicMenu
          value={topicFilter}
          total={allProblems.length}
          options={topicGroups.map((g) => ({ value: g.topic, label: g.topic, count: g.totalCount }))}
          onChange={setTopicFilter}
        />
        <button
          type="button"
          className="striver-btn striver-btn-primary"
          onClick={() => openAddModal()}
          title="Add a problem anywhere in the sheet"
        >
          + Add problem
        </button>
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
                        <div className="striver-subtopic-head-row">
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
                          <button
                            type="button"
                            className="striver-subtopic-add"
                            title={`Add problem to ${sg.subtopic}`}
                            aria-label={`Add problem to ${sg.subtopic}`}
                            onClick={() => openAddModal(tg.topic, sg.subtopic)}
                          >
                            + Add
                          </button>
                        </div>

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
                                    onSelect={(status) => chooseStatus(p, status)}
                                    notesOpen={Boolean(openNotes[p.id])}
                                    onToggleNotes={() => setOpenNotes((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                                    onDeleteCustom={deleteUserProblem}
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

      {greenAsk && (
        <div className="striver-ask-backdrop" onClick={() => setGreenAsk(null)}>
          <div
            className="striver-ask"
            role="dialog"
            aria-modal="true"
            aria-labelledby="striver-ask-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setGreenAsk(null)}
          >
            <h3 id="striver-ask-title">Keep the remaining reminders?</h3>
            <p>
              {greenAsk.problem.label} still has {greenAsk.queued} review{greenAsk.queued > 1 ? "s" : ""} queued. Marking
              it green can keep them coming or drop them.
            </p>
            <div className="striver-ask-actions">
              <button type="button" className="striver-answer is-green" autoFocus onClick={() => answerGreenAsk(false)}>
                Keep reminders
              </button>
              <button type="button" className="striver-answer is-red" onClick={() => answerGreenAsk(true)}>
                Remove them
              </button>
              <button type="button" className="striver-answer" onClick={() => setGreenAsk(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="striver-modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div
            className="striver-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="striver-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="striver-modal-header">
              <div>
                <h3 id="striver-modal-title">Add a problem</h3>
                <p className="striver-modal-sub">It joins your sheet, syncs with your progress and shows up in the daily email.</p>
              </div>
              <button
                type="button"
                className="striver-modal-close"
                onClick={() => setAddModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProblem} className="striver-modal-form" noValidate>
              <div className="striver-form-field">
                <label htmlFor="problem-label">Problem title</label>
                <input
                  id="problem-label"
                  type="text"
                  placeholder="e.g. Peak Index in a Mountain Array"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  maxLength={200}
                  autoFocus
                />
              </div>

              <div className="striver-form-row">
                <div className="striver-form-field">
                  <label htmlFor="problem-order">Number</label>
                  <input
                    id="problem-order"
                    type="text"
                    placeholder="e.g. 18.1"
                    value={addOrder}
                    onChange={(e) => setAddOrder(e.target.value)}
                    maxLength={20}
                  />
                  <small className="striver-field-hint">18.1 sorts right after #18</small>
                </div>

                <div className="striver-form-field">
                  <span className="striver-field-label" id="problem-diff-label">Difficulty</span>
                  <div className="striver-segmented" role="radiogroup" aria-labelledby="problem-diff-label">
                    {(["easy", "medium", "hard", "core"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={addDiff === d}
                        className={`striver-seg is-${d}${addDiff === d ? " is-on" : ""}`}
                        onClick={() => setAddDiff(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <fieldset className="striver-fieldset">
                <legend>Where it goes</legend>
                <div className="striver-form-row">
                  <div className="striver-form-field">
                    <label htmlFor="problem-topic">Section</label>
                    {!isNewTopic ? (
                      <SelectMenu
                        id="problem-topic"
                        label="Section"
                        value={addTopic}
                        options={[
                          ...availableTopics.map((t) => ({ value: t, label: t })),
                          { value: "__NEW__", label: "+ New section…", action: true },
                        ]}
                        onChange={(v) => {
                          if (v === "__NEW__") {
                            setIsNewTopic(true);
                            setCustomTopicName("");
                            setIsNewSubtopic(true);
                            setCustomSubtopicName("");
                          } else {
                            setAddTopic(v);
                            const subList = existingTopicMap.get(v) || [];
                            setAddSubtopic(subList[0] || v);
                            setIsNewSubtopic(false);
                          }
                        }}
                      />
                    ) : (
                      <div className="striver-input-with-cancel">
                        <input
                          id="problem-topic"
                          type="text"
                          placeholder="e.g. Binary Search"
                          value={customTopicName}
                          onChange={(e) => setCustomTopicName(e.target.value)}
                          maxLength={100}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="striver-mini-cancel"
                          onClick={() => {
                            setIsNewTopic(false);
                            setAddTopic(availableTopics[0] || "");
                            const subList = existingTopicMap.get(availableTopics[0] || "") || [];
                            setAddSubtopic(subList[0] || availableTopics[0] || "");
                            setIsNewSubtopic(false);
                          }}
                        >
                          Use existing
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="striver-form-field">
                    <label htmlFor="problem-subtopic">Subtopic</label>
                    {!isNewTopic && !isNewSubtopic ? (
                      <SelectMenu
                        id="problem-subtopic"
                        label="Subtopic"
                        value={addSubtopic}
                        options={[
                          ...(existingTopicMap.get(addTopic) || [addTopic]).map((st) => ({ value: st, label: st })),
                          { value: "__NEW_SUB__", label: "+ New subtopic…", action: true },
                        ]}
                        onChange={(v) => {
                          if (v === "__NEW_SUB__") {
                            setIsNewSubtopic(true);
                            setCustomSubtopicName("");
                          } else {
                            setAddSubtopic(v);
                          }
                        }}
                      />
                    ) : (
                      <div className="striver-input-with-cancel">
                        <input
                          id="problem-subtopic"
                          type="text"
                          placeholder="e.g. BS on 1D Arrays"
                          value={customSubtopicName}
                          onChange={(e) => setCustomSubtopicName(e.target.value)}
                          maxLength={100}
                        />
                        {!isNewTopic && (
                          <button
                            type="button"
                            className="striver-mini-cancel"
                            onClick={() => {
                              setIsNewSubtopic(false);
                              const subList = existingTopicMap.get(addTopic) || [];
                              setAddSubtopic(subList[0] || addTopic);
                            }}
                          >
                            Use existing
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="striver-fieldset">
                <legend>Links <span>(optional)</span></legend>
                <div className="striver-form-field">
                  <label htmlFor="problem-leetcode">LeetCode</label>
                  <input
                    id="problem-leetcode"
                    type="url"
                    placeholder="https://leetcode.com/problems/…"
                    value={addLeetcode}
                    onChange={(e) => setAddLeetcode(e.target.value)}
                  />
                </div>
                <div className="striver-form-row">
                  <div className="striver-form-field">
                    <label htmlFor="problem-youtube">Video</label>
                    <input
                      id="problem-youtube"
                      type="url"
                      placeholder="https://youtu.be/…"
                      value={addYoutube}
                      onChange={(e) => setAddYoutube(e.target.value)}
                    />
                  </div>
                  <div className="striver-form-field">
                    <label htmlFor="problem-article">Article</label>
                    <input
                      id="problem-article"
                      type="url"
                      placeholder="https://takeuforward.org/…"
                      value={addArticle}
                      onChange={(e) => setAddArticle(e.target.value)}
                    />
                  </div>
                </div>
              </fieldset>

              <div className="striver-modal-footer">
                {addError ? (
                  <p className="striver-modal-error" role="alert">{addError}</p>
                ) : (
                  <span className="striver-modal-hint">Esc to close</span>
                )}
                <div className="striver-modal-actions">
                  <button type="button" className="striver-btn" onClick={() => setAddModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="striver-btn striver-btn-primary">
                    Add problem
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProblemRow({
  problem: p,
  status,
  notes,
  next,
  onSelect,
  notesOpen,
  onToggleNotes,
  onDeleteCustom,
}: {
  problem: StriverProblem;
  status: ProblemStatus;
  notes?: string;
  next?: Next;
  onSelect: (status: ProblemStatus) => void;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onDeleteCustom?: (id: number) => void;
}) {
  return (
    <tr className={p.isCustom ? "is-custom-problem" : undefined}>
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
          {p.isCustom && <span className="problem-custom-pill">Custom</span>}
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
          {p.isCustom && onDeleteCustom && (
            <button
              type="button"
              className="problem-delete-btn"
              title={`Remove "${p.label}"`}
              onClick={() => {
                if (window.confirm(`Remove "${p.label}" (#${p.order}) from your sheet?`)) {
                  onDeleteCustom(p.id);
                }
              }}
            >
              Delete
            </button>
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
        <StatusMenu value={status} label={p.label} onChange={onSelect} />
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
