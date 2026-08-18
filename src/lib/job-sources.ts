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
  // Probed 2026-08-17; the SAP hit count each returned is noted so a tenant
  // that silently stops matching is easy to spot.
  { company: "Abbott", tenant: "abbott", wd: "wd5", site: "abbottcareers" }, // SAP=164
  { company: "Medtronic", tenant: "medtronic", wd: "wd1", site: "MedtronicCareers" }, // SAP=91
  { company: "AstraZeneca", tenant: "astrazeneca", wd: "wd3", site: "Careers" }, // SAP=72
  { company: "Stryker", tenant: "stryker", wd: "wd1", site: "StrykerCareers" }, // SAP=55
  { company: "NVIDIA", tenant: "nvidia", wd: "wd5", site: "NVIDIAExternalCareerSite" }, // SAP=46
  { company: "Gilead", tenant: "gilead", wd: "wd1", site: "gileadcareers" }, // SAP=43
  { company: "Target", tenant: "target", wd: "wd5", site: "targetcareers" }, // SAP=28
  { company: "Adobe", tenant: "adobe", wd: "wd5", site: "external_experienced" }, // SAP=16
  { company: "Mastercard", tenant: "mastercard", wd: "wd1", site: "CorporateCareers" }, // SAP=12
  { company: "PayPal", tenant: "paypal", wd: "wd1", site: "jobs" }, // SAP=7
  { company: "Dell", tenant: "dell", wd: "wd1", site: "External" }, // SAP=0, live for other keywords
];

/**
 * Greenhouse public job boards, keyed by slug — one identifier instead of
 * Workday's tenant/host/site triple, and no key required. Skews tech, so this
 * is the half of the pool that carries AI/engineering roles rather than SAP.
 *
 * Every slug below returned a non-empty board when probed on 2026-08-17.
 */
export const GREENHOUSE_BOARDS: Array<{ company: string; board: string }> = [
  { company: "Anthropic", board: "anthropic" },
  { company: "Stripe", board: "stripe" },
  { company: "Databricks", board: "databricks" },
  { company: "Datadog", board: "datadog" },
  { company: "Waymo", board: "waymo" },
  { company: "Cloudflare", board: "cloudflare" },
  { company: "Samsara", board: "samsara" },
  { company: "Pinterest", board: "pinterest" },
  { company: "Scale AI", board: "scaleai" },
  { company: "GitLab", board: "gitlab" },
  { company: "Affirm", board: "affirm" },
  { company: "Coinbase", board: "coinbase" },
  { company: "Lyft", board: "lyft" },
  { company: "Figma", board: "figma" },
  { company: "Twilio", board: "twilio" },
  { company: "Flexport", board: "flexport" },
  { company: "Reddit", board: "reddit" },
  { company: "Asana", board: "asana" },
  { company: "Robinhood", board: "robinhood" },
  { company: "Instacart", board: "instacart" },
  { company: "Gusto", board: "gusto" },
  { company: "Vercel", board: "vercel" },
  { company: "Carta", board: "carta" },
  { company: "Chime", board: "chime" },
  { company: "SoFi", board: "sofi" },
  { company: "Discord", board: "discord" },
  { company: "Dropbox", board: "dropbox" },
  { company: "Airtable", board: "airtable" },
];

/**
 * Search every Greenhouse board once and filter locally.
 *
 * Greenhouse has no server-side query, so fetching per keyword would re-pull
 * whole boards N times. One fetch per board, matched against all keywords, is
 * the difference between ~28 requests and ~112.
 */
