"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import bankJson from "@/data/striver-drill.json";
import {
  buildDeck,
  gradeChoices,
  KIND_LABEL,
  makeOptions,
  makePatternOptions,
  poolProblems,
  rng,
  streak,
  type DeckCard,
} from "@/lib/drill-deck";
import { getDrill, recordCard, useDrill } from "@/lib/drill-store";
import type { CardKind, DrillEntry, Rating } from "@/lib/drill-types";
import { toDateString } from "@/lib/striver-schedule";
import { getStriver, useStriver } from "@/lib/striver-store";
import type { StriverProblem } from "@/lib/striver-types";

const BANK = bankJson as unknown as Record<string, DrillEntry>;
const SIZES = [5, 10, 15] as const;

type Round = { deck: DeckCard[]; index: number; results: { card: DeckCard; rating: Rating }[]; n: number };

export function DrillClient({ problems }: { problems: StriverProblem[] }) {
  const striver = useStriver();
  const drill = useDrill();
  const [scope, setScope] = useState<"attempted" | "all">("attempted");
  const [size, setSize] = useState<number>(10);
  const [round, setRound] = useState<Round | null>(null);

  const byId = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);
  const todayStr = toDateString(new Date());
  const attempted = poolProblems({ bank: BANK, problems, statuses: striver.statuses, scope: "attempted" }).length;
  const covered = poolProblems({ bank: BANK, problems, statuses: striver.statuses, scope: "all" }).length;
  const poolSize = scope === "attempted" ? attempted : covered;

  function start(n: number) {
    const now = Date.now();
    const deck = buildDeck({
      bank: BANK,
      problems,
      statuses: getStriver().statuses,
      drill: getDrill(),
      scope,
      size,
      seed: `${toDateString(new Date(now))}:${n}:${scope}`,
      now,
    });
    setRound(deck.length ? { deck, index: 0, results: [], n } : null);
  }

  function answer(rating: Rating) {
    if (!round) return;
    const card = round.deck[round.index];
    recordCard(card.problemId, card.kind, rating);
    setRound({ ...round, index: round.index + 1, results: [...round.results, { card, rating }] });
  }

  const finished = round !== null && round.index >= round.deck.length;
  const current = round && !finished ? round.deck[round.index] : null;
  const problem = current ? byId.get(current.problemId) : undefined;

  return (
    <div className="striver-page drill-page">
      <header className="striver-header">
        <span className="striver-eyebrow">DSA practice</span>
        <h1>Daily drill</h1>
        <p className="striver-lead">
          Short recall cards for problems you have already met. No code to write: say the idea, name the pattern, pick
          the complexity. Open it any day.
        </p>
      </header>

      {!round && (
        <section className="drill-card" aria-label="Start a drill">
          <div className="drill-stats">
            <Stat n={drill.days[todayStr] ?? 0} label="cards today" />
            <Stat n={streak(drill.days, todayStr)} label="day streak" />
            <Stat n={Object.keys(drill.cards).length} label="cards seen" />
          </div>

          <div className="drill-row">
            <span className="drill-label">Draw from</span>
            <div className="drill-chips" role="group" aria-label="Where cards come from">
              <Chip on={scope === "attempted"} onClick={() => setScope("attempted")}>
                Problems I have attempted ({attempted})
              </Chip>
              <Chip on={scope === "all"} onClick={() => setScope("all")}>
                Whole sheet ({covered})
              </Chip>
            </div>
          </div>
          <div className="drill-row">
            <span className="drill-label">Cards</span>
            <div className="drill-chips" role="group" aria-label="Deck size">
              {SIZES.map((n) => (
                <Chip key={n} on={size === n} onClick={() => setSize(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          {poolSize === 0 ? (
            <p className="drill-empty" role="status">
              Nothing to draw from yet. Mark a few problems green, yellow or red on the{" "}
              <Link href="/striver">sheet</Link>, or switch to the whole sheet.
            </p>
          ) : (
            <p className="drill-hint">
              Weaker problems and cards you missed come up more often. Each deck has at most two cards per problem.
            </p>
          )}
          <button type="button" className="drill-primary" disabled={poolSize === 0} onClick={() => start(1)}>
            Start drill
          </button>
        </section>
      )}

      {current && problem && round && (
        <section className="drill-card" aria-label="Drill card">
          <div className="drill-progress" role="progressbar" aria-valuemin={0} aria-valuemax={round.deck.length} aria-valuenow={round.index}>
            <span style={{ width: `${(round.index / round.deck.length) * 100}%` }} />
          </div>
          <p className="drill-count">
            Card {round.index + 1} of {round.deck.length}
          </p>
          <CardView
            key={`${round.n}:${round.index}`}
            problem={problem}
            kind={current.kind}
            entry={BANK[problem.id]}
            notes={striver.statuses[problem.id]?.notes}
            onDone={answer}
          />
        </section>
      )}

      {finished && round && (
        <Summary
          round={round}
          byId={byId}
          onAgain={() => start(round.n + 1)}
          onHome={() => setRound(null)}
        />
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="drill-stat">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={"drill-chip" + (on ? " is-on" : "")} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

const PROMPT: Record<CardKind, string> = {
  intuition: "How would you solve it, and why does that work? Say it in a sentence or two.",
  brute: "What is the obvious brute-force approach, and why is it not good enough?",
  pattern: "Which technique fits this problem best?",
  complexity: "What are the time and space complexity of the optimal solution?",
  pitfall: "What edge case or mistake most often breaks a solution?",
};

function CardView({
  problem,
  kind,
  entry,
  notes,
  onDone,
}: {
  problem: StriverProblem;
  kind: CardKind;
  entry: DrillEntry;
  notes?: string;
  onDone: (r: Rating) => void;
}) {
  return (
    <div className="drill-body">
      <div className="drill-meta">
        <span className="drill-kind">{KIND_LABEL[kind]}</span>
        <span className="drill-topic">
          {problem.topic} › {problem.subtopic}
        </span>
      </div>
      <h2 className="drill-title">{problem.label}</h2>
      <p className="drill-prompt">{PROMPT[kind]}</p>
      {kind === "pattern" && <PatternCard problem={problem} entry={entry} onDone={onDone} />}
      {kind === "complexity" && <ComplexityCard problem={problem} entry={entry} onDone={onDone} />}
      {(kind === "intuition" || kind === "brute" || kind === "pitfall") && (
        <WrittenCard
          answer={kind === "intuition" ? entry.idea : kind === "brute" ? entry.brute : entry.pitfall}
          notes={kind === "intuition" ? notes : undefined}
          onDone={onDone}
        />
      )}
      {problem.leetcodeLink && (
        <a className="drill-link" href={problem.leetcodeLink} target="_blank" rel="noreferrer">
          Open the problem
        </a>
      )}
    </div>
  );
}

/** Type an answer (kept only on screen), reveal the reference, then say how it went. */
function WrittenCard({ answer, notes, onDone }: { answer: string; notes?: string; onDone: (r: Rating) => void }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <>
      <textarea
        className="drill-text"
        rows={4}
        placeholder="Write it out before you look. Writing is what makes it stick."
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={shown}
        aria-label="Your answer"
      />
      {!shown ? (
        <button type="button" className="drill-primary" onClick={() => setShown(true)}>
          Show answer
        </button>
      ) : (
        <>
          <div className="drill-reveal">
            <span className="drill-reveal-label">Reference</span>
            <p>{answer}</p>
            {notes && (
              <>
                <span className="drill-reveal-label">Your notes</span>
                <p className="drill-notes">{notes}</p>
              </>
            )}
          </div>
          <div className="drill-rate" role="group" aria-label="How did it go?">
            <button type="button" className="striver-answer is-red" onClick={() => onDone(0)}>
              Missed it
            </button>
            <button type="button" className="striver-answer is-yellow" onClick={() => onDone(1)}>
              Partly
            </button>
            <button type="button" className="striver-answer is-green" onClick={() => onDone(2)}>
              Got it
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Options({
  options,
  picked,
  correct,
  checked,
  onPick,
  label,
}: {
  options: string[];
  picked: string | null;
  correct: string;
  checked: boolean;
  onPick: (o: string) => void;
  label: string;
}) {
  return (
    <div className="drill-options" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const state = !checked ? (picked === o ? " is-picked" : "") : o === correct ? " is-right" : picked === o ? " is-wrong" : "";
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={picked === o}
            disabled={checked}
            className={"drill-option" + state}
            onClick={() => onPick(o)}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function PatternCard({ problem, entry, onDone }: { problem: StriverProblem; entry: DrillEntry; onDone: (r: Rating) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useMemo(() => {
    const sameTopic = Object.values(BANK)
      .filter((e) => e.id !== problem.id && e.pattern !== entry.pattern)
      .map((e) => e.pattern);
    return makePatternOptions(entry.pattern, sameTopic, rng(`p:${problem.id}`));
  }, [problem.id, entry.pattern]);
  const checked = picked !== null;
  return (
    <>
      <Options options={options} picked={picked} correct={entry.pattern} checked={checked} onPick={setPicked} label="Pattern" />
      {checked && (
        <>
          <div className="drill-reveal">
            <span className="drill-reveal-label">{picked === entry.pattern ? "Right" : "The pattern is " + entry.pattern}</span>
            <p>{entry.idea}</p>
          </div>
          <button type="button" className="drill-primary" onClick={() => onDone(picked === entry.pattern ? 2 : 0)}>
            Next
          </button>
        </>
      )}
    </>
  );
}

function ComplexityCard({ problem, entry, onDone }: { problem: StriverProblem; entry: DrillEntry; onDone: (r: Rating) => void }) {
  const [time, setTime] = useState<string | null>(null);
  const [space, setSpace] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const { timeOpts, spaceOpts } = useMemo(() => {
    const others = Object.values(BANK).filter((e) => e.id !== problem.id);
    return {
      timeOpts: makeOptions(entry.time, others.map((e) => e.time), rng(`t:${problem.id}`)),
      spaceOpts: makeOptions(entry.space, others.map((e) => e.space), rng(`s:${problem.id}`)),
    };
  }, [problem.id, entry.time, entry.space]);
  const right = (time === entry.time ? 1 : 0) + (space === entry.space ? 1 : 0);
  return (
    <>
      <span className="drill-sub">Time</span>
      <Options options={timeOpts} picked={time} correct={entry.time} checked={checked} onPick={setTime} label="Time complexity" />
      <span className="drill-sub">Space</span>
      <Options options={spaceOpts} picked={space} correct={entry.space} checked={checked} onPick={setSpace} label="Space complexity" />
      {!checked ? (
        <button type="button" className="drill-primary" disabled={!time || !space} onClick={() => setChecked(true)}>
          Check
        </button>
      ) : (
        <>
          <div className="drill-reveal">
            <span className="drill-reveal-label">
              {right === 2 ? "Both right" : `Time ${entry.time}, space ${entry.space}`}
            </span>
            <p>{entry.whyComplexity}</p>
          </div>
          <button type="button" className="drill-primary" onClick={() => onDone(gradeChoices(right, 2))}>
            Next
          </button>
        </>
      )}
    </>
  );
}

function Summary({
  round,
  byId,
  onAgain,
  onHome,
}: {
  round: Round;
  byId: Map<number, StriverProblem>;
  onAgain: () => void;
  onHome: () => void;
}) {
  const count = (r: Rating) => round.results.filter((x) => x.rating === r).length;
  const missed = [...new Set(round.results.filter((x) => x.rating === 0).map((x) => x.card.problemId))];
  return (
    <section className="drill-card" aria-label="Round complete">
      <h2 className="drill-title">Round complete</h2>
      <div className="drill-stats">
        <Stat n={count(2)} label="got it" />
        <Stat n={count(1)} label="partly" />
        <Stat n={count(0)} label="missed" />
      </div>
      {missed.length > 0 ? (
        <>
          <p className="drill-hint">Worth another look. These will come up again sooner.</p>
          <ul className="drill-missed">
            {missed.map((id) => {
              const p = byId.get(id);
              return p ? (
                <li key={id}>
                  {p.leetcodeLink ? (
                    <a href={p.leetcodeLink} target="_blank" rel="noreferrer">
                      {p.label}
                    </a>
                  ) : (
                    p.label
                  )}
                </li>
              ) : null;
            })}
          </ul>
        </>
      ) : (
        <p className="drill-hint">Nothing missed this round.</p>
      )}
      <div className="drill-rate">
        <button type="button" className="drill-primary" onClick={onAgain}>
          Another round
        </button>
        <button type="button" className="drill-secondary" onClick={onHome}>
          Back
        </button>
        <Link className="drill-secondary" href="/striver">
          Sheet
        </Link>
      </div>
    </section>
  );
}
