import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IMAGE_SYSTEM_PROMPT, extractPostJson } from "@/lib/social-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { imageUrl?: string; hint?: string; tone?: string };

// Vision-capable Groq model. Llama 4 Scout is multimodal and accepts image_url
// content parts.
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = (body.imageUrl ?? "").trim();
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      { error: "A public image URL is required. Generate or upload an image first." },
      { status: 400 }
    );
  }

  const directions = [
    body.hint ? `Direction: ${body.hint}` : "",
    body.tone ? `Tone: ${body.tone}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const userText = [
    "Write the three platform posts inspired by this image. Return the strict JSON only.",
    directions,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });

    const messages = [
      { role: "system" as const, content: IMAGE_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageUrl } },
        ] as unknown as string,
      },
    ];
    const run = (json: boolean) =>
      groq.chat.completions.create({
        model: VISION_MODEL,
        temperature: 0.6,
        max_tokens: 4096,
        ...(json ? { response_format: { type: "json_object" as const } } : {}),
        messages,
      });

    let raw = "";
    try {
      const completion = await run(true);
      raw = completion.choices[0]?.message?.content ?? "";
    } catch {
      const completion = await run(false);
      raw = completion.choices[0]?.message?.content ?? "";
    }

    const parsed = extractPostJson(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Couldn't turn that image into posts. Try again or use a different image." },
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
    const message = err instanceof Error ? err.message : "Groq vision request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
