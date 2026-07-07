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

  if (body.action === "sync-all") {
    const tokens = await getStoredTokens();
    if (!tokens?.access_token)
      return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

    const { listContacts } = await import("@/lib/contacts");
    const contacts = await listContacts();
    const limit = typeof body.limit === "number" ? body.limit : 50;
    const batch = contacts.slice(0, limit);

    let synced = 0;
    let enriched = 0;
    let errors = 0;

    for (const contact of batch) {
      try {
        const result = await syncThreadsForContact(contact, tokens.email || undefined);
        synced += result.synced;
        enriched += result.enriched;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      contactsProcessed: batch.length,
      threadsSynced: synced,
      enriched,
      errors,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
