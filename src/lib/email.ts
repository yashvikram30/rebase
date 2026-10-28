import nodemailer from "nodemailer";
import type { StriverProblem } from "./striver-types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The deployed site: AUTH_URL if set, else Vercel's production domain, else local development. */
function siteUrl(): string {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.AUTH_URL || (prod ? `https://${prod}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

export type EmailProblemItem = {
  problem: StriverProblem;
  status: "yellow" | "red";
  stage: number;
};

export async function sendRevisionEmail({
  to,
  items,
  todayStr,
  appUrl = siteUrl(),
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
  const plural = count > 1 ? "s" : "";
  const subject = `${count} problem${plural} to revise today`;

  // Rebase's palette: warm white page, brown ink, orange accent. Inline styles only, for email clients.
  const C = {
    page: "#fff3e3",
    card: "#ffffff",
    ink: "#2a1d12",
    muted: "#76614f",
    line: "#f0dfc8",
    soft: "#ffe8d9",
    orange: "#ff6a1f",
    edge: "#d24f0c",
    brown: "#2a1d12",
    green: "#22a05a",
    yellow: "#e2a70c",
    red: "#e0483f",
  };
  const font = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const display = "'Bricolage Grotesque', Georgia, 'Times New Roman', serif";

  const stageLabel = (status: "yellow" | "red", stage: number) =>
    stage === (status === "red" ? 2 : 1) ? "28-day retention" : stage === 0 ? "7-day check" : "14-day check";

  const problemRowsHtml = items
    .map(({ problem, status, stage }) => {
      const dot = status === "red" ? C.red : C.yellow;
      const how = status === "red" ? "Struggled last time" : "Needed a hint last time";
      const practiceUrl = problem.leetcodeLink || problem.articleLink || `${appUrl}/striver`;

      return `
      <tr>
        <td style="padding: 0 0 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${C.line}; border-radius: 14px; background: ${C.card};">
            <tr>
              <td width="6" style="background: ${dot}; border-radius: 14px 0 0 14px; font-size: 0; line-height: 0;">&nbsp;</td>
              <td style="padding: 14px 16px; font-family: ${font};">
                <div style="font-size: 16px; font-weight: 700; color: ${C.ink}; line-height: 1.3;">${esc(problem.label)}</div>
                <div style="margin-top: 3px; font-size: 13px; color: ${C.muted};">${esc(problem.topic)} &rsaquo; ${esc(problem.subtopic)}</div>
                <div style="margin-top: 8px; font-size: 12px; font-weight: 700; color: ${C.edge};">
                  ${stageLabel(status, stage)} &middot; <span style="color: ${C.muted}; font-weight: 600;">${how}</span>
                </div>
              </td>
              <td align="right" valign="middle" style="padding: 14px 16px 14px 0; font-family: ${font};">
                <a href="${esc(practiceUrl)}" style="display: inline-block; padding: 9px 16px; background: ${C.orange}; color: #1f1208; text-decoration: none; border-radius: 10px; border-bottom: 3px solid ${C.edge}; font-size: 13px; font-weight: 700; white-space: nowrap;">Solve &rarr;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${esc(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${C.page}; font-family: ${font}; color: ${C.ink};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">Re-solve ${count === 1 ? "it" : "them"} today to lock ${count === 1 ? "it" : "them"} in. Your spaced-repetition queue for ${todayStr}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${C.page};">
      <tr>
        <td align="center" style="padding: 28px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
            <tr>
              <td style="padding: 0 4px 16px; font-family: ${display}; font-size: 22px; font-weight: 700; color: ${C.ink};">
                <span style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; background: ${C.orange}; color: #fff; font-size: 12px; vertical-align: middle;">R</span>
                <span style="vertical-align: middle; margin-left: 6px;">Rebase</span>
              </td>
            </tr>
            <tr>
              <td style="background: ${C.card}; border: 1px solid ${C.line}; border-radius: 20px; overflow: hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background: ${C.brown}; padding: 28px 28px 24px; border-bottom: 4px solid ${C.orange};">
                      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #ffb98f;">Daily revision &middot; ${esc(todayStr)}</div>
                      <h1 style="margin: 8px 0 0; font-family: ${display}; font-size: 28px; line-height: 1.15; font-weight: 800; color: #fffaf3;">${count} problem${plural} to redo today</h1>
                      <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: #e8d6c0;">Solving ${count === 1 ? "it" : "them"} again is what moves ${count === 1 ? "it" : "them"} into long-term memory. Ten minutes each is plenty.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 24px 8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        ${problemRowsHtml}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 24px 24px;">
                      <div style="background: ${C.soft}; border-radius: 12px; padding: 14px 16px; font-size: 13.5px; line-height: 1.55; color: ${C.muted};">
                        <b style="color: ${C.ink};">After each one,</b> tell Rebase how it went: <b style="color: ${C.green};">Mastered</b> clears it, <b style="color: #a97c06;">a hint</b> or <b style="color: ${C.red};">a struggle</b> sets the next review.
                      </div>
                      <div style="text-align: center; padding-top: 22px;">
                        <a href="${appUrl}/striver" style="display: inline-block; padding: 13px 26px; background: ${C.orange}; color: #1f1208; text-decoration: none; border-radius: 12px; border-bottom: 4px solid ${C.edge}; font-size: 15px; font-weight: 700;">Open my Striver sheet &rarr;</a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 18px 12px 0; font-size: 12px; line-height: 1.6; color: ${C.muted};">
                You get this because daily reminders are on for your Rebase account.<br>
                Turn them off any time with the switch on the <a href="${appUrl}/striver" style="color: ${C.edge};">Striver page</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  try {
    const info = await transporter.sendMail({
      from: `"Rebase" <${from}>`,
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
