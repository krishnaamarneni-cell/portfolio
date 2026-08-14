import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { fetchConnector } from "@/lib/content";
import { getChannels, createBufferPost, getAllSentPosts, type BufferSentPost } from "@/lib/buffer";
import { runAgent } from "@/lib/agents";
import { getContentProfile } from "@/lib/content-curator";
import { extractPostJson } from "@/lib/social-prompt";
import { nowInTimezone, isWithinWindow } from "@/lib/social-drip";
export { nowInTimezone };

export type AutopilotSettings = {
  enabled: boolean;
  platforms: string[];
  channel_ids: string[];
  post_types: string[];
  topics: string[];
  post_time: string;
  timezone: string;
  last_posted_on: string | null;
};

export type AutopilotResult =
  | { posted: false; reason: string }
  | {
      posted: true;
      topic: string;
      postType: string;
      platforms: string[];
      imageUrl: string | null;
      posts: Record<string, string>;
    };

export async function getAutopilotSettings(): Promise<AutopilotSettings> {
  const db = requireSupabaseAdmin();
  const { data } = await db
    .from("social_autopilot_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (data) return data as AutopilotSettings;
  return {
    enabled: false,
    platforms: ["linkedin", "instagram"],
    channel_ids: [],
    post_types: ["text"],
    topics: [],
    post_time: "10:00",
    timezone: "America/Chicago",
    last_posted_on: null,
  };
}

export async function updateAutopilotSettings(
  patch: Partial<AutopilotSettings>
): Promise<AutopilotSettings> {
  const db = requireSupabaseAdmin();
  await db
    .from("social_autopilot_settings")
    .upsert({ ...patch, id: 1, updated_at: new Date().toISOString() });
  return getAutopilotSettings();
}

const SERVICE_MAP: Record<string, string> = {
  linkedin: "linkedin",
  twitter: "x",
  x: "x",
  instagram: "instagram",
};

function engagementOf(m: BufferSentPost["metrics"]): number {
  return (
    (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) +
    (m.reactions ?? 0) + (m.replies ?? 0) + (m.retweets ?? 0) + (m.saves ?? 0)
  );
}

function impressionsOf(m: BufferSentPost["metrics"]): number {
  return (m.impressions ?? 0) || (m.reach ?? 0);
}

async function buildAnalyticsGuidance(token: string, platforms: string[]): Promise<string> {
  try {
    const res = await getAllSentPosts(token);
    if ("error" in res || res.posts.length === 0) return "";

    const byPlatform: Record<string, BufferSentPost[]> = {};
    for (const p of res.posts) {
      const svc = SERVICE_MAP[(p.channel?.service ?? "").toLowerCase()] ?? null;
      if (svc && platforms.includes(svc)) {
        if (!byPlatform[svc]) byPlatform[svc] = [];
        byPlatform[svc].push(p);
      }
    }

    const lines: string[] = ["## What performs best (from your analytics):"];
    for (const [svc, posts] of Object.entries(byPlatform)) {
      const sorted = [...posts].sort((a, b) => impressionsOf(b.metrics) - impressionsOf(a.metrics));
      const top5 = sorted.slice(0, 5);
      if (top5.length === 0) continue;
      lines.push(`\n### ${svc.toUpperCase()} top posts:`);
      for (const p of top5) {
        const text = (p.text || "").replace(/\s+/g, " ").slice(0, 150);
        lines.push(`- [${impressionsOf(p.metrics)} impressions, ${engagementOf(p.metrics)} engagement] ${text}`);
      }
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

async function pickTopic(settings: AutopilotSettings, analyticsCtx: string, apiKey: string): Promise<string> {
  const db = requireSupabaseAdmin();

  // If user has configured topics, pick from those
  if (settings.topics.length > 0) {
    // Check recent log to avoid repeating
    const { data: recent } = await db
      .from("social_autopilot_log")
      .select("topic")
      .order("created_at", { ascending: false })
      .limit(7);
    const recentTopics = new Set((recent ?? []).map((r: { topic: string }) => r.topic.toLowerCase()));
    const fresh = settings.topics.filter((t) => !recentTopics.has(t.toLowerCase()));
    if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];
    return settings.topics[Math.floor(Math.random() * settings.topics.length)];
  }

  // Try ideas from the social_ideas table
  const { data: ideas } = await db
    .from("social_ideas")
    .select("id, topic, note")
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(10);

  if (ideas && ideas.length > 0) {
    const profile = await getContentProfile();
    const ideasList = ideas.map((i: { topic: string; note: string | null }, idx: number) =>
      `${idx + 1}. ${i.topic}${i.note ? ` — ${i.note}` : ""}`
    ).join("\n");

    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: `You pick the single best topic for today's social post. Consider what performs well and what's fresh.
${analyticsCtx}

Content profile: ${profile}

Pick the ONE topic that will get the most engagement today. Return ONLY the topic text, nothing else.`,
      userPrompt: `Ideas:\n${ideasList}`,
      maxTokens: 200,
    });

    if (result.ok && result.content) {
      const picked = result.content.trim().replace(/^["'\d.)\s]+/, "").replace(/["']+$/, "").trim();
      // Mark it as drafted
      const match = ideas.find((i: { topic: string }) =>
        picked.toLowerCase().includes(i.topic.toLowerCase().slice(0, 30)) ||
        i.topic.toLowerCase().includes(picked.toLowerCase().slice(0, 30))
      );
      if (match) {
        await db.from("social_ideas").update({ status: "drafted" }).eq("id", match.id);
      }
      return picked;
    }
    // Fallback: pick first idea
    const first = ideas[0] as { id: string; topic: string };
    await db.from("social_ideas").update({ status: "drafted" }).eq("id", first.id);
    return first.topic;
  }

  // No ideas, no topics — generate one from the content profile
  const profile = await getContentProfile();
  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `Generate ONE specific, compelling social post topic that matches this creator's voice. Make it timely and engaging. Return ONLY the topic, nothing else.
${analyticsCtx}
Content profile: ${profile}`,
    userPrompt: "Generate a topic for today's post.",
    maxTokens: 150,
  });
  return result.content?.trim() || "AI is changing how we work — here's what most people miss";
}

async function searchUnsplash(query: string): Promise<{ url: string; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?per_page=5&orientation=landscape&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Client-ID ${key}` }, cache: "no-store" }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const results = data.results as Array<{ urls: { regular: string }; user: { name: string } }> | undefined;
    if (!results || results.length === 0) return null;
    const pick = results[0];
    return { url: pick.urls.regular, credit: `Photo by ${pick.user?.name ?? "Unsplash"}` };
  } catch {
    return null;
  }
}

async function validateImageForContent(
  imageUrl: string,
  postText: string,
  apiKey: string
): Promise<boolean> {
  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You verify if an image matches a social post's content. Answer ONLY "yes" or "no".`,
    userPrompt: `Post: "${postText.slice(0, 300)}"\nImage search result URL: ${imageUrl}\nDoes this image match the post content? Answer yes or no.`,
    maxTokens: 10,
  });
  return (result.content ?? "").toLowerCase().includes("yes");
}

