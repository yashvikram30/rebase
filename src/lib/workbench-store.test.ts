import { describe, expect, it } from "vitest";
import {
  allReports,
  DEFAULT_LAYOUT,
  getChat,
  normalizeChats,
  normalizeDrafts,
  normalizeLayout,
  recordEvent,
  resetChatLog,
  restartTimeline,
  updateChat,
} from "./workbench-store";

describe("normalizeDrafts", () => {
  it("keeps a well-formed draft", () => {
    const d = { a: { files: { "x.py": "print(1)" }, started: 1, updated: 2 } };
    expect(normalizeDrafts(d)).toEqual(d);
  });

  it("drops malformed entries and non-string files", () => {
    const out = normalizeDrafts({
      bad: { files: "nope", started: 1, updated: 2 },
      worse: null,
      ok: { files: { "x.py": "a", "y.py": 5 }, started: 1, updated: 2 },
    });
    expect(Object.keys(out)).toEqual(["ok"]);
    expect(out.ok.files).toEqual({ "x.py": "a" });
  });

  it("drops a draft that is too large to sync", () => {
    const big = { files: { "x.py": "x".repeat(250_000) }, started: 1, updated: 2 };
    expect(normalizeDrafts({ big })).toEqual({});
  });

  it("keeps only the newest drafts", () => {
    const many = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`c${i}`, { files: {}, started: 1, updated: i }]),
    );
    const out = normalizeDrafts(many);
    expect(Object.keys(out)).toHaveLength(50);
    expect(out.c59).toBeDefined();
    expect(out.c0).toBeUndefined();
  });
});

describe("normalizeLayout", () => {
  it("falls back to the defaults", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout({ explorer: "wide" })).toEqual(DEFAULT_LAYOUT);
  });

  it("clamps sizes to what the layout can show", () => {
    expect(normalizeLayout({ explorer: 5000, panel: 1 })).toEqual({ explorer: 480, panel: 120, chat: 340 });
  });
});

describe("normalizeChats", () => {
  const chat = {
    started: 1,
    round: { token: "t", exp: 5, cap: 12, used: 2 },
    messages: [{ role: "user", content: "hi", at: 2 }],
    events: [{ at: 3, type: "open" }],
  };

  it("keeps a well-formed chat", () => {
    expect(normalizeChats({ a: chat })).toEqual({ a: chat });
  });

  it("drops malformed chats, messages and a bad round", () => {
    const out = normalizeChats({
      bad: { started: "x" },
      a: {
        ...chat,
        round: { token: 5 },
        messages: [{ role: "system", content: "x", at: 1 }, ...chat.messages],
      },
    });
    expect(Object.keys(out)).toEqual(["a"]);
    expect(out.a.round).toBeUndefined();
    expect(out.a.messages).toHaveLength(1);
  });

  it("trims long messages and keeps only the newest", () => {
    const messages = Array.from({ length: 80 }, (_, i) => ({
      role: "user",
      content: "x".repeat(5000),
      at: i,
    }));
    const out = normalizeChats({ a: { ...chat, messages } });
    expect(out.a.messages).toHaveLength(60);
    expect(out.a.messages[0].content).toHaveLength(4000);
  });
});

describe("resetChatLog", () => {
  it("empties the messages but keeps the round, the timeline and the report data", () => {
    const round = { token: "t", exp: 9_999_999_999_999, cap: 12, used: 3 };
    updateChat("case-a", (c) => ({
      ...c,
      round,
      messages: [
        { role: "user", content: "hint?", at: 1 },
        { role: "assistant", content: "look at the test", at: 2 },
      ],
    }));
    recordEvent("case-a", { at: 1, type: "chat-user", phase: "explore", text: "hint?" });

    resetChatLog("case-a");

    const chat = getChat("case-a");
    expect(chat?.messages).toEqual([]);
    expect(chat?.round).toEqual(round);
    expect(chat?.events.some((e) => e.type === "chat-user")).toBe(true);
  });

  it("does nothing for a case with no chat", () => {
    resetChatLog("never-opened");
    expect(getChat("never-opened")).toBeUndefined();
  });
});

describe("restartTimeline", () => {
  it("drops earlier events and starts again from an open entry, keeping the reports", () => {
    const rep = { at: 5, source: "basic", report: { summary: "s", dimensions: {} }, course: [] };
    updateChat("case-b", (c) => ({ ...c, started: 1, report: rep as never }));
    recordEvent("case-b", { at: 2, type: "chat-user", phase: "explore", text: "old question" });

    restartTimeline("case-b");

    const chat = getChat("case-b");
    expect(chat?.events).toHaveLength(1);
    expect(chat?.events[0].type).toBe("open");
    expect(chat?.started).toBe(chat?.events[0].at);
    expect(chat?.started).toBeGreaterThan(1);
    expect(chat?.report).toBe(rep);
  });
});

describe("normalizeChats review state", () => {
  const base = { started: 1, messages: [], events: [] };

  it("keeps a pending review and its error", () => {
    const out = normalizeChats({
      a: { ...base, review: { at: 5, explanation: "why", error: "nope" } },
      b: { ...base, review: { at: 6, explanation: "why" } },
    });
    expect(out.a.review).toEqual({ at: 5, explanation: "why", error: "nope" });
    expect(out.b.review).toEqual({ at: 6, explanation: "why" });
  });

  it("drops a malformed review", () => {
    expect(normalizeChats({ a: { ...base, review: { at: "x", explanation: 3 } } }).a.review).toBeUndefined();
  });
});

describe("review history", () => {
  const base = { started: 1, messages: [], events: [] };
  const rep = (at: number) => ({
    at,
    source: "mentor",
    report: { summary: `s${at}`, dimensions: {}, strengths: [], improvements: [], aiUsage: {}, revisit: [] },
    course: [],
    explanation: "why",
  });

  it("keeps older reports, drops malformed ones, and lists newest first", () => {
    const out = normalizeChats({ a: { ...base, report: rep(3), history: [rep(2), { at: 1 }, rep(0)] } });
    expect(out.a.history?.map((r) => r.at)).toEqual([2, 0]);
    expect(allReports(out.a).map((r) => r.at)).toEqual([3, 2, 0]);
  });

  it("lists nothing for a case without a report", () => {
    expect(allReports(undefined)).toEqual([]);
  });
});
