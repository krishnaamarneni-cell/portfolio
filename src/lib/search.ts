/**
 * Web-search abstraction so agents can feed real URLs into the LLM
 * instead of letting it hallucinate citations.
 *
 * Provider preference order (first one configured wins, others kick in as
 * fallback if the primary throws or returns empty):
 *
 *   1. Tavily      — TAVILY_API_KEY  (free tier: 1000/mo, designed for agents)
 *   2. Brave       — BRAVE_API_KEY   (free tier: 2000/mo)
 *   3. SearXNG     — SEARXNG_URL     (your own self-hosted instance, free)
 *   4. DuckDuckGo  — (no env needed, always-on fallback, no API key)
 *
 * DuckDuckGo HTML is the floor — it works with zero setup. The chain above
 * gives you progressively higher quality if you opt in.
 */

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
};

export type SearchResult = {
  query: string;
  hits: SearchHit[];
  provider?: ProviderName;
};

export type ProviderName = "tavily" | "brave" | "searxng" | "duckduckgo";

const PROVIDER_CHAIN: ProviderName[] = [
  "tavily",
  "brave",
  "searxng",
  "duckduckgo",
];

function isProviderConfigured(p: ProviderName): boolean {
  if (p === "tavily") return !!process.env.TAVILY_API_KEY;
  if (p === "brave") return !!process.env.BRAVE_API_KEY;
  if (p === "searxng") return !!process.env.SEARXNG_URL;
  // DuckDuckGo is always available — no key needed.
  if (p === "duckduckgo") return true;
  return false;
}

/** First provider in the chain that's configured. */
export function whichSearchProvider(): ProviderName | null {
  for (const p of PROVIDER_CHAIN) {
    if (isProviderConfigured(p)) return p;
  }
  return null;
}

export function searchProviderHelp(): string {
  return (
    "All search providers failed. Options:\n" +
    "  • TAVILY_API_KEY (tavily.com, 1000 free/mo, best quality)\n" +
    "  • BRAVE_API_KEY  (api.search.brave.com, 2000 free/mo)\n" +
    "  • SEARXNG_URL    (your own SearXNG instance, free, self-host)\n" +
    "  • (none — DuckDuckGo fallback is always on by default)"
  );
}

/** Main entry point. Walks the provider chain until one returns hits. */
export async function search(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  depth?: "basic" | "advanced";
}): Promise<SearchResult> {
  const errors: string[] = [];
  for (const p of PROVIDER_CHAIN) {
    if (!isProviderConfigured(p)) continue;
    try {
      const r = await callProvider(p, opts);
      if (r.hits.length > 0) {
        return { ...r, provider: p };
      }
      errors.push(`${p}: empty`);
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  // All providers tried — return empty result so callers can render gracefully.
  return { query: opts.query, hits: [] };
}

async function callProvider(
  p: ProviderName,
  opts: { query: string; maxResults?: number; includeDomains?: string[]; depth?: "basic" | "advanced" }
): Promise<SearchResult> {
  if (p === "tavily") return tavilySearch(opts);
  if (p === "brave") return braveSearch(opts);
  if (p === "searxng") return searxngSearch(opts);
  return duckduckgoSearch(opts);
}

/* ─────────────────────────── Tavily ─────────────────────────── */

async function tavilySearch(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  depth?: "basic" | "advanced";
}): Promise<SearchResult> {
  const apiKey = process.env.TAVILY_API_KEY!;
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query: opts.query,
    search_depth: opts.depth ?? "basic",
    max_results: Math.min(10, opts.maxResults ?? 6),
    include_answer: false,
    include_raw_content: false,
  };
  if (opts.includeDomains && opts.includeDomains.length > 0) {
    body.include_domains = opts.includeDomains;
  }
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Tavily ${r.status}: ${text.slice(0, 200)}`);
  }
  const j = (await r.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };
  return {
    query: opts.query,
    hits: (j.results ?? [])
      .filter((x) => x.url)
      .map((x) => ({
        title: x.title ?? x.url ?? "(no title)",
        url: x.url!,
        snippet: (x.content ?? "").slice(0, 320),
        publishedAt: x.published_date,
      })),
  };
}

/* ─────────────────────────── Brave ─────────────────────────── */

async function braveSearch(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
}): Promise<SearchResult> {
  const apiKey = process.env.BRAVE_API_KEY!;
  const domainsClause = opts.includeDomains?.length
    ? ` ${opts.includeDomains.map((d) => `site:${d}`).join(" OR ")}`
    : "";
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", opts.query + domainsClause);
  url.searchParams.set("count", String(Math.min(10, opts.maxResults ?? 6)));
  url.searchParams.set("safesearch", "moderate");
  const r = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Brave ${r.status}: ${text.slice(0, 200)}`);
  }
  const j = (await r.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
  };
  return {
    query: opts.query,
    hits: (j.web?.results ?? [])
      .filter((x) => x.url)
      .map((x) => ({
        title: x.title ?? x.url ?? "(no title)",
        url: x.url!,
        snippet: (x.description ?? "").slice(0, 320),
        publishedAt: x.age,
      })),
  };
}

