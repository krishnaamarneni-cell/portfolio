import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { acceptSuggestion, rejectSuggestion } from "@/lib/memory-agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "accept" | "reject";
    data?: Record<string, unknown>;
  };
  if (body.action === "reject") {
    await rejectSuggestion(id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "accept") {
    const result = await acceptSuggestion(id, body.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, resourceId: result.resourceId });
  }
  return NextResponse.json({ error: "action must be accept or reject" }, { status: 400 });
}
