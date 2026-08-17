import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getJobFinderSettings,
  saveJobFinderSettings,
  DEFAULT_SETTINGS,
  type JobFinderSettings,
} from "@/lib/job-finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getJobFinderSettings();
  return NextResponse.json({ settings, defaults: DEFAULT_SETTINGS });
}

function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 60);
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<JobFinderSettings>;
  const patch: Partial<JobFinderSettings> = {};

  const keywords = cleanList(body.keywords);
  if (keywords) patch.keywords = keywords;
  const locations = cleanList(body.locations);
  if (locations) patch.locations = locations;
  const workTypes = cleanList(body.work_types);
  if (workTypes) patch.work_types = workTypes;
  const companies = cleanList(body.target_companies);
  if (companies) patch.target_companies = companies;

  if (typeof body.min_match_score === "number") {
    patch.min_match_score = Math.max(0, Math.min(100, Math.round(body.min_match_score)));
  }
  if (typeof body.alerts_enabled === "boolean") patch.alerts_enabled = body.alerts_enabled;

  if (body.profile && typeof body.profile === "object") {
    const current = await getJobFinderSettings();
    patch.profile = {
      ...current.profile,
      summary:
        typeof body.profile.summary === "string" ? body.profile.summary.trim() : current.profile.summary,
      education:
        typeof body.profile.education === "string"
          ? body.profile.education.trim()
          : current.profile.education,
      experience_years:
        typeof body.profile.experience_years === "number"
          ? body.profile.experience_years
          : current.profile.experience_years,
      skills: cleanList(body.profile.skills) ?? current.profile.skills,
      target_roles: cleanList(body.profile.target_roles) ?? current.profile.target_roles,
    };
  }

  try {
    const settings = await saveJobFinderSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    const missing = /does not exist|schema cache|column/i.test(message);
    return NextResponse.json(
      { error: missing ? "Run supabase/job_finder.sql in Supabase to enable the Job Finder." : message },
      { status: 500 }
    );
  }
}
