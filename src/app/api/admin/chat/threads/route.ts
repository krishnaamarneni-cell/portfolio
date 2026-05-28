import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listThreads } from "@/lib/chat-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const threads = await listThreads();
    return NextResponse.json({ threads });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
