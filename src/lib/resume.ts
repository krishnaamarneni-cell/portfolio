import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

const TABLE = "resume_versions";

export type ResumeSection = {
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location: string;
    period: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    tech: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  certifications: string[];
  additional: string;
};

export type ResumeAnalysis = {
  atsScore: number;
  keywordScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  redFlags: string[];
  titleAlignment: string;
};

export type ResumeVersion = {
  id: string;
  company_name: string;
  job_title: string;
  job_description: string;
  base_resume_text: string;
  tailored_resume: ResumeSection;
  analysis: ResumeAnalysis;
  ats_score: number | null;
  tone: string;
  emphasis: string;
  seniority: string;
  created_at: string;
  updated_at: string;
};

export type ResumeVersionInput = {
  company_name: string;
  job_title: string;
  job_description: string;
  base_resume_text: string;
  tailored_resume: ResumeSection;
  analysis: ResumeAnalysis;
  ats_score?: number | null;
  tone?: string;
  emphasis?: string;
  seniority?: string;
};

export async function listVersions(): Promise<ResumeVersion[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ResumeVersion[];
}

export async function getVersion(id: string): Promise<ResumeVersion | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ResumeVersion) ?? null;
}

export async function saveVersion(
  input: ResumeVersionInput
): Promise<ResumeVersion> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      company_name: input.company_name,
      job_title: input.job_title,
      job_description: input.job_description,
      base_resume_text: input.base_resume_text,
      tailored_resume: input.tailored_resume,
      analysis: input.analysis,
      ats_score: input.ats_score ?? null,
      tone: input.tone ?? "strong",
      emphasis: input.emphasis ?? "balanced",
      seniority: input.seniority ?? "",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ResumeVersion;
}

export async function updateVersion(
  id: string,
  patch: Partial<ResumeVersionInput>
): Promise<ResumeVersion> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ResumeVersion;
}

export async function deleteVersion(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from(TABLE).delete().eq("id", id);
}
