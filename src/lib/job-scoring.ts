/**
 * Scoring a posting against the candidate.
 *
 * Split into two deliberately separate layers:
 *   - the model judges SKILL FIT, which is a judgement call
 *   - code decides GEOGRAPHY, which is a fact
 *
 * Mixing them failed in practice: with "United States" merely listed in the
 * prompt, a Bangkok role scored 84 because the model optimises skill fit and
 * treats a soft location hint as noise. Anything checkable belongs in code.
 */
import "server-only";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import { matchesLocation } from "@/lib/job-sources";
import type { JobFinderSettings } from "@/lib/job-finder";

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

export type ScoredMatch = {
  score: number;
  recommendation: string;
  matching_skills: string[];
  missing_skills: string[];
  summary: string;
  resume_keywords: string[];
};

export type ScoreTarget = {
  title: string;
  company?: string | null;
  location?: string | null;
  work_type?: string | null;
  salary_range?: string | null;
  description?: string | null;
};

function parseMatch(raw: string): ScoredMatch | null {
  const block = raw.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    const parsed = JSON.parse(block[0]) as Partial<ScoredMatch>;
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

/** Ceiling for a posting outside every preferred location. */
export const OUT_OF_AREA_CAP = 35;

export function locationVerdict(
  location: string | null | undefined,
  preferred: string[]
): { ok: boolean; unknown: boolean } {
  if (!preferred.length) return { ok: true, unknown: false };
  if (!location?.trim() || AMBIGUOUS_LOCATION.test(location)) return { ok: true, unknown: true };
  if (/remote|anywhere|work from home|virtual/i.test(location)) return { ok: true, unknown: false };
  return { ok: preferred.some((p) => matchesLocation(location, p)), unknown: false };
}

export function buildCandidateBlock(settings: JobFinderSettings): string {
  const p = settings.profile;
  return [
    `Summary: ${p.summary}`,
    `Years of experience: ${p.experience_years}`,
    `Education: ${p.education}`,
    `Skills: ${p.skills.join(", ")}`,
    `Target roles: ${p.target_roles.join(", ")}`,
  ].join("\n");
}

/**
 * Score one posting. Returns the geography-adjusted result, ready to persist.
 */
export async function scoreJob(
  apiKey: string,
  job: ScoreTarget,
  settings: JobFinderSettings,
  candidateBlock?: string
): Promise<{ ok: true; match: ScoredMatch } | { ok: false; error: string }> {
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
    // Never pin a model ID — Groq retires them and every agent breaks at once.
    model: resolveAgentModel(null),
    systemPrompt: SYSTEM,
    userPrompt: `CANDIDATE\n${candidateBlock ?? buildCandidateBlock(settings)}\n\nJOB POSTING\n${jobBlock}`,
    maxTokens: 900,
  });

  if (!result.ok || !result.content) {
    return { ok: false, error: result.error ?? "no response" };
  }
  const parsed = parseMatch(result.content);
  if (!parsed) return { ok: false, error: "could not parse response" };

  return { ok: true, match: applyLocationGate(parsed, job.location, settings.locations) };
}

/** Cap and relabel a posting that sits outside the preferred locations. */
export function applyLocationGate(
  match: ScoredMatch,
  location: string | null | undefined,
  preferred: string[]
): ScoredMatch {
  const verdict = locationVerdict(location, preferred);
  if (!verdict.ok) {
    return {
      ...match,
      score: Math.min(match.score, OUT_OF_AREA_CAP),
      recommendation: "skip",
      summary: `Outside your preferred locations (${preferred.join(", ")}) — this role is in ${location}. ${match.summary}`,
    };
  }
  if (verdict.unknown && preferred.length) {
    return {
      ...match,
      summary: `${match.summary} (Location not stated by the source — confirm it before applying.)`,
    };
  }
  return match;
}
