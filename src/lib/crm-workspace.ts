/**
 * CRM Workspace — server-side data functions for the redesigned CRM UI.
 *
 * Provides company workspaces, exclusion management, audience evaluation,
 * thread listing, and AI-powered company summaries via Groq.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import type { Company } from "@/lib/companies";
import type { RecruiterContact, ContactType } from "@/lib/contacts";
import type {
  CachedThread,
  ThreadMessage,
} from "@/lib/thread-sync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompanyWorkspace = {
  company: Company;
  contacts: RecruiterContact[];
  emails: string[];
  threads: CachedThread[];
};

export type ExclusionItem = {
  id: string;
  type: "email" | "domain" | "company" | "contact";
  value: string;
  reason: string | null;
  source: string;
  created_at: string;
};

export type AudienceContact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  company_id: string | null;
  contact_type: ContactType;
  match_pct: number | null;
  last_gmail_activity_at: string | null;
  classification_reason: string;
};

export type AudienceRules = {
  include_types?: ContactType[];
  active_within_days?: number;
  min_match_pct?: number;
};

export type ThreadListItem = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  participants: string[];
  snippet: string | null;
  message_count: number;
  last_message_at: string | null;
  contact_name: string | null;
  company_name: string | null;
};

// ---------------------------------------------------------------------------
// 1. getCompanyWorkspace
// ---------------------------------------------------------------------------

export async function getCompanyWorkspace(
  companyId: string
): Promise<CompanyWorkspace | null> {
  const supabase = requireSupabaseAdmin();

  // Company record
  const { data: company } = await supabase
    .from("crm_companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return null;

  // All contacts under this company
  const { data: contacts } = await supabase
    .from("recruiter_contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("starred", { ascending: false })
    .order("last_gmail_activity_at", { ascending: false, nullsFirst: false });

  // Unique email addresses from those contacts
  const contactList = (contacts ?? []) as RecruiterContact[];
  const emails = [...new Set(contactList.map((c) => c.email).filter(Boolean))];

  // All threads linked to this company
  const { data: threads } = await supabase
    .from("crm_email_threads")
    .select("*")
    .eq("company_id", companyId)
    .order("last_message_at", { ascending: false });

  return {
    company: company as Company,
    contacts: contactList,
    emails,
    threads: (threads ?? []) as CachedThread[],
  };
}

// ---------------------------------------------------------------------------
// 2. getExclusionsList
// ---------------------------------------------------------------------------

export async function getExclusionsList(): Promise<ExclusionItem[]> {
  const supabase = requireSupabaseAdmin();
  const items: ExclusionItem[] = [];

  // Table-based exclusions
  const { data: tableExclusions } = await supabase
    .from("crm_outreach_exclusions")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  for (const row of tableExclusions ?? []) {
    items.push({
      id: row.id,
      type: row.exclusion_type as ExclusionItem["type"],
      value: row.exclusion_value,
      reason: row.reason,
      source: "exclusion_table",
      created_at: row.created_at,
    });
  }

  // Contacts where excluded_from_bulk = true
  const { data: excludedContacts } = await supabase
    .from("recruiter_contacts")
    .select("id, email, company, created_at")
    .eq("excluded_from_bulk", true);

  for (const c of excludedContacts ?? []) {
    items.push({
      id: c.id,
      type: "contact",
      value: c.email,
      reason: c.company ? `Contact at ${c.company}` : null,
      source: "contact_flag",
      created_at: c.created_at,
    });
  }

  // Companies where excluded_from_bulk = true
  const { data: excludedCompanies } = await supabase
    .from("crm_companies")
    .select("id, name, domain, created_at")
    .eq("excluded_from_bulk", true);

  for (const co of excludedCompanies ?? []) {
    items.push({
      id: co.id,
      type: "company",
      value: `${co.name} (${co.domain})`,
      reason: null,
      source: "company_flag",
      created_at: co.created_at,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// 3. toggleCompanyExclusion
// ---------------------------------------------------------------------------

export async function toggleCompanyExclusion(
  companyId: string,
  excluded: boolean
): Promise<void> {
  const supabase = requireSupabaseAdmin();

  // Update company flag
  await supabase
    .from("crm_companies")
    .update({ excluded_from_bulk: excluded, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (excluded) {
    // Fetch company info for the exclusion record
    const { data: company } = await supabase
      .from("crm_companies")
      .select("name, domain")
      .eq("id", companyId)
      .maybeSingle();

    if (company) {
      // Avoid duplicate: check if an active exclusion already exists
      const { data: existing } = await supabase
        .from("crm_outreach_exclusions")
        .select("id")
        .eq("exclusion_type", "company")
        .eq("exclusion_value", company.domain)
        .eq("active", true)
        .maybeSingle();

      if (!existing) {
        await supabase.from("crm_outreach_exclusions").insert({
          exclusion_type: "company",
          exclusion_value: company.domain,
          reason: `Company "${company.name}" excluded from bulk`,
          is_permanent: false,
          active: true,
        });
      }
    }
  } else {
    // Remove matching exclusion entries
    const { data: company } = await supabase
      .from("crm_companies")
      .select("domain")
      .eq("id", companyId)
      .maybeSingle();

    if (company) {
      await supabase
        .from("crm_outreach_exclusions")
        .update({ active: false })
        .eq("exclusion_type", "company")
        .eq("exclusion_value", company.domain);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. toggleContactExclusion
// ---------------------------------------------------------------------------

export async function toggleContactExclusion(
  contactId: string,
  excluded: boolean
): Promise<void> {
  const supabase = requireSupabaseAdmin();

  // Update contact flag
  await supabase
    .from("recruiter_contacts")
    .update({ excluded_from_bulk: excluded, updated_at: new Date().toISOString() })
    .eq("id", contactId);

  if (excluded) {
    const { data: contact } = await supabase
      .from("recruiter_contacts")
      .select("email, name")
      .eq("id", contactId)
      .maybeSingle();

    if (contact) {
      const { data: existing } = await supabase
        .from("crm_outreach_exclusions")
        .select("id")
        .eq("exclusion_type", "email")
        .eq("exclusion_value", contact.email)
        .eq("active", true)
        .maybeSingle();

      if (!existing) {
        await supabase.from("crm_outreach_exclusions").insert({
          exclusion_type: "email",
          exclusion_value: contact.email,
          reason: `Contact "${contact.name}" excluded from bulk`,
          is_permanent: false,
          active: true,
        });
      }
    }
  } else {
    const { data: contact } = await supabase
      .from("recruiter_contacts")
      .select("email")
      .eq("id", contactId)
      .maybeSingle();

    if (contact) {
      await supabase
        .from("crm_outreach_exclusions")
        .update({ active: false })
        .eq("exclusion_type", "email")
        .eq("exclusion_value", contact.email);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. evaluateAudiencePreview
// ---------------------------------------------------------------------------

export async function evaluateAudiencePreview(
  rules: AudienceRules
): Promise<{ contacts: AudienceContact[]; totalBefore: number; totalAfter: number }> {
  const supabase = requireSupabaseAdmin();

  // Load all active exclusion values for filtering
  const { data: exclusionRows } = await supabase
    .from("crm_outreach_exclusions")
    .select("exclusion_type, exclusion_value")
    .eq("active", true);

  const excludedEmails = new Set<string>();
  const excludedDomains = new Set<string>();
  const excludedCompanyDomains = new Set<string>();

  for (const row of exclusionRows ?? []) {
    switch (row.exclusion_type) {
      case "email":
        excludedEmails.add(row.exclusion_value.toLowerCase());
        break;
      case "domain":
        excludedDomains.add(row.exclusion_value.toLowerCase());
        break;
      case "company":
        excludedCompanyDomains.add(row.exclusion_value.toLowerCase());
        break;
    }
  }

  // Load excluded company IDs (by flag)
  const { data: excludedCompanyRows } = await supabase
    .from("crm_companies")
    .select("id, domain")
    .eq("excluded_from_bulk", true);

  const excludedCompanyIds = new Set<string>();
  for (const co of excludedCompanyRows ?? []) {
    excludedCompanyIds.add(co.id);
    excludedCompanyDomains.add(co.domain.toLowerCase());
  }

  // Start with all contacts, join company name
  let q = supabase
    .from("recruiter_contacts")
    .select("id, name, email, company, company_id, contact_type, match_pct, last_gmail_activity_at, do_not_contact, excluded_from_bulk");

  // Filter by contact_type if specified
  if (rules.include_types && rules.include_types.length > 0) {
    q = q.in("contact_type", rules.include_types);
  }

  // Exclude DNC and bulk-excluded at query level
  q = q.eq("do_not_contact", false).eq("excluded_from_bulk", false);

  // Filter by active_within_days
  if (rules.active_within_days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rules.active_within_days);
    q = q.gte("last_gmail_activity_at", cutoff.toISOString());
  }

  // Filter by min_match_pct
  if (rules.min_match_pct) {
    q = q.gte("match_pct", rules.min_match_pct);
  }

  const { data: rawContacts } = await q;
  const allContacts = (rawContacts ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    company_id: string | null;
    contact_type: ContactType;
    match_pct: number | null;
    last_gmail_activity_at: string | null;
    do_not_contact: boolean;
    excluded_from_bulk: boolean;
  }>;

  const totalBefore = allContacts.length;
  const result: AudienceContact[] = [];

  for (const c of allContacts) {
    // Exclude by company-level exclusion
    if (c.company_id && excludedCompanyIds.has(c.company_id)) continue;

    // Exclude by email match in exclusion table
    if (excludedEmails.has(c.email.toLowerCase())) continue;

    // Exclude by domain match in exclusion table
    const emailDomain = c.email.split("@")[1]?.toLowerCase();
    if (emailDomain && excludedDomains.has(emailDomain)) continue;

    // Exclude by company domain in exclusion table
    if (emailDomain && excludedCompanyDomains.has(emailDomain)) continue;

    // Determine classification reason
    let reason = "Matches all rules";
    if (rules.include_types?.length) {
      reason = `Type: ${c.contact_type}`;
    }
    if (rules.min_match_pct && c.match_pct) {
      reason += ` · Match ${c.match_pct}%`;
    }
    if (rules.active_within_days && c.last_gmail_activity_at) {
      reason += ` · Active`;
    }

    result.push({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      company_id: c.company_id,
      contact_type: c.contact_type,
      match_pct: c.match_pct,
      last_gmail_activity_at: c.last_gmail_activity_at,
      classification_reason: reason,
    });
  }

  return { contacts: result, totalBefore, totalAfter: result.length };
}

// ---------------------------------------------------------------------------
// 6. getGmailThreadList
// ---------------------------------------------------------------------------

export async function getGmailThreadList(opts?: {
  limit?: number;
  contactId?: string;
  companyId?: string;
}): Promise<ThreadListItem[]> {
  const supabase = requireSupabaseAdmin();

  let q = supabase
    .from("crm_email_threads")
    .select("id, gmail_thread_id, subject, participants, snippet, message_count, last_message_at, contact_id, company_id")
    .order("last_message_at", { ascending: false });

  if (opts?.contactId) q = q.eq("contact_id", opts.contactId);
  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data: threads } = await q;
  if (!threads || threads.length === 0) return [];

  // Collect unique contact and company IDs for batch lookup
  const contactIds = [...new Set(
    (threads as Array<{ contact_id: string | null }>)
      .map((t) => t.contact_id)
      .filter(Boolean) as string[]
  )];
  const companyIds = [...new Set(
    (threads as Array<{ company_id: string | null }>)
      .map((t) => t.company_id)
      .filter(Boolean) as string[]
  )];

  // Batch-fetch names
  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("recruiter_contacts")
      .select("id, name")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      contactMap.set(c.id, c.name);
    }
  }

  const companyMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("crm_companies")
      .select("id, name")
      .in("id", companyIds);
    for (const co of companies ?? []) {
      companyMap.set(co.id, co.name);
    }
  }

  return (threads as Array<{
    id: string;
    gmail_thread_id: string;
    subject: string | null;
    participants: string[];
    snippet: string | null;
    message_count: number;
    last_message_at: string | null;
    contact_id: string | null;
    company_id: string | null;
  }>).map((t) => ({
    id: t.id,
    gmail_thread_id: t.gmail_thread_id,
    subject: t.subject,
    participants: t.participants ?? [],
    snippet: t.snippet,
    message_count: t.message_count,
    last_message_at: t.last_message_at,
    contact_name: t.contact_id ? (contactMap.get(t.contact_id) ?? null) : null,
    company_name: t.company_id ? (companyMap.get(t.company_id) ?? null) : null,
  }));
}

// ---------------------------------------------------------------------------
// 7. getThreadDetail
// ---------------------------------------------------------------------------

export async function getThreadDetail(
  threadId: string
): Promise<(CachedThread & { messages: ThreadMessage[] }) | null> {
  const supabase = requireSupabaseAdmin();

  const { data } = await supabase
    .from("crm_email_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();

  if (!data) return null;

  const thread = data as CachedThread;
  const messages = (thread.cached_messages ?? []).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return { ...thread, messages };
}

// ---------------------------------------------------------------------------
// 8. generateCompanyAISummary
// ---------------------------------------------------------------------------

const SUMMARY_MODEL = "llama-3.3-70b-versatile";

export async function generateCompanyAISummary(
  companyId: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const workspace = await getCompanyWorkspace(companyId);
  if (!workspace) throw new Error("Company not found");

  // Gather all message bodies from threads
  const messageSummaries: string[] = [];
  for (const thread of workspace.threads) {
    const messages = thread.cached_messages ?? [];
    for (const msg of messages) {
      const body = msg.bodyText?.slice(0, 500) || msg.snippet || "";
      if (body.trim()) {
        messageSummaries.push(
          `[${msg.date}] From: ${msg.from} | Subject: ${thread.subject}\n${body}`
        );
      }
    }
  }

  if (messageSummaries.length === 0) {
    return `No email threads found for ${workspace.company.name}. Summary cannot be generated without conversation data.`;
  }

  // Cap the context to avoid token limits
  const contextBlock = messageSummaries.slice(0, 30).join("\n---\n");

  const contactNames = workspace.contacts.map((c) => c.name).filter(Boolean);
  const contactTypes = [...new Set(workspace.contacts.map((c) => c.contact_type))];

  const prompt = `You are analyzing email conversations between Krishna and people at "${workspace.company.name}" (${workspace.company.domain}).

Company info:
- Industry: ${workspace.company.industry ?? "unknown"}
- Contacts: ${contactNames.join(", ") || "none named"}
- Contact types: ${contactTypes.join(", ")}
- Total threads: ${workspace.threads.length}
- Total contacts: ${workspace.contacts.length}

Here are the email conversations (most recent first, truncated):
${contextBlock}

Provide a concise summary covering:
1. **Why they contacted**: What was the initial reason for communication?
2. **Types of emails**: Job opportunities, visa sponsorship, follow-ups, etc.
3. **Shared contacts**: Key people involved and their roles.
4. **Inferred labels**: Categorize the relationship (e.g., "active recruiter pipeline", "one-off outreach", "vendor", "visa sponsor", etc.)

Keep it under 300 words. Be direct and factual.`;

  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
    temperature: 0.3,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ??
    "Unable to generate summary."
  );
}
