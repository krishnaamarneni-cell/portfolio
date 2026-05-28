import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildReflection } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const reflection = await buildReflection();
    return NextResponse.json({
      subject: reflection.subject,
      markdown: reflection.markdown,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Build failed" },
      { status: 502 }
    );
  }
}
