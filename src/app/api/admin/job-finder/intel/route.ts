import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { getJobFinderSettings } from "@/lib/job-finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Market signals derived from the postings already collected.
 *
 * Deliberately not a news feed. Headlines about layoffs are the same for
 * everyone and say nothing about this search; several hundred live postings
 * matched against one profile say who is actually hiring for these skills right
 * now, which skills keep appearing, and where the roles are. That is the
 * intelligence worth having, and it costs one query rather than a subscription.
 */

type Row = {
  company: string | null;
  location: string | null;
  required_skills: string[] | null;
  missing_skills: string[] | null;
  match_score: number | null;
  source_type: string | null;
  created_at: string;
  posted_at: string | null;
  status: string;
};

function topN(counts: Record<string, number>, n: number) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

/** "USA - New Jersey - Rahway" → "New Jersey"; good enough to cluster by region. */
function regionOf(location: string | null): string | null {
  if (!location) return null;
  const parts = location.split(/[-,]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const mid = parts[parts.length - 2];
    if (mid && mid.length > 2 && !/^\d+$/.test(mid)) return mid;
  }
  return parts[0] ?? null;
}

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = requireSupabaseAdmin();
    const settings = await getJobFinderSettings();

    const { data, error } = await db
      .from("job_listings")
      .select("company,location,required_skills,missing_skills,match_score,source_type,created_at,posted_at,status")
      .limit(5000);

    if (error) {
      const missing = /does not exist|schema cache|relation/i.test(error.message);
      return NextResponse.json({
        needsMigration: missing,
        error: missing ? "Run supabase/job_finder.sql in Supabase." : error.message,
      });
    }

    const rows = (data ?? []) as Row[];
    const now = Date.now();
    const DAY = 86_400_000;

    const hiring: Record<string, number> = {};
    const skills: Record<string, number> = {};
    const gaps: Record<string, number> = {};
    const regions: Record<string, number> = {};
    const platforms: Record<string, number> = {};

    let newToday = 0;
    let newThisWeek = 0;
    let strong = 0;
    let good = 0;
    let scoredCount = 0;
    let scoreSum = 0;

    for (const r of rows) {
      const found = Date.parse(r.created_at);
      if (!Number.isNaN(found)) {
        if (now - found < DAY) newToday++;
        if (now - found < 7 * DAY) newThisWeek++;
      }

      // Company and region counts use active roles only — a closed-out listing
      // is not evidence that anyone is hiring today.
      if (r.status === "new" || r.status === "saved") {
        if (r.company) hiring[r.company] = (hiring[r.company] || 0) + 1;
        const region = regionOf(r.location);
        if (region) regions[region] = (regions[region] || 0) + 1;
        if (r.source_type) platforms[r.source_type] = (platforms[r.source_type] || 0) + 1;
        for (const s of r.required_skills ?? []) {
          const k = s.trim();
          if (k) skills[k] = (skills[k] || 0) + 1;
        }
      }

      if (r.match_score !== null && r.match_score >= 0) {
        scoredCount++;
        scoreSum += r.match_score;
        if (r.match_score >= 85) strong++;
        else if (r.match_score >= 70) good++;
        // Gaps only count where the role was otherwise a plausible fit —
        // skills missing from a role you would never take are not a gap worth
        // closing, and would swamp the list.
        if (r.match_score >= 50) {
          for (const s of r.missing_skills ?? []) {
            const k = s.trim();
            if (k) gaps[k] = (gaps[k] || 0) + 1;
          }
        }
      }
    }

    return NextResponse.json({
      totals: {
        tracked: rows.length,
        active: rows.filter((r) => r.status === "new" || r.status === "saved").length,
        newToday,
        newThisWeek,
        scored: scoredCount,
        avgScore: scoredCount ? Math.round(scoreSum / scoredCount) : null,
        strong,
        good,
        minScore: settings.min_match_score,
      },
      hiring: topN(hiring, 8),
      skills: topN(skills, 12),
      gaps: topN(gaps, 8),
      regions: topN(regions, 8),
      platforms: topN(platforms, 8),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 500 }
    );
  }
}
