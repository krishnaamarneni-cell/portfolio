/**
 * Shared image -> per-platform posts generator (Groq vision).
 *
 * Used by /api/admin/image-to-post (interactive "Post from image") AND by the
 * daily auto-drip cron, so the two can never drift.
 */
import { IMAGE_SYSTEM_PROMPT, extractPostJson, type PostJson } from "@/lib/social-prompt";

// Vision-capable Groq model. Llama 4 Scout is multimodal and accepts image_url
// content parts.
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export type GenerateResult =
  | { ok: true; posts: Required<PostJson> }
  | { ok: false; error: string };

export async function generatePostsFromImage(
  imageUrl: string,
  opts?: { hint?: string; tone?: string }
): Promise<GenerateResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: "GROQ_API_KEY is not set" };
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return { ok: false, error: "A public image URL is required" };
  }

  const directions = [
    opts?.hint ? `Direction: ${opts.hint}` : "",
    opts?.tone ? `Tone: ${opts.tone}` : "",
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
      raw = (await run(true)).choices[0]?.message?.content ?? "";
    } catch {
      raw = (await run(false)).choices[0]?.message?.content ?? "";
    }

    const parsed = extractPostJson(raw);
    if (!parsed) return { ok: false, error: "Model did not return usable posts" };

    return {
      ok: true,
      posts: {
        linkedin: (parsed.linkedin ?? "").slice(0, 3000),
        x: (parsed.x ?? "").slice(0, 270),
        instagram: (parsed.instagram ?? "").slice(0, 2000),
        image_query: parsed.image_query ?? "",
        image_prompt: parsed.image_prompt ?? "",
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Groq vision request failed",
    };
  }
}
