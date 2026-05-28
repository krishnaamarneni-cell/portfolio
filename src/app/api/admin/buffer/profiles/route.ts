import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUFFER_API = "https://api.bufferapp.com/1";

type BufferProfile = {
  id: string;
  service: string;
  formatted_username: string;
  formatted_service: string;
  avatar?: string;
};

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connector = await fetchConnector("buffer");
  if (!connector || !connector.bearer_token) {
    return NextResponse.json(
      {
        error:
          "Buffer connector not set up. Go to Connectors → add an entry with id 'buffer' and your Buffer access token.",
      },
      { status: 503 }
    );
  }
  try {
    const r = await fetch(
      `${BUFFER_API}/profiles.json?access_token=${encodeURIComponent(connector.bearer_token)}`,
      { cache: "no-store" }
    );
    const text = await r.text();
    if (!r.ok) {
      return NextResponse.json(
        { error: `Buffer returned ${r.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Buffer returned non-JSON" },
        { status: 502 }
      );
    }
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Unexpected Buffer response shape" },
        { status: 502 }
      );
    }
    const profiles: BufferProfile[] = (data as Record<string, unknown>[]).map(
      (p) => ({
        id: String(p.id ?? ""),
        service: String(p.service ?? ""),
        formatted_username: String(p.formatted_username ?? ""),
        formatted_service: String(p.formatted_service ?? ""),
        avatar: typeof p.avatar === "string" ? p.avatar : undefined,
      })
    );
    return NextResponse.json({ profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
