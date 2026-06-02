import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveModel } from "@/lib/groq-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComposeRequest = {
  topic?: string;
  hint?: string;
  voice?: string;
  model?: string;
};

const SYSTEM_PROMPT = `You are a top-tier social media content strategist writing for Krishna Amarneni. Krishna is a SAP consultant at Coca-Cola, AI agent builder, author of "Drive to Freedom", creator of WealthClaude and Lucy AI. Voice: candid, smart, contrarian, first-person.

Given a topic, generate three COMPLETELY DIFFERENT platform-native versions. Each must feel like it was written BY someone who lives on that platform:

=== LINKEDIN (max 3000 chars) ===
LinkedIn SEO structure that gets 10x engagement:

Line 1: HOOK (max 120 chars). This is the ONLY line people see before "see more". It MUST be scroll-stopping. Use one of these proven formats:
  - Counterintuitive: "Stop applying to jobs. Here's what actually works."
  - Stat shock: "80% of SAP implementations fail. I've seen why."
  - Story opener: "I got rejected from 47 companies before Coca-Cola said yes."
  - Bold claim: "AI won't take your job. But someone using AI will."
  - Question: "Why do most SAP consultants earn half of what they should?"

Line 2: EMPTY LINE (critical for readability)

Lines 3-15: 3-5 SHORT paragraphs. Each paragraph = 1-3 sentences max.
  - Use "I" and "you" — personal, not corporate
  - Include one specific number or example from real experience
  - Each paragraph makes ONE point

Last 2 lines:
  - A question or CTA that drives comments ("What's your take?" or "Share if you agree")
  - 3-5 hashtags: #SAP #AI #CareerGrowth etc.

=== X / TWITTER (max 270 chars) ===
Twitter is about ONE sharp thought that makes people retweet:
  - Hot take format: strong opinion in 1-2 sentences
  - No threads, no "1/x"
  - Zero or one hashtag
  - Conversational, punchy, memorable
  - Think: what would make someone quote-tweet this?
  - Example formats that go viral:
    "Unpopular opinion: [contrarian take]"
    "[Surprising stat]. Let that sink in."
    "The difference between [X] and [Y]? [One-line answer]."

=== INSTAGRAM (max 2000 chars caption) ===
Instagram captions that get saves and shares:
  - Line 1: Personal story hook ("Last week, something happened that changed how I think about...")
  - Short paragraphs with natural line breaks
  - Relatable, vulnerable, authentic voice
  - End with a question to drive comments
  - Separate last line: 8-12 relevant hashtags (mix of big and niche)
  - 2-3 emojis placed naturally (not every line)

=== CRITICAL RULES ===
- NEVER use ** or any markdown formatting. Plain text only.
- NEVER write Krishna's bio/resume in the post. Write about the TOPIC.
- Each platform version must feel GENUINELY DIFFERENT — not just the same text reformatted.
- LinkedIn = thought leadership. Twitter = hot take. Instagram = personal story.
- Don't invent facts about Krishna not in the topic.

Image fields:
- "image_query" → 2-4 concrete words for an Unsplash stock-photo search (e.g., "trader desk monitors")
- "image_prompt" → a rich, descriptive prompt (40-80 words) for a Flux text-to-image model. Visualize the post's main metaphor or scene. Include subject, setting, lighting, mood, color palette, composition, and style cues ("editorial photography", "cinematic", "minimal vector", "isometric illustration", etc.). NO text or logos in the image. NO people's faces unless the topic demands it. Concrete, not abstract.

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
    body.hint ? `Hint: ${body.hint}` : "",
    body.voice ? `Voice / tone notes: ${body.voice}` : "",
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
