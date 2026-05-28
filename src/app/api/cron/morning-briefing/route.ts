import { NextResponse } from "next/server";
import { getSettings, sendBriefingNow } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Cron tasks can run up to 60s on Hobby.
export const maxDuration = 60;

/**
 * Cron handler — Vercel calls this on the schedule in vercel.json.
 *
 * Auth: Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}`
 * if CRON_SECRET is set in your project. We accept either that header OR a
 * matching `?secret=` query param so manual debugging via curl works too.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret") || "";
    const headerOk = auth === `Bearer ${expected}`;
    const queryOk = secret === expected;
    if (!headerOk && !queryOk) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const settings = await getSettings();
  if (!settings.morning_briefing_enabled) {
    return NextResponse.json({
      ok: true,
      skipped: "briefing disabled in admin settings",
    });
  }
  const result = await sendBriefingNow();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
