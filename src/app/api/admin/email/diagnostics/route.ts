import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStoredTokens } from "@/lib/gmail";
import { sendViaResend } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Email sending diagnostics.
 *
 * GET  — read-only: is Resend configured, is the domain verified, what from-
 *        address is set, and which transport would actually be used. Sends
 *        NOTHING.
 * POST { to, from } — sends ONE test email via Resend (forced, bypassing the
 *        Gmail-first path) so end-to-end delivery from the domain can be
 *        confirmed. Intended for a self-test to your own inbox.
 */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKeySet = !!process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || null;
  const gmail = await getStoredTokens().catch(() => null);
  const gmailConnected = !!gmail?.access_token || !!gmail?.refresh_token;

  // Ask Resend directly whether the domain is verified.
  let resendDomains: Array<{ name: string; status: string; region?: string }> = [];
  let resendError: string | null = null;
  if (resendKeySet) {
    try {
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      const j = await r.json();
      if (!r.ok) resendError = j?.message || `HTTP ${r.status}`;
      else
        resendDomains = (j?.data ?? []).map((d: { name: string; status: string; region?: string }) => ({
          name: d.name,
          status: d.status,
          region: d.region,
        }));
    } catch (e) {
      resendError = e instanceof Error ? e.message : "domains lookup failed";
    }
  }

  const krishnaDomain = resendDomains.find((d) => /krishnaamarneni\.com$/i.test(d.name));

  // Which transport does sendEmailUnified actually use? It tries Gmail FIRST.
  const activeTransport = gmailConnected
    ? "gmail"
    : resendKeySet
      ? "resend"
      : "none";

  return NextResponse.json({
    resend: {
      apiKeySet: resendKeySet,
      fromEmail,
      fromEmailIsCustomDomain: !!fromEmail && /@krishnaamarneni\.com/i.test(fromEmail),
      domains: resendDomains,
      krishnaamarneniStatus: krishnaDomain?.status ?? "not found in this Resend account",
      error: resendError,
    },
    gmailConnected,
    activeTransport,
    verdict:
      activeTransport === "gmail"
        ? "Gmail is connected, so the app currently sends via Gmail — NOT Resend/@krishnaamarneni.com. Bulk outreach would still come from your Gmail address until the transport is changed."
        : krishnaDomain?.status === "verified"
          ? "Resend is the active transport and krishnaamarneni.com is verified — sending from @krishnaamarneni.com should work. Confirm with a POST test."
          : "Resend would be used but the domain isn't verified yet (or RESEND_FROM_EMAIL isn't set to @krishnaamarneni.com).",
  });
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { to?: string; from?: string };
  const to = (body.to || "").trim();
  if (!to) return NextResponse.json({ error: "A 'to' address is required (send a test to yourself)." }, { status: 400 });

  const overrideFrom = body.from?.trim();
  const effectiveFrom = overrideFrom || process.env.RESEND_FROM_EMAIL || "(default)";
  const res = await sendViaResend({
    to,
    subject: "Test — sending from krishnaamarneni.com via Resend",
    html: "<p>If you received this, sending from your Resend domain works.</p>",
    text: "If you received this, sending from your Resend domain works.",
    ...(overrideFrom ? { from: overrideFrom } : {}),
  });
  return NextResponse.json({ ...res, from: effectiveFrom, to });
}
