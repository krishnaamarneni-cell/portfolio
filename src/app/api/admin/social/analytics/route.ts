import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { getAllSentPosts, aggregateMetrics, type BufferSentPost } from "@/lib/buffer";
import { runAgent, resolveAgentModel } from "@/lib/agents";
import { parsePlaybook, savePlaybook } from "@/lib/social-playbook";

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

  // Structured, not prose. The previous version asked for markdown tables,
  // which rendered as raw pipes in the UI and — more importantly — could not be
  // read back by the post generator. Findings only compound if something can
  // consume them.
  const system = metricsAvailable
    ? `You analyse Krishna Amarneni's social posts to work out what actually reaches people.

Every post is labelled with its real reach: [impressions N, engagement N].

Return ONLY a JSON object. No prose, no markdown, no fences.

{
  "headline": "one sentence: what he should write more of, and the number that proves it",
  "platforms": [{
    "platform": "linkedin | x | instagram",
    "posts": number,
    "avgImpressions": number or null,
    "winningPattern": "what the highest-reach posts share — hook style, topic, length, format",
    "bestHook": "the opening line of his best post, quoted exactly",
    "bestImpressions": number or null,
    "losingPattern": "what the lowest-reach posts did differently, or null",
    "verdict": "one sentence on whether this platform is working"
  }],
  "winningThemes": ["themes that reached people, most reach first"],
  "doMore": ["specific, writeable instructions — 'open with a personal outcome and a number', not 'be engaging'"],
  "doLess": ["specific things that measurably underperformed"],
  "biggestLever": "the single change worth making, with the number that justifies it"
}

Every claim must cite his own impression numbers. If a platform has no posts,
give it posts: 0 and say so in the verdict rather than inventing analysis.

Be careful with small samples: with only a handful of posts, differences are
often noise. Say so in the verdict instead of overclaiming a pattern.`
    : `You analyse Krishna Amarneni's social posts to describe WHAT he posts.

Reach numbers are NOT available for this account. Treat performance as unknown.
Never say a post "underperformed" or got "0 engagement" — you cannot know that.

Return ONLY a JSON object, same shape as below, with avgImpressions,
bestImpressions null and patterns framed as hypotheses to test once analytics
connect.

{
  "headline": "one sentence on what he posts about",
  "platforms": [{ "platform": "...", "posts": number, "avgImpressions": null,
    "winningPattern": "...", "bestHook": null, "bestImpressions": null,
    "losingPattern": null, "verdict": "..." }],
  "winningThemes": ["..."],
  "doMore": ["..."],
  "doLess": ["..."],
  "biggestLever": "..."
}`;

  const userPrompt = `Here is the posting data (top posts by engagement per platform):

${digest}`;

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

  const playbook = parsePlaybook(result.content ?? "");
  if (!playbook) {
    return NextResponse.json({ error: "Could not read the analysis. Try again." }, { status: 502 });
  }

  // Persisted so the writer can use it, not just this screen.
  const saveError = await savePlaybook({
    playbook,
    postsAnalyzed: loaded.posts.length,
    metricsAvailable,
    modelUsed: result.modelUsed ?? model,
  });

  return NextResponse.json({
    playbook,
    postsAnalyzed: loaded.posts.length,
    metricsAvailable,
    analyzedAt: new Date().toISOString(),
    modelUsed: result.modelUsed,
    saveError,
  });
}
