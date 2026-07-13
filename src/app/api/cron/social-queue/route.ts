import { NextResponse } from "next/server";
import { flushDueSocialQueue } from "@/lib/social-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Flush due scheduled posts. Kept as a once-a-day Vercel-cron backup; the
 * primary driver is the 15-min social tick at /api/cron/social-drip. Both use
 * the same atomic-claim flush, so running together never double-posts.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const secret = new URL(request.url).searchParams.get("secret") || "";
    if (auth !== `Bearer ${expected}` && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await flushDueSocialQueue();
  return NextResponse.json(result);
}
