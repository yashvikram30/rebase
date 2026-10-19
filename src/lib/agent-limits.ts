import { agentDays, agentHits, agentRounds } from "./mongo";

const DAY_MS = 24 * 3600 * 1000;

/**
 * Takes one message from a round's budget. Returns the number of messages used so far, including this one,
 * or null when the round is already at its cap. The check and the increment are one atomic update.
 */
export async function reserveMessage(rid: string, cap: number, exp: number): Promise<number | null> {
  const col = await agentRounds();
  try {
    const doc = await col.findOneAndUpdate(
      { _id: rid, messages: { $lt: cap } },
      { $inc: { messages: 1 }, $setOnInsert: { exp: new Date(exp) } },
      { upsert: true, returnDocument: "after" },
    );
    return doc?.messages ?? 1;
  } catch (e) {
    // The round exists and is full, so the upsert tried to insert a duplicate id.
    if ((e as { code?: number }).code === 11000) return null;
    throw e;
  }
}

/** Gives a message back, for when the model call failed through no fault of the candidate. */
export async function refundMessage(rid: string) {
  await (await agentRounds()).updateOne({ _id: rid, messages: { $gt: 0 } }, { $inc: { messages: -1 } });
}

export async function tokensToday(day: string): Promise<number> {
  return (await (await agentDays()).findOne({ _id: day }))?.tokens ?? 0;
}

export async function addTokens(day: string, n: number) {
  if (!Number.isFinite(n) || n <= 0) return;
  await (
    await agentDays()
  ).updateOne(
    { _id: day },
    { $inc: { tokens: Math.round(n) }, $setOnInsert: { exp: new Date(Date.now() + 2 * DAY_MS) } },
    { upsert: true },
  );
}

/** Counts a request against a caller's window. True while they are within `max`. */
export async function withinLimit(
  key: string,
  windowMs: number,
  max: number,
  now = Date.now(),
): Promise<boolean> {
  const bucket = Math.floor(now / windowMs);
  const doc = await (
    await agentHits()
  ).findOneAndUpdate(
    { _id: `${key}:${bucket}` },
    { $inc: { n: 1 }, $setOnInsert: { exp: new Date((bucket + 1) * windowMs + windowMs) } },
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.n ?? 1) <= max;
}

/** The caller's address as the platform reports it. Only used to throttle, never stored with content. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "unknown";
}

/** Only our own pages call the debug routes. (Header absent: tools and older clients, which still need a token.) */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}
