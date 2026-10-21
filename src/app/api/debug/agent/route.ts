import {
  addTokens,
  clientIp,
  isSameOrigin,
  refundMessage,
  reserveMessage,
  tokensToday,
  withinLimit,
} from "@/lib/agent-limits";
import { withholdPatches } from "@/lib/agent-reply";
import { getScenario } from "@/lib/debug";
import { agentRequest, buildMessages, dayKey, MIN_HYPOTHESIS } from "@/lib/debug-agent";
import { verifyRound } from "@/lib/debug-round";
import { clampReply, LLM_LIMITS } from "@/lib/llm-limits";

export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const MAX_BODY = 120_000;
const DAY_MS = 24 * 3600 * 1000;

/**
 * One chat turn with the assistant. The page sends the conversation, the files and the latest test output;
 * the answer key never leaves the server. The message cap, the daily token budget and the per-address limits
 * are all enforced here.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Not allowed." }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
    return json({ error: "Request too large." }, 413);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Request too large." }, 413);
  let parsed;
  try {
    parsed = agentRequest.safeParse(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) return json({ error: "Invalid request." }, 400);
  const body = parsed.data;

  const secret = process.env.AUTH_SECRET;
  const key = process.env.TOKEN_API_KEY;
  if (!secret || !key) return json({ error: "Agent chat is not configured." }, 503);

  const claims = verifyRound(body.token, secret);
  if (!claims) return json({ error: "This chat round has ended. Start a new one." }, 401);
  const scenario = getScenario(claims.sid);
  if (!scenario) return json({ error: "Unknown case." }, 404);
  if (Object.keys(body.files).some((f) => !(f in scenario.files)))
    return json({ error: "Invalid request." }, 400);
  if (body.messages[body.messages.length - 1].role !== "user")
    return json({ error: "Invalid request." }, 400);
  if (body.phase === "fix" && (body.hypothesis ?? "").trim().length < MIN_HYPOTHESIS) {
    return json({ error: "Write your hypothesis first: what do you think is wrong, and why?" }, 400);
  }

  const day = dayKey();
  const budget = Number(process.env.DEBUG_DAILY_TOKEN_BUDGET) || 400_000;
  let used: number | null;
  try {
    const ip = clientIp(req);
    if (
      !(await withinLimit(`agent:${ip}`, 60_000, 20)) ||
      !(await withinLimit(`agent-day:${ip}`, DAY_MS, 150))
    ) {
      return json({ error: "Too many messages from your connection. Try again later." }, 429);
    }
    if ((await tokensToday(day)) >= budget) {
      return json(
        {
          error:
            "The assistant has reached today's free limit. Come back tomorrow, or keep debugging on your own.",
        },
        429,
      );
    }
    used = await reserveMessage(claims.rid, claims.cap, claims.exp);
  } catch (e) {
    console.error("agent limit check failed", e);
    return json({ error: "Agent chat is temporarily unavailable." }, 503);
  }
  if (used === null)
    return json({ error: "You have used all your messages for this round.", remaining: 0 }, 429);

  const messages = buildMessages(body, scenario);
  const base = (process.env.TOKEN_BASE_URL || "https://tokenharbor.ai/v1").replace(/\/+$/, "");
  const fail = async (status: number, error: string) => {
    await refundMessage(claims.rid).catch(() => undefined);
    return json({ error }, status);
  };

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.TOKEN_MODEL || "deepseek-v4.1-flash:free",
        messages,
        max_tokens: LLM_LIMITS.chatTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(50_000),
    });
  } catch (e) {
    console.error("agent upstream unreachable", (e as Error).name);
    return fail(502, "The assistant could not be reached. That message was not counted. Try again.");
  }
  if (!res.ok) {
    console.error("agent upstream status", res.status);
    if (res.status === 429)
      return fail(503, "The assistant is busy. That message was not counted. Try again shortly.");
    // 402: the gateway account has no credit, which only its owner can fix. Say so plainly, and log it for them.
    if (res.status === 402) {
      console.error("agent upstream is out of credit: top up or enable free models in the gateway dashboard");
      return fail(
        503,
        "The assistant is unavailable right now. That message was not counted. Keep debugging on your own.",
      );
    }
    return fail(502, "The assistant returned an error. That message was not counted.");
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    usage?: { total_tokens?: number };
  } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return fail(502, "The assistant sent an empty reply. That message was not counted.");
  }

  const spent =
    data?.usage?.total_tokens ?? Math.ceil((JSON.stringify(messages).length + content.length) / 4);
  await addTokens(day, spent).catch((e) => console.error("agent token count failed", e));

  // Before a hypothesis exists the agent must not hand over a patch, whatever the model decided to do.
  const allowed =
    body.phase === "explore" ? withholdPatches(content, Object.keys(scenario.files)).reply : content;
  const { text: reply, cut } = clampReply(
    allowed.trim(),
    LLM_LIMITS.chatChars,
    data?.choices?.[0]?.finish_reason === "length",
  );
  return json({ reply, truncated: cut, used, cap: claims.cap, remaining: claims.cap - used });
}
