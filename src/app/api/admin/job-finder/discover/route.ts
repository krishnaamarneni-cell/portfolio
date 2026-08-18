import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchWorkdayJobs, type SourcedJob } from "@/lib/job-sources";
import { getJobFinderSettings, upsertListing } from "@/lib/job-finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Pull live postings into job_listings.
 *
 * Discovery is deliberately BROAD — no location filter unless the caller asks
 * for one. Preferences (location, work type, target roles) are applied at
 * scoring time by /api/admin/job-finder/match, so narrowing here would throw
 * away postings before the AI ever weighs them.
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

  // One keyword at a time — each call already fans out across all 11 tenants
  // in parallel, so running the keywords concurrently too would mean ~44
  // simultaneous requests to the same handful of hosts.
  const found: SourcedJob[] = [];
  const searchErrors: string[] = [];
  for (const keyword of keywords) {
    try {
      const jobs = await fetchWorkdayJobs({
        keyword,
        companies: companies.length ? companies : undefined,
        location,
        perTenant: 8,
      });
      found.push(...jobs);
    } catch (err) {
      searchErrors.push(`${keyword}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }

  // Same posting can surface under several keywords.
  const seen = new Set<string>();
  const unique = found.filter((j) => {
    const key = j.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let added = 0;
  let updated = 0;
  const writeErrors: string[] = [];

  for (const job of unique) {
    if (!job.title?.trim() || !job.url?.trim()) continue;
    try {
      const res = await upsertListing({
        title: job.title.trim(),
        application_url: job.url.trim(),
        company: job.company ?? null,
        location: job.location,
        work_type: inferWorkType(job.location),
        description: job.description || null,
        posted_at: parsePostedOn(job.postedOn),
        source_type: job.source || "workday",
        crawled_at: new Date().toISOString(),
      });
      if (res.isNew) added++;
      else updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "write failed";
      if (/does not exist|schema cache|relation/i.test(message)) {
        return NextResponse.json(
          { error: "Run supabase/job_finder.sql in Supabase to enable the Job Finder." },
          { status: 500 }
        );
      }
      writeErrors.push(message);
    }
  }

  return NextResponse.json({
    ok: true,
    searched: keywords,
    found: unique.length,
    added,
    updated,
    errors: [...searchErrors, ...writeErrors].slice(0, 3),
  });
}
