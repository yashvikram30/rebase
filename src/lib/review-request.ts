import type { StoredReport } from "./debug-report-types";
import { getChat, MAX_HISTORY, recordEvent, updateChat } from "./workbench-store";

const inflight = new Set<string>();

/**
 * Asks the server to write the review for a finished round. It records progress in the chat store, so the report
 * page can show a loading state (or the error) while this runs, and it keeps running after the dialog that
 * started it is gone.
 */
export async function requestReview(scenarioId: string, files: Record<string, string>, explanation: string) {
  if (inflight.has(scenarioId)) return;
  inflight.add(scenarioId);
  const text = explanation.trim();
  const now = () => Date.now();
  if (!getChat(scenarioId)?.events.some((e) => e.type === "finish")) {
    recordEvent(scenarioId, { at: now(), type: "finish" });
  }
  updateChat(scenarioId, (c) => ({ ...c, review: { at: now(), explanation: text } }));
  const fail = (error: string) =>
    updateChat(scenarioId, (c) => ({
      ...c,
      review: { at: c.review?.at ?? now(), explanation: text, error },
    }));
  try {
    const chat = getChat(scenarioId);
    const res = await fetch("/api/debug/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId,
        started: chat?.started ?? now(),
        events: chat?.events ?? [],
        files,
        explanation: text,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.report) return fail(data?.error ?? "Could not get your review. Try again.");
    const stored: StoredReport = {
      at: now(),
      source: data.source,
      note: data.note,
      report: data.report,
      course: data.course ?? [],
      explanation: text,
      files,
      events: chat?.events ?? [],
      started: chat?.started ?? now(),
    };
    updateChat(scenarioId, ({ review: _done, ...c }) => {
      void _done;
      // A new review does not replace the last one: that one moves into the history.
      const history = c.report ? [c.report, ...(c.history ?? [])].slice(0, MAX_HISTORY) : c.history;
      return { ...c, report: stored, ...(history ? { history } : {}) };
    });
  } catch {
    fail("Could not reach the server. Check your connection and try again.");
  } finally {
    inflight.delete(scenarioId);
  }
}
