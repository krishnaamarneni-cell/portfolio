import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import {
  fetchHoldingSymbols,
  resolveAgentModel,
  runAgent,
} from "@/lib/agents";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  searchProviderHelp,
  type SearchResult,
} from "@/lib/search";
import { buildFactsContext } from "@/lib/facts";

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
  if (!whichSearchProvider()) {
    return NextResponse.json({ error: searchProviderHelp() }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

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

  // Build 3 focused queries — one per bucket the user cares about.
  const tickersClause = holdingsResult.symbols.length
    ? holdingsResult.symbols.slice(0, 8).join(" OR ")
    : "(major US tickers)";
  const baseQueries = [
    `${tickersClause} stock news this week`,
    `AI tools models agents released this week`,
    `tech job market hiring layoffs SAP AI engineer trends`,
  ];
  if (body.extraQuery) baseQueries.push(body.extraQuery);

  let searchResults: SearchResult[] = [];
  try {
    searchResults = await Promise.all(
      baseQueries.map((q) =>
        search({ query: q, maxResults: 6 }).catch(
          (err): SearchResult => ({
            query: q,
            hits: [
              {
                title: "Search failed",
                url: "",
                snippet: err instanceof Error ? err.message : String(err),
              },
            ],
          })
        )
      )
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 }
    );
  }
  searchResults = searchResults.map((r) => ({
    ...r,
    hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
  }));

  const totalHits = searchResults.reduce((n, r) => n + r.hits.length, 0);
  if (totalHits === 0) {
    const allErrors = searchResults.flatMap((r) => r.providerErrors ?? []);
    const distinct = Array.from(new Set(allErrors));
    return NextResponse.json({
      markdown: `## ⚠️ Search chain returned 0 hits\n\n**Per-query attempts:**\n${distinct.map((e) => `- ${e}`).join("\n") || "- (no error details captured)"}\n\nProbe each provider at \`/api/admin/search/probe?q=test\`.`,
      context: {
        symbols: holdingsResult.symbols,
        model: body.model,
        providerErrors: distinct,
      },
    });
  }

  const factsBlock = await buildFactsContext();
  // Atlas-style scoring borrowed from Krishna's Lucy vault — each item gets
  // an impact score 0-100, a tier badge, and an explicit "why this matters
  // to YOU" sentence tied to his facts (portfolio, visa, career).
  const system = `You are Krishna's news scout. You are given REAL web-search results below — actual URLs and snippets. Your job is to triage them into actionable signal, NOT just summarise.
${factsBlock ? `\n${factsBlock}\n` : ""}

For EACH item you surface, you must:
1. Score its personal impact to Krishna on a 0-100 scale.
   - 80-100 = act today (e.g., holding mentioned by name in earnings, visa policy directly affecting his status, SAP-market shift)
   - 50-79 = watch this week (sector move, Fed signal, related ticker)
   - 20-49 = background context (general market, industry chatter)
   - 0-19 = skip — don't surface
2. Tag it with a tier badge:
   - 🔴 URGENT  for 80+
   - 🟡 WATCH   for 50-79
   - 🟢 CONTEXT for 20-49
3. Write a "why this matters to YOU" sentence using a SPECIFIC fact from his profile (his ticker, his employer client, his visa stage, etc.). Generic statements like "this affects the market" do NOT count.

Group items under three section headings (Stocks · AI · Job Market). Within each, sort by score descending. If a section has nothing ≥20 score, write exactly: \`Nothing scoring above the bar.\`

HARD RULES:
- NEVER invent a URL. Only use URLs that appear literally in the search results.
- NEVER invent a fact about Krishna or the news item.
- If a holding is mentioned but no specific impact is in the snippet, still call that out as 🟡 WATCH 50 with reasoning "name appears but no detail".

Output format (Markdown):

## 📈 Stocks
- **🔴 URGENT 87** · **NKE** — <one-sentence takeaway>
  ↳ <why this matters to YOU — cite a fact>
  [Source](<URL>)

## 🤖 AI
(same shape)

## 💼 Job Market
(same shape)

3-6 bullets per section. No filler.`;

  const symbolsLine = holdingsResult.symbols.length
    ? `Krishna's tickers: ${holdingsResult.symbols.join(", ")}.`
    : "Krishna's holdings aren't available — use broad US market context.";

  const userPrompt = [
    symbolsLine,
    roles.length ? `Recent roles: ${roles.join("; ")}.` : "",
    skills.length ? `Skill bag: ${skills.join(", ")}.` : "",
    body.extraQuery ? `Extra focus: ${body.extraQuery}` : "",
    "",
    "Web-search results:",
    searchResultsToContext(searchResults),
  ]
    .filter(Boolean)
    .join("\n");

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    // We already searched — no need for compound's tool loop.
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2600,
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
      model: result.modelUsed ?? model,
      modelRequested: model,
      provider: whichSearchProvider(),
    },
  });
}
