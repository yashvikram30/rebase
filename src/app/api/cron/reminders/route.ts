import { NextResponse } from "next/server";
import rawProblems from "@/data/striver-180.json";
import { sendRevisionEmail, type EmailProblemItem } from "@/lib/email";
import { syncRows, type SyncRow } from "@/lib/mongo";
import { rescheduleMissedReviews, toDateString } from "@/lib/striver-schedule";
import { normalizeStriver } from "@/lib/striver-store";
import type { StriverProblem } from "@/lib/striver-types";

const problemsMap = new Map<number, StriverProblem>(
  (rawProblems as StriverProblem[]).map((p) => [p.id, p]),
);

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // In local development, permit running if CRON_SECRET is not set
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("key") === secret) return true;

  return false;
}

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

      const email = state.email || (row.uid.includes("@") ? row.uid : undefined);
      if (!email) continue;

      // 1. Run missed review leveling
      const { reviews: updatedReviews, rescheduledCount } = rescheduleMissedReviews(
        state.reviews,
        todayStr,
      );
      totalRescheduled += rescheduledCount;

      // 2. Identify problems due today
      const dueReviews = updatedReviews.filter(
        (r) => !r.completed && r.dueDate === todayStr,
      );

      // Save updated reviews back to DB if any rescheduling occurred
      if (rescheduledCount > 0) {
        state.reviews = updatedReviews;
        await col.updateOne(
          { _id: row._id },
          { $set: { value: JSON.stringify(state), updated: Date.now() } },
        );
      }

      // 3. Send email if there are problems due today
      if (dueReviews.length > 0) {
        const emailItems: EmailProblemItem[] = [];
        for (const r of dueReviews) {
          const prob = problemsMap.get(r.problemId);
          if (prob) {
            emailItems.push({
              problem: prob,
              status: r.status,
              stage: r.stage,
            });
          }
        }

        if (emailItems.length > 0) {
          const result = await sendRevisionEmail({
            to: email,
            items: emailItems,
            todayStr,
          });

          if (result.ok) {
            emailsSent++;
            logs.push(`Sent ${emailItems.length} problems to ${email}`);
          } else {
            logs.push(`Failed sending to ${email}: ${result.error}`);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      today: todayStr,
      processed,
      emailsSent,
      totalRescheduled,
      logs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/reminders]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST endpoint allows manual triggers from the UI or tests, with optional body { email, reviews }.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; reviews?: any[] } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional; fallback to GET behavior
  }

  const todayStr = toDateString(new Date());

  // Direct test trigger with passed body
  if (body.email && Array.isArray(body.reviews)) {
    const { reviews: updatedReviews, rescheduledCount } = rescheduleMissedReviews(
      body.reviews,
      todayStr,
    );
    const dueReviews = updatedReviews.filter((r) => !r.completed && r.dueDate === todayStr);

    const emailItems: EmailProblemItem[] = [];
    for (const r of dueReviews) {
      const prob = problemsMap.get(r.problemId);
      if (prob) {
        emailItems.push({
          problem: prob,
          status: r.status,
          stage: r.stage,
        });
      }
    }

    if (emailItems.length > 0) {
      const result = await sendRevisionEmail({
        to: body.email,
        items: emailItems,
        todayStr,
      });
      return NextResponse.json({
        ok: true,
        sent: result.ok,
        count: emailItems.length,
        rescheduledCount,
        skipped: result.skipped,
        error: result.error,
      });
    }

    return NextResponse.json({
      ok: true,
      sent: false,
      count: 0,
      rescheduledCount,
      message: "No problems due today for this user.",
    });
  }

  // Fallback to database scan
  return GET(req);
}
