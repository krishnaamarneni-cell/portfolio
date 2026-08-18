/**
 * The automation loop behind Job Finder.
 *
 * A serverless function gets tens of seconds, not minutes, so a run cannot
 * sweep every employer. Instead each tick takes a slice of the source list,
 * advances a stored cursor, and the next tick continues from there — so a
 * schedule running all day covers everything repeatedly without any single
 * request risking a timeout.
 *
 * Time is the budget that matters, so the loop is deadline-driven rather than
 * count-driven: it keeps working until the clock says stop, which adapts on its
 * own when a source is slow or the model is busy.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { ATS_SOURCES, fetchFromSource, type AtsSource } from "@/lib/ats";
import {
  bulkUpsertListings,
  getJobFinderSettings,
  type JobFinderSettings,
} from "@/lib/job-finder";
import { buildCandidateBlock, locationVerdict, scoreJob } from "@/lib/job-scoring";
import type { SourcedJob } from "@/lib/job-sources";

export type CrawlResult = {
  sourcesChecked: number;
  jobsSeen: number;
  jobsAdded: number;
  /** Postings discarded for being outside the preferred locations. */
  outOfArea: number;
  jobsScored: number;
  relevantFound: number;
  cursorStart: number;
  cursorEnd: number;
  durationMs: number;
  errors: string[];
  timedOut: boolean;
};

type CrawlerState = { cursor?: number; lastRunAt?: string };

async function getState(): Promise<CrawlerState> {
  try {
    const db = requireSupabaseAdmin();
    const { data } = await db
      .from("admin_settings")
      .select("job_crawler_state")
      .eq("id", "singleton")
      .maybeSingle();
    const s = data?.job_crawler_state;
    return s && typeof s === "object" ? (s as CrawlerState) : {};
  } catch {
    return {};
  }
}

/**
 * Persist the cursor. Returns an error string rather than swallowing it: if
 * this silently no-ops, every run restarts from source 0 and the crawl never
 * advances past its first slice while still reporting success.
 */
