import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import {
  queryListings,
  updateListingStatus,
  upsertListing,
  getListingStats,
  type ListingsQuery,
} from "@/lib/job-finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUS = ["new", "saved", "ignored", "applied", "expired"];
const MIGRATION_HINT = "Run supabase/job_finder.sql in Supabase to enable the Job Finder.";

function isMissingTable(message?: string) {
  return /does not exist|schema cache|relation/i.test(message ?? "");
}

/** GET — discovered listings + status counts. */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const q: ListingsQuery = {
    status: sp.get("status") ?? "active",
    search: sp.get("search") ?? undefined,
    company: sp.get("company") ?? undefined,
    location: sp.get("location") ?? undefined,
    work_type: sp.get("work_type") ?? undefined,
    min_score: sp.get("min_score") ? Number(sp.get("min_score")) : undefined,
    source_type: sp.get("source_type") ?? undefined,
    fresh_hours: sp.get("fresh_hours") ? Number(sp.get("fresh_hours")) : undefined,
    sort: (sp.get("sort") as ListingsQuery["sort"]) ?? "newest",
    limit: sp.get("limit") ? Number(sp.get("limit")) : 50,
    offset: sp.get("offset") ? Number(sp.get("offset")) : 0,
  };

  try {
    const { listings, total, error } = await queryListings(q);
    if (error) {
      const missing = isMissingTable(error);
      return NextResponse.json({
        listings: [],
        total: 0,
        stats: {},
        needsMigration: missing,
        error: missing ? MIGRATION_HINT : error,
      });
    }
    const stats = await getListingStats();
    return NextResponse.json({ listings, total, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json(
      { listings: [], total: 0, stats: {}, needsMigration: isMissingTable(message), error: message },
      { status: isMissingTable(message) ? 200 : 500 }
    );
  }
}

type PostBody = {
  action?: "status" | "notes" | "import" | "bulk-status";
  id?: string;
  ids?: string[];
  status?: string;
  notes?: string;
  priority?: string;
  listings?: Array<{
    title: string;
    application_url: string;
    company?: string;
    location?: string;
    work_type?: string;
    description?: string;
    salary_range?: string;
    posted_at?: string;
    source_type?: string;
    source_id?: string;
    match_score?: number;
  }>;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;

  try {
    if (body.action === "status") {
      if (!body.id || !VALID_STATUS.includes(body.status ?? "")) {
        return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
      }
      await updateListingStatus(body.id, body.status!, body.priority ? { priority: body.priority } : undefined);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "bulk-status") {
      if (!body.ids?.length || !VALID_STATUS.includes(body.status ?? "")) {
        return NextResponse.json({ error: "ids and a valid status are required" }, { status: 400 });
      }
      for (const id of body.ids.slice(0, 200)) {
        await updateListingStatus(id, body.status!);
      }
      return NextResponse.json({ ok: true, updated: body.ids.length });
    }

    if (body.action === "notes") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const db = requireSupabaseAdmin();
      const { error } = await db
        .from("job_listings")
        .update({ notes: body.notes ?? "", updated_at: new Date().toISOString() })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Ingest listings discovered elsewhere (Jobs Scout agent, crawler, manual paste).
    if (body.action === "import") {
      if (!body.listings?.length) {
        return NextResponse.json({ error: "listings array is required" }, { status: 400 });
      }
      let added = 0;
      let updated = 0;
      const failures: string[] = [];
      for (const raw of body.listings.slice(0, 200)) {
        if (!raw.title?.trim() || !raw.application_url?.trim()) continue;
        try {
          const res = await upsertListing({
            ...raw,
            title: raw.title.trim(),
            application_url: raw.application_url.trim(),
            source_type: raw.source_type ?? "manual",
            crawled_at: new Date().toISOString(),
          });
          if (res.isNew) added++;
          else updated++;
        } catch (err) {
          failures.push(err instanceof Error ? err.message : "upsert failed");
        }
      }
      return NextResponse.json({ ok: true, added, updated, failures: failures.slice(0, 5) });
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
    const { error } = await db.from("job_listings").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
