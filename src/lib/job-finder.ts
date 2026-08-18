import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type JobListing = {
  id: string;
  source_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  work_type: string | null;
  description: string | null;
  required_skills: string[] | null;
  application_url: string;
  /** The ATS's own job id — primary dedup key. Needs job_source_v2.sql. */
  external_id: string | null;
  source_url: string | null;
  department: string | null;
  seniority: string | null;
  employment_type: string | null;
  sponsorship: string | null;
  clearance: string | null;
  posted_at: string | null;
  expires_at: string | null;
  salary_range: string | null;
  match_score: number | null;
  match_recommendation: string | null;
  match_skills: string[] | null;
  missing_skills: string[] | null;
  match_summary: string | null;
  resume_keywords: string[] | null;
  status: string;
  priority: string | null;
  notes: string | null;
  saved_at: string | null;
  ignored_at: string | null;
  source_type: string | null;
  crawled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobSource = {
  id: string;
  name: string;
  careers_url: string;
  source_type: string;
  ats: string | null;
  config: Record<string, unknown>;
  active: boolean;
  crawl_frequency: string;
  last_crawled_at: string | null;
  last_crawl_status: string | null;
  last_crawl_error: string | null;
  last_crawl_jobs_found: number;
  total_jobs_found: number;
  created_at: string;
  updated_at: string;
};

export type JobFinderSettings = {
  keywords: string[];
  locations: string[];
  work_types: string[];
  target_companies: string[];
  min_match_score: number;
  alerts_enabled: boolean;
  profile: {
    summary: string;
    skills: string[];
    target_roles: string[];
    experience_years: number;
    education: string;
  };
};

export const DEFAULT_SETTINGS: JobFinderSettings = {
  keywords: ["SAP", "S/4HANA", "MM/SD", "supply chain", "ERP", "procurement"],
  locations: ["Remote", "United States"],
  work_types: ["remote", "hybrid"],
  target_companies: [],
  min_match_score: 60,
  alerts_enabled: false,
  profile: {
    summary:
      "7+ years SAP MM/SD functional experience. SAP ECC and S/4HANA. P2P, O2C, MRP, procurement, inventory, logistics, production support. EDI/IDocs and master data. MBA in Supply Chain. Business systems, analytics, and process improvement.",
    skills: [
      "SAP MM", "SAP SD", "SAP S/4HANA", "SAP ECC", "SAP Ariba",
      "MRP", "EDI/IDocs", "Master Data", "P2P", "O2C",
      "Procurement", "Inventory Management", "Supply Chain",
      "Production Support", "Business Systems Analysis",
      "Process Improvement", "Analytics", "Reporting",
    ],
    target_roles: [
      "SAP MM/SD Functional Consultant",
      "SAP Business Systems Analyst",
      "SAP Supply Chain Analyst",
      "ERP Business Analyst",
      "SAP S/4HANA Consultant",
      "Material Planning Systems Analyst",
    ],
    experience_years: 7,
    education: "MBA in Supply Chain Management",
  },
};

export async function getJobFinderSettings(): Promise<JobFinderSettings> {
  try {
    const db = requireSupabaseAdmin();
    const { data } = await db
      .from("admin_settings")
      .select("job_finder_settings")
      .eq("id", "singleton")
      .maybeSingle();
    if (data?.job_finder_settings && typeof data.job_finder_settings === "object") {
      return { ...DEFAULT_SETTINGS, ...(data.job_finder_settings as Partial<JobFinderSettings>) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveJobFinderSettings(settings: Partial<JobFinderSettings>): Promise<JobFinderSettings> {
  const current = await getJobFinderSettings();
  const merged = { ...current, ...settings };
  const db = requireSupabaseAdmin();
  await db
    .from("admin_settings")
    .update({ job_finder_settings: merged })
    .eq("id", "singleton");
  return merged;
}

export type ListingsQuery = {
  status?: string;
  search?: string;
  company?: string;
  location?: string;
  work_type?: string;
  min_score?: number;
  source_type?: string;
  sort?: "newest" | "match" | "company";
  /** Only postings discovered within the last N hours — the "Today" feed. */
  fresh_hours?: number;
  limit?: number;
  offset?: number;
};

export async function queryListings(q: ListingsQuery) {
  const db = requireSupabaseAdmin();
  let query = db.from("job_listings").select("*", { count: "exact" });

  if (q.status && q.status !== "all") {
    if (q.status === "active") {
      query = query.in("status", ["new", "saved"]);
    } else {
      query = query.eq("status", q.status);
    }
  }

  if (q.search) {
    query = query.or(
      `title.ilike.%${q.search}%,company.ilike.%${q.search}%,description.ilike.%${q.search}%`
    );
  }
  if (q.company) query = query.ilike("company", `%${q.company}%`);
  if (q.location) query = query.ilike("location", `%${q.location}%`);
  if (q.work_type) query = query.eq("work_type", q.work_type);
  if (q.min_score) query = query.gte("match_score", q.min_score);
  if (q.source_type) query = query.eq("source_type", q.source_type);
  if (q.fresh_hours && q.fresh_hours > 0) {
    query = query.gte("created_at", new Date(Date.now() - q.fresh_hours * 3_600_000).toISOString());
  }

  if (q.sort === "match") {
    query = query.order("match_score", { ascending: false, nullsFirst: false });
  } else if (q.sort === "company") {
    query = query.order("company", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const limit = Math.min(q.limit || 50, 100);
  query = query.range(q.offset || 0, (q.offset || 0) + limit - 1);

  const { data, count, error } = await query;
  return { listings: (data ?? []) as JobListing[], total: count ?? 0, error: error?.message };
}

export async function upsertListing(
  listing: Partial<JobListing> & { application_url: string; title: string }
): Promise<{ id: string; isNew: boolean }> {
  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();

  // Match on the URL exactly as stored. Lowercasing here (while inserting the
  // original case) made this lookup always miss, so every re-run fell through
  // to an insert that then tripped the unique index on lower(application_url).
  const { data: existing } = await db
    .from("job_listings")
    .select("id")
    .eq("application_url", listing.application_url)
    .maybeSingle();

  if (existing) {
    await db
      .from("job_listings")
      .update({ ...listing, updated_at: now })
      .eq("id", existing.id);
    return { id: existing.id, isNew: false };
  }

  const { data, error } = await db
    .from("job_listings")
    .insert({ ...listing, created_at: now, updated_at: now })
    .select("id")
    .single();

  if (error) {
    // 23505 = the same posting under different URL casing. It is already
    // stored, and nothing about a re-discovered listing needs updating.
    if (error.code === "23505") return { id: "", isNew: false };
    throw new Error(error.message);
  }
  return { id: data.id, isNew: true };
}

/**
 * Insert many discovered listings in a few round trips.
 *
 * upsertListing() costs two queries per row, which is fine for a manual import
 * but not for a crawl across 20+ employers — a few hundred postings would spend
 * the whole request budget on database latency. This reads the existing URLs
 * once and bulk-inserts only what's new.
 */
export async function bulkUpsertListings(
  listings: Array<Partial<JobListing> & { application_url: string; title: string }>
): Promise<{ added: number; skipped: number; errors: string[] }> {
  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const errors: string[] = [];

  // Two key spaces, in priority order:
  //   1. platform + the ATS's own job id — stable across URL changes, and the
  //      only workable key for email requirements, where several roles from one
  //      recruiter share a single mailto apply link
  //   2. the lowercased apply URL — the fallback for sources with no id
  const existingUrls = new Set<string>();
  const existingIds = new Set<string>();
  const PAGE = 1000;
  let hasExternalId = true;

  type KeyRow = {
    application_url: string;
    source_type?: string | null;
    external_id?: string | null;
  };

  /** One page of dedup keys. Falls back to URL-only before job_source_v2.sql. */
  const keyPage = async (
    from: number
  ): Promise<{ rows: KeyRow[] | null; error: string | null }> => {
    if (hasExternalId) {
      const res = await db
        .from("job_listings")
        .select("application_url,source_type,external_id")
        .range(from, from + PAGE - 1);
      if (!res.error) return { rows: (res.data ?? []) as unknown as KeyRow[], error: null };
      // Tolerate the column being absent so discovery keeps working until the
      // migration is applied.
      if (/external_id|column/i.test(res.error.message)) hasExternalId = false;
      else return { rows: null, error: res.error.message };
    }
    const res = await db
      .from("job_listings")
      .select("application_url")
      .range(from, from + PAGE - 1);
    if (res.error) return { rows: null, error: res.error.message };
    return { rows: (res.data ?? []) as unknown as KeyRow[], error: null };
  };

  for (let from = 0; ; from += PAGE) {
    const { rows, error } = await keyPage(from);
    if (error) {
      errors.push(error);
      break;
    }
    if (!rows?.length) break;
    for (const r of rows) {
      existingUrls.add(r.application_url.toLowerCase());
      if (r.external_id) existingIds.add(`${r.source_type ?? ""}:${r.external_id}`);
    }
    if (rows.length < PAGE) break;
  }

  // Dedupe against the table and within this batch — the same posting often
  // surfaces under several keywords.
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();
  const fresh = listings.filter((l) => {
    const idKey =
      hasExternalId && l.external_id ? `${l.source_type ?? ""}:${l.external_id}` : null;
    const urlKey = l.application_url.toLowerCase();

    if (idKey && (existingIds.has(idKey) || seenIds.has(idKey))) return false;

    // The URL must still be checked even when an id is present. Rows stored
    // before external_id existed carry a null id, so an id lookup finds nothing
    // and the posting looks new — then the insert trips the unique index on
    // lower(application_url). Skipping this check cost every insert in a crawl.
    //
    // The exception is a deliberately shared URL: an email requirement's apply
    // link is a mailto to the recruiter, and several distinct roles from one
    // person share it. There the id is the only thing that separates them.
    const urlIsShared = /^mailto:/i.test(l.application_url);
    if (!urlIsShared && (existingUrls.has(urlKey) || seenUrls.has(urlKey))) return false;

    if (idKey) seenIds.add(idKey);
    if (!urlIsShared) seenUrls.add(urlKey);
    return true;
  });

  let added = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200).map((l) => ({ ...l, created_at: now, updated_at: now }));
    const { data, error } = await db.from("job_listings").insert(chunk).select("id");
    if (error) errors.push(error.message);
    else added += data?.length ?? 0;
  }

  return { added, skipped: listings.length - fresh.length, errors: errors.slice(0, 3) };
}

export async function updateListingStatus(id: string, status: string, extra?: Record<string, unknown>) {
  const db = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now, ...extra };
  if (status === "saved") patch.saved_at = now;
  if (status === "ignored") patch.ignored_at = now;
  await db.from("job_listings").update(patch).eq("id", id);
}

export async function getListingStats() {
  const db = requireSupabaseAdmin();
  const { data } = await db
    .from("job_listings")
    .select("status")
    .limit(10000);

  const counts: Record<string, number> = { new: 0, saved: 0, applied: 0, ignored: 0, expired: 0 };
  for (const r of data ?? []) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  return counts;
}

/**
 * Active listings per platform, for the source filter.
 *
 * Counted over new+saved only: a filter offering "Lever (1)" when that one
 * listing was ignored months ago would send the user to an empty view.
 */
export async function getPlatformCounts(): Promise<Record<string, number>> {
  const db = requireSupabaseAdmin();
  const { data } = await db
    .from("job_listings")
    .select("source_type")
    .in("status", ["new", "saved"])
    .limit(10000);

  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = r.source_type || "unknown";
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
