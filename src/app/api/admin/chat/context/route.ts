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
import { looksLikeMcp } from "@/lib/mcp";
import { getAccount, getChannels } from "@/lib/buffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConnectorSnapshot = {
  id: string;
  label: string;
  ok: boolean;
  status?: number;
  error?: string;
  data?: unknown;
};

function looksLikeBuffer(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith("buffer.com") || host.endsWith("bufferapp.com");
  } catch {
    return false;
  }
}

async function callConnector(c: Connector): Promise<ConnectorSnapshot> {
  if (!c.enabled) return { id: c.id, label: c.label, ok: false, error: "Disabled" };
  if (!c.bearer_token) {
    return { id: c.id, label: c.label, ok: false, error: "No bearer token" };
  }
  const { url, headers } = resolveConnectorCall(c);
  if (!url) {
    return { id: c.id, label: c.label, ok: false, error: "No endpoint URL" };
  }

  // Buffer's API is GraphQL — call /account via the helper rather than
  // GET-ing a random URL, so the Test button works regardless of what the
  // user pasted in the endpoint field.
  if (looksLikeBuffer(url)) {
    try {
      const account = await getAccount(c.bearer_token);
      if (!account) {
        return { id: c.id, label: c.label, ok: false, error: "Buffer rejected token" };
      }
      const channels = await getChannels(c.bearer_token);
      return {
        id: c.id,
        label: c.label,
        ok: true,
        data: {
          account: { name: account.name, email: account.email },
          organization: account.organizations?.[0] ?? null,
          channels: channels.map((ch) => ({
            id: ch.id,
            service: ch.service,
            displayName: ch.displayName,
          })),
        },
      };
    } catch (err) {
      return {
        id: c.id,
        label: c.label,
        ok: false,
        error: err instanceof Error ? err.message : "fetch failed",
      };
    }
  }

  try {
    if (looksLikeMcp(url)) {
      // MCP endpoints need a POST JSON-RPC call to truly verify the token.
      // A plain GET bypasses auth and always returns 200.
      const r = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        cache: "no-store",
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        let msg = `Auth failed (${r.status})`;
        try { const j = JSON.parse(body); if (j.error?.message) msg = j.error.message; } catch {}
        return { id: c.id, label: c.label, ok: false, status: r.status, error: msg };
      }
      const data = await r.json().catch(() => null);
      if (data?.error) {
        return { id: c.id, label: c.label, ok: false, error: data.error.message || "MCP error" };
      }
      const toolCount = data?.result?.tools?.length ?? 0;
      return { id: c.id, label: c.label, ok: true, status: r.status, data: { toolCount } };
    }

    const r = await fetch(url, {
      headers,
      cache: "no-store",
    });
    if (!r.ok) {
      return {
        id: c.id,
        label: c.label,
        ok: false,
        status: r.status,
        error: `Upstream returned ${r.status}`,
      };
    }
    const data = await r.json().catch(() => null);
    return { id: c.id, label: c.label, ok: true, status: r.status, data };
  } catch (err) {
    return {
      id: c.id,
      label: c.label,
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

/**
 * POST /api/admin/chat/context
 *
 * Body:
 *   { probeConnector?: string }  -> only probe one connector (used by the
 *                                  Connectors test button)
 *
 * Returns the full chat context: jobs, projects, site about, published
 * notes, plus a snapshot of each enabled connector.
 */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { probeConnector?: string } = {};
  try {
    body = (await request.json()) as { probeConnector?: string };
  } catch {
    // ok, no body
  }

  try {
    const connectors = await fetchConnectors();

    // Probe path for the test button
    if (body.probeConnector) {
      const c = connectors.find((x) => x.id === body.probeConnector);
      if (!c) {
        return NextResponse.json({ ok: false, error: "Connector not found" });
      }
      const snap = await callConnector(c);
      return NextResponse.json({
        ok: snap.ok,
        error: snap.error,
        summary: snap.ok
          ? (snap.data as any)?.toolCount != null
            ? `MCP connected — ${(snap.data as any).toolCount} tools available from ${snap.label}`
            : `Got a ${typeof snap.data === "object" && snap.data ? "JSON object" : "response"} from ${snap.label}`
          : undefined,
      });
    }

    const [jobs, projects, site, notes] = await Promise.all([
      fetchJobs(),
      fetchProjects(),
      fetchSiteContent(),
      fetchAllThoughts().catch(() => []),
    ]);
    const snapshots = await Promise.all(
      connectors.filter((c) => c.enabled).map((c) => callConnector(c))
    );

    return NextResponse.json({
      ok: true,
      jobs,
      projects,
      site: {
        hero: site.hero,
        about: site.about,
        skills: site.skills,
        book: {
          title: site.book.title,
          subtitle: site.book.subtitle,
          intro: site.book.intro,
          chapters: site.book.chapters,
        },
      },
      notes: notes.map((n) => ({
        title: n.title,
        body: n.body,
        tags: n.tags,
        published: n.published,
      })),
      connectors: snapshots,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
