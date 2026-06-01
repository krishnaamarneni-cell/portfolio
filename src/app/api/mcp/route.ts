import { NextResponse } from "next/server";
import { fetchJobs, fetchProjects, fetchSiteContent, fetchConnectors } from "@/lib/content";
import { listNotes } from "@/lib/personal";
import { listContacts, upsertContact } from "@/lib/contacts";
import { listRecentMessages, sendEmail } from "@/lib/gmail";
import { sendEmailUnified } from "@/lib/resend";
import { buildFactsContext } from "@/lib/facts";
import { resolveConnectorCall } from "@/lib/connector-url";
import { looksLikeMcp, mcpInitialize, mcpListTools, mcpCallTool } from "@/lib/mcp";
import { validateToken } from "@/lib/mcp-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * MCP (Model Context Protocol) hub for krishnaamarneni.com.
 *
 * This is Lucy's brain exposed as a standard MCP server. Any agent
 * (Personal OS, Claude Desktop, ChatGPT, custom scripts) can connect
 * here and get full access to:
 *   - Portfolio data (bio, experience, projects, skills)
 *   - Personal notes + facts
 *   - Recruiter contacts
 *   - Gmail inbox (read + send)
 *   - Connected MCP services (proxy calls to WealthClaude, EchoNest, etc.)
 *
 * Auth: Bearer token matching MCP_ACCESS_TOKEN env var.
 */

