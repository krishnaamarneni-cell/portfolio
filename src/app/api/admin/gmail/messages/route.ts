import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecentMessages } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/gmail/messages?q=…&n=10 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const nParam = url.searchParams.get("n");
  const n = nParam ? Math.max(1, Math.min(50, parseInt(nParam, 10) || 10)) : 10;
  const { messages, error } = await listRecentMessages({ query: q, maxResults: n });
  if (error) {
    return NextResponse.json({ error }, { status: 502 });
  }
  return NextResponse.json({ messages });
}
