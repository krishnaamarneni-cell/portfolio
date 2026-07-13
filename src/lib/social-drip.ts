/**
 * Auto-drip: a 15-minute cron calls processNextDripImage(). It only actually
 * posts when the current time (in the admin-chosen timezone) is within a short
 * window around the chosen post_time, and only once per day. Every other tick
 * is a cheap no-op.
 *
 * When it does fire: claim the oldest pending image atomically, generate a
 * per-platform caption (vision), and post to every connected Buffer channel.
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

// How long after the chosen time a 15-min cron is still allowed to fire it.
// 30 min guarantees at least one tick lands inside even with a little drift.
const WINDOW_MINUTES = 30;

export type DripSettings = {
  enabled: boolean;
  post_time: string;
  timezone: string;
  last_posted_on: string | null;
  cron_token: string | null;
};

export type DripReason =
  | "disabled"
  | "empty"
  | "no-buffer"
  | "no-channels"
  | "table-missing"
  | "not-scheduled"
  | "already-today";

export type DripRunResult =
  | { processed: false; reason: DripReason; now?: string; next?: string }
  | {
      processed: true;
      ok: boolean;
      imageUrl: string;
      results: Array<{ service: string; ok: boolean; error?: string }>;
      error?: string;
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Current minutes-since-midnight + YYYY-MM-DD in the given IANA timezone. */
export function nowInTimezone(tz: string): { minutes: number; date: string; label: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = parseInt(get("hour"), 10) % 24; // some ICU builds emit "24" at midnight
  const minute = parseInt(get("minute"), 10);
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { minutes: hour * 60 + minute, date, label };
}

function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || "").trim());
  if (!m) return 9 * 60;
  const h = Math.min(23, parseInt(m[1], 10));
  const min = Math.min(59, parseInt(m[2], 10));
  return h * 60 + min;
}

/** Is `now` inside [scheduled, scheduled + WINDOW) (wrap-aware around midnight)? */
export function isWithinWindow(nowMinutes: number, postTime: string): boolean {
  const sched = parseHHMM(postTime);
  const end = sched + WINDOW_MINUTES;
  if (end <= 1440) return nowMinutes >= sched && nowMinutes < end;
  return nowMinutes >= sched || nowMinutes < end - 1440;
}

export async function getDripSettings(): Promise<DripSettings | null> {
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("social_drip_settings")
      .select("enabled, post_time, timezone, last_posted_on, cron_token")
      .eq("id", 1)
      .maybeSingle();
    if (error) return null;
    return {
      enabled: !!data?.enabled,
      post_time: data?.post_time ?? "09:00",
      timezone: data?.timezone ?? "Asia/Kolkata",
      last_posted_on: data?.last_posted_on ?? null,
      cron_token: data?.cron_token ?? null,
    };
  } catch {
    return null;
  }
}

export async function processNextDripImage(options?: {
  ignoreEnabled?: boolean;
  ignoreSchedule?: boolean;
  markDay?: boolean;
}): Promise<DripRunResult> {
  const db = requireSupabaseAdmin();
  const settings = await getDripSettings();
  if (!settings) return { processed: false, reason: "table-missing" };

  if (!options?.ignoreEnabled && !settings.enabled) {
    return { processed: false, reason: "disabled" };
  }

  const clock = nowInTimezone(settings.timezone);

  if (!options?.ignoreSchedule) {
    if (settings.last_posted_on === clock.date) {
      return { processed: false, reason: "already-today", now: clock.label };
    }
    if (!isWithinWindow(clock.minutes, settings.post_time)) {
      return { processed: false, reason: "not-scheduled", now: clock.label, next: settings.post_time };
    }
  }

  // Atomically claim the oldest pending image so two concurrent ticks can't
  // both grab it (pending -> posting; the .eq("status","pending") is the lock).
  const { data: candidates, error: selErr } = await db
    .from("social_drip")
    .select("id, image_url")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);
  if (selErr) return { processed: false, reason: "table-missing" };
  const candidate = candidates?.[0];
  if (!candidate) return { processed: false, reason: "empty" };

  const { data: claimed } = await db
    .from("social_drip")
    .update({ status: "posting" })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .select("id, image_url");
  if (!claimed || claimed.length === 0) {
    // Lost the race to a concurrent tick.
    return { processed: false, reason: "empty" };
  }
  const item = claimed[0] as { id: string; image_url: string };

  // Mark the day as used up-front (unless this is a manual test) so at most one
  // image posts per day even if the run below fails.
  const markDay = options?.markDay ?? !options?.ignoreSchedule;
  if (markDay) {
    await db
      .from("social_drip_settings")
      .update({ last_posted_on: clock.date, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }

  const gen = await generatePostsFromImage(item.image_url);
  if (!gen.ok) {
    await db.from("social_drip").update({ status: "failed", error: gen.error }).eq("id", item.id);
    return { processed: true, ok: false, imageUrl: item.image_url, results: [], error: gen.error };
  }

  const connector = await fetchConnector("buffer").catch(() => null);
  const token = connector?.bearer_token as string | undefined;
  if (!token) {
    await db
      .from("social_drip")
      .update({ status: "failed", error: "Buffer not configured", linkedin: gen.posts.linkedin, x: gen.posts.x, instagram: gen.posts.instagram })
      .eq("id", item.id);
    return { processed: false, reason: "no-buffer" };
  }

  const channels = await getChannels(token).catch(() => []);
  const targets = channels.filter((c) => !c.isDisconnected && SERVICE_FIELD[c.service] !== undefined);
  if (targets.length === 0) {
    await db
      .from("social_drip")
      .update({ status: "failed", error: "No connected LinkedIn/X/Instagram channels", linkedin: gen.posts.linkedin, x: gen.posts.x, instagram: gen.posts.instagram })
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
      imageUrl: item.image_url,
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
