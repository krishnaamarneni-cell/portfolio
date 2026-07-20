import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { sendEmailUnified } from "@/lib/resend";
import { recordBulkSend } from "@/lib/email-tracking";
import { classifyAddress } from "@/lib/unsendable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SIGNATURE_HTML = `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;line-height:1.6">
<strong style="color:#1f2937">Krishna Amarneni</strong><br>
(203) 804-9291<br>
<a href="https://krishnaamarneni.com" style="color:#ff6b00;text-decoration:none">krishnaamarneni.com</a><br>
<a href="https://www.linkedin.com/in/krishnaamarneni/" style="color:#0a66c2;text-decoration:none">LinkedIn</a>
</div>`;

type BulkBody = {
  action?: "generate-draft" | "send";
  contactIds?: string[];
  subject?: string;
  message?: string;
  attachResume?: boolean;
  contactTypes?: string[];
  companies?: string[];
  count?: number;
  field?: "both" | "subject" | "message";
  currentSubject?: string;
  currentMessage?: string;
  roleSeeking?: string;
};

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as BulkBody;

  if (body.action === "generate-draft") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "GROQ_API_KEY not set" },
        { status: 503 },
      );

    const { runAgent } = await import("@/lib/agents");
    const field = body.field || "both";
    const types = body.contactTypes?.join(", ") || "mixed";
    const companies = body.companies?.slice(0, 8).join(", ") || "various";
    const role = body.roleSeeking?.trim() || "SAP S/4HANA and/or AI/ML engineering roles";
    const roleLine = `The specific role(s) Krishna is looking for: ${role}. Name this target explicitly in the email.`;

    let userPrompt: string;
    if (field === "subject") {
      userPrompt = `Write a subject line for a JOB-SEARCH outreach email. It must clearly signal Krishna is actively looking for / open to a new role now — not vague — and reference the target role.
${roleLine}
Current message body: "${body.currentMessage || ""}"
Recipients: ${body.count || "multiple"} recruiter/network contacts (types: ${types}).
Output ONLY valid JSON: {"subject": "..."}`;
    } else if (field === "message") {
      userPrompt = `Write the body of a JOB-SEARCH outreach email. Make it unmistakable that Krishna is actively seeking the target role and is asking about current openings.
${roleLine}
Subject line: "${body.currentSubject || ""}"
Recipients: ${body.count || "multiple"} recruiter/network contacts (types: ${types}, companies: ${companies}).
Output ONLY valid JSON: {"message": "..."}`;
    } else {
      userPrompt = `Write a JOB-SEARCH outreach email to ${body.count || "multiple"} recruiter/network contacts (types: ${types}, companies: ${companies}). Krishna is actively seeking a new role and wants to know about current openings at their company. Make it clear he is looking for a job NOW.
${roleLine}
Output ONLY valid JSON: {"subject": "...", "message": "..."}`;
    }

    const result = await runAgent({
      apiKey,
      model: "llama-3.3-70b-versatile",
      systemPrompt: `You write JOB-SEARCH outreach emails for Krishna Amarneni — an SAP S/4HANA + AI/ML engineer with 5+ years in enterprise systems. He is ACTIVELY SEEKING a new full-time role right now and is emailing recruiters and his network to ask about current openings.

The email MUST make it unmistakable that:
- Krishna is actively looking for / open to a new role now — NOT vaguely "exploring".
- He is asking whether they have (or know of) relevant openings — SAP S/4HANA, AI/ML, enterprise systems, or SAP+AI crossover roles.
- He is available to talk/interview and has attached his resume.

