import { addTokens, clientIp, isSameOrigin, tokensToday, withinLimit } from "@/lib/agent-limits";
import { getScenario } from "@/lib/debug";
import {
  buildBasicReport,
  buildReviewMessages,
  changeSize,
  courseRecs,
  extractReport,
  reconcile,
  reviewRequest,
  roundFacts,
} from "@/lib/debug-report";
import { dayKey } from "@/lib/debug-agent";
import type { Report } from "@/lib/debug-report-types";
import { LLM_LIMITS } from "@/lib/llm-limits";

export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const MAX_BODY = 250_000;
const DAY_MS = 24 * 3600 * 1000;

/**
 * The overall review after a round. It always answers with a report: the model's if it can be had, otherwise
 * the built-in one with a note saying why. The model's reply is capped at the fixed review limit.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Not allowed." }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
    return json({ error: "Request too large." }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Request too large." }, 413);

  let parsed;
  try {
    parsed = reviewRequest.safeParse(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) return json({ error: "Invalid request." }, 400);
  const body = parsed.data;

  const scenario = getScenario(body.scenarioId);
  if (!scenario) return json({ error: "Unknown case." }, 404);
  if (Object.keys(body.files).some((f) => !(f in scenario.files)))
    return json({ error: "Invalid request." }, 400);

  const facts = roundFacts(body);
  const files = { ...scenario.files, ...body.files };
  const basic = buildBasicReport(scenario, {
    facts,
    ...changeSize(scenario.files, files),
    explanation: body.explanation,
  });
  const course = courseRecs(scenario, facts);
  const answer = (source: "mentor" | "basic", report: Report, note?: string) =>
    json({ source, report, course, ...(note ? { note } : {}) });
  const fallback = (note: string) => answer("basic", basic, note);

  const key = process.env.TOKEN_API_KEY;
  if (!key) return fallback("The mentor review is not set up here, so this is the basic report.");

  const day = dayKey();
  const budget = Number(process.env.DEBUG_DAILY_TOKEN_BUDGET) || 400_000;
  try {
    const ip = clientIp(req);
    if (
      !(await withinLimit(`review:${ip}`, 60_000, 3)) ||
      !(await withinLimit(`review-day:${ip}`, DAY_MS, 10))
    ) {
      return fallback(
        "You have asked for several reviews recently, so this is the basic report. Try again later.",
      );
    }
    if ((await tokensToday(day)) >= budget) {
      return fallback(
        "The mentor has reached today's free limit, so this is the basic report. Come back tomorrow.",
      );
    }
  } catch (e) {
    console.error("review limit check failed", e);
    return fallback("The mentor review is unavailable right now, so this is the basic report.");
  }

  const messages = buildReviewMessages(scenario, body, facts);
  const base = (process.env.TOKEN_BASE_URL || "https://tokenharbor.ai/v1").replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.TOKEN_REVIEW_MODEL || process.env.TOKEN_MODEL || "deepseek-v4.1-flash:free",
        messages,
        max_tokens: LLM_LIMITS.reviewTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    console.error("review upstream unreachable", (e as Error).name);
    return fallback("The mentor could not be reached, so this is the basic report.");
  }
  if (!res.ok) {
    console.error("review upstream status", res.status);
    return fallback("The mentor review is unavailable right now, so this is the basic report.");
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
    usage?: { total_tokens?: number };
  } | null;
  const content = data?.choices?.[0]?.message?.content;
  const spent =
    data?.usage?.total_tokens ??
    Math.ceil((JSON.stringify(messages).length + String(content ?? "").length) / 4);
  await addTokens(day, spent).catch((e) => console.error("review token count failed", e));

  const report = typeof content === "string" ? extractReport(content) : null;
  if (!report) return fallback("The mentor's reply could not be read, so this is the basic report.");
  return answer("mentor", reconcile(report, basic));
}
