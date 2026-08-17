/** Client-side mirrors of the Job Finder rows. The lib module is server-only. */

export type Listing = {
  id: string;
  source_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  work_type: string | null;
  description: string | null;
  application_url: string;
  posted_at: string | null;
  salary_range: string | null;
  match_score: number | null;
  match_recommendation: string | null;
  match_skills: string[] | null;
  missing_skills: string[] | null;
  match_summary: string | null;
  resume_keywords: string[] | null;
  status: string;
  notes: string | null;
  source_type: string | null;
  created_at: string;
};

export type Source = {
  id: string;
  name: string;
  careers_url: string;
  source_type: string;
  ats: string | null;
  active: boolean;
  crawl_frequency: string;
  last_crawled_at: string | null;
  last_crawl_status: string | null;
  last_crawl_error: string | null;
  last_crawl_jobs_found: number;
  total_jobs_found: number;
};

export type DirectoryEntry = {
  name: string;
  careers_url: string;
  ats: string;
  sap_search_url: string | null;
  account_required: boolean;
  added: boolean;
};

export type Settings = {
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

export type Stats = Record<string, number>;

/** Colour + label for a match score. Shared by every sub-tab. */
export function scoreTone(score: number | null): { label: string; className: string } {
  if (score === null || score === undefined)
    return { label: "Unscored", className: "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]" };
  if (score >= 85) return { label: "Strong", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" };
  if (score >= 70) return { label: "Good", className: "bg-sky-500/10 text-sky-500 border-sky-500/30" };
  if (score >= 50) return { label: "Stretch", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" };
  return { label: "Skip", className: "bg-rose-500/10 text-rose-500 border-rose-500/30" };
}

export function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
