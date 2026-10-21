import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewsClient } from "@/components/debug/reviews-client";
import { allScenarios, getScenario } from "@/lib/debug";
import "../../../debug.css";

export function generateStaticParams() {
  return allScenarios().map((s) => ({ id: s.id }));
}

export const metadata: Metadata = { title: "Your reviews" };

export default async function ReviewsPage({ params }: PageProps<"/debug/[id]/reviews">) {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();
  return (
    <article className="dbg">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/debug">Cases</Link>
        <i>/</i>
        <span>Your reviews</span>
      </nav>
      <h1>{scenario.title}</h1>
      <ReviewsClient id={scenario.id} />
    </article>
  );
}
