import type { Connector } from "./content-types";

/**
 * Returns the URL we should actually fetch for a given connector.
 *
 * The admin form lets you paste either:
 *   - a full endpoint URL    e.g. https://www.wealthclaude.com/api/agent/me
 *   - or just a host          e.g. https://www.wealthclaude.com
 *
 * If the URL already contains "/api/", "/v1/", or any path beyond the host,
 * we use it as-is. Otherwise we append the WealthClaude REST default
 * "/api/agent/me" so existing rows keep working.
 *
 * The MCP endpoint (/api/mcp) speaks JSON-RPC, not plain REST, so passing
 * that here will fail — the form help-text now points users to /api/agent/me.
 */
export function resolveConnectorEndpoint(c: Connector): string {
  const raw = (c.base_url || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const u = new URL(raw);
    // Has a meaningful path? Use the URL exactly as entered.
    const path = u.pathname.replace(/\/+$/, "");
    if (path && path !== "" && path !== "/") {
      return raw;
    }
    // Host only — append the WealthClaude REST default.
    return `${raw}/api/agent/me`;
  } catch {
    return raw;
  }
}
