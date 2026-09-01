/**
 * Warm check-in outreach.
 *
 * Krishna has 83 recruiters who have actually replied to him at some point.
 * Left alone those relationships go quiet, and the people most able to put him
 * in front of a role forget he is looking. This writes to the ones who have
 * gone quiet — briefly, in his voice, saying what he is open to and asking what
 * they have.
 *
 * It reuses auto-reply's guards deliberately. Outbound mail needs every check
 * inbound replies get and one more besides: nobody asked for this message, so
 * the bar for sending is higher, not lower. In particular the visa check runs
 * with an empty "incoming" string, which means work-authorisation cannot appear
 * at all — there is no question here to be answering.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { sendEmail, getAccessToken } from "@/lib/gmail";
import { runAgent } from "@/lib/agents";
import { buildLearningContext } from "@/lib/email-learning";
import { isUnsendable } from "@/lib/unsendable";
import { replyIssues, sendWindowBlockReason, visaDisclosureIssue } from "@/lib/auto-reply-guards";
import {
  AVAILABILITY,
  MAX_OUTREACH_PER_DAY,
  outreachBlockReason,
  rankCandidates,
  type OutreachCandidate,
} from "@/lib/warm-outreach-rules";

const TABLE = "outreach_log";
const OWN_MAILBOX = process.env.GMAIL_USER || "krishna.amarneni@gmail.com";
const OWN_PHONE = "(203) 804-9291";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://krishnaamarneni.com";

const SIGNATURE_TEXT = `\n\nBest regards,\nKrishna Amarneni\n${OWN_PHONE}\nkrishnaamarneni.com`;
const SIGNATURE_HTML = `<div style="margin-top:18px;font-size:14px;color:#4b5563;line-height:1.6">
Best regards,<br><strong style="color:#1f2937">Krishna Amarneni</strong><br>
${OWN_PHONE}<br>
<a href="${SITE}" style="color:#ff6b00;text-decoration:none">krishnaamarneni.com</a>
</div>`;

export type OutreachResult = {
  eligible: number;
  sent: number;
  skipped: string[];
  errors: string[];
};

/** How many check-ins already went out today, UTC. Throws so callers fail closed. */
async function sentToday(): Promise<number> {
  const db = requireSupabaseAdmin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("sent_at", since.toISOString())
    .neq("status", "failed");
  if (error) throw new Error(`cannot read today's outreach count: ${error.message}`);
  return count ?? 0;
}

