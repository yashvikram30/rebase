import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = Record<string, number>;
const rounds = new Map<string, Doc>();
const hits = new Map<string, Doc>();
const days = new Map<string, Doc>();

// Just enough of a collection to exercise the logic, including Mongo's duplicate-key error on a full upsert.
const dup = () => Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
const rounds_ = {
  findOneAndUpdate: async (
    f: { _id: string; messages: { $lt: number } },
    u: { $inc: { messages: number } },
  ) => {
    const cur = rounds.get(f._id);
    if (cur) {
      if (!(cur.messages < f.messages.$lt)) throw dup();
      cur.messages += u.$inc.messages;
      return { ...cur };
    }
    rounds.set(f._id, { messages: u.$inc.messages });
    return { messages: u.$inc.messages };
  },
  updateOne: async (f: { _id: string; messages: { $gt: number } }, u: { $inc: { messages: number } }) => {
    const cur = rounds.get(f._id);
    if (cur && cur.messages > f.messages.$gt) cur.messages += u.$inc.messages;
  },
};
const hits_ = {
  findOneAndUpdate: async (f: { _id: string }, u: { $inc: { n: number } }) => {
    const cur = hits.get(f._id) ?? { n: 0 };
    cur.n += u.$inc.n;
    hits.set(f._id, cur);
    return { ...cur };
  },
};
const days_ = {
  findOne: async (f: { _id: string }) => days.get(f._id) ?? null,
  updateOne: async (f: { _id: string }, u: { $inc: { tokens: number } }) => {
    const cur = days.get(f._id) ?? { tokens: 0 };
    cur.tokens += u.$inc.tokens;
    days.set(f._id, cur);
  },
};
vi.mock("./mongo", () => ({
  agentRounds: async () => rounds_,
  agentHits: async () => hits_,
  agentDays: async () => days_,
}));

import { addTokens, clientIp, refundMessage, reserveMessage, tokensToday, withinLimit } from "./agent-limits";

beforeEach(() => {
  rounds.clear();
  hits.clear();
  days.clear();
});

describe("reserveMessage", () => {
  it("counts messages up to the cap, then refuses", async () => {
    expect(await reserveMessage("r1", 3, 0)).toBe(1);
    expect(await reserveMessage("r1", 3, 0)).toBe(2);
    expect(await reserveMessage("r1", 3, 0)).toBe(3);
    expect(await reserveMessage("r1", 3, 0)).toBeNull();
    expect(await reserveMessage("r1", 3, 0)).toBeNull();
  });

  it("keeps rounds separate", async () => {
    await reserveMessage("a", 1, 0);
    expect(await reserveMessage("a", 1, 0)).toBeNull();
    expect(await reserveMessage("b", 1, 0)).toBe(1);
  });

  it("gives a message back on refund, but never goes below zero", async () => {
    await reserveMessage("r1", 1, 0);
    await refundMessage("r1");
    expect(await reserveMessage("r1", 1, 0)).toBe(1);
    await refundMessage("r1");
    await refundMessage("r1");
    expect(rounds.get("r1")!.messages).toBe(0);
  });

  it("does not hide other database errors", async () => {
    const boom = vi.spyOn(rounds_, "findOneAndUpdate").mockRejectedValueOnce(new Error("network"));
    await expect(reserveMessage("r1", 3, 0)).rejects.toThrow("network");
    boom.mockRestore();
  });
});

describe("withinLimit", () => {
  it("allows up to the max in a window, then refuses", async () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(await withinLimit("ip", 60_000, 3, now)).toBe(true);
    expect(await withinLimit("ip", 60_000, 3, now)).toBe(false);
  });

  it("starts fresh in the next window and keeps callers apart", async () => {
    const now = 1_000_000;
    await withinLimit("ip", 60_000, 1, now);
    expect(await withinLimit("ip", 60_000, 1, now)).toBe(false);
    expect(await withinLimit("ip", 60_000, 1, now + 60_000)).toBe(true);
    expect(await withinLimit("other", 60_000, 1, now)).toBe(true);
  });
});

describe("daily tokens", () => {
  it("adds up and ignores nonsense", async () => {
    expect(await tokensToday("2026-10-18")).toBe(0);
    await addTokens("2026-10-18", 300);
    await addTokens("2026-10-18", 200.4);
    await addTokens("2026-10-18", -50);
    await addTokens("2026-10-18", Number.NaN);
    expect(await tokensToday("2026-10-18")).toBe(500);
    expect(await tokensToday("2026-10-19")).toBe(0);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    const req = new Request("https://x.test", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.9");
    expect(clientIp(new Request("https://x.test"))).toBe("unknown");
  });
});
