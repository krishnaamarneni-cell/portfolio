import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { getCrawlStats, runCrawlCycle } from "@/lib/job-crawler";
import { sourceCounts, ATS_SOURCES } from "@/lib/ats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MIGRATION_HINT = "Run supabase/job_crawler.sql in Supabase to enable automation.";

function isMissing(message?: string) {
  return /does not exist|schema cache|relation|column/i.test(message ?? "");
}

/** GET — automation status: totals, recent runs, per-source health. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counts = sourceCounts();
  try {
    const db = requireSupabaseAdmin();
    const stats = await getCrawlStats();

    const { data: runs, error: runsError } = await db
      .from("job_crawl_runs")
      .select("started_at,sources_checked,jobs_seen,jobs_added,jobs_scored,relevant_found,duration_ms,ok,errors,trigger")
      .order("started_at", { ascending: false })
      .limit(12);

    if (runsError && isMissing(runsError.message)) {
      return NextResponse.json({ stats, counts, runs: [], health: [], needsMigration: true, error: MIGRATION_HINT });
    }

    const { data: health } = await db
      .from("job_source_health")
      .select("company,kind,last_checked_at,last_ok,last_error,last_jobs_found,total_jobs_found,consecutive_failures")
      .order("total_jobs_found", { ascending: false })
      .limit(100);

    // Sources the cursor has not reached yet show as pending rather than absent.
    const seen = new Set((health ?? []).map((h) => `${h.company}|${h.kind}`));
    const pending = ATS_SOURCES.filter((s) => !seen.has(`${s.company}|${s.kind}`)).length;

    return NextResponse.json({
      stats,
      counts,
      runs: runs ?? [],
      health: health ?? [],
      pending,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { stats: null, counts, runs: [], health: [], needsMigration: isMissing(message), error: message },
      { status: isMissing(message) ? 200 : 500 }
    );
  }
}

/** POST — run one cycle now, so the automation can be tested without waiting. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { scoreOnly?: boolean };

  try {
    const result = await runCrawlCycle({ budgetMs: 45_000, scoreOnly: body.scoreOnly });

    try {
      const db = requireSupabaseAdmin();
      await db.from("job_crawl_runs").insert({
        finished_at: new Date().toISOString(),
        trigger: "manual",
        sources_checked: result.sourcesChecked,
        jobs_seen: result.jobsSeen,
        jobs_added: result.jobsAdded,
        jobs_scored: result.jobsScored,
        relevant_found: result.relevantFound,
        cursor_start: result.cursorStart,
        cursor_end: result.cursorEnd,
        duration_ms: result.durationMs,
        errors: result.errors.length ? result.errors : null,
        ok: result.errors.length === 0,
      });
    } catch {
      // Diagnostic only.
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed";
    return NextResponse.json({ error: isMissing(message) ? MIGRATION_HINT : message }, { status: 500 });
  }
}
