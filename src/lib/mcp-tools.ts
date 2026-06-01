/**
 * Central MCP tool registry. Add a tool here ONCE and it automatically
 * appears in:
 *   1. /api/mcp endpoint (external agents)
 *   2. Lucy chat (built-in tools)
 *   3. Settings page (tool list display)
 *
 * To add a new tool:
 *   1. Add an entry to TOOL_REGISTRY below
 *   2. Add a handler case in the handleTool switch
 *   3. That's it — MCP, chat, and Settings all pick it up
 */

export type ToolDef = {
  name: string;
  description: string;
  category: "portfolio" | "personal" | "gmail" | "proxy" | "contacts";
  inputSchema: Record<string, unknown>;
};

export const TOOL_REGISTRY: ToolDef[] = [
  // ── Portfolio data ──
  { name: "get_bio", description: "Get Krishna's bio, headline, and about section", category: "portfolio", inputSchema: { type: "object", properties: {} } },
  { name: "get_experience", description: "Get full work experience / job history with highlights", category: "portfolio", inputSchema: { type: "object", properties: {} } },
  { name: "get_projects", description: "Get featured projects with descriptions and links", category: "portfolio", inputSchema: { type: "object", properties: {} } },
  { name: "get_skills", description: "Get skills list and services", category: "portfolio", inputSchema: { type: "object", properties: {} } },

  // ── Personal data ──
  { name: "get_notes", description: "Get personal notes from Life cockpit (visa, plans, reminders)", category: "personal", inputSchema: { type: "object", properties: {} } },
  { name: "get_facts", description: "Get personal facts (always-on memory used by all agents)", category: "personal", inputSchema: { type: "object", properties: {} } },

  // ── Contacts ──
  { name: "get_contacts", description: "Get saved recruiter contacts with match percentages", category: "contacts", inputSchema: { type: "object", properties: {} } },
  { name: "save_contact", description: "Save a recruiter contact", category: "contacts", inputSchema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, company: { type: "string" }, role: { type: "string" }, match_pct: { type: "number" } }, required: ["name", "email"] } },

  // ── Gmail ──
  { name: "search_inbox", description: "Search Krishna's Gmail inbox", category: "gmail", inputSchema: { type: "object", properties: { query: { type: "string", description: "Gmail search query" }, max_results: { type: "number" } }, required: ["query"] } },
  { name: "send_email", description: "Send an email on Krishna's behalf", category: "gmail", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },

  // ── MCP proxy ──
  { name: "list_services", description: "List all connected MCP services and their tools", category: "proxy", inputSchema: { type: "object", properties: {} } },
  { name: "call_service", description: "Proxy a tool call to a connected MCP service (WealthClaude, EchoNest, etc.)", category: "proxy", inputSchema: { type: "object", properties: { connector_id: { type: "string" }, tool: { type: "string" }, args: { type: "object" } }, required: ["connector_id", "tool"] } },
];

/** Get tools formatted for Groq function-calling (used by chat). */
export function getGroqTools(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return TOOL_REGISTRY.map((t) => ({
    type: "function" as const,
    function: {
      name: `lucy__${t.name}`,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/** Get tools formatted for MCP tools/list response. */
export function getMcpTools(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return TOOL_REGISTRY.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

/** Get tools for display in the Settings UI. */
export function getToolsForDisplay(): Array<{ name: string; desc: string; category: string }> {
  return TOOL_REGISTRY.map((t) => ({
    name: t.name,
    desc: t.description,
    category: t.category,
  }));
}
