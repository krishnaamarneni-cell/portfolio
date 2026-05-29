import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Provider = "fal" | "unsplash" | "auto";

type Body = {
  prompt?: string;
  provider?: Provider;
  aspect?: "square" | "landscape";
  /** 1-3 image URLs the generator should use as a style/composition reference.
   *  When present + provider == fal, we route to Flux Redux so the output
   *  resembles them instead of relying on prompt alone. */
  referenceUrls?: string[];
};

type Result = {
  url: string;
  provider: Provider;
  credit?: string | null;
  /** Lets the UI surface which model variant ran. */
  model?: string;
};

async function tryFal(
  prompt: string,
  aspect: "square" | "landscape",
  referenceUrls: string[]
): Promise<Result | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  const image_size = aspect === "square" ? "square_hd" : "landscape_16_9";

  // ── Reference path: Flux Redux uses an example image as style guide ──
  if (referenceUrls.length > 0) {
    try {
      const r = await fetch("https://fal.run/fal-ai/flux/dev/redux", {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: referenceUrls[0], // primary reference
          // Up to 3 additional references blend the style further.
          additional_image_urls: referenceUrls.slice(1, 3),
          prompt,
          image_size,
          num_inference_steps: 28,
          num_images: 1,
          enable_safety_checker: true,
          guidance_scale: 3.5,
        }),
        cache: "no-store",
      });
      if (r.ok) {
        const data = (await r.json()) as { images?: Array<{ url?: string }> };
        const url = data.images?.[0]?.url;
        if (url) {
          return {
            url,
            provider: "fal",
            credit: "Generated with fal.ai / Flux Redux (reference-guided)",
            model: "fal-ai/flux/dev/redux",
          };
        }
      } else {
        console.warn("[generate-image] flux-redux returned", r.status);
      }
    } catch (err) {
      console.warn(
        "[generate-image] flux-redux error:",
        err instanceof Error ? err.message : err
      );
    }
    // Fall through to schnell if redux failed.
  }

  // ── No-reference path: cheap/fast Flux Schnell ──
  try {
    const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size,
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      console.warn("[generate-image] fal returned", r.status);
      return null;
    }
    const data = (await r.json()) as { images?: Array<{ url?: string }> };
    const url = data.images?.[0]?.url;
    return url
      ? {
          url,
          provider: "fal",
          credit: "Generated with fal.ai / Flux Schnell",
          model: "fal-ai/flux/schnell",
        }
      : null;
  } catch (err) {
    console.warn("[generate-image] fal error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function tryUnsplash(
  prompt: string,
  aspect: "square" | "landscape"
): Promise<Result | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const orientation = aspect === "square" ? "squarish" : "landscape";
  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?per_page=1&orientation=${orientation}&query=${encodeURIComponent(prompt)}`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        cache: "no-store",
      }
    );
    if (!r.ok) return null;
    const data = (await r.json()) as {
      results?: Array<{
        urls?: { regular?: string };
        user?: { name?: string };
      }>;
    };
    const first = data.results?.[0];
    if (!first?.urls?.regular) return null;
    return {
      url: first.urls.regular,
      provider: "unsplash",
      credit: `Photo by ${first.user?.name ?? "Unsplash"} on Unsplash`,
      model: "unsplash/search",
    };
  } catch (err) {
    console.warn(
      "[generate-image] unsplash error:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  const aspect = body.aspect === "square" ? "square" : "landscape";
  const provider: Provider = body.provider ?? "auto";
  const referenceUrls = (body.referenceUrls ?? [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, 3);

  let result: Result | null = null;
  if (provider === "fal" || provider === "auto") {
    result = await tryFal(prompt, aspect, referenceUrls);
  }
  if (!result && (provider === "unsplash" || provider === "auto")) {
    // Unsplash can't use references — degrade to plain query.
    result = await tryUnsplash(prompt, aspect);
  }

  if (!result) {
    return NextResponse.json(
      {
        error:
          "No image generator available. Set FAL_KEY for AI generation or UNSPLASH_ACCESS_KEY for stock-photo search.",
      },
      { status: 503 }
    );
  }
  return NextResponse.json(result);
}
