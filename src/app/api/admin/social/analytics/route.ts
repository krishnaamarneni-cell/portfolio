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
      .sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics))
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
  return NextResponse.json({
    ok: true,
    totalPosts,
    platforms,
    overall: {
      metrics: aggregateMetrics(loaded.posts),
      engagement: loaded.posts.reduce((n, p) => n + engagementOf(p.metrics), 0),
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

  const digest = SERVICES.map((svc) => {
    const posts = groups[svc];
    if (posts.length === 0) return `### ${svc.toUpperCase()}\n(no posts)`;
    const cs = contentStats(posts);
    const lines = [...posts]
      .sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics))
      .slice(0, 20)
      .map((p) => {
        const eng = engagementOf(p.metrics);
        const imp = p.metrics.impressions ?? p.metrics.reach ?? 0;
        const text = (p.text || "").replace(/\s+/g, " ").slice(0, 220);
        return `- [eng ${eng}, imp ${imp}] ${text}`;
      });
    return `### ${svc.toUpperCase()} — ${posts.length} posts · ~${cs.postsPerWeek}/wk · avg ${cs.avgChars} chars · ${cs.avgHashtags} hashtags/post · ${cs.pctWithLink}% links · ${cs.pctWithEmoji}% emoji\n${lines.join("\n")}`;
  }).join("\n\n");

  const system = `You are a social media strategist reviewing Krishna Amarneni's posting history across LinkedIn, X, and Instagram. Analyse WHAT KIND of content he posts and how it performs. Be specific and honest — this is for him, not an audience.

For EACH platform that has posts, cover:
- Themes/topics he actually posts about (name them)
- Tone & format patterns (hooks, length, hashtags, links, emoji)
- What's working vs not (correlate engagement with content type)
Then a short "## Overall" section: how his 3 platforms differ, whether he's cross-posting the same thing, cadence, and 3 concrete, prioritised recommendations.

Rules: Use markdown (## headings, ** bold, - bullets). No fluff, no restating the raw numbers back. If a platform has no posts, say "No posts yet." Base every claim on the data given.`;

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
