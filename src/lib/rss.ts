/**
 * RSS aggregator — Lucy's secret sauce. Web search APIs (Tavily/Brave/DDG)
 * get rate-limited or IP-blocked when called from a serverless function.
 * RSS feeds don't care: they're cacheable, public, designed to be polled.
 *
 * Used by:
 *   - Atlas Opportunities (general business/finance feeds)
 *   - News scout (per-ticker Yahoo Finance feed for each holding)
 *
 * Zero deps — a tight regex parser handles the subset of RSS that matters
 * (title, link, description, pubDate, source).
 */

import type { SearchHit, SearchResult } from "./search";

/* ─────────────────────────── Feed catalogues ─────────────────────────── */

/** Broad business + market feeds. Order = priority. */
export const FINANCE_FEEDS: Array<{ url: string; source: string }> = [
  // Yahoo Finance news index — covers earnings, M&A, analyst calls
  { url: "https://finance.yahoo.com/news/rssindex", source: "yahoo_finance" },
  // MarketWatch top stories
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "marketwatch" },
  // CNBC top news
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", source: "cnbc" },
  // Investing.com news
  { url: "https://www.investing.com/rss/news.rss", source: "investing_com" },
  // SeekingAlpha market currents (often opinion but useful for analyst-vs-headline)
  { url: "https://seekingalpha.com/market_currents.xml", source: "seekingalpha" },
  // AP Business — fast wire copy
  { url: "https://feeds.apnews.com/rss/apf-business", source: "ap_business" },
];

/** AI / tech feeds — for the AI Tools section of the News scout. */
export const TECH_FEEDS: Array<{ url: string; source: string }> = [
  { url: "https://news.ycombinator.com/rss", source: "hackernews" },
  { url: "https://www.theverge.com/rss/index.xml", source: "the_verge" },
  { url: "https://techcrunch.com/feed/", source: "techcrunch" },
];

/** Yahoo Finance per-ticker headlines — the most reliable per-stock signal. */
export function yahooTickerFeedUrl(ticker: string): string {
  // Strip exchange suffix (e.g. RELIANCE.NS) — Yahoo uses base symbols here.
  const clean = ticker.split(".")[0].toUpperCase();
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(clean)}&region=US&lang=en-US`;
}

/* ─────────────────────────── Fetch + parse ─────────────────────────── */

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
};

/** Fetch one feed and return its items. Defensive — bad XML, slow servers, or
 *  403/rate-limit responses return [] instead of throwing. */
export async function fetchRssFeed(
  url: string,
  source: string,
  timeoutMs: number = 7000
): Promise<RssItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // Some publishers reject the default Vercel/Node UA. A real browser
        // UA gets us through nearly everywhere.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRss(xml, source);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Minimal RSS / Atom parser. Handles <item> (RSS 2.0) and <entry> (Atom). */
export function parseRss(xml: string, source: string): RssItem[] {
  const items: RssItem[] = [];
  // RSS 2.0
  const itemRx = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRx.exec(xml))) {
    const block = m[1];
    items.push({
      title: stripTags(pick(block, /<title\b[^>]*>([\s\S]*?)<\/title>/i) || ""),
      link: cleanLink(
        pick(block, /<link\b[^>]*>([\s\S]*?)<\/link>/i) ||
          pick(block, /<link[^>]+href="([^"]+)"/i) ||
          ""
      ),
      description: stripTags(
        pick(block, /<description\b[^>]*>([\s\S]*?)<\/description>/i) ||
          pick(block, /<summary\b[^>]*>([\s\S]*?)<\/summary>/i) ||
          ""
      ).slice(0, 320),
      pubDate:
        pick(block, /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i) ||
        pick(block, /<published\b[^>]*>([\s\S]*?)<\/published>/i) ||
        pick(block, /<updated\b[^>]*>([\s\S]*?)<\/updated>/i) ||
        "",
      source,
    });
  }
  // Atom
  if (items.length === 0) {
    const entryRx = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRx.exec(xml))) {
      const block = m[1];
      items.push({
        title: stripTags(pick(block, /<title\b[^>]*>([\s\S]*?)<\/title>/i) || ""),
        link: cleanLink(
          pick(block, /<link[^>]+href="([^"]+)"/i) || ""
        ),
        description: stripTags(
          pick(block, /<summary\b[^>]*>([\s\S]*?)<\/summary>/i) ||
            pick(block, /<content\b[^>]*>([\s\S]*?)<\/content>/i) ||
            ""
        ).slice(0, 320),
        pubDate:
          pick(block, /<published\b[^>]*>([\s\S]*?)<\/published>/i) ||
          pick(block, /<updated\b[^>]*>([\s\S]*?)<\/updated>/i) ||
          "",
        source,
      });
    }
  }
  return items.filter((i) => i.title && /^https?:\/\//i.test(i.link));
}

function pick(s: string, rx: RegExp): string | undefined {
  const m = rx.exec(s);
  return m ? m[1].trim() : undefined;
}
function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function cleanLink(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/* ─────────────────────────── Aggregators ─────────────────────────── */

/** Fetch a bundle of feeds in parallel and return their items merged + sorted. */
export async function fetchManyFeeds(
  feeds: Array<{ url: string; source: string }>
): Promise<RssItem[]> {
  const lists = await Promise.all(feeds.map((f) => fetchRssFeed(f.url, f.source)));
  const merged = lists.flat();
  merged.sort((a, b) => {
    const ta = Date.parse(a.pubDate) || 0;
    const tb = Date.parse(b.pubDate) || 0;
    return tb - ta;
  });
  return merged;
}

/** Per-ticker Yahoo Finance feed — fans out across all holdings in parallel. */
export async function fetchTickerNews(tickers: string[]): Promise<RssItem[]> {
  if (tickers.length === 0) return [];
  const feeds = tickers.slice(0, 15).map((t) => ({
    url: yahooTickerFeedUrl(t),
    source: `yahoo_${t.toUpperCase()}`,
  }));
  return fetchManyFeeds(feeds);
}

/* ─────────────────────────── Keyword filter ─────────────────────────── */

/** Score an item against query keywords. Used by the search.ts integration to
 *  decide which RSS items to surface for an arbitrary query. */
export function filterByQuery(items: RssItem[], query: string, limit: number = 8): RssItem[] {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (terms.length === 0) return items.slice(0, limit);
  const scored = items.map((it) => {
    const hay = (it.title + " " + it.description).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 1;
    }
    return { it, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.it);
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "you",
  "your",
  "have",
  "has",
  "was",
  "were",
  "but",
  "not",
  "any",
  "all",
  "can",
  "now",
  "out",
  "use",
  "best",
  "today",
  "week",
  "year",
  "2024",
  "2025",
  "2026",
]);

/** Promote RssItem list to SearchResult shape so it can drop into the existing
 *  agent pipelines. */
export function rssItemsToSearchResult(query: string, items: RssItem[]): SearchResult {
  const hits: SearchHit[] = items.map((it) => ({
    title: it.title,
    url: it.link,
    snippet: it.description,
    publishedAt: it.pubDate || undefined,
    source: it.source,
  }));
  return { query, hits, provider: "rss" };
}
