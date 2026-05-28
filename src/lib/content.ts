import { supabasePublic, supabaseAdmin } from "./supabase";
import { FALLBACK_JOBS, FALLBACK_PROJECTS } from "./content-fallback";
import { SITE_CONTENT_FALLBACK } from "./site-content-fallback";
import type {
  Job,
  JobInput,
  Project,
  ProjectInput,
} from "./content-types";
import type { SiteContent } from "./site-content-types";

const JOBS_TABLE = "jobs";
const PROJECTS_TABLE = "projects";
const SITE_CONTENT_TABLE = "site_content";

function deepMerge<T>(base: T, override: unknown): T {
  if (
    override &&
    typeof override === "object" &&
    !Array.isArray(override) &&
    base &&
    typeof base === "object" &&
    !Array.isArray(base)
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(override as Record<string, unknown>)) {
      const next = (override as Record<string, unknown>)[key];
      const prev = (base as Record<string, unknown>)[key];
      out[key] = deepMerge(prev as unknown, next);
    }
    return out as T;
  }
  return (override === undefined ? base : (override as T));
}

export async function fetchSiteContent(): Promise<SiteContent> {
  if (!supabasePublic) return SITE_CONTENT_FALLBACK;
  const { data, error } = await supabasePublic
    .from(SITE_CONTENT_TABLE)
    .select("data")
    .eq("id", "main")
    .maybeSingle();
  if (error) {
    console.error("[content] fetchSiteContent error:", error.message);
    return SITE_CONTENT_FALLBACK;
  }
  const stored = (data?.data ?? {}) as Partial<SiteContent>;
  return deepMerge(SITE_CONTENT_FALLBACK, stored);
}

export async function updateSiteContent(
  patch: Partial<SiteContent>
): Promise<SiteContent> {
  const client = requireAdminClient();
  const existing = await fetchSiteContent();
  const merged = deepMerge(existing, patch);
  const { data, error } = await client
    .from(SITE_CONTENT_TABLE)
    .upsert({ id: "main", data: merged, updated_at: new Date().toISOString() })
    .select("data")
    .single();
  if (error) throw new Error(error.message);
  return (data?.data ?? merged) as SiteContent;
}

export async function fetchJobs(): Promise<Job[]> {
  if (!supabasePublic) return FALLBACK_JOBS;
  const { data, error } = await supabasePublic
    .from(JOBS_TABLE)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[content] fetchJobs error:", error.message);
    return FALLBACK_JOBS;
  }
  if (!data || data.length === 0) return FALLBACK_JOBS;
  return data as Job[];
}

export async function fetchProjects(): Promise<Project[]> {
  if (!supabasePublic) return FALLBACK_PROJECTS;
  const { data, error } = await supabasePublic
    .from(PROJECTS_TABLE)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[content] fetchProjects error:", error.message);
    return FALLBACK_PROJECTS;
  }
  if (!data || data.length === 0) return FALLBACK_PROJECTS;
  return data as Project[];
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase admin client is not configured. Cannot write data."
    );
  }
  return supabaseAdmin;
}

export async function createJob(input: JobInput): Promise<Job> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from(JOBS_TABLE)
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Job;
}

export async function updateJob(id: string, input: Partial<JobInput>): Promise<Job> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from(JOBS_TABLE)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Job;
}

export async function deleteJob(id: string): Promise<void> {
  const client = requireAdminClient();
  const { error } = await client.from(JOBS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from(PROJECTS_TABLE)
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProject(
  id: string,
  input: Partial<ProjectInput>
): Promise<Project> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from(PROJECTS_TABLE)
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const client = requireAdminClient();
  const { error } = await client.from(PROJECTS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
