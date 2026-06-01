/**
 * Auto-reply pipeline — scans Gmail for recruiter emails >70% match,
 * generates personalized reply, attaches resume, sends via Resend.
 * Tracks sent emails to prevent duplicates.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { listRecentMessages, type GmailMessageSummary } from "@/lib/gmail";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";
import { runAgent } from "@/lib/agents";
import { upsertContact } from "@/lib/contacts";

const TABLE = "replied_emails";

/** Check if we already replied to this email. */
async function alreadyReplied(messageId: string): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("id")
    .eq("gmail_message_id", messageId)
    .maybeSingle();
  return !!data;
}

/** Record that we replied to this email. */
async function markReplied(
  messageId: string,
  to: string,
  subject: string
): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from(TABLE).upsert({
    gmail_message_id: messageId,
    to_email: to,
    subject,
    sent_at: new Date().toISOString(),
  });
}

/** Parse "Name <email>" format from Gmail From field. */
function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>/);
  if (match) {
    return {
      name: match[1].replace(/"/g, "").trim(),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: from, email: from.toLowerCase() };
}

/** Check if an email is job-related based on subject + snippet. */
function isJobEmail(m: GmailMessageSummary): boolean {
  const text = `${m.subject ?? ""} ${m.snippet ?? ""}`.toLowerCase();
  return /job|hiring|opportunity|role|position|engineer|consultant|recruiter|opening|resume|cv|interview|offer/.test(
    text
  );
}

type AutoReplyResult = {
  scanned: number;
  jobEmails: number;
  matched: number;
  sent: number;
  skippedDuplicate: number;
  errors: string[];
};

/**
 * Main pipeline — called by the cron endpoint.
 * Scans last N hours of emails, finds job matches >70%, auto-replies.
 */
export async function runAutoReplyPipeline(): Promise<AutoReplyResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const result: AutoReplyResult = {
    scanned: 0,
    jobEmails: 0,
    matched: 0,
    sent: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  // Pull recent emails.
  const { messages, error } = await listRecentMessages({
    query: "newer_than:1d",
    maxResults: 30,
  });
  if (error) {
    result.errors.push(error);
    return result;
  }
  result.scanned = messages.length;

  // Filter job-related emails.
  const jobMessages = messages.filter(isJobEmail);
  result.jobEmails = jobMessages.length;
  if (jobMessages.length === 0) return result;

  // Pull resume for matching.
  const [jobs, site, factsBlock] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
    buildFactsContext(),
  ]);
  const experience = jobs
    .map((j) => `- ${j.title} @ ${j.company} (${j.period}, ${j.location})`)
    .join("\n");
  const skills = (site.skills?.skills ?? []).slice(0, 30);
  const resumeUrl = site.about?.resume_url || "/Krishna_Amarneni_Resume.docx";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krishnaamarneni.com";

  // Score each job email against resume.
  for (const msg of jobMessages) {
    const { name, email } = parseFrom(msg.from || "");
    if (!email.includes("@")) continue;

    // Skip if already replied.
    if (await alreadyReplied(msg.id).catch(() => false)) {
      result.skippedDuplicate++;
      continue;
    }

    // Ask LLM to score the match and generate a reply.
    const scoreResult = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: `You are a job-match scorer. Given a recruiter email and Krishna's resume, output ONLY a JSON object:
{"match":85,"reply":"Your 2-3 sentence reply here","company":"Company Name","role":"Role Title"}

Match scoring:
- 80-100: Skills + experience directly match (same tech stack, similar level)
- 60-79: Related but not exact (adjacent skills, different level)
- 40-59: Weak overlap
- 0-39: No real match

Reply rules:
- Sound human. 2-3 sentences. Lead with something specific from the email.
- BANNED: "excited about the opportunity", "leverage my expertise", any **bold** or asterisks — plain text only
- End with "Happy to jump on a call this week" or similar casual CTA.
- Do NOT include greetings or signature — those are added automatically.

Output ONLY the JSON, nothing else.`,
      userPrompt: `RECRUITER EMAIL:
From: ${msg.from}
Subject: ${msg.subject}
Preview: ${msg.snippet}

KRISHNA'S RESUME:
${experience}
Skills: ${skills.join(", ")}`,
      maxTokens: 400,
    });

    if (!scoreResult.ok || !scoreResult.content) continue;

    // Parse the JSON response.
    let score: { match: number; reply: string; company: string; role: string };
    try {
      const jsonStr = scoreResult.content.replace(/```json?\s*\n?/g, "").replace(/```/g, "").trim();
      score = JSON.parse(jsonStr);
    } catch {
      continue; // Failed to parse — skip
    }

    // Save contact regardless of match.
    try {
      await upsertContact({
        name,
        email,
        company: score.company || null,
        role_pitched: score.role || null,
        match_pct: score.match,
        source: "auto-reply",
      });
    } catch {}

    result.matched++;

    // Only auto-reply if >70% match.
    if (score.match < 70) continue;

    // Build and send the email with resume attachment.
    try {
      const { Resend } = await import("resend");
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        result.errors.push("RESEND_API_KEY not set — can't send with attachments");
        continue;
      }

      // Fetch the resume file for attachment.
      const resumeFullUrl = resumeUrl.startsWith("http")
        ? resumeUrl
        : `${siteUrl}${resumeUrl}`;
      let resumeBuffer: Buffer | null = null;
      try {
        const r = await fetch(resumeFullUrl);
        if (r.ok) {
          resumeBuffer = Buffer.from(await r.arrayBuffer());
        }
      } catch {}

      const subject = `Re: ${msg.subject || score.role || "Opportunity"}`;
      const from = process.env.RESEND_FROM_EMAIL || "Lucy <onboarding@resend.dev>";

      const htmlBody = `<p>Hi ${name.split(" ")[0] || "there"},</p>
<p>${score.reply.replace(/\n/g, "<br>")}</p>
<p>I've attached my resume for reference. You can also view my full portfolio at <a href="${siteUrl}">${siteUrl.replace("https://", "")}</a>.</p>
<p>Krishna Amarneni</p>`;

      const resend = new Resend(resendKey);
      const sendResult = await resend.emails.send({
        from,
        to: email,
        subject,
        html: htmlBody,
        text: `Hi ${name.split(" ")[0]},\n\n${score.reply}\n\nI've attached my resume. Portfolio: ${siteUrl}\n\nKrishna Amarneni`,
        ...(resumeBuffer
          ? {
              attachments: [
                {
                  filename: "Krishna_Amarneni_Resume.docx",
                  content: resumeBuffer,
                },
              ],
            }
          : {}),
      });

      if (sendResult.error) {
        result.errors.push(`Send to ${email}: ${sendResult.error.message}`);
      } else {
        await markReplied(msg.id, email, subject);
        result.sent++;
      }
    } catch (err) {
      result.errors.push(
        `Send to ${email}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
