/**
 * Multi-ATS job crawler.
 *
 * Every large employer runs one of a handful of applicant tracking systems, and
 * most of those expose the job board as public JSON — no key, no browser. That
 * is what this file speaks. A headless-Chrome crawler was the obvious approach
 * and the wrong one: it is slow, fragile, breaks whenever a page's markup
 * changes, and does not fit in a serverless function's time budget. Parsing
 * JSON that the employer publishes deliberately is faster and far more stable.
 *
 * Every slug below was probed before being committed — the postings count each
 * returned is recorded so a source that silently dries up is easy to spot.
 * Nothing here is a guess. Companies that failed the probe were dropped.
 *
 * Adding a company is a one-line entry. Adding a new ATS means writing one
 * adapter that returns SourcedJob[].
 */
import "server-only";
import {
  WORKDAY_TENANTS,
  GREENHOUSE_BOARDS,
  fetchWorkdayJobs,
  type SourcedJob,
} from "@/lib/job-sources";

export type AtsKind = "workday" | "greenhouse" | "lever" | "ashby" | "smartrecruiters";

export type AtsSource = {
  company: string;
  kind: AtsKind;
  /** Board/company identifier for the ATS. Workday carries its own triple. */
  slug: string;
};

const TIMEOUT = 12_000;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function matchesAny(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

/** Cap per company so one huge board (Bosch has ~4,800) can't crowd out the rest. */
const PER_SOURCE_CAP = 25;

// ─── Adapters ──────────────────────────────────────────────────────────────

async function fetchLever(company: string, slug: string, kws: string[]): Promise<SourcedJob[]> {
  const jobs = await getJson<
    Array<{
      text?: string;
      hostedUrl?: string;
      applyUrl?: string;
      createdAt?: number;
      categories?: { location?: string; team?: string };
      descriptionPlain?: string;
    }>
  >(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(jobs)) return [];

  return jobs
    .filter((p) => p.text && (p.hostedUrl || p.applyUrl) && matchesAny(p.text, kws))
    .slice(0, PER_SOURCE_CAP)
    .map((p) => ({
      title: String(p.text),
      company,
      location: p.categories?.location ?? null,
      url: String(p.hostedUrl || p.applyUrl),
      description: (p.descriptionPlain ?? "").slice(0, 4000) || String(p.text),
      source: "lever",
      postedOn: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    }));
}

async function fetchAshby(company: string, slug: string, kws: string[]): Promise<SourcedJob[]> {
  const data = await getJson<{
    jobs?: Array<{
      title?: string;
      jobUrl?: string;
      location?: string;
      publishedAt?: string;
      departmentName?: string;
      employmentType?: string;
    }>;
  }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!data?.jobs) return [];

  return data.jobs
    .filter((p) => p.title && p.jobUrl && matchesAny(p.title, kws))
    .slice(0, PER_SOURCE_CAP)
    .map((p) => ({
      title: String(p.title),
      company,
      location: p.location ?? null,
      url: String(p.jobUrl),
      description: [p.title, p.departmentName, p.employmentType].filter(Boolean).join(" — "),
      source: "ashby",
      postedOn: p.publishedAt ?? null,
    }));
}

async function fetchSmartRecruiters(
  company: string,
  slug: string,
  kws: string[]
): Promise<SourcedJob[]> {
  // SmartRecruiters filters server-side, so ask per keyword rather than pulling
  // a 4,800-posting board and discarding almost all of it.
  const out: SourcedJob[] = [];
  const seen = new Set<string>();

  for (const kw of kws.slice(0, 3)) {
    const data = await getJson<{
      content?: Array<{
        id?: string;
        name?: string;
        releasedDate?: string;
        location?: { city?: string; region?: string; country?: string };
        company?: { identifier?: string };
        ref?: string;
      }>;
    }>(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=15&q=${encodeURIComponent(kw)}`
    );
    for (const p of data?.content ?? []) {
      if (!p.id || !p.name) continue;
      const url = `https://jobs.smartrecruiters.com/${slug}/${p.id}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const loc = [p.location?.city, p.location?.region, p.location?.country]
        .filter(Boolean)
        .join(", ");
      out.push({
        title: String(p.name),
        company,
        location: loc || null,
        url,
        description: `${p.name} — ${company}${loc ? ` — ${loc}` : ""}`,
        source: "smartrecruiters",
        postedOn: p.releasedDate ?? null,
      });
      if (out.length >= PER_SOURCE_CAP) return out;
    }
  }
  return out;
}

async function fetchGreenhouseBoard(
  company: string,
  slug: string,
  kws: string[]
): Promise<SourcedJob[]> {
  const data = await getJson<{
    jobs?: Array<{
      title?: string;
      absolute_url?: string;
      location?: { name?: string };
      updated_at?: string;
    }>;
  }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  if (!data?.jobs) return [];

  return data.jobs
    .filter((p) => p.title && p.absolute_url && matchesAny(p.title, kws))
    .slice(0, PER_SOURCE_CAP)
    .map((p) => ({
      title: String(p.title),
      company,
      location: p.location?.name ?? null,
      url: String(p.absolute_url),
      description: `${p.title} — ${company}${p.location?.name ? ` — ${p.location.name}` : ""}`,
      source: "greenhouse",
      postedOn: p.updated_at ?? null,
    }));
}

/** Workday needs a keyword per request; the existing helper handles the triple. */
async function fetchWorkdayOne(
  company: string,
  kws: string[],
  country?: string
): Promise<SourcedJob[]> {
  const out: SourcedJob[] = [];
  for (const kw of kws.slice(0, 2)) {
    const jobs = await fetchWorkdayJobs({ keyword: kw, companies: [company], perTenant: 12, country });
    out.push(...jobs);
    if (out.length >= PER_SOURCE_CAP) break;
  }
  return out.slice(0, PER_SOURCE_CAP);
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

/** Every source the crawler knows, in one list it can page through. */
export const ATS_SOURCES: AtsSource[] = [
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
  ...LEVER_SOURCES,
  ...ASHBY_SOURCES,
  ...SMARTRECRUITERS_SOURCES,
];

export function sourceCounts(): Record<AtsKind, number> {
  const counts = { workday: 0, greenhouse: 0, lever: 0, ashby: 0, smartrecruiters: 0 };
  for (const s of ATS_SOURCES) counts[s.kind]++;
  return counts;
}

/**
 * Pull matching postings from one source. Never throws — a single employer
 * being down must not abort a crawl over dozens of them.
 */
export async function fetchFromSource(
  source: AtsSource,
  keywords: string[],
  /** Country to restrict to, where the platform can filter server-side. */
  country?: string
): Promise<{ jobs: SourcedJob[]; error: string | null }> {
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (!kws.length) return { jobs: [], error: "no keywords" };

  try {
    let jobs: SourcedJob[];
    switch (source.kind) {
      case "workday":
        jobs = await fetchWorkdayOne(source.company, keywords, country);
        break;
      case "greenhouse":
        jobs = await fetchGreenhouseBoard(source.company, source.slug, kws);
        break;
      case "lever":
        jobs = await fetchLever(source.company, source.slug, kws);
        break;
      case "ashby":
        jobs = await fetchAshby(source.company, source.slug, kws);
        break;
      case "smartrecruiters":
        jobs = await fetchSmartRecruiters(source.company, source.slug, keywords);
        break;
      default:
        return { jobs: [], error: `unknown ATS: ${source.kind}` };
    }
    return { jobs, error: null };
  } catch (err) {
    return { jobs: [], error: err instanceof Error ? err.message : "fetch failed" };
  }
}
