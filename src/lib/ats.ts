/**
 * Multi-ATS job source layer.
 *
 * Every large employer runs one of a handful of applicant tracking systems, and
 * most expose the job board as public JSON — no key, no browser. That is what
 * this file speaks. A headless-Chrome crawler was the obvious approach and the
 * wrong one: slow, fragile, breaks whenever markup changes, and does not fit a
 * serverless time budget. Parsing JSON the employer publishes deliberately is
 * faster and far more stable.
 *
 * Shape of the layer — each adapter is isolated behind the same contract:
 *
 *   fetchJobs(source)      → FetchResult   (per-platform; does its own normalize)
 *   validateJob(job)       → ValidationResult
 *   toListingRow(job)      → database row
 *   upsertJobs(rows)       → in lib/job-finder (dedup lives in one place)
 *   recordCrawlResult(...)  → in lib/job-crawler (health lives with the loop)
 *
 * Normalization happens inside each adapter rather than in a shared function,
 * because "raw" means something different on every platform — there is no
 * common intermediate worth inventing. What IS shared is the output contract
 * below, plus validation and persistence.
 *
 * Every slug here was probed before being committed and the postings count is
 * recorded, so a source that silently dries up is easy to spot. Nothing is a
 * guess; candidates that failed the probe were dropped.
 */
import "server-only";
import {
  WORKDAY_TENANTS,
  GREENHOUSE_BOARDS,
  fetchWorkdayJobs,
  type SourcedJob,
} from "@/lib/job-sources";

export type AtsKind =
  | "workday"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "usajobs";

export type AtsSource = {
  company: string;
  kind: AtsKind;
  /** Board/company identifier for the ATS. Workday carries its own triple. */
  slug: string;
};

/** The single output contract every adapter must produce. */
export type NormalizedJob = {
  ats: AtsKind;
  /** The ATS's own job id — the primary dedup key. Null when not exposed. */
  externalId: string | null;
  company: string;
  title: string;
  location: string | null;
  workMode: "remote" | "hybrid" | "onsite" | null;
  employmentType: string | null;
  department: string | null;
  /** As published. Most ATS boards omit it; USAJOBS always states a range. */
  salary: string | null;
  description: string | null;
  requirements: string[];
  /** ISO timestamp, or null when the source will not say. */
  postedAt: string | null;
  /** Official apply link only — never an aggregator or a search page. */
  applyUrl: string;
  /** The board this was found on, as distinct from where a human applies. */
  sourceUrl: string;
  crawledAt: string;
};

export type FetchResult = {
  jobs: NormalizedJob[];
  /** Recorded in source health so a failure is diagnosable, not just "failed". */
  httpStatus: number | null;
  error: string | null;
  /**
   * Set when the source cannot run until credentials are supplied. Distinct
   * from an error: nothing is broken, it simply has not been configured, and
   * flagging it red would be wrong.
   */
  needsConfig?: boolean;
};

const TIMEOUT = 12_000;

