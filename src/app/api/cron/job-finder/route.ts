import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { runCrawlCycle } from "@/lib/job-crawler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Job Finder automation tick.
 *
 * Driven by GitHub Actions every 15 minutes — Vercel Hobby crons only fire
 * once a day, which is why the other schedules in this project live there too.
 *
 * Auth: `Bearer ${CRON_SECRET}` or `?secret=`, matching the existing cron
 * routes. Safe to call at any cadence: each tick takes a slice of the source
 * list, so overlapping or extra runs just advance the cursor further.
 */

/** Leave headroom under maxDuration so the run log always gets written. */
const BUDGET_MS = 48_000;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const secret = new URL(request.url).searchParams.get("secret") || "";
    if (auth !== `Bearer ${expected}` && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const scoreOnly = url.searchParams.get("mode") === "score";
  const sourcesPerRun = Number(url.searchParams.get("sources")) || undefined;

  const startedAt = new Date().toISOString();

  try {
    const result = await runCrawlCycle({ budgetMs: BUDGET_MS, scoreOnly, sourcesPerRun });

    try {
      const db = requireSupabaseAdmin();
      await db.from("job_crawl_runs").insert({
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        trigger: url.searchParams.get("trigger") || "cron",
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
      // The run log is diagnostic — never fail a good crawl over it.
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Crawl failed";
    return NextResponse.json(
      {
        ok: false,
        error: /does not exist|schema cache|relation/i.test(message)
          ? "Run supabase/job_finder.sql and supabase/job_crawler.sql in Supabase."
          : message,
      },
      { status: 500 }
    );
  }
}
