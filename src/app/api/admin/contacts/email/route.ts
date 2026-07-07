import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmailUnified } from "@/lib/resend";
import { markEmailed, getContact } from "@/lib/contacts";
import { runAgent } from "@/lib/agents";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";
import { recordResponse } from "@/lib/email-learning";
import { buildLearningContext } from "@/lib/email-learning";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SIGNATURE_HTML = `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;line-height:1.6">
<strong style="color:#1f2937">Krishna Amarneni</strong><br>
(203) 804-9291<br>
<a href="https://krishnaamarneni.com" style="color:#ff6b00;text-decoration:none">krishnaamarneni.com</a><br>
<a href="https://www.linkedin.com/in/krishnaamarneni/" style="color:#0a66c2;text-decoration:none">LinkedIn</a>
</div>`;

const SIGNATURE_TEXT = `\n\n---\nKrishna Amarneni\n(203) 804-9291\nkrishnaamarneni.com\nhttps://www.linkedin.com/in/krishnaamarneni/`;

type Body = {
  contactId: string;
  to: string;
  recruiterName: string;
  company?: string;
  rolePitched?: string;
  customMessage?: string;
  customSubject?: string;
  attachResume?: boolean;
  /** If true, return the AI-generated draft without sending. */
  draftOnly?: boolean;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.to || !body.contactId) {
    return NextResponse.json(
      { error: "to and contactId required" },
      { status: 400 }
    );
  }

  // Exclusion safety: never send to Do Not Contact
  const contact = await getContact(body.contactId);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  if (contact.do_not_contact) {
    return NextResponse.json(
      { error: "This contact is marked Do Not Contact — email blocked" },
      { status: 403 },
    );
  }

  let subject: string;
  let htmlBody: string;

  if (body.customMessage) {
    // User wrote their own message — still append signature.
    subject = `${body.rolePitched ? `Re: ${body.rolePitched}` : "Following up on opportunity"}`;
    htmlBody = `<p>${body.customMessage.replace(/\n/g, "<br>")}</p>${SIGNATURE_HTML}`;
  } else if (apiKey) {
    // AI-generate a professional outreach email.
    const [jobs, site, factsBlock, learningCtx] = await Promise.all([
      fetchJobs().catch(() => []),
      fetchSiteContent(),
      buildFactsContext(),
      buildLearningContext().catch(() => ""),
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
    const skills = (site.skills?.skills ?? []).slice(0, 20).join(", ");

    const system = `You write recruiter reply emails for Krishna Amarneni. Use one of two templates based on context.
${factsBlock ? `\n${factsBlock}\n` : ""}

TEMPLATE A — use when a specific role/JD is known:
"Thank you for reaching out about the {job_title} role at {company}. This aligns well with my background — I have {X years} of hands-on experience in {matching_skills}, most recently at {recent_company} where I {specific_achievement}. Looking at the requirements, my experience with {skill_1}, {skill_2}, and {skill_3} maps directly to what you are looking for. I would welcome the chance to discuss how my work on {relevant_project} translates to this position. Would you be available for a quick call this week?"

TEMPLATE B — use when the role is vague or this is a cold follow-up:
"Thanks for considering me for the {job_title} position. I am currently working in {domain} with a focus on {top_skills}, and this opportunity caught my attention. My background includes {years} years in {domain} — specifically {relevant_experience} across projects at {company_1} and {company_2}. I would be interested to learn more about the role, the team, and how my experience could contribute. Looking forward to connecting."

RULES:
- Replace ALL {placeholders} with REAL data from Krishna's resume below. Never leave placeholders.
- Reference SPECIFIC companies, projects, and achievements from the resume.
- NEVER use ** bold **, asterisks, or markdown formatting. Plain text only.
- BANNED: "excited about the opportunity", "leverage my expertise", "confident in my ability", "drive business growth"
- Output ONLY the body text. No "Hi Name" greeting, no signature — those are added automatically.
${learningCtx}`;

    const userPrompt = `Recruiter: ${body.recruiterName} at ${body.company || "a company"}
Role they pitched: ${body.rolePitched || "not specified"}

KRISHNA'S FULL RESUME:
${experience || "SAP + AI engineering"}

Key skills: ${skills || "SAP S/4HANA, AI/ML, Next.js, Python"}

Pick Template A if a specific role is mentioned, Template B if vague. Fill in real experience.`;

    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: system,
      userPrompt,
      maxTokens: 300,
    });

    const generatedBody = result.content || "Saw your message about the role — looks like a strong fit given my recent work. Happy to jump on a quick call this week if you're free.";

    // If draftOnly, return the draft without sending.
    if (body.draftOnly) {
      return NextResponse.json({ draft: generatedBody });
    }

    subject = body.customSubject || (body.rolePitched ? `Re: ${body.rolePitched}` : "Re: Opportunity");

    htmlBody = `<p>Hi ${body.recruiterName},</p>
<p>${generatedBody.replace(/\n/g, "<br>")}</p>
${SIGNATURE_HTML}`;
  } else {
    return NextResponse.json(
      { error: "GROQ_API_KEY not set and no custom message provided" },
      { status: 503 }
    );
  }

  if (body.customSubject) subject = body.customSubject;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krishnaamarneni.com";

  // Wrap in a clean email template.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:20px">
