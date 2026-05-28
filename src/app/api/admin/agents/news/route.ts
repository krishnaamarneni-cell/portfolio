import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import {
  fetchHoldingSymbols,
  resolveAgentModel,
  runAgent,
} from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { model?: string; extraQuery?: string };

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set" },
      { status: 503 }
    );
  }
  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  // Gather context: holdings (via WealthClaude MCP), recent roles, skills.
  const [holdingsResult, jobs, site] = await Promise.all([
    fetchHoldingSymbols(),
    fetchJobs().catch(() => []),
    fetchSiteContent(),
  ]);
  const roles = jobs
    .slice(0, 5)
    .map((j) => `${j.title} @ ${j.company}`)
    .filter(Boolean);
  const skills = (site.skills?.skills ?? []).slice(0, 25);

  const system = `You are Krishna Amarneni's personal news scout. You have a web-search tool. Use it.

Job: in one shot, surface what's NEW (last 7 days, prioritise last 24 hours) across three buckets:
1. **Stocks/investments** — only for the tickers in Krishna's portfolio (provided below). Earnings, M&A, downgrades, big moves, anything actionable.
2. **Job market** — trends affecting people in roles like Krishna's (SAP, fullstack, AI builder).
3. **AI tools** — new models, agent frameworks, dev tools that someone building AI products should know about.

Output rules:
- Return clean Markdown. Three H2 sections: \`## Stocks\`, \`## Job Market\`, \`## AI Tools\`.
- Each section: 3-6 bullets. Each bullet ends with a Markdown link: \` [Source](URL)\`.
- Lead with the ticker / company / tool name in bold.
- Skip anything you can't back with a real URL.
- No filler. No "hope this helps". No emojis.`;

  const symbolsLine = holdingsResult.symbols.length
    ? `Krishna's tickers: ${holdingsResult.symbols.join(", ")}.`
    : `Krishna's holdings are unavailable — search the broad US market + AI sector.`;

  const userPrompt = [
    symbolsLine,
    roles.length ? `Recent roles: ${roles.join("; ")}.` : "",
    skills.length ? `Skill bag: ${skills.join(", ")}.` : "",
    body.extraQuery ? `Extra focus: ${body.extraQuery}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2400,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    markdown: result.content,
    context: {
      symbols: holdingsResult.symbols,
      symbolSource: holdingsResult.source,
      roles,
      model,
    },
  });
}
