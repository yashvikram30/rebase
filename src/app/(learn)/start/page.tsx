import type { Metadata } from "next";
import { StartForm } from "@/components/start-form";
import { getCurriculum } from "@/lib/curriculum";
import { allDays } from "@/lib/curriculum-types";

export const metadata: Metadata = { title: "Start your plan" };

export default async function StartPage() {
  const total = allDays(await getCurriculum()).length;
  return (
    <article>
      <h1>Pick your start date</h1>
      <p className="lead">
        The plan runs from whichever day you choose. Dates are worked out from the study days you select.
      </p>
      <StartForm totalDays={total} />
    </article>
  );
}