export async function runAutopilot(opts?: { force?: boolean }): Promise<AutopilotResult> {
  const settings = await getAutopilotSettings();

  if (!settings.enabled && !opts?.force) {
    return { posted: false, reason: "disabled" };
  }

  // Time check (skip if forced)
  if (!opts?.force) {
    const now = nowInTimezone(settings.timezone);
    if (!isWithinWindow(now.minutes, settings.post_time)) {
      return { posted: false, reason: "not-scheduled" };
    }
    if (settings.last_posted_on === now.date) {
      return { posted: false, reason: "already-today" };
    }
  }

  const connector = await fetchConnector("buffer").catch(() => null);
  const token = connector?.bearer_token as string | undefined;
  if (!token) return { posted: false, reason: "no-buffer" };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { posted: false, reason: "no-groq-key" };

  // Get channels and filter to selected platforms/channels
  const allChannels = await getChannels(token);
  let channels = allChannels.filter((c) => !c.isDisconnected);

  if (settings.channel_ids.length > 0) {
    channels = channels.filter((c) => settings.channel_ids.includes(c.id));
  } else {
    channels = channels.filter((c) => {
      const svc = SERVICE_MAP[c.service.toLowerCase()];
      return svc && settings.platforms.includes(svc);
    });
  }

  if (channels.length === 0) return { posted: false, reason: "no-channels" };

  // Build analytics guidance
  const analyticsCtx = await buildAnalyticsGuidance(token, settings.platforms);

  // Pick topic
  const topic = await pickTopic(settings, analyticsCtx, apiKey);
  const postType = settings.post_types[Math.floor(Math.random() * settings.post_types.length)] || "text";

  // Determine which platforms we're posting to
  const platformsPosting = [...new Set(channels.map((c) => SERVICE_MAP[c.service.toLowerCase()]).filter(Boolean))];

  const profile = await getContentProfile();

  // Generate platform-specific posts
  const platformList = platformsPosting.join(", ");
  const systemPrompt = `You are a social media content strategist writing for Krishna Amarneni.

${profile}

${analyticsCtx}

CRITICAL RULES:
- Write ONLY about the given topic. Do NOT insert Krishna's bio, job history, or resume into the post.
- Each platform must feel genuinely DIFFERENT — not the same text reformatted.
- LinkedIn = thought leadership (max 3000 chars). Hook line first, short paragraphs, 3-5 hashtags at end.
- X = sharp punchy take (max 270 chars). One idea, conversational, 0-1 hashtag.
- Instagram = storytelling caption (max 2000 chars). Personal angle, 2-3 emojis, 8-12 hashtags at end.
- NEVER use ** or markdown formatting. Plain text only.
- NEVER throat-clear ("In today's world...", "I wanted to share...")
- Hook FIRST, always. Make it stop the scroll.
- BANNED phrases: "excited about", "leverage my expertise", "game changer", "at the end of the day"

${postType === "image" ? 'Also generate an "image_query" field (2-4 concrete words for Unsplash that MATCH the topic, not generic stock).' : ""}

Output STRICT JSON (no markdown fences):
{
  ${platformsPosting.includes("linkedin") ? '"linkedin": "...",' : ""}
  ${platformsPosting.includes("x") ? '"x": "...",' : ""}
  ${platformsPosting.includes("instagram") ? '"instagram": "...",' : ""}
  "image_query": "..."
}

Only include fields for platforms: ${platformList}`;

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt,
    userPrompt: `Topic: ${topic}\nPost type: ${postType}\nPlatforms: ${platformList}`,
    maxTokens: 3000,
  });

  if (!result.ok || !result.content) {
    return { posted: false, reason: `AI generation failed: ${result.error}` };
  }

  const parsed = extractPostJson(result.content);
  if (!parsed) {
    return { posted: false, reason: "AI returned invalid JSON" };
  }

  // Search for image if post type includes image
  let imageUrl: string | null = null;
  if ((postType === "image" || postType === "image+text") && parsed.image_query) {
    const unsplashResult = await searchUnsplash(parsed.image_query);
    if (unsplashResult) {
      // Validate image matches content
      const samplePost = parsed.linkedin || parsed.instagram || parsed.x || topic;
      const matches = await validateImageForContent(unsplashResult.url, samplePost, apiKey);
      if (matches) {
        imageUrl = unsplashResult.url;
      } else {
        // Try a second search with the topic directly
        const retry = await searchUnsplash(topic.split(" ").slice(0, 4).join(" "));
        if (retry) imageUrl = retry.url;
      }
    }
  }

  // Post to each channel via Buffer
  const posts: Record<string, string> = {};
  const postedPlatforms: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const channel of channels) {
    const svc = SERVICE_MAP[channel.service.toLowerCase()];
    if (!svc) continue;

    const text = svc === "linkedin" ? parsed.linkedin
      : svc === "x" ? parsed.x
      : svc === "instagram" ? parsed.instagram
      : null;

    if (!text) continue;

    const postResult = await createBufferPost({
      token,
      channelId: channel.id,
      text,
      mode: "shareNow",
      imageUrl: imageUrl ?? undefined,
    });

    if (postResult.ok) {
      posts[svc] = text;
      postedPlatforms.push(svc);
    }
    await sleep(1000);
  }

  if (postedPlatforms.length === 0) {
    return { posted: false, reason: "All Buffer posts failed" };
  }

  // Update last_posted_on
  const db = requireSupabaseAdmin();
  const now = nowInTimezone(settings.timezone);
  await db
    .from("social_autopilot_settings")
    .update({ last_posted_on: now.date, updated_at: new Date().toISOString() })
    .eq("id", 1);

  // Log
  try {
    await db.from("social_autopilot_log").insert({
      topic,
      platforms_posted: postedPlatforms,
      post_type: postType,
      image_url: imageUrl,
      posts,
      analytics_context: analyticsCtx.slice(0, 2000) || null,
    });
  } catch { /* table may not exist */ }

  return {
    posted: true,
    topic,
    postType,
    platforms: postedPlatforms,
    imageUrl,
    posts,
  };
}
