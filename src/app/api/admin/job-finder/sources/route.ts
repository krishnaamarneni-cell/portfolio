import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { CAREER_SITES } from "@/lib/company-careers";
import { ATS_SOURCES } from "@/lib/ats";
import type { JobSource } from "@/lib/job-finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIGRATION_HINT = "Run supabase/job_finder.sql in Supabase to enable the Job Finder.";

function isMissingTable(message?: string) {
  return /does not exist|schema cache|relation/i.test(message ?? "");
}

/** GET — approved crawl sources, plus the verified career-site directory for seeding. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("job_sources")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      const missing = isMissingTable(error.message);
      return NextResponse.json({
        sources: [],
        directory: [],
        needsMigration: missing,
        error: missing ? MIGRATION_HINT : error.message,
      });
    }

    const known = new Set((data ?? []).map((s) => s.careers_url.toLowerCase()));
    const directory = CAREER_SITES.map((site) => ({
      name: site.name,
      careers_url: site.careersUrl,
      ats: site.ats,
      sap_search_url: site.sapSearchUrl,
      account_required: site.accountRequired,
      added:
        known.has(site.careersUrl.toLowerCase()) ||
        known.has((site.sapSearchUrl ?? "").toLowerCase()),
    }));

    // The companies "Find jobs" actually searches. Hardcoded in job-sources.ts
    // and entirely independent of the job_sources table — surfaced here because
    // otherwise nothing in the UI shows what discovery really covers.
    // Read from the crawler's own registry so this can never drift from what is
    // actually searched — the earlier hand-built list silently omitted Lever,
    // Ashby and SmartRecruiters.
    const liveSources = ATS_SOURCES.map((s) => ({ company: s.company, ats: s.kind })).sort(
      (a, b) => a.company.localeCompare(b.company)
    );

    // Health for the live sources, so "Sources" can show what each one is
    // actually doing rather than implying the registry is the truth.
    let health: unknown[] = [];
    let lastCrawlAt: string | null = null;
    try {
      const { data: h } = await db
        .from("job_source_health")
        .select("company,kind,status,last_checked_at,last_jobs_found,total_jobs_found,last_error,consecutive_failures")
        .order("total_jobs_found", { ascending: false })
        .limit(200);
      health = h ?? [];
      for (const row of (h ?? []) as Array<{ last_checked_at: string | null }>) {
        if (row.last_checked_at && (!lastCrawlAt || row.last_checked_at > lastCrawlAt)) {
          lastCrawlAt = row.last_checked_at;
        }
      }
    } catch {
      // Health is additive; the tab still works without it.
    }

    return NextResponse.json({
      sources: (data ?? []) as JobSource[],
      directory,
      liveSources,
      health,
      lastCrawlAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { sources: [], directory: [], needsMigration: isMissingTable(message), error: message },
      { status: isMissingTable(message) ? 200 : 500 }
    );
  }
}

type PostBody = {
  action?: "add" | "update" | "toggle" | "seed";
  id?: string;
  name?: string;
  careers_url?: string;
  source_type?: string;
  ats?: string;
  crawl_frequency?: string;
  active?: boolean;
  /** Career-site directory names to add in one go. */
  names?: string[];
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;

  try {
    const db = requireSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.action === "add") {
      const url = body.careers_url?.trim();
      const name = body.name?.trim();
      if (!url || !name) {
        return NextResponse.json({ error: "name and careers_url are required" }, { status: 400 });
      }
      if (!/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "careers_url must be an http(s) URL" }, { status: 400 });
      }
      const { data, error } = await db
        .from("job_sources")
        .insert({
          name,
          careers_url: url,
          source_type: body.source_type ?? "crawler",
          ats: body.ats ?? null,
          crawl_frequency: body.crawl_frequency ?? "daily",
          active: body.active ?? true,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (error) {
        const dupe = /duplicate key|unique/i.test(error.message);
        return NextResponse.json(
          { error: dupe ? "That careers URL is already a source." : error.message },
          { status: dupe ? 409 : 500 }
        );
      }
      return NextResponse.json({ ok: true, id: data.id });
    }

    // Bulk-add from the verified career-site directory.
    if (body.action === "seed") {
      const wanted = new Set((body.names ?? []).map((n) => n.toLowerCase()));
      const picks = CAREER_SITES.filter((s) => wanted.has(s.name.toLowerCase()));
      if (!picks.length) return NextResponse.json({ error: "No matching sites" }, { status: 400 });

      // The unique index is on lower(careers_url), which Postgres upsert can't
      // target by column name — so de-dupe in code before inserting.
      const { data: existing } = await db.from("job_sources").select("careers_url");
      const taken = new Set((existing ?? []).map((r) => r.careers_url.toLowerCase()));

      const rows = picks
        .map((s) => ({
          name: s.name,
          careers_url: s.sapSearchUrl ?? s.careersUrl,
          source_type: "career_site",
          ats: s.ats,
          crawl_frequency: "daily",
          active: true,
          config: { account_required: s.accountRequired, base_careers_url: s.careersUrl },
          created_at: now,
          updated_at: now,
        }))
        .filter((r) => !taken.has(r.careers_url.toLowerCase()));

      if (!rows.length) return NextResponse.json({ ok: true, added: 0 });

      const { data, error } = await db.from("job_sources").insert(rows).select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, added: data?.length ?? 0 });
    }

    if (body.action === "update" || body.action === "toggle") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const patch: Record<string, unknown> = { updated_at: now };
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.careers_url !== undefined) patch.careers_url = body.careers_url.trim();
      if (body.crawl_frequency !== undefined) patch.crawl_frequency = body.crawl_frequency;
      if (body.active !== undefined) patch.active = body.active;
      if (body.ats !== undefined) patch.ats = body.ats;

      const { error } = await db.from("job_sources").update(patch).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json(
      { error: isMissingTable(message) ? MIGRATION_HINT : message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const db = requireSupabaseAdmin();
    const { error } = await db.from("job_sources").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
