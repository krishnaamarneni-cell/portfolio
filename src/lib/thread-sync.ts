import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { getThread, listThreadsForContact } from "@/lib/gmail";
import { enrichFromMessages } from "@/lib/enrichment";
import type { RecruiterContact } from "@/lib/contacts";

const TABLE = "crm_email_threads";

export type CachedThread = {
  id: string;
  gmail_thread_id: string;
  contact_id: string | null;
  company_id: string | null;
  subject: string | null;
  snippet: string | null;
  message_count: number;
  last_message_at: string | null;
  participants: string[];
  direction: string;
  intent: string | null;
  intent_confidence: number | null;
  cached_messages: ThreadMessage[] | null;
  synced_at: string;
  created_at: string;
};

export type ThreadMessage = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
};

export async function getCachedThreads(
  contactId: string
): Promise<CachedThread[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false });
  return (data ?? []) as CachedThread[];
}

export async function getAllThreads(opts?: {
  limit?: number;
  companyId?: string;
}): Promise<CachedThread[]> {
  const supabase = requireSupabaseAdmin();
  let q = supabase
    .from(TABLE)
    .select("*")
    .order("last_message_at", { ascending: false });
  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as CachedThread[];
}

export async function getThreadDetail(
  threadId: string
): Promise<CachedThread | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", threadId)
    .maybeSingle();
  return (data as CachedThread | null) ?? null;
}

export async function getThreadByGmailId(
  gmailThreadId: string
): Promise<CachedThread | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("gmail_thread_id", gmailThreadId)
    .maybeSingle();
  return (data as CachedThread | null) ?? null;
}

function inferDirection(
  participants: string[],
  messages: ThreadMessage[],
  userEmail: string
): string {
  const first = messages[0];
  if (!first) return "unknown";
  const fromLower = first.from.toLowerCase();
  if (fromLower.includes(userEmail.toLowerCase())) return "outbound";
  return "inbound";
}

export async function syncThreadsForContact(
  contact: RecruiterContact,
  userEmail?: string
): Promise<{ synced: number; enriched: number }> {
  const { threadIds, error } = await listThreadsForContact(contact.email, 30);
  if (error || !threadIds.length) return { synced: 0, enriched: 0 };

  const supabase = requireSupabaseAdmin();
  let synced = 0;
  let enriched = 0;
  const allBodies: string[] = [];

  for (const tid of threadIds.slice(0, 20)) {
    const existing = await getThreadByGmailId(tid);
    const staleMs = 60 * 60 * 1000; // 1 hour
    if (
      existing?.synced_at &&
      Date.now() - new Date(existing.synced_at).getTime() < staleMs
    ) {
      continue;
    }

    const thread = await getThread(tid);
    if (!thread) continue;

    const direction = inferDirection(
      thread.participants,
      thread.messages,
      userEmail || ""
    );

    const row = {
      gmail_thread_id: tid,
      contact_id: contact.id,
      company_id: contact.company_id || null,
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
      await supabase
        .from(TABLE)
        .update(row)
        .eq("id", existing.id);
    } else {
      await supabase.from(TABLE).insert(row);
    }

    thread.messages.forEach((m) => {
      if (m.bodyText) allBodies.push(m.bodyText);
    });

    synced++;
  }

  if (allBodies.length > 0) {
    enriched = await enrichFromMessages(
      contact.id,
      contact,
      allBodies.slice(0, 10)
    );
  }

  if (synced > 0) {
    const latestThread = threadIds[0]
      ? await getThreadByGmailId(threadIds[0])
      : null;
    if (latestThread?.last_message_at) {
      await supabase
        .from("recruiter_contacts")
        .update({
          last_gmail_activity_at: latestThread.last_message_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id);
    }
  }

  return { synced, enriched };
}
