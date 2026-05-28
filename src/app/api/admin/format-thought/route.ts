import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FormatRequest = { raw?: string; hint?: string };
type FormatResponse = {
  title: string;
  body: string;
  tags: string[];
};

const SYSTEM_PROMPT = `You are a thoughtful editor helping a builder shape raw, stream-of-consciousness thoughts into clear, publishable short posts. The voice is candid, smart, and direct — like an honest founder/operator writing in their own words. NEVER add new facts, claims, or experiences that aren't in the source. Just tighten the language, fix grammar, sharpen the structure, and preserve the author's voice.

Return STRICT JSON with this exact shape, no markdown fences:
{
  "title": "A short, specific title (max 60 characters) — not a headline, not clickbait, just a concise label",
  "body": "The cleaned-up post body in plain text. Preserve line breaks between paragraphs as \\n\\n. Keep it close to the original length unless the original is very rambling.",
  "tags": ["2-4 lowercase single-word or short-phrase tags relevant to the content"]
}`;

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GROQ_API_KEY is not set in .env.local. Get one at https://console.groq.com/keys, add it, then restart npm run dev.",
      },
      { status: 503 }
    );
  }

  let body: FormatRequest;
  try {
    body = (await request.json()) as FormatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body.raw ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "Empty input" }, { status: 400 });
  }

  const userMessage = body.hint
    ? `Hint from the author: ${body.hint}\n\n---\n\nRaw thought:\n${raw}`
    : `Raw thought:\n${raw}`;

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    let parsed: FormatResponse;
    try {
      parsed = JSON.parse(text) as FormatResponse;
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON output. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      title: String(parsed.title ?? "").slice(0, 80),
      body: String(parsed.body ?? ""),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).toLowerCase()).slice(0, 5)
        : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
