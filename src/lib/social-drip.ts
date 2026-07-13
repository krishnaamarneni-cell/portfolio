/**
 * Auto-drip: pick the oldest pending image from `social_drip`, generate a
 * per-platform caption from it (vision), and post it to every connected Buffer
 * channel. Called once per day from the social-queue cron.
 */
import { requireSupabaseAdmin } from "@/lib/supabase";
import { fetchConnector } from "@/lib/content";
import { getChannels, createBufferPost } from "@/lib/buffer";
import { generatePostsFromImage } from "@/lib/image-to-post";

// Buffer service name -> which generated caption to use.
const SERVICE_FIELD: Record<string, "linkedin" | "x" | "instagram"> = {
  linkedin: "linkedin",
  twitter: "x",
  instagram: "instagram",
};

export type DripRunResult =
  | { processed: false; reason: "disabled" | "empty" | "no-buffer" | "no-channels" | "table-missing" }
  | {
      processed: true;
      ok: boolean;
      imageUrl: string;
      results: Array<{ service: string; ok: boolean; error?: string }>;
      error?: string;
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Returns true only if the drip switch row exists and is enabled. */
export async function isDripEnabled(): Promise<boolean> {
  try {
    const db = requireSupabaseAdmin();
    const { data } = await db
      .from("social_drip_settings")
      .select("enabled")
      .eq("id", 1)
      .maybeSingle();
    return !!data?.enabled;
  } catch {
    return false;
  }
}

export async function processNextDripImage(options?: {
  ignoreEnabled?: boolean;
}): Promise<DripRunResult> {
  const db = requireSupabaseAdmin();

  if (!options?.ignoreEnabled) {
    const enabled = await isDripEnabled().catch(() => false);
    if (!enabled) return { processed: false, reason: "disabled" };
  }

  // Oldest pending image.
  const { data: rows, error: selErr } = await db
    .from("social_drip")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);
  if (selErr) {
    // Most likely the table hasn't been created yet.
    return { processed: false, reason: "table-missing" };
  }
  const item = rows?.[0];
  if (!item) return { processed: false, reason: "empty" };

  const connector = await fetchConnector("buffer").catch(() => null);
  const token = connector?.bearer_token as string | undefined;
  if (!token) {
    await db.from("social_drip").update({ status: "failed", error: "Buffer not configured" }).eq("id", item.id);
    return { processed: false, reason: "no-buffer" };
  }

  // Generate the captions from the image.
  const gen = await generatePostsFromImage(item.image_url as string);
  if (!gen.ok) {
    await db.from("social_drip").update({ status: "failed", error: gen.error }).eq("id", item.id);
    return { processed: true, ok: false, imageUrl: item.image_url, results: [], error: gen.error };
  }

  const channels = await getChannels(token).catch(() => []);
  const targets = channels.filter(
    (c) => !c.isDisconnected && SERVICE_FIELD[c.service] !== undefined
  );
  if (targets.length === 0) {
    await db
      .from("social_drip")
      .update({
        status: "failed",
        error: "No connected LinkedIn/X/Instagram channels",
        linkedin: gen.posts.linkedin,
        x: gen.posts.x,
        instagram: gen.posts.instagram,
      })
      .eq("id", item.id);
    return { processed: false, reason: "no-channels" };
  }

  const results: Array<{ service: string; ok: boolean; error?: string }> = [];
  for (const ch of targets) {
    const field = SERVICE_FIELD[ch.service];
    const text = (gen.posts[field] || gen.posts.linkedin || "").trim();
    if (!text) {
      results.push({ service: ch.service, ok: false, error: "No caption for platform" });
      continue;
    }
    const r = await createBufferPost({
      token,
      channelId: ch.id,
      text,
      mode: "shareNow",
      imageUrl: item.image_url as string,
    });
    results.push({ service: ch.service, ok: r.ok, error: r.error });
    await sleep(1000);
  }

  const anyOk = results.some((r) => r.ok);
  await db
    .from("social_drip")
    .update({
      status: anyOk ? "posted" : "failed",
      linkedin: gen.posts.linkedin,
      x: gen.posts.x,
      instagram: gen.posts.instagram,
      error: anyOk ? null : results.map((r) => r.error).filter(Boolean).join("; ") || null,
      posted_at: anyOk ? new Date().toISOString() : null,
    })
    .eq("id", item.id);

  return { processed: true, ok: anyOk, imageUrl: item.image_url, results };
}
