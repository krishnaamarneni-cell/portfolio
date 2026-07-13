import { NextResponse, after } from "next/server";
import { getDripSettings, processNextDripImage } from "@/lib/social-drip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Public endpoint for an external scheduler (Supabase cron / cron-job.org) to
 * hit every ~15 min. Gate it with the per-install `?token=` (shown in the admin
 * panel) or a `Bearer ${CRON_SECRET}` header.
 *
 * It replies IMMEDIATELY and does the real work (vision caption + posting to
 * all platforms, ~10-15s) in the background via `after()`. That matters because
 * schedulers cap the request timeout low (Supabase cron = 5s max) — we must not
 * make them wait for the posting to finish. Vercel keeps the background task
 * alive up to `maxDuration`.
 *
 * The work is a no-op unless the current time matches the schedule set in the
 * admin UI, so most ticks finish instantly anyway.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const auth = request.headers.get("authorization") || "";

  const settings = await getDripSettings();
  const cronToken = settings?.cron_token || "";
  const secret = process.env.CRON_SECRET || "";

  const tokenOk = cronToken.length > 0 && token === cronToken;
  const secretOk = secret.length > 0 && (auth === `Bearer ${secret}` || token === secret);
  if (!tokenOk && !secretOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      await processNextDripImage();
    } catch {
      // Failures are recorded on the drip row / settings; nothing to return.
    }
  });

  return NextResponse.json({ ok: true, scheduled: true });
}
