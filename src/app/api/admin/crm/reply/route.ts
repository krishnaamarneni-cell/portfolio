import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmailUnified } from "@/lib/resend";
import { runAgent } from "@/lib/agents";
import { buildFactsContext } from "@/lib/facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SIGNATURE_HTML = `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;line-height:1.6">
<strong style="color:#1f2937">Krishna Amarneni</strong><br>
(203) 804-9291<br>
<a href="https://krishnaamarneni.com" style="color:#ff6b00;text-decoration:none">krishnaamarneni.com</a><br>
<a href="https://www.linkedin.com/in/krishnaamarneni/" style="color:#0a66c2;text-decoration:none">LinkedIn</a>
</div>`;
const SIGNATURE_TEXT = `\n\n--\nKrishna Amarneni\n(203) 804-9291\nkrishnaamarneni.com`;

type Body =
  | { action: "send"; to: string; subject?: string; body: string; attachResume?: boolean }
  | { action: "ai-body"; context?: string; instruction?: string }
  | { action: "ai-subject"; context?: string };

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── AI: draft a reply body from the thread ──
  if (body.action === "ai-body") {
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
    const facts = await buildFactsContext().catch(() => "");
    const system = `You draft email replies for Krishna Amarneni — SAP S/4HANA consultant (Coca-Cola, Xiromed) and AI engineer, krishnaamarneni.com.
${facts ? `\n${facts}\n` : ""}
Given the email thread below, write Krishna's reply. Warm, clear, concise, professional. Plain text only — no markdown, no subject line, no signature (added automatically), no "Hi X" unless it reads naturally. If an instruction is given, follow it. Output ONLY the reply body.`;
    const instruction = body.instruction ? `\n\nInstruction: ${body.instruction}` : "";
    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: system,
      userPrompt: `Email thread (newest last):\n\n${(body.context ?? "").slice(0, 6000)}${instruction}`,
      maxTokens: 500,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ draft: (result.content ?? "").trim() });
  }

  // ── AI: suggest a subject line ──
  if (body.action === "ai-subject") {
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: `You write email subject lines. Given the thread, return ONLY one concise subject line (max 80 chars), no quotes, no prefix like "Subject:". If it's clearly a reply, keep a natural "Re: ..." form.`,
      userPrompt: `Thread:\n\n${(body.context ?? "").slice(0, 4000)}`,
      maxTokens: 40,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    const subject = (result.content ?? "").split("\n")[0].replace(/^["']|["']$/g, "").replace(/^subject:\s*/i, "").trim().slice(0, 120);
    return NextResponse.json({ subject });
  }

  // ── Send ──
  const to = (body.to ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!to || !text) {
    return NextResponse.json({ error: "Recipient and message body are required" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim() || "(no subject)";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://krishnaamarneni.com";

  let htmlBody = `<p>${text.replace(/\n/g, "<br>")}</p>${SIGNATURE_HTML}`;
  if (body.attachResume) {
    const resumeLink = `${siteUrl}/Krishna_Amarneni_Resume.docx`;
    htmlBody += `<p style="margin-top:16px;font-size:13px;color:#6b7280">Resume: <a href="${resumeLink}" style="color:#ff6b00">${resumeLink}</a></p>`;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:20px">
${htmlBody}
</body></html>`;
  const plain = text + SIGNATURE_TEXT + (body.attachResume ? `\n\nResume: ${siteUrl}/Krishna_Amarneni_Resume.docx` : "");

  const res = await sendEmailUnified({ to, subject, html, text: plain });
  if (!res.ok) {
    return NextResponse.json({ error: res.error || "Send failed", provider: res.provider }, { status: 502 });
  }
  return NextResponse.json({ ok: true, provider: res.provider, subject });
}
