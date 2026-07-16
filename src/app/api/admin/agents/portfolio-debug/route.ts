import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchConnectors } from "@/lib/content";
import { resolveConnectorCall } from "@/lib/connector-url";
import { looksLikeMcp, mcpInitialize, mcpListTools, mcpCallTool, type McpToolResult } from "@/lib/mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function sample(r: McpToolResult): string {
  if (!r.ok) return `ERROR: ${r.error ?? "no data"}`;
  if (typeof r.parsed === "string") return r.parsed.slice(0, 400);
  try {
    return JSON.stringify(r.parsed).slice(0, 400);
  } catch {
    return "(unserializable)";
  }
}

/**
 * Diagnose why the newsletter's Net Worth section is empty. Shows every
 * connector, whether it's a valid MCP endpoint, and — for the first enabled
 * MCP connector — the initialize / tools-list / tool-call results.
 */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectors = await fetchConnectors().catch(() => []);
  const summary = connectors.map((c) => {
    const { url } = resolveConnectorCall(c);
    return {
      label: c.label,
      enabled: c.enabled,
      hasToken: !!c.bearer_token,
      resolvedUrl: url,
      isMcp: url ? looksLikeMcp(url) : false,
    };
  });

  const target = connectors.find(
    (c) => c.enabled && c.bearer_token && looksLikeMcp(resolveConnectorCall(c).url || "")
  );

  if (!target) {
    return NextResponse.json({
      verdict:
        "No enabled MCP connector found. Fix: in Settings → Connectors, make sure the WealthClaude connector is ENABLED, has a token, and its URL ends with /api/mcp (e.g. https://www.wealthclaude.com/api/mcp).",
      connectors: summary,
    });
  }

  const { url } = resolveConnectorCall(target);
  const token = target.bearer_token as string;

  const init = await mcpInitialize(url!, token).catch((e) => ({ error: { message: String(e), code: 0 } }));
  const initErr = "error" in init && init.error ? init.error.message : null;

  const tools = await mcpListTools(url!, token).catch(() => []);
  const toolNames = tools.map((t) => t.name);

  const holdings = await mcpCallTool(url!, token, "get_holdings", {}).catch(
    (e): McpToolResult => ({ ok: false, error: String(e) })
  );
  const assets = await mcpCallTool(url!, token, "get_assets_and_debts", {}).catch(
    (e): McpToolResult => ({ ok: false, error: String(e) })
  );

  let verdict: string;
  if (initErr && toolNames.length === 0) {
    verdict = `Auth is failing — the token is likely invalid or expired. Server said: "${initErr}". Fix: generate a fresh token in WealthClaude → AI Access and paste it into the connector.`;
  } else if (toolNames.length === 0) {
    verdict = "tools/list returned nothing — token likely invalid, or the URL isn't the MCP endpoint.";
  } else if (!holdings.ok && !assets.ok) {
    verdict = `Connected and ${toolNames.length} tools listed, but both portfolio tools errored — WealthClaude couldn't build the snapshot (empty account or server error). holdings: ${holdings.error}; assets: ${assets.error}`;
  } else {
    verdict = "Portfolio data IS reachable — the newsletter should show net worth now. If it still doesn't, the briefing may be cached; re-run it.";
  }

  return NextResponse.json({
    verdict,
    connectors: summary,
    probe: {
      connector: target.label,
      url,
      initialize: initErr ? { error: initErr } : { ok: true },
      toolCount: toolNames.length,
      toolNames,
      get_holdings: { ok: holdings.ok, sample: sample(holdings) },
      get_assets_and_debts: { ok: assets.ok, sample: sample(assets) },
    },
  });
}
