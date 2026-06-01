import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  text: string;
  instruction: string; // "elaborate", "friendly", "professional", "shorter", "fix grammar", or custom
  context?: string; // optional: recruiter name, role, etc.
};

const TONE_PROMPTS: Record<string, string> = {
  elaborate: "Expand the email with more detail about Krishna's relevant experience. Add 1-2 more sentences. Keep it natural.",
  friendly: "Rewrite in a warm, friendly tone. Like texting a colleague you respect. Keep the same content but make it approachable.",
  professional: "Rewrite in a polished, formal professional tone. No slang, clear and direct.",
  shorter: "Make it shorter. Cut to 1-2 sentences max. Keep only the essential point + call to action.",
  grammar: "Fix any grammar, spelling, or punctuation issues. Don't change the tone or content.",
  confident: "Rewrite with more confidence. Remove hedging words (maybe, might, could). Be assertive about skills and availability.",
  casual: "Rewrite in a very casual tone. Like a quick DM. Short sentences, no formalities.",
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

  const instruction = TONE_PROMPTS[body.instruction] || body.instruction;

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You rewrite emails. Output ONLY the rewritten email body — no greetings (Hi/Dear), no signature, no subject line, no explanations. Just the body text.

INSTRUCTION: ${instruction}
${body.context ? `CONTEXT: ${body.context}` : ""}

BANNED phrases: "excited about the opportunity", "leverage my expertise", "I am confident", "I believe my skills"`,
    userPrompt: body.text,
    maxTokens: 400,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Clean up — remove any greeting/signature the LLM might have added.
  let rewritten = (result.content || body.text)
    .replace(/^(Hi|Hello|Dear|Hey)\s+[^,\n]*[,\n]\s*/i, "")
    .replace(/\n*(Best|Regards|Thanks|Cheers|Sincerely)[^\n]*/gi, "")
    .replace(/\n*Krishna\s*Amarneni\s*$/i, "")
    .trim();

  return NextResponse.json({ rewritten });
}
