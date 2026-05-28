import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildBriefing } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const briefing = await buildBriefing();
    return NextResponse.json({
      subject: briefing.subject,
      lifeMarkdown: briefing.lifeMarkdown,
      newsMarkdown: briefing.newsMarkdown,
      stats: briefing.stats,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Build failed" },
      { status: 502 }
    );
  }
}
