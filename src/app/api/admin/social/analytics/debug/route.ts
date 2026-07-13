import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { debugSentPostsRaw } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reveals exactly what analytics Buffer returns for this account, so we can
 *  tell whether impressions are available (and in what shape) vs a plan limit. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connector = await fetchConnector("buffer");
  if (!connector?.bearer_token) {
    return NextResponse.json({ error: "Buffer not configured" }, { status: 503 });
  }
  const debug = await debugSentPostsRaw(connector.bearer_token);
  return NextResponse.json(debug);
}
