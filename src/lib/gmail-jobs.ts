/**
 * Recruiter requirement emails as a job source.
 *
 * This is the one feed that cannot be bought or copied: staffing recruiters
 * email SAP and supply-chain requirements directly, often before the role is
 * posted anywhere, and frequently for roles that are never posted publicly at
 * all. For contract work it arrives earlier than any job board.
 *
 * Three things make it different from an ATS adapter:
 *
 *  - ONE EMAIL CAN CARRY SEVERAL ROLES. Bench-sales mail routinely lists five
 *    or ten requirements in one message, so extraction returns an array.
 *  - THERE IS NO APPLY URL. The application path IS replying to the recruiter,
 *    so the apply link is a mailto with a subject already written.
 *  - THE EMPLOYER IS AMBIGUOUS. The sender is an agency; the actual employer is
 *    the end client, which may or may not be named. Both are captured, and the
 *    client is preferred as the company when known.
 */
import "server-only";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import { listRecentMessages, getMessageFull } from "@/lib/gmail";
import { requireSupabaseAdmin } from "@/lib/supabase";

/**
 * Gmail query for likely requirement mail.
 *
 * Deliberately broad — recall matters more than precision here, because the
 * model discards non-jobs for free but a requirement that never gets fetched is
 * lost. `-from:me` drops the user's own replies in the same threads.
 */
export const REQUIREMENT_QUERY = [
  "-from:me",
  "-in:chats",
  "(",
  'subject:(requirement OR requirements OR "urgent need" OR "immediate need"',
  'OR "urgent requirement" OR c2c OR "corp to corp" OR "corp-to-corp"',
  'OR hotlist OR "direct client" OR "new position" OR "open position"',
  "OR opening OR openings OR consultant OR contract)",
  'OR "rate:" OR "duration:" OR "visa:" OR "location:"',
  ")",
].join(" ");

export type ParsedRequirement = {
  title: string;
  client: string | null;
  vendor: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  duration: string | null;
  rate: string | null;
  required_skills: string[];
  visa_notes: string | null;
  contact_email: string | null;
  contact_name: string | null;
};

const SYSTEM = `You read one email and extract every distinct job requirement in it.

Staffing recruiters often list several roles in a single email. Return one
object per role.

Return ONLY a JSON array. No prose, no markdown fences. Empty array [] if the
email contains no actual job requirement.

[{
  "title": "the role title",
  "client": "the end client / hiring company if named, else null",
  "vendor": "the staffing company sending this, if identifiable, else null",
  "location": "city, state or Remote — as written",
  "work_mode": "Remote | Hybrid | Onsite | null",
  "employment_type": "C2C | W2 | Full-time | Contract-to-hire | null",
  "duration": "e.g. 6 months, 12+ months, or null",
  "rate": "pay rate as written, or null",
  "required_skills": ["skills named in the requirement"],
  "visa_notes": "any visa/work-authorization constraint stated, else null",
  "contact_email": "reply-to address for this requirement if stated in the body",
  "contact_name": "recruiter name if stated"
}]

Return [] — not a guess — for: newsletters, job-board digests, interview
scheduling, timesheet or invoice mail, marketing, "hotlist" emails offering
THEIR consultants rather than requesting one, and anything where no specific
role is being sourced.

Never invent a rate, duration, location or client. Absent means null. A
fabricated rate is worse than no rate, because it gets quoted in a reply.`;

