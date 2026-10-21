import { describe, expect, it } from "vitest";
import { clampReply, LLM_LIMITS } from "./llm-limits";

describe("LLM_LIMITS", () => {
  it("lets the reviewer write more than the chat, but both are bounded", () => {
    expect(LLM_LIMITS.reviewTokens).toBeGreaterThan(LLM_LIMITS.chatTokens);
    expect(LLM_LIMITS.reviewChars).toBeGreaterThan(LLM_LIMITS.chatChars);
    for (const n of Object.values(LLM_LIMITS)) expect(Number.isInteger(n) && n > 0).toBe(true);
  });
});

describe("clampReply", () => {
  it("leaves a reply within the limit alone", () => {
    expect(clampReply("short", 100)).toEqual({ text: "short", cut: false });
  });

  it("cuts a long reply and says so", () => {
    const { text, cut } = clampReply("x".repeat(500), 100);
    expect(cut).toBe(true);
    expect(text.startsWith("x".repeat(100))).toBe(true);
    expect(text).toContain("cut off at the length limit");
  });

  it("marks a reply the model itself stopped for length", () => {
    const { text, cut } = clampReply("half an answ", 100, true);
    expect(cut).toBe(true);
    expect(text).toContain("cut off at the length limit");
  });
});
