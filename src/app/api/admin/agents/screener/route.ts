import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchHoldingSymbols, resolveAgentModel, runAgent } from "@/lib/agents";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  type SearchResult,
} from "@/lib/search";
import {
  fetchManyFeeds,
  FINANCE_FEEDS,
  fetchTickerNews,
  rssItemsToSearchResult,
} from "@/lib/rss";
import { buildFactsContext } from "@/lib/facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  model?: string;
  /** Risk tolerance 1-10. 1 = ultra-conservative, 10 = aggressive. */
  risk?: number;
  /** Optional sector focus e.g. "tech", "healthcare", "energy". */
  sector?: string;
  /** Optional budget range e.g. "$5000", "$10k-50k". */
  budget?: string;
};

/** Risk-level to investment style mapping. */
const RISK_PROFILES: Record<number, { label: string; style: string; queries: string[] }> = {
  1: {
    label: "Ultra Conservative",
    style: "Treasury bonds, money market, FDIC-insured CDs. Capital preservation only.",
    queries: ["best treasury bond ETF 2025", "high yield savings account rates 2025", "safest investment options capital preservation"],
  },
  2: {
    label: "Very Conservative",
    style: "Investment-grade bonds, dividend aristocrats (25+ years), utilities. Yield over growth.",
    queries: ["best dividend aristocrat stocks 2025", "investment grade bond ETF top rated", "utility stocks stable dividend"],
  },
  3: {
    label: "Conservative",
    style: "Blue-chip dividend stocks, bond-heavy balanced funds, REITs. Steady income with mild growth.",
    queries: ["blue chip dividend stocks buy 2025", "best balanced fund conservative", "REIT high dividend safe"],
  },
  4: {
    label: "Moderately Conservative",
    style: "Large-cap value stocks, dividend growth funds, some corporate bonds. Growth with income.",
    queries: ["large cap value stocks undervalued 2025", "best dividend growth ETF", "corporate bond fund top rated"],
  },
  5: {
    label: "Moderate",
    style: "Mix of growth and value large-caps, index funds, some mid-caps. Classic 60/40 mindset.",
    queries: ["best S&P 500 stocks to buy now", "top mid cap growth stocks 2025", "best index fund for moderate risk"],
  },
  6: {
    label: "Moderate Growth",
    style: "Growth-tilted large-caps, sector ETFs, some international. Above-average returns target.",
    queries: ["best growth stocks to buy 2025", "top performing sector ETF", "international growth stocks undervalued"],
  },
  7: {
    label: "Growth",
    style: "Growth stocks, tech leaders, emerging sectors (AI, clean energy). Accept 20-30% drawdowns.",
    queries: ["best AI stocks to buy now", "top growth stocks high return 2025", "clean energy stocks growth"],
  },
  8: {
    label: "Aggressive Growth",
    style: "High-growth small/mid-caps, IPOs, concentrated tech bets. Accept 40%+ drawdowns for high return.",
    queries: ["best small cap growth stocks 2025", "high growth tech stocks small cap", "IPO stocks best performing 2025"],
  },
  9: {
    label: "Very Aggressive",
    style: "Speculative growth, crypto-adjacent, biotech, pre-revenue companies. Moonshot territory.",
    queries: ["best speculative stocks high growth 2025", "biotech stocks breakthrough potential", "crypto related stocks high return"],
  },
  10: {
    label: "Maximum Risk",
    style: "Penny stocks, options plays, leveraged ETFs, meme stocks, crypto. All-or-nothing bets.",
    queries: ["best penny stocks to buy 2025", "leveraged ETF highest return", "meme stocks high potential 2025"],
  },
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  const risk = Math.max(1, Math.min(10, body.risk ?? 5));
  const riskProfile = RISK_PROFILES[risk];
  const sector = (body.sector ?? "").trim();

  // Get current holdings to avoid recommending what they already own.
  const [{ symbols }, factsBlock] = await Promise.all([
    fetchHoldingSymbols(),
    buildFactsContext(),
  ]);

  // Build search queries — profile-specific + optional sector focus.
  let queries = [...riskProfile.queries];
  if (sector) {
    queries.push(`best ${sector} stocks ${riskProfile.label.toLowerCase()} risk 2025`);
    queries.push(`${sector} sector top picks buy now`);
  }
  queries = queries.slice(0, 5);

  // Fan out: RSS feeds + web search in parallel.
  const generalNewsPromise = fetchManyFeeds(FINANCE_FEEDS.slice(0, 3));

  const searchPromises = whichSearchProvider()
    ? queries.map((q) =>
        search({ query: q, maxResults: 6 }).catch(
          (): SearchResult => ({ query: q, hits: [] })
        )
      )
    : [];

  const [generalNews, ...webResults] = await Promise.all([
    generalNewsPromise,
    ...searchPromises,
  ]);

  const generalResult = rssItemsToSearchResult(
    "Market news",
    generalNews.slice(0, 10)
  );

  let searchResults: SearchResult[] = [generalResult, ...webResults];
  searchResults = searchResults.map((r) => ({
    ...r,
    hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
  }));

  const totalHits = searchResults.reduce((n, r) => n + r.hits.length, 0);
  if (totalHits === 0) {
    return NextResponse.json({
      markdown: "## No results\n\nSearch returned 0 hits. Try a different risk level or add a sector focus.",
      context: { risk, riskLabel: riskProfile.label, sector },
    });
  }

  const searchBlock = searchResultsToContext(searchResults);

  const system = `You are Krishna's stock screener agent. Find investment opportunities matching a specific risk profile.
${factsBlock ? `\n${factsBlock}\n` : ""}

RISK LEVEL: ${risk}/10 — ${riskProfile.label}
INVESTMENT STYLE: ${riskProfile.style}
${sector ? `SECTOR FOCUS: ${sector}` : "NO SECTOR FILTER — scan all sectors"}

Krishna already owns: ${symbols.length > 0 ? symbols.join(", ") : "(unknown)"}
${body.budget ? `BUDGET: ${body.budget}` : ""}

YOUR JOB: Find 5-8 stocks from the search results that match this EXACT risk level. Not higher, not lower.

For each pick, provide:
- WHY it matches the ${riskProfile.label} risk profile (cite a specific metric or characteristic)
- Current opportunity (what the snippet says — earnings, momentum, valuation)
- Risk factor (the one thing that could go wrong)

RULES:
- Only use URLs from search results below — never invent
- Skip tickers Krishna already owns
- Be honest about risk — a risk-5 pick should NOT include speculative biotech
- Each pick = 3 lines max

FORMAT:

## ${riskProfile.label} Picks (Risk ${risk}/10)

**AAPL** — Apple Inc. $185
Why: Mega-cap with $90B cash, 1.5% beta — textbook moderate risk. AI services revenue growing 15% YoY.
Risk: China sales exposure (18% of revenue). [Link](url)

**VTI** — Vanguard Total Market ETF $245
Why: Instant diversification across 4000+ stocks, 0.03% expense ratio.
Risk: Full market drawdown exposure. [Link](url)

## Sectors to Watch
- **Healthcare** — defensive + aging population tailwind
- **AI Infrastructure** — picks-and-shovels play on AI boom

Max 8 picks. Quality over quantity. End with 2-3 sector recommendations.`;

  const userPrompt = `Risk: ${risk}/10 (${riskProfile.label})
Style: ${riskProfile.style}
${sector ? `Sector focus: ${sector}` : "All sectors"}
${body.budget ? `Budget: ${body.budget}` : ""}
Current holdings: ${symbols.join(", ") || "(none)"}

Search results:
${searchBlock}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2200,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    markdown: result.content,
    context: {
      risk,
      riskLabel: riskProfile.label,
      sector: sector || null,
      budget: body.budget || null,
      symbols: symbols.length,
      totalHits,
      model: result.modelUsed ?? model,
      modelRequested: model,
      provider: whichSearchProvider(),
    },
  });
}
