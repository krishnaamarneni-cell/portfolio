import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecentMessages, type GmailMessageSummary } from "@/lib/gmail";
import { upsertMany, type RecruiterContactInput } from "@/lib/contacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Keywords that indicate a job/recruiter email. */
const JOB_KEYWORDS =
  /job|hiring|opportunity|role|position|engineer|consultant|recruiter|opening|resume|cv|interview|offer|career|vacancy|talent|staffing|apply|candidate/i;

/** Parse "Name <email>" from Gmail From field. */
function parseFrom(from: string): { name: string; email: string } | null {
  const match = from.match(/^(.+?)\s*<(.+?)>/);
  if (match) {
    return {
      name: match[1].replace(/"/g, "").trim(),
      email: match[2].trim().toLowerCase(),
    };
  }
  // Bare email
  if (from.includes("@")) {
    return { name: from.split("@")[0], email: from.toLowerCase() };
  }
  return null;
}

/** Skip noreply, automated, and known non-human senders. */
function isHuman(email: string): boolean {
  const skip = [
    "noreply",
    "no-reply",
    "donotreply",
    "mailer-daemon",
    "notifications",
    "updates@",
    "newsletter",
    "marketing",
    "support@",
    "info@",
    "hello@",
    "team@",
    "admin@",
  ];
  return !skip.some((s) => email.includes(s));
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { maxEmails?: number };
  const maxEmails = Math.min(body.maxEmails ?? 500, 500);

  // Pull ALL emails (paginated).
  const { messages, error } = await listRecentMessages({
    query: "in:inbox",
    maxResults: maxEmails,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 502 });
  }

  // Filter job-related emails.
  const jobMessages: GmailMessageSummary[] = [];
  for (const m of messages) {
    const text = `${m.subject ?? ""} ${m.snippet ?? ""} ${m.from ?? ""}`;
    if (JOB_KEYWORDS.test(text)) {
      jobMessages.push(m);
    }
  }

  // Extract unique contacts.
  const contactMap = new Map<
    string,
    { name: string; email: string; subjects: string[] }
  >();

  for (const m of jobMessages) {
    if (!m.from) continue;
    const parsed = parseFrom(m.from);
    if (!parsed || !parsed.email.includes("@")) continue;
    if (!isHuman(parsed.email)) continue;

    const existing = contactMap.get(parsed.email);
    if (existing) {
      if (m.subject) existing.subjects.push(m.subject);
    } else {
      contactMap.set(parsed.email, {
        name: parsed.name,
        email: parsed.email,
        subjects: m.subject ? [m.subject] : [],
      });
    }
  }

  // Save to DB.
  const inputs: RecruiterContactInput[] = Array.from(contactMap.values()).map(
    (c) => ({
      name: c.name,
      email: c.email,
      company: null,
      role_pitched: c.subjects[0] || null,
      match_pct: null, // Deep scan doesn't score — too many to LLM-score
      source: "deep-scan",
      notes: c.subjects.length > 1 ? `${c.subjects.length} emails: ${c.subjects.slice(0, 3).join("; ")}` : null,
    })
  );

  let saved = 0;
  try {
    saved = await upsertMany(inputs);
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Save failed",
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    scanned: messages.length,
    jobEmails: jobMessages.length,
    uniqueContacts: contactMap.size,
    saved,
  });
}
