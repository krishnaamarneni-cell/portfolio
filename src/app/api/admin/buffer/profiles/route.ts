import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { getChannels } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeService(raw: string): string {
  const s = raw.toLowerCase();
  if (s.startsWith("linkedin")) return "linkedin";
  if (s.startsWith("instagram")) return "instagram";
  if (s.startsWith("twitter") || s === "x") return "twitter";
  return s;
}

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connector = await fetchConnector("buffer");
  if (!connector || !connector.bearer_token) {
    return NextResponse.json(
      {
        error:
          "Buffer connector not set up. Go to Connectors → Add Buffer → paste your access token.",
      },
      { status: 503 }
    );
  }
  try {
    const channels = await getChannels(connector.bearer_token);
    const profiles = channels
      .filter((c) => !c.isDisconnected)
      .map((c) => ({
        id: c.id,
        service: normalizeService(c.service),
        formatted_username: c.displayName || c.name,
        formatted_service:
          c.service.charAt(0).toUpperCase() + c.service.slice(1),
        avatar: c.avatar,
      }));
    return NextResponse.json({ profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