Rules:
- No markdown, no bold (**), no asterisks, no bullet points.
- No greeting line (e.g. "Hi Name") — it is prepended automatically per contact.
- No signature block — it is appended automatically.
- Body: 3-4 natural sentences, warm and professional, confident but not desperate. Include a clear ask (e.g. "if you have or come across a role that fits, I'd love to connect").
- Subject: under 60 characters and it MUST clearly signal he is job-seeking / available — e.g. "Open to new SAP + AI engineering roles" or "SAP S/4HANA + AI Engineer — actively interviewing". NEVER a vague subject like "Exploring AI Roles".
- BANNED phrases: "excited about the opportunity", "leverage my expertise", "confident in my ability", "passionate about", "drive business growth", "touching base", "just checking in".
- Output ONLY valid JSON, nothing else.`,
      userPrompt,
      maxTokens: 320,
    });

    try {
      const cleaned = (result.content || "{}").replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        subject: parsed.subject ?? undefined,
        message: parsed.message ?? undefined,
      });
    } catch {
      return NextResponse.json({
        subject: field !== "message" ? "Open to new SAP + AI engineering roles" : undefined,
        message: field !== "subject" ? (result.content || "").replace(/[{}"]/g, "").trim() : undefined,
      });
    }
  }

  if (!body.contactIds?.length || !body.subject || !body.message) {
    return NextResponse.json(
      { error: "contactIds, subject, and message required" },
      { status: 400 },
    );
  }

  const db = requireSupabaseAdmin();

  const { data: contacts } = await db
    .from("recruiter_contacts")
    .select(
      "id, name, email, company, company_id, do_not_contact, excluded_from_bulk, times_contacted, bounced, bounce_reason",
    )
    .in("id", body.contactIds);

  if (!contacts?.length)
    return NextResponse.json({ error: "No contacts found" }, { status: 404 });

  const { data: exclusions } = await db
    .from("crm_outreach_exclusions")
    .select("exclusion_type, exclusion_value")
    .eq("active", true);

  const excEmails = new Set(
    (exclusions ?? [])
      .filter((e) => e.exclusion_type === "email")
      .map((e) => e.exclusion_value.toLowerCase()),
  );
  const excDomains = new Set(
    (exclusions ?? [])
      .filter((e) => e.exclusion_type === "domain")
      .map((e) => e.exclusion_value.toLowerCase()),
  );
  const excCompanies = new Set(
    (exclusions ?? [])
      .filter((e) => e.exclusion_type === "company")
      .map((e) => e.exclusion_value.toLowerCase()),
  );

  const companyIds = [
    ...new Set(contacts.map((c) => c.company_id).filter(Boolean) as string[]),
  ];
  const excludedCompanyIds = new Set<string>();
  if (companyIds.length > 0) {
    const { data: companies } = await db
      .from("crm_companies")
      .select("id")
      .in("id", companyIds)
      .eq("excluded_from_bulk", true);
    (companies ?? []).forEach((c) => excludedCompanyIds.add(c.id));
  }

  type ContactRow = (typeof contacts)[number];
  const eligible: ContactRow[] = [];
  const skipped: Array<{ id: string; email: string; reason: string }> = [];

  for (const c of contacts) {
    // Hard guard: no-reply / notification addresses can never respond, so they
    // are skipped even if nothing marked them excluded yet.
    const auto = classifyAddress(c.email);
    if (c.do_not_contact) {
      skipped.push({ id: c.id, email: c.email, reason: "Do Not Contact" });
    } else if (auto.unsendable) {
      skipped.push({ id: c.id, email: c.email, reason: auto.reason ?? "No-reply address" });
    } else if (c.bounced) {
      // A confirmed bounce means the mailbox doesn't exist — never re-send,
      // even if it was never explicitly excluded. Re-sending to known-dead
      // addresses is what damages sender reputation.
      skipped.push({
        id: c.id,
        email: c.email,
        reason: c.bounce_reason ? `Dead address — ${c.bounce_reason}` : "Dead address (bounced)",
      });
    } else if (c.excluded_from_bulk) {
      skipped.push({ id: c.id, email: c.email, reason: "Excluded from bulk" });
    } else if (excEmails.has(c.email.toLowerCase())) {
      skipped.push({
        id: c.id,
        email: c.email,
        reason: "Email in exclusion list",
      });
    } else {
      const domain = c.email.split("@")[1]?.toLowerCase();
      if (domain && excDomains.has(domain)) {
        skipped.push({ id: c.id, email: c.email, reason: "Domain excluded" });
      } else if (c.company && excCompanies.has(c.company.toLowerCase())) {
        skipped.push({
          id: c.id,
          email: c.email,
          reason: "Company in exclusion list",
        });
      } else if (c.company_id && excludedCompanyIds.has(c.company_id)) {
        skipped.push({
          id: c.id,
          email: c.email,
          reason: "Company excluded from bulk",
        });
      } else {
        eligible.push(c);
      }
    }
  }

  if (eligible.length === 0) {
    return NextResponse.json({
      sent: 0,
      errors: 0,
      skipped: skipped.length,
      skippedDetails: skipped,
      results: [],
    });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://krishnaamarneni.com";

  // Load the resume file once so we can ATTACH it (not just link it).
  let resumeAttachment: { filename: string; content: Buffer; contentType: string } | null = null;
  if (body.attachResume) {
    try {
      const { data: settings } = await db
        .from("admin_settings")
        .select("resume_url, resume_name")
        .eq("id", "singleton")
        .maybeSingle();
      const resumeUrl = settings?.resume_url || `${siteUrl}/Krishna_Amarneni_Resume.docx`;
      const rr = await fetch(resumeUrl, { cache: "no-store" });
      if (rr.ok) {
        const buf = Buffer.from(await rr.arrayBuffer());
        const ext = (resumeUrl.split("?")[0].split(".").pop() || "docx").toLowerCase();
        const contentType =
          ext === "pdf"
            ? "application/pdf"
            : ext === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/octet-stream";
        resumeAttachment = {
          filename: `Krishna_Amarneni_Resume.${ext}`,
          content: buf,
          contentType,
        };
      }
    } catch {
      // fall back to a link below
    }
  }

  const results: Array<{
    id: string;
    email: string;
    status: string;
    error?: string;
  }> = [];

  const sentRecords: Parameters<typeof recordBulkSend>[0] = [];

  for (let i = 0; i < eligible.length; i++) {
    const c = eligible[i];
    try {
      const firstName = c.name?.split(" ")[0] || "";
      const greeting = firstName ? `Hi ${firstName},` : "Hi,";

      const htmlBody = `<p>${greeting}</p>
