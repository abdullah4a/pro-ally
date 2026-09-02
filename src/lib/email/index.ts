import nodemailer from "nodemailer";

export type JobAlertDetails = {
  title: string;
  company: string;
  description: string;
  url: string;
  matchScore: number;
  matchReason?: string;
};

/**
 * Job text comes from third-party RSS feeds, so every interpolated value is
 * escaped before it reaches the HTML body or the subject line.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) links are rendered — blocks javascript: and data: payloads. */
function safeUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function stripToPlainText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function sendJobEmailAlert(
  userEmail: string,
  jobDetails: JobAlertDetails,
): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn(
      "[Email] SMTP_USER/SMTP_PASS are not set — skipping alert for",
      userEmail,
    );
    return false;
  }

  const link = safeUrl(jobDetails.url);
  const title = escapeHtml(stripToPlainText(jobDetails.title, 200));
  const company = escapeHtml(stripToPlainText(jobDetails.company, 120));
  const summary = escapeHtml(stripToPlainText(jobDetails.description, 300));
  const reason = jobDetails.matchReason
    ? escapeHtml(stripToPlainText(jobDetails.matchReason, 200))
    : null;
  const score = Math.round(jobDetails.matchScore);

  const ctaBlock = link
    ? `<div style="text-align: center; margin-top: 25px;">
        <a href="${escapeHtml(link)}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Job &amp; Apply</a>
      </div>`
    : `<p style="color: #b91c1c; font-size: 13px; text-align: center; margin-top: 20px;">This listing had no usable link — open it from your ProAlly dashboard.</p>`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-radius: 10px; padding: 20px;">
      <h2 style="color: #6d28d9; text-align: center;">ProAlly Job Match Alert</h2>
      <p style="font-size: 16px; color: #333;">We found a job that matches your CV skills.</p>

      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <h3 style="margin-top: 0; color: #111827;">${title}</h3>
        <p style="color: #4b5563; font-weight: bold;">${company}</p>
        <p style="color: #4b5563;">Match score: <strong>${score}%</strong></p>
        ${reason ? `<p style="color: #4b5563; font-style: italic;">${reason}</p>` : ""}
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 15px 0;">
        <p style="color: #6b7280; font-size: 14px;">${summary}...</p>
      </div>

      ${ctaBlock}

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
        This is an automated message from ProAlly. Please do not reply to this email.
      </p>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({
      from: `"ProAlly Alerts" <${user}>`,
      to: userEmail,
      subject: `New job match (${score}%): ${stripToPlainText(jobDetails.title, 120)}`,
      html: htmlContent,
      replyTo: "no-reply@proally.app",
    });

    console.log("[Email] Alert sent successfully! Message ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send alert:", error);
    return false;
  }
}