async function saveState(state: CrawlerState): Promise<string | null> {
  try {
    const db = requireSupabaseAdmin();
    const { error } = await db
      .from("admin_settings")
      .update({ job_crawler_state: state })
      .eq("id", "singleton");
    if (!error) return null;
    return /does not exist|schema cache|column/i.test(error.message)
      ? "Cursor not saved — run supabase/job_crawler.sql, or every run re-checks the same employers."
      : `Cursor not saved: ${error.message}`;
  } catch (err) {
    return `Cursor not saved: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

function inferWorkType(location: string | null): string | null {
  if (!location) return null;
  const l = location.toLowerCase();
  if (l.includes("remote")) return "remote";
  if (l.includes("hybrid")) return "hybrid";
  return null;
}

/**
 * Posting age arrives either as an ISO date or as Workday's phrasing, which
 * caps at "30+ Days Ago" — the `+` must be tolerated or the most common format
 * parses to null and the listing looks undated.
 */
function parsePostedOn(postedOn: string | null): string | null {
  if (!postedOn) return null;
  const days = postedOn.match(/(\d+)\s*\+?\s*day/i);
  if (days) return new Date(Date.now() - Number(days[1]) * 86_400_000).toISOString();
  const months = postedOn.match(/(\d+)\s*\+?\s*month/i);
  if (months) return new Date(Date.now() - Number(months[1]) * 30 * 86_400_000).toISOString();
  if (/today|just posted/i.test(postedOn)) return new Date().toISOString();
  if (/yesterday/i.test(postedOn)) return new Date(Date.now() - 86_400_000).toISOString();
  const parsed = Date.parse(postedOn);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

async function recordSourceHealth(
  source: AtsSource,
  ok: boolean,
  found: number,
  error: string | null
): Promise<void> {
  try {
    const db = requireSupabaseAdmin();
    const { data: existing } = await db
      .from("job_source_health")
      .select("id,total_jobs_found,consecutive_failures")
      .eq("company", source.company)
      .eq("kind", source.kind)
      .maybeSingle();

    const patch = {
      company: source.company,
      kind: source.kind,
      last_checked_at: new Date().toISOString(),
      last_ok: ok,
      last_error: error,
      last_jobs_found: found,
      total_jobs_found: (existing?.total_jobs_found ?? 0) + found,
      consecutive_failures: ok ? 0 : (existing?.consecutive_failures ?? 0) + 1,
    };

    if (existing) await db.from("job_source_health").update(patch).eq("id", existing.id);
    else await db.from("job_source_health").insert(patch);
  } catch {
    // Health tracking is diagnostic; never let it fail a crawl.
  }
}

/** How many sources to sweep per tick before switching to scoring. */
const SOURCES_PER_RUN = 12;
/** Stop starting new work once this much of the budget is gone. */
const CRAWL_SHARE = 0.55;

export async function runCrawlCycle(opts: {
  budgetMs: number;
  sourcesPerRun?: number;
  /** Skip the fetch phase and spend the whole budget scoring. */
  scoreOnly?: boolean;
}): Promise<CrawlResult> {
  const start = Date.now();
  const deadline = start + opts.budgetMs;
  const errors: string[] = [];

  const settings = await getJobFinderSettings();
  const state = await getState();
  const cursorStart = state.cursor ?? 0;
  let cursor = cursorStart;

  // Workday can filter by country itself; a location string like "Location
  // Negotiable" cannot be judged after the fact, so prefer the source filter.
  const preferredCountry = settings.locations.find((l) =>
    /^(united states|usa?|america)$/i.test(l.trim())
  );

  let sourcesChecked = 0;
  let jobsSeen = 0;
  let jobsAdded = 0;
  let outOfArea = 0;

  // ── Phase 1: sweep a slice of the source list ──
  if (!opts.scoreOnly && ATS_SOURCES.length) {
    const crawlDeadline = start + opts.budgetMs * CRAWL_SHARE;
    const limit = opts.sourcesPerRun ?? SOURCES_PER_RUN;
    const collected: SourcedJob[] = [];

    for (let i = 0; i < limit; i++) {
      if (Date.now() > crawlDeadline) break;
      const source = ATS_SOURCES[cursor % ATS_SOURCES.length];
      cursor = (cursor + 1) % ATS_SOURCES.length;

      const { jobs, error } = await fetchFromSource(source, settings.keywords, preferredCountry);
      sourcesChecked++;
      collected.push(...jobs);
      if (error) errors.push(`${source.company}: ${error}`);
      await recordSourceHealth(source, !error, jobs.length, error);
    }

    jobsSeen = collected.length;
    outOfArea = collected.filter(
      (j) => !locationVerdict(j.location, settings.locations).ok
    ).length;

    if (collected.length) {
      // Drop out-of-area postings before they are stored. Keeping them meant
      // Discover filled with roles in countries the search excludes, and every
      // one of them still consumed a scoring call just to be capped. Postings
      // whose location the source didn't state are kept — they may well be
      // in area, and the scorer flags them for confirmation.
      const rows = collected
        .filter((j) => j.title?.trim() && j.url?.trim())
        .filter((j) => locationVerdict(j.location, settings.locations).ok)
        .map((j) => ({
          title: j.title.trim(),
          application_url: j.url.trim(),
          company: j.company ?? null,
          location: j.location,
          work_type: inferWorkType(j.location),
          description: j.description || null,
          posted_at: parsePostedOn(j.postedOn),
          source_type: j.source,
          crawled_at: new Date().toISOString(),
        }));
      try {
        const res = await bulkUpsertListings(rows);
        jobsAdded = res.added;
        errors.push(...res.errors);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "write failed");
      }
    }
  }

  // ── Phase 2: spend what's left scoring ──
  const scored = await scoreUntil(deadline, settings, errors);

  const stateError = await saveState({ cursor, lastRunAt: new Date().toISOString() });
  if (stateError) errors.unshift(stateError);

  return {
    sourcesChecked,
    jobsSeen,
    jobsAdded,
    outOfArea,
    jobsScored: scored.count,
    relevantFound: scored.relevant,
    cursorStart,
    cursorEnd: cursor,
    durationMs: Date.now() - start,
    errors: errors.slice(0, 8),
    timedOut: Date.now() >= deadline,
  };
}

/** Score unscored listings one at a time until the clock runs out. */
async function scoreUntil(
  deadline: number,
  settings: JobFinderSettings,
  errors: string[]
): Promise<{ count: number; relevant: number }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    errors.push("GROQ_API_KEY is not set — discovery ran but nothing was scored");
    return { count: 0, relevant: 0 };
  }

  const db = requireSupabaseAdmin();
  const candidateBlock = buildCandidateBlock(settings);
  let count = 0;
  let relevant = 0;

  // A single Groq call is a few seconds; stop starting one that can't finish.
  const PER_JOB_ALLOWANCE = 9_000;

  while (Date.now() + PER_JOB_ALLOWANCE < deadline) {
    // "Unfinished" means never scored OR scored before the structured fields
    // existed. Without that second case, listings scored by an older build keep
    // an empty facts grid forever. match_score = -1 is the parked value for an
    // unparseable posting and must stay excluded, or it gets re-picked forever.
    const { data: batch, error } = await db
      .from("job_listings")
      .select("id, title, company, location, work_type, description, salary_range")
      .or("match_score.is.null,and(match_score.gte.0,required_skills.is.null)")
      .in("status", ["new", "saved"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      errors.push(error.message);
      break;
    }
    const job = batch?.[0];
    if (!job) break; // everything is scored

    const res = await scoreJob(apiKey, job, settings, candidateBlock);
    if (!res.ok) {
      errors.push(`${job.title}: ${res.error}`);
      // Park it at -1 so a permanently unparseable posting can't wedge the
      // loop by being picked again on every tick.
      await db.from("job_listings").update({ match_score: -1 }).eq("id", job.id);
      continue;
    }

    const m = res.match;
    await db
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

    count++;
    if (m.score >= settings.min_match_score) relevant++;
  }

  return { count, relevant };
}

/** Totals for the automation panel. */
export async function getCrawlStats(): Promise<{
  total: number;
  scored: number;
  unscored: number;
  relevant: number;
  minScore: number;
  sources: number;
}> {
  const db = requireSupabaseAdmin();
  const settings = await getJobFinderSettings();
  const head = () => db.from("job_listings").select("id", { count: "exact", head: true });

  const [totalRes, unscoredRes, relevantRes] = await Promise.all([
    head(),
    head().is("match_score", null),
    head().gte("match_score", settings.min_match_score),
  ]);

  const total = totalRes.count ?? 0;
  const unscored = unscoredRes.count ?? 0;
  const relevant = relevantRes.count ?? 0;

  return {
    total,
    scored: total - unscored,
    unscored,
    relevant,
    minScore: settings.min_match_score,
    sources: ATS_SOURCES.length,
  };
}