<p>${body.message.replace(/\n/g, "<br>")}</p>
${SIGNATURE_HTML}`;

      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;max-width:600px;margin:0 auto;padding:20px">
${htmlBody}
</body></html>`;

      // Resume is attached as a file (below). Only if we couldn't fetch the
      // file do we fall back to a link so the resume is never silently dropped.
      if (body.attachResume && !resumeAttachment) {
        const resumeLink = `${siteUrl}/Krishna_Amarneni_Resume.docx`;
        html = html.replace(
          "</body>",
          `<p style="margin-top:16px;font-size:13px;color:#6b7280">Resume: <a href="${resumeLink}" style="color:#ff6b00">${resumeLink}</a></p></body>`,
        );
      }

      const plainText = htmlBody
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ");

      const r = await sendEmailUnified({
        to: c.email,
        subject: body.subject,
        html,
        text: plainText,
        attachments: resumeAttachment ? [resumeAttachment] : undefined,
      });

      if (r.ok) {
        await db
          .from("recruiter_contacts")
          .update({
            emailed_at: new Date().toISOString(),
            times_contacted: (c.times_contacted ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id);
        results.push({ id: c.id, email: c.email, status: "sent" });
        // Recorded so the tracking agent can later attribute replies/bounces.
        sentRecords.push({
          contactId: c.id,
          email: c.email,
          name: c.name ?? null,
          subject: body.subject,
          providerMessageId: r.id ?? null,
          campaign: body.roleSeeking || null,
        });
      } else {
        results.push({
          id: c.id,
          email: c.email,
          status: "error",
          error: r.error,
        });
      }

      if (i < eligible.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      results.push({
        id: c.id,
        email: c.email,
        status: "error",
        error: err instanceof Error ? err.message : "Send failed",
      });
    }
  }

  await recordBulkSend(sentRecords);

  return NextResponse.json({
    sent: results.filter((r) => r.status === "sent").length,
    errors: results.filter((r) => r.status === "error").length,
    skipped: skipped.length,
    skippedDetails: skipped,
    results,
  });
}
