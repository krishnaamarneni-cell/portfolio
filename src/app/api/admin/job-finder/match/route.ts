import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import { getJobFinderSettings } from "@/lib/job-finder";
import { matchesLocation } from "@/lib/job-sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `You score how well a job posting fits one specific candidate.

Return ONLY a JSON object. No prose, no markdown fences.

{
  "score": 0-100,
  "recommendation": "strong" | "good" | "stretch" | "skip",
  "matching_skills": ["..."],
  "missing_skills": ["..."],
  "summary": "two sentences, plain language, why this score",
  "resume_keywords": ["exact phrases from the posting worth mirroring in a resume"]
}

Scoring guide:
- 85-100 "strong": core responsibilities are what the candidate already does daily.
- 70-84 "good": clear overlap, one or two gaps that experience covers.
- 50-69 "stretch": adjacent role, real gaps, worth applying only if motivated.
- 0-49 "skip": wrong domain, wrong seniority, or requires credentials they lack.

Score SKILL AND EXPERIENCE FIT ONLY. Do not raise or lower the score for the
job's location — geography is checked separately, and adjusting for it here
would penalise the posting twice.

Be honest. Inflated scores are worse than low ones — they waste the candidate's time.`;

type MatchResult = {
  score: number;
  recommendation: string;
  matching_skills: string[];
  missing_skills: string[];
  summary: string;
  resume_keywords: string[];
};

function parseMatch(raw: string): MatchResult | null {
  const block = raw.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    const parsed = JSON.parse(block[0]) as Partial<MatchResult>;
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      recommendation: String(parsed.recommendation ?? "stretch"),
      matching_skills: Array.isArray(parsed.matching_skills) ? parsed.matching_skills.map(String) : [],
      missing_skills: Array.isArray(parsed.missing_skills) ? parsed.missing_skills.map(String) : [],
      summary: String(parsed.summary ?? ""),
      resume_keywords: Array.isArray(parsed.resume_keywords) ? parsed.resume_keywords.map(String) : [],
    };
  } catch {
    return null;
  }
}

/** Workday's stand-ins for "we aren't saying where" — not a real mismatch. */
const AMBIGUOUS_LOCATION = /^\s*(\d+\s+locations?|multiple\s+locations?|location\s+negotiable|various)\s*$/i;

/**
 * Is this posting somewhere the candidate will actually work?
 *
 * Deterministic on purpose. Asking the model to weigh location produced an 84
 * for a Bangkok role under a United-States preference — it optimises for skill
 * fit and quietly ignores a soft instruction. A geography check is a fact, so
 * it belongs in code, not in a prompt.
 */
function locationVerdict(
  location: string | null,
  preferred: string[]
): { ok: boolean; unknown: boolean } {
  if (!preferred.length) return { ok: true, unknown: false };
  if (!location?.trim() || AMBIGUOUS_LOCATION.test(location)) return { ok: true, unknown: true };
  if (/remote|anywhere|work from home|virtual/i.test(location)) return { ok: true, unknown: false };
  return { ok: preferred.some((p) => matchesLocation(location, p)), unknown: false };
}

/** Ceiling for a posting outside every preferred location. */
const OUT_OF_AREA_CAP = 35;

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

  // Explicit ids, or the oldest unscored listings.
  let query = db
    .from("job_listings")
    .select("id, title, company, location, work_type, description, salary_range");

  if (body.ids?.length) {
    query = query.in("id", body.ids.slice(0, 15));
  } else {
    if (!body.rescore) query = query.is("match_score", null);
    query = query.in("status", ["new", "saved"]).order("created_at", { ascending: false }).limit(10);
  }

  const { data: listings, error } = await query;
  if (error) {
    const missing = /does not exist|schema cache|relation/i.test(error.message);
    return NextResponse.json(
      { error: missing ? "Run supabase/job_finder.sql in Supabase to enable the Job Finder." : error.message },
      { status: 500 }
    );
  }
  if (!listings?.length) {
    return NextResponse.json({ ok: true, scored: 0, message: "Nothing left to score." });
  }

  const profile = settings.profile;
  const candidateBlock = [
    `Summary: ${profile.summary}`,
    `Years of experience: ${profile.experience_years}`,
    `Education: ${profile.education}`,
    `Skills: ${profile.skills.join(", ")}`,
    `Target roles: ${profile.target_roles.join(", ")}`,
    settings.locations.length ? `Preferred locations: ${settings.locations.join(", ")}` : "",
    settings.work_types.length ? `Preferred work types: ${settings.work_types.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let scored = 0;
  const failures: string[] = [];

  for (const job of listings) {
    const jobBlock = [
      `Title: ${job.title}`,
      job.company ? `Company: ${job.company}` : "",
      job.location ? `Location: ${job.location}` : "",
      job.work_type ? `Work type: ${job.work_type}` : "",
      job.salary_range ? `Salary: ${job.salary_range}` : "",
      job.description ? `Description:\n${String(job.description).slice(0, 6000)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runAgent({
      apiKey,
      // Never pin a model ID here — Groq retires them. resolveAgentModel gives
      // the configured default and runAgent drops any ID Groq no longer serves.
      model: resolveAgentModel(null),
      systemPrompt: SYSTEM,
      userPrompt: `CANDIDATE\n${candidateBlock}\n\nJOB POSTING\n${jobBlock}`,
      maxTokens: 900,
    });

    if (!result.ok || !result.content) {
      failures.push(`${job.title}: ${result.error ?? "no response"}`);
      continue;
    }

    const match = parseMatch(result.content);
    if (!match) {
      failures.push(`${job.title}: could not parse response`);
      continue;
    }

    // Geography gate, applied after the model has judged skill fit.
    const verdict = locationVerdict(job.location, settings.locations);
    let score = match.score;
    let recommendation = match.recommendation;
    let summary = match.summary;

    if (!verdict.ok) {
      score = Math.min(score, OUT_OF_AREA_CAP);
      recommendation = "skip";
      summary = `Outside your preferred locations (${settings.locations.join(", ")}) — this role is in ${job.location}. ${summary}`;
    } else if (verdict.unknown && settings.locations.length) {
      summary = `${summary} (Location not stated by the source — confirm it before applying.)`;
    }

    const { error: updateError } = await db
      .from("job_listings")
      .update({
        match_score: score,
        match_recommendation: recommendation,
        match_skills: match.matching_skills,
        missing_skills: match.missing_skills,
        match_summary: summary,
        resume_keywords: match.resume_keywords,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) failures.push(`${job.title}: ${updateError.message}`);
    else scored++;
  }

  return NextResponse.json({ ok: true, scored, failures: failures.slice(0, 5) });
}
