import { describe, expect, it } from "vitest";
import { newRound, ROUND, verifyRound } from "./debug-round";

const SECRET = "test-secret";

describe("round tokens", () => {
  it("round-trips the claims", () => {
    const { token, claims } = newRound("clamp-swapped-min-max", SECRET, 1000, "rid-1");
    expect(claims).toEqual({
      rid: "rid-1",
      sid: "clamp-swapped-min-max",
      exp: 1000 + ROUND.minutes * 60_000,
      cap: ROUND.messages,
    });
    expect(verifyRound(token, SECRET, 2000)).toEqual(claims);
  });

  it("rejects a token signed with another secret", () => {
    const { token } = newRound("a", SECRET, 1000);
    expect(verifyRound(token, "other-secret", 2000)).toBeNull();
  });

  it("rejects a tampered payload, such as a raised cap", () => {
    const { token, claims } = newRound("a", SECRET, 1000);
    const forged = Buffer.from(JSON.stringify({ ...claims, cap: 9999 })).toString("base64url");
    expect(verifyRound(`${forged}.${token.split(".")[1]}`, SECRET, 2000)).toBeNull();
  });

  it("rejects an expired token", () => {
    const { token, claims } = newRound("a", SECRET, 1000);
    expect(verifyRound(token, SECRET, claims.exp + 1)).toBeNull();
  });

  it("rejects things that are not tokens", () => {
    for (const bad of [undefined, null, 5, "", "abc", "a.b.c", ".", "x".repeat(700)])
      expect(verifyRound(bad, SECRET)).toBeNull();
  });
});
