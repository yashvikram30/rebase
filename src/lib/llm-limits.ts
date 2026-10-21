/**
 * How much the model may write, fixed on the server. The page cannot raise these, and they are not settings.
 * The token cap is sent to the model; the character cap is a second guard for a gateway that ignores it.
 */
export const LLM_LIMITS = {
  /**
   * One reply in the chat: a few sentences, or a short patch. The gateway applies this to the visible answer;
   * the model's own thinking is not strictly bounded by it (one reply used 1,268 tokens against a cap of 1,000).
   * So `chatChars` is the real limit on what the candidate sees, and the daily token budget, which counts all
   * tokens used, is the real limit on spend.
   */
  chatTokens: 1000,
  chatChars: 4000,
  /** The overall reviewer's report after a round: longer, but still bounded. */
  reviewTokens: 4000,
  reviewChars: 16000,
} as const;

const CUT_NOTE = "\n\n[The reply was cut off at the length limit.]";

/** Cuts a reply to `maxChars` and says so, so a half-finished answer is never mistaken for a whole one. */
export function clampReply(
  text: string,
  maxChars: number,
  truncated = false,
): { text: string; cut: boolean } {
  if (text.length > maxChars) return { text: text.slice(0, maxChars).trimEnd() + CUT_NOTE, cut: true };
  return { text: truncated ? text.trimEnd() + CUT_NOTE : text, cut: truncated };
}
