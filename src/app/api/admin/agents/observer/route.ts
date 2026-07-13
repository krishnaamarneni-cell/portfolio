import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnector } from "@/lib/content";
import { getAllSentPosts, type BufferSentPost } from "@/lib/buffer";
import { runAgent, resolveAgentModel } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { model?: string };

function impressionsOf(m: BufferSentPost["metrics"]): number {
  return (m.impressions ?? 0) || (m.reach ?? 0);
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set" }, { status: 503 });
  }
  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  // Best-effort: pull the user's real post history from Buffer for grounding.
  let posts: BufferSentPost[] = [];
  const connector = await fetchConnector("buffer").catch(() => null);
  if (connector?.bearer_token) {
    const res = await getAllSentPosts(connector.bearer_token).catch(() => ({ error: "x" }) as { error: string });
    if (!("error" in res)) posts = res.posts;
  }

  const digest =
    posts.length > 0
      ? [...posts]
          .sort((a, b) => impressionsOf(b.metrics) - impressionsOf(a.metrics))
          .slice(0, 30)
          .map((p) => {
            const imp = impressionsOf(p.metrics);
            const text = (p.text || "").replace(/\s+/g, " ").slice(0, 240);
            return `- [${p.channel?.service ?? "?"}${imp ? `, ${imp} impressions` : ""}] ${text}`;
          })
          .join("\n")
      : "(No posts pulled from Buffer — base ideas on his background below.)";

  const system = `You are Krishna Amarneni's Social Observer — the agent that remembers everything he posts and knows his voice. Krishna: SAP S/4HANA consultant (Coca-Cola, Xiromed), AI-agent builder, author of "Drive to Freedom", creator of WealthClaude & Lucy AI. His posts skew toward personal money lessons, scam/consumer warnings, AI's impact, and building-in-public.

From his post history, do two things:
1. A short "content memory" — what he usually posts about, his tone, his formats, and (if impressions are shown) what reaches the most people.
2. Propose 6 fresh post ideas that sound like HIM and would reach his audience — each a specific topic (not a vague theme) plus a one-line angle/note.

Return STRICT JSON, no markdown fences:
{
  "summary": "markdown string: 2-4 short paragraphs or bullets on his content memory",
  "ideas": [ { "topic": "specific post topic", "note": "one-line angle/hook" }, ... 6 items ]
}`;

  const userPrompt = `Krishna's recent posts (most-reaching first):\n${digest}`;

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

  const raw = result.content ?? "";
  let parsed: { summary?: string; ideas?: Array<{ topic?: string; note?: string }> } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        parsed = JSON.parse(raw.slice(s, e + 1));
      } catch {}
    }
  }

  const ideas = (parsed?.ideas ?? [])
    .filter((i) => i && typeof i.topic === "string" && i.topic.trim())
    .slice(0, 8)
    .map((i) => ({ topic: i.topic!.trim().slice(0, 300), note: (i.note ?? "").trim().slice(0, 300) }));

  const summary = (parsed?.summary ?? "").trim();
  const markdown = summary || (raw && !parsed ? raw : "Ran, but couldn't parse a summary — try again.");

  return NextResponse.json({
    markdown,
    ideas,
    context: { postsAnalyzed: posts.length, model: result.modelUsed ?? model },
  });
}
