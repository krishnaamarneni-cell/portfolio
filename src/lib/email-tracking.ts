/**
 * Bulk-email response + deliverability tracking.
 *
 * The bulk sender records one `bulk_sends` row per recipient. This module is
 * the agent that later reconciles those sends against the mailbox:
 *   - who replied (so you know which contacts actually engage)
 *   - which addresses bounced (so dead ones can be pruned)
 *
 * Efficiency note: we deliberately do NOT query Gmail per contact. Two searches
 * are issued regardless of list size — one for recent inbound mail, one for
 * bounce notifications — then everything is matched in memory.
 */

import { requireSupabaseAdmin } from "@/lib/supabase";
import { listRecentMessages } from "@/lib/gmail";

export type BulkSendRow = {
  id: string;
  contact_id: string | null;
  email: string;
  name: string | null;
  subject: string | null;
  sent_at: string;
  replied: boolean;
  replied_at: string | null;
  reply_count: number;
  bounced: boolean;
  bounce_reason: string | null;
};

/** `"Name" <a@b.com>` / `a@b.com` -> `a@b.com` (lowercased). */
function parseAddress(from?: string): string | null {
  if (!from) return null;
  const angled = from.match(/<([^>]+)>/);
  const raw = (angled ? angled[1] : from).trim().toLowerCase();
  return raw.includes("@") ? raw : null;
}

function extractEmails(text: string): string[] {
  const found = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
  return found ? found.map((s) => s.toLowerCase()) : [];
}

