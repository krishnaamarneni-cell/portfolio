import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { orchestrate } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { goal: string; agentSlug?: string; maxTokens?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.goal?.trim()) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }
  try {
    const result = await orchestrate({
      goal: body.goal,
      agentSlug: body.agentSlug,
      maxTokens: body.maxTokens,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dispatch failed" },
      { status: 500 }
    );
  }
}
