/**
 * Shared helpers for autonomous agents (News scout, Job hunter, …).
 *
 * Strategy: use Groq's compound systems (`compound-beta` / `compound-beta-mini`)
 * which ship with a built-in web-search tool — no separate Tavily/Brave key
 * required. If the user's account doesn't have access to compound-beta the
 * caller can fall back to llama-3.3-70b with no tools and it'll still return a
 * (lower-quality) summary based on training data + connector context.
 */

import type { Connector } from "@/lib/content-types";
import { fetchConnectors } from "@/lib/content";
import { resolveConnectorCall } from "@/lib/connector-url";
import {
  looksLikeMcp,
  mcpCallTool,
  mcpInitialize,
  mcpListTools,
  type McpTool,
} from "@/lib/mcp";

/** Agentic models available on Groq — those with built-in tools. */
export const AGENT_MODELS = [
  {
    id: "compound-beta",
    label: "Compound (web-search agent)",
    blurb: "Groq compound with built-in web search",
  },
  {
    id: "compound-beta-mini",
    label: "Compound mini",
    blurb: "Cheaper, less thorough",
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B (no web)",
    blurb: "Fallback — no live search, summarises connector data only",
  },
];

export const DEFAULT_AGENT_MODEL = "compound-beta";

export function resolveAgentModel(requested?: string | null): string {
  if (requested && AGENT_MODELS.some((m) => m.id === requested)) return requested;
  return DEFAULT_AGENT_MODEL;
}

/** Try to pull a list of holding symbols from any WealthClaude-style MCP connector. */
export async function fetchHoldingSymbols(): Promise<{
  symbols: string[];
  source: string | null;
}> {
  const connectors = await fetchConnectors().catch<Connector[]>(() => []);
  for (const c of connectors) {
    if (!c.enabled || !c.bearer_token) continue;
    const { url } = resolveConnectorCall(c);
    if (!url) continue;
    if (!looksLikeMcp(url)) continue;
    try {
      await mcpInitialize(url, c.bearer_token).catch(() => undefined);
      const tools = await mcpListTools(url, c.bearer_token);
      // Find a tool that looks like it returns holdings.
      const holdingsTool = pickTool(tools, [
        "get_holdings",
        "holdings",
        "list_holdings",
        "get_portfolio",
        "portfolio",
      ]);
      if (!holdingsTool) continue;
      const out = await mcpCallTool(url, c.bearer_token, holdingsTool.name, {});
      if (!out.ok) continue;
      const symbols = extractSymbols(out.parsed);
      if (symbols.length > 0) return { symbols, source: c.label };
    } catch {
      // try next connector
    }
  }
  return { symbols: [], source: null };
}

function pickTool(tools: McpTool[], candidates: string[]): McpTool | null {
  const lower = candidates.map((c) => c.toLowerCase());
  for (const t of tools) {
    if (lower.includes(t.name.toLowerCase())) return t;
  }
  // Looser: substring match.
  for (const t of tools) {
    const name = t.name.toLowerCase();
    if (lower.some((c) => name.includes(c) || c.includes(name))) return t;
  }
  return null;
}

function extractSymbols(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const root = parsed as Record<string, unknown>;
  const candidateArrays: unknown[] = [];
  if (Array.isArray(root.holdings)) candidateArrays.push(root.holdings);
  if (Array.isArray(root.positions)) candidateArrays.push(root.positions);
  if (Array.isArray(root.items)) candidateArrays.push(root.items);
  // Sometimes it's the array itself.
  if (Array.isArray(parsed)) candidateArrays.push(parsed);
  const symbols = new Set<string>();
  for (const arr of candidateArrays) {
    if (!Array.isArray(arr)) continue;
    for (const h of arr) {
      if (!h || typeof h !== "object") continue;
      const obj = h as Record<string, unknown>;
      const s =
        (obj.symbol as string | undefined) ||
        (obj.ticker as string | undefined) ||
        (obj.name as string | undefined);
      if (typeof s === "string" && s.trim()) symbols.add(s.trim());
    }
  }
  return Array.from(symbols).slice(0, 40);
}

type SingleResult = { ok: boolean; content?: string; error?: string };

async function runOnce(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}): Promise<SingleResult> {
  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: opts.apiKey });
    const completion = await groq.chat.completions.create({
      model: opts.model,
      temperature: 0.4,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
    });
    const msg = completion.choices[0]?.message as
      | (typeof completion.choices[0]["message"] & {
          executed_tools?: Array<Record<string, unknown>>;
        })
      | undefined;
    let content = msg?.content ?? "";
    // Compound systems sometimes synthesize the answer into `executed_tools`
    // instead of `content` (especially mini). Fold those in as a fallback.
    if (!content && Array.isArray(msg?.executed_tools)) {
      const fromTools = msg!.executed_tools
        .map((t) => {
          const r = t as unknown as Record<string, unknown>;
          if (typeof r.output === "string") return r.output;
          if (typeof r.result === "string") return r.result;
          return "";
        })
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (fromTools) content = fromTools;
    }
    if (!content) return { ok: false, error: "Empty response" };
    return { ok: true, content };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Agent failed",
    };
  }
}

/** Run an agent with an automatic fallback chain. If the requested model
 *  returns empty content or errors, we retry on the next model down until one
 *  produces something. The model that actually answered is returned. */
