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

/** Run a one-shot agent. */
export async function runAgent(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ ok: boolean; content?: string; error?: string }> {
  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: opts.apiKey });
    const completion = await groq.chat.completions.create({
      model: opts.model,
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 2200,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "";
    if (!content) return { ok: false, error: "Empty response" };
    return { ok: true, content };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Agent failed",
    };
  }
}
