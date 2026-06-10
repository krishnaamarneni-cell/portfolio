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

const SIGNATURE_HTML = `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;line-height:1.6">
<strong style="color:#1f2937">Krishna Amarneni</strong><br>
(203) 804-9291<br>
<a href="https://krishnaamarneni.com" style="color:#ff6b00;text-decoration:none">krishnaamarneni.com</a><br>
<a href="https://www.linkedin.com/in/krishnaamarneni/" style="color:#0a66c2;text-decoration:none">LinkedIn</a>
</div>`;

const SIGNATURE_TEXT = `\n\n---\nKrishna Amarneni\n(203) 804-9291\nkrishnaamarneni.com\nhttps://www.linkedin.com/in/krishnaamarneni/`;

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
    .map((j) => {
      const head = `- ${j.title} @ ${j.company} (${j.period}, ${j.location})`;
      const desc = j.description ? `\n  ${j.description}` : "";
      const highlights = j.highlights?.length
        ? "\n  " + j.highlights.slice(0, 3).join("; ")
        : "";
      const tags = j.tags?.length ? `\n  Skills: ${j.tags.join(", ")}` : "";
      return head + desc + highlights + tags;
    })
    .join("\n\n");
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

    // Ask LLM to score the match and generate a reply using two templates.
    const scoreResult = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: `You are a job-match scorer and reply writer. Given a recruiter email and Krishna's resume, output ONLY a JSON object.

STEP 1: Read the recruiter email carefully — extract the role, company, and required skills.
STEP 2: Compare against Krishna's resume — find SPECIFIC matching experience, projects, companies, and skills.
STEP 3: Score the match.
STEP 4: Write a reply using one of two templates below.

Match scoring:
- 80-100: Skills + experience directly match (same tech stack, similar level)
- 60-79: Related but not exact (adjacent skills, different level)
- 40-59: Weak overlap
- 0-39: No real match

TEMPLATE A — use when the email has a clear JD or role description:
"Thank you for reaching out about the {job_title} role at {company}. This aligns well with my background — I have {X years} of hands-on experience in {matching_skills}, most recently at {recent_company} where I {specific_achievement}. Looking at the requirements, my experience with {skill_1}, {skill_2}, and {skill_3} maps directly to what you are looking for. I would welcome the chance to discuss how my work on {relevant_project} translates to this position. Would you be available for a quick call this week?"

TEMPLATE B — use when the email is vague or just asking about availability:
"Thanks for considering me for the {job_title} position. I am currently working in {domain} with a focus on {top_skills}, and this opportunity caught my attention. My background includes {years} years in {domain} — specifically {relevant_experience} across projects at {company_1} and {company_2}. I would be interested to learn more about the role, the team, and how my experience could contribute. Looking forward to connecting."

RULES:
- Pick Template A if the email mentions specific skills, JD details, or tech stack. Pick Template B otherwise.
- Replace ALL placeholders with REAL data from Krishna's resume. Never leave {placeholders}.
- Reference SPECIFIC projects, companies, and achievements from the resume — not generic claims.
- NEVER use ** bold **, asterisks, or markdown formatting. Plain text only.
- BANNED phrases: "excited about the opportunity", "leverage my expertise", "confident in my ability", "drive business growth"
- Do NOT include "Hi Name" greeting or signature — those are added automatically.

Output format (JSON only, nothing else):
{"match":85,"reply":"the full reply body","company":"Company Name","role":"Role Title","template":"A"}`,
      userPrompt: `RECRUITER EMAIL:
From: ${msg.from}
Subject: ${msg.subject}
Preview: ${msg.snippet}

KRISHNA'S FULL RESUME:
${experience}

Skills: ${skills.join(", ")}`,
      maxTokens: 600,
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

    // Only auto-reply if >65% match.
    if (score.match < 65) continue;

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

      const resumeLink = resumeUrl.startsWith("http") ? resumeUrl : `${siteUrl}${resumeUrl}`;
      const htmlBody = `<p>Hi ${name.split(" ")[0] || "there"},</p>
<p>${score.reply.replace(/\n/g, "<br>")}</p>
<p style="margin-top:12px;font-size:14px">Resume: <a href="${resumeLink}" style="color:#ff6b00">${resumeLink}</a></p>
${SIGNATURE_HTML}`;

      const plainText = `Hi ${name.split(" ")[0]},\n\n${score.reply}\n\nResume: ${resumeLink}${SIGNATURE_TEXT}`;

      const resend = new Resend(resendKey);
      const sendResult = await resend.emails.send({
        from,
        to: email,
        subject,
        html: htmlBody,
        text: plainText,
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
