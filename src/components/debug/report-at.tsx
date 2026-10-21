"use client";
import { useSearchParams } from "next/navigation";
import { ReportClient } from "./report-client";

type Props = Omit<React.ComponentProps<typeof ReportClient>, "at">;

/** Shows the newest review, or the one named by `?at=` (the time it was written) in the address. */
export function ReportAt(props: Props) {
  const raw = useSearchParams().get("at");
  const at = raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : undefined;
  return <ReportClient {...props} at={at} />;
}
