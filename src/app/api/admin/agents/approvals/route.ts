import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { resolveApproval } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("approval_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return NextResponse.json({ approvals: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { approvalId: string; decision: "approved" | "rejected"; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.approvalId || !["approved", "rejected"].includes(body.decision)) {
    return NextResponse.json(
      { error: "approvalId and decision (approved|rejected) required" },
      { status: 400 }
    );
  }
  try {
    const result = await resolveApproval(body.approvalId, body.decision, body.note);
    if (!result) {
      return NextResponse.json(
        { error: "Approval not found or already resolved" },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resolution failed" },
      { status: 500 }
    );
  }
}
