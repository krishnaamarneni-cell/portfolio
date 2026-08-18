import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchWorkdayJobs, fetchGreenhouseBoards, type SourcedJob } from "@/lib/job-sources";
import { getJobFinderSettings, bulkUpsertListings } from "@/lib/job-finder";
import { locationVerdict } from "@/lib/job-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Pull live postings into job_listings.
 *
 * Discovery is broad on keywords but NOT on geography: postings outside the
 * preferred locations are discarded before they are stored. Keeping them meant
 * Discover filled with roles in countries the search excludes, and each one
 * still consumed a scoring call only to be capped afterwards. Postings whose
 * location the source didn't state are kept — they may be in area, and the
 * scorer flags them for confirmation.
 */

/** Workday location strings are free text; this is the only signal we get. */
function inferWorkType(location: string | null): string | null {
  if (!location) return null;
  const l = location.toLowerCase();
  if (l.includes("remote")) return "remote";
  if (l.includes("hybrid")) return "hybrid";
  return null;
}

/**
 * Workday reports age as a phrase, not a date: "Posted Today",
 * "Posted 3 Days Ago", "Posted 30+ Days Ago". The `\+?` matters — without it
 * the very common "30+ Days Ago" fell through and the posting looked undated.
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

type Body = {
  /** Override the saved keywords for a one-off search. */
  keywords?: string[];
  /** Restrict to specific companies (Workday tenants only). */
  companies?: string[];
  /** Optional location filter; omit for anywhere. */
  location?: string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const settings = await getJobFinderSettings();

  const keywords = (body.keywords?.length ? body.keywords : settings.keywords)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (!keywords.length) {
    return NextResponse.json(
      { error: "No search keywords. Add some under Job Finder → Settings." },
      { status: 400 }
    );
  }

  const companies = body.companies?.length ? body.companies : settings.target_companies;
  const location = (body.location ?? "").trim();

  const found: SourcedJob[] = [];
  const searchErrors: string[] = [];

  // Greenhouse has no server-side query, so its boards are pulled once and
  // matched against every keyword locally. Kicked off first so it runs while
  // the Workday rounds go out.
  const greenhouse = fetchGreenhouseBoards(keywords).catch((err): SourcedJob[] => {
    searchErrors.push(`greenhouse: ${err instanceof Error ? err.message : "fetch failed"}`);
    return [];
  });

  // Workday filters server-side, so it needs one round per keyword. Each round
  // already fans out across every tenant in parallel; running the keywords
  // concurrently too would mean a hundred-plus simultaneous requests.
  for (const keyword of keywords) {
    try {
      const jobs = await fetchWorkdayJobs({
        keyword,
        companies: companies.length ? companies : undefined,
        location,
        perTenant: 6,
      });
      found.push(...jobs);
    } catch (err) {
      searchErrors.push(`${keyword}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  found.push(...(await greenhouse));

  // Postings outside the preferred locations are dropped here rather than
  // stored and capped later — otherwise Discover fills with roles in countries
  // the search excludes, and each one still costs a scoring call.
  const inArea = found.filter((j) => locationVerdict(j.location, settings.locations).ok);
  const skippedOutOfArea = found.length - inArea.length;

  const rows = inArea
    .filter((j) => j.title?.trim() && j.url?.trim())
    .map((job) => ({
      title: job.title.trim(),
      application_url: job.url.trim(),
      company: job.company ?? null,
      location: job.location,
      work_type: inferWorkType(job.location),
      description: job.description || null,
      posted_at: parsePostedOn(job.postedOn),
      source_type: job.source || "workday",
      crawled_at: new Date().toISOString(),
    }));

  let result;
  try {
    result = await bulkUpsertListings(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "write failed";
    return NextResponse.json(
      {
        error: /does not exist|schema cache|relation/i.test(message)
          ? "Run supabase/job_finder.sql in Supabase to enable the Job Finder."
          : message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    searched: keywords,
    found: rows.length,
    outOfArea: skippedOutOfArea,
    added: result.added,
    updated: result.skipped,
    errors: [...searchErrors, ...result.errors].slice(0, 3),
  });
}
