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
    return NextResponse.json({ enrichments: items });
  } catch {
    return NextResponse.json({ enrichments: [] });
  }
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const decision = (body.decision ?? body.status) as string | undefined;

  if (
    body.action === "review" &&
    typeof body.id === "string" &&
    (decision === "approved" || decision === "rejected")
  ) {
    await reviewEnrichment(body.id, decision);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "batch-review") {
    if (Array.isArray(body.items)) {
      for (const item of body.items as Array<{ id: string; decision: string }>) {
        const d = (item.decision ?? decision) as "approved" | "rejected";
        if (d) await reviewEnrichment(item.id, d);
      }
    } else if (Array.isArray(body.ids) && decision) {
      for (const id of body.ids as string[]) {
        await reviewEnrichment(id, decision as "approved" | "rejected");
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
