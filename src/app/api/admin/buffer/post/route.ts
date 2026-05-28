import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { createBufferPost } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  text?: string;
  profile_ids?: string[];
  media_url?: string;
  /** "now" — post immediately; "queue" — append to Buffer's queue;
   * ISO date — custom-schedule at that time. */
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
  const ids = (body.profile_ids ?? []).filter(Boolean);
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "At least one channel id is required" },
      { status: 400 }
    );
  }

  // Decide the share mode + scheduled time.
  let mode: "shareNow" | "addToQueue" | "customScheduled" = "addToQueue";
  let dueAt: string | undefined;
  if (body.when === "now") {
    mode = "shareNow";
  } else if (body.when && body.when !== "queue") {
    const d = new Date(body.when);
    if (Number.isFinite(d.getTime())) {
      mode = "customScheduled";
      dueAt = d.toISOString();
    }
  }

  const results = await Promise.all(
    ids.map((channelId) =>
      createBufferPost({
        token: connector.bearer_token as string,
        channelId,
        text,
        mode,
        dueAt,
        imageUrl: body.media_url,
      })
    )
  );

  const allOk = results.every((r) => r.ok);
  const status = allOk ? 200 : results.some((r) => r.ok) ? 207 : 502;
  return NextResponse.json(
    {
      ok: allOk,
      mode,
      results,
      error: allOk
        ? undefined
        : results
            .filter((r) => !r.ok)
            .map((r) => `${r.channelId}: ${r.error}`)
            .join(" · "),
    },
    { status }
  );
}
