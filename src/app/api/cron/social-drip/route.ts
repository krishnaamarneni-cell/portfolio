import { NextResponse } from "next/server";
import { getDripSettings, processNextDripImage } from "@/lib/social-drip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Public endpoint for an external scheduler (cron-job.org) to hit every ~15 min.
 * It is a no-op unless the current time matches the schedule set in the admin
 * UI. Gate it with the per-install `?token=` (shown in the admin panel) or a
 * `Bearer ${CRON_SECRET}` header.
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

  const result = await processNextDripImage();
  return NextResponse.json(result);
}
