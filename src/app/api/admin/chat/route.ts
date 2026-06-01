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
import { buildFactsContext } from "@/lib/facts";
import {
  appendMessage,
  ensureThread,
  getThreadMessages,
} from "@/lib/chat-history";
import { listContacts, upsertContact } from "@/lib/contacts";
import { listNotes, type PersonalNote } from "@/lib/personal";
import { listRecentMessages, sendEmail } from "@/lib/gmail";
import { sendEmailUnified } from "@/lib/resend";
import { getGroqTools } from "@/lib/mcp-tools";

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

  let body: { messages?: ChatMessage[]; model?: string; thread_id?: string };
  try {
    body = (await request.json()) as {
      messages?: ChatMessage[];
      model?: string;
      thread_id?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const chosenModel = resolveModel("chat", body.model);
  const incoming = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && m.content
  );
  if (incoming.length === 0) {
    return NextResponse.json({ error: "Empty messages" }, { status: 400 });
  }

  // ── Resolve thread + reconstruct full message history from DB ──
  // The client may send only the newest user message + a thread_id; we hydrate
  // the rest from chat_messages so old conversations actually have memory.
  const lastUserMsg = [...incoming].reverse().find((m) => m.role === "user");
  const thread = await ensureThread(body.thread_id, lastUserMsg?.content ?? "");
  const persisted = await getThreadMessages(thread.id).catch(() => []);
  const messages: ChatMessage[] = persisted
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));
  // Append only the new user messages the client just sent (avoid double-storing
  // ones already in the DB).
  const persistedTexts = new Set(persisted.map((p) => `${p.role}::${p.content}`));
  for (const m of incoming) {
    const key = `${m.role}::${m.content}`;
    if (!persistedTexts.has(key)) {
      messages.push(m);
      if (m.role === "user") {
        await appendMessage(thread.id, { role: "user", content: m.content });
      }
    }
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

  // ── Pull personal notes + contacts for context ──
  const personalNotes = await listNotes().catch<PersonalNote[]>(() => []);
  const recruiterContacts = await listContacts().catch(() => []);

  const personalNotesBlob = personalNotes.length > 0
    ? personalNotes.slice(0, 15).map((n) => {
        const tags = n.tags.length ? ` (${n.tags.join(", ")})` : "";
        const date = n.event_date ? ` [${n.event_date}]` : "";
        return `- ${n.body.replace(/\s+/g, " ").trim()}${tags}${date}`;
      }).join("\n")
    : "";

  const contactsBlob = recruiterContacts.length > 0
    ? recruiterContacts.map((c) => {
        const match = c.match_pct ? ` ${c.match_pct}%` : "";
        const sent = c.emailed_at ? " [SENT]" : "";
        return `- ${c.name} <${c.email}> @ ${c.company || "?"}${c.role_pitched ? ` — ${c.role_pitched}` : ""}${match}${sent}`;
      }).join("\n")
    : "";

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

  const factsBlock = await buildFactsContext();
  const system = `You are Krishna Amarneni's personal AI assistant inside Krishna's portfolio admin. You answer Krishna's questions about himself, his work, his book, his published notes, and his money.

Voice: direct, factual, second-person ("you", not "Krishna"). Concise. If a fact isn't in the data or tools you have access to, say so plainly.
${factsBlock ? `\n# Your facts (always-on memory)\n${factsBlock}\n` : ""}

# About Krishna
${about}

# Work history
${jobsBlob || "(none on file)"}

# Featured projects
${projectsBlob || "(none on file)"}

# Published notes
${notesBlob || "(none yet)"}

${personalNotesBlob ? `# Personal notes (Life cockpit)\n${personalNotesBlob}\n` : ""}
${contactsBlob ? `# Recruiter contacts (saved from inbox scans)\n${contactsBlob}\n` : ""}
# Your built-in tools
You have these tools available — USE THEM when Krishna asks about emails, contacts, or sending messages:
- lucy__search_inbox: Search Gmail. Use for "check my email", "any new recruiter emails", etc.
- lucy__list_contacts: List saved recruiter contacts.
- lucy__save_contact: Save a recruiter's info.
- lucy__send_email: Send an email. ALWAYS confirm with Krishna before sending. Draft the email first, show it, then send only after he approves.

${restBlob ? `# Connected services (snapshots)\n${restBlob}\n` : ""}${mcpBlob ? `\n# Connected services (tools)\n${mcpBlob}\n\nPrefer tools over guesses. When you call a tool, pass the result back through the conversation honestly. Quote specific numbers from the tool output.\n` : ""}`;

  // Compose Groq messages + tool list
  const groqTools: Array<{
    type: "function";
    function: { name: string; description?: string; parameters: Record<string, unknown> };
  }> = [];

  // Lucy's built-in tools — auto-loaded from central registry.
  // Add a tool to src/lib/mcp-tools.ts and it appears here + MCP + Settings.
  groqTools.push(...getGroqTools());

  // MCP connector tools
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
        const finalText = reply.content ?? "";
        if (finalText) {
          await appendMessage(thread.id, {
            role: "assistant",
            content: finalText,
          }).catch(() => undefined);
        }
        return NextResponse.json({ reply: finalText, thread_id: thread.id });
      }
      // Append the assistant message that requested the tools.
      loop.push({
        role: "assistant",
        content: reply.content ?? null,
        tool_calls: toolCalls,
      });
      // Execute each tool call.
      for (const call of toolCalls) {
        const fullName = call.function.name;
        let resultJson: string;

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }

        // ── Lucy built-in tools ──
        if (fullName === "lucy__list_contacts") {
          const contacts = await listContacts().catch(() => []);
          resultJson = JSON.stringify(contacts.map((c) => ({
            name: c.name, email: c.email, company: c.company,
            role: c.role_pitched, match: c.match_pct,
            starred: c.starred, emailed: !!c.emailed_at,
          }))).slice(0, 12000);

        } else if (fullName === "lucy__save_contact") {
          try {
            const saved = await upsertContact({
              name: (args.name as string) || "",
              email: (args.email as string) || "",
              company: (args.company as string) || null,
              role_pitched: (args.role_pitched as string) || null,
              match_pct: typeof args.match_pct === "number" ? args.match_pct : null,
              source: "chat",
            });
            resultJson = JSON.stringify({ ok: true, saved: { name: saved.name, email: saved.email } });
          } catch (err) {
            resultJson = JSON.stringify({ error: err instanceof Error ? err.message : "Save failed" });
          }

        } else if (fullName === "lucy__search_inbox") {
          const { messages: emails, error: gmailErr } = await listRecentMessages({
            query: (args.query as string) || "newer_than:3d",
            maxResults: typeof args.max_results === "number" ? args.max_results : 10,
          });
          if (gmailErr) {
            resultJson = JSON.stringify({ error: gmailErr });
          } else {
            resultJson = JSON.stringify(emails.map((m) => ({
              from: m.from, subject: m.subject, date: m.date, snippet: m.snippet,
            }))).slice(0, 12000);
          }

        } else if (fullName === "lucy__send_email") {
          const to = (args.to as string) || "";
          const subject = (args.subject as string) || "";
          const bodyText = (args.body as string) || "";
          if (!to || !subject || !bodyText) {
            resultJson = JSON.stringify({ error: "to, subject, and body are required" });
          } else {
            const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:20px">
<p>${bodyText.replace(/\n/g, "<br>")}</p>
<p>Krishna Amarneni<br><a href="https://krishnaamarneni.com" style="color:#ff6b00">krishnaamarneni.com</a></p>
</body></html>`;
            const send = await sendEmailUnified({ to, subject, html, text: bodyText });
            resultJson = JSON.stringify({ ok: send.ok, provider: send.provider, error: send.error });
          }

        } else {
          // ── MCP tool call ──
          const sep = fullName.indexOf("__");
          const connId = sep > 0 ? fullName.slice(0, sep) : "";
          const toolName = sep > 0 ? fullName.slice(sep + 2) : fullName;
          const handle = mcpHandles.find((h) => h.connector.id === connId);
          if (!handle) {
            resultJson = JSON.stringify({ error: `No MCP handle for ${connId}` });
          } else {
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
    const finalReply = final.choices[0]?.message?.content ?? "";
    if (finalReply) {
      await appendMessage(thread.id, {
        role: "assistant",
        content: finalReply,
      }).catch(() => undefined);
    }
    return NextResponse.json({
      reply: finalReply,
      thread_id: thread.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
