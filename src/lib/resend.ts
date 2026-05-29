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

export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  // Resend requires a verified "from" domain, or use their onboarding
  // address. We default to onboarding@resend.dev if no custom domain set.
  const from =
    process.env.RESEND_FROM_EMAIL || "Lucy <onboarding@resend.dev>";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
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
 * Unified email sender — tries Resend first, falls back to Gmail.
 */
export async function sendEmailUnified(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; id?: string; error?: string; provider: string }> {
  // 1. Try Resend
  if (hasResend()) {
    const result = await sendViaResend(opts);
    if (result.ok) return { ...result, provider: "resend" };
    // If Resend failed, try Gmail as fallback
    console.warn("[email] Resend failed, trying Gmail fallback:", result.error);
  }

  // 2. Fallback: Gmail OAuth
  try {
    const { sendEmail } = await import("@/lib/gmail");
    const result = await sendEmail(opts);
    return { ...result, provider: "gmail" };
  } catch (err) {
    return {
      ok: false,
      error: `Both Resend and Gmail failed. Last: ${err instanceof Error ? err.message : String(err)}`,
      provider: "none",
    };
  }
}
