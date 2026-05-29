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

  // ── Search bundles: each bundle = one query asking for Buffett-style picks
  //    in a category Krishna's portfolio is light on. ──
  const queries = [
    "best dividend aristocrat stocks Buffett moat 2025",
    "undervalued large cap stocks high free cash flow 2025",
    "healthcare stocks reasonable PE strong moat 2025",
    "financial sector stocks Buffett style 2025",
    symbols.length
      ? `${symbols.slice(0, 5).join(" OR ")} earnings sentiment analyst this week`
      : "S&P 500 earnings this week",
  ];

  let searchResults: SearchResult[] = [];
  try {
    searchResults = await Promise.all(
      queries.map((q) =>
        search({ query: q, maxResults: 5 }).catch(
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

  const system = `You are Atlas — Krishna's portfolio opportunity scout. You scan the market for stocks that:
  1. Meet Buffett-style criteria (durable moat, predictable business, owner-earnings yield ≥ 5%, conservative debt)
  2. Fill GAPS in his current sector exposure
  3. Trade near or below estimated intrinsic value
${factsBlock ? `\n${factsBlock}\n` : ""}
You are given REAL web-search results below — actual URLs and snippets from finance news. Use them as your information source.

Krishna's CURRENT holdings: ${symbols.length > 0 ? symbols.join(", ") : "(unknown — search broad market)"}.

For EACH candidate, output:
- A Buffett Score 0-100 with this breakdown:
  · Moat        /30  (durability of competitive advantage)
  · Management  /20  (capital allocation, track record)
  · Financials  /25  (margins, ROE, debt, cash flow)
  · Valuation   /25  (P/E, P/FCF, intrinsic value gap)
- A tier badge:
  🟢 HIGH    (80+)
  🟡 WATCH   (60-79)
  ⚪ MAYBE   (<60)
- Why Krishna's portfolio needs this (sector gap, concentration risk, hedge)
- Entry trigger (specific price target or news catalyst from the snippets)

After the candidates, write a "📊 Portfolio gaps" section listing the 2-3 sectors Krishna is most under-exposed to with one-sentence recommendations.

HARD RULES:
- NEVER invent a URL. Only use URLs that appear literally in the search results.
- NEVER invent financials. If a snippet doesn't carry a number, mark it as "estimated by analyst consensus" and cite the source.
- Don't recommend a ticker Krishna already holds unless it deserves topping-up — call that out explicitly.
- Cap at 8 candidates total: 3 HIGH + 5 WATCH/MAYBE.
- No filler. No "hope this helps".

Output format (Markdown):

## 🟢 HIGH potential
- **🟢 HIGH 84** · **TICKER** — one-line thesis
  Buffett breakdown: Moat 26/30 · Mgmt 16/20 · Fin 22/25 · Val 20/25
  ↳ portfolio fit: <sector gap or concentration reason>
  ↳ entry trigger: <price target or catalyst>
  [Source](url)

## 🟡 Watchlist
(same shape, sorted by score desc)

## 📊 Portfolio gaps
- **<Sector>** — <one sentence>`;

  const userPrompt = `Holdings: ${symbols.join(", ") || "(none on file)"}

Live web-search results:
${searchResultsToContext(searchResults)}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 3200,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    markdown: result.content,
    context: {
      symbols,
      symbolCount: symbols.length,
      queries,
      provider: whichSearchProvider(),
      model: result.modelUsed ?? model,
      modelRequested: model,
    },
  });
}
