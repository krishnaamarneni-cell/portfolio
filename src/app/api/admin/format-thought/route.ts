import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveModel } from "@/lib/groq-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FormatRequest = { raw?: string; hint?: string; skipImage?: boolean; model?: string };

type FormatResponse = {
  title: string;
  body: string;
  tags: string[];
  cover_image_url?: string | null;
  cover_image_credit?: string | null;
  image_query?: string;
};

const SYSTEM_PROMPT = `You are a thoughtful editor helping a builder shape raw, stream-of-consciousness notes into clear, publishable short posts for a personal blog.

Voice: candid, smart, direct — like an honest founder/operator writing in their own words. First person. No filler, no clichés.

Critical rules:
- NEVER add new facts, claims, statistics, names, or experiences that aren't in the source.
- Preserve the author's voice and core points.
- Fix grammar, tighten sentences, and break the body into 2-4 paragraphs.
- Keep it short — most notes should be 100-250 words. Don't pad.
- Title is a short, specific noun phrase (max 60 chars) — never a question, never clickbait.
- Tags: 2-4 lowercase single-word topics (e.g. "ai", "macro", "wages"). No "#".
- image_query: 2-4 words describing a photo that would suit this note. Concrete subjects (e.g. "highway sunset", "stock market trader", "empty office") work best. Avoid abstract concepts.

Output STRICT JSON, no markdown fences:
{
  "title": "Short, specific title",
  "body": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3.",
  "tags": ["tag1", "tag2"],
  "image_query": "2-4 concrete words for an Unsplash photo"
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
          "GROQ_API_KEY is not set. Get one at https://console.groq.com/keys, add it to .env.local (and Vercel env), then retry.",
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
    ? `Hint from the author: ${body.hint}\n\n---\n\nRaw note:\n${raw}`
    : `Raw note:\n${raw}`;

  // Call Groq
  let parsed: FormatResponse;
  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: resolveModel("writing", body.model),
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    try {
      parsed = JSON.parse(text) as FormatResponse;
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON. Try again." },
        { status: 502 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Optionally fetch a matching Unsplash photo
  let cover_image_url: string | null = null;
  let cover_image_credit: string | null = null;
  if (!body.skipImage) {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const query = (parsed.image_query || parsed.title || "").trim();
    if (unsplashKey && query) {
      try {
        const r = await fetch(
          `https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&query=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Client-ID ${unsplashKey}` },
            cache: "no-store",
          }
        );
        if (r.ok) {
          const data = (await r.json()) as {
            results?: Array<{
              urls?: { regular?: string };
              user?: { name?: string; links?: { html?: string } };
              links?: { html?: string };
            }>;
          };
          const first = data.results?.[0];
          if (first?.urls?.regular) {
            cover_image_url = first.urls.regular;
            const author = first.user?.name ?? "Unsplash";
            cover_image_credit = `Photo by ${author} on Unsplash`;
          }
        } else {
          console.warn("[format-thought] Unsplash returned", r.status);
        }
      } catch (err) {
        console.warn(
          "[format-thought] Unsplash error:",
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  return NextResponse.json({
    title: String(parsed.title ?? "").slice(0, 80),
    body: String(parsed.body ?? ""),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).toLowerCase()).slice(0, 5)
      : [],
    image_query: parsed.image_query ?? "",
    cover_image_url,
    cover_image_credit,
  });
}
