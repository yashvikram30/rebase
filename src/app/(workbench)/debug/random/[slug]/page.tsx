import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench/workbench";
import { allScenarios, toWorkbench } from "@/lib/debug";
import { blindSlug, scenarioFromSlug } from "@/lib/debug-random";

export function generateStaticParams() {
  return allScenarios().map((s) => ({ slug: blindSlug(s.id) }));
}

// Neither the tab title nor the page says what the case is about. That is revealed once you finish.
export const metadata: Metadata = { title: "Random case" };

export default async function RandomCasePage({ params }: PageProps<"/debug/random/[slug]">) {
  const { slug } = await params;
  const scenario = scenarioFromSlug(slug);
  if (!scenario) notFound();
  return <Workbench scenario={{ ...toWorkbench(scenario), title: "Random case" }} />;
}
