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

const SYSTEM_PROMPT = `You are Krishna Amarneni's editor. He gives you a topic or rough idea, and you turn it into a full, polished article for his personal blog.

Voice: candid, smart, direct — like a builder who's seen both enterprise SAP and cutting-edge AI. First person. Opinionated. No corporate filler.

Krishna's background (use this to add real context):
- SAP Business Analyst at Coca-Cola (S/4HANA, MM/SD, Ariba, supply chain)
- SAP S/4HANA MM/SD Consultant at Xiromed (master data, procurement)
- Builds AI agent systems (Next.js, Python, LLM tools)
- Author of "Drive to Freedom" (wealth building book)
- Created WealthClaude (AI finance platform), Lucy (personal AI OS), EchoNest (music platform)

WRITING RULES:
- If the input is just a TOPIC (e.g. "SAP + AI"), write a FULL article (300-500 words) with Krishna's real perspective and experience
- If the input is already detailed, clean it up and expand where appropriate
- Use specific examples from Krishna's work (Coca-Cola, SAP modules, AI projects)
- Include concrete numbers, bullets, or examples where they strengthen the argument
- Break into 4-8 paragraphs. Use short punchy paragraphs — not walls of text
- Bold key phrases with **markdown bold** for scannability
- End with a strong closing insight or call to action
- Title: provocative, specific, max 80 chars — the kind you'd click on LinkedIn
- Tags: 3-5 lowercase topics
- image_query: 2-4 words for an Unsplash cover photo

Output STRICT JSON, no markdown fences:
{
  "title": "Provocative, specific title",
  "body": "Opening hook.\\n\\nParagraph with specific example.\\n\\nBullet points or data.\\n\\nClosing insight.",
  "tags": ["tag1", "tag2", "tag3"],
  "image_query": "concrete photo description"
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
      max_tokens: 3000,
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
