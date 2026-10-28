import { auth } from "@/auth";
import { sendRevisionEmail } from "@/lib/email";
import { normalizeStriver } from "@/lib/striver-normalize";
import { toEmailItems } from "@/lib/striver-problems";

const noStore = { "Cache-Control": "no-store" };

/**
 * Sends the signed-in user a sample digest of their own reviews. The recipient is always the session's
 * address; the body supplies only the reviews (and the user's local date) so it works before the first sync.
 */
export async function POST(req: Request) {
  const session = await auth();
  const to = session?.user?.email;
  if (!session?.user?.id || !to) {
    return Response.json({ error: "Sign in first" }, { status: 401, headers: noStore });
  }

  let body: { reviews?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400, headers: noStore });
  }
  const today =
    typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  if (!today) return Response.json({ error: "Bad date" }, { status: 400, headers: noStore });

  const active = normalizeStriver({ reviews: body.reviews }).reviews.filter((r) => !r.completed);
  const due = active.filter((r) => r.dueDate <= today);
  // Nothing due is the normal case right after marking a problem, so a test falls back to what is coming up.
  const pool = due.length > 0 ? due : active.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const items = toEmailItems(pool);
  if (items.length === 0) {
    return Response.json({ ok: true, sent: false, count: 0 }, { headers: noStore });
  }

  const result = await sendRevisionEmail({ to, items, todayStr: today });
  if (!result.ok) {
    return Response.json({ ok: false, error: "Could not send the email" }, { status: 502, headers: noStore });
  }
  return Response.json(
    { ok: true, sent: !result.skipped, skipped: result.skipped === true, count: items.length, to },
    { headers: noStore },
  );
}
