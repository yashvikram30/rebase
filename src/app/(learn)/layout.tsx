import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurriculum } from "@/lib/curriculum";
import { buildNav, buildSearch } from "@/lib/nav-model";
import "./revise.css";

export const metadata: Metadata = {
  title: { default: "Rebase Learn: learn how computers really work", template: "%s · Rebase Learn" },
  description:
    "Rebase Learn is a 16-week study plan: architecture, operating systems, networking, databases, distributed systems, software engineering, machine learning, generative AI and RAG. Start on any day.",
};

export default async function LearnLayout({ children }: LayoutProps<"/">) {
  const curriculum = await getCurriculum();
  return (
    <AppShell phases={buildNav(curriculum)} search={buildSearch(curriculum)}>
      {children}
    </AppShell>
  );
}
