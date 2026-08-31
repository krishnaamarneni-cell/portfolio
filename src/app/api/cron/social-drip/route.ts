import { NextResponse, after } from "next/server";
import { getDripSettings, processNextDripImage } from "@/lib/social-drip";
import { flushDueSocialQueue } from "@/lib/social-queue";
import { runAutopilot } from "@/lib/social-autopilot";
import { getPlaybook } from "@/lib/social-playbook";

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
    // Scheduled per-platform posts (time-sensitive) first, then the daily drip.
    try {
      await flushDueSocialQueue();
    } catch {
      // Per-row status is recorded on social_queue; nothing to return.
    }
    try {
      await processNextDripImage();
    } catch {
      // Failures are recorded on the drip row / settings; nothing to return.
    }
    try {
      await runAutopilot();

      // Refresh what-works at most once a day.
      //
      // Not after every post, despite the temptation: impressions accrue over
      // hours and days, so analysing a post the moment it goes out measures
      // noise and would teach the writer the wrong lesson. Daily is the
      // shortest interval where the numbers have actually moved.
      try {
        const existing = await getPlaybook();
        const ageMs = existing ? Date.now() - Date.parse(existing.analyzedAt) : Infinity;
        if (!Number.isFinite(ageMs) || ageMs > 20 * 60 * 60 * 1000) {
          const base =
            process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
          if (base) {
            await fetch(`${base}/api/admin/social/analytics`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Same secret the cron itself was called with.
                Authorization: request.headers.get("authorization") ?? "",
              },
              body: JSON.stringify({}),
              signal: AbortSignal.timeout(45_000),
            });
          }
        }
      } catch {
        // Learning is a bonus; never fail the posting run over it.
      }
    } catch {
      // Logged in social_autopilot_log; no-op if disabled or outside window.
    }
  });

  return NextResponse.json({ ok: true, scheduled: true });
}
