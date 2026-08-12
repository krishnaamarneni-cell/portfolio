import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmailUnified } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    message?: string;
    provider?: "gmail" | "resend";
  };

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
