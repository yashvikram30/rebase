import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DebugList } from "@/components/debug/debug-list";
import { allScenarios, DOMAIN_LABEL } from "@/lib/debug";
import "../debug.css";

export const metadata: Metadata = {
  title: "Cases",
  description:
    "Practice the AI-enabled debugging interview: find the bug, review what an agent did, and learn what to do better.",
};

// The name of the failing test, e.g. test_goal_walled_off, shown as the case's headline.
const failingName = (test: string) => /def (test\w*)\(/.exec(test)?.[1] ?? "test";

const MODES: { name: string; text: string; state: string; href?: string }[] = [
  {
    name: "Debug in the workbench",
    text: "Fix the bug in an editor with a test runner and a terminal, like a real round.",
    state: "Ready",
  },
  {
    name: "Review an agent's session",
    text: "Read what an agent did, run its patch, and decide whether you would approve it.",
    state: "Ready",
  },
  {
    name: "Debug with an assistant",
    text: "The same workbench with a limited chat to an assistant. Open Assistant inside any case.",
    state: "Ready",
  },
  {
    name: "Random draw",
    text: "A case with its title and topic hidden until you finish, as in a real round.",
    state: "Ready",
    href: "/debug/random",
  },
];

export default function DebugPage() {
  const scenarios = allScenarios().map((s) => ({
    id: s.id,
    title: s.title,
    domain: s.domain,
    difficulty: s.difficulty,
    symptom: s.symptom,
    failing: failingName(s.failingTest),
    reviewable: !!s.transcript,
  }));
  return (
    <article className="dbg">
      <h1>Debug</h1>
      <p className="lead">
        Broken code and a failing test, like an AI-enabled interview round. Reproduce it, say what you think is
        wrong, make the smallest fix, and check you broke nothing else.
      </p>
      <Suspense fallback={<div aria-busy="true" />}>
        <DebugList scenarios={scenarios} labels={DOMAIN_LABEL} />
      </Suspense>
      <section className="dbg-modes" aria-labelledby="dbg-modes-h">
        <h2 id="dbg-modes-h">Ways to practice</h2>
        <dl>
          {MODES.map((m) => (
            <div key={m.name} className={m.state === "Ready" ? "is-ready" : undefined}>
              <dt>{m.href ? <Link href={m.href}>{m.name}</Link> : m.name}</dt>
              <dd>{m.text}</dd>
              <dd className="dbg-state">{m.state}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
