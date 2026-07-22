/**
 * Application Kit — prepares everything needed to apply to ONE job so the
 * human only has to review and submit.
 *
 * Deliberately NOT an auto-applier. Real ATS platforms (Workday, Taleo,
 * SuccessFactors) need accounts, multi-step forms and often CAPTCHAs, and
 * mass-submitted identical applications get flagged — which damages the
 * candidate far more than a wasted email. So the agent does the slow part
 * (tailoring, cover note, screening answers, gap prep) and stops at submit.
 */

import { runAgent } from "@/lib/agents";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { MASTER_RESUME } from "@/lib/master-resume";
import { resolveModel } from "@/lib/groq-models";

export type ScreeningAnswer = { question: string; answer: string };

export type ApplicationKit = {
  matchPct: number;
  resumeSummary: string;
  emphasizedBullets: string[];
  coverNote: string;
  screeningAnswers: ScreeningAnswer[];
  keywords: string[];
  gaps: string[];
};

export type JobInput = {
  jobTitle: string;
  company?: string | null;
  location?: string | null;
  jobUrl?: string | null;
  jobDescription?: string | null;
  source?: string | null;
};

export type ApplicationRow = ApplicationKit & {
  id: string;
  job_title: string;
  company: string | null;
  location: string | null;
  job_url: string | null;
  status: string;
  applied_at: string | null;
  created_at: string;
};

const SYSTEM_PROMPT = `You prepare job-application material for Krishna Amarneni. You are given his master resume and a target job. Produce material he can review and submit himself.

HARD RULES — these protect him:
- NEVER invent experience, employers, dates, degrees, certifications or metrics. Only reframe what is genuinely in the resume.
- If the job requires something he does NOT have, do not fake it. Put it in "gaps" so he can prepare an honest answer.
- matchPct must be an honest 0-100 assessment, not flattery. A weak match should score low.
- No markdown, no bold, no asterisks anywhere in the output values.
- The cover note is SHORT (90-140 words), specific to this company and role, first person, no throat-clearing ("I am writing to express my interest"), no buzzwords ("passionate", "leverage", "dynamic").
- Screening answers must be usable verbatim in an ATS text box: 2-4 sentences, concrete, first person.

Output ONLY a JSON object, no fences:
{
  "matchPct": 0-100,
  "resumeSummary": "3-4 sentence summary rewritten for THIS role, using only real experience",
  "emphasizedBullets": ["the 5-7 existing resume bullets most relevant to this job, rewritten to foreground the JD's keywords - still factually true"],
  "coverNote": "...",
  "screeningAnswers": [{"question": "Why are you interested in this role?", "answer": "..."}],
  "keywords": ["exact terms from the JD worth mirroring in the resume"],
  "gaps": ["honest requirement he does not meet, and how to address it in an interview"]
}

Always include screening answers for these common ATS questions, plus any question the JD itself implies:
- "Why are you interested in this role?"
- "Why do you want to work at <company>?"
- "Describe your relevant experience for this position."
- "What is your salary expectation?" (answer should defer to a range conversation, not name a number)
- "Are you legally authorized to work in the US / do you require sponsorship?" (answer neutrally and factually; do NOT assert a status that is not in the resume - phrase it so Krishna can confirm)`;

/** Generate the kit for a single job. Pure — does not persist. */
export async function buildApplicationKit(job: JobInput): Promise<
  { ok: true; kit: ApplicationKit } | { ok: false; error: string }
> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: "GROQ_API_KEY is not set" };
  if (!job.jobTitle?.trim()) return { ok: false, error: "jobTitle is required" };

  const userPrompt = `TARGET JOB
Title: ${job.jobTitle}
Company: ${job.company || "Not specified"}
Location: ${job.location || "Not specified"}
Link: ${job.jobUrl || "n/a"}

JOB DESCRIPTION / POSTING TEXT:
${(job.jobDescription || "").slice(0, 6000) || "(No description captured — infer typical requirements for this title, and note in gaps that the description was unavailable.)"}

KRISHNA'S MASTER RESUME:
${MASTER_RESUME}

Prepare the application material now.`;

  const result = await runAgent({
    apiKey,
    model: resolveModel("writing"),
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2600,
  });

  if (!result.ok || !result.content) {
    return { ok: false, error: result.error || "Model call failed" };
  }

  try {
    const cleaned = result.content.replace(/```json\s*|\s*```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(
      start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
    ) as Partial<ApplicationKit>;

    return {
      ok: true,
      kit: {
        matchPct: Math.max(0, Math.min(100, Number(parsed.matchPct) || 0)),
        resumeSummary: String(parsed.resumeSummary || ""),
        emphasizedBullets: Array.isArray(parsed.emphasizedBullets)
          ? parsed.emphasizedBullets.map(String)
          : [],
        coverNote: String(parsed.coverNote || ""),
        screeningAnswers: Array.isArray(parsed.screeningAnswers)
          ? parsed.screeningAnswers
              .filter((a) => a && a.question)
              .map((a) => ({ question: String(a.question), answer: String(a.answer ?? "") }))
          : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
      },
    };
  } catch {
    return { ok: false, error: "The model returned an unparseable kit — try again." };
  }
}

/** Generate + persist. Returns the saved row id. */
export async function prepareApplication(job: JobInput): Promise<
  { ok: true; id: string; kit: ApplicationKit } | { ok: false; error: string }
> {
  const built = await buildApplicationKit(job);
  if (!built.ok) return built;

  const db = requireSupabaseAdmin();
  const payload = {
    job_title: job.jobTitle,
    company: job.company ?? null,
    location: job.location ?? null,
    job_url: job.jobUrl ?? null,
    job_description: job.jobDescription ?? null,
    source: job.source ?? "manual",
    match_pct: built.kit.matchPct,
    tailored_resume: {
      summary: built.kit.resumeSummary,
      emphasizedBullets: built.kit.emphasizedBullets,
    },
    cover_note: built.kit.coverNote,
    screening_answers: built.kit.screeningAnswers,
    keywords: built.kit.keywords,
    gaps: built.kit.gaps,
    updated_at: new Date().toISOString(),
  };

  const missingTable = (msg?: string) =>
    /does not exist|schema cache|relation/i.test(msg ?? "");

  // Explicit lookup rather than upsert: the dedupe index is a FUNCTIONAL index
  // (lower(...)), which PostgREST's on_conflict cannot target.
  const { data: existing, error: findErr } = await db
    .from("job_applications")
    .select("id")
    .ilike("job_title", job.jobTitle)
    .ilike("company", job.company ?? "")
    .maybeSingle();

  if (findErr && missingTable(findErr.message)) {
    return {
      ok: false,
      error: "Run supabase/application_kit.sql in Supabase to enable the application kit.",
    };
  }

  if (existing?.id) {
    const { error } = await db.from("job_applications").update(payload).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: String(existing.id), kit: built.kit };
  }

  const { data, error } = await db
    .from("job_applications")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: missingTable(error.message)
        ? "Run supabase/application_kit.sql in Supabase to enable the application kit."
        : error.message,
    };
  }

  return { ok: true, id: String(data?.id ?? ""), kit: built.kit };
}
