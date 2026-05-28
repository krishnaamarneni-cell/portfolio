import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Provider = "fal" | "unsplash" | "auto";

type Body = {
  prompt?: string;
  provider?: Provider;
  /** Square images for IG, landscape for X/LinkedIn. */
  aspect?: "square" | "landscape";
};

type Result = {
  url: string;
  provider: Provider;
  credit?: string | null;
};

async function tryFal(prompt: string, aspect: "square" | "landscape"): Promise<Result | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  const image_size = aspect === "square" ? "square_hd" : "landscape_16_9";
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
    const data = (await r.json()) as {
      images?: Array<{ url?: string }>;
    };
    const url = data.images?.[0]?.url;
    return url
      ? { url, provider: "fal", credit: "Generated with fal.ai / Flux" }
      : null;
  } catch (err) {
    console.warn("[generate-image] fal error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function tryUnsplash(prompt: string, aspect: "square" | "landscape"): Promise<Result | null> {
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

  let result: Result | null = null;
  if (provider === "fal" || provider === "auto") {
    result = await tryFal(prompt, aspect);
  }
  if (!result && (provider === "unsplash" || provider === "auto")) {
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