type JsonRpcRequest = {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

function jsonRpc(id: number | string | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: number | string | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

async function checkAuth(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") || "";
  const rawToken = auth.startsWith("Bearer ") ? auth.slice(7) : queryToken;

  if (!rawToken) {
    // No token provided — only allow if no tokens exist at all (first-run dev mode).
    const envToken = process.env.MCP_ACCESS_TOKEN;
    return !envToken;
  }
  return validateToken(rawToken);
}

const TOOLS = [
  // Portfolio data
  { name: "get_bio", description: "Get Krishna's bio, about section, and headline.", inputSchema: { type: "object", properties: {} } },
  { name: "get_experience", description: "Get full work experience / job history with highlights.", inputSchema: { type: "object", properties: {} } },
  { name: "get_projects", description: "Get featured projects with descriptions and links.", inputSchema: { type: "object", properties: {} } },
  { name: "get_skills", description: "Get skills list and services.", inputSchema: { type: "object", properties: {} } },
  // Personal data
  { name: "get_notes", description: "Get personal notes from Life cockpit (visa dates, plans, reminders).", inputSchema: { type: "object", properties: {} } },
  { name: "get_facts", description: "Get personal facts (always-on memory used by all agents).", inputSchema: { type: "object", properties: {} } },
  { name: "get_contacts", description: "Get saved recruiter contacts with match percentages.", inputSchema: { type: "object", properties: {} } },
  { name: "save_contact", description: "Save a recruiter contact.", inputSchema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, company: { type: "string" }, role: { type: "string" }, match_pct: { type: "number" } }, required: ["name", "email"] } },
  // Gmail
  { name: "search_inbox", description: "Search Gmail inbox.", inputSchema: { type: "object", properties: { query: { type: "string", description: "Gmail search query" }, max_results: { type: "number" } }, required: ["query"] } },
  { name: "send_email", description: "Send an email on Krishna's behalf.", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
  // MCP proxy — call any connected service through Lucy
  { name: "list_services", description: "List all connected MCP services (WealthClaude, EchoNest, etc.) with their available tools.", inputSchema: { type: "object", properties: {} } },
  { name: "call_service", description: "Proxy a tool call to a connected MCP service. Use list_services first to see available tools.", inputSchema: { type: "object", properties: { connector_id: { type: "string", description: "Connector ID (e.g. the connector's UUID)" }, tool: { type: "string", description: "Tool name on that service" }, args: { type: "object", description: "Arguments to pass" } }, required: ["connector_id", "tool"] } },
];

async function handleTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
  const err = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true as const });

  try {
    switch (name) {
      case "get_bio": {
        const site = await fetchSiteContent();
        return ok({
          name: `${site.hero?.first_name || "Krishna"} ${site.hero?.last_name || "Amarneni"}`,
          headline: `${site.hero?.tagline_left || ""} ${site.hero?.tagline_right || ""}`.trim(),
          about: [site.about?.paragraph_one, site.about?.paragraph_two].filter(Boolean).join("\n\n"),
        });
      }
      case "get_experience": {
        const jobs = await fetchJobs();
        return ok(jobs.map((j) => ({ title: j.title, company: j.company, period: j.period, location: j.location, description: j.description, highlights: j.highlights, tags: j.tags })));
      }
      case "get_projects": {
        const projects = await fetchProjects();
        return ok(projects.map((p) => ({ title: p.title, subtitle: p.subtitle, description: p.description, link: p.link, tags: p.tags })));
      }
      case "get_skills": {
        const site = await fetchSiteContent();
        return ok({ skills: site.skills?.skills || [], services: site.skills?.services || [] });
      }
      case "get_notes": {
        const notes = await listNotes();
        return ok(notes.map((n) => ({ body: n.body, tags: n.tags, event_date: n.event_date, pinned: n.pinned })));
      }
      case "get_facts": {
        const facts = await buildFactsContext();
        return ok({ facts });
      }
      case "get_contacts": {
        const contacts = await listContacts();
        return ok(contacts.map((c) => ({ name: c.name, email: c.email, company: c.company, role: c.role_pitched, match: c.match_pct, starred: c.starred, emailed: !!c.emailed_at })));
      }
      case "save_contact": {
        const saved = await upsertContact({
          name: (args.name as string) || "",
          email: (args.email as string) || "",
          company: (args.company as string) || null,
          role_pitched: (args.role as string) || null,
          match_pct: typeof args.match_pct === "number" ? args.match_pct : null,
          source: "mcp",
        });
        return ok({ saved: true, email: saved.email });
      }
      case "search_inbox": {
        const { messages, error: gmailErr } = await listRecentMessages({
          query: (args.query as string) || "newer_than:3d",
          maxResults: typeof args.max_results === "number" ? args.max_results : 10,
        });
        if (gmailErr) return err(gmailErr);
        return ok(messages.map((m) => ({ from: m.from, subject: m.subject, date: m.date, snippet: m.snippet })));
      }
      case "send_email": {
        const to = (args.to as string) || "";
        const subject = (args.subject as string) || "";
        const body = (args.body as string) || "";
        if (!to || !subject || !body) return err("to, subject, body required");
        const html = `<p>${body.replace(/\n/g, "<br>")}</p><p>Krishna Amarneni<br><a href="https://krishnaamarneni.com">krishnaamarneni.com</a></p>`;
        const send = await sendEmailUnified({ to, subject, html, text: body });
        return ok({ sent: send.ok, provider: send.provider, error: send.error });
      }
      case "list_services": {
        const connectors = await fetchConnectors();
        const services = [];
        for (const c of connectors.filter((c) => c.enabled && c.bearer_token)) {
          const { url } = resolveConnectorCall(c);
          if (!url || !looksLikeMcp(url)) continue;
          try {
            await mcpInitialize(url, c.bearer_token!).catch(() => undefined);
            const tools = await mcpListTools(url, c.bearer_token!);
            services.push({ id: c.id, label: c.label, tools: tools.map((t) => ({ name: t.name, description: t.description })) });
          } catch {
            services.push({ id: c.id, label: c.label, tools: [], error: "offline" });
          }
        }
        return ok(services);
      }
      case "call_service": {
        const connectorId = (args.connector_id as string) || "";
        const toolName = (args.tool as string) || "";
        const toolArgs = (args.args as Record<string, unknown>) || {};
        const connectors = await fetchConnectors();
        const c = connectors.find((c) => c.id === connectorId);
        if (!c || !c.enabled || !c.bearer_token) return err(`Connector ${connectorId} not found or disabled`);
        const { url } = resolveConnectorCall(c);
        if (!url || !looksLikeMcp(url)) return err("Not an MCP connector");
        await mcpInitialize(url, c.bearer_token).catch(() => undefined);
        const result = await mcpCallTool(url, c.bearer_token, toolName, toolArgs);
        if (!result.ok) return err(result.error || "Tool call failed");
        return ok(result.parsed ?? result.content);
      }
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function POST(request: Request) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const { method, params, id } = body;

  switch (method) {
    case "initialize":
      return jsonRpc(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "lucy-hub", version: "2.0.0" },
      });

    case "tools/list":
      return jsonRpc(id, { tools: TOOLS });

    case "tools/call": {
      const toolName = (params?.name as string) || "";
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};
      const result = await handleTool(toolName, toolArgs);
      return jsonRpc(id, result);
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}
