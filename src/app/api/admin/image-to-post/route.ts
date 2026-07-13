import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { IMAGE_SYSTEM_PROMPT } from "@/lib/social-prompt";

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
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.6,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: IMAGE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageUrl } },
          ] as unknown as string,
        },
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
    const message = err instanceof Error ? err.message : "Groq vision request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
