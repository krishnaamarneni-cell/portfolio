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
