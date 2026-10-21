import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReviseClient } from "@/components/revise-client";
import { QUESTIONS } from "@/data/revision";
import { getCurriculum } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Revise",
  description:
    "Pick the weeks to revise and get a mixed practice set: multiple choice, fill in the blanks, code snippets, flashcards, ordering and matching.",
};

export default async function RevisePage() {
  const c = await getCurriculum();
  const weeks = c.weeks.map((w) => ({
    number: w.number,
    title: w.title,
    phase: w.phase,
    days: w.days.map((d) => d.id),
  }));
  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/learn">Learn</Link>
        <i>/</i>
        <span>Revise</span>
      </nav>
      <h1>Revise</h1>
      <p className="lead">
        Choose the weeks you want to go back over and get a shuffled practice set drawn from all of them:{" "}
        {QUESTIONS.length} questions covering the main track, the DSA hour and the engineering slot. Every
        selected week gets an equal share, and questions you have not seen or got wrong come first.
      </p>
      <Suspense fallback={<div aria-busy="true" />}>
        <ReviseClient weeks={weeks} phases={c.phases.map((p) => ({ slug: p.slug, name: p.name }))} />
      </Suspense>
    </article>
  );
}
