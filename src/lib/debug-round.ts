import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** The limits of one chat round. The cap is enforced on the server, not trusted from the page. */
export const ROUND = { messages: 12, minutes: 45 } as const;

export type RoundClaims = { rid: string; sid: string; exp: number; cap: number };

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest();

/** A round token is `payload.signature`, signed with the server secret, so a client cannot raise its own cap. */
export function newRound(sid: string, secret: string, now = Date.now(), rid: string = randomUUID()) {
  const claims: RoundClaims = { rid, sid, exp: now + ROUND.minutes * 60_000, cap: ROUND.messages };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${payload}.${sign(payload, secret).toString("base64url")}`, claims };
}

/** The claims inside a valid, unexpired token, or null for anything else. */
export function verifyRound(token: unknown, secret: string, now = Date.now()): RoundClaims | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const want = sign(parts[0], secret);
  const got = Buffer.from(parts[1], "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Partial<RoundClaims>;
    if (typeof c.rid !== "string" || typeof c.sid !== "string") return null;
    if (!Number.isFinite(c.exp) || !Number.isInteger(c.cap) || (c.cap as number) < 1) return null;
    if ((c.exp as number) <= now) return null;
    return { rid: c.rid, sid: c.sid, exp: c.exp as number, cap: c.cap as number };
  } catch {
    return null;
  }
}
