import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAutopilotSettings,
  updateAutopilotSettings,
  runAutopilot,
  type AutopilotSettings,
} from "@/lib/social-autopilot";
import { getContentProfile, saveContentProfile } from "@/lib/content-curator";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, niche] = await Promise.all([
    getAutopilotSettings(),
    getContentProfile(),
  ]);

  const db = requireSupabaseAdmin();
  const { data: log } = await db
    .from("social_autopilot_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ settings, niche, log: log ?? [] });
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "update") {
    const patch: Partial<AutopilotSettings> = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (Array.isArray(body.platforms)) patch.platforms = body.platforms as string[];
    if (Array.isArray(body.channel_ids)) patch.channel_ids = body.channel_ids as string[];
    if (Array.isArray(body.post_types)) patch.post_types = body.post_types as string[];
    if (Array.isArray(body.topics)) patch.topics = body.topics as string[];
    if (typeof body.post_time === "string") patch.post_time = body.post_time;
    if (typeof body.timezone === "string") patch.timezone = body.timezone;
    const settings = await updateAutopilotSettings(patch);
    return NextResponse.json({ settings });
  }

  if (body.action === "run-now") {
    const result = await runAutopilot({ force: true });
    return NextResponse.json(result);
  }

  if (body.action === "save-niche") {
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    if (!niche) return NextResponse.json({ error: "Niche cannot be empty" }, { status: 400 });
    await saveContentProfile(niche);
    return NextResponse.json({ niche });
  }

  if (body.action === "clear-log") {
    const db = requireSupabaseAdmin();
    await db.from("social_autopilot_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
