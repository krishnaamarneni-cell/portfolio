import { NextResponse } from "next/server";
import { fetchJobs, fetchProjects, fetchSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * MCP (Model Context Protocol) endpoint for krishnaamarneni.com.
 *
 * Exposes portfolio data as JSON-RPC tools so other apps (Personal OS,
 * WealthClaude) can pull projects, jobs, bio, skills via MCP.
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

function checkAuth(request: Request): boolean {
  const token = process.env.MCP_ACCESS_TOKEN;
  if (!token) return true; // No token set = open (dev mode)
  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") || "";
  return auth === `Bearer ${token}` || queryToken === token;
}

const TOOLS = [
  {
    name: "get_bio",
    description: "Get Krishna's bio, about section, and headline.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_experience",
    description: "Get Krishna's full work experience / job history with descriptions and highlights.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_projects",
    description: "Get Krishna's featured projects with descriptions and links.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_skills",
    description: "Get Krishna's skills list.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function handleTool(name: string): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (name) {
    case "get_bio": {
      const site = await fetchSiteContent();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            name: `${site.hero?.first_name || "Krishna"} ${site.hero?.last_name || "Amarneni"}`,
            headline: `${site.hero?.tagline_left || ""} ${site.hero?.tagline_right || ""}`.trim(),
            about: [site.about?.paragraph_one, site.about?.paragraph_two].filter(Boolean).join("\n\n"),
          }),
        }],
      };
    }
    case "get_experience": {
      const jobs = await fetchJobs();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(jobs.map((j) => ({
            title: j.title,
            company: j.company,
            period: j.period,
            location: j.location,
            description: j.description,
            highlights: j.highlights,
            tags: j.tags,
          }))),
        }],
      };
    }
    case "get_projects": {
      const projects = await fetchProjects();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(projects.map((p) => ({
            title: p.title,
            subtitle: p.subtitle,
            description: p.description,
            link: p.link,
            tags: p.tags,
          }))),
        }],
      };
    }
    case "get_skills": {
      const site = await fetchSiteContent();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            skills: site.skills?.skills || [],
            services: site.skills?.services || [],
          }),
        }],
      };
    }
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
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
        serverInfo: { name: "krishna-portfolio", version: "1.0.0" },
      });

    case "tools/list":
      return jsonRpc(id, { tools: TOOLS });

    case "tools/call": {
      const toolName = (params?.name as string) || "";
      const result = await handleTool(toolName);
      return jsonRpc(id, result);
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}
