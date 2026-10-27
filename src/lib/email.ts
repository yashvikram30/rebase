import nodemailer from "nodemailer";
import type { StriverProblem } from "./striver-types";

export type EmailProblemItem = {
  problem: StriverProblem;
  status: "yellow" | "red";
  stage: number;
};

export async function sendRevisionEmail({
  to,
  items,
  todayStr,
  appUrl = process.env.AUTH_URL || "http://localhost:3000",
}: {
  to: string;
  items: EmailProblemItem[];
  todayStr: string;
  appUrl?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string; skipped?: boolean }> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.EMAIL_FROM || user || "reminders@rebase.dev";

  if (!user || !pass) {
    console.warn(
      `[email] SMTP_USER or SMTP_PASS not set. Skipping real email to ${to} for ${items.length} problems.`,
    );
    return { ok: true, skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const count = items.length;
  const subject = `[Rebase DSA] ${count} Problem${count > 1 ? "s" : ""} Due for Revision Today (${todayStr})`;

  const problemRowsHtml = items
    .map(({ problem, status, stage }) => {
      const isRed = status === "red";
      const statusColor = isRed ? "#ef4444" : "#eab308";
      const statusLabel = isRed ? "Struggled" : "With Hint";
      const stageText =
        status === "yellow"
          ? stage === 0
            ? "7-Day Check"
            : "28-Day Retention"
          : stage === 0
            ? "7-Day Check"
            : stage === 1
              ? "14-Day Check"
              : "28-Day Retention";

      const practiceUrl =
        problem.leetcodeLink || problem.articleLink || `${appUrl}/striver`;

      return `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <strong style="font-size: 15px; color: #111827;">${problem.order}. ${problem.label}</strong>
          <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
            ${problem.topic} &rsaquo; ${problem.subtopic}
          </div>
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${statusColor}18; color: ${statusColor}; border: 1px solid ${statusColor}40;">
            ${statusLabel} (${stageText})
          </span>
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; text-align: right;">
          <a href="${practiceUrl}" style="display: inline-block; padding: 6px 12px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">
            Solve &rarr;
          </a>
        </td>
      </tr>`;
    })
    .join("");

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${subject}</title>
  </head>
  <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; color: #1f2937;">
    <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: #111827; padding: 24px; color: #ffffff;">
        <span style="display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 4px;">Rebase &bull; Spaced Repetition</span>
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Daily DSA Revision Digest</h1>
        <p style="margin: 6px 0 0; font-size: 14px; color: #d1d5db;">You have <strong>${count}</strong> scheduled problem${count > 1 ? "s" : ""} to re-solve today to cement your retention.</p>
      </div>

      <div style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f3f4f6; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">
              <th style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb;">Problem</th>
              <th style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb;">Status</th>
              <th style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${problemRowsHtml}
          </tbody>
        </table>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13.5px; line-height: 1.5; color: #475569;">
          <strong>Tip:</strong> After solving, update the problem's status in the Rebase tracker. If you mastered it, mark it <strong>Green</strong>. If you still struggled, mark it <strong>Yellow</strong> or <strong>Red</strong> to keep it in the rotation.
        </div>

        <div style="text-align: center;">
          <a href="${appUrl}/striver" style="display: inline-block; padding: 12px 24px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Open Striver Sheet Tracker &rarr;
          </a>
        </div>
      </div>

      <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
        Sent automatically by Rebase DSA Spaced Repetition Cron &bull; ${todayStr}
      </div>
    </div>
  </body>
  </html>`;

  try {
    const info = await transporter.sendMail({
      from: `"Rebase DSA" <${from}>`,
      to,
      subject,
      html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send revision email:", errorMsg);
    return { ok: false, error: errorMsg };
  }
}
