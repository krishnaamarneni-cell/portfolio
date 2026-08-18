import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { getJobFinderSettings } from "@/lib/job-finder";
import { buildCandidateBlock, scoreJob } from "@/lib/job-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Manual scoring. The same work happens automatically on the cron, so this is
 * the "score these now" path — the scoring itself lives in lib/job-scoring so
 * both callers apply an identical rubric and the same geography gate.
 */
type Body = { ids?: string[]; rescore?: boolean };

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const db = requireSupabaseAdmin();
  const settings = await getJobFinderSettings();

  let query = db
    .from("job_listings")
    .select("id, title, company, location, work_type, description, salary_range");

  if (body.ids?.length) {
    query = query.in("id", body.ids.slice(0, 15));
  } else {
    // Scored-but-missing-metadata counts as unscored, so listings processed by
    // an older build can still gain the structured fields.
    if (!body.rescore) {
      query = query.or("match_score.is.null,and(match_score.gte.0,required_skills.is.null)");
    }
    query = query.in("status", ["new", "saved"]).order("created_at", { ascending: false }).limit(10);
  }

  const { data: listings, error } = await query;
  if (error) {
    const missing = /does not exist|schema cache|relation/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "Run supabase/job_finder.sql in Supabase to enable the Job Finder."
          : error.message,
      },
      { status: 500 }
    );
  }
  if (!listings?.length) {
    return NextResponse.json({ ok: true, scored: 0, message: "Nothing left to score." });
  }

  const candidateBlock = buildCandidateBlock(settings);
  let scored = 0;
  let relevant = 0;
  const failures: string[] = [];

  for (const job of listings) {
    const res = await scoreJob(apiKey, job, settings, candidateBlock);
    if (!res.ok) {
      failures.push(`${job.title}: ${res.error}`);
      continue;
    }

    const m = res.match;
    const { error: updateError } = await db
      .from("job_listings")
      .update({
        match_score: m.score,
        match_recommendation: m.recommendation,
        match_skills: m.matching_skills,
        missing_skills: m.missing_skills,
        match_summary: m.summary,
        resume_keywords: m.resume_keywords,
        required_skills: m.required_skills.length ? m.required_skills : null,
        seniority: m.seniority,
        work_type: m.work_mode ?? undefined,
        employment_type: m.employment_type,
        sponsorship: m.sponsorship,
        clearance: m.clearance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) failures.push(`${job.title}: ${updateError.message}`);
    else {
      scored++;
      if (m.score >= settings.min_match_score) relevant++;
    }
  }

  return NextResponse.json({ ok: true, scored, relevant, failures: failures.slice(0, 5) });
}
