import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchHoldingSymbols, resolveAgentModel, runAgent } from "@/lib/agents";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  searchProviderHelp,
  type SearchResult,
} from "@/lib/search";
import { buildFactsContext } from "@/lib/facts";
import {
  fetchManyFeeds,
  FINANCE_FEEDS,
  fetchTickerNews,
  rssItemsToSearchResult,
} from "@/lib/rss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Atlas Opportunities — the v2 upgrade of Lucy's daily opportunity scout.
 *
 * Inputs:
 *   - Krishna's portfolio holdings (via any MCP connector that exposes
 *     get_holdings, falls back to broad market if absent)
 *   - His facts table (sectors he's heavy in, risks he tracks)
 *
 * Process:
 *   1. Identify sector gaps in current portfolio.
 *   2. Run targeted web search per sector gap + "Buffett-style candidates".
 *   3. Hand the LLM real search results + facts + holdings.
 *   4. The LLM scores each candidate on a 0-100 Buffett scale:
 *        Moat 30 + Management 20 + Financials 25 + Valuation 25
 *      and tiers them: 🟢 HIGH (80+) · 🟡 WATCH (60-79) · ⚪ MAYBE (<60).
 *   5. Returns one report with three sections:
 *        🟢 HIGH potential  |  🟡 Watchlist  |  📊 Portfolio gaps
 */

type Body = { model?: string };

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }
  if (!whichSearchProvider()) {
    return NextResponse.json({ error: searchProviderHelp() }, { status: 503 });
  }
  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  const [{ symbols }, factsBlock] = await Promise.all([
    fetchHoldingSymbols(),
    buildFactsContext(),
  ]);

  // ── Strategy: Lucy's Atlas didn't search the web — it polled Yahoo Finance
  //    RSS feeds (per-ticker + general business) and let the LLM filter for
  //    opportunities. Web search APIs get rate-limited or 403'd from Vercel's
  //    IPs; RSS doesn't.
  //
  //    We fan out across:
  //      1. Yahoo Finance per-ticker RSS for the user's top holdings —
  //         direct signal about names he already owns
  //      2. General finance RSS bundle (Yahoo / MarketWatch / CNBC /
  //         Investing.com / SeekingAlpha / AP Business) — for cross-asset
  //         opportunities and sector rotation
  //
  //    If a search provider key IS set, we ALSO run targeted queries in
  //    parallel as a bonus — Tavily/Brave hits give us editorial picks
  //    (Buffett-style screens). ──
  const tickerNewsPromise = fetchTickerNews(symbols);
  const generalNewsPromise = fetchManyFeeds(FINANCE_FEEDS.slice(0, 4));

  const searchQueries =
    whichSearchProvider() && whichSearchProvider() !== "rss"
      ? [
          "best dividend aristocrat stocks Buffett moat 2025",
          "undervalued large cap stocks high free cash flow",
          "sector rotation healthcare financial 2025",
        ]
      : [];
  const searchPromises = searchQueries.map((q) =>
    search({ query: q, maxResults: 5 }).catch(
      (err): SearchResult => ({
        query: q,
        hits: [],
        providerErrors: [
          err instanceof Error ? err.message.slice(0, 120) : "failed",
        ],
      })
    )
  );

  const [tickerNews, generalNews, ...editorialResults] = await Promise.all([
    tickerNewsPromise,
    generalNewsPromise,
    ...searchPromises,
  ]);

  // Convert RSS lists into SearchResult shape so the existing context
  // formatter works.
  const tickerResult = rssItemsToSearchResult(
    `Per-ticker headlines (${symbols.length} holdings)`,
    tickerNews.slice(0, 24)
  );
  const generalResult = rssItemsToSearchResult(
    "General business / market news",
    generalNews.slice(0, 12)
  );

  let searchResults: SearchResult[] = [tickerResult, generalResult, ...editorialResults];
  searchResults = searchResults.map((r) => ({
    ...r,
    hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
  }));

  const totalHits = searchResults.reduce((n, r) => n + r.hits.length, 0);
  if (totalHits === 0) {
    // Surface the actual per-provider failures so you don't waste a refresh
    // wondering whether to add a search key.
    const allErrors = searchResults.flatMap((r) => r.providerErrors ?? []);
    const distinct = Array.from(new Set(allErrors));
    const provider = whichSearchProvider();
    const setupHint = provider
      ? `Active provider: ${provider}. If you're hitting quota, set a different key in env (TAVILY_API_KEY / BRAVE_API_KEY / SEARXNG_URL).`
      : "No search provider configured. Set TAVILY_API_KEY (free 1000/mo at tavily.com) or BRAVE_API_KEY (free 2000/mo) in Vercel env, then redeploy.";
    return NextResponse.json({
      markdown: `## ⚠️ Search chain returned 0 hits across all queries\n\n${setupHint}\n\n**Per-query attempts:**\n${distinct.map((e) => `- ${e}`).join("\n") || "- (no error details captured)"}\n\nVisit \`/api/admin/search/probe?q=test\` to probe each provider individually.`,
      context: { symbols, model: body.model, providerErrors: distinct },
    });
  }

  const system = `You are Atlas. Phone-screen format. Krishna already holds: ${symbols.length > 0 ? symbols.join(", ") : "(unknown)"}.
${factsBlock ? `\n${factsBlock}\n` : ""}
Pick stocks from the search results that Krishna does NOT already own. Score: Moat/30 + Mgmt/20 + Fin/25 + Val/25.

RULES:
- Only use URLs from search results. Never invent a URL or ticker not in the results.
- Max 5 picks total. Only include if the snippet has real news (earnings, upgrade, catalyst). Dividend declarations alone are NOT enough.
- Skip anything that is just a Form 6K filing, a generic dividend, or a company Krishna already holds.

FORBIDDEN — do NOT write any of these:
- "provides a unique exposure to X sector, diversifying Krishna's portfolio" — BANNED phrase
- "offering a stable income stream" — BANNED phrase
- "considering its recent..." — BANNED phrase
- Any sentence with "diversifying" or "stable income stream"
- Entry triggers you made up (no inventing price targets)

FORMAT — copy this exactly:

## 🟢 HIGH (80+)
🟢 84 **COST** — Same-store sales +9.8%, moat intact. [25/18/22/19] Buy below $520. [Link](url)

## 🟡 WATCH (60-79)
🟡 72 **HPE** — AI server revenue +18% YoY. [20/15/20/17] Wait for earnings dip. [Link](url)

## 📊 Gaps
- **Healthcare** — No holdings. Consider JNJ or ABT.
- **Utilities** — Underweight. NEE or DUK.

Each pick = ONE line. The [25/18/22/19] = Moat/Mgmt/Fin/Val scores. No multi-line entries. No paragraphs. No filler sentences.`;

  const userPrompt = `Holdings: ${symbols.join(", ") || "(none on file)"}

Live web-search results:
${searchResultsToContext(searchResults)}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 1200,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    markdown: result.content,
    context: {
      symbols,
      symbolCount: symbols.length,
      tickerNewsItems: tickerNews.length,
      generalNewsItems: generalNews.length,
      editorialSearchQueries: searchQueries,
      provider: whichSearchProvider(),
      model: result.modelUsed ?? model,
      modelRequested: model,
    },
  });
}