${htmlBody}
</body></html>`;

  const plainTextBody = htmlBody.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  const plainText = plainTextBody.includes("Krishna Amarneni") ? plainTextBody : plainTextBody + SIGNATURE_TEXT;

  // Send with optional resume attachment.
  const attachResume = body.attachResume !== false; // default true
  let resumeBuffer: Buffer | null = null;
  if (attachResume) {
    try {
      const resumeUrl = `${siteUrl}/Krishna_Amarneni_Resume.docx`;
      const r = await fetch(resumeUrl);
      if (r.ok) resumeBuffer = Buffer.from(await r.arrayBuffer());
    } catch {}
  }

  // Send email. Gmail is primary (no domain restrictions). Resend only if
  // a verified domain is configured (RESEND_FROM_EMAIL is not onboarding@).
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL || "";
  const hasVerifiedDomain = resendFrom && !resendFrom.includes("onboarding@resend.dev");
  let sendResult: { ok: boolean; error?: string; provider: string };

  if (hasVerifiedDomain && resendKey && resumeBuffer) {
    // Resend with attachment (only works with verified domain)
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const r = await resend.emails.send({
        from: resendFrom, to: body.to, subject, html, text: plainText,
        attachments: [{ filename: "Krishna_Amarneni_Resume.docx", content: resumeBuffer }],
      });
      sendResult = r.error
        ? { ok: false, error: r.error.message, provider: "resend" }
        : { ok: true, provider: "resend" };
    } catch (err) {
      sendResult = { ok: false, error: err instanceof Error ? err.message : "Resend failed", provider: "resend" };
    }
  } else {
    // Gmail doesn't support attachments via the simple send API.
    // If resume was requested, add a download link instead.
    let sendHtml = html;
    if (resumeBuffer && !hasVerifiedDomain) {
      const resumeLink = `${siteUrl}/Krishna_Amarneni_Resume.docx`;
      sendHtml = html.replace("</body>", `<p style="margin-top:16px;font-size:13px;color:#6b7280">Resume: <a href="${resumeLink}" style="color:#ff6b00">${resumeLink}</a></p></body>`);
    }
    const s = await sendEmailUnified({ to: body.to, subject, html: sendHtml, text: plainText });
    sendResult = { ...s, provider: s.provider };
  }

  if (sendResult.ok) {
    await markEmailed(body.contactId);
    try {
      await recordResponse({
        to_email: body.to,
        to_name: body.recruiterName,
        subject,
        ai_draft: body.customMessage ? "" : plainText,
        final_body: plainText,
        action: body.customMessage ? "edited_sent" : "sent",
      });
    } catch {}
  }

  return NextResponse.json({
    ok: sendResult.ok,
    error: sendResult.error,
    provider: sendResult.provider,
    subject,
    resumeAttached: !!resumeBuffer,
  });
}
