import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendBriefingNow } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendBriefingNow();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
