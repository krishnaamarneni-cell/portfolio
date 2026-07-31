/**
 * Portfolio day-movement — "how did my net worth change today, which holdings
 * moved, and why".
 *
 * Holdings + market values come from the WealthClaude MCP (the same source as
 * the Finance page). Each holding's DAILY % change comes from Yahoo Finance —
 * so no daily-snapshot storage is needed; the market itself is the baseline.
 *
 * Efficiency by design: news is fetched ONLY for holdings that moved past the
 * threshold. A stock that barely moved never triggers a news lookup.
 */
import "server-only";
import { fetchPortfolioSnapshot } from "@/lib/agents";
import { search, whichSearchProvider } from "@/lib/search";

/** Default "meaningful move" threshold (%). Override with PORTFOLIO_MOVE_THRESHOLD. */
export const DEFAULT_MOVE_THRESHOLD = Number(process.env.PORTFOLIO_MOVE_THRESHOLD) || 2;

type ParsedHolding = { symbol: string; marketValue: number | null; shares: number | null };

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Robustly pull [{symbol, marketValue, shares}] out of the MCP holdings blob. */
export function parseHoldings(raw: unknown): ParsedHolding[] {
  const arrays: unknown[] = [];
  if (Array.isArray(raw)) arrays.push(raw);
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const k of ["holdings", "positions", "items", "data", "results"]) {
      if (Array.isArray(r[k])) arrays.push(r[k]);
    }
  }
  const out: ParsedHolding[] = [];
  const seen = new Set<string>();
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const h of arr) {
      if (!h || typeof h !== "object") continue;
      const o = h as Record<string, unknown>;
      const symbol = String(o.symbol ?? o.ticker ?? o.Symbol ?? "").trim();
      if (!symbol || seen.has(symbol.toUpperCase())) continue;
      seen.add(symbol.toUpperCase());
      out.push({
        symbol,
        marketValue: num(o.marketValue ?? o.market_value ?? o.value ?? o.marketVal ?? o.mv ?? o.currentValue),
        shares: num(o.shares ?? o.quantity ?? o.qty ?? o.units),
      });
    }
  }
  return out.slice(0, 60);
}

async function fetchDayChange(
  symbol: string
): Promise<{ price: number; prevClose: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    if (!prevClose) return null;
    return { price, prevClose, changePct: ((price - prevClose) / prevClose) * 100 };
  } catch {
    return null;
  }
}

export type MoverRow = {
  symbol: string;
  marketValue: number | null;
  changePct: number;
  dayChangeUsd: number | null;
  price: number;
};

export type PortfolioMovement = {
  available: boolean;
  reason?: string;
  holdingCount: number;
  pricedCount: number;
  totalMarketValue: number;
  dayChangeUsd: number;
  dayChangePct: number;
  threshold: number;
  movers: MoverRow[]; // sorted by absolute $ impact, biggest first
  quietCount: number; // holdings that moved but under threshold
};

/**
 * Compute today's portfolio movement. Deterministic — the % changes are real
 * market data, not an LLM guess.
 */
