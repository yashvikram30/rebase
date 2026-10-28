import { MongoClient, type Collection } from "mongodb";
import type { Visit } from "./analytics";

/**
 * One row per user per synced store: { uid, key, value (JSON text), updated }.
 * `email` is the account's address, taken from the session (never from the client) on the Striver row so the
 * daily reminder cron knows where to send.
 */
export type SyncRow = { uid: string; key: string; value: string; updated: number; email?: string };

declare global {
  var _mongo: Promise<MongoClient> | undefined;
}

// Kept on globalThis so dev hot reloads reuse one connection pool.
function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  return (globalThis._mongo ??= new MongoClient(uri).connect());
}

let indexed = false;

export async function syncRows(): Promise<Collection<SyncRow>> {
  const col = (await client()).db(process.env.MONGODB_DB || "daybook").collection<SyncRow>("sync");
  if (!indexed) {
    await col.createIndex({ uid: 1, key: 1 }, { unique: true });
    indexed = true;
  }
  return col;
}

let visitsIndexed = false;

/** One document per page view, expired after a year or so. See lib/analytics.ts. */
export async function visits(): Promise<Collection<Visit>> {
  const col = (await client()).db(process.env.MONGODB_DB || "daybook").collection<Visit>("visits");
  if (!visitsIndexed) {
    await col.createIndex({ ts: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });
    await col.createIndex({ vid: 1, ts: 1 });
    visitsIndexed = true;
  }
  return col;
}

/** Chat usage for one round: { _id: roundId, messages, exp }. Expires with the round. */
export type RoundUse = { _id: string; messages: number; exp: Date };
/** Tokens spent per UTC day across all rounds: { _id: "YYYY-MM-DD", tokens }. */
export type DayUse = { _id: string; tokens: number; exp: Date };
/** Request counters per caller and window: { _id: "<key>", n, exp }. */
export type Hit = { _id: string; n: number; exp: Date };

let agentIndexed = false;

async function agentDb() {
  const db = (await client()).db(process.env.MONGODB_DB || "daybook");
  const rounds = db.collection<RoundUse>("agent_rounds");
  const days = db.collection<DayUse>("agent_days");
  const hits = db.collection<Hit>("agent_hits");
  if (!agentIndexed) {
    await Promise.all([
      rounds.createIndex({ exp: 1 }, { expireAfterSeconds: 3600 }),
      days.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }),
      hits.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }),
    ]);
    agentIndexed = true;
  }
  return { rounds, days, hits };
}

export const agentRounds = async () => (await agentDb()).rounds;
export const agentDays = async () => (await agentDb()).days;
export const agentHits = async () => (await agentDb()).hits;
