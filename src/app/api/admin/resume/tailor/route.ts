import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/lib/agents";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { saveVersion, type ResumeSection, type ResumeAnalysis } from "@/lib/resume";
import type { SiteContent } from "@/lib/site-content-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  jobDescription: string;
  companyName?: string;
  jobTitle?: string;
  seniority?: string;
  tone?: string;
  emphasis?: string;
  customResume?: string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.jobDescription?.trim()) {
    return NextResponse.json({ error: "Job description required" }, { status: 400 });
  }

  const [jobs, site] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
  ]);

  const baseResume = body.customResume?.trim() || buildResumeText(jobs, site);

  const tone = body.tone || "strong";
  const emphasis = body.emphasis || "balanced";
  const seniority = body.seniority || "";

  const systemPrompt = `You are an elite executive resume writer with 20+ years of experience optimizing resumes for ATS systems, recruiter screening, and hiring manager review. You have deep expertise in technical, business, analyst, product, operations, and software engineering roles.

TASK: Given a candidate's current resume and a target job description, produce a tailored resume and analysis.

RULES — NON-NEGOTIABLE:
1. NEVER invent experience, employers, dates, degrees, or certifications
2. You MAY rewrite existing bullets to sound stronger, more results-driven, and more relevant
3. Mirror job description keywords naturally — no keyword stuffing
4. Use strong action verbs: Led, Architected, Delivered, Streamlined, Automated, Reduced, Increased
5. Every bullet should follow: [Action verb] + [what you did] + [measurable result/impact]
6. BANNED words: passionate, hardworking, team player, leverage, synergy, innovative, drive growth
7. Keep section titles standard: Summary, Skills, Experience, Education, Projects, Certifications
8. Single-column, no tables, no graphics — ATS-safe
9. Writing quality: sharp, specific, human-sounding — not generic AI boilerplate
10. Prioritize interview conversion

TONE: ${tone === "conservative" ? "Professional, measured, traditional corporate language" : tone === "executive" ? "C-suite authority, strategic vision, board-level impact" : "Confident, direct, results-focused — strong without being aggressive"}

EMPHASIS: ${emphasis === "ats" ? "Maximum keyword density for ATS parsing — prioritize exact-match terms from JD" : emphasis === "recruiter" ? "Readability first — clear story arc, skimmable, compelling narrative" : "Balance ATS keyword coverage with recruiter readability"}

${seniority ? `TARGET SENIORITY: ${seniority} — calibrate language, scope, and impact metrics accordingly` : ""}

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown fences:
{
  "resume": {
    "summary": "3-4 sentence professional summary tailored to this exact role",
    "skills": ["skill1", "skill2", ...],
    "experience": [
      {
        "title": "Job Title",
        "company": "Company Name",
        "location": "City, State",
        "period": "Start - End",
        "bullets": ["Achievement bullet 1", "Achievement bullet 2", ...]
      }
    ],
    "projects": [
      {
        "name": "Project Name",
        "description": "One-line description",
        "tech": ["tech1", "tech2"]
      }
    ],
    "education": [
      {
        "degree": "Degree Name",
        "school": "University",
        "year": "Year"
      }
    ],
    "certifications": ["Cert 1", "Cert 2"],
    "additional": ""
  },
  "analysis": {
    "atsScore": 85,
    "keywordScore": 78,
    "matchedKeywords": ["keyword1", "keyword2"],
    "missingKeywords": ["keyword3", "keyword4"],
    "suggestions": ["Suggestion 1", "Suggestion 2"],
    "redFlags": ["Red flag 1"],
    "titleAlignment": "Your current title maps well to the target role because..."
  }
}`;

  const userPrompt = `TARGET ROLE:
Company: ${body.companyName || "Not specified"}
Title: ${body.jobTitle || "Not specified"}

JOB DESCRIPTION:
${body.jobDescription}

CURRENT RESUME:
${baseResume}

Analyze the job description, identify critical keywords and requirements, then produce a tailored resume and analysis. Keep ALL real experience, dates, companies, and education intact. Rewrite bullets and summary to align with this specific role.`;

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt,
    userPrompt,
    maxTokens: 4096,
  });

  if (!result.ok || !result.content) {
    return NextResponse.json(
      { error: result.error || "AI generation failed" },
      { status: 502 }
    );
  }

  let parsed: { resume: ResumeSection; analysis: ResumeAnalysis };
  try {
    const jsonStr = result.content
      .replace(/```json?\s*\n?/g, "")
      .replace(/```/g, "")
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response. Try again." },
      { status: 502 }
    );
  }

  if (!parsed.resume || !parsed.analysis) {
    return NextResponse.json(
      { error: "Incomplete AI response. Try again." },
      { status: 502 }
    );
  }

  let savedId: string | null = null;
  try {
    const saved = await saveVersion({
      company_name: body.companyName || "",
      job_title: body.jobTitle || "",
      job_description: body.jobDescription,
      base_resume_text: baseResume,
      tailored_resume: parsed.resume,
      analysis: parsed.analysis,
      ats_score: parsed.analysis.atsScore ?? null,
      tone,
      emphasis,
      seniority: seniority || "",
    });
    savedId = saved.id;
  } catch (e) {
    console.error("[resume/tailor] saveVersion failed (table may not exist):", e);
  }

  return NextResponse.json({
    id: savedId,
    resume: parsed.resume,
    analysis: parsed.analysis,
  });
}

function buildResumeText(
  jobs: Array<{
    title: string;
    company: string;
    period: string;
    location: string;
    description?: string;
    highlights?: string[];
    tags?: string[];
  }>,
  site: SiteContent
): string {
  const parts: string[] = [];

  const aboutText = [site.about?.paragraph_one, site.about?.paragraph_two]
    .filter(Boolean)
    .join(" ");
  if (aboutText) {
    parts.push(`SUMMARY:\n${aboutText}`);
  }

  if (site.skills?.skills?.length) {
    parts.push(`SKILLS:\n${site.skills.skills.join(", ")}`);
  }

  if (jobs.length > 0) {
    const expLines = jobs.map((j) => {
      let entry = `${j.title} @ ${j.company} (${j.period}, ${j.location})`;
      if (j.description) entry += `\n  ${j.description}`;
      if (j.highlights?.length) {
        entry += "\n  " + j.highlights.map((h) => `- ${h}`).join("\n  ");
      }
      if (j.tags?.length) entry += `\n  Skills: ${j.tags.join(", ")}`;
      return entry;
    });
    parts.push(`EXPERIENCE:\n${expLines.join("\n\n")}`);
  }

  return parts.join("\n\n") || "No resume data available";
}
