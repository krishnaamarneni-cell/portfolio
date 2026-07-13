import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IdeaRow = {
  id: string;
  topic: string;
  note: string | null;
  source: string | null;
  status: string;
  created_at: string;
};

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("social_ideas")
    .select("id, topic, note, source, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ ideas: [], needsMigration: true });
  }
  const ideas = (data ?? []) as IdeaRow[];
  return NextResponse.json({
    ideas,
    newCount: ideas.filter((i) => i.status === "new").length,
  });
}

type PostBody =
  | { action: "add"; topic: string; note?: string; source?: string }
  | { action: "remove"; id: string }
  | { action: "status"; id: string; status: "new" | "drafted" | "dismissed" };

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
    const topic = (body.topic ?? "").trim();
    if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });
    const { error } = await db.from("social_ideas").insert({
      topic: topic.slice(0, 500),
      note: (body.note ?? "").slice(0, 1000) || null,
      source: (body.source ?? "manual").slice(0, 40),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await db.from("social_ideas").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "status") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await db
      .from("social_ideas")
      .update({ status: body.status })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
