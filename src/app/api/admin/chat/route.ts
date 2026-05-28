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
import { resolveConnectorEndpoint } from "@/lib/connector-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

async function callConnector(c: Connector): Promise<unknown | null> {
  if (!c.enabled || !c.bearer_token) return null;
  const url = resolveConnectorEndpoint(c);
  if (!url) return null;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${c.bearer_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

function trim<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
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

  let body: { messages?: ChatMessage[] };
  try {
    body = (await request.json()) as { messages?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && m.content
  );
  if (messages.length === 0) {
    return NextResponse.json({ error: "Empty messages" }, { status: 400 });
  }

  // Build context
  const [jobs, projects, site, notes, connectors] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchProjects().catch(() => []),
    fetchSiteContent(),
    fetchAllThoughts().catch(() => []),
    fetchConnectors().catch(() => []),
  ]);

  const connectorData = await Promise.all(
    connectors.filter((c) => c.enabled).map(async (c) => ({
      label: c.label,
      id: c.id,
      data: await callConnector(c),
    }))
  );

  const aboutBlob = `${site.about.paragraph_one}\n${site.about.paragraph_two}`;
  const jobsBlob = trim(jobs, 10)
    .map(
      (j) =>
        `- ${j.title} @ ${j.company} (${j.period}, ${j.location}) — ${j.description}${j.highlights?.length ? "\n  Highlights: " + j.highlights.join("; ") : ""}`
    )
    .join("\n");
  const projectsBlob = trim(projects, 10)
    .map((p) => `- ${p.title} (${p.subtitle}): ${p.description}  [${p.link}]`)
    .join("\n");
  const notesBlob = trim(
    notes.filter((n) => n.published),
    8
  )
    .map((n) => `- ${n.title}: ${n.body}`)
    .join("\n");
  // Detect mixed currencies — e.g., Indian NSE/BSE tickers (.NS, .BO) priced
  // in INR but summed by some upstream APIs as if they were USD.
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
    const suffixes = [...nonUs].join(", ");
    return (
      `\n\n⚠ This snapshot contains holdings with non-US exchange suffixes (${suffixes}). ` +
      `The upstream API appears to sum those values as if they were USD even though ` +
      `they are likely denominated in another currency (e.g. .NS = NSE India, prices in INR). ` +
      `The "netWorth" field may therefore be inflated. When the user asks for totals, ` +
      `state the raw number, but ALSO add a one-line caveat about possible currency mixing ` +
      `and suggest checking the WealthClaude UI for the authoritative figure.`
    );
  }

  const connectorsBlob = connectorData
    .map((c) =>
      c.data
        ? `## ${c.label} (${c.id}) live snapshot:\n${JSON.stringify(c.data, null, 2).slice(0, 4000)}${describeConnectorRisks(c.data)}`
        : `## ${c.label} (${c.id}): connector enabled but no data returned`
    )
    .join("\n\n");

  const system = `You are Krishna Amarneni's personal AI assistant, running inside Krishna's portfolio admin.

You answer Krishna's questions about himself, his work, his book, his money, and his portfolio. You always speak directly to Krishna in second person ("you", not "Krishna"). Be concise, factual, and warm. Never invent numbers — if a fact isn't in the context below, say "I don't have that in your data."

# About Krishna
${aboutBlob}

# Work history
${jobsBlob || "(none on file)"}

# Featured projects
${projectsBlob || "(none on file)"}

# Published notes
${notesBlob || "(none yet)"}

${
  connectorsBlob
    ? `# Connected services\n${connectorsBlob}\n\nWhen the user asks about money, net worth, holdings, or anything financial, prefer the WealthClaude live snapshot above as the source of truth. Quote specific numbers and labels from that JSON.`
    : "# Connected services\n(none — add a connector under Admin → Connectors to enable live financial answers)"
}`;

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 1500,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Groq request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
