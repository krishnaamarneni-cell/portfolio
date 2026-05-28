/**
 * Tiny web-search abstraction so agents can feed real URLs into the LLM
 * instead of letting it hallucinate citations.
 *
 * Provider preference order:
 *   1. Tavily   — TAVILY_API_KEY  (free tier: 1000/mo, designed for agents)
 *   2. Brave    — BRAVE_API_KEY   (free tier: 2000/mo)
 *
 * If neither is set, search() throws with setup instructions.
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
};

export function whichSearchProvider(): "tavily" | "brave" | null {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_API_KEY) return "brave";
  return null;
}

export function searchProviderHelp(): string {
  return (
    "No web-search provider configured. Add ONE of:\n" +
    "  • TAVILY_API_KEY (sign up at tavily.com, 1000 free searches/month)\n" +
    "  • BRAVE_API_KEY  (sign up at api.search.brave.com, 2000 free searches/month)\n" +
    "to your Vercel env, then redeploy."
  );
}

export async function search(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  /** "basic" is fast and cheap; "advanced" reads more pages — agent uses basic. */
  depth?: "basic" | "advanced";
}): Promise<SearchResult> {
  const provider = whichSearchProvider();
  if (!provider) throw new Error(searchProviderHelp());
  if (provider === "tavily") return tavilySearch(opts);
  return braveSearch(opts);
}

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

async function braveSearch(opts: {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
}): Promise<SearchResult> {
  const apiKey = process.env.BRAVE_API_KEY!;
  // Brave doesn't support include_domains directly — bolt it onto the query.
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

/** Format a list of SearchResult into a compact, model-friendly block. */
export function searchResultsToContext(results: SearchResult[]): string {
  const parts: string[] = [];
  for (const r of results) {
    parts.push(`### Query: ${r.query}`);
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
