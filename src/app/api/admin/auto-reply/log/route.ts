import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the auto-reply did, and why.
 *
 * Answers the question the Settings card could not: did it read this email and
 * score it low, or did it never run at all? Those look identical from an empty
 * inbox, and telling them apart previously meant opening GitHub Actions.
 */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = requireSupabaseAdmin();

  const { data: settings } = await db
    .from("admin_settings")
    .select("auto_reply_last_run_at,auto_reply_last_summary")
    .eq("id", "singleton")
    .maybeSingle();

  const { data: rows, error } = await db
    .from("auto_reply_log")
    .select("from_email,subject,category,match_pct,decision,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  // A missing table is a setup step, not a failure — say which migration.
  if (error) {
    return NextResponse.json({
      lastRunAt: settings?.auto_reply_last_run_at ?? null,
      lastSummary: settings?.auto_reply_last_summary ?? null,
      decisions: [],
      setupNeeded: /does not exist|schema cache|relation/i.test(error.message)
        ? "Run supabase/auto_reply_log.sql to see per-email decisions."
        : error.message,
    });
  }

  return NextResponse.json({
    lastRunAt: settings?.auto_reply_last_run_at ?? null,
    lastSummary: settings?.auto_reply_last_summary ?? null,
    decisions: rows ?? [],
  });
}
