import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { fetchConnector } from "@/lib/content";
import { createBufferPost } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type QueueItem = {
  id?: string;
  text: string;
  platform: "linkedin" | "x" | "instagram";
  channel_id: string;
  channel_name?: string;
  image_url?: string;
  due_at: string;
  status?: "pending" | "sent" | "failed";
  error?: string;
  created_at?: string;
  sent_at?: string;
};

/** GET — list queued posts */
export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("social_queue")
    .select("*")
    .order("due_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ queue: data ?? [] });
}

type PostBody = {
  action: "add" | "delete" | "post-now" | "process-due";
  items?: QueueItem[];
  id?: string;
};

/** POST — add to queue, delete, post-now, or process due items */
export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as PostBody;

  if (body.action === "add") {
    return handleAdd(body.items ?? []);
  }
  if (body.action === "delete" && body.id) {
    return handleDelete(body.id);
  }
  if (body.action === "post-now" && body.id) {
    return handlePostNow(body.id);
  }
  if (body.action === "process-due") {
    return handleProcessDue();
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function handleAdd(items: QueueItem[]) {
  if (items.length === 0)
    return NextResponse.json({ error: "No items to add" }, { status: 400 });

  const db = requireSupabaseAdmin();
  const rows = items.map((item) => ({
    text: item.text,
    platform: item.platform,
    channel_id: item.channel_id,
    channel_name: item.channel_name ?? null,
    image_url: item.image_url ?? null,
    due_at: item.due_at,
    status: "pending",
  }));

  const { data, error } = await db
    .from("social_queue")
    .insert(rows)
    .select("id");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ added: data?.length ?? 0, ids: data });
}

async function handleDelete(id: string) {
  const db = requireSupabaseAdmin();
  const { error } = await db.from("social_queue").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

async function handlePostNow(id: string) {
  const db = requireSupabaseAdmin();
  const { data: item } = await db
    .from("social_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (!item)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await firePost(item);

  await db
    .from("social_queue")
    .update({
      status: result.ok ? "sent" : "failed",
      error: result.error ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
    })
    .eq("id", id);

  return NextResponse.json(result);
}

async function handleProcessDue() {
  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: due } = await db
    .from("social_queue")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(20);

  if (!due || due.length === 0)
    return NextResponse.json({ processed: 0, message: "No due posts" });

  let sent = 0;
  let failed = 0;
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const item of due) {
    const result = await firePost(item);
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
    results.push({ id: item.id, ok: result.ok, error: result.error });

    // Rate limit between posts
    if (due.indexOf(item) < due.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed, results });
}

async function firePost(
  item: { channel_id: string; text: string; image_url?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const connector = await fetchConnector("buffer");
  if (!connector?.bearer_token)
    return { ok: false, error: "Buffer connector not configured" };

  const result = await createBufferPost({
    token: connector.bearer_token as string,
    channelId: item.channel_id,
    text: item.text,
    mode: "shareNow",
    imageUrl: item.image_url ?? undefined,
  });

  return { ok: result.ok, error: result.error };
}
