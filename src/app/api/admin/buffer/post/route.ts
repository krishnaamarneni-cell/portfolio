import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUFFER_API = "https://api.bufferapp.com/1";

type Body = {
  text?: string;
  profile_ids?: string[];
  media_url?: string;
  /** "now" — post immediately; "queue" — append to Buffer queue;
   * ISO date — schedule at that time. */
  when?: "now" | "queue" | string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connector = await fetchConnector("buffer");
  if (!connector || !connector.bearer_token) {
    return NextResponse.json(
      { error: "Buffer connector not configured" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const profileIds = (body.profile_ids ?? []).filter(Boolean);
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (profileIds.length === 0) {
    return NextResponse.json(
      { error: "At least one profile_id is required" },
      { status: 400 }
    );
  }

  const form = new URLSearchParams();
  form.append("access_token", connector.bearer_token);
  form.append("text", text);
  for (const id of profileIds) form.append("profile_ids[]", id);

  if (body.media_url) {
    form.append("media[link]", body.media_url);
    form.append("media[picture]", body.media_url);
    form.append("media[thumbnail]", body.media_url);
  }
  if (body.when === "now") {
    form.append("now", "true");
  } else if (body.when && body.when !== "queue") {
    const date = new Date(body.when);
    if (Number.isFinite(date.getTime())) {
      form.append("scheduled_at", String(Math.floor(date.getTime() / 1000)));
    }
  }
  // when === "queue" or undefined → Buffer appends to queue (default)

  try {
    const r = await fetch(`${BUFFER_API}/updates/create.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.success === false) {
      return NextResponse.json(
        {
          error:
            (data?.message as string) ||
            `Buffer returned ${r.status}`,
          buffer: data,
        },
        { status: r.ok ? 502 : r.status }
      );
    }
    return NextResponse.json({ ok: true, buffer: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
