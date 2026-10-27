"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toDateString } from "@/lib/striver-schedule";
import {
  checkAndLevelMissedReviews,
  saveProblemNotes,
  setProblemStatus,
  setUserEmail,
  useStriver,
} from "@/lib/striver-store";
import type { ProblemStatus, StriverProblem } from "@/lib/striver-types";

type SubtopicGroup = {
  subtopic: string;
  problems: StriverProblem[];
};

type TopicGroup = {
  topic: string;
  subtopics: SubtopicGroup[];
  totalCount: number;
};

export function StriverClient({ problems }: { problems: StriverProblem[] }) {
  const store = useStriver();
  const { data: session } = useSession();
  const [todayStr, setTodayStr] = useState("");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Accordion expanded state
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    Arrays: true,
    Hashing: true,
  });
  const [expandedSubtopics, setExpandedSubtopics] = useState<Record<string, boolean>>({
    "Arrays::Linear Scan": true,
    "Arrays::Two Pointers": true,
  });

  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [emailInput, setEmailInput] = useState(store.email || "");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [levelMsg, setLevelMsg] = useState<string | null>(null);

  // Set today's date on mount and run auto-leveling for missed problems
  useEffect(() => {
    const today = toDateString(new Date());
    setTodayStr(today);
    const moved = checkAndLevelMissedReviews();
    if (moved > 0) {
      setLevelMsg(`Automatically rescheduled ${moved} missed problem(s) to closest low-load days.`);
    }
  }, []);

  // Update emailInput if store changes, or auto-populate from authenticated session
  useEffect(() => {
    if (session?.user?.email && !store.email) {
      setUserEmail(session.user.email);
      setEmailInput(session.user.email);
    } else if (store.email && !emailInput) {
      setEmailInput(store.email);
    }
  }, [session?.user?.email, store.email, emailInput]);

  // Review status lookup for each problem: earliest active review
  const nextReviewByProblem = useMemo(() => {
    const map = new Map<number, { dueDate: string; stage: number; isOverdue: boolean; isDueToday: boolean }>();
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

  // Problems due today
  const dueTodayProblems = useMemo(() => {
    return problems.filter((p) => nextReviewByProblem.get(p.id)?.isDueToday);
  }, [problems, nextReviewByProblem]);

  // Overall Statistics
  const counts = useMemo(() => {
    let green = 0;
    let yellow = 0;
    let red = 0;
    let unattempted = 0;

    for (const p of problems) {
      const s = store.statuses[p.id]?.status || "unattempted";
      if (s === "green") green++;
      else if (s === "yellow") yellow++;
      else if (s === "red") red++;
      else unattempted++;
    }

    return { green, yellow, red, unattempted, total: problems.length };
  }, [problems, store.statuses]);

  // Group problems into Topic -> Subtopic tree in exact order
  const topicGroups = useMemo(() => {
    const map = new Map<string, Map<string, StriverProblem[]>>();

    for (const p of problems) {
      if (!map.has(p.topic)) {
        map.set(p.topic, new Map());
      }
      const subMap = map.get(p.topic)!;
      if (!subMap.has(p.subtopic)) {
        subMap.set(p.subtopic, []);
      }
      subMap.get(p.subtopic)!.push(p);
    }

    const groups: TopicGroup[] = [];
    for (const [topic, subMap] of map.entries()) {
      const subtopics: SubtopicGroup[] = [];
      let totalCount = 0;
      for (const [subtopic, probList] of subMap.entries()) {
        subtopics.push({ subtopic, problems: probList });
        totalCount += probList.length;
      }
      groups.push({ topic, subtopics, totalCount });
    }

    return groups;
  }, [problems]);

  // Filtered problems check
  const isProblemVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleSet = new Set<number>();

    for (const p of problems) {
      const status = store.statuses[p.id]?.status || "unattempted";
      const sched = nextReviewByProblem.get(p.id);

      if (q) {
        const matchTitle = p.label.toLowerCase().includes(q);
        const matchTopic = p.topic.toLowerCase().includes(q) || p.subtopic.toLowerCase().includes(q);
        if (!matchTitle && !matchTopic) continue;
      }

      if (topicFilter !== "all" && p.topic !== topicFilter) {
        continue;
      }

      if (statusFilter === "due" && !sched?.isDueToday) {
        continue;
      }
      if (statusFilter !== "all" && statusFilter !== "due" && status !== statusFilter) {
        continue;
      }

      visibleSet.add(p.id);
    }

    return visibleSet;
  }, [problems, query, topicFilter, statusFilter, store.statuses, nextReviewByProblem]);

  // If user searched, auto-expand matching topics & subtopics
  useEffect(() => {
    if (query.trim()) {
      const newExpTopics: Record<string, boolean> = {};
      const newExpSubtopics: Record<string, boolean> = {};

      for (const tg of topicGroups) {
        let topicHasVisible = false;
        for (const sg of tg.subtopics) {
          const hasVisible = sg.problems.some((p) => isProblemVisible.has(p.id));
          if (hasVisible) {
            newExpSubtopics[`${tg.topic}::${sg.subtopic}`] = true;
            topicHasVisible = true;
          }
        }
        if (topicHasVisible) {
          newExpTopics[tg.topic] = true;
        }
      }

      setExpandedTopics((prev) => ({ ...prev, ...newExpTopics }));
      setExpandedSubtopics((prev) => ({ ...prev, ...newExpSubtopics }));
    }
  }, [query, isProblemVisible, topicGroups]);

  function toggleTopic(topic: string) {
    setExpandedTopics((prev) => ({ ...prev, [topic]: !prev[topic] }));
  }

  function toggleSubtopic(topic: string, subtopic: string) {
    const key = `${topic}::${subtopic}`;
    setExpandedSubtopics((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function expandAll() {
    const expT: Record<string, boolean> = {};
    const expS: Record<string, boolean> = {};
    for (const tg of topicGroups) {
      expT[tg.topic] = true;
      for (const sg of tg.subtopics) {
        expS[`${tg.topic}::${sg.subtopic}`] = true;
      }
    }
    setExpandedTopics(expT);
    setExpandedSubtopics(expS);
  }

  function collapseAll() {
    setExpandedTopics({});
    setExpandedSubtopics({});
  }

  function handleSaveEmail() {
    if (!emailInput || !emailInput.includes("@")) {
      setEmailMsg("Please enter a valid email address.");
      return;
    }
    setUserEmail(emailInput.trim());
    setEmailMsg("Reminder email saved!");
    setTimeout(() => setEmailMsg(null), 3000);
  }

  async function handleSendTestReminder() {
    if (!store.email) {
      setEmailMsg("Please save your email above first.");
      return;
    }

    setTestSending(true);
    setEmailMsg("Dispatching test revision email...");

    try {
      const reviewsToSend = store.reviews.length > 0 ? store.reviews : [];
      const res = await fetch("/api/cron/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: store.email, reviews: reviewsToSend }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.skipped) {
          setEmailMsg("SMTP not set in .env.local yet, but cron handler processed successfully!");
        } else if (data.sent) {
          setEmailMsg(`Success! Sent revision digest (${data.count} problems) to ${store.email}`);
        } else {
          setEmailMsg(`Cron ran: ${data.message || "No problems scheduled for today."}`);
        }
      } else {
        setEmailMsg(`Error: ${data.error || "Failed sending email"}`);
      }
    } catch {
      setEmailMsg("Error contacting cron endpoint.");
    } finally {
      setTestSending(false);
      setTimeout(() => setEmailMsg(null), 5000);
    }
  }

  function handleManualLevel() {
    const moved = checkAndLevelMissedReviews();
    if (moved > 0) {
      setLevelMsg(`Rescheduled ${moved} overdue problem(s) to closest zero-problem days.`);
    } else {
      setLevelMsg("No overdue problems need rescheduling.");
    }
    setTimeout(() => setLevelMsg(null), 4000);
  }

  // Calculate solved counts for a given group of problems
  function getGroupStats(probs: StriverProblem[]) {
    let green = 0;
    let yellow = 0;
    let red = 0;
    for (const p of probs) {
      const s = store.statuses[p.id]?.status;
      if (s === "green") green++;
      else if (s === "yellow") yellow++;
      else if (s === "red") red++;
    }
    const solved = green + yellow + red;
    return { green, yellow, red, solved, total: probs.length };
  }

  return (
    <div className="striver-page">
      <header className="striver-header">
        <span className="striver-eyebrow">DSA Preparation</span>
        <h1>Striver 180 SDE Sheet Tracker</h1>
        <p className="striver-lead">
          Master the 180 core DSA patterns with spaced repetition. Solved with a hint? Review in 7 &amp; 28 days.
          Struggled? Review in 7, 14, and 28 days. Daily email digests keep you consistent.
        </p>
      </header>

      {/* Progress Cards */}
      <section className="striver-stats" aria-label="Progress Statistics">
        <div className="striver-stat-card">
          <span className="striver-stat-label">Mastered (Green)</span>
          <div className="striver-stat-val">
            <span style={{ color: "#22c55e" }}>{counts.green}</span>
            <small>/ {counts.total}</small>
          </div>
          <div className="striver-stat-bar">
            <i className="bar-green" style={{ width: `${(counts.green / counts.total) * 100}%` }} />
          </div>
        </div>

        <div className="striver-stat-card">
          <span className="striver-stat-label">Reviewing (Yellow: +7d, +28d)</span>
          <div className="striver-stat-val">
            <span style={{ color: "#ca8a04" }}>{counts.yellow}</span>
            <small>/ {counts.total}</small>
          </div>
          <div className="striver-stat-bar">
            <i className="bar-yellow" style={{ width: `${(counts.yellow / counts.total) * 100}%` }} />
          </div>
        </div>

        <div className="striver-stat-card">
          <span className="striver-stat-label">Struggled (Red: +7d, +14d, +28d)</span>
          <div className="striver-stat-val">
            <span style={{ color: "#dc2626" }}>{counts.red}</span>
            <small>/ {counts.total}</small>
          </div>
          <div className="striver-stat-bar">
            <i className="bar-red" style={{ width: `${(counts.red / counts.total) * 100}%` }} />
          </div>
        </div>

        <div className="striver-stat-card">
          <span className="striver-stat-label">Unattempted</span>
          <div className="striver-stat-val">
            <span style={{ color: "var(--muted)" }}>{counts.unattempted}</span>
            <small>/ {counts.total}</small>
          </div>
          <div className="striver-stat-bar">
            <i style={{ width: `${(counts.unattempted / counts.total) * 100}%`, background: "var(--line)" }} />
          </div>
        </div>
      </section>

      {/* Due Today Banner */}
      {dueTodayProblems.length > 0 && (
        <section className="striver-due-banner" aria-label="Due Today for Review">
          <div className="striver-due-head">
            <div className="striver-due-title">
              <span className="striver-due-badge">{dueTodayProblems.length} DUE TODAY</span>
              <h3>Spaced Repetition Queue</h3>
            </div>
            <span style={{ fontSize: "13.5px", color: "var(--muted)" }}>
              Solve and update status to advance or clear the schedule.
            </span>
          </div>

          <div className="striver-due-list">
            {dueTodayProblems.map((p) => (
              <div key={p.id} className="striver-due-item">
                <div className="striver-due-info">
                  <span className="striver-due-order">#{p.order}</span>
                  <div>
                    <strong style={{ fontSize: "15px" }}>{p.label}</strong>
                    <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                      {p.topic} &rsaquo; {p.subtopic}
                    </div>
                  </div>
                </div>

                <div className="striver-due-actions">
                  {p.leetcodeLink && (
                    <a
                      href={p.leetcodeLink}
                      target="_blank"
                      rel="noreferrer"
                      className="striver-btn"
                      style={{ height: "32px", fontSize: "12.5px" }}
                    >
                      Solve &rarr;
                    </a>
                  )}
                  <button
                    type="button"
                    className="striver-btn"
                    style={{ height: "32px", fontSize: "12px", background: "#22c55e18", color: "#16a34a" }}
                    onClick={() => setProblemStatus(p.id, "green")}
                    title="Understood complexity & mastered"
                  >
                    ✓ Mastered
                  </button>
                  <button
                    type="button"
                    className="striver-btn"
                    style={{ height: "32px", fontSize: "12px", background: "#eab30818", color: "#ca8a04" }}
                    onClick={() => setProblemStatus(p.id, "yellow")}
                    title="Needed a hint (+7d, +28d)"
                  >
                    Hint (+7d, +28d)
                  </button>
                  <button
                    type="button"
                    className="striver-btn"
                    style={{ height: "32px", fontSize: "12px", background: "#ef444418", color: "#dc2626" }}
                    onClick={() => setProblemStatus(p.id, "red")}
                    title="Struggled / Needed solution (+7d, +14d, +28d)"
                  >
                    Struggled (+7d, +14d, +28d)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reminder Email Configuration & Manual Trigger */}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          padding: "14px 18px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "10px",
          marginBottom: "20px",
          fontSize: "13.5px",
        }}
      >
        <span style={{ fontWeight: 650, color: "var(--text)" }}>Email Reminders:</span>
        <input
          type="email"
          placeholder="Enter your email (e.g. you@gmail.com)"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          style={{
            height: "34px",
            padding: "0 10px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--bg)",
            color: "var(--text)",
            minWidth: "240px",
          }}
        />
        <button type="button" className="striver-btn" onClick={handleSaveEmail}>
          Save Email
        </button>
        <button
          type="button"
          className="striver-btn primary"
          disabled={testSending}
          onClick={handleSendTestReminder}
          title="Triggers the daily reminder function for testing"
        >
          {testSending ? "Sending..." : "Test Send Reminders"}
        </button>
        <button
          type="button"
          className="striver-btn"
          onClick={handleManualLevel}
          title="Reschedules overdue problems using the 0-problem day rule"
        >
          Level Missed Reviews
        </button>
        {(emailMsg || levelMsg) && (
          <span style={{ color: "var(--accent)", fontWeight: 550, marginLeft: "auto" }}>
            {emailMsg || levelMsg}
          </span>
        )}
      </section>

      {/* Search and Filters */}
      <div className="striver-bar">
        <input
          type="search"
          className="striver-search"
          placeholder="Search 179 problems, topics, patterns..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          className="striver-select"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          aria-label="Filter by Topic"
        >
          <option value="all">All Topics ({problems.length})</option>
          {topicGroups.map((tg) => (
            <option key={tg.topic} value={tg.topic}>
              {tg.topic} ({tg.totalCount})
            </option>
          ))}
        </select>

        <select
          className="striver-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by Status"
        >
          <option value="all">All Statuses</option>
          <option value="due">Due Today ({dueTodayProblems.length})</option>
          <option value="green">Mastered (Green: {counts.green})</option>
          <option value="yellow">Reviewing (Yellow: {counts.yellow})</option>
          <option value="red">Struggled (Red: {counts.red})</option>
          <option value="unattempted">Unattempted ({counts.unattempted})</option>
        </select>

        <button type="button" className="striver-btn" onClick={expandAll} title="Expand all sections">
          Expand All
        </button>
        <button type="button" className="striver-btn" onClick={collapseAll} title="Collapse all sections">
          Collapse All
        </button>

        {(query || topicFilter !== "all" || statusFilter !== "all") && (
          <button
            type="button"
            className="striver-btn"
            onClick={() => {
              setQuery("");
              setTopicFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Striver-Style Hierarchical Accordion List */}
      <div className="striver-accordion-list">
        {topicGroups.map((tg, tIdx) => {
          // Check if any problem in this topic is visible
          const visibleSubtopics = tg.subtopics
            .map((sg) => ({
              ...sg,
              problems: sg.problems.filter((p) => isProblemVisible.has(p.id)),
            }))
            .filter((sg) => sg.problems.length > 0);

          if (visibleSubtopics.length === 0) return null;

          const isTopicExpanded = expandedTopics[tg.topic] ?? false;
          const topicStats = getGroupStats(tg.subtopics.flatMap((s) => s.problems));

          return (
            <div key={tg.topic} className={"striver-topic-card" + (isTopicExpanded ? " is-expanded" : "")}>
              {/* Topic Accordion Header */}
              <div
                className="striver-topic-head"
                onClick={() => toggleTopic(tg.topic)}
                role="button"
                tabIndex={0}
                aria-expanded={isTopicExpanded}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleTopic(tg.topic)}
              >
                <div className="striver-topic-title-group">
                  <span className={"striver-chevron" + (isTopicExpanded ? " is-open" : "")} aria-hidden="true">
                    ▶
                  </span>
                  <h2 className="striver-topic-title">
                    {tIdx + 1}. {tg.topic}
                  </h2>
                </div>

                <div className="striver-topic-meta">
                  <span className="striver-topic-counter">
                    {topicStats.solved} / {topicStats.total} Solved
                  </span>
                  <div className="striver-topic-bar-wrap">
                    <i className="bar-green" style={{ width: `${(topicStats.green / topicStats.total) * 100}%` }} />
                    <i className="bar-yellow" style={{ width: `${(topicStats.yellow / topicStats.total) * 100}%` }} />
                    <i className="bar-red" style={{ width: `${(topicStats.red / topicStats.total) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Topic Body with Subsections */}
              {isTopicExpanded && (
                <div className="striver-subtopics-container">
                  {visibleSubtopics.map((sg) => {
                    const subKey = `${tg.topic}::${sg.subtopic}`;
                    const isSubExpanded = expandedSubtopics[subKey] ?? true;
                    const subStats = getGroupStats(sg.problems);

                    return (
                      <div key={sg.subtopic} className="striver-subtopic-card">
                        {/* Subsection Accordion Header */}
                        <div
                          className="striver-subtopic-head"
                          onClick={() => toggleSubtopic(tg.topic, sg.subtopic)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isSubExpanded}
                          onKeyDown={(e) =>
                            (e.key === "Enter" || e.key === " ") && toggleSubtopic(tg.topic, sg.subtopic)
                          }
                        >
                          <div className="striver-subtopic-title-group">
                            <span
                              className={"striver-chevron" + (isSubExpanded ? " is-open" : "")}
                              style={{ width: "18px", height: "18px", fontSize: "11px" }}
                              aria-hidden="true"
                            >
                              ▶
                            </span>
                            <h3 className="striver-subtopic-title">{sg.subtopic}</h3>
                          </div>

                          <span className="striver-subtopic-badge">
                            {subStats.solved} / {subStats.total} Solved
                          </span>
                        </div>

                        {/* Problems Table inside Subsection */}
                        {isSubExpanded && (
                          <div className="striver-table-wrap">
                            <table className="striver-table">
                              <thead>
                                <tr>
                                  <th className="c-order">#</th>
                                  <th className="c-problem">Problem</th>
                                  <th className="c-classify">Status</th>
                                  <th className="c-schedule">Schedule</th>
                                  <th className="c-notes">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sg.problems.map((p) => {
                                  const statusRec = store.statuses[p.id];
                                  const status = statusRec?.status || "unattempted";
                                  const nextReview = nextReviewByProblem.get(p.id);
                                  const isNotesOpen = expandedNotes[p.id];
                                  const hasNotes = Boolean(statusRec?.notes);

                                  return (
                                    <tr key={p.id}>
                                      <td className="c-order">{p.order}</td>
                                      <td className="c-problem">
                                        <a
                                          href={p.leetcodeLink || p.articleLink || "#"}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="problem-title-link"
                                        >
                                          {p.label}
                                        </a>
                                        <div className="problem-tags">
                                          <span className={"problem-diff-pill diff-" + p.difficulty}>
                                            {p.difficulty}
                                          </span>
                                          {p.leetcodeLink && (
                                            <a
                                              href={p.leetcodeLink}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="problem-link-icon"
                                              title="Solve on LeetCode"
                                            >
                                              Practice ↗
                                            </a>
                                          )}
                                          {p.youtubeLink && (
                                            <a
                                              href={p.youtubeLink}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="problem-link-icon"
                                              title="Watch video solution"
                                            >
                                              Video ↗
                                            </a>
                                          )}
                                          {p.articleLink && (
                                            <a
                                              href={p.articleLink}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="problem-link-icon"
                                              title="Read TakeUForward article"
                                            >
                                              Article ↗
                                            </a>
                                          )}
                                        </div>

                                        {/* Inline note edit row */}
                                        {isNotesOpen && (
                                          <div style={{ marginTop: "10px" }}>
                                            <textarea
                                              className="notes-textarea"
                                              placeholder="Jot down key intuition, edge cases, time/space complexity..."
                                              defaultValue={statusRec?.notes || ""}
                                              onBlur={(e) => saveProblemNotes(p.id, e.target.value)}
                                            />
                                          </div>
                                        )}
                                      </td>

                                      <td className="c-classify">
                                        <div className="status-pill-group">
                                          <button
                                            type="button"
                                            className={"status-pill" + (status === "green" ? " is-green" : "")}
                                            onClick={() => setProblemStatus(p.id, "green")}
                                            title="Solved & understood complexity"
                                          >
                                            Green
                                          </button>
                                          <button
                                            type="button"
                                            className={"status-pill" + (status === "yellow" ? " is-yellow" : "")}
                                            onClick={() => setProblemStatus(p.id, "yellow")}
                                            title="Solved with hint (+7d, +28d)"
                                          >
                                            Yellow
                                          </button>
                                          <button
                                            type="button"
                                            className={"status-pill" + (status === "red" ? " is-red" : "")}
                                            onClick={() => setProblemStatus(p.id, "red")}
                                            title="Couldn't identify solution (+7d, +14d, +28d)"
                                          >
                                            Red
                                          </button>
                                          {status !== "unattempted" && (
                                            <button
                                              type="button"
                                              className="status-pill"
                                              onClick={() => setProblemStatus(p.id, "unattempted")}
                                              title="Reset"
                                            >
                                              &times;
                                            </button>
                                          )}
                                        </div>
                                      </td>

                                      <td className="c-schedule">
                                        {status === "green" && (
                                          <span className="sched-badge is-mastered">✓ Mastered</span>
                                        )}
                                        {status === "unattempted" && (
                                          <span style={{ color: "var(--muted)", fontSize: "13px" }}>—</span>
                                        )}
                                        {(status === "yellow" || status === "red") && nextReview && (
                                          <span
                                            className={
                                              "sched-badge" +
                                              (nextReview.isDueToday
                                                ? " is-due"
                                                : nextReview.isOverdue
                                                  ? " is-overdue"
                                                  : "")
                                            }
                                          >
                                            {nextReview.isDueToday
                                              ? "Due Today!"
                                              : nextReview.isOverdue
                                                ? `Overdue (${nextReview.dueDate})`
                                                : `Due ${nextReview.dueDate}`}
                                          </span>
                                        )}
                                      </td>

                                      <td className="c-notes">
                                        <button
                                          type="button"
                                          className={"notes-btn" + (hasNotes ? " has-notes" : "")}
                                          onClick={() =>
                                            setExpandedNotes((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                          }
                                          title={hasNotes ? "View/edit note" : "Add note"}
                                        >
                                          {hasNotes ? "Note ✓" : "+ Note"}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
