import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmailUnified } from "@/lib/resend";
import { markEmailed } from "@/lib/contacts";
import { runAgent } from "@/lib/agents";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";

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
    const [jobs, site, factsBlock] = await Promise.all([
      fetchJobs().catch(() => []),
      fetchSiteContent(),
      buildFactsContext(),
    ]);
    const experience = jobs
      .slice(0, 4)
      .map((j) => `${j.title} @ ${j.company} (${j.period})`)
      .join("; ");
    const skills = (site.skills?.skills ?? []).slice(0, 20).join(", ");

    const system = `Write a short, professional email from Krishna to a recruiter. 3-4 sentences max. No fluff.
${factsBlock ? `\n${factsBlock}\n` : ""}
Tone: confident but not pushy. Mention 1-2 specific skills that match the role. End with availability to chat.
Output ONLY the email body text — no subject line, no "Dear", no signature block (those are added automatically).`;

    const userPrompt = `Recruiter: ${body.recruiterName} at ${body.company || "unknown company"}
Role: ${body.rolePitched || "not specified"}
Krishna's recent experience: ${experience || "SAP + AI engineering"}
Key skills: ${skills || "SAP S/4HANA, AI/ML, Next.js, Python"}`;

    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: system,
      userPrompt,
      maxTokens: 500,
    });

    const generatedBody = result.content || "I'm interested in discussing this opportunity further. Could we schedule a quick call?";

    subject = body.rolePitched
      ? `Interest in ${body.rolePitched} role`
      : "Exploring opportunities";

    htmlBody = `<p>Hi ${body.recruiterName},</p>
<p>${generatedBody.replace(/\n/g, "<br>")}</p>
<p>Best regards,<br>Krishna Amarneni<br>
<a href="https://krishnaamarneni.com">krishnaamarneni.com</a></p>`;
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
  }

  return NextResponse.json({
    ok: send.ok,
    error: send.error,
    provider: send.provider,
    subject,
  });
}
