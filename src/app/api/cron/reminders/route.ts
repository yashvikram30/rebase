import { NextResponse } from "next/server";
import { sendRevisionEmail } from "@/lib/email";
import { generateInterviewQuestions } from "@/lib/interview-questions";
import { syncRows } from "@/lib/mongo";
import { toEmailItems } from "@/lib/striver-problems";
import { isQuestionStage, rescheduleMissedReviews, toDateString } from "@/lib/striver-schedule";
import { normalizeStriver } from "@/lib/striver-normalize";

/** Each email waits on a model call for its interview questions. */
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Without a secret the route is open only in local development.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily job: for every signed-in user with a Striver sheet, move missed reviews to quiet days, then email the
 * account's address the reviews due today. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = toDateString(new Date());
  let processed = 0;
  let emailsSent = 0;
  let totalRescheduled = 0;
  const logs: string[] = [];

  try {
    const col = await syncRows();
    const rows = await col.find({ key: "csplan.striver" }).toArray();

    for (const row of rows) {
      processed++;
      let state;
      try {
        state = normalizeStriver(JSON.parse(row.value));
      } catch {
        continue;
      }

      const { reviews, rescheduledCount } = rescheduleMissedReviews(state.reviews, todayStr);
      totalRescheduled += rescheduledCount;
      if (rescheduledCount > 0) {
        state.reviews = reviews;
        await col.updateOne(
          { _id: row._id },
          { $set: { value: JSON.stringify(state), updated: Date.now() } },
        );
      }

      // Only the address recorded from the user's own session is ever used.
      if (!row.email || !state.reminders) continue;

      const items = toEmailItems(reviews.filter((r) => !r.completed && r.dueDate === todayStr), state.customProblems);
      if (items.length === 0) continue;

      // Questions go only on a problem's 28-day review, and only once: a problem already in `questioned` is skipped.
      const already = new Set(row.questioned ?? []);
      const askFor = items.filter((i) => isQuestionStage(i.status, i.stage) && !already.has(i.problem.id));
      const questions = askFor.length > 0 ? await generateInterviewQuestions(askFor) : {};
      const missing = askFor.filter((i) => !questions[i.problem.id]).map((i) => i.problem.id);
      if (missing.length > 0) {
        console.error(`[cron/reminders] no questions for user ${row.uid}, problems ${missing.join(",")}; will retry`);
      }

      const result = await sendRevisionEmail({ to: row.email, items, todayStr, questions });
      if (result.ok) {
        emailsSent++;
        logs.push(`Sent ${items.length} problems to user ${row.uid}`);
        // Mark a problem only once its email really went out with questions, so a failed call retries on a later run.
        const done = Object.keys(questions).map(Number);
        if (!result.skipped && done.length > 0) {
          await col.updateOne({ _id: row._id }, { $addToSet: { questioned: { $each: done } } });
        }
      } else {
        logs.push(`Failed sending to user ${row.uid}: ${result.error}`);
      }
    }

    return NextResponse.json({ ok: true, today: todayStr, processed, emailsSent, totalRescheduled, logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/reminders]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
