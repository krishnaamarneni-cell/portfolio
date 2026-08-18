import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATION_HINT = "Run supabase/application_answers.sql in Supabase to enable the answer library.";

function isMissing(message?: string) {
  return /does not exist|schema cache|relation/i.test(message ?? "");
}

/** GET — the reusable screening answers, in display order. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("application_answers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      const missing = isMissing(error.message);
      return NextResponse.json({
        answers: [],
        needsMigration: missing,
        error: missing ? MIGRATION_HINT : error.message,
      });
    }
    return NextResponse.json({ answers: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { answers: [], needsMigration: isMissing(message), error: message },
      { status: isMissing(message) ? 200 : 500 }
    );
  }
}

type PostBody = {
  action?: "create" | "update" | "used";
  id?: string;
  label?: string;
  answer?: string;
  keywords?: string[];
  category?: string;
  sort_order?: number;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;

  try {
    const db = requireSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.action === "create") {
      if (!body.label?.trim() || !body.answer?.trim()) {
        return NextResponse.json({ error: "label and answer are required" }, { status: 400 });
      }
      const { data, error } = await db
        .from("application_answers")
        .insert({
          label: body.label.trim(),
          answer: body.answer.trim(),
          keywords: (body.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean),
          category: body.category?.trim() || "general",
          sort_order: body.sort_order ?? 500,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) {
        return NextResponse.json(
          { error: isMissing(error.message) ? MIGRATION_HINT : error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, id: data.id });
    }

    if (body.action === "update") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const patch: Record<string, unknown> = { updated_at: now };
      if (body.label !== undefined) patch.label = body.label.trim();
      if (body.answer !== undefined) patch.answer = body.answer.trim();
      if (body.category !== undefined) patch.category = body.category.trim() || "general";
      if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
      if (body.keywords !== undefined) {
        patch.keywords = body.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      }
      const { error } = await db.from("application_answers").update(patch).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Bump the counter so the most-used answers can float to the top later.
    if (body.action === "used") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const { data } = await db
        .from("application_answers")
        .select("use_count")
        .eq("id", body.id)
        .maybeSingle();
      await db
        .from("application_answers")
        .update({ use_count: (data?.use_count ?? 0) + 1 })
        .eq("id", body.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: isMissing(message) ? MIGRATION_HINT : message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const db = requireSupabaseAdmin();
    const { error } = await db.from("application_answers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
