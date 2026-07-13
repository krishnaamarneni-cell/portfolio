/**
 * Flush due scheduled posts from `social_queue` (the per-platform "Schedule"
 * button writes rows here with a `due_at`). Called every ~15 min by the social
 * tick cron, so scheduled posts fire close to their time instead of once a day.
 *
 * Each row is claimed atomically (pending -> sending) so two overlapping ticks
 * can never post the same row twice.
 */
import { requireSupabaseAdmin } from "@/lib/supabase";
import { fetchConnector } from "@/lib/content";
import { createBufferPost } from "@/lib/buffer";

export type QueueFlushResult = { processed: number; sent: number; failed: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function flushDueSocialQueue(): Promise<QueueFlushResult> {
  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from("social_queue")
    .select("id, text, channel_id, image_url")
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(20);
  if (error || !due || due.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  const connector = await fetchConnector("buffer").catch(() => null);
  const token = connector?.bearer_token as string | undefined;
  if (!token) return { processed: 0, sent: 0, failed: 0 };

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const item of due) {
    // Atomic claim: only proceed if this tick is the one that flips pending.
    const { data: claimed } = await db
      .from("social_queue")
      .update({ status: "sending" })
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue; // another tick took it

    processed++;
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

    await sleep(1000);
  }

  return { processed, sent, failed };
}
