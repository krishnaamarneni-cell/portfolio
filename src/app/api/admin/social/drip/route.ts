import { NextResponse } from "next/server";
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

export async function GET() {
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

  const { data: settings } = await db
    .from("social_drip_settings")
    .select("enabled")
    .eq("id", 1)
    .maybeSingle();

  const rows = (images ?? []) as DripRow[];
  return NextResponse.json({
    images: rows,
    enabled: !!settings?.enabled,
    pending: rows.filter((r) => r.status === "pending").length,
  });
}

type PostBody =
  | { action: "add"; urls: string[] }
  | { action: "remove"; id: string }
  | { action: "toggle"; enabled: boolean }
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
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, added: urls.length });
  }

  if (body.action === "remove") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await db.from("social_drip").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "clear-posted") {
    const { error } = await db
      .from("social_drip")
      .delete()
      .in("status", ["posted", "failed"]);
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

  if (body.action === "post-now") {
    // Manual test — bypasses the enabled switch, posts the next pending image now.
    const result = await processNextDripImage({ ignoreEnabled: true });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
