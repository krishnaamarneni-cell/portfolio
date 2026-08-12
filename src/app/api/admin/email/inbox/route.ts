import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecentMessages, getThread } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || undefined;
  const max = Math.min(Number(searchParams.get("max")) || 30, 500);
  const threadId = searchParams.get("threadId");

  if (threadId) {
    const thread = await getThread(threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    return NextResponse.json({ thread });
  }

  const { messages, error } = await listRecentMessages({ query, maxResults: max });
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ messages });
}
