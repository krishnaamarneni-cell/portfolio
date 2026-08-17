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

  const { data: existing } = await db
    .from("job_listings")
    .select("id")
    .eq("application_url", listing.application_url.toLowerCase())
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
    .insert({ ...listing, application_url: listing.application_url, created_at: now, updated_at: now })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, isNew: true };
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
