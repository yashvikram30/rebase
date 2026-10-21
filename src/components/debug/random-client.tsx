"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDebug } from "@/lib/debug-store";
import { pickWeighted, type Candidate } from "@/lib/random-pick";

const LEVELS = [
  { value: 0, label: "Any difficulty" },
  { value: 1, label: "Easier" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Harder" },
] as const;

/** Read outside the component so the draw can use it from an event handler. */
const random = () => Math.random();

export function RandomClient({ cases }: { cases: Candidate[] }) {
  const router = useRouter();
  const { solves } = useDebug();
  const [level, setLevel] = useState<number>(0);
  const [last, setLast] = useState<string | null>(null);

  const pool = level === 0 ? cases : cases.filter((c) => c.difficulty === level);
  const unsolved = pool.filter((c) => !solves[c.id]).length;

  function draw() {
    const next = pickWeighted(pool, new Set(Object.keys(solves)), last, random);
    if (!next) return;
    setLast(next.id);
    router.push(`/debug/random/${next.slug}`);
  }

  return (
    <div className="dbg-random">
      <div className="dbg-filter" role="group" aria-label="Difficulty">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            aria-pressed={level === l.value}
            onClick={() => setLevel(l.value)}
          >
            {l.label}
            <span>{l.value === 0 ? cases.length : cases.filter((c) => c.difficulty === l.value).length}</span>
          </button>
        ))}
      </div>
      <p className="dbg-muted">
        {pool.length === 0
          ? "No cases at this difficulty yet."
          : unsolved === 0
            ? "You have solved all of these. They can still be drawn, less often."
            : `${unsolved} of ${pool.length} not solved yet. Those are drawn four times as often.`}
      </p>
      <button type="button" className="dbg-btn" onClick={draw} disabled={pool.length === 0}>
        Draw a case
      </button>
    </div>
  );
}
