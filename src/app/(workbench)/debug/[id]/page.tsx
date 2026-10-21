import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench/workbench";
import { allScenarios, getScenario, toWorkbench } from "@/lib/debug";

export function generateStaticParams() {
  return allScenarios().map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/debug/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = getScenario(id);
  return { title: s ? `Workbench: ${s.title}` : "Not found" };
}

export default async function WorkbenchPage({ params }: PageProps<"/debug/[id]">) {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();
  return <Workbench scenario={toWorkbench(scenario)} />;
}
