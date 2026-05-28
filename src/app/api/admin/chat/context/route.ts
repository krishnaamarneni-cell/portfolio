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

async function callConnector(c: Connector): Promise<ConnectorSnapshot> {
  if (!c.enabled) return { id: c.id, label: c.label, ok: false, error: "Disabled" };
  if (!c.bearer_token) {
    return { id: c.id, label: c.label, ok: false, error: "No bearer token" };
  }
  const url = `${c.base_url.replace(/\/+$/, "")}/api/agent/me`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${c.bearer_token}`,
        Accept: "application/json",
      },
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
          ? `Got a ${typeof snap.data === "object" && snap.data ? "JSON object" : "response"} from ${snap.label}`
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
