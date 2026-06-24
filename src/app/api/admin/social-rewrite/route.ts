import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  text: string;
  instruction: string;
  platform: string; // "LinkedIn", "X", "Instagram"
};

const PLATFORM_RULES: Record<string, string> = {
  LinkedIn: `LinkedIn rewrite rules:

HOOK (first 1-2 lines, max 120 chars):
- Must work as a stand-alone line before "see more" cutoff
- Use one of: bold contradiction, personal confession, surprising stat, direct question, or "I did X. Here's what happened."
- NEVER throat-clear ("In today's world..." "I wanted to share...")

STRUCTURE:
- Short lines (1-2 sentences max per line)
- One idea per line — lots of white space
- Use arrows or numbers for lists, not paragraphs
- Build tension: problem -> why it matters -> insight -> resolution

ENDING:
- One clear, quotable takeaway line
- Soft CTA: question, invite to comment, or "repost if you agree"
- 3-5 hashtags on last line
- Character limit: 3000

TONE: confident or educational
AUDIENCE: professionals who should feel "this is about me"`,

  X: `Twitter/X rewrite rules:

ONE sharp thought (max 270 chars). No threads. No "1/x".

HOOK formats that work:
- Bold contradiction: "Stop doing X. Start doing Y."
- Surprising stat: "[number]. Let that sink in."
- Contrarian: "Unpopular opinion: [take]"

Zero or one hashtag. Conversational, punchy, memorable.
TONE: contrarian or punchy`,

  Instagram: `Instagram caption rewrite rules:

HOOK (first 1-2 lines):
- Personal story opener or vulnerable confession
- Must hook before the "more" cutoff

STRUCTURE:
- Short lines, one idea per line, white space between
- Build tension: what happened -> the lesson -> the takeaway

ENDING:
- Quotable takeaway line
- Question to drive comments
- 8-12 hashtags on separate last line (mix big + niche)
- 2-3 emojis placed naturally
- Character limit: 2000

TONE: vulnerable or storytelling
AUDIENCE: people who save posts for later`,
};

const TONE_PROMPTS: Record<string, string> = {
  elaborate: "Expand with more detail, examples, or data points. Add 2-3 more sentences. Keep the platform format.",
  shorter: "Cut to the essentials. Remove filler. Keep the hook and one key point.",
  friendly: "Warmer, more conversational tone. Like talking to a friend at coffee.",
  professional: "More polished and authoritative. CEO-on-stage energy.",
  confident: "Remove hedging. Be assertive. State opinions as facts.",
  casual: "Very casual. Short sentences. Like a quick DM.",
  grammar: "Fix grammar and punctuation only. Don't change tone or content.",
  hookline: "Rewrite the FIRST LINE to be a stronger hook. Bold claim, stat, or question that stops the scroll.",
  storytelling: "Rewrite as a personal story. Start with 'I was...' or 'Last week...' or 'When I was at...'",
  controversial: "Make it more contrarian/provocative. Challenge the common wisdom. Start with 'Unpopular opinion:' or 'Everyone says X, but...'",
  datadriven: "Add specific numbers, percentages, or data points from Krishna's experience. Make claims concrete.",
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

  const platform = body.platform || "LinkedIn";
  const platformRules = PLATFORM_RULES[platform] || PLATFORM_RULES.LinkedIn;
  const instruction = TONE_PROMPTS[body.instruction] || body.instruction;

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You are a social media content manager for Krishna Amarneni. You rewrite posts to perform better on ${platform}.

Krishna's background: SAP Business Analyst at Coca-Cola, SAP S/4HANA MM/SD Consultant at Xiromed, AI agent builder (Next.js, Python), author of "Drive to Freedom", creator of WealthClaude and Lucy AI.

${platformRules}

INSTRUCTION: ${instruction}

CRITICAL RULES:
- Output ONLY the rewritten post text. No explanations, no "here's the rewritten version", no quotes around it.
- NEVER use ** bold markdown or asterisks. Plain text only.
- NEVER write Krishna's bio or resume. You're rewriting the POST CONTENT, not introducing Krishna.
- Keep the original topic/message. Just make it better for ${platform}.
- The post should be ABOUT the topic, not about Krishna's qualifications.`,
    userPrompt: body.text,
    maxTokens: 800,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  let rewritten = (result.content || body.text)
    .replace(/^(Here'?s?|Below is|I'?ve rewritten)[^\n]*\n*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  return NextResponse.json({ rewritten });
}
