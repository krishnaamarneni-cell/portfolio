import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Warm check-in outreach, once a day.
 *
 * Deliberately not on the 5-minute auto-reply schedule. Replying quickly is
 * worth something to a recruiter who just wrote; sending an unsolicited note
 * quickly is worth nothing to anyone. The cap is 3 a day, so once is enough.
 *
 * Auth: CRON_SECRET. This route sends outbound email and must never be
 * publicly triggerable.
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
    const { runWarmOutreach } = await import("@/lib/warm-outreach");
    const r = await runWarmOutreach();
    return NextResponse.json({
      ok: true,
      eligible: r.eligible,
      sent: r.sent,
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
