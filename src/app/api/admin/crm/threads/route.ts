import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getCachedThreads,
  getAllThreads,
  getThreadDetail,
  syncThreadsForContact,
} from "@/lib/thread-sync";
import { getContact } from "@/lib/contacts";
import { getStoredTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const contactId = url.searchParams.get("contactId");
  const threadId = url.searchParams.get("threadId");
  const companyId = url.searchParams.get("companyId");
  const limit = Number(url.searchParams.get("limit")) || 50;

  if (threadId) {
    const thread = await getThreadDetail(threadId);
    return NextResponse.json({ thread });
  }

  if (contactId) {
    const threads = await getCachedThreads(contactId);
    return NextResponse.json({ threads });
  }

  const threads = await getAllThreads({ limit, companyId: companyId || undefined });
  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (body.action === "sync" && typeof body.contactId === "string") {
    const contact = await getContact(body.contactId);
    if (!contact)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const tokens = await getStoredTokens();
    const result = await syncThreadsForContact(
      contact,
      tokens?.email || undefined
    );
    return NextResponse.json(result);
  }

  if (body.action === "sync-all" || body.action === "sync-inbox") {
    const tokens = await getStoredTokens();
    if (!tokens?.access_token)
      return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

    const { listRecentThreadIds, getThread } = await import("@/lib/gmail");
    const { requireSupabaseAdmin } = await import("@/lib/supabase");
    const db = requireSupabaseAdmin();

    const days = typeof body.days === "number" ? body.days : 30;
    const maxThreads = typeof body.limit === "number" ? body.limit : 200;

    const { threadIds, error: listError } = await listRecentThreadIds({
      newerThanDays: days,
      maxResults: maxThreads,
    });

    if (listError) return NextResponse.json({ error: listError }, { status: 500 });

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const userEmail = (tokens.email || "").toLowerCase();

    for (const tid of threadIds) {
      try {
        const { data: existing } = await db
          .from("crm_email_threads")
          .select("id, synced_at")
          .eq("gmail_thread_id", tid)
          .maybeSingle();

        const staleMs = 60 * 60 * 1000;
        if (existing?.synced_at && Date.now() - new Date(existing.synced_at).getTime() < staleMs) {
          skipped++;
          continue;
        }

        const thread = await getThread(tid);
        if (!thread) { errors++; continue; }

        const firstFrom = thread.messages[0]?.from?.toLowerCase() || "";
        const direction = userEmail && firstFrom.includes(userEmail) ? "outbound" : "inbound";

        const participantEmails = thread.participants.map((p) => p.toLowerCase());
        const otherEmails = participantEmails.filter((e) => e !== userEmail);

        let contactId: string | null = null;
        let companyId: string | null = null;

        if (otherEmails.length > 0) {
          const { data: matchedContact } = await db
            .from("recruiter_contacts")
            .select("id, company_id")
            .in("email", otherEmails)
            .limit(1)
            .maybeSingle();
          if (matchedContact) {
            contactId = matchedContact.id;
            companyId = matchedContact.company_id;
          }
        }

        if (!companyId && otherEmails.length > 0) {
          const domain = otherEmails[0].split("@")[1];
          if (domain) {
            const { data: matchedCompany } = await db
              .from("crm_companies")
              .select("id")
              .eq("domain", domain)
              .maybeSingle();
            if (matchedCompany) companyId = matchedCompany.id;
          }
        }

        const row = {
          gmail_thread_id: tid,
          contact_id: contactId,
          company_id: companyId,
          subject: thread.subject,
          snippet: thread.snippet,
          message_count: thread.messageCount,
          last_message_at: thread.lastMessageAt || null,
          participants: thread.participants,
          direction,
          cached_messages: thread.messages as unknown as Record<string, unknown>[],
          synced_at: new Date().toISOString(),
        };

        if (existing) {
          await db.from("crm_email_threads").update(row).eq("id", existing.id);
        } else {
          await db.from("crm_email_threads").insert(row);
        }
        synced++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      threadIds: threadIds.length,
      synced,
      skipped,
      errors,
      days,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
