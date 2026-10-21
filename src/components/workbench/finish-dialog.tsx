"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { StoredReport } from "@/lib/debug-report-types";
import { getChat, recordEvent, updateChat } from "@/lib/workbench-store";

const MIN_EXPLANATION = 20;
const nowMs = () => Date.now();

/** Ends the round: asks for a short explanation, gets the review, and opens the report. */
export function FinishDialog({
  scenarioId,
  files,
  onClose,
}: {
  scenarioId: string;
  files: Record<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    box.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit() {
    if (explanation.trim().length < MIN_EXPLANATION || busy) return;
    setBusy(true);
    setError("");
    recordEvent(scenarioId, { at: nowMs(), type: "finish" });
    const chat = getChat(scenarioId);
    try {
      const res = await fetch("/api/debug/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          started: chat?.started ?? nowMs(),
          events: chat?.events ?? [],
          files,
          explanation: explanation.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.report) return setError(data?.error ?? "Could not get your review. Try again.");
      const stored: StoredReport = {
        at: nowMs(),
        source: data.source,
        note: data.note,
        report: data.report,
        course: data.course ?? [],
        explanation: explanation.trim(),
      };
      updateChat(scenarioId, (c) => ({ ...c, report: stored }));
      router.push(`/debug/${scenarioId}/report`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="wb-modal"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        className="wb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-finish-h"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id="wb-finish-h">Finish this round</h2>
        <p>
          In a sentence or two, say what was wrong and how your change fixes it. The review checks this
          against what really happened, then looks at how you worked.
        </p>
        <textarea
          ref={box}
          value={explanation}
          rows={5}
          maxLength={1500}
          aria-label="Your explanation of the cause and the fix"
          placeholder="For example: the loop stopped one window early because the range ended at n - k."
          disabled={busy}
          onChange={(e) => setExplanation(e.target.value)}
        />
        {error && (
          <p className="wb-error" role="alert">
            {error}
          </p>
        )}
        <div className="wb-dialog-actions">
          <button type="button" className="wb-btn" onClick={onClose} disabled={busy}>
            Keep working
          </button>
          <button
            type="submit"
            className="wb-btn is-primary"
            disabled={busy || explanation.trim().length < MIN_EXPLANATION}
          >
            {busy ? "Writing your review…" : "Get my review"}
          </button>
        </div>
        {explanation.trim().length < MIN_EXPLANATION && (
          <p className="wb-hint">Write a sentence or two first.</p>
        )}
      </form>
    </div>
  );
}
