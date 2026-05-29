import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { scanForMemories } from "@/lib/memory-agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
    sinceHours?: number;
  };
  const report = await scanForMemories(body);
  if (report.error) {
    return NextResponse.json(report, { status: 502 });
  }
  return NextResponse.json(report);
}
