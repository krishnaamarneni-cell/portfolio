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
    return NextResponse.json({
      markdown: "## No results\n\nWeb search returned nothing. Try a more focused extra-query.",
      context: { symbols: holdingsResult.symbols, model: body.model },
    });
  }

  const system = `You are Krishna's news scout. You are given REAL web-search results below — actual URLs and snippets. Summarise them into three sections.

HARD RULES:
- NEVER invent a URL. Only use URLs that appear literally in the search results.
- NEVER invent a fact. Only paraphrase what's in the snippets.
- If a bucket has no relevant results, write exactly: \`Nothing notable in today's results.\` under its heading.

Output format:
## Stocks
- **<Ticker or company>** — <one-sentence takeaway from snippet> [Source](<exact URL>)

## AI Tools
- **<Tool / model name>** — <one-sentence takeaway from snippet> [Source](<exact URL>)

## Job Market
- **<Headline noun>** — <one-sentence takeaway from snippet> [Source](<exact URL>)

3-6 bullets per section. No emojis. No filler.`;

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
