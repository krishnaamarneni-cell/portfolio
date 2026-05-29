import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listSuggestions } from "@/lib/memory-agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "pending") as
    | "pending"
    | "accepted"
    | "rejected"
    | "all";
  const suggestions = await listSuggestions({ status });
  return NextResponse.json({ suggestions });
}