function parseArray(raw: string): ParsedRequirement[] {
  const block = raw.match(/\[[\s\S]*\]/);
  if (!block) return [];
  try {
    const arr = JSON.parse(block[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    const str = (v: unknown) =>
      typeof v === "string" && v.trim() && !/^(null|n\/a|none|unknown)$/i.test(v.trim())
        ? v.trim().slice(0, 200)
        : null;
    return arr
      .map((r) => {
        const o = r as Record<string, unknown>;
        const title = str(o.title);
        if (!title) return null;
        return {
          title,
          client: str(o.client),
          vendor: str(o.vendor),
          location: str(o.location),
          work_mode: str(o.work_mode),
          employment_type: str(o.employment_type),
          duration: str(o.duration),
          rate: str(o.rate),
          required_skills: Array.isArray(o.required_skills)
            ? o.required_skills.map(String).slice(0, 20)
            : [],
          visa_notes: str(o.visa_notes),
          contact_email: str(o.contact_email)?.toLowerCase() ?? null,
          contact_name: str(o.contact_name),
        } satisfies ParsedRequirement;
      })
      .filter((r): r is ParsedRequirement => r !== null);
  } catch {
    return [];
  }
}

/** "Jane Doe <jane@agency.com>" → both halves. */
function parseSender(from: string): { name: string | null; email: string | null } {
  const email = from.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0]?.toLowerCase() ?? null;
  const name = from.replace(/<[^>]*>/, "").replace(/["']/g, "").trim() || null;
  return { name, email };
}

export type EmailJobRow = {
  title: string;
  company: string | null;
  location: string | null;
  work_type: string | null;
  employment_type: string | null;
  description: string | null;
  required_skills: string[] | null;
  salary_range: string | null;
  application_url: string;
  external_id: string;
  source_type: string;
  source_url: string | null;
  posted_at: string | null;
  crawled_at: string;
};

/**
 * Turn one extracted requirement into a listing row.
 *
 * The apply URL is a mailto because that is genuinely how a C2C requirement is
 * answered — there is no form. It carries a subject so a reply starts correctly.
 */
export function toListingRow(
  req: ParsedRequirement,
  email: { id: string; from: string; subject: string; date: string; bodyText: string },
  index: number
): EmailJobRow | null {
  const sender = parseSender(email.from);
  const replyTo = req.contact_email ?? sender.email;
  if (!replyTo) return null; // no way to respond; not actionable

  const subject = `Re: ${req.title}${req.location ? ` — ${req.location}` : ""}`;
  const posted = Date.parse(email.date);

  // The end client is the real employer; the agency is the intermediary. Fall
  // back to the vendor so a card is never left with an empty company.
  const company = req.client ?? req.vendor ?? sender.name;

  const detail = [
    req.duration ? `Duration: ${req.duration}` : "",
    req.rate ? `Rate: ${req.rate}` : "",
    req.employment_type ? `Type: ${req.employment_type}` : "",
    req.visa_notes ? `Visa: ${req.visa_notes}` : "",
    req.vendor && req.client ? `Via: ${req.vendor}` : "",
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    "",
    email.bodyText.slice(0, 5000),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: req.title,
    company,
    location: req.location,
    work_type: req.work_mode?.toLowerCase() ?? null,
    employment_type: req.employment_type,
    description: detail,
    required_skills: req.required_skills.length ? req.required_skills : null,
    salary_range: req.rate,
    application_url: `mailto:${replyTo}?subject=${encodeURIComponent(subject)}`,
    // Index suffix because one email legitimately yields several roles, and
    // each needs its own stable identity.
    external_id: `gmail:${email.id}:${index}`,
    source_type: "email",
    source_url: `https://mail.google.com/mail/u/0/#inbox/${email.id}`,
    posted_at: Number.isNaN(posted) ? null : new Date(posted).toISOString(),
    crawled_at: new Date().toISOString(),
  };
}

/** Remember the recruiter so the contact ecosystem knows who sourced what. */
async function rememberRecruiter(
  req: ParsedRequirement,
  from: string
): Promise<void> {
  const sender = parseSender(from);
  const email = req.contact_email ?? sender.email;
  if (!email) return;
  try {
    const db = requireSupabaseAdmin();
    const { data: existing } = await db
      .from("recruiter_contacts")
      .select("id,role_pitched")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Keep the most recent pitch — it is what the contact matcher reads.
      await db
        .from("recruiter_contacts")
        .update({ role_pitched: req.title, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      return;
    }
    await db.from("recruiter_contacts").insert({
      email,
      name: req.contact_name ?? sender.name ?? "",
      company: req.vendor,
      role_pitched: req.title,
      source: "email-requirement",
    });
  } catch {
    // Contact enrichment is a bonus; never fail a scan over it.
  }
}

export type ScanResult = {
  emailsChecked: number;
  emailsWithJobs: number;
  requirementsFound: number;
  rows: EmailJobRow[];
  errors: string[];
};

/**
 * Scan recent mail and extract requirements. Does not write listings — the
 * caller decides that, so this stays testable and the dedup rules live in one
 * place.
 */
export async function scanRequirementEmails(opts: {
  apiKey: string;
  days?: number;
  maxEmails?: number;
  /** Stop starting new extractions past this timestamp. */
  deadline?: number;
}): Promise<ScanResult> {
  const days = Math.max(1, Math.min(60, opts.days ?? 7));
  const maxEmails = Math.max(1, Math.min(120, opts.maxEmails ?? 40));
  const errors: string[] = [];

  const { messages, error } = await listRecentMessages({
    query: `${REQUIREMENT_QUERY} newer_than:${days}d`,
    maxResults: maxEmails,
  });
  if (error) return { emailsChecked: 0, emailsWithJobs: 0, requirementsFound: 0, rows: [], errors: [error] };

  const rows: EmailJobRow[] = [];
  let checked = 0;
  let withJobs = 0;

  for (const summary of messages) {
    if (opts.deadline && Date.now() > opts.deadline) break;

    const full = await getMessageFull(summary.id);
    if (!full) continue;
    checked++;

    const body = (full.bodyText || full.snippet || "").slice(0, 12000);
    if (body.trim().length < 40) continue;

    const result = await runAgent({
      apiKey: opts.apiKey,
      model: resolveAgentModel(null),
      systemPrompt: SYSTEM,
      userPrompt: `From: ${full.from}\nSubject: ${full.subject}\nDate: ${full.date}\n\n${body}`,
      maxTokens: 1600,
    });

    if (!result.ok || !result.content) {
      errors.push(`${full.subject.slice(0, 40)}: ${result.error ?? "no response"}`);
      continue;
    }

    const reqs = parseArray(result.content);
    if (!reqs.length) continue;
    withJobs++;

    for (const [i, req] of reqs.entries()) {
      const row = toListingRow(req, full, i);
      if (row) rows.push(row);
      await rememberRecruiter(req, full.from);
    }
  }

  return {
    emailsChecked: checked,
    emailsWithJobs: withJobs,
    requirementsFound: rows.length,
    rows,
    errors: errors.slice(0, 5),
  };
}
