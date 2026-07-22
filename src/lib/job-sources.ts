/**
 * Live job sources.
 *
 * Replaces two dead feeds: Indeed's public RSS now 404s (they retired it), and
 * the JobDiva portal API returns 401 — which is why the Jobs scout was serving
 * hardcoded fallback listings.
 *
 * Workday's careers API is the workhorse here: most large employers run Workday,
 * it needs no key, and it returns structured postings with real apply URLs.
 * Every tenant below was probed and confirmed returning live results before
 * being committed — none are guesses.
 */
import "server-only";

export type SourcedJob = {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  source: string;
  postedOn: string | null;
};

type WorkdayTenant = {
  company: string;
  tenant: string;
  wd: string;
  site: string;
};

/** Confirmed live (HTTP 200 + non-empty results for a "SAP" query). */
export const WORKDAY_TENANTS: WorkdayTenant[] = [
  { company: "Accenture", tenant: "accenture", wd: "wd103", site: "AccentureCareers" },
  { company: "Mondelez International", tenant: "mdlz", wd: "wd3", site: "External" },
  { company: "Johnson & Johnson", tenant: "jj", wd: "wd5", site: "JJ" },
  { company: "Merck", tenant: "msd", wd: "wd5", site: "SearchJobs" },
  { company: "3M", tenant: "3m", wd: "wd1", site: "Search" },
  { company: "Kimberly-Clark", tenant: "kimberlyclark", wd: "wd1", site: "GLOBAL" },
  { company: "Workday", tenant: "workday", wd: "wd5", site: "Workday" },
  { company: "The Coca-Cola Company", tenant: "coke", wd: "wd1", site: "coca-cola-careers" },
  { company: "Intel", tenant: "intel", wd: "wd1", site: "External" },
  { company: "Salesforce", tenant: "salesforce", wd: "wd12", site: "External_Career_Site" },
  { company: "Pfizer", tenant: "pfizer", wd: "wd1", site: "PfizerCareers" },
];

type WorkdayPosting = {
  title?: string;
  externalPath?: string;
  postedOn?: string;
  bulletFields?: string[];
};

/** bulletFields is usually [reqId, location]; drop anything that looks like a req id. */
function locationFrom(bullets?: string[]): string | null {
  if (!bullets?.length) return null;
  const parts = bullets.filter((b) => b && !/^[A-Z]{0,3}[-_]?\d{4,}/.test(b.trim()));
  return parts.length ? parts.join(", ") : null;
}

async function fetchOneTenant(
  t: WorkdayTenant,
  keyword: string,
  perTenant: number
): Promise<SourcedJob[]> {
  const base = `https://${t.tenant}.${t.wd}.myworkdayjobs.com`;
  try {
    const r = await fetch(`${base}/wday/cxs/${t.tenant}/${t.site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: Math.min(20, perTenant),
        offset: 0,
        searchText: keyword,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { jobPostings?: WorkdayPosting[] };
    return (j.jobPostings ?? [])
      .filter((p) => p.title && p.externalPath)
      .slice(0, perTenant)
      .map((p) => ({
        title: String(p.title),
        company: t.company,
        location: locationFrom(p.bulletFields),
        // Public posting URL — the CXS path maps onto the external site.
        url: `${base}/${t.site}${p.externalPath}`,
        description: [p.title, t.company, locationFrom(p.bulletFields)]
          .filter(Boolean)
          .join(" — "),
        source: "workday",
        postedOn: p.postedOn ?? null,
      }));
  } catch {
    return [];
  }
}

/**
 * Search live Workday postings across the verified tenants.
 *
 * `companies` narrows to matching employers; if nothing matches (e.g. the user
 * typed a company that isn't on Workday) we search them all rather than
 * returning nothing.
 */
export async function fetchWorkdayJobs(opts: {
  keyword: string;
  companies?: string[];
  perTenant?: number;
  maxTenants?: number;
}): Promise<SourcedJob[]> {
  const keyword = opts.keyword?.trim() || "SAP";
  const perTenant = Math.max(1, Math.min(20, opts.perTenant ?? 6));

  let tenants = WORKDAY_TENANTS;
  const wanted = (opts.companies ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (wanted.length) {
    const matched = WORKDAY_TENANTS.filter((t) =>
      wanted.some((w) => t.company.toLowerCase().includes(w) || w.includes(t.tenant))
    );
    if (matched.length) tenants = matched;
  }
  tenants = tenants.slice(0, Math.max(1, opts.maxTenants ?? WORKDAY_TENANTS.length));

  const results = await Promise.all(tenants.map((t) => fetchOneTenant(t, keyword, perTenant)));
  const seen = new Set<string>();
  return results.flat().filter((j) => {
    if (seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });
}

/** Greenhouse public board API — no key required. */
export async function fetchGreenhouseJobs(board: string, keyword: string): Promise<SourcedJob[]> {
  try {
    const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as {
      jobs?: Array<{ title?: string; absolute_url?: string; location?: { name?: string }; updated_at?: string }>;
    };
    const kw = keyword.toLowerCase();
    return (j.jobs ?? [])
      .filter((p) => p.title && p.absolute_url && p.title.toLowerCase().includes(kw))
      .slice(0, 15)
      .map((p) => ({
        title: String(p.title),
        company: board,
        location: p.location?.name ?? null,
        url: String(p.absolute_url),
        description: `${p.title} — ${p.location?.name ?? ""}`.trim(),
        source: "greenhouse",
        postedOn: p.updated_at ?? null,
      }));
  } catch {
    return [];
  }
}

/** Lever public postings API — no key required. */
export async function fetchLeverJobs(company: string, keyword: string): Promise<SourcedJob[]> {
  try {
    const r = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as Array<{
      text?: string;
      hostedUrl?: string;
      categories?: { location?: string };
      createdAt?: number;
    }>;
    const kw = keyword.toLowerCase();
    return (Array.isArray(j) ? j : [])
      .filter((p) => p.text && p.hostedUrl && p.text.toLowerCase().includes(kw))
      .slice(0, 15)
      .map((p) => ({
        title: String(p.text),
        company,
        location: p.categories?.location ?? null,
        url: String(p.hostedUrl),
        description: `${p.text} — ${p.categories?.location ?? ""}`.trim(),
        source: "lever",
        postedOn: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null,
      }));
  } catch {
    return [];
  }
}