export async function computePortfolioMovement(
  threshold = DEFAULT_MOVE_THRESHOLD
): Promise<PortfolioMovement> {
  const empty = (reason: string): PortfolioMovement => ({
    available: false,
    reason,
    holdingCount: 0,
    pricedCount: 0,
    totalMarketValue: 0,
    dayChangeUsd: 0,
    dayChangePct: 0,
    threshold,
    movers: [],
    quietCount: 0,
  });

  const snap = await fetchPortfolioSnapshot().catch(() => null);
  if (!snap?.holdings) return empty("No WealthClaude connector / holdings available.");

  const holdings = parseHoldings(snap.holdings);
  if (holdings.length === 0) return empty("Couldn't parse any holdings from the connector.");

  // Fetch day-changes in bounded parallel batches (Yahoo is fine with this).
  const changes: Array<Awaited<ReturnType<typeof fetchDayChange>>> = [];
  const BATCH = 12;
  for (let i = 0; i < holdings.length; i += BATCH) {
    const slice = holdings.slice(i, i + BATCH);
    changes.push(...(await Promise.all(slice.map((h) => fetchDayChange(h.symbol)))));
  }

  const rows: MoverRow[] = [];
  let dayChangeUsd = 0;
  let totalMv = 0;
  let priced = 0;
  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    if (h.marketValue) totalMv += h.marketValue;
    const ch = changes[i];
    if (!ch) continue;
    priced++;
    // Currency-safe + exact: marketValue is today's value in USD, so today's $
    // change = marketValue * (price - prevClose) / price. (Using marketValue*pct
    // would overstate big movers and mixes currencies for the INR holdings.)
    const dollar =
      h.marketValue != null && ch.price > 0
        ? (h.marketValue * (ch.price - ch.prevClose)) / ch.price
        : null;
    if (dollar != null) dayChangeUsd += dollar;
    rows.push({
      symbol: h.symbol,
      marketValue: h.marketValue,
      changePct: ch.changePct,
      dayChangeUsd: dollar,
      price: ch.price,
    });
  }

  const movers = rows
    .filter((r) => Math.abs(r.changePct) >= threshold)
    .sort((a, b) => Math.abs(b.dayChangeUsd ?? 0) - Math.abs(a.dayChangeUsd ?? 0));

  return {
    available: true,
    holdingCount: holdings.length,
    pricedCount: priced,
    totalMarketValue: totalMv,
    dayChangeUsd,
    dayChangePct: totalMv > 0 ? (dayChangeUsd / totalMv) * 100 : 0,
    threshold,
    movers,
    quietCount: rows.length - movers.length,
  };
}

export type MoverNews = { symbol: string; headline: string; url: string | null };

/**
 * One explanatory headline per mover — fetched ONLY for the holdings that moved
 * past the threshold (the whole point: we don't news-check quiet stocks).
 */
export async function fetchMoverNews(movers: MoverRow[], max = 6): Promise<MoverNews[]> {
  if (!whichSearchProvider()) return [];
  const top = movers.slice(0, max);
  const results = await Promise.all(
    top.map(async (m) => {
      const dir = m.changePct >= 0 ? "up" : "down";
      const r = await search({
        query: `${m.symbol} stock ${dir} today why news`,
        maxResults: 2,
      }).catch(() => ({ query: "", hits: [] as Array<{ title: string; url: string }> }));
      const hit = r.hits[0];
      return hit
        ? { symbol: m.symbol, headline: hit.title, url: hit.url }
        : { symbol: m.symbol, headline: "", url: null };
    })
  );
  return results.filter((r) => r.headline);
}

/** Compact human summary of movement + why, for the morning brief / API. */
export function formatMovementBlock(m: PortfolioMovement, news: MoverNews[]): string {
  if (!m.available) return `Portfolio movement unavailable — ${m.reason ?? "no data"}.`;
  const money = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const newsBy = new Map(news.map((n) => [n.symbol, n]));

  const header = `Investments moved ${money(m.dayChangeUsd)} today (${m.dayChangePct >= 0 ? "+" : ""}${m.dayChangePct.toFixed(2)}%), across ${m.pricedCount} priced holdings.`;
  if (m.movers.length === 0) {
    return `${header}\nNo holding moved more than ${m.threshold}% today — nothing worth a news check.`;
  }
  const lines = m.movers.map((mv) => {
    const n = newsBy.get(mv.symbol);
    const why = n ? ` — ${n.headline}${n.url ? ` (${n.url})` : ""}` : "";
    return `- ${mv.symbol}: ${mv.changePct >= 0 ? "+" : ""}${mv.changePct.toFixed(1)}% (${money(mv.dayChangeUsd ?? 0)})${why}`;
  });
  return `${header}\nMoved more than ${m.threshold}%:\n${lines.join("\n")}`;
}
