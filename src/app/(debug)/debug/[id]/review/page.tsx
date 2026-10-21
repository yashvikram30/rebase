import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewClient } from "@/components/debug/review-client";
import { allScenarios, getScenario, toPublic } from "@/lib/debug";
import "../../../debug.css";

export function generateStaticParams() {
  return allScenarios()
    .filter((s) => s.transcript)
    .map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/debug/[id]/review">): Promise<Metadata> {
  const { id } = await params;
  // The title names the symptom, not the cause.
  return { title: getScenario(id) ? "Review an agent session" : "Not found" };
}

export default async function ReviewPage({ params }: PageProps<"/debug/[id]/review">) {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario?.transcript) notFound();
  return (
    <article className="dbg">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/debug">Cases</Link>
        <i>/</i>
        <span>Review</span>
      </nav>
      <h1>{scenario.title}</h1>
      <p className="lead">
        An agent was asked to fix this. Follow what it did, run its patch yourself, then approve it or ask for
        changes.
      </p>
      <ReviewClient scenario={toPublic(scenario)} />
    </article>
  );
}
