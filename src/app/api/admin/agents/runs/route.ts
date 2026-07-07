import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecentRuns } from "@/lib/task-thread";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const slug = url.searchParams.get("agent") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  try {
    const runs = await listRecentRuns({ agent_slug: slug, limit });
    return NextResponse.json({ runs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
