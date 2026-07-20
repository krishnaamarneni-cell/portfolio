import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { getEmailTrackingStats, scanBulkResponses } from "@/lib/email-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET -> aggregate response/deliverability stats for the CRM dashboard. */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = Number(new URL(request.url).searchParams.get("days") ?? 365);
  try {
    const stats = await getEmailTrackingStats({ lookbackDays: Number.isFinite(days) ? days : 365 });
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}

type PostBody = {
  action?: "scan" | "prune";
  lookbackDays?: number;
  /** for prune: contact ids to exclude from future bulk sends */
  contactIds?: string[];
};

/**
 * POST { action: "scan" }  -> reconcile sends against the mailbox
 * POST { action: "prune" } -> exclude dead addresses from future bulk sends
 *
 * Prune is deliberately non-destructive: it sets excluded_from_bulk rather than
 * deleting contacts, so a false-positive bounce is always recoverable.
 */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const action = body.action ?? "scan";

  try {
    if (action === "scan") {
      const result = await scanBulkResponses({ lookbackDays: body.lookbackDays });
      return NextResponse.json(result);
    }

    if (action === "prune") {
      const db = requireSupabaseAdmin();
      const ids = (body.contactIds ?? []).filter(Boolean);
      let target = ids;

      // No explicit list -> prune everything currently flagged as bounced.
      if (target.length === 0) {
        const { data } = await db
          .from("recruiter_contacts")
          .select("id")
          .eq("bounced", true)
          .eq("excluded_from_bulk", false);
        target = (data ?? []).map((r: { id: string }) => r.id);
      }

      if (target.length === 0) {
        return NextResponse.json({ pruned: 0 });
      }

      await db
        .from("recruiter_contacts")
        .update({ excluded_from_bulk: true, updated_at: new Date().toISOString() })
        .in("id", target);

      return NextResponse.json({ pruned: target.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    );
  }
}
