import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveAgentModel } from "@/lib/agents";
import { buildFactsContext } from "@/lib/facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
type Body = {
  agentKey?: string;
  messages?: ChatMessage[];
  report?: string; // the agent's latest markdown result, for grounding
  model?: string;
};

const PERSONAS: Record<string, string> = {
  news: `You are Krishna's News Scout — a sharp markets + tech + job-market analyst. You track his holdings, the AI tool landscape, and hiring trends. Answer follow-ups about the news, connect items to his portfolio and career, and suggest concrete next steps.`,
  inbox: `You are Krishna's Email Intelligence agent. You triage his inbox, spot recruiter outreach and job matches, and help him reply well. Help him decide what matters, draft replies, and prioritise.`,
  jobs: `You are Krishna's Jobs Scout. You evaluate openings against his background (SAP S/4HANA MM/SD consultant at Coca-Cola/Xiromed, plus AI-agent builder). Assess fit, flag red/green flags, and coach his application strategy.`,
  opportunities: `You are Atlas, Krishna's investing analyst. You score ideas Buffett-style (moat, management, margin of safety) and look for picks that fill gaps in his portfolio. Explain your reasoning; tier ideas HIGH / WATCH / MAYBE.`,
  screener: `You are Krishna's Stock Screener — a risk-calibrated market scanner. You match ideas to his stated risk tolerance, sector focus, and budget, and explain the risk/reward plainly.`,
};

const FINANCE_AGENTS = new Set(["opportunities", "screener", "news"]);

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
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agentKey = body.agentKey ?? "";
  const persona = PERSONAS[agentKey];
  if (!persona) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
  }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send a message" }, { status: 400 });
  }

  const facts = await buildFactsContext().catch(() => "");
  const report = (body.report ?? "").slice(0, 8000);

  const system = [
    persona,
    facts ? `\n${facts}` : "",
    report
      ? `\nYour latest report is below — treat it as shared context and refer to it when answering:\n---\n${report}\n---`
      : "\n(No report has been generated yet this session — answer from what you know and ask to run a scan if you need fresh data.)",
    `\nGuidelines:
- Be concise and specific. Prefer plain text with light markdown (bold, bullets, [text](url) links).
- Cite tickers, companies, or source links from the report when relevant.
- If you don't have the data, say so and suggest running the scan — don't invent numbers or URLs.`,
    FINANCE_AGENTS.has(agentKey)
      ? `\nThis is research and information, not personalised financial advice; remind Krishna to do his own due diligence on any trade.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const requested = resolveAgentModel(body.model);
  const messages = [{ role: "system" as const, content: system }, ...history];

  async function complete(model: string) {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 1200,
      messages,
    });
    const msg = completion.choices[0]?.message as
      | { content?: string; executed_tools?: Array<Record<string, unknown>> }
      | undefined;
    let content = msg?.content ?? "";
    if (!content && Array.isArray(msg?.executed_tools)) {
      content = msg!.executed_tools
        .map((t) => (typeof t.output === "string" ? t.output : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim();
    }
    return content;
  }

  try {
    let reply = "";
    try {
      reply = await complete(requested);
    } catch {
      // Compound / a bad model id can fail — fall back to a plain chat model.
      reply = await complete("llama-3.3-70b-versatile");
    }
    if (!reply) {
      reply = await complete("llama-3.3-70b-versatile");
    }
    if (!reply) {
      return NextResponse.json({ error: "The agent had nothing to say — try rephrasing." }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 502 }
    );
  }
}
