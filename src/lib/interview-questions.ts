import type { EmailProblemItem } from "./email";

const MAX_PROBLEMS = 15;
const MAX_QUESTIONS = 4;

/**
 * Asks the model for a few follow-up interview questions per problem, in one request.
 * Never throws: with no key, a failed call or an unreadable reply it returns {} and the email goes out without them.
 * Keyed by problem id.
 */
export async function generateInterviewQuestions(items: EmailProblemItem[]): Promise<Record<number, string[]>> {
  const key = process.env.TOKEN_API_KEY;
  if (!key || items.length === 0) return {};

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
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content:
              `You help a candidate prepare for software engineering interviews. For each DSA problem listed, write ${MAX_QUESTIONS} ` +
              "short follow-up questions an interviewer could ask after the candidate solves it: complexity and why, edge cases, " +
              "a variation or constraint change, and the underlying concept. Each question is one sentence, specific to that " +
              "problem, with no answers. Reply with only JSON of the form {\"<problem id>\": [\"question\", ...]}.",
          },
          { role: "user", content: list },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
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
export function parseQuestions(reply: unknown, ids: Set<number>): Record<number, string[]> {
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
  const out: Record<number, string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (!ids.has(id) || !Array.isArray(v)) continue;
    const qs = v
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim().slice(0, 300))
      .slice(0, MAX_QUESTIONS);
    if (qs.length) out[id] = qs;
  }
  return out;
}
