/**
 * Tiny MCP (Model Context Protocol) client.
 *
 * WealthClaude's MCP endpoint at /api/mcp speaks JSON-RPC 2.0 over HTTP.
 * Calling tools through MCP gives richer data than the flat /api/agent/me
 * snapshot — e.g., debt breakdowns by type, dividend-by-symbol, current
 * prices. We wrap it just enough to power tool-calling from Groq.
 */

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type JsonRpcResponse<T = unknown> = {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

async function rpc<T = unknown>(
  url: string,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  id: number = 1
): Promise<JsonRpcResponse<T>> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    cache: "no-store",
  });
  // Some MCP servers stream — we don't currently need streaming so just buffer.
  const text = await r.text();
  try {
    return JSON.parse(text) as JsonRpcResponse<T>;
  } catch {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32700, message: `Invalid JSON-RPC: ${text.slice(0, 200)}` },
    };
  }
}

export async function mcpInitialize(
  url: string,
  token: string
): Promise<JsonRpcResponse> {
  return rpc(url, token, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "krishna-admin", version: "0.1" },
  });
}

export async function mcpListTools(
  url: string,
  token: string
): Promise<McpTool[]> {
  const r = await rpc<{ tools: McpTool[] }>(url, token, "tools/list");
  if (r.error) return [];
  return r.result?.tools ?? [];
}

export type McpToolResult = {
  ok: boolean;
  content?: Array<{ type: string; text?: string; data?: unknown }>;
  error?: string;
  /** Convenience: parsed JSON if the first content item is JSON-as-text. */
  parsed?: unknown;
};

export async function mcpCallTool(
  url: string,
  token: string,
  name: string,
  args: Record<string, unknown> = {}
): Promise<McpToolResult> {
  const r = await rpc<{
    content?: Array<{ type: string; text?: string; data?: unknown }>;
    isError?: boolean;
  }>(url, token, "tools/call", { name, arguments: args });

  if (r.error) {
    return { ok: false, error: r.error.message };
  }
  if (r.result?.isError) {
    return {
      ok: false,
      error:
        r.result.content?.map((c) => c.text ?? JSON.stringify(c.data)).join(" ") ??
        "Tool error",
    };
  }
  const content = r.result?.content ?? [];
  let parsed: unknown = undefined;
  const first = content[0];
  if (first?.type === "text" && first.text) {
    try {
      parsed = JSON.parse(first.text);
    } catch {
      parsed = first.text;
    }
  } else if (first?.data !== undefined) {
    parsed = first.data;
  }
  return { ok: true, content, parsed };
}

export function looksLikeMcp(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.endsWith("/mcp") || u.pathname.endsWith("/api/mcp");
  } catch {
    return false;
  }
}

/**
 * Translate an MCP tool list into the OpenAI/Groq function-calling shape.
 */
export function mcpToolsToGroqTools(
  tools: McpTool[],
  prefix: string = ""
): Array<{
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: prefix ? `${prefix}__${t.name}` : t.name,
      description: t.description,
      parameters:
        (t.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
    },
  }));
}
