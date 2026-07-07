import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPendingEnrichments, reviewEnrichment } from "@/lib/enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const items = await listPendingEnrichments();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (
    body.action === "review" &&
    typeof body.id === "string" &&
    (body.decision === "approved" || body.decision === "rejected")
  ) {
    await reviewEnrichment(body.id, body.decision);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "batch-review" && Array.isArray(body.items)) {
    for (const item of body.items as Array<{
      id: string;
      decision: "approved" | "rejected";
    }>) {
      await reviewEnrichment(item.id, item.decision);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
