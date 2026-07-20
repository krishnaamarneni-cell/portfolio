/**
 * Bulk-email response + deliverability tracking.
 *
 * Two sources are reconciled against the mailbox:
 *   1. `bulk_sends` — one row per recipient, written by the bulk sender. Precise,
 *      but only covers sends made after this feature existed.
 *   2. `recruiter_contacts.emailed_at` — the historical record. Lets the scan work
 *      RETROACTIVELY on everything emailed before tracking was added.
 *
 * A bounce in Gmail is proof an address is dead regardless of how it was sent, so
 * bounce detection deliberately does not require a `bulk_sends` row.
 *
 * Efficiency: two Gmail searches total regardless of list size (recent inbound +
 * bounce notices), matched in memory — never one query per contact.
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

function toTime(value?: string | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Pull the FAILED RECIPIENT out of a bounce notice.
 *
 * Deliberately narrow: bounce bodies also contain the sender, support links and
 * help-centre addresses, so extracting every address in the text would mark good
 * contacts as dead. We only accept an address that follows an explicit
 * delivery-failure phrase, e.g.
 *   "Your message wasn't delivered to notify@oorwindigital.com because ..."
 *   "Your message couldn't be delivered to jobs@my.theladders.com because ..."
 */
export function extractFailedRecipients(text: string): string[] {
  const out = new Set<string>();
  const patterns = [
    // "…wasn't delivered to X", "…couldn't be delivered to X", "Delivery to X failed".
    // Deliberately keyed on "deliver(ed) to" rather than the negation word: Gmail
    // renders a CURLY apostrophe (U+2019) in "wasn't"/"couldn't", so matching the
    // contraction misses every real Gmail bounce.
    /deliver(?:ed|y)?\s+to:?\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/gi,
    /(?:recipient|address|to)\s*:?\s*<([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>\s*(?:not found|does not exist|unknown)/gi,
    /<([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>[^\n]{0,40}(?:550|551|553|user unknown|no such user|address not found)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const addr = m[1]?.toLowerCase();
      if (!addr) continue;
      if (addr.includes("mailer-daemon") || addr.includes("postmaster")) continue;
      out.add(addr);
    }
  }
  return [...out];
}

/**
 * Record what a bulk run actually sent. Never throws — tracking must not be able
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
    // Best-effort; the send itself already succeeded.
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
 * Replied  = inbound mail from that address dated after we emailed them.
 * Bounced  = a delivery-failure notice names that address.
 */
export async function scanBulkResponses(opts?: {
  lookbackDays?: number;
  maxSends?: number;
}): Promise<ScanResult> {
  const lookbackDays = Math.max(1, Math.min(365, opts?.lookbackDays ?? 90));
  const maxSends = Math.max(1, Math.min(5000, opts?.maxSends ?? 2000));
  const db = requireSupabaseAdmin();
  const empty = { repliedContacts: [], bouncedContacts: [] };

  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  // --- Source 1: precise per-send rows (post-feature) ---
  const { data: pendingRaw, error: sendsErr } = await db
    .from("bulk_sends")
    .select("id, contact_id, email, name, subject, sent_at, replied, reply_count, bounced")
    .eq("replied", false)
    .eq("bounced", false)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(maxSends);

  // Surface a missing table loudly instead of silently reporting "0 sends".
  if (sendsErr) {
    const missing = /does not exist|schema cache|relation/i.test(sendsErr.message ?? "");
    return {
      checked: 0,
      newReplies: 0,
      newBounces: 0,
      ...empty,
      error: missing
        ? "The bulk_sends table doesn't exist yet — run supabase/bulk_email_tracking.sql in the Supabase SQL editor."
        : sendsErr.message,
    };
  }
  const sends = (pendingRaw ?? []) as BulkSendRow[];

  // --- Source 2: historical contacts (pre-feature). Bounces/replies for these
  // are still discoverable in Gmail even though no bulk_sends row exists. ---
  const { data: contactsRaw } = await db
    .from("recruiter_contacts")
    .select("id, name, email, emailed_at, replied_count, bounced")
    .not("emailed_at", "is", null)
    .eq("bounced", false)
    .gte("emailed_at", since)
    .limit(maxSends);
  const contacts = (contactsRaw ?? []) as Array<{
    id: string;
    name: string | null;
    email: string;
    emailed_at: string | null;
    replied_count: number | null;
    bounced: boolean | null;
  }>;

  if (sends.length === 0 && contacts.length === 0) {
    return { checked: 0, newReplies: 0, newBounces: 0, ...empty };
  }

  // --- One query: recent inbound mail (excludes our own sent mail) ---
  const inbound = await listRecentMessages({
    query: `newer_than:${lookbackDays}d -in:sent -in:draft`,
    maxResults: 400,
  });

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

  // --- One query: delivery-failure notices ---
  const bounceMsgs = await listRecentMessages({
    query:
      `newer_than:${lookbackDays}d (from:mailer-daemon OR from:postmaster OR ` +
      `subject:"Delivery Status Notification" OR subject:"Undeliverable" OR ` +
      `subject:"Address not found" OR subject:"Message not delivered")`,
    maxResults: 250,
  });

  const bounced = new Map<string, string>();
  for (const m of bounceMsgs.messages) {
    const text = `${m.subject ?? ""} ${m.snippet ?? ""}`;
    for (const addr of extractFailedRecipients(text)) {
      if (!bounced.has(addr)) {
        const why = /couldn't be found|address not found|no such user|user unknown/i.test(text)
          ? "Address not found"
          : /misconfigured/i.test(text)
          ? "Remote server misconfigured"
          : "Delivery failed";
        bounced.set(addr, why);
      }
    }
  }

  if (inbound.error && bounceMsgs.error) {
    return {
      checked: sends.length + contacts.length,
      newReplies: 0,
      newBounces: 0,
      ...empty,
      error: inbound.error,
    };
  }

  const repliedContacts: ScanResult["repliedContacts"] = [];
  const bouncedContacts: ScanResult["bouncedContacts"] = [];
  const now = new Date().toISOString();
  const markedBounced = new Set<string>();
  const markedReplied = new Set<string>();

  // --- Pass 1: precise bulk_sends rows ---
  for (const s of sends) {
    const addr = s.email.toLowerCase();
    const reason = bounced.get(addr);
    if (reason) {
      await db
        .from("bulk_sends")
        .update({ bounced: true, bounce_reason: reason, bounced_at: now, last_checked_at: now })
        .eq("id", s.id);
      if (s.contact_id) {
        await db
          .from("recruiter_contacts")
          .update({ bounced: true, bounce_reason: reason, bounce_detected_at: now, updated_at: now })
          .eq("id", s.contact_id);
      }
      if (!markedBounced.has(addr)) {
        markedBounced.add(addr);
        bouncedContacts.push({ email: addr, name: s.name, reason });
      }
      continue;
    }

    const hit = replies.get(addr);
    if (hit && hit.latest > toTime(s.sent_at)) {
      const repliedAt = new Date(hit.latest).toISOString();
      await db
        .from("bulk_sends")
        .update({ replied: true, replied_at: repliedAt, reply_count: hit.count, last_checked_at: now })
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
      if (!markedReplied.has(addr)) {
        markedReplied.add(addr);
        repliedContacts.push({ email: addr, name: s.name, at: repliedAt });
      }
      continue;
    }

    await db.from("bulk_sends").update({ last_checked_at: now }).eq("id", s.id);
  }

  // --- Pass 2: historical contacts with no bulk_sends row ---
  for (const c of contacts) {
    const addr = (c.email ?? "").toLowerCase();
    if (!addr) continue;

    const reason = bounced.get(addr);
    if (reason && !markedBounced.has(addr)) {
      await db
        .from("recruiter_contacts")
        .update({ bounced: true, bounce_reason: reason, bounce_detected_at: now, updated_at: now })
        .eq("id", c.id);
      markedBounced.add(addr);
      bouncedContacts.push({ email: addr, name: c.name, reason });
      continue;
    }

    const hit = replies.get(addr);
    if (hit && !markedReplied.has(addr) && hit.latest > toTime(c.emailed_at)) {
      const repliedAt = new Date(hit.latest).toISOString();
      await db
        .from("recruiter_contacts")
        .update({
          replied_count: (c.replied_count ?? 0) + 1,
          last_replied_at: repliedAt,
          updated_at: now,
        })
        .eq("id", c.id);
      markedReplied.add(addr);
      repliedContacts.push({ email: addr, name: c.name, at: repliedAt });
    }
  }

  return {
    checked: sends.length + contacts.length,
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
  error?: string;
};

/**
 * Aggregate view. Unions the precise `bulk_sends` log with contact-level history
 * so retroactively-detected bounces/replies still show up.
 */
export async function getEmailTrackingStats(opts?: { lookbackDays?: number }): Promise<TrackingStats> {
  const db = requireSupabaseAdmin();
  const lookbackDays = Math.max(1, Math.min(365, opts?.lookbackDays ?? 90));
  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const base: TrackingStats = {
    totalSent: 0,
    uniqueContacts: 0,
    replied: 0,
    replyRate: 0,
    bounced: 0,
    awaiting: 0,
    topResponders: [],
    deadAddresses: [],
  };

  const { data: sendRows, error: sendsErr } = await db
    .from("bulk_sends")
    .select("contact_id, email, name, replied, replied_at, reply_count, bounced, bounce_reason")
    .gte("sent_at", since)
    .limit(5000);

  if (sendsErr) {
    const missing = /does not exist|schema cache|relation/i.test(sendsErr.message ?? "");
    return {
      ...base,
      error: missing
        ? "Run supabase/bulk_email_tracking.sql in Supabase to enable response tracking."
        : sendsErr.message,
    };
  }

  const { data: contactRows } = await db
    .from("recruiter_contacts")
    .select("id, name, email, emailed_at, replied_count, last_replied_at, bounced, bounce_reason")
    .not("emailed_at", "is", null)
    .limit(5000);

  const sends = (sendRows ?? []) as Array<Partial<BulkSendRow> & { contact_id: string | null }>;
  const contacts = (contactRows ?? []) as Array<{
    id: string;
    name: string | null;
    email: string;
    emailed_at: string | null;
    replied_count: number | null;
    last_replied_at: string | null;
    bounced: boolean | null;
    bounce_reason: string | null;
  }>;

  const sentSet = new Set<string>();
  for (const r of sends) if (r.email) sentSet.add(r.email.toLowerCase());
  for (const c of contacts) if (c.email) sentSet.add(c.email.toLowerCase());

  const responders = new Map<string, { name: string | null; replies: number; lastRepliedAt: string | null }>();
  for (const r of sends) {
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
  for (const c of contacts) {
    if (!c.replied_count || !c.email) continue;
    const key = c.email.toLowerCase();
    const prev = responders.get(key);
    if (prev) continue; // bulk_sends data is more precise
    responders.set(key, {
      name: c.name,
      replies: c.replied_count,
      lastRepliedAt: c.last_replied_at,
    });
  }

  const dead = new Map<string, { name: string | null; reason: string | null; contactId: string | null }>();
  for (const r of sends) {
    if (!r.bounced || !r.email) continue;
    dead.set(r.email.toLowerCase(), {
      name: r.name ?? null,
      reason: r.bounce_reason ?? null,
      contactId: r.contact_id ?? null,
    });
  }
  for (const c of contacts) {
    if (!c.bounced || !c.email) continue;
    const key = c.email.toLowerCase();
    if (!dead.has(key)) {
      dead.set(key, { name: c.name, reason: c.bounce_reason, contactId: c.id });
    }
  }

  const totalSent = sentSet.size;
  const replied = responders.size;
  const bounced = dead.size;

  return {
    totalSent,
    uniqueContacts: sentSet.size,
    replied,
    replyRate: totalSent > 0 ? Math.round((replied / totalSent) * 1000) / 10 : 0,
    bounced,
    awaiting: Math.max(0, totalSent - replied - bounced),
    topResponders: [...responders.entries()]
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.replies - a.replies)
      .slice(0, 100),
    deadAddresses: [...dead.entries()].map(([email, v]) => ({ email, ...v })).slice(0, 300),
  };
}
