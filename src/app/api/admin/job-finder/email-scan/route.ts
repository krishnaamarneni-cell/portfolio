import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { scanRequirementEmails, type EmailJobRow } from "@/lib/gmail-jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Pull job requirements out of recruiter email into job_listings.
 *
 * Deduped on external_id ("gmail:<messageId>:<n>") rather than the apply URL,
 * because the apply URL is a mailto to the recruiter — several distinct
 * requirements from the same person share it, so URL keying would collapse them
 * into one. This is why job_source_v2.sql is a prerequisite.
 */

const MIGRATION_HINT =
  "Run supabase/job_source_v2.sql in Supabase — email requirements need the external_id column to deduplicate.";

/** Leave room to write results and respond. */
const BUDGET_MS = 45_000;

async function insertNew(rows: EmailJobRow[]): Promise<{
  added: number;
  skipped: number;
  errors: string[];
  needsMigration: boolean;
}> {
  const db = requireSupabaseAdmin();
  const errors: string[] = [];
  if (!rows.length) return { added: 0, skipped: 0, errors, needsMigration: false };

  const ids = rows.map((r) => r.external_id);
  const { data: existing, error: selError } = await db
    .from("job_listings")
    .select("external_id")
    .in("external_id", ids);

  if (selError) {
    if (/external_id|column/i.test(selError.message)) {
      return { added: 0, skipped: 0, errors: [MIGRATION_HINT], needsMigration: true };
    }
    return { added: 0, skipped: 0, errors: [selError.message], needsMigration: false };
  }

  const seen = new Set((existing ?? []).map((r) => r.external_id));
  const fresh = rows.filter((r) => !seen.has(r.external_id));
  if (!fresh.length) return { added: 0, skipped: rows.length, errors, needsMigration: false };

  let added = 0;
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100);
    const { data, error } = await db.from("job_listings").insert(chunk).select("id");
    if (error) errors.push(error.message);
    else added += data?.length ?? 0;
  }
  return { added, skipped: rows.length - fresh.length, errors: errors.slice(0, 3), needsMigration: false };
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    days?: number;
    maxEmails?: number;
  };

  try {
    const scan = await scanRequirementEmails({
      apiKey,
      days: body.days,
      maxEmails: body.maxEmails,
      deadline: Date.now() + BUDGET_MS,
    });

    if (scan.errors.some((e) => /Gmail not connected/i.test(e))) {
      return NextResponse.json(
        { error: "Gmail is not connected. Connect it under Settings first." },
        { status: 400 }
      );
    }

    const write = await insertNew(scan.rows);

    return NextResponse.json({
      ok: !write.needsMigration,
      emailsChecked: scan.emailsChecked,
      emailsWithJobs: scan.emailsWithJobs,
      requirementsFound: scan.requirementsFound,
      added: write.added,
      skipped: write.skipped,
      needsMigration: write.needsMigration,
      errors: [...scan.errors, ...write.errors].slice(0, 5),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    const missing = /external_id|does not exist|schema cache|column/i.test(message);
    return NextResponse.json(
      { error: missing ? MIGRATION_HINT : message, needsMigration: missing },
      { status: 500 }
    );
  }
}
