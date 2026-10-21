"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

type Option = { value: string; label: string };

/** A dropdown styled like the rest of the site: a button that opens a listbox, with arrow-key support. */
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }
  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(options[active].value);
    }
  }

  return (
    <div className="dl-select" ref={root} onKeyDown={onKey}>
      <button
        type="button"
        className={"dl-select-btn" + (value !== options[0].value ? " is-set" : "")}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
      >
        <span>{current.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="dl-select-list" role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={i === active ? "is-active" : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
            >
              <span>{o.label}</span>
              {o.value === value && <b aria-hidden="true">✓</b>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
        <Select
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={[{ value: "all", label: "All topics" }, ...domains.map((d) => ({ value: d, label: labels[d] ?? d }))]}
        />
        <Select
          label="Difficulty"
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "Any difficulty" },
            ...LEVELS.map((name, i) => ({ value: String(i + 1), label: name })),
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Any status" },
            { value: "todo", label: "Not solved" },
            { value: "solved", label: "Solved" },
          ]}
        />
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
