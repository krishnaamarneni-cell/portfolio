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
export const maxDuration = 120;

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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
