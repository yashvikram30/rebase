import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesApp } from "@/components/notes-app";
import { getCurriculum } from "@/lib/curriculum";
import { allDays, dayHref } from "@/lib/curriculum-types";

export const metadata: Metadata = {
  title: "Notes",
  description: "Your own notes, linked to each other and to the days of the plan.",
};

export default async function NotesPage() {
  const days = allDays(await getCurriculum()).map((d) => ({
    id: d.id,
    week: d.weekNumber,
    day: d.numberInWeek,
    title: d.title,
    href: dayHref(d.weekNumber, d.numberInWeek),
  }));
  return (
    <Suspense fallback={<div className="brain" aria-busy="true" />}>
      <NotesApp days={days} />
    </Suspense>
  );
}