/** Fetch JSON, keeping the status code so health can report it. */
async function getJson<T>(url: string): Promise<{ data: T | null; status: number | null; error: string | null }> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return { data: null, status: r.status, error: `HTTP ${r.status}` };
    return { data: (await r.json()) as T, status: r.status, error: null };
  } catch (err) {
    return { data: null, status: null, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

function matchesAny(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

/** Cap per company so one huge board (Bosch has ~4,800) cannot crowd out the rest. */
const PER_SOURCE_CAP = 25;

/** Location strings are free text; this is the only work-mode signal available. */
function inferWorkMode(location: string | null): NormalizedJob["workMode"] {
  if (!location) return null;
  const l = location.toLowerCase();
  if (l.includes("remote")) return "remote";
  if (l.includes("hybrid")) return "hybrid";
  return null;
}

/** ISO where possible; null rather than a guess. */
function isoOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return new Date(value).toISOString();
  // Workday reports age as a phrase capped at "30+ Days Ago" — the `+` must be
  // tolerated or the most common format parses to null.
  const days = value.match(/(\d+)\s*\+?\s*day/i);
  if (days) return new Date(Date.now() - Number(days[1]) * 86_400_000).toISOString();
  const months = value.match(/(\d+)\s*\+?\s*month/i);
  if (months) return new Date(Date.now() - Number(months[1]) * 30 * 86_400_000).toISOString();
  if (/today|just posted/i.test(value)) return new Date().toISOString();
  if (/yesterday/i.test(value)) return new Date(Date.now() - 86_400_000).toISOString();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

// ─── Adapters ──────────────────────────────────────────────────────────────

async function fetchLever(source: AtsSource, kws: string[]): Promise<FetchResult> {
  const { data, status, error } = await getJson<
    Array<{
      id?: string;
      text?: string;
      hostedUrl?: string;
      applyUrl?: string;
      createdAt?: number;
      categories?: { location?: string; team?: string; commitment?: string };
      descriptionPlain?: string;
      lists?: Array<{ text?: string; content?: string }>;
    }>
  >(`https://api.lever.co/v0/postings/${source.slug}?mode=json`);

  if (!Array.isArray(data)) return { jobs: [], httpStatus: status, error: error ?? "unexpected shape" };

  const jobs = data
    .filter((p) => p.text && (p.hostedUrl || p.applyUrl) && matchesAny(p.text, kws))
    .slice(0, PER_SOURCE_CAP)
    .map<NormalizedJob>((p) => ({
      ats: "lever",
      externalId: p.id ?? null,
      company: source.company,
      title: String(p.text),
      location: p.categories?.location ?? null,
      workMode: inferWorkMode(p.categories?.location ?? null),
      employmentType: p.categories?.commitment ?? null,
      department: p.categories?.team ?? null,
      salary: null,
      description: (p.descriptionPlain ?? "").slice(0, 6000) || String(p.text),
      requirements: (p.lists ?? [])
        .flatMap((l) => (l.content ?? "").split(/<\/li>/i))
        .map((s) => s.replace(/<[^>]*>/g, "").trim())
        .filter((s) => s.length > 3)
        .slice(0, 20),
      postedAt: isoOrNull(p.createdAt ?? null),
      applyUrl: String(p.hostedUrl || p.applyUrl),
      sourceUrl: `https://jobs.lever.co/${source.slug}`,
      crawledAt: new Date().toISOString(),
    }));

  return { jobs, httpStatus: status, error: null };
}

async function fetchAshby(source: AtsSource, kws: string[]): Promise<FetchResult> {
  const { data, status, error } = await getJson<{
    jobs?: Array<{
      id?: string;
      title?: string;
      jobUrl?: string;
      location?: string;
      publishedAt?: string;
      departmentName?: string;
      employmentType?: string;
      descriptionPlain?: string;
    }>;
  }>(`https://api.ashbyhq.com/posting-api/job-board/${source.slug}`);

  if (!data?.jobs) return { jobs: [], httpStatus: status, error: error ?? "unexpected shape" };

  const jobs = data.jobs
    .filter((p) => p.title && p.jobUrl && matchesAny(p.title, kws))
    .slice(0, PER_SOURCE_CAP)
    .map<NormalizedJob>((p) => ({
      ats: "ashby",
      externalId: p.id ?? null,
      company: source.company,
      title: String(p.title),
      location: p.location ?? null,
      workMode: inferWorkMode(p.location ?? null),
      employmentType: p.employmentType ?? null,
      department: p.departmentName ?? null,
      salary: null,
      description:
        (p.descriptionPlain ?? "").slice(0, 6000) ||
        [p.title, p.departmentName, p.employmentType].filter(Boolean).join(" — "),
      requirements: [],
      postedAt: isoOrNull(p.publishedAt),
      applyUrl: String(p.jobUrl),
      sourceUrl: `https://jobs.ashbyhq.com/${source.slug}`,
      crawledAt: new Date().toISOString(),
    }));

  return { jobs, httpStatus: status, error: null };
}

async function fetchSmartRecruiters(source: AtsSource, keywords: string[]): Promise<FetchResult> {
  // Filters server-side, so ask per keyword rather than pulling a
  // 4,800-posting board and discarding almost all of it.
  const jobs: NormalizedJob[] = [];
  const seen = new Set<string>();
  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (const kw of keywords.slice(0, 3)) {
    const { data, status, error } = await getJson<{
      content?: Array<{
        id?: string;
        name?: string;
        releasedDate?: string;
        location?: { city?: string; region?: string; country?: string; remote?: boolean };
        department?: { label?: string };
        typeOfEmployment?: { label?: string };
      }>;
    }>(
      `https://api.smartrecruiters.com/v1/companies/${source.slug}/postings?limit=15&q=${encodeURIComponent(kw)}`
    );
    lastStatus = status;
    if (error) {
      lastError = error;
      continue;
    }

    for (const p of data?.content ?? []) {
      if (!p.id || !p.name || seen.has(p.id)) continue;
      seen.add(p.id);
      const loc = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", ");
      jobs.push({
        ats: "smartrecruiters",
        externalId: p.id,
        company: source.company,
        title: String(p.name),
        location: loc || null,
        workMode: p.location?.remote ? "remote" : inferWorkMode(loc || null),
        employmentType: p.typeOfEmployment?.label ?? null,
        department: p.department?.label ?? null,
        salary: null,
        description: `${p.name} — ${source.company}${loc ? ` — ${loc}` : ""}`,
        requirements: [],
        postedAt: isoOrNull(p.releasedDate),
        applyUrl: `https://jobs.smartrecruiters.com/${source.slug}/${p.id}`,
        sourceUrl: `https://jobs.smartrecruiters.com/${source.slug}`,
        crawledAt: new Date().toISOString(),
      });
      if (jobs.length >= PER_SOURCE_CAP) return { jobs, httpStatus: lastStatus, error: null };
    }
  }

  // Only an error if nothing at all came back — a partial result is still useful.
  return { jobs, httpStatus: lastStatus, error: jobs.length ? null : lastError };
}

async function fetchGreenhouse(source: AtsSource, kws: string[]): Promise<FetchResult> {
  const { data, status, error } = await getJson<{
    jobs?: Array<{
      id?: number;
      title?: string;
      absolute_url?: string;
      location?: { name?: string };
      updated_at?: string;
      departments?: Array<{ name?: string }>;
    }>;
  }>(`https://boards-api.greenhouse.io/v1/boards/${source.slug}/jobs`);

  if (!data?.jobs) return { jobs: [], httpStatus: status, error: error ?? "unexpected shape" };

  const jobs = data.jobs
    .filter((p) => p.title && p.absolute_url && matchesAny(p.title, kws))
    .slice(0, PER_SOURCE_CAP)
    .map<NormalizedJob>((p) => ({
      ats: "greenhouse",
      externalId: p.id ? String(p.id) : null,
      company: source.company,
      title: String(p.title),
      location: p.location?.name ?? null,
      workMode: inferWorkMode(p.location?.name ?? null),
      employmentType: null,
      department: p.departments?.[0]?.name ?? null,
      salary: null,
      description: `${p.title} — ${source.company}${p.location?.name ? ` — ${p.location.name}` : ""}`,
      requirements: [],
      postedAt: isoOrNull(p.updated_at),
      applyUrl: String(p.absolute_url),
      sourceUrl: `https://boards.greenhouse.io/${source.slug}`,
      crawledAt: new Date().toISOString(),
    }));

  return { jobs, httpStatus: status, error: null };
}

/**
 * Workday's requisition id sits at the end of the posting path —
 * "/job/Bangkok/SAP-Consultant_R00212169". That is the stable identity; the URL
 * itself changes if the employer relabels the location.
 */
function workdayExternalId(url: string): string | null {
  return url.match(/_([A-Za-z]{0,3}\d{4,}[A-Za-z0-9-]*)(?:\/|$)/)?.[1] ?? null;
}

async function fetchWorkday(
  source: AtsSource,
  keywords: string[],
  country?: string
): Promise<FetchResult> {
  const collected: SourcedJob[] = [];
  try {
    for (const kw of keywords.slice(0, 2)) {
      const batch = await fetchWorkdayJobs({
        keyword: kw,
        companies: [source.company],
        perTenant: 12,
        country,
      });
      collected.push(...batch);
      if (collected.length >= PER_SOURCE_CAP) break;
    }
  } catch (err) {
    return { jobs: [], httpStatus: null, error: err instanceof Error ? err.message : "fetch failed" };
  }

  const jobs = collected.slice(0, PER_SOURCE_CAP).map<NormalizedJob>((j) => ({
    ats: "workday",
    externalId: workdayExternalId(j.url),
    company: j.company || source.company,
    title: j.title,
    location: j.location,
    workMode: inferWorkMode(j.location),
    employmentType: null,
    department: null,
    salary: null,
    description: j.description || j.title,
    requirements: [],
    postedAt: isoOrNull(j.postedOn),
    applyUrl: j.url,
    sourceUrl: `https://${source.slug}.myworkdayjobs.com`,
    crawledAt: new Date().toISOString(),
  }));

  // fetchWorkdayJobs swallows per-tenant errors, so an empty result is
  // indistinguishable from "no matches". Reported as no-error; the crawler
  // classifies zero-results as no_matches rather than failing.
  return { jobs, httpStatus: null, error: null };
}

/**
 * USAJOBS — every US federal opening, free and official.
 *
 * Worth having for two reasons: federal agencies run SAP and ERP heavily, and
 * almost nobody targets this board, so competition per posting is far lower
 * than on a commercial one.
 *
 * Requires a free key from https://developer.usajobs.gov/apirequest/ — the API
 * returns 401 without one, confirmed by probe. Both headers are mandatory: the
 * User-Agent must be the email the key was issued to.
 */
async function fetchUsaJobs(source: AtsSource, keywords: string[]): Promise<FetchResult> {
  const key = process.env.USAJOBS_API_KEY;
  const email = process.env.USAJOBS_EMAIL;
  if (!key || !email) {
    return {
      jobs: [],
      httpStatus: null,
      needsConfig: true,
      error:
        "USAJOBS_API_KEY and USAJOBS_EMAIL are not set — request a free key at developer.usajobs.gov/apirequest",
    };
  }

  const jobs: NormalizedJob[] = [];
  const seen = new Set<string>();
  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (const kw of keywords.slice(0, 3)) {
    const url =
      "https://data.usajobs.gov/api/search?ResultsPerPage=25" +
      `&Keyword=${encodeURIComponent(kw)}`;
    try {
      const r = await fetch(url, {
        headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT),
      });
      lastStatus = r.status;
      if (!r.ok) {
        lastError = `HTTP ${r.status}`;
        continue;
      }
      const j = (await r.json()) as {
        SearchResult?: {
          SearchResultItems?: Array<{
            MatchedObjectId?: string;
            MatchedObjectDescriptor?: {
              PositionID?: string;
              PositionTitle?: string;
              PositionURI?: string;
              ApplyURI?: string[];
              OrganizationName?: string;
              DepartmentName?: string;
              PositionLocationDisplay?: string;
              PublicationStartDate?: string;
              PositionRemuneration?: Array<{ MinimumRange?: string; MaximumRange?: string }>;
              PositionSchedule?: Array<{ Name?: string }>;
              QualificationSummary?: string;
              UserArea?: { Details?: { JobSummary?: string; TeleworkEligible?: boolean } };
            };
          }>;
        };
      };

      for (const item of j.SearchResult?.SearchResultItems ?? []) {
        const d = item.MatchedObjectDescriptor;
        const id = item.MatchedObjectId ?? d?.PositionID;
        const apply = d?.ApplyURI?.[0] ?? d?.PositionURI;
        if (!d?.PositionTitle || !apply || !id || seen.has(id)) continue;
        seen.add(id);

        const pay = d.PositionRemuneration?.[0];
        const salary =
          pay?.MinimumRange && pay?.MaximumRange
            ? `$${Math.round(Number(pay.MinimumRange)).toLocaleString()} – $${Math.round(Number(pay.MaximumRange)).toLocaleString()}`
            : null;
        const location = d.PositionLocationDisplay ?? null;

        jobs.push({
          ats: "usajobs",
          externalId: id,
          company: d.OrganizationName ?? d.DepartmentName ?? source.company,
          title: d.PositionTitle,
          location,
          workMode: d.UserArea?.Details?.TeleworkEligible ? "remote" : inferWorkMode(location),
          employmentType: d.PositionSchedule?.[0]?.Name ?? null,
          department: d.DepartmentName ?? null,
          salary,
          description: (d.UserArea?.Details?.JobSummary ?? d.QualificationSummary ?? "").slice(0, 6000),
          requirements: [],
          postedAt: isoOrNull(d.PublicationStartDate),
          applyUrl: apply,
          sourceUrl: "https://www.usajobs.gov",
          crawledAt: new Date().toISOString(),
        });
        if (jobs.length >= PER_SOURCE_CAP) return { jobs, httpStatus: lastStatus, error: null };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "fetch failed";
    }
  }

  return { jobs, httpStatus: lastStatus, error: jobs.length ? null : lastError };
}

// ─── Validation ────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Reject anything that cannot become a usable listing.
 *
 * Kept separate from normalization so a source returning junk is visible in
 * crawl results rather than silently producing rows nobody can act on.
 */
export function validateJob(job: NormalizedJob): ValidationResult {
  if (!job.title?.trim()) return { ok: false, reason: "no title" };
  if (!job.applyUrl?.trim()) return { ok: false, reason: "no apply URL" };
  if (!/^https?:\/\//i.test(job.applyUrl)) return { ok: false, reason: "apply URL is not http(s)" };
  if (!job.company?.trim()) return { ok: false, reason: "no company" };
  if (job.title.length > 300) return { ok: false, reason: "title implausibly long" };
  return { ok: true };
}

/** NormalizedJob → job_listings row. The one place the mapping lives. */
export function toListingRow(job: NormalizedJob) {
  return {
    title: job.title.trim(),
    company: job.company,
    location: job.location,
    work_type: job.workMode,
    employment_type: job.employmentType,
    department: job.department,
    salary_range: job.salary,
    description: job.description,
    required_skills: job.requirements.length ? job.requirements : null,
    application_url: job.applyUrl.trim(),
    external_id: job.externalId,
    source_type: job.ats,
    source_url: job.sourceUrl,
    posted_at: job.postedAt,
    crawled_at: job.crawledAt,
  };
}

// ─── Registry ──────────────────────────────────────────────────────────────

/** Probed 2026-08-17; the number is postings the board held at that time. */
const LEVER_SOURCES: AtsSource[] = [
  { company: "Palantir", kind: "lever", slug: "palantir" }, // 308
  { company: "Binance", kind: "lever", slug: "binance" }, // 271
  { company: "Spotify", kind: "lever", slug: "spotify" }, // 105
  { company: "AngelList", kind: "lever", slug: "angellist" }, // 22
  { company: "Tala", kind: "lever", slug: "tala" }, // 11
];

const ASHBY_SOURCES: AtsSource[] = [
  { company: "OpenAI", kind: "ashby", slug: "openai" }, // 734
  { company: "Harvey", kind: "ashby", slug: "harvey" }, // 391
  { company: "Sierra", kind: "ashby", slug: "sierra" }, // 190
  { company: "Ramp", kind: "ashby", slug: "ramp" }, // 136
  { company: "Decagon", kind: "ashby", slug: "decagon" }, // 134
  { company: "Notion", kind: "ashby", slug: "notion" }, // 131
  { company: "Cursor", kind: "ashby", slug: "cursor" }, // 115
  { company: "Perplexity", kind: "ashby", slug: "perplexity" }, // 101
  { company: "Vanta", kind: "ashby", slug: "vanta" }, // 97
  { company: "Replit", kind: "ashby", slug: "replit" }, // 78
  { company: "Supabase", kind: "ashby", slug: "supabase" }, // 53
  { company: "Abridge", kind: "ashby", slug: "abridge" }, // 46
  { company: "Linear", kind: "ashby", slug: "linear" }, // 33
  { company: "Modal", kind: "ashby", slug: "modal" }, // 31
  { company: "PostHog", kind: "ashby", slug: "posthog" }, // 10
  { company: "Browserbase", kind: "ashby", slug: "browserbase" }, // 8
];

/** The SAP-rich half — Bosch and Continental are large ERP employers. */
const SMARTRECRUITERS_SOURCES: AtsSource[] = [
  { company: "Bosch", kind: "smartrecruiters", slug: "BoschGroup" }, // 4805
  { company: "Continental", kind: "smartrecruiters", slug: "Continental" }, // 938
  { company: "Visa", kind: "smartrecruiters", slug: "Visa" }, // 2
  { company: "Wipro", kind: "smartrecruiters", slug: "WiproLimited" }, // 1
];

/**
 * Every source the crawler knows, in one list it pages through.
 *
 * SmartRecruiters sits first. It is the only platform the round-robin cursor
 * had never reached, so nothing about it was verified in the database however
 * well it behaved when probed standalone — and Bosch alone is ~4,800 postings.
 */
export const ATS_SOURCES: AtsSource[] = [
  // One entry covers the whole federal government rather than one per agency.
  { company: "US Federal Government", kind: "usajobs", slug: "usajobs" },
  ...SMARTRECRUITERS_SOURCES,
  ...WORKDAY_TENANTS.map<AtsSource>((t) => ({
    company: t.company,
    kind: "workday",
    slug: t.tenant,
  })),
  ...GREENHOUSE_BOARDS.map<AtsSource>((b) => ({
    company: b.company,
    kind: "greenhouse",
    slug: b.board,
  })),
  ...ASHBY_SOURCES,
  ...LEVER_SOURCES,
];

export function sourceCounts(): Record<AtsKind, number> {
  const counts = { workday: 0, greenhouse: 0, lever: 0, ashby: 0, smartrecruiters: 0, usajobs: 0 };
  for (const s of ATS_SOURCES) counts[s.kind]++;
  return counts;
}

/**
 * Pull matching postings from one source. Never throws — one employer being
 * down must not abort a crawl across dozens of them.
 */
export async function fetchFromSource(
  source: AtsSource,
  keywords: string[],
  /** Country to restrict to, where the platform can filter server-side. */
  country?: string
): Promise<FetchResult> {
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (!kws.length) return { jobs: [], httpStatus: null, error: "no keywords configured" };

  try {
    switch (source.kind) {
      case "workday":
        return await fetchWorkday(source, keywords, country);
      case "greenhouse":
        return await fetchGreenhouse(source, kws);
      case "lever":
        return await fetchLever(source, kws);
      case "ashby":
        return await fetchAshby(source, kws);
      case "smartrecruiters":
        return await fetchSmartRecruiters(source, keywords);
      case "usajobs":
        return await fetchUsaJobs(source, keywords);
      default:
        return { jobs: [], httpStatus: null, error: `unknown ATS: ${source.kind}` };
    }
  } catch (err) {
    return { jobs: [], httpStatus: null, error: err instanceof Error ? err.message : "fetch failed" };
  }
}