/* ─────────────────────────── SearXNG ─────────────────────────── */

/** Self-hosted SearXNG. Point SEARXNG_URL at the instance root (no trailing
 *  slash). Works against any SearXNG instance with JSON format enabled. */
async function searxngSearch(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
}): Promise<SearchResult> {
  const base = process.env.SEARXNG_URL!.replace(/\/$/, "");
  const url = new URL(`${base}/search`);
  const domainsClause = opts.includeDomains?.length
    ? ` ${opts.includeDomains.map((d) => `site:${d}`).join(" OR ")}`
    : "";
  url.searchParams.set("q", opts.query + domainsClause);
  url.searchParams.set("format", "json");
  url.searchParams.set("safesearch", "1");
  // The category hint helps the meta-search route the query to the right
  // upstream engines.
  url.searchParams.set("categories", "general,news");
  const r = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      // Some instances refuse requests without a UA.
      "User-Agent": "krishna-admin-agent/1.0",
    },
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`SearXNG ${r.status}: ${text.slice(0, 200)}`);
  }
  const j = (await r.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      publishedDate?: string;
      engine?: string;
    }>;
  };
  const max = Math.min(15, opts.maxResults ?? 6);
  return {
    query: opts.query,
    hits: (j.results ?? [])
      .filter((x) => x.url)
      .slice(0, max)
      .map((x) => ({
        title: x.title ?? x.url ?? "(no title)",
        url: x.url!,
        snippet: (x.content ?? "").slice(0, 320),
        publishedAt: x.publishedDate,
        source: x.engine,
      })),
  };
}

/* ─────────────────────────── DuckDuckGo ─────────────────────────── */

/** DuckDuckGo HTML scraper — no key, no setup, generous rate limits for
 *  personal-scale use. Parses the same HTML their lite/html endpoints emit.
 *  This is the bottom-of-chain fallback so the agents always have something. */
async function duckduckgoSearch(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
}): Promise<SearchResult> {
  const domainsClause = opts.includeDomains?.length
    ? ` ${opts.includeDomains.map((d) => `site:${d}`).join(" OR ")}`
    : "";
  const q = (opts.query + domainsClause).trim();
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", q);
  const r = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams({ q }),
    headers: {
      // DDG returns sparse/empty results without a real-looking UA.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error(`DDG ${r.status}`);
  }
  const html = await r.text();
  const hits = parseDuckDuckGoHtml(html, Math.min(10, opts.maxResults ?? 6));
  return { query: opts.query, hits };
}

/** Parse DDG's HTML result page. Defensive — DDG can tweak markup, so each
 *  field is extracted with its own loose regex and we degrade gracefully if
 *  one fails. */
function parseDuckDuckGoHtml(html: string, max: number): SearchHit[] {
  const out: SearchHit[] = [];
  // Each result block is wrapped in <div class="result ...">. We pluck the
  // title link, URL, and snippet from each.
  const blocks = html.split(/<div\s+class="result[^"]*"/i).slice(1);
  for (const raw of blocks) {
    if (out.length >= max) break;
    const block = raw.slice(0, 4000); // bound work per block
    const titleMatch = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(
      block
    );
    if (!titleMatch) continue;
    const rawUrl = decodeDdgUrl(titleMatch[1]);
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) continue;
    const title = stripHtml(titleMatch[2]);
    const snippetMatch = /<a[^>]+class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(
      block
    );
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
    out.push({ title, url: rawUrl, snippet: snippet.slice(0, 320) });
  }
  return out;
}

/** DDG wraps result hrefs in their own redirector:
 *  //duckduckgo.com/l/?uddg=<URLENCODED>&rut=... — pull the real URL out. */
function decodeDdgUrl(href: string): string {
  try {
    if (href.startsWith("//")) href = "https:" + href;
    const u = new URL(href);
    const real = u.searchParams.get("uddg");
    if (real) return decodeURIComponent(real);
    // Some DDG variants already return the raw URL.
    return href;
  } catch {
    return href;
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* ─────────────────────────── Helpers ─────────────────────────── */

/** Format a list of SearchResult into a compact, model-friendly block. */
export function searchResultsToContext(results: SearchResult[]): string {
  const parts: string[] = [];
  for (const r of results) {
    parts.push(`### Query: ${r.query}${r.provider ? ` (via ${r.provider})` : ""}`);
    if (r.hits.length === 0) {
      parts.push("(no results)\n");
      continue;
    }
    for (const h of r.hits) {
      parts.push(
        `- [${h.title}](${h.url})${h.publishedAt ? ` · ${h.publishedAt}` : ""}\n  ${h.snippet.replace(/\n+/g, " ")}`
      );
    }
    parts.push("");
  }
  return parts.join("\n");
}
