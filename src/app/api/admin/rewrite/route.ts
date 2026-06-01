import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/lib/agents";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";
import { buildLearningContext } from "@/lib/email-learning";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  text: string;
  instruction: string;
  context?: string;
};

const TONE_PROMPTS: Record<string, string> = {
  elaborate: "Add 1-2 more sentences citing SPECIFIC experience from Krishna's resume below. Name a real client, project, or skill.",
  friendly: "Rewrite in a warm, friendly tone. Like texting a colleague you respect.",
  professional: "Rewrite in a polished, formal professional tone. Clear and direct.",
  shorter: "Cut to 1-2 sentences max. Keep only the essential point + call to action. Use REAL experience from resume.",
  grammar: "Fix grammar, spelling, punctuation. Don't change content or tone.",
  confident: "Remove hedging (maybe, might, could). Be assertive. Cite specific achievements.",
  casual: "Rewrite as a quick casual DM. Short sentences, no formalities.",
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
  if (!body.text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  // Pull Krishna's REAL resume + facts so the AI doesn't invent experience.
  const [jobs, site, factsBlock, learningCtx] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
    buildFactsContext().catch(() => ""),
    buildLearningContext().catch(() => ""),
  ]);

  const experience = jobs
    .map((j) => `- ${j.title} @ ${j.company} (${j.period}, ${j.location})${j.description ? `: ${j.description}` : ""}`)
    .join("\n");
  const skills = (site.skills?.skills ?? []).slice(0, 25).join(", ");

  const instruction = TONE_PROMPTS[body.instruction] || body.instruction;

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You are rewriting an email that KRISHNA AMARNENI is sending. You are writing AS Krishna, in FIRST PERSON ("I have experience...", "my work at Coca-Cola...").

CRITICAL RULES:
- Write as "I" / "my" — this IS Krishna's email from his perspective
- NEVER write "Krishna has experience" or refer to Krishna in third person
- ONLY reference experience, skills, and companies from the REAL RESUME below
- NEVER invent experience Krishna doesn't have (no "10 years of Sigma" if it's not in his resume)
- Output ONLY the rewritten body — no greetings, no signature, no subject line
${factsBlock ? `\n${factsBlock}\n` : ""}
KRISHNA'S REAL RESUME (only cite from this):
${experience || "(no jobs on file)"}

Skills: ${skills || "(none)"}

INSTRUCTION: ${instruction}
${body.context ? `CONTEXT: ${body.context}` : ""}
${learningCtx}

BANNED: "excited about the opportunity", "leverage my expertise", "I am confident", "I believe my skills", any third-person reference to Krishna, any **bold** markdown or asterisks — write PLAIN TEXT only`,
    userPrompt: body.text,
    maxTokens: 400,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  let rewritten = (result.content || body.text)
    .replace(/^(Hi|Hello|Dear|Hey)\s+[^,\n]*[,\n]\s*/i, "")
    .replace(/\n*(Best|Regards|Thanks|Cheers|Sincerely)[^\n]*/gi, "")
    .replace(/\n*Krishna\s*Amarneni\s*$/i, "")
    .trim();

  return NextResponse.json({ rewritten });
}
