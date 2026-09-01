import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    morning_briefing_enabled?: boolean;
    morning_briefing_to?: string | null;
    sunday_reflection_enabled?: boolean;
    sunday_reflection_to?: string | null;
    auto_reply_enabled?: boolean;
    warm_outreach_enabled?: boolean;
  };
  const settings = await updateSettings({
    morning_briefing_enabled: body.morning_briefing_enabled,
    morning_briefing_to: body.morning_briefing_to,
    sunday_reflection_enabled: body.sunday_reflection_enabled,
    sunday_reflection_to: body.sunday_reflection_to,
    auto_reply_enabled: body.auto_reply_enabled,
    warm_outreach_enabled: body.warm_outreach_enabled,
  });
  return NextResponse.json({ settings });
}
