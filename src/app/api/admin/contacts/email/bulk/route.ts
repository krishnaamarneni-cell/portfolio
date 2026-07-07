import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { sendEmailUnified } from "@/lib/resend";

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
  contactIds: string[];
  subject: string;
  message: string;
  attachResume?: boolean;
};

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as BulkBody;
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
      "id, name, email, company, company_id, do_not_contact, excluded_from_bulk, times_contacted",
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
    if (c.do_not_contact) {
      skipped.push({ id: c.id, email: c.email, reason: "Do Not Contact" });
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
  const results: Array<{
    id: string;
    email: string;
    status: string;
    error?: string;
  }> = [];

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

      if (body.attachResume) {
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

  return NextResponse.json({
    sent: results.filter((r) => r.status === "sent").length,
    errors: results.filter((r) => r.status === "error").length,
    skipped: skipped.length,
    skippedDetails: skipped,
    results,
  });
}
