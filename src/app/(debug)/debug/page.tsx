import type { Metadata } from "next";
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
    </article>
  );
}
