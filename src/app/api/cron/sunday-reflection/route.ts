import { NextResponse } from "next/server";
import { getSettings, sendReflectionNow } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
  const settings = await getSettings();
  if (!settings.sunday_reflection_enabled) {
    return NextResponse.json({
      ok: true,
      skipped: "reflection disabled in admin settings",
    });
  }
  const result = await sendReflectionNow();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