export async function fetchGreenhouseBoards(keywords: string[]): Promise<SourcedJob[]> {
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (!kws.length) return [];

  const results = await Promise.all(
    GREENHOUSE_BOARDS.map(async ({ company, board }) => {
      try {
        const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) return [];
        const j = (await r.json()) as {
          jobs?: Array<{
            title?: string;
            absolute_url?: string;
            location?: { name?: string };
            updated_at?: string;
          }>;
        };
        return (j.jobs ?? [])
          .filter((p) => {
            if (!p.title || !p.absolute_url) return false;
            const t = p.title.toLowerCase();
            return kws.some((k) => t.includes(k));
          })
          .slice(0, 10)
          .map<SourcedJob>((p) => ({
            title: String(p.title),
            company,
            location: p.location?.name ?? null,
            url: String(p.absolute_url),
            description: `${p.title} — ${company}${p.location?.name ? ` — ${p.location.name}` : ""}`,
            source: "greenhouse",
            postedOn: p.updated_at ?? null,
          }));
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

/**
 * Split requested company names into ones we can fetch live (Workday tenants)
 * and ones we can't ("off-platform" — e.g. Pepsi runs iCIMS). The route uses
 * offPlatform to tell the user rather than silently searching everyone.
 */
export function splitLiveCompanies(companies: string[]): {
  live: WorkdayTenant[];
  offPlatform: string[];
} {
  const live: WorkdayTenant[] = [];
  const offPlatform: string[] = [];
  for (const raw of companies) {
    const w = raw.trim().toLowerCase();
    if (!w) continue;
    const t = WORKDAY_TENANTS.find(
      (t) => t.company.toLowerCase().includes(w) || w.includes(t.tenant)
    );
    if (t) {
      if (!live.includes(t)) live.push(t);
    } else if (!offPlatform.some((o) => o.toLowerCase() === w)) {
      offPlatform.push(raw.trim());
    }
  }
  return { live, offPlatform };
}

type WorkdayPosting = {
  title?: string;
  externalPath?: string;
  postedOn?: string;
  locationsText?: string;
  bulletFields?: string[];
};

/**
 * Location string for a posting. Prefer `locationsText` (present on most
 * tenants, and prefixed with a country code like "US - GA - Atlanta" /
 * "IND - Telangana - Hyderabad"); fall back to bulletFields, dropping the
 * req-id entry.
 */
function locationFrom(p: WorkdayPosting): string | null {
  if (p.locationsText && p.locationsText.trim()) {
    return p.locationsText.replace(/\s*\(Inactive\)\s*$/i, "").trim();
  }
  const parts = (p.bulletFields ?? []).filter(
    (b) => b && !/^[A-Z]{0,3}[-_]?\d{4,}/.test(b.trim())
  );
  if (parts.length) return parts.join(", ");

  // Last resort: the city is always in the posting path — Accenture in
  // particular returns neither locationsText nor bulletFields on some rows,
  // and a null location silently exempts a posting from the geography check.
  // "/job/Budapest-Millennium-Gardens/Senior-SAP-Consultant_R00319877"
  const seg = p.externalPath?.match(/^\/job\/([^/]+)\//)?.[1];
  if (!seg) return null;
  const city = decodeURIComponent(seg).replace(/-/g, " ").trim();
  return city && !/^\d+$/.test(city) ? city : null;
}

/**
 * Does a posting's location satisfy the user's location/country filter?
 *
 * Countries are matched on the leading ISO-ish code Workday emits ("US -",
 * "IND -", "NLD -") as well as the full name, so "usa" reliably keeps US roles
 * and drops the India-heavy defaults. Anything not recognised as a country is
 * treated as a free-text city/state/remote match.
 */
const COUNTRY_RULES: Array<{ aliases: RegExp; match: RegExp }> = [
  {
    aliases: /^(us|usa|u\.s\.?|united states|america)$/i,
    match: /(^|[^a-z])(us|usa)\s*-|united states|u\.s\.a?\.?\b/i,
  },
  { aliases: /^(india|ind|bharat)$/i, match: /(^|[^a-z])ind\s*-|\bindia\b/i },
  {
    aliases: /^(netherlands|nl|nld|holland|nederland)$/i,
    match: /(^|[^a-z])nld\s*-|\bnetherlands\b|\bnederland\b/i,
  },
  { aliases: /^(uk|gb|gbr|united kingdom|england|britain)$/i, match: /(^|[^a-z])(gbr|gb)\s*-|united kingdom|\bengland\b/i },
  { aliases: /^(canada|can)$/i, match: /(^|[^a-z])can\s*-|\bcanada\b/i },
  { aliases: /^(germany|deu|ger|deutschland)$/i, match: /(^|[^a-z])deu\s*-|\bgermany\b/i },
];

export function matchesLocation(jobLocation: string | null, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q || q === "anywhere") return true;
  const loc = (jobLocation ?? "").toLowerCase();

  if (q === "remote") return /remote|anywhere|work from home|virtual/.test(loc);
  if (!loc) return false;

  const country = COUNTRY_RULES.find((r) => r.aliases.test(q));
  if (country) return country.match.test(jobLocation ?? "");

  // Free text: city / state / abbrev — substring match either way.
  return loc.includes(q) || q.includes(loc);
}


/**
 * Ask a Workday tenant to return only postings in a given country.
 *
 * Filtering on the location STRING does not work: Accenture returns "Location
 * Negotiable", Intel returns "2 Locations", and neither says where. Workday
 * knows the answer though — it publishes location facets — so the filter is
 * pushed to the source instead of guessed afterwards. Accenture drops from
 * 2,000 SAP hits to ~116 US ones, and every posting that comes back is in
 * country even when its display string is vague.
 *
 * Tenants disagree on how they expose this, so three shapes are handled:
 *   - a top-level country facet (Abbott: `Location_Country`)
 *   - a country facet nested under `locationMainGroup` (Accenture:
 *     `locationCountry`)
 *   - no country facet at all, only city-level `locations` (Intel, Merck) —
 *     in which case the US-looking location ids are selected individually.
 */
type FacetValue = { id?: string; descriptor?: string; count?: number };
type Facet = { facetParameter?: string; descriptor?: string; values?: Array<FacetValue & { facetParameter?: string; values?: FacetValue[] }> };

const US_LOCATION = /(usa?|united states|u\.s\.a?\.)|^us\s*[-,]/i;
const US_STATE = /(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)/i;

/** Resolved once per tenant per process — facet ids are stable. */
const facetCache = new Map<string, Record<string, string[]> | null>();

function isUnitedStates(descriptor: string): boolean {
  return /^(united states( of america)?|usa?)$/i.test(descriptor.trim());
}

async function resolveCountryFacet(
  t: WorkdayTenant,
  keyword: string
): Promise<Record<string, string[]> | null> {
  const key = t.tenant;
  if (facetCache.has(key)) return facetCache.get(key) ?? null;

  let resolved: Record<string, string[]> | null = null;
  try {
    const base = `https://${t.tenant}.${t.wd}.myworkdayjobs.com`;
    const r = await fetch(`${base}/wday/cxs/${t.tenant}/${t.site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: keyword }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const j = (await r.json()) as { facets?: Facet[] };
      const facets = j.facets ?? [];

      // 1 — a country facet at the top level.
      for (const f of facets) {
        if (!f.facetParameter || !/country/i.test(f.facetParameter)) continue;
        const us = (f.values ?? []).find((v) => isUnitedStates(v.descriptor ?? ""));
        if (us?.id) resolved = { [f.facetParameter]: [us.id] };
      }

      // 2 — a country facet nested inside locationMainGroup.
      if (!resolved) {
        const groups = facets.find((f) => f.facetParameter === "locationMainGroup")?.values ?? [];
        for (const g of groups) {
          if (!g.facetParameter || !/country/i.test(g.facetParameter)) continue;
          const us = (g.values ?? []).find((v) => isUnitedStates(v.descriptor ?? ""));
          if (us?.id) resolved = { [g.facetParameter]: [us.id] };
        }

        // 3 — no country grouping; pick the US cities out of `locations`.
        if (!resolved) {
          const locs = groups.find((g) => g.facetParameter === "locations")?.values ?? [];
          const ids = locs
            .filter((v) => {
              const d = v.descriptor ?? "";
              return US_LOCATION.test(d) || US_STATE.test(d);
            })
            .map((v) => v.id)
            .filter((id): id is string => Boolean(id))
            .slice(0, 60);
          if (ids.length) resolved = { locations: ids };
        }
      }
    }
  } catch {
    resolved = null;
  }

  facetCache.set(key, resolved);
  return resolved;
}

async function fetchOneTenant(
  t: WorkdayTenant,
  keyword: string,
  perTenant: number,
  locationFilter: string,
  fetchLimit: number,
  appliedFacets: Record<string, string[]> = {}
): Promise<SourcedJob[]> {
  const base = `https://${t.tenant}.${t.wd}.myworkdayjobs.com`;
  try {
    const r = await fetch(`${base}/wday/cxs/${t.tenant}/${t.site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        appliedFacets,
        limit: Math.min(20, fetchLimit),
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
      .map((p) => {
        const location = locationFrom(p);
        return {
          title: String(p.title),
          company: t.company,
          location,
          // Public posting URL — the CXS path maps onto the external site.
          url: `${base}/${t.site}${p.externalPath}`,
          description: [p.title, t.company, location].filter(Boolean).join(" — "),
          source: "workday",
          postedOn: p.postedOn ?? null,
        };
      })
      .filter((job) => matchesLocation(job.location, locationFilter))
      .slice(0, perTenant);
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
  location?: string;
  perTenant?: number;
  maxTenants?: number;
  /** Restrict to a country using Workday's own facets, e.g. "United States". */
  country?: string;
}): Promise<SourcedJob[]> {
  const keyword = opts.keyword?.trim() || "SAP";
  const perTenant = Math.max(1, Math.min(20, opts.perTenant ?? 6));
  const locationFilter = (opts.location ?? "").trim();
  // When filtering by location, pull a bigger page per tenant so there's enough
  // to filter down from (Workday sorts by relevance, not location).
  const fetchLimit = locationFilter && locationFilter.toLowerCase() !== "anywhere" ? 20 : perTenant;

  // When companies are named, search ONLY the ones in the live pool. Previously
  // an unmatched name (e.g. "Pepsi", which isn't on Workday) silently fell back
  // to searching every tenant, so the user saw other companies' jobs.
  const named = (opts.companies ?? []).map((c) => c.trim()).filter(Boolean);
  let tenants = named.length ? splitLiveCompanies(named).live : WORKDAY_TENANTS;
  tenants = tenants.slice(0, Math.max(1, opts.maxTenants ?? WORKDAY_TENANTS.length));
  if (tenants.length === 0) return [];

  const wantsUS = /^(united states|usa?|america)$/i.test((opts.country ?? "").trim());

  const results = await Promise.all(
    tenants.map(async (t) => {
      // Push the country filter into Workday itself where the tenant supports
      // it — far more reliable than reading "Location Negotiable" afterwards.
      const facets = wantsUS ? await resolveCountryFacet(t, keyword) : null;
      return fetchOneTenant(t, keyword, perTenant, locationFilter, fetchLimit, facets ?? {});
    })
  );
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
