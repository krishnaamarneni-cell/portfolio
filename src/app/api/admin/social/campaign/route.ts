import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector, fetchSiteContent } from "@/lib/content";
import { createBufferPost } from "@/lib/buffer";
import { resolveModel } from "@/lib/groq-models";
import { buildFactsContext } from "@/lib/facts";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  type SearchResult,
} from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type PlatformKey = "linkedin" | "x" | "instagram";

const PLATFORM_LIMITS: Record<PlatformKey, number> = {
  linkedin: 3000,
  x: 270,
  instagram: 2000,
};

type Body = {
  topic: string;
  /** ISO datetimes to schedule each post at. Length = N posts. */
  dueAts: string[];
  platforms?: PlatformKey[]; // default: all 3
  profilesByPlatform?: Partial<Record<PlatformKey, string[]>>; // Buffer channel IDs
  referenceImageUrls?: string[]; // up to 3
  referencePosts?: string[]; // text of competitor posts the writer should learn from
  /** "auto" → fal redux when references, else schnell. */
  imageProvider?: "auto" | "fal" | "unsplash";
  model?: string;
  /** If false, returns drafts without scheduling — for review-then-go flow. */
  schedule?: boolean;
};

type CampaignPost = {
  date: string;
  perPlatform: Partial<Record<PlatformKey, string>>;
  imageQuery: string;
  imagePrompt: string;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = (body.topic ?? "").trim();
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });
  const dueAts = (body.dueAts ?? []).filter(
    (s) => typeof s === "string" && !Number.isNaN(new Date(s).getTime())
  );
  if (dueAts.length === 0) {
    return NextResponse.json({ error: "dueAts required (at least 1)" }, { status: 400 });
  }
  if (dueAts.length > 7) {
    return NextResponse.json({ error: "Max 7 posts per campaign" }, { status: 400 });
  }
  const platforms: PlatformKey[] =
    body.platforms && body.platforms.length > 0
      ? body.platforms
      : ["linkedin", "x", "instagram"];

  const referenceUrls = (body.referenceImageUrls ?? [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, 3);
  const referencePosts = (body.referencePosts ?? [])
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .slice(0, 6)
    .map((p) => p.trim());

  // ── Step 1: research the topic (if a search provider is configured) ──
  let researchResults: SearchResult[] = [];
  if (whichSearchProvider()) {
    const queries = [topic, `${topic} latest 2025`, `${topic} examples`];
    researchResults = await Promise.all(
      queries.map((q) =>
        search({ query: q, maxResults: 5 }).catch(
          () => ({ query: q, hits: [] }) as SearchResult
        )
      )
    );
  }
  const researchBlock = searchResultsToContext(researchResults);

  // ── Step 2: generate N distinct post sets via Groq ──
  const site = await fetchSiteContent();
  const about = `${site.about.paragraph_one}\n${site.about.paragraph_two}`;
  const factsBlock = await buildFactsContext();

  const system = `You are Krishna Amarneni's social-media writer planning a multi-post campaign.

# About Krishna
${about}
${factsBlock ? `\n${factsBlock}\n` : ""}
You will write ${dueAts.length} DISTINCT posts on the same overall topic — each from a different angle so they don't feel repetitive. Targeted platforms: ${platforms.join(", ")}.

For each post slot, output:
- ${platforms.includes("linkedin") ? "A LinkedIn version (max 3000 chars, hook on line 1, 3-5 short paragraphs, 3-5 hashtags)." : ""}
- ${platforms.includes("x") ? "An X version (max 270 chars, one sharp thought, no thread)." : ""}
- ${platforms.includes("instagram") ? "An Instagram version (max 2000 chars, story-driven opener, 5-10 hashtags, occasional emoji)." : ""}
- image_query: 2-4 concrete words for an Unsplash search.
- image_prompt: a 40-80 word descriptive Flux prompt visualizing the post's main metaphor.

${referencePosts.length > 0 ? `## Style references — emulate the voice/structure, not the exact words:\n${referencePosts.map((p, i) => `[${i + 1}] ${p}`).join("\n\n")}\n` : ""}
${researchBlock ? `## Live research results (use as context):\n${researchBlock}` : ""}

Output STRICT JSON, no markdown fences:
{
  "posts": [
    {
      "linkedin": "...",
      "x": "...",
      "instagram": "...",
      "image_query": "...",
      "image_prompt": "..."
    }
    ... (one entry per scheduled date)
  ]
}

Critical:
- ${dueAts.length} entries total. One per scheduled date.
- Each angle is genuinely different (hook, story, takeaway).
- No filler. No clichés. No emojis except in Instagram.`;

  const userPrompt = `Topic: ${topic}
Scheduled dates: ${dueAts.join(", ")}
Number of posts to write: ${dueAts.length}`;

  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: resolveModel("writing", body.model),
    temperature: 0.6,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: { posts?: Array<Record<string, string>> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Model returned non-JSON. Try again." },
      { status: 502 }
    );
  }
  const posts: CampaignPost[] = (parsed.posts ?? []).slice(0, dueAts.length).map(
    (p, i) => {
      const perPlatform: Partial<Record<PlatformKey, string>> = {};
      for (const k of platforms) {
        const text = (p[k] ?? "").slice(0, PLATFORM_LIMITS[k]);
        if (text) perPlatform[k] = text;
      }
      return {
        date: dueAts[i],
        perPlatform,
        imageQuery: p.image_query ?? "",
        imagePrompt: p.image_prompt ?? "",
      };
    }
  );

  // ── Step 3: generate an image for each post (uses references if provided) ──
  const origin = new URL(request.url).origin;
  // Pass auth forward — internal call needs the session cookie.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const provider = body.imageProvider ?? "auto";
  const images = await Promise.all(
    posts.map(async (post) => {
      const prompt = post.imagePrompt || post.imageQuery || topic;
      const aspect: "square" | "landscape" = platforms.includes("instagram")
        ? "square"
        : "landscape";
      try {
        const r = await fetch(`${origin}/api/admin/generate-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookieHeader,
          },
          body: JSON.stringify({
            prompt,
            provider,
            aspect,
            referenceUrls,
          }),
          cache: "no-store",
        });
        const j = (await r.json().catch(() => ({}))) as {
          url?: string;
          credit?: string;
          provider?: string;
        };
        if (!r.ok) return null;
        return j;
      } catch {
        return null;
      }
    })
  );

  // ── Step 4: optionally schedule each post on Buffer ──
  type ScheduleResult = {
    platform: PlatformKey;
    channelId: string;
    ok: boolean;
    error?: string;
    postId?: string;
  };
  const profilesByPlatform = body.profilesByPlatform ?? {};
  const shouldSchedule = body.schedule !== false; // default true
  let bufferToken: string | undefined;
  if (shouldSchedule) {
    const connector = await fetchConnector("buffer");
    bufferToken = connector?.bearer_token ?? undefined;
    if (!bufferToken) {
      return NextResponse.json(
        {
          error:
            "Buffer not connected — set schedule=false to return drafts only, or connect Buffer under Connectors first.",
        },
        { status: 503 }
      );
    }
  }

  const scheduledByIndex: Array<{
    post: CampaignPost;
    imageUrl: string | null;
    imageCredit: string | null;
    schedulings: ScheduleResult[];
  }> = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const img = images[i];
    const imageUrl = img?.url ?? null;
    const schedulings: ScheduleResult[] = [];

    if (shouldSchedule && bufferToken) {
      for (const platform of platforms) {
        const text = post.perPlatform[platform];
        if (!text) continue;
        const channels = profilesByPlatform[platform] ?? [];
        if (channels.length === 0) continue;
        const dueAt = new Date(post.date).toISOString();
        for (const channelId of channels) {
          const result = await createBufferPost({
            token: bufferToken,
            channelId,
            text,
            mode: "customScheduled",
            dueAt,
            imageUrl: imageUrl ?? undefined,
          });
          schedulings.push({
            platform,
            channelId,
            ok: result.ok,
            error: result.error,
            postId: result.postId,
          });
        }
      }
    }
    scheduledByIndex.push({
      post,
      imageUrl,
      imageCredit: img?.credit ?? null,
      schedulings,
    });
  }

  return NextResponse.json({
    campaign: scheduledByIndex,
    research: researchResults.map((r) => ({
      query: r.query,
      hitCount: r.hits.length,
    })),
    referencesUsed: {
      images: referenceUrls.length,
      posts: referencePosts.length,
    },
    scheduled: shouldSchedule,
  });
}
