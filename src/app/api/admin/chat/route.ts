import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  fetchAllThoughts,
  fetchConnectors,
  fetchJobs,
  fetchProjects,
  fetchSiteContent,
} from "@/lib/content";
import type { Connector } from "@/lib/content-types";
import { resolveConnectorCall } from "@/lib/connector-url";
import {
  looksLikeMcp,
  mcpCallTool,
  mcpInitialize,
  mcpListTools,
  mcpToolsToGroqTools,
  type McpTool,
} from "@/lib/mcp";
import { resolveModel } from "@/lib/groq-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant" | "system" | "tool"; content: string; tool_call_id?: string; name?: string };

type RestSnapshot = { connector: Connector; data: unknown };
type McpHandle = { connector: Connector; url: string; tools: McpTool[] };

/* ─────── REST connector pull (legacy / WealthClaude /api/agent/me) ─────── */

async function callRestConnector(c: Connector): Promise<unknown | null> {
  const { url, headers } = resolveConnectorCall(c);
  if (!url) return null;
  // Skip Buffer (not useful as chat context) and MCP (handled separately).
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("buffer.com") || host.endsWith("bufferapp.com")) return null;
  } catch {
    return null;
  }
  if (looksLikeMcp(url)) return null;
  try {
    const r = await fetch(url, { headers, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

/* ─────── Buffer's GraphQL data isn't useful here. ─────── */

function describeConnectorRisks(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const holdings = Array.isArray(obj.holdings) ? obj.holdings : [];
  const nonUs = new Set<string>();
  for (const h of holdings) {
    const sym = String((h as Record<string, unknown>)?.symbol ?? "");
    const m = sym.match(/\.([A-Z]{1,3})$/);
    if (m && m[1] !== "US") nonUs.add(m[1]);
  }
  if (nonUs.size === 0) return "";
  return (
    `\n\n⚠ This snapshot includes holdings on non-US exchanges (${[...nonUs].join(", ")}). ` +
    `The raw "netWorth" field may include amounts in INR / GBP etc. summed as if USD. ` +
    `When totals matter, prefer tools that return per-currency values, and add a one-line ` +
    `caveat suggesting the user check the WealthClaude UI for the authoritative figure.`
  );
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set in env." },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[]; model?: string };
  try {
    body = (await request.json()) as { messages?: ChatMessage[]; model?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const chosenModel = resolveModel("chat", body.model);
  const messages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && m.content
  );
  if (messages.length === 0) {
    return NextResponse.json({ error: "Empty messages" }, { status: 400 });
  }

  // Pull static context — site, jobs, projects, notes.
  const [jobs, projects, site, notes, connectors] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchProjects().catch(() => []),
    fetchSiteContent(),
    fetchAllThoughts().catch(() => []),
    fetchConnectors().catch(() => []),
  ]);

  // Pull connector data: REST (snapshot dump) + MCP (tool list).
  const enabled = connectors.filter((c) => c.enabled);
  const restSnaps: RestSnapshot[] = [];
  const mcpHandles: McpHandle[] = [];
  await Promise.all(
    enabled.map(async (c) => {
      const { url } = resolveConnectorCall(c);
      if (!url || !c.bearer_token) return;
      if (looksLikeMcp(url)) {
        await mcpInitialize(url, c.bearer_token).catch(() => undefined);
        const tools = await mcpListTools(url, c.bearer_token);
        if (tools.length > 0) {
          mcpHandles.push({ connector: c, url, tools });
        }
      } else {
        const data = await callRestConnector(c);
        if (data) restSnaps.push({ connector: c, data });
      }
    })
  );

  // Build system prompt
  const about = `${site.about.paragraph_one}\n${site.about.paragraph_two}`;
  const jobsBlob = jobs
    .slice(0, 10)
    .map(
      (j) =>
        `- ${j.title} @ ${j.company} (${j.period}, ${j.location}) — ${j.description}${j.highlights?.length ? "\n  Highlights: " + j.highlights.join("; ") : ""}`
    )
    .join("\n");
  const projectsBlob = projects
    .slice(0, 10)
    .map((p) => `- ${p.title} (${p.subtitle}): ${p.description}  [${p.link}]`)
    .join("\n");
  const notesBlob = notes
    .filter((n) => n.published)
    .slice(0, 8)
    .map((n) => `- ${n.title}: ${n.body}`)
    .join("\n");
  const restBlob = restSnaps
    .map((s) => {
      const head = `## ${s.connector.label} (${s.connector.id}) — REST snapshot:`;
      const json = JSON.stringify(s.data, null, 2).slice(0, 12000);
      return `${head}\n${json}${describeConnectorRisks(s.data)}`;
    })
    .join("\n\n");
  const mcpBlob = mcpHandles
    .map(
      (h) =>
        `## ${h.connector.label} (${h.connector.id}) — MCP tools available:\n${h.tools
          .map((t) => `  • ${h.connector.id}__${t.name}: ${t.description ?? "(no description)"}`)
          .join("\n")}\nWhen answering questions that need fresh, specific data from ${h.connector.label}, CALL the matching tool. Don't guess.`
    )
    .join("\n\n");

  const system = `You are Krishna Amarneni's personal AI assistant inside Krishna's portfolio admin. You answer Krishna's questions about himself, his work, his book, his published notes, and his money.

Voice: direct, factual, second-person ("you", not "Krishna"). Concise. If a fact isn't in the data or tools you have access to, say so plainly.

# About Krishna
${about}

# Work history
${jobsBlob || "(none on file)"}

# Featured projects
${projectsBlob || "(none on file)"}

# Published notes
${notesBlob || "(none yet)"}

${restBlob ? `# Connected services (snapshots)\n${restBlob}\n` : ""}${mcpBlob ? `\n# Connected services (tools)\n${mcpBlob}\n\nPrefer tools over guesses. When you call a tool, pass the result back through the conversation honestly. Quote specific numbers from the tool output.\n` : ""}`;

  // Compose Groq messages + tool list
  const groqTools: Array<{
    type: "function";
    function: { name: string; description?: string; parameters: Record<string, unknown> };
  }> = [];
  for (const h of mcpHandles) {
    groqTools.push(...mcpToolsToGroqTools(h.tools, h.connector.id));
  }

  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey });

  // tool-call loop — up to N rounds so the model can fetch what it needs.
  const MAX_ROUNDS = 4;
  type GroqMsg = {
    role: "system" | "user" | "assistant" | "tool";
    content?: string | null;
    tool_call_id?: string;
    name?: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
  const loop: GroqMsg[] = [
    { role: "system", content: system },
    ...messages.map(
      (m): GroqMsg => ({ role: m.role as GroqMsg["role"], content: m.content })
    ),
  ];

  try {
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const completion = await groq.chat.completions.create({
        model: chosenModel,
        temperature: 0.3,
        max_tokens: 1500,
        messages: loop as never,
        tools: groqTools.length > 0 ? groqTools : undefined,
      });
      const choice = completion.choices[0];
      const reply = choice?.message;
      if (!reply) {
        return NextResponse.json({ error: "Empty Groq response" }, { status: 502 });
      }
      const toolCalls = (reply as { tool_calls?: GroqMsg["tool_calls"] }).tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return NextResponse.json({ reply: reply.content ?? "" });
      }
      // Append the assistant message that requested the tools.
      loop.push({
        role: "assistant",
        content: reply.content ?? null,
        tool_calls: toolCalls,
      });
      // Execute each tool call.
      for (const call of toolCalls) {
        const fullName = call.function.name; // "<connectorId>__<tool>"
        const sep = fullName.indexOf("__");
        const connId = sep > 0 ? fullName.slice(0, sep) : "";
        const toolName = sep > 0 ? fullName.slice(sep + 2) : fullName;
        const handle = mcpHandles.find((h) => h.connector.id === connId);
        let resultJson: string;
        if (!handle) {
          resultJson = JSON.stringify({ error: `No MCP handle for ${connId}` });
        } else {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const out = await mcpCallTool(
            handle.url,
            handle.connector.bearer_token as string,
            toolName,
            args
          );
          if (out.ok) {
            resultJson = JSON.stringify(out.parsed ?? out.content ?? null).slice(0, 16000);
          } else {
            resultJson = JSON.stringify({ error: out.error || "Tool failed" });
          }
        }
        loop.push({
          role: "tool",
          tool_call_id: call.id,
          name: fullName,
          content: resultJson,
        });
      }
    }
    // Loop exhausted — ask Groq for a final answer without tools.
    const final = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1500,
      messages: loop as never,
    });
    return NextResponse.json({
      reply: final.choices[0]?.message?.content ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
