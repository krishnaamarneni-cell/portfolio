import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { getAllSentPosts, aggregateMetrics, type BufferSentPost } from "@/lib/buffer";
import { runAgent, resolveAgentModel } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICES = ["linkedin", "x", "instagram"] as const;
type Service = (typeof SERVICES)[number];

function normalizeService(raw: string): Service | null {
  const s = (raw || "").toLowerCase();
  if (s.startsWith("linkedin")) return "linkedin";
  if (s.startsWith("instagram")) return "instagram";
  if (s.startsWith("twitter") || s === "x") return "x";
  return null;
}

const EMOJI = /\p{Extended_Pictographic}/u;

function contentStats(posts: BufferSentPost[]) {
  if (posts.length === 0) {
    return { avgChars: 0, avgHashtags: 0, pctWithLink: 0, pctWithEmoji: 0, postsPerWeek: 0 };
  }
  let chars = 0;
  let hashtags = 0;
  let withLink = 0;
  let withEmoji = 0;
  const times: number[] = [];
  for (const p of posts) {
    const t = p.text || "";
    chars += t.length;
    hashtags += (t.match(/#[\w]+/g) || []).length;
    if (/https?:\/\//i.test(t)) withLink++;
    if (EMOJI.test(t)) withEmoji++;
    if (p.sentAt) {
      const ms = new Date(p.sentAt).getTime();
      if (Number.isFinite(ms)) times.push(ms);
    }
  }
  let postsPerWeek = 0;
  if (times.length >= 2) {
    const span = Math.max(...times) - Math.min(...times);
    const weeks = span / (7 * 24 * 60 * 60 * 1000);
    postsPerWeek = weeks > 0 ? posts.length / weeks : posts.length;
  }
  return {
    avgChars: Math.round(chars / posts.length),
    avgHashtags: Math.round((hashtags / posts.length) * 10) / 10,
    pctWithLink: Math.round((withLink / posts.length) * 100),
    pctWithEmoji: Math.round((withEmoji / posts.length) * 100),
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
  };
}

function engagementOf(m: BufferSentPost["metrics"]): number {
  return (
    (m.likes ?? 0) +
    (m.comments ?? 0) +
    (m.shares ?? 0) +
    (m.reactions ?? 0) +
    (m.replies ?? 0) +
    (m.retweets ?? 0) +
    (m.saves ?? 0)
  );
}

/** Reach = impressions, falling back to reach count. */
function impressionsOf(m: BufferSentPost["metrics"]): number {
  return (m.impressions ?? 0) || (m.reach ?? 0);
}

async function loadPosts() {
  const connector = await fetchConnector("buffer");
  if (!connector?.bearer_token) {
    return { error: "Buffer connector not set up. Add it under Connectors first.", status: 503 as const };
  }
  const res = await getAllSentPosts(connector.bearer_token);
  if ("error" in res) return { error: res.error, status: 502 as const };
  return { posts: res.posts };
}

function groupByService(posts: BufferSentPost[]) {
  const groups: Record<Service, BufferSentPost[]> = { linkedin: [], x: [], instagram: [] };
  for (const p of posts) {
    const svc = normalizeService(p.channel?.service ?? "");
    if (svc) groups[svc].push(p);
  }
  return groups;
}

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loaded = await loadPosts();
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const groups = groupByService(loaded.posts);

  const platforms = SERVICES.map((svc) => {
    const posts = groups[svc];
    const agg = aggregateMetrics(posts);
    const engagement = posts.reduce((n, p) => n + engagementOf(p.metrics), 0);
    const top = [...posts]
      .sort(
        (a, b) =>
          impressionsOf(b.metrics) - impressionsOf(a.metrics) ||
          engagementOf(b.metrics) - engagementOf(a.metrics)
      )
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        text: p.text,
        sentAt: p.sentAt,
        serviceLink: p.serviceLink,
        engagement: engagementOf(p.metrics),
        metrics: p.metrics,
      }));
    return {
      service: svc,
      channelName: posts[0]?.channel?.name ?? null,
      postCount: posts.length,
      metrics: agg,
      engagement,
      content: contentStats(posts),
      posts: top,
    };
  });

  const totalPosts = loaded.posts.length;
  const overallEngagement = loaded.posts.reduce((n, p) => n + engagementOf(p.metrics), 0);
  const overallImpressions = platforms.reduce(
    (n, p) => n + (p.metrics.impressions ?? 0) + (p.metrics.reach ?? 0),
    0
  );
  const metricsAvailable = overallEngagement > 0 || overallImpressions > 0;
  return NextResponse.json({
    ok: true,
    totalPosts,
    metricsAvailable,
    platforms,
    overall: {
      metrics: aggregateMetrics(loaded.posts),
      engagement: overallEngagement,
    },
  });
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set" }, { status: 503 });
  }
  let body: { model?: string } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { model?: string };
  } catch {}

  const loaded = await loadPosts();
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  if (loaded.posts.length === 0) {
    return NextResponse.json({ error: "No sent posts found in Buffer yet." }, { status: 400 });
  }
  const groups = groupByService(loaded.posts);

  const overallEngagement = loaded.posts.reduce((n, p) => n + engagementOf(p.metrics), 0);
  const overallImpressions = SERVICES.reduce(
    (n, svc) => n + groups[svc].reduce((m, p) => m + (p.metrics.impressions ?? 0) + (p.metrics.reach ?? 0), 0),
    0
  );
  const metricsAvailable = overallEngagement > 0 || overallImpressions > 0;

  const digest = SERVICES.map((svc) => {
    const posts = groups[svc];
    if (posts.length === 0) return `### ${svc.toUpperCase()}\n(no posts)`;
    const cs = contentStats(posts);
    // Rank by REACH (impressions) — the user wants to know what reaches most people.
    const lines = [...posts]
      .sort((a, b) => impressionsOf(b.metrics) - impressionsOf(a.metrics))
      .slice(0, 25)
      .map((p) => {
        const text = (p.text || "").replace(/\s+/g, " ").slice(0, 240);
        if (!metricsAvailable) return `- ${text}`;
        const imp = impressionsOf(p.metrics);
        const eng = engagementOf(p.metrics);
        return `- [impressions ${imp}, engagement ${eng}] ${text}`;
      });
    return `### ${svc.toUpperCase()} — ${posts.length} posts · ~${cs.postsPerWeek}/wk · avg ${cs.avgChars} chars · ${cs.avgHashtags} hashtags/post · ${cs.pctWithLink}% links · ${cs.pctWithEmoji}% emoji\n${lines.join("\n")}`;
  }).join("\n\n");

  const system = metricsAvailable
    ? `You are a social media growth strategist reviewing Krishna Amarneni's posting history across LinkedIn, X, and Instagram. Each post is labelled with its REACH ([impressions N, engagement N]). Your job is to figure out WHAT KIND OF CONTENT REACHES THE MOST PEOPLE and tell him what to post more of.

For EACH platform that has posts:
- Name the themes/topics he posts about.
- Identify which content types/themes got the HIGHEST impressions vs the lowest — cite the actual impression numbers as evidence.
- Describe the pattern of the high-reach posts (hook style, topic, length, format, hashtags/links/emoji) — what do the winners have in common?

Then, most important:
## 🚀 Post more of this
Rank the specific content types he should post MORE of to grow reach. For each, name the content type, why (cite his own high-impression posts as proof), and which platform it works best on. Be concrete — "personal money-lesson stories with a bold one-line hook" beats "engaging content".

## Overall
How the 3 platforms differ, whether he's just cross-posting, ideal cadence, and the single highest-leverage change to increase reach.

Rules: Use markdown (## headings, ** bold, - bullets). Ground EVERY claim in the impression numbers given — no generic advice. If a platform has no posts, say "No posts yet."`
    : `You are a social media strategist reviewing Krishna Amarneni's posting history across LinkedIn, X, and Instagram. Analyse WHAT KIND of content he posts.

IMPORTANT: Impression/engagement numbers are NOT available for this account — treat performance as UNKNOWN. Do NOT claim posts got "0 engagement", "underperformed", or are "misaligned". Instead analyse content TYPES and, using best practices + his patterns, recommend which topics/formats to post MORE of to grow reach, framed as hypotheses to confirm once analytics connect.

For EACH platform with posts: name the themes, the tone/format patterns, and which content types he should double down on. Then a "## 🚀 Post more of this" section and a "## Overall" section with cadence + 3 prioritised actions.

Rules: markdown (## headings, ** bold, - bullets). No fluff. If a platform has no posts, say "No posts yet."`;

  const userPrompt = `Here is the posting data (top posts by engagement per platform):\n\n${digest}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 1800,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ markdown: result.content, modelUsed: result.modelUsed });
}
