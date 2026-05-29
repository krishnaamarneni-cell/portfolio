import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/search/probe?q=fed+rate+decision
 *
 * Smoke-tests each search provider with the same query and returns a per-
 * provider status object. Use when an agent says "0 hits across all queries"
 * and you want to know whether Tavily/Brave keys are missing, DuckDuckGo is
 * broken, or every provider is actually returning empty.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "OpenAI news today";

  type ProbeResult = {
    provider: string;
    configured: boolean;
    ok?: boolean;
    hitCount?: number;
    firstUrl?: string;
    error?: string;
    ms?: number;
  };
  const probes: ProbeResult[] = [];

  // Tavily
  {
    const configured = !!process.env.TAVILY_API_KEY;
    const probe: ProbeResult = { provider: "tavily", configured };
    if (configured) {
      const t0 = Date.now();
      try {
        const r = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: q,
            search_depth: "basic",
            max_results: 3,
          }),
        });
        probe.ms = Date.now() - t0;
        probe.ok = r.ok;
        if (r.ok) {
          const j = (await r.json()) as { results?: Array<{ url?: string }> };
          probe.hitCount = j.results?.length ?? 0;
          probe.firstUrl = j.results?.[0]?.url;
        } else {
          const text = await r.text().catch(() => "");
          probe.error = `${r.status}: ${text.slice(0, 200)}`;
        }
      } catch (err) {
        probe.error = err instanceof Error ? err.message : "failed";
      }
    }
    probes.push(probe);
  }

  // Brave
  {
    const configured = !!process.env.BRAVE_API_KEY;
    const probe: ProbeResult = { provider: "brave", configured };
    if (configured) {
      const t0 = Date.now();
      try {
        const u = new URL("https://api.search.brave.com/res/v1/web/search");
        u.searchParams.set("q", q);
        u.searchParams.set("count", "3");
        const r = await fetch(u.toString(), {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": process.env.BRAVE_API_KEY!,
          },
        });
        probe.ms = Date.now() - t0;
        probe.ok = r.ok;
        if (r.ok) {
          const j = (await r.json()) as {
            web?: { results?: Array<{ url?: string }> };
          };
          probe.hitCount = j.web?.results?.length ?? 0;
          probe.firstUrl = j.web?.results?.[0]?.url;
        } else {
          const text = await r.text().catch(() => "");
          probe.error = `${r.status}: ${text.slice(0, 200)}`;
        }
      } catch (err) {
        probe.error = err instanceof Error ? err.message : "failed";
      }
    }
    probes.push(probe);
  }

  // SearXNG
  {
    const configured = !!process.env.SEARXNG_URL;
    const probe: ProbeResult = { provider: "searxng", configured };
    if (configured) {
      const t0 = Date.now();
      try {
        const base = process.env.SEARXNG_URL!.replace(/\/$/, "");
        const u = new URL(`${base}/search`);
        u.searchParams.set("q", q);
        u.searchParams.set("format", "json");
        const r = await fetch(u.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent": "krishna-admin-probe/1.0",
          },
        });
        probe.ms = Date.now() - t0;
        probe.ok = r.ok;
        if (r.ok) {
          const j = (await r.json()) as {
            results?: Array<{ url?: string }>;
          };
          probe.hitCount = j.results?.length ?? 0;
          probe.firstUrl = j.results?.[0]?.url;
        } else {
          probe.error = `${r.status}`;
        }
      } catch (err) {
        probe.error = err instanceof Error ? err.message : "failed";
      }
    }
    probes.push(probe);
  }

  // DuckDuckGo — html + lite endpoints
  {
    // html
    const probe: ProbeResult = { provider: "ddg-html", configured: true };
    const t0 = Date.now();
    try {
      const u = new URL("https://html.duckduckgo.com/html/");
      u.searchParams.set("q", q);
      const r = await fetch(u.toString(), {
        method: "POST",
        body: new URLSearchParams({ q }),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      probe.ms = Date.now() - t0;
      probe.ok = r.ok;
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/class="result__a"[^>]+href="([^"]+)"/g) ?? [];
        probe.hitCount = matches.length;
        probe.firstUrl = matches[0]?.match(/href="([^"]+)"/)?.[1];
      } else {
        probe.error = `${r.status}`;
      }
    } catch (err) {
      probe.error = err instanceof Error ? err.message : "failed";
    }
    probes.push(probe);
  }
  {
    const probe: ProbeResult = { provider: "ddg-lite", configured: true };
    const t0 = Date.now();
    try {
      const u = new URL("https://lite.duckduckgo.com/lite/");
      u.searchParams.set("q", q);
      const r = await fetch(u.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
      });
      probe.ms = Date.now() - t0;
      probe.ok = r.ok;
      if (r.ok) {
        const html = await r.text();
        const matches = html.match(/class="result-link"[^>]+href="([^"]+)"/g) ?? [];
        probe.hitCount = matches.length;
        probe.firstUrl = matches[0]?.match(/href="([^"]+)"/)?.[1];
      } else {
        probe.error = `${r.status}`;
      }
    } catch (err) {
      probe.error = err instanceof Error ? err.message : "failed";
    }
    probes.push(probe);
  }

  const anyOk = probes.some((p) => p.ok && (p.hitCount ?? 0) > 0);

  return NextResponse.json({
    query: q,
    anyProviderWorking: anyOk,
    probes,
  });
}
