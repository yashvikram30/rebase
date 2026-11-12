import type { EmailProblemItem } from "./email";

const MAX_PROBLEMS = 10;
const MAX_FOLLOWUPS = 5;
const MAX_VARIATIONS = 4;

export type InterviewExtras = { followups: string[]; variations: string[] };

const ATTEMPTS = 3;
const BACKOFF_MS = 2_000;

/**
 * Asks the model for a few follow-up interview questions per problem, in one request, retrying a failed or
 * empty reply a couple of times with a short backoff.
 * Never throws: with no key, or when every attempt fails, it returns {} and the email goes out without them.
 * Keyed by problem id; a problem missing from the result got nothing, so the caller must not mark it as done.
 */
export async function generateInterviewQuestions(items: EmailProblemItem[]): Promise<Record<number, InterviewExtras>> {
  if (!process.env.TOKEN_API_KEY || items.length === 0) return {};
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const out = await requestQuestions(items);
    if (Object.keys(out).length > 0) return out;
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
  }
  console.error(`[interview-questions] gave up after ${ATTEMPTS} attempts for problems ${items.map((i) => i.problem.id).join(",")}`);
  return {};
}

async function requestQuestions(items: EmailProblemItem[]): Promise<Record<number, InterviewExtras>> {
  const key = process.env.TOKEN_API_KEY;
  if (!key) return {};

  const list = items
    .slice(0, MAX_PROBLEMS)
    .map(({ problem: p }) => `${p.id}: ${p.label} (${p.topic} > ${p.subtopic}, ${p.difficulty})`)
    .join("\n");

  const base = (process.env.TOKEN_BASE_URL || "https://tokenharbor.ai/v1").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.TOKEN_REVIEW_MODEL || process.env.TOKEN_MODEL || "deepseek-v4.1-flash:free",
        temperature: 0.4,
        max_tokens: 6000,
        messages: [
          {
            role: "system",
            content:
              "You help a candidate prepare for software engineering interviews. For each DSA problem listed, write two groups. " +
              `"followups": ${MAX_FOLLOWUPS} questions an interviewer asks after the candidate solves it, covering time and space ` +
              "complexity and why, edge cases, why the approach works, trade-offs against other approaches, and the underlying concept. " +
              `"variations": ${MAX_VARIATIONS} changed versions of the problem to solve next (a different constraint, a harder input, ` +
              "an in-place or streaming version, a related classic problem), each stating the change and what it affects. " +
              "Each item is one or two sentences, specific to that problem, with no answers. " +
              'Reply with only JSON of the form {"<problem id>": {"followups": ["..."], "variations": ["..."]}}.',
          },
          { role: "user", content: list },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return parseQuestions(data?.choices?.[0]?.message?.content, new Set(items.map((i) => i.problem.id)));
  } catch (err) {
    console.error("[interview-questions]", err instanceof Error ? err.message : err);
    return {};
  }
}

/** Pulls the JSON object out of a reply that may be wrapped in a code fence or prose, keeping only known ids. */
export function parseQuestions(reply: unknown, ids: Set<number>): Record<number, InterviewExtras> {
  if (typeof reply !== "string") return {};
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object") return {};
  const clean = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .map((q) => q.trim().slice(0, 400))
          .slice(0, max)
      : [];
  const out: Record<number, InterviewExtras> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (!ids.has(id) || !v || typeof v !== "object") continue;
    const e = v as { followups?: unknown; variations?: unknown };
    const extras = { followups: clean(e.followups, MAX_FOLLOWUPS), variations: clean(e.variations, MAX_VARIATIONS) };
    if (extras.followups.length || extras.variations.length) out[id] = extras;
  }
  return out;
}
