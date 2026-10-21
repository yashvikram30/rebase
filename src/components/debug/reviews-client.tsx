"use client";
import Link from "next/link";
import { allReports, useChats } from "@/lib/workbench-store";

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Every review written for one case, newest first. Each opens the full report. */
export function ReviewsClient({ id }: { id: string }) {
  const chat = useChats()[id];
  const reports = allReports(chat);

  if (reports.length === 0) {
    return (
      <>
        <p className="lead">There is no review for this case yet.</p>
        <p>
          <Link className="dbg-btn" href={`/debug/${id}`}>
            Open the workbench
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="lead">
        {reports.length === 1 ? "One review" : `${reports.length} reviews`} for this case. Pick one to open
        it.
      </p>
      <ol className="dbg-reviews">
        {reports.map((r, i) => (
          <li key={r.at}>
            <Link href={i === 0 ? `/debug/${id}/report` : `/debug/${id}/report?at=${r.at}`}>
              <span className="dbg-reviews-when">
                <time dateTime={new Date(r.at).toISOString()}>{when(r.at)}</time>
                {i === 0 && <b>Latest</b>}
                {r.source === "basic" && <small>Basic report</small>}
              </span>
              <span className="dbg-reviews-sum">{r.report.summary}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="dbg-report-actions">
        <Link className="dbg-btn" href="/debug">
          All cases
        </Link>
      </p>
    </>
  );
}
