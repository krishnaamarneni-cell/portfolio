import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { fetchConnector } from "@/lib/content";
import { createBufferPost } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret") || "";
    if (auth !== `Bearer ${expected}` && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: due } = await db
    .from("social_queue")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(20);

  let sent = 0;
  let failed = 0;

  if (due && due.length > 0) {
    const connector = await fetchConnector("buffer");
    const token = connector?.bearer_token as string | undefined;
    if (!token) {
      return NextResponse.json({ error: "Buffer not configured" }, { status: 503 });
    }

    for (const item of due) {
      const result = await createBufferPost({
        token,
        channelId: item.channel_id,
        text: item.text,
        mode: "shareNow",
        imageUrl: item.image_url ?? undefined,
      });

      await db
        .from("social_queue")
        .update({
          status: result.ok ? "sent" : "failed",
          error: result.error ?? null,
          sent_at: result.ok ? new Date().toISOString() : null,
        })
        .eq("id", item.id);

      if (result.ok) sent++;
      else failed++;

      if (due.indexOf(item) < due.length - 1)
        await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return NextResponse.json({ processed: due?.length ?? 0, sent, failed });
}
