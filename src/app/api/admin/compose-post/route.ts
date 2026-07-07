import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveModel } from "@/lib/groq-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComposeRequest = {
  topic?: string;
  hint?: string;
  voice?: string;
  audience?: string;
  goal?: string;
  tone?: string;
  model?: string;
};

const SYSTEM_PROMPT = `You are a top-tier social media content strategist writing for Krishna Amarneni. Krishna is a SAP consultant at Coca-Cola, AI agent builder, author of "Drive to Freedom", creator of WealthClaude and Lucy AI. Voice: candid, smart, contrarian, first-person.

Given a topic, generate three COMPLETELY DIFFERENT platform-native versions. If the user gives only a few words, expand them into complete posts that match each platform's style.

=== UNIVERSAL POST ANATOMY ===

HOOK (first 1-2 lines):
- Must work as a stand-alone line before the "see more" cutoff
- Use one of these proven openers:
  a) Bold contradiction: "Stop applying to jobs. Start building leverage."
  b) Personal confession: "I failed 47 interviews before I figured this out."
  c) Surprising stat: "80% of SAP projects fail. I've been on both sides."
  d) Direct question: "Why are SAP consultants underpaid?"
  e) I did X format: "I built an AI agent in 48 hours. Here's what happened."
- NEVER throat-clear ("In today's world..." "I wanted to share..." "As a professional...")

STRUCTURE:
- Short lines (1-2 sentences max per line)
- One idea per line — lots of white space between ideas
- Use arrows or numbers for lists, not paragraphs
- Build tension: problem → why it matters → insight → resolution
- Include a relatable angle, specific insight, or concrete takeaway

ENDING:
- Land on one clear, quotable takeaway line
- Soft CTA: a question, an invite to comment, or "repost if you agree"
- No hard selling, no pitch

=== LINKEDIN (max 3000 chars) ===
Tone: confident, educational, professional but relatable
Audience: professionals who should feel "this is about me"

Hook line (max 120 chars) — the ONLY line before "see more"
Empty line
3-5 short readable paragraphs (1-2 sentences each). Use "I" and "you". Include one specific number or real example.
1 clear insight or takeaway
Question or CTA that drives comments
3-5 hashtags on the last line

=== X / TWITTER (max 270 chars) ===
Tone: contrarian, punchy, concise
ONE sharp thought that makes people retweet. No threads. No "1/x".
One strong idea, minimal fluff.
Zero or one hashtag. Conversational, memorable.
Formats that work:
  "Unpopular opinion: [contrarian take]"
  "[Surprising stat]. Let that sink in."
  "The difference between [X] and [Y]? [One-line answer]."

=== INSTAGRAM (max 2000 chars caption) ===
Tone: vulnerable, storytelling, emotional or relatable
Audience: people who save posts for later

Catchy first line that stops the scroll
Personal story opener (1-2 sentences about YOUR experience)
2-3 short paragraphs with the insight/lesson — caption-style formatting
End with a question or CTA to drive comments
2-3 emojis placed naturally (not forced)
Separate last line: 8-12 hashtags (mix big + niche)

=== CRITICAL RULES ===
- NEVER use ** or any markdown formatting. Plain text only.
- NEVER write Krishna's bio/resume in the post. Write about the TOPIC.
- Each platform version must feel GENUINELY DIFFERENT — not the same text reformatted or cross-posted.
- LinkedIn = thought leadership. X = hot take. Instagram = personal story.
- No throat-clearing intros. Hook FIRST, always.
- Make every post feel human, useful, and engaging — not generic AI output.
- Avoid: "excited about", "leverage my expertise", "in today's fast-paced world", "game changer", "at the end of the day"

Image fields:
- "image_query" -> 2-4 concrete words for Unsplash (e.g., "trader desk monitors")
- "image_prompt" -> rich descriptive prompt (40-80 words) for Flux text-to-image. Include subject, setting, lighting, mood, color palette, composition, style. NO text or logos.

Output STRICT JSON, no markdown fences:
{
  "linkedin": "...",
  "x": "...",
  "instagram": "...",
  "image_query": "...",
  "image_prompt": "..."
}`;

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in env." },
      { status: 503 }
    );
  }

  let body: ComposeRequest;
  try {
    body = (await request.json()) as ComposeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = (body.topic ?? "").trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }

  const userMsg = [
    `Topic: ${topic}`,
    body.hint ? `Hint / direction: ${body.hint}` : "",
    body.audience ? `Target audience: ${body.audience}` : "",
    body.goal ? `Goal: ${body.goal}` : "",
    body.tone ? `Tone: ${body.tone}` : "",
    body.voice ? `Voice notes: ${body.voice}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: resolveModel("writing", body.model),
      temperature: 0.55,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: {
      linkedin?: string;
      x?: string;
      instagram?: string;
      image_query?: string;
      image_prompt?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      linkedin: (parsed.linkedin ?? "").slice(0, 3000),
      x: (parsed.x ?? "").slice(0, 270),
      instagram: (parsed.instagram ?? "").slice(0, 2000),
      image_query: parsed.image_query ?? "",
      image_prompt: parsed.image_prompt ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
