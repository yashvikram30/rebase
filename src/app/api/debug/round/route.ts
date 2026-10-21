import { z } from "zod";
import { clientIp, isSameOrigin, withinLimit } from "@/lib/agent-limits";
import { getScenario } from "@/lib/debug";
import { newRound, ROUND } from "@/lib/debug-round";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Starts a chat round for one case and returns a signed token carrying its limits. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Not allowed." }, 403);
  const secret = process.env.AUTH_SECRET;
  if (!secret) return json({ error: "Agent chat is not configured." }, 503);

  const body = z.object({ scenarioId: z.string().max(80) }).safeParse(await req.json().catch(() => null));
  if (!body.success || !getScenario(body.data.scenarioId)) return json({ error: "Unknown case." }, 404);

  try {
    if (!(await withinLimit(`round:${clientIp(req)}`, 60_000, 10))) {
      return json({ error: "Too many rounds started. Wait a minute and try again." }, 429);
    }
  } catch (e) {
    console.error("round limit check failed", e);
    return json({ error: "Agent chat is temporarily unavailable." }, 503);
  }

  const { token, claims } = newRound(body.data.scenarioId, secret);
  return json({ token, exp: claims.exp, cap: claims.cap, minutes: ROUND.minutes });
}
