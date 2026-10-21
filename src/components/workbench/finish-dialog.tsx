"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { requestReview } from "@/lib/review-request";

const MIN_EXPLANATION = 20;

/** Ends the round: asks for a short explanation, then opens the report page while the review is written. */
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
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    box.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (explanation.trim().length < MIN_EXPLANATION) return;
    // The request keeps running in the background; the report page shows its progress.
    void requestReview(scenarioId, files, explanation);
    router.push(`/debug/${scenarioId}/report`);
  }

  return (
    <div
      className="wb-modal"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="wb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-finish-h"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
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
          onChange={(e) => setExplanation(e.target.value)}
        />
        <div className="wb-dialog-actions">
          <button type="button" className="wb-btn" onClick={onClose}>
            Keep working
          </button>
          <button
            type="submit"
            className="wb-btn is-primary"
            disabled={explanation.trim().length < MIN_EXPLANATION}
          >
            Get my review
          </button>
        </div>
        {explanation.trim().length < MIN_EXPLANATION && (
          <p className="wb-hint">Write a sentence or two first.</p>
        )}
      </form>
    </div>
  );
}
