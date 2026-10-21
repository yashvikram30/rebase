"use client";
import Link from "next/link";
import { useState } from "react";
import { useDebug } from "@/lib/debug-store";
import { useChats } from "@/lib/workbench-store";

type Item = {
  id: string;
  title: string;
  domain: string;
  difficulty: number;
  symptom: string;
  failing: string;
  reviewable: boolean;
};

const LEVELS = ["Easy", "Medium", "Hard"] as const;

export function DebugList({ scenarios, labels }: { scenarios: Item[]; labels: Record<string, string> }) {
  const { reviews, solves } = useDebug();
  const chats = useChats();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");

  const domains = [...new Set(scenarios.map((s) => s.domain))];
  const q = query.trim().toLowerCase();
  const shown = scenarios.filter(
    (s) =>
      (topic === "all" || s.domain === topic) &&
      (level === "all" || s.difficulty === Number(level)) &&
      (status === "all" || (status === "solved") === !!solves[s.id]) &&
      (!q || s.title.toLowerCase().includes(q) || s.symptom.toLowerCase().includes(q)),
  );
  const next = scenarios.find((s) => !solves[s.id]);
  const solved = scenarios.filter((s) => solves[s.id]).length;
  const filtered = topic !== "all" || level !== "all" || status !== "all" || q !== "";

  return (
    <section className="dl" aria-label="Cases">
      <div className="dl-stats">
        <div className="dl-total">
          <b>{solved}</b>
          <span>/ {scenarios.length} solved</span>
        </div>
        {LEVELS.map((name, i) => {
          const all = scenarios.filter((s) => s.difficulty === i + 1);
          const done = all.filter((s) => solves[s.id]).length;
          return (
            <div key={name} className={"dl-stat lv" + (i + 1)}>
              <span>{name}</span>
              <b>
                {done}
                <small>/{all.length}</small>
              </b>
              <i style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
            </div>
          );
        })}
      </div>

      <div className="dl-bar">
        <input
          type="search"
          placeholder="Search cases"
          aria-label="Search cases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">All topics</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {labels[d] ?? d}
            </option>
          ))}
        </select>
        <select aria-label="Difficulty" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">Any difficulty</option>
          {LEVELS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Any status</option>
          <option value="todo">Not solved</option>
          <option value="solved">Solved</option>
        </select>
        <span className="dl-gap" />
        {next && (
          <Link className="dl-btn primary" href={`/debug/${next.id}`}>
            Next case
          </Link>
        )}
        <Link className="dl-btn" href="/debug/random">
          Random
        </Link>
      </div>

      <table className="dl-table">
        <thead>
          <tr>
            <th className="c-status">Status</th>
            <th>Title</th>
            <th className="c-topic">Topic</th>
            <th className="c-level">Difficulty</th>
            <th className="c-act">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => {
            const done = solves[s.id];
            const review = reviews[s.id];
            return (
              <tr key={s.id}>
                <td className="c-status">
                  <span
                    className={"dl-dot" + (done ? " is-done" : "")}
                    role="img"
                    aria-label={done ? "Solved" : "Not solved yet"}
                  >
                    {done ? "✓" : ""}
                  </span>
                </td>
                <td className="c-title">
                  <Link href={`/debug/${s.id}`} title={s.symptom}>
                    <em>{scenarios.indexOf(s) + 1}.</em> {s.title}
                  </Link>
                  <small>{labels[s.domain] ?? s.domain}</small>
                </td>
                <td className="c-topic">{labels[s.domain] ?? s.domain}</td>
                <td className={"c-level lv" + s.difficulty}>{LEVELS[s.difficulty - 1]}</td>
                <td className="c-act">
                  {s.reviewable && <Link href={`/debug/${s.id}/review`}>Review agent</Link>}
                  {chats[s.id]?.report && <Link href={`/debug/${s.id}/report`}>Your review</Link>}
                  {review && <span>{review.correct ? "Right call" : "Missed it"}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown.length === 0 && (
        <p className="dl-empty">
          No cases match.{" "}
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTopic("all");
                setLevel("all");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          )}
        </p>
      )}
    </section>
  );
}
