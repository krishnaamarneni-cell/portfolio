import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmailUnified } from "@/lib/resend";
import { markEmailed } from "@/lib/contacts";
import { runAgent } from "@/lib/agents";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";
import { recordResponse } from "@/lib/email-learning";
import { buildLearningContext } from "@/lib/email-learning";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  contactId: string;
  to: string;
  recruiterName: string;
  company?: string;
  rolePitched?: string;
  /** If provided, skip AI generation and send this directly. */
  customMessage?: string;
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

  let subject: string;
  let htmlBody: string;

  if (body.customMessage) {
    // User wrote their own message.
    subject = `${body.rolePitched ? `Re: ${body.rolePitched}` : "Following up on opportunity"}`;
    htmlBody = body.customMessage.replace(/\n/g, "<br>");
  } else if (apiKey) {
    // AI-generate a professional outreach email.
    const [jobs, site, factsBlock, learningCtx] = await Promise.all([
      fetchJobs().catch(() => []),
      fetchSiteContent(),
      buildFactsContext(),
      buildLearningContext().catch(() => ""),
    ]);
    const experience = jobs
      .slice(0, 4)
      .map((j) => `${j.title} @ ${j.company} (${j.period})`)
      .join("; ");
    const skills = (site.skills?.skills ?? []).slice(0, 20).join(", ");

    const system = `You write recruiter reply emails for Krishna Amarneni. Write like a real person, not a template.
${factsBlock ? `\n${factsBlock}\n` : ""}

STYLE RULES:
- Sound human. Write like you're texting a professional contact, not writing a cover letter.
- NO corporate filler: "excited about the opportunity", "leverage my expertise", "drive business growth", "make a significant impact" — ALL BANNED.
- NO "I am confident in my ability" — BANNED.
- Lead with a SPECIFIC thing from the role/company that caught your eye.
- Name-drop ONE concrete project or result from Krishna's past (a client, a system he built, a metric).
- 2-3 sentences max. End with a casual call to action ("Happy to jump on a call this week" not "I welcome the chance to discuss").
- Output ONLY the body paragraphs. No "Hi Name" (added automatically). No signature (added automatically).

GOOD EXAMPLE:
"Saw the S/4HANA rollout role — I just wrapped a similar migration at Coca-Cola covering MM/SD and Ariba procurement. Would love to hear more about the scope. Free for a quick call this week?"

BAD EXAMPLE (do NOT write like this):
"I am excited about the opportunity to leverage my technical expertise in SAP S/4HANA to drive business growth. With my experience, I am confident in my ability to make a significant impact."
${learningCtx}`;

    const userPrompt = `Recruiter: ${body.recruiterName} at ${body.company || "a company"}
Role they pitched: ${body.rolePitched || "not specified"}
Krishna's recent work: ${experience || "SAP + AI engineering"}
Key skills: ${skills || "SAP S/4HANA, AI/ML, Next.js, Python"}

Write 2-3 sentences. Human tone. No template language.`;

    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: system,
      userPrompt,
      maxTokens: 300,
    });

    const generatedBody = result.content || "Saw your message about the role — looks like a strong fit given my recent work. Happy to jump on a quick call this week if you're free.";

    subject = body.rolePitched
      ? `Re: ${body.rolePitched}`
      : "Re: Opportunity";

    htmlBody = `<p>Hi ${body.recruiterName},</p>
<p>${generatedBody.replace(/\n/g, "<br>")}</p>
<p>Krishna Amarneni<br>
<a href="https://krishnaamarneni.com" style="color:#ff6b00">krishnaamarneni.com</a></p>`;
  } else {
    return NextResponse.json(
      { error: "GROQ_API_KEY not set and no custom message provided" },
      { status: 503 }
    );
  }

  // Wrap in a clean email template.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:20px">
${htmlBody}
</body></html>`;

  const send = await sendEmailUnified({
    to: body.to,
    subject,
    html,
    text: htmlBody.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "),
  });

  if (send.ok) {
    await markEmailed(body.contactId);
    // Record for learning — track what Krishna actually sends so AI improves.
    try {
      const plainBody = htmlBody.replace(/<[^>]+>/g, "").trim();
      await recordResponse({
        to_email: body.to,
        to_name: body.recruiterName,
        subject,
        ai_draft: body.customMessage ? "" : plainBody, // empty if user wrote it manually
        final_body: plainBody,
        action: body.customMessage ? "edited_sent" : "sent",
      });
    } catch {} // non-critical
  }

  return NextResponse.json({
    ok: send.ok,
    error: send.error,
    provider: send.provider,
    subject,
  });
}
