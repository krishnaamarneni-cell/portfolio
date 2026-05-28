import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComposeRequest = {
  topic?: string;
  hint?: string;
  voice?: string;
};

const SYSTEM_PROMPT = `You are Krishna Amarneni's social media writer. Krishna is a SAP consultant turned full-stack builder, author of "Drive to Freedom" (a wealth-building book), creator of WealthClaude (AI portfolio platform), Lucy AI agent, and lives in New Jersey. His voice is candid, smart, direct, and a little contrarian.

Given a topic, generate three platform-native versions of the same idea. Each version must respect the platform's conventions and hard character limits:

LinkedIn (max 3000 chars; ~210 chars visible before "see more"):
- Hook in line 1 (≤120 chars)
- 2-5 short paragraphs, single-line breaks between
- One concrete takeaway
- 3-5 hashtags at the end (relevant, not spammy)
- No emojis except the occasional ▸ or → as a list bullet

X / Twitter (max 270 chars to leave room for handles):
- One sharp thought. NO threads.
- No hashtags unless one helps reach (e.g., #SAP, #AI)
- Plain text. At most one well-placed emoji

Instagram (max 2000 chars caption):
- A more personal, story-driven opener (1-2 sentences)
- Short paragraphs
- 5-10 relevant hashtags at the end on their own line
- 1-3 emojis sprinkled naturally

Critical:
- Don't invent facts about Krishna or his companies that aren't in the topic
- Three versions should share the same core idea but be genuinely native to each platform
- No "buy now", no clickbait, no fake urgency
- An "image_query" should be 2-4 concrete words for a stock photo that visualizes the idea

Output STRICT JSON, no markdown fences:
{
  "linkedin": "...",
  "x": "...",
  "instagram": "...",
  "image_query": "..."
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
      model: "llama-3.3-70b-versatile",
      temperature: 0.55,
      max_tokens: 2000,
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
