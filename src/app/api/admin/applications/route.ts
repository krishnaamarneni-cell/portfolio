import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { prepareApplication, type JobInput } from "@/lib/application-kit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_STATUS = ["prepared", "applied", "interviewing", "rejected", "offer"];

/** GET — list prepared applications (newest first). */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("job_applications")
      .select(
        "id, job_title, company, location, job_url, source, match_pct, tailored_resume, cover_note, screening_answers, keywords, gaps, status, applied_at, notes, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      const missing = /does not exist|schema cache|relation/i.test(error.message ?? "");
      return NextResponse.json({
        applications: [],
        needsMigration: missing,
        error: missing
          ? "Run supabase/application_kit.sql in Supabase to enable the application kit."
          : error.message,
      });
    }
    return NextResponse.json({ applications: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 500 }
    );
  }
}

type PostBody = {
  action?: "prepare" | "status" | "notes";
  job?: JobInput;
  id?: string;
  status?: string;
  notes?: string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;

  try {
    if (body.action === "prepare") {
      if (!body.job?.jobTitle?.trim()) {
        return NextResponse.json({ error: "jobTitle is required" }, { status: 400 });
      }
      const res = await prepareApplication(body.job);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
      return NextResponse.json({ id: res.id, kit: res.kit });
    }

    if (body.action === "status") {
      if (!body.id || !VALID_STATUS.includes(body.status ?? "")) {
        return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
      }
      const db = requireSupabaseAdmin();
      const { error } = await db
        .from("job_applications")
        .update({
          status: body.status,
          // Stamp the moment it actually goes out — the human applies, not us.
          applied_at: body.status === "applied" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "notes") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const db = requireSupabaseAdmin();
      const { error } = await db
        .from("job_applications")
        .update({ notes: body.notes ?? "", updated_at: new Date().toISOString() })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
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
    const { error } = await db.from("job_applications").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