/** Last time each address was approached, for the cooldown. */
async function lastOutreachByEmail(): Promise<Map<string, string>> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from(TABLE)
    .select("contact_email,sent_at")
    .neq("status", "failed")
    .order("sent_at", { ascending: false });
  if (error) throw new Error(`cannot read outreach history: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const key = String(row.contact_email).toLowerCase();
    if (!map.has(key)) map.set(key, row.sent_at); // ordered desc, so first wins
  }
  return map;
}

/** Claim before sending, so a crash cannot produce a second approach. */
async function reserve(c: OutreachCandidate, subject: string): Promise<string | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from(TABLE)
    .insert({
      contact_email: c.email,
      contact_name: c.name ?? null,
      subject,
      status: "reserved",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id as string;
}

async function finish(
  id: string,
  outcome: { ok: true; body: string; threadId?: string } | { ok: false; error: string }
): Promise<void> {
  const db = requireSupabaseAdmin();
  const { error } = await db
    .from(TABLE)
    .update(
      outcome.ok
        ? { status: "sent", body_sent: outcome.body, gmail_thread_id: outcome.threadId ?? null }
        : { status: "failed", error: outcome.error }
    )
    .eq("id", id);
  if (error) console.error(`[warm-outreach] could not finalise ${id}: ${error.message}`);
}

function buildSystemPrompt(voiceBlock: string): string {
  return `You write a short check-in email from Krishna Amarneni to a recruiter he has spoken with before.

${AVAILABILITY}

This person replied to Krishna at some point and has since gone quiet. He is writing to stay on their radar and ask what they are working on now.

RULES:
- Under 90 words. This is a note, not a pitch.
- Open by name. One line acknowledging it has been a while — warm, not apologetic.
- Say plainly that he is looking now and what he is open to: relocation, and contract, contract-to-hire, full-time or internship.
- Ask what roles they are working on at the moment.
- Plain text only. No markdown, no bullet characters, no asterisks.
- No greeting line beyond "Hi <first name>," and NO sign-off — the signature is added automatically.
- NEVER invent a shared history: no past meetings, calls, placements or specifics you were not given.
- NEVER mention visa, CPT, OPT, H-1B, sponsorship or work authorisation. They have not asked.
- NEVER include references, anyone else's name, or any phone number.
- No links. No attachments are being sent.
- Do not say "I hope this email finds you well" or "I wanted to reach out".

${voiceBlock}

Output ONLY the email body. No subject line, no preamble.`;
}

/** A subject that reads like a person wrote it, not a campaign. */
function subjectFor(c: OutreachCandidate): string {
  return c.company ? `Checking in — ${c.company}` : "Checking in";
}

export async function runWarmOutreach(): Promise<OutreachResult> {
  const result: OutreachResult = { eligible: 0, sent: 0, skipped: [], errors: [] };

  const { getSettings } = await import("@/lib/briefing");
  const settings = await getSettings().catch(() => null);
  if (!(settings as { warm_outreach_enabled?: boolean } | null)?.warm_outreach_enabled) {
    result.skipped.push("warm outreach disabled (turn it on in Settings)");
    return result;
  }

  const closed = sendWindowBlockReason();
  if (closed) {
    result.skipped.push(closed);
    return result;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  if (!(await getAccessToken())) {
    result.errors.push("Gmail not connected");
    return result;
  }

  let todayCount: number;
  let lastOutreach: Map<string, string>;
  try {
    [todayCount, lastOutreach] = await Promise.all([sentToday(), lastOutreachByEmail()]);
  } catch (err) {
    result.errors.push(
      `${err instanceof Error ? err.message : "unknown"} — run supabase/warm_outreach.sql`
    );
    return result;
  }
  if (todayCount >= MAX_OUTREACH_PER_DAY) {
    result.skipped.push(`daily cap reached (${todayCount}/${MAX_OUTREACH_PER_DAY})`);
    return result;
  }

  const db = requireSupabaseAdmin();
  const { data: rows, error } = await db
    .from("recruiter_contacts")
    .select(
      "email,name,company,role_pitched,replied_count,last_replied_at,do_not_contact,bounced,excluded_from_bulk"
    )
    .gt("replied_count", 0);
  if (error) {
    result.errors.push(`cannot read contacts: ${error.message}`);
    return result;
  }

  const candidates: OutreachCandidate[] = (rows ?? []).map((r) => ({
    email: String(r.email ?? "").toLowerCase(),
    name: r.name,
    company: r.company,
    rolePitched: r.role_pitched,
    repliedCount: Number(r.replied_count ?? 0),
    lastRepliedAt: r.last_replied_at,
    lastOutreachAt: lastOutreach.get(String(r.email ?? "").toLowerCase()) ?? null,
    doNotContact: Boolean(r.do_not_contact),
    bounced: Boolean(r.bounced),
    excludedFromBulk: Boolean(r.excluded_from_bulk),
  }));

  const eligible = rankCandidates(
    candidates.filter((c) => {
      const reason = outreachBlockReason(c);
      if (reason) return false;
      if (isUnsendable(c.email)) return false;
      if (c.email === OWN_MAILBOX.toLowerCase()) return false;
      return true;
    })
  );
  result.eligible = eligible.length;
  if (eligible.length === 0) {
    result.skipped.push("nobody eligible — everyone is either in conversation or inside cooldown");
    return result;
  }

  const voiceBlock = await buildLearningContext().catch(() => "");
  const systemPrompt = buildSystemPrompt(voiceBlock);

  for (const c of eligible) {
    if (result.sent + todayCount >= MAX_OUTREACH_PER_DAY) break;

    const firstName = (c.name || "").split(" ")[0] || "there";
    const draft = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt,
      userPrompt: `Recruiter: ${c.name ?? "unknown"}${c.company ? ` at ${c.company}` : ""}
${c.rolePitched ? `They previously pitched: ${c.rolePitched}` : "No record of what they previously pitched."}
They last replied to Krishna ${c.lastRepliedAt ? `${Math.floor((Date.now() - new Date(c.lastRepliedAt).getTime()) / 86_400_000)} days ago` : "at an unknown date"}.`,
      maxTokens: 400,
    });
    if (!draft.ok || !draft.content) {
      result.skipped.push(`${c.email}: draft failed`);
      continue;
    }

    const body = draft.content.trim();
    const issues = replyIssues(body, {
      allowedHosts: ["krishnaamarneni.com", "linkedin.com"],
      ownEmails: [OWN_MAILBOX],
      ownPhones: [OWN_PHONE],
    });
    // Empty incoming text: nobody asked anything, so any work-authorisation
    // mention here is volunteering it.
    const visa = visaDisclosureIssue(body, "");
    if (visa) issues.push(visa);
    if (issues.length > 0) {
      result.skipped.push(`${c.email}: unsafe draft — ${issues[0]}`);
      continue;
    }

    const subject = subjectFor(c);
    const rowId = await reserve(c, subject);
    if (!rowId) {
      result.skipped.push(`${c.email}: could not reserve (already contacted?)`);
      continue;
    }

    const text = `Hi ${firstName},\n\n${body}${SIGNATURE_TEXT}`;
    const html = `<p>Hi ${firstName},</p><p>${body.replace(/\n/g, "<br>")}</p>${SIGNATURE_HTML}`;
    const send = await sendEmail({ to: c.email, subject, html, text });

    if (send.ok) {
      await finish(rowId, { ok: true, body: text });
      result.sent++;
    } else {
      await finish(rowId, { ok: false, error: send.error ?? "unknown" });
      result.errors.push(`${c.email}: ${send.error}`);
    }
  }

  return result;
}