export async function runAgent(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ ok: boolean; content?: string; error?: string; modelUsed?: string }> {
  const tried: Array<{ model: string; error: string }> = [];
  const fallbacks = await resolveFallbackChain(opts.apiKey, opts.model);
  for (const m of fallbacks) {
    const res = await runOnce({
      apiKey: opts.apiKey,
      model: m,
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      maxTokens:
        opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : m.startsWith("compound") ? 4096 : 2400,
    });
    if (res.ok && res.content) {
      return { ok: true, content: res.content, modelUsed: m };
    }
    tried.push({ model: m, error: res.error ?? "unknown" });
  }
  return {
    ok: false,
    error:
      "All models failed. " +
      tried.map((t) => `${t.model}: ${t.error}`).join(" · "),
  };
}

/** Pull full portfolio snapshot from WealthClaude MCP — holdings with current
 *  values, assets, debts. Returns raw JSON so the briefing agent can summarise. */
export async function fetchPortfolioSnapshot(): Promise<{
  holdings: unknown;
  assetsDebts: unknown;
  source: string | null;
}> {
  const connectors = await fetchConnectors().catch<Connector[]>(() => []);
  for (const c of connectors) {
    if (!c.enabled || !c.bearer_token) continue;
    const { url } = resolveConnectorCall(c);
    if (!url) continue;
    if (!looksLikeMcp(url)) continue;
    try {
      // `initialize` is an optional handshake — attempt it but don't bail if it
      // errors; tools/list is what actually matters, and some servers skip it.
      await mcpInitialize(url, c.bearer_token).catch(() => undefined);
      const tools = await mcpListTools(url, c.bearer_token);
      if (tools.length === 0) {
        console.warn(`[portfolio] MCP tools/list returned 0 tools for ${c.label} — token may be invalid/expired`);
        continue;
      }

      const holdingsTool = pickTool(tools, [
        "get_holdings",
        "holdings",
        "list_holdings",
        "get_portfolio",
      ]);
      const holdings = holdingsTool
        ? await mcpCallTool(url, c.bearer_token, holdingsTool.name, {}).catch(
            () => null
          )
        : null;

      const assetsTool = pickTool(tools, [
        "get_assets_and_debts",
        "assets_debts",
        "get_net_worth",
        "net_worth",
        "get_assets",
      ]);
      const assetsDebts = assetsTool
        ? await mcpCallTool(url, c.bearer_token, assetsTool.name, {}).catch(
            () => null
          )
        : null;

      if (holdings?.ok || assetsDebts?.ok) {
        return {
          holdings: holdings?.parsed ?? null,
          assetsDebts: assetsDebts?.parsed ?? null,
          source: c.label,
        };
      }
      console.warn(`[portfolio] MCP tools returned ok=false for ${c.label}`, {
        holdings: holdings?.error,
        assets: assetsDebts?.error,
      });
    } catch (err) {
      console.warn(`[portfolio] MCP call failed for ${c.label}:`, err instanceof Error ? err.message : err);
    }
  }
  return { holdings: null, assetsDebts: null, source: null };
}

function buildFallbackChain(requested: string): string[] {
  const chain: string[] = [requested];
  // If the user picked a compound model, fall back to compound-mini, then 70B.
  if (requested === "compound-beta" && !chain.includes("compound-beta-mini")) {
    chain.push("compound-beta-mini");
  }
  if (!chain.includes("llama-3.3-70b-versatile")) {
    chain.push("llama-3.3-70b-versatile");
  }
  // De-dupe while preserving order.
  return Array.from(new Set(chain));
}

/**
 * Groq retires model IDs, and a retired one 404s with "model_not_found" — which
 * is how every agent broke at once when llama-3.3-70b-versatile went away.
 * Rather than hardcode replacements that will rot the same way, ask Groq what
 * it actually serves and keep only chain entries that exist.
 */
let modelCache: { at: number; ids: Set<string> } | null = null;
const MODEL_CACHE_MS = 10 * 60_000;

/** Renames Groq has done. Tried when the original ID is gone. */
const RENAMES: Record<string, string[]> = {
  "compound-beta": ["groq/compound"],
  "compound-beta-mini": ["groq/compound-mini"],
};

/** Preference order when nothing in the requested chain still exists. */
const PREFERRED = [
  "groq/compound",
  "groq/compound-mini",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
];

async function availableModels(apiKey: string): Promise<Set<string> | null> {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_MS) return modelCache.ids;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: Array<{ id?: string }> };
    const ids = new Set((j.data ?? []).map((m) => String(m.id)).filter(Boolean));
    if (!ids.size) return null;
    modelCache = { at: Date.now(), ids };
    return ids;
  } catch {
    // Offline or the endpoint changed — fall through to the static chain.
    return null;
  }
}

async function resolveFallbackChain(apiKey: string, requested: string): Promise<string[]> {
  const chain = buildFallbackChain(requested);
  const available = await availableModels(apiKey);
  if (!available) return chain;

  const out: string[] = [];
  for (const m of chain) {
    if (available.has(m)) out.push(m);
    else for (const alt of RENAMES[m] ?? []) if (available.has(alt)) out.push(alt);
  }
  // Nothing from the requested chain survives — use whatever Groq does serve.
  if (!out.length) out.push(...PREFERRED.filter((m) => available.has(m)));
  if (!out.length) out.push(...[...available].slice(0, 3));

  return Array.from(new Set(out));
}
