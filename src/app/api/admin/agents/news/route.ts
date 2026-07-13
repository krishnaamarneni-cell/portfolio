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
import { curateToIdeas } from "@/lib/content-curator";

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
  const system = `You are Krishna's news scout. Summarise each item in 2-3 sentences — what happened, why it matters to him, what to do. Not just headlines.
${factsBlock ? `\n${factsBlock}\n` : ""}
Score 0-100: 80+ = 🔴 his holding/career directly. 50-79 = 🟡 related sector. 20-49 = 🟢 background. <20 = skip.

RULES:
- Only URLs from search results below — use markdown links like [Source](url), NEVER paste raw URLs.
- Max 3 items per section. Pick the highest-scoring only.
- If nothing ≥20 in a section: "Nothing notable."

FORMAT:

## 📈 Stocks
🔴 92 **AAPL** — Beat earnings by 12% and raised full-year guidance. iPhone revenue +8% on services growth. You hold this — consider trimming if it hits $200 target. [Source](url)

🟡 65 **AMD** — Tech sector best 2-month run since 2009; AI chip demand driving re-rating. Relevant to your AMD position. [Source](url)

## 🤖 AI
🟡 70 **Claude Opus 4.8** — Anthropic shipped Dynamic Workflows for coordinating sub-agents. Directly useful for your AI agent work. [Source](url)

## 💼 Job Market
🟡 55 **Cadana hiring** — Forward-deployed AI+HPC engineer role. Matches your SAP+AI crossover skills. [Source](url)

Each item = 2-3 sentences of real insight. Use [Source](url) markdown links — never raw URLs.`;

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
    maxTokens: 1500,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Talk to the Social Observer: judge today's news against Krishna's content
  // profile and auto-save the items that fit as post ideas. Best-effort — never
  // let curation break the news response.
  let ideasSaved = 0;
  try {
    const curated = await curateToIdeas({
      apiKey,
      source: "news",
      findings: result.content ?? "",
      model,
    });
    ideasSaved = curated.saved;
  } catch {
    // ignore — curation is a bonus
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
      ideasSaved,
    },
  });
}
