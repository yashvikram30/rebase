import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportClient } from "@/components/debug/report-client";
import { allScenarios, DOMAIN_LABEL, getScenario } from "@/lib/debug";
import "../../../debug.css";

export function generateStaticParams() {
  return allScenarios().map((s) => ({ id: s.id }));
}

export const metadata: Metadata = { title: "Your review" };

export default async function ReportPage({ params }: PageProps<"/debug/[id]/report">) {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();
  return (
    <article className="dbg">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/debug">Cases</Link>
        <i>/</i>
        <span>Your review</span>
      </nav>
      <h1>{scenario.title}</h1>
      <ReportClient
        id={scenario.id}
        original={scenario.files}
        topic={{ domain: DOMAIN_LABEL[scenario.domain], concept: scenario.concept }}
      />
    </article>
  );
}
