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
  const system = `You are Krishna's news scout. Triage search results into signal he can act on. Be CONCISE — he reads this on his phone.
${factsBlock ? `\n${factsBlock}\n` : ""}

Score each item 0-100 on personal impact:
  80+ 🔴 URGENT (his holding by name, visa policy, direct career impact)
  50-79 🟡 WATCH (sector move, related ticker, industry shift)
  20-49 🟢 CONTEXT (background, general market)
  <20 = skip entirely

HARD RULES:
- NEVER invent a URL — only ones from search results below
- NEVER invent facts about Krishna
- Keep each bullet to ONE line — no paragraph explanations
- Max 3 bullets per section, best only
- If nothing scores ≥20 in a section: "Nothing notable."

Output format:

## 📈 Stocks
🔴 92 **AAPL** — Earnings beat, raised guidance 12%. You hold 50 shares. [Source](url)
🟡 65 **AMD** — Sector rally, tech up 3% this week. [Source](url)

## 🤖 AI
🟡 70 **Claude Opus 4.8** — New workflow tools, relevant to your AI stack. [Source](url)

## 💼 Job Market
🟡 55 **SAP hiring up 15%** — S/4HANA demand rising, matches your background. [Source](url)

That's it. One line per item. Score + ticker/topic + what happened + why you care (short clause, not a sentence). Link at the end.`;

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
    maxTokens: 1600,
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
