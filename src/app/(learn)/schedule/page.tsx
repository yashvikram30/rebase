import type { Metadata } from "next";
import { ScheduleTable } from "@/components/schedule-table";
import { getCurriculum } from "@/lib/curriculum";
import { planDays } from "@/lib/plan-days";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const days = planDays(await getCurriculum());
  return (
    <article>
      <h1>Schedule</h1>
      <p className="lead">
        All {days.length} days with their dates. Falling behind? Reschedule from today and nothing you
        finished moves.
      </p>
      <ScheduleTable days={days} />
    </article>
  );
}
