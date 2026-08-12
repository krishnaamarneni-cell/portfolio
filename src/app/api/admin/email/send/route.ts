import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmailUnified } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SendBody = {
  action?: "ai-rewrite";
  to?: string;
  subject?: string;
  message?: string;
  provider?: "gmail" | "resend";
  field?: "subject" | "message";
  currentSubject?: string;
  currentMessage?: string;
};

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as SendBody;

  if (body.action === "ai-rewrite") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
      return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });

    const { runAgent } = await import("@/lib/agents");
    const field = body.field || "message";
    const recipient = body.to?.trim() || "a professional contact";

    let userPrompt: string;
    if (field === "subject") {
      userPrompt = `Rewrite this email subject line to be more professional and compelling. Keep it under 60 characters.
Current subject: "${body.currentSubject || ""}"
Email body context: "${(body.currentMessage || "").slice(0, 300)}"
Recipient: ${recipient}
Output ONLY valid JSON: {"subject": "..."}`;
    } else {
      userPrompt = `Rewrite this email message to be more professional, clear, and compelling. Keep the same intent but improve tone and clarity. 3-5 sentences max.
Current message: "${body.currentMessage || ""}"
Subject: "${body.currentSubject || ""}"
Recipient: ${recipient}
Output ONLY valid JSON: {"message": "..."}`;
    }

    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: `You rewrite professional emails for Krishna Amarneni. Keep emails warm, professional, and concise. No markdown, no bold, no asterisks. No greeting line (added automatically). No signature (added automatically). Output ONLY valid JSON.`,
      userPrompt,
      maxTokens: 300,
    });

    try {
      const cleaned = (result.content || "{}").replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ [field]: result.content?.replace(/[{}"]/g, "").trim() });
    }
  }

  const to = body.to?.trim();
  const subject = body.subject?.trim();
  const message = body.message?.trim();

  if (!to || !subject || !message)
    return NextResponse.json({ error: "to, subject, and message are required" }, { status: 400 });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:20px">
<p>${message.replace(/\n/g, "<br>")}</p>
<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;line-height:1.6">
<strong style="color:#1f2937">Krishna Amarneni</strong><br>
(203) 804-9291<br>
<a href="https://krishnaamarneni.com" style="color:#ff6b00;text-decoration:none">krishnaamarneni.com</a><br>
<a href="https://www.linkedin.com/in/krishnaamarneni/" style="color:#0a66c2;text-decoration:none">LinkedIn</a>
</div>
</body></html>`;

  const text = message;

  if (body.provider === "resend") {
    const { sendViaResend } = await import("@/lib/resend");
    const r = await sendViaResend({ to, subject, html, text });
    return NextResponse.json({ ...r, provider: "resend" });
  }

  const r = await sendEmailUnified({ to, subject, html, text });
  return NextResponse.json(r);
}