function toTime(value?: string | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Record what a bulk run actually sent. Called per successful send so replies
 * and bounces can be attributed later. Never throws — tracking must not be able
 * to fail an email that already went out.
 */
export async function recordBulkSend(rows: Array<{
  contactId?: string | null;
  email: string;
  name?: string | null;
  subject?: string | null;
  providerMessageId?: string | null;
  campaign?: string | null;
}>): Promise<void> {
  if (rows.length === 0) return;
  try {
    const db = requireSupabaseAdmin();
    await db.from("bulk_sends").insert(
      rows.map((r) => ({
        contact_id: r.contactId ?? null,
        email: r.email.toLowerCase(),
        name: r.name ?? null,
        subject: r.subject ?? null,
        provider_message_id: r.providerMessageId ?? null,
        campaign: r.campaign ?? null,
        sent_at: new Date().toISOString(),
      }))
    );
  } catch {
    // Tracking is best-effort; the send itself already succeeded.
  }
}

export type ScanResult = {
  checked: number;
  newReplies: number;
  newBounces: number;
  repliedContacts: Array<{ email: string; name: string | null; at: string }>;
  bouncedContacts: Array<{ email: string; name: string | null; reason: string }>;
  error?: string;
};

/**
 * Reconcile outstanding sends against the mailbox.
 *
 * A send counts as "replied" when there is inbound mail from that address dated
 * after we sent. It counts as "bounced" when a mailer-daemon/postmaster failure
 * notice names the address.
 */
export async function scanBulkResponses(opts?: {
  lookbackDays?: number;
  maxSends?: number;
}): Promise<ScanResult> {
  const lookbackDays = Math.max(1, Math.min(120, opts?.lookbackDays ?? 45));
  const maxSends = Math.max(1, Math.min(2000, opts?.maxSends ?? 1000));
  const db = requireSupabaseAdmin();

  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const { data: pending } = await db
    .from("bulk_sends")
    .select("id, contact_id, email, name, subject, sent_at, replied, reply_count, bounced")
    .eq("replied", false)
    .eq("bounced", false)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(maxSends);

  const sends = (pending ?? []) as BulkSendRow[];
  if (sends.length === 0) {
    return { checked: 0, newReplies: 0, newBounces: 0, repliedContacts: [], bouncedContacts: [] };
  }

  // --- One query: recent inbound mail (excludes our own sent mail) ---
  const inbound = await listRecentMessages({
    query: `newer_than:${lookbackDays}d -in:sent -in:draft`,
    maxResults: 400,
  });
  if (inbound.error && inbound.messages.length === 0) {
    return {
      checked: sends.length,
      newReplies: 0,
      newBounces: 0,
      repliedContacts: [],
      bouncedContacts: [],
      error: inbound.error,
    };
  }

  // sender address -> { latest reply time, how many messages }
  const replies = new Map<string, { latest: number; count: number }>();
  for (const m of inbound.messages) {
    const addr = parseAddress(m.from);
    if (!addr) continue;
    const t = toTime(m.date);
    const prev = replies.get(addr);
    replies.set(addr, {
      latest: Math.max(prev?.latest ?? 0, t),
      count: (prev?.count ?? 0) + 1,
    });
  }

  // --- One query: bounce / delivery-failure notices ---
  const bounceMsgs = await listRecentMessages({
    query: `newer_than:${lookbackDays}d (from:mailer-daemon OR from:postmaster OR subject:"Delivery Status Notification" OR subject:"Undeliverable")`,
    maxResults: 150,
  });
  // failed address -> reason
  const bounced = new Map<string, string>();
  for (const m of bounceMsgs.messages) {
    const text = `${m.subject ?? ""} ${m.snippet ?? ""}`;
    const reason = (m.subject ?? "Delivery failure").slice(0, 200);
    for (const addr of extractEmails(text)) {
      // ignore the daemon's own address
      if (addr.includes("mailer-daemon") || addr.includes("postmaster")) continue;
      if (!bounced.has(addr)) bounced.set(addr, reason);
    }
  }

  const repliedContacts: ScanResult["repliedContacts"] = [];
  const bouncedContacts: ScanResult["bouncedContacts"] = [];
  const now = new Date().toISOString();

  for (const s of sends) {
    const addr = s.email.toLowerCase();
    const sentAt = toTime(s.sent_at);

    const bounceReason = bounced.get(addr);
    if (bounceReason) {
      await db
        .from("bulk_sends")
        .update({ bounced: true, bounce_reason: bounceReason, bounced_at: now, last_checked_at: now })
        .eq("id", s.id);
      if (s.contact_id) {
        await db
          .from("recruiter_contacts")
          .update({ bounced: true, bounce_reason: bounceReason, bounce_detected_at: now, updated_at: now })
          .eq("id", s.contact_id);
      }
      bouncedContacts.push({ email: addr, name: s.name, reason: bounceReason });
      continue;
    }

    const hit = replies.get(addr);
    // Only counts if the inbound mail landed AFTER we sent.
    if (hit && hit.latest > sentAt) {
      const repliedAt = new Date(hit.latest).toISOString();
      await db
        .from("bulk_sends")
        .update({
          replied: true,
          replied_at: repliedAt,
          reply_count: hit.count,
          last_checked_at: now,
        })
        .eq("id", s.id);

      if (s.contact_id) {
        const { data: c } = await db
          .from("recruiter_contacts")
          .select("replied_count")
          .eq("id", s.contact_id)
          .maybeSingle();
        await db
          .from("recruiter_contacts")
          .update({
            replied_count: ((c?.replied_count as number | undefined) ?? 0) + 1,
            last_replied_at: repliedAt,
            updated_at: now,
          })
          .eq("id", s.contact_id);
      }
      repliedContacts.push({ email: addr, name: s.name, at: repliedAt });
      continue;
    }

    await db.from("bulk_sends").update({ last_checked_at: now }).eq("id", s.id);
  }

  return {
    checked: sends.length,
    newReplies: repliedContacts.length,
    newBounces: bouncedContacts.length,
    repliedContacts,
    bouncedContacts,
  };
}

export type TrackingStats = {
  totalSent: number;
  uniqueContacts: number;
  replied: number;
  replyRate: number;
  bounced: number;
  awaiting: number;
  topResponders: Array<{ email: string; name: string | null; replies: number; lastRepliedAt: string | null }>;
  deadAddresses: Array<{ email: string; name: string | null; reason: string | null; contactId: string | null }>;
};

/** Aggregate view for the CRM dashboard. */
export async function getEmailTrackingStats(opts?: { lookbackDays?: number }): Promise<TrackingStats> {
  const db = requireSupabaseAdmin();
  const lookbackDays = Math.max(1, Math.min(365, opts?.lookbackDays ?? 90));
  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const { data } = await db
    .from("bulk_sends")
    .select("contact_id, email, name, replied, replied_at, reply_count, bounced, bounce_reason")
    .gte("sent_at", since)
    .limit(5000);

  const rows = (data ?? []) as Array<Partial<BulkSendRow> & { contact_id: string | null }>;
  const totalSent = rows.length;
  const uniqueContacts = new Set(rows.map((r) => (r.email ?? "").toLowerCase())).size;
  const replied = rows.filter((r) => r.replied).length;
  const bounced = rows.filter((r) => r.bounced).length;

  const responders = new Map<string, { name: string | null; replies: number; lastRepliedAt: string | null }>();
  for (const r of rows) {
    if (!r.replied || !r.email) continue;
    const key = r.email.toLowerCase();
    const prev = responders.get(key);
    responders.set(key, {
      name: r.name ?? prev?.name ?? null,
      replies: (prev?.replies ?? 0) + (r.reply_count || 1),
      lastRepliedAt:
        toTime(r.replied_at) > toTime(prev?.lastRepliedAt) ? r.replied_at ?? null : prev?.lastRepliedAt ?? null,
    });
  }

  const dead = new Map<string, { name: string | null; reason: string | null; contactId: string | null }>();
  for (const r of rows) {
    if (!r.bounced || !r.email) continue;
    dead.set(r.email.toLowerCase(), {
      name: r.name ?? null,
      reason: r.bounce_reason ?? null,
      contactId: r.contact_id ?? null,
    });
  }

  return {
    totalSent,
    uniqueContacts,
    replied,
    replyRate: totalSent > 0 ? Math.round((replied / totalSent) * 1000) / 10 : 0,
    bounced,
    awaiting: Math.max(0, totalSent - replied - bounced),
    topResponders: [...responders.entries()]
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.replies - a.replies)
      .slice(0, 50),
    deadAddresses: [...dead.entries()].map(([email, v]) => ({ email, ...v })).slice(0, 200),
  };
}
