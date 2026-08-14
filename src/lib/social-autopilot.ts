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
  | { posted: false; queued?: false; reason: string }
  | {
      posted: true;
      queued: false;
      topic: string;
      postType: string;
      platforms: string[];
      imageUrl: string | null;
      posts: Record<string, string>;
    }
  | {
      posted: false;
      queued: true;
      topic: string;
      postType: string;
      platforms: string[];
      imageUrl: string | null;
      posts: Record<string, string>;
      dueAt: string;
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

async function pickTopic(settings: AutopilotSettings, analyticsCtx: string, apiKey: string): Promise<{ topic: string; fromCustomList: boolean }> {
  const db = requireSupabaseAdmin();

  // Custom topics: use once then remove
  if (settings.topics.length > 0) {
    const topic = settings.topics[0];
    return { topic, fromCustomList: true };
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
      const match = ideas.find((i: { topic: string }) =>
        picked.toLowerCase().includes(i.topic.toLowerCase().slice(0, 30)) ||
        i.topic.toLowerCase().includes(picked.toLowerCase().slice(0, 30))
      );
      if (match) {
        await db.from("social_ideas").update({ status: "drafted" }).eq("id", match.id);
      }
      return { topic: picked, fromCustomList: false };
    }
    const first = ideas[0] as { id: string; topic: string };
    await db.from("social_ideas").update({ status: "drafted" }).eq("id", first.id);
    return { topic: first.topic, fromCustomList: false };
  }

  // No ideas, no topics — generate from content profile
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
  return { topic: result.content?.trim() || "AI is changing how we work — here's what most people miss", fromCustomList: false };
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

function computeGenerateTime(postTime: string): string {
  const [h, m] = postTime.split(":").map(Number);
  const totalMin = h * 60 + m;
  const genMin = (totalMin - 720 + 1440) % 1440;
  const gh = Math.floor(genMin / 60);
  const gm = genMin % 60;
  return `${String(gh).padStart(2, "0")}:${String(gm).padStart(2, "0")}`;
}

function computeDueAt(postTime: string, timezone: string): string {
  const [h, m] = postTime.split(":").map(Number);
  const now = nowInTimezone(timezone);
  const postMin = h * 60 + m;

  // If post_time is later today, due today. Otherwise due tomorrow.
  let targetDate = now.date;
  if (now.minutes >= postMin) {
    // Post time already passed today — schedule for tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).formatToParts(d);
    const ymd = parts.reduce((acc, p) => {
      if (p.type === "year") acc.y = p.value;
      if (p.type === "month") acc.m = p.value;
      if (p.type === "day") acc.d = p.value;
      return acc;
    }, { y: "", m: "", d: "" });
    targetDate = `${ymd.y}-${ymd.m}-${ymd.d}`;
  }

  // Convert target date + post_time in timezone to ISO string
  const isoish = `${targetDate}T${postTime}:00`;
  // Compute offset by comparing the timezone's representation to UTC
  const refDate = new Date(isoish + "Z");
  const utcStr = refDate.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = refDate.toLocaleString("en-US", { timeZone: timezone });
  const utcMs = new Date(utcStr).getTime();
  const tzMs = new Date(tzStr).getTime();
  const offsetMs = tzMs - utcMs;
  const targetMs = refDate.getTime() - offsetMs;
  return new Date(targetMs).toISOString();
}

async function generatePosts(settings: AutopilotSettings, token: string, apiKey: string) {
  const analyticsCtx = await buildAnalyticsGuidance(token, settings.platforms);
  const { topic, fromCustomList } = await pickTopic(settings, analyticsCtx, apiKey);
  const postType = settings.post_types[Math.floor(Math.random() * settings.post_types.length)] || "text";

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

  if (channels.length === 0) return null;

  const platformsPosting = [...new Set(channels.map((c) => SERVICE_MAP[c.service.toLowerCase()]).filter(Boolean))];
  const profile = await getContentProfile();
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

  if (!result.ok || !result.content) return null;

  const parsed = extractPostJson(result.content);
  if (!parsed) return null;

  let imageUrl: string | null = null;
  if ((postType === "image" || postType === "image+text") && parsed.image_query) {
    const unsplashResult = await searchUnsplash(parsed.image_query);
    if (unsplashResult) {
      const samplePost = parsed.linkedin || parsed.instagram || parsed.x || topic;
      const matches = await validateImageForContent(unsplashResult.url, samplePost, apiKey);
      if (matches) {
        imageUrl = unsplashResult.url;
      } else {
        const retry = await searchUnsplash(topic.split(" ").slice(0, 4).join(" "));
        if (retry) imageUrl = retry.url;
      }
    }
  }

  // Remove used topic from custom list
  if (fromCustomList && settings.topics.length > 0) {
    const remaining = settings.topics.slice(1);
    await updateAutopilotSettings({ topics: remaining });
  }

  return { topic, postType, channels, platformsPosting, parsed, imageUrl, analyticsCtx };
}

export async function runAutopilot(opts?: { force?: boolean }): Promise<AutopilotResult> {
  const settings = await getAutopilotSettings();

  if (!settings.enabled && !opts?.force) {
    return { posted: false, reason: "disabled" };
  }

  const connector = await fetchConnector("buffer").catch(() => null);
  const token = connector?.bearer_token as string | undefined;
  if (!token) return { posted: false, reason: "no-buffer" };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { posted: false, reason: "no-groq-key" };

  // Force mode: generate and post immediately
  if (opts?.force) {
    const gen = await generatePosts(settings, token, apiKey);
    if (!gen) return { posted: false, reason: "AI generation failed" };

    const posts: Record<string, string> = {};
    const postedPlatforms: string[] = [];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (const channel of gen.channels) {
      const svc = SERVICE_MAP[channel.service.toLowerCase()];
      if (!svc) continue;
      const text = svc === "linkedin" ? gen.parsed.linkedin
        : svc === "x" ? gen.parsed.x
        : svc === "instagram" ? gen.parsed.instagram
        : null;
      if (!text) continue;

      const postResult = await createBufferPost({
        token,
        channelId: channel.id,
        text,
        mode: "shareNow",
        imageUrl: gen.imageUrl ?? undefined,
      });
      if (postResult.ok) {
        posts[svc] = text;
        postedPlatforms.push(svc);
      }
      await sleep(1000);
    }

    if (postedPlatforms.length === 0) return { posted: false, reason: "All Buffer posts failed" };

    const db = requireSupabaseAdmin();
    try {
      await db.from("social_autopilot_log").insert({
        topic: gen.topic, platforms_posted: postedPlatforms, post_type: gen.postType,
        image_url: gen.imageUrl, posts, analytics_context: gen.analyticsCtx.slice(0, 2000) || null,
      });
    } catch {}

    return { posted: true, queued: false, topic: gen.topic, postType: gen.postType, platforms: postedPlatforms, imageUrl: gen.imageUrl, posts };
  }

  // Cron mode: generate 12h early, queue for post_time
  const now = nowInTimezone(settings.timezone);
  const generateTime = computeGenerateTime(settings.post_time);
  if (!isWithinWindow(now.minutes, generateTime)) {
    return { posted: false, reason: "not-scheduled" };
  }

  // Compute the posting date (the date the post goes live)
  const [postH, postM] = settings.post_time.split(":").map(Number);
  const postMin = postH * 60 + postM;
  const [genH, genM] = generateTime.split(":").map(Number);
  const genMin = genH * 60 + genM;
  // If generate time > post time in the day, the post goes live tomorrow
  const postDate = genMin > postMin ? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone }).formatToParts(d);
    const ymd = parts.reduce((acc, p) => {
      if (p.type === "year") acc.y = p.value;
      if (p.type === "month") acc.m = p.value;
      if (p.type === "day") acc.d = p.value;
      return acc;
    }, { y: "", m: "", d: "" });
    return `${ymd.y}-${ymd.m}-${ymd.d}`;
  })() : now.date;

  if (settings.last_posted_on === postDate) {
    return { posted: false, reason: "already-today" };
  }

  const gen = await generatePosts(settings, token, apiKey);
  if (!gen) return { posted: false, reason: "AI generation failed" };

  // Queue posts in social_queue with due_at = post_time
  const dueAt = computeDueAt(settings.post_time, settings.timezone);
  const db = requireSupabaseAdmin();
  const queuedPlatforms: string[] = [];
  const posts: Record<string, string> = {};

  for (const channel of gen.channels) {
    const svc = SERVICE_MAP[channel.service.toLowerCase()];
    if (!svc) continue;
    const text = svc === "linkedin" ? gen.parsed.linkedin
      : svc === "x" ? gen.parsed.x
      : svc === "instagram" ? gen.parsed.instagram
      : null;
    if (!text) continue;

    await db.from("social_queue").insert({
      text,
      platform: svc,
      channel_id: channel.id,
      channel_name: channel.displayName || channel.name,
      image_url: gen.imageUrl,
      due_at: dueAt,
      status: "pending",
    });
    posts[svc] = text;
    queuedPlatforms.push(svc);
  }

  if (queuedPlatforms.length === 0) return { posted: false, reason: "No posts to queue" };

  // Mark this date as generated
  await db
    .from("social_autopilot_settings")
    .update({ last_posted_on: postDate, updated_at: new Date().toISOString() })
    .eq("id", 1);

  // Log
  try {
    await db.from("social_autopilot_log").insert({
      topic: gen.topic, platforms_posted: queuedPlatforms, post_type: gen.postType,
      image_url: gen.imageUrl, posts, analytics_context: gen.analyticsCtx.slice(0, 2000) || null,
    });
  } catch {}

  return {
    posted: false, queued: true, topic: gen.topic, postType: gen.postType,
    platforms: queuedPlatforms, imageUrl: gen.imageUrl, posts, dueAt,
  };
}
