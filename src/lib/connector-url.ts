import type { Connector } from "./content-types";

export type ConnectorCall = {
  /** Full URL to fetch (incl. any auth query string the upstream wants). */
  url: string;
  /** Headers to send. */
  headers: Record<string, string>;
};

/**
 * Build a fetch-ready URL + headers for a given connector.
 *
 * The admin form lets you paste either:
 *   - a full endpoint URL    e.g. https://www.wealthclaude.com/api/agent/me
 *   - or just a host          e.g. https://www.wealthclaude.com
 *
 * If the URL already contains a path beyond the host, we use it as-is.
 * Otherwise we append the WealthClaude REST default "/api/agent/me" so
 * existing rows keep working.
 *
 * Buffer's classic API uses ?access_token=<token>, not a Bearer header —
 * we detect bufferapp.com hosts and add the token as a query param instead
 * of the Authorization header. Other hosts get the standard Bearer.
 */
export function resolveConnectorCall(c: Connector): ConnectorCall {
  const raw = (c.base_url || "").trim().replace(/\/+$/, "");
  const token = c.bearer_token ?? "";
  if (!raw) return { url: "", headers: {} };

  let url = raw;
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, "");
    if (!path || path === "" || path === "/") {
      // Host only → append WealthClaude REST default.
      url = `${raw}/api/agent/me`;
    }
    // Buffer's classic API at api.bufferapp.com is deprecated for new OIDC
    // tokens. Our Buffer-specific routes hit api.buffer.com/graphql via the
    // helpers in src/lib/buffer.ts, so we don't need to add anything here.
  } catch {
    // not a valid URL — fall through with whatever the user typed
  }

  return {
    url,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
    },
  };
}

/** Back-compat shim — used a few places before the Buffer split. */
export function resolveConnectorEndpoint(c: Connector): string {
  return resolveConnectorCall(c).url;
}
