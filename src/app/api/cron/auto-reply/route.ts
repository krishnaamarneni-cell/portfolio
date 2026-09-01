import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Auto-reply on its own schedule, separate from the agents cron.
 *
 * The agents cron runs four times a day because the agents in it are expensive.
 * Auto-reply is the opposite: it is cheap when there is nothing to do and its
 * whole value depends on answering quickly. Sharing a schedule meant a
 * recruiter emailing just after a tick waited up to a full day.
 *
 * Running this every 5 minutes is cheap by construction. The pipeline checks
 * the kill switch, the business-hours window and the runaway breaker BEFORE it
 * touches Gmail or Groq, so a tick outside 9am-6pm New York costs a single
 * settings read and returns.
 *
 * Auth: CRON_SECRET, same as every other cron here — this route can send email,
 * so it must never be publicly triggerable.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret") || "";
    if (auth !== `Bearer ${expected}` && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { runAutoReplyPipeline } = await import("@/lib/auto-reply");
    const r = await runAutoReplyPipeline();
    return NextResponse.json({
      ok: true,
      scanned: r.scanned,
      candidates: r.jobEmails,
      jobClassified: r.matched,
      sent: r.sent,
      alreadyHandled: r.skippedDuplicate,
      // The reasons matter more than the count: they are how you tell "quiet
      // inbox" from "the classifier rejected everything" from "outside hours".
      skipped: r.skipped.slice(0, 20),
      errors: r.errors,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
