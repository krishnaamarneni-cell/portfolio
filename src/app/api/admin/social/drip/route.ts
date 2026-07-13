import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { processNextDripImage } from "@/lib/social-drip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DripRow = {
  id: string;
  image_url: string;
  status: string;
  error: string | null;
  created_at: string;
  posted_at: string | null;
};

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = requireSupabaseAdmin();

  const { data: images, error } = await db
    .from("social_drip")
    .select("id, image_url, status, error, created_at, posted_at")
    .order("created_at", { ascending: true });

  if (error) {
    // Table not created yet — tell the UI to prompt for the migration.
    return NextResponse.json({ images: [], enabled: false, needsMigration: true });
  }

  let { data: settings } = await db
    .from("social_drip_settings")
    .select("enabled, post_time, timezone, cron_token")
    .eq("id", 1)
    .maybeSingle();

  // Provision a stable token for the public cron URL on first view.
  if (!settings?.cron_token) {
    const cron_token = randomUUID();
    await db.from("social_drip_settings").upsert({ id: 1, cron_token });
    settings = { ...(settings ?? { enabled: false, post_time: "09:00", timezone: "Asia/Kolkata" }), cron_token };
  }

  const origin = new URL(request.url).origin;
  const cronUrl = `${origin}/api/cron/social-drip?token=${settings.cron_token}`;

  const rows = (images ?? []) as DripRow[];
  return NextResponse.json({
    images: rows,
    enabled: !!settings?.enabled,
    post_time: settings?.post_time ?? "09:00",
    timezone: settings?.timezone ?? "Asia/Kolkata",
    pending: rows.filter((r) => r.status === "pending").length,
    cronUrl,
  });
}

type PostBody =
  | { action: "add"; urls: string[] }
  | { action: "remove"; id: string }
  | { action: "toggle"; enabled: boolean }
  | { action: "schedule"; post_time?: string; timezone?: string }
  | { action: "post-now" }
  | { action: "clear-posted" };

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = requireSupabaseAdmin();

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "add") {
    const urls = (body.urls ?? [])
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 100);
    if (urls.length === 0) {
      return NextResponse.json({ error: "No valid image URLs" }, { status: 400 });
    }
    const { error } = await db
      .from("social_drip")
      .insert(urls.map((image_url) => ({ image_url })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, added: urls.length });
  }

  if (body.action === "remove") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await db.from("social_drip").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "clear-posted") {
    const { error } = await db.from("social_drip").delete().in("status", ["posted", "failed"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle") {
    const { error } = await db
      .from("social_drip_settings")
      .upsert({ id: 1, enabled: !!body.enabled, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, enabled: !!body.enabled });
  }

  if (body.action === "schedule") {
    const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
    if (typeof body.post_time === "string") {
      if (!/^\d{1,2}:\d{2}$/.test(body.post_time)) {
        return NextResponse.json({ error: "post_time must be HH:MM" }, { status: 400 });
      }
      patch.post_time = body.post_time;
    }
    if (typeof body.timezone === "string") {
      if (!isValidTimezone(body.timezone)) {
        return NextResponse.json({ error: "Unknown timezone" }, { status: 400 });
      }
      patch.timezone = body.timezone;
    }
    const { error } = await db.from("social_drip_settings").upsert(patch);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "post-now") {
    // Manual test — bypass switch + schedule, and don't consume today's slot.
    const result = await processNextDripImage({
      ignoreEnabled: true,
      ignoreSchedule: true,
      markDay: false,
    });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
