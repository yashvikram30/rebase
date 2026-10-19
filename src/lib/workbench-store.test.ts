import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, normalizeChats, normalizeDrafts, normalizeLayout } from "./workbench-store";

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
