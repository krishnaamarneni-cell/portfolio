/**
 * Resend email provider — primary sender for Morning Briefing & Sunday Reflection.
 *
 * Falls back to Gmail's OAuth-based sender if RESEND_API_KEY is not set.
 * Resend is preferred because it doesn't require OAuth refresh tokens, it
 * Just Works(TM) with an API key, and it has higher deliverability than
 * "sent via Gmail API" for automated emails.
 */
import "server-only";

export function hasResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export type MailAttachment = { filename: string; content: Buffer; contentType: string };

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const from =
    opts.from || process.env.RESEND_FROM_EMAIL || "Lucy <onboarding@resend.dev>";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.attachments?.length
        ? { attachments: opts.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Bulk outreach sender — forces Resend so bulk email never touches Gmail.
 * Replies route back to Gmail via the Reply-To header so the response
 * tracker still picks them up.
 */
export async function sendBulkViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: boolean; id?: string; error?: string; provider: string }> {
  if (!hasResend()) {
    return { ok: false, error: "RESEND_API_KEY not set — bulk send requires Resend.", provider: "none" };
  }
  const replyTo = process.env.GMAIL_USER || "krishna.amarneni@gmail.com";
  const result = await sendViaResend({ ...opts, replyTo });
  return { ...result, provider: "resend" };
}

/**
 * Unified email sender — tries Gmail first, falls back to Resend.
 * Use for 1:1 transactional emails (briefings, test sends, etc.).
 */
export async function sendEmailUnified(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: boolean; id?: string; error?: string; provider: string }> {
  // 1. Try Gmail first (no domain restrictions, user already connected)
  try {
    const { sendEmail } = await import("@/lib/gmail");
    const result = await sendEmail(opts);
    if (result.ok) return { ...result, provider: "gmail" };
    console.warn("[email] Gmail failed, trying Resend:", result.error);
  } catch {
    // Gmail not connected — try Resend
  }

  // 2. Fallback: Resend (needs verified domain for external recipients)
  if (hasResend()) {
    const result = await sendViaResend(opts);
    if (result.ok) return { ...result, provider: "resend" };
    return { ok: false, error: result.error, provider: "resend" };
  }

  return {
    ok: false,
    error: "No email provider available. Connect Gmail in Settings or verify a domain at resend.com/domains.",
    provider: "none",
  };
}
