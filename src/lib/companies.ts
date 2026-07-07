import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

const TABLE = "crm_companies";

export type Company = {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
  industry: string | null;
  notes: string | null;
  contact_count: number;
  last_activity_at: string | null;
  is_current_employer: boolean;
  excluded_from_bulk: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyInput = {
  name: string;
  domain: string;
  aliases?: string[];
  industry?: string | null;
  notes?: string | null;
  is_current_employer?: boolean;
  excluded_from_bulk?: boolean;
};

const STRIP_SUBDOMAINS = [
  "jobs",
  "careers",
  "hr",
  "recruiting",
  "talent",
  "mail",
  "email",
  "smtp",
  "staffing",
  "apply",
];

export function normalizeDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  let domain = email.slice(at + 1).toLowerCase().trim();
  const parts = domain.split(".");
  if (parts.length > 2) {
    const sub = parts[0];
    if (STRIP_SUBDOMAINS.includes(sub)) {
      domain = parts.slice(1).join(".");
    }
  }
  return domain;
}

export function guessCompanyName(domain: string): string {
  const base = domain.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function listCompanies(): Promise<Company[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .order("contact_count", { ascending: false })
    .order("name", { ascending: true });
  return (data ?? []) as Company[];
}

export async function getCompany(id: string): Promise<Company | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Company | null) ?? null;
}

export async function findCompanyByDomain(
  domain: string
): Promise<Company | null> {
  const supabase = requireSupabaseAdmin();
  const { data: exact } = await supabase
    .from(TABLE)
    .select("*")
    .eq("domain", domain)
    .maybeSingle();
  if (exact) return exact as Company;

  const { data: alias } = await supabase
    .from(TABLE)
    .select("*")
    .contains("aliases", [domain])
    .maybeSingle();
  return (alias as Company | null) ?? null;
}

export async function upsertCompanyFromDomain(
  domain: string,
  name?: string
): Promise<Company> {
  const normalized = domain.toLowerCase().trim();
  const existing = await findCompanyByDomain(normalized);
  if (existing) return existing;

  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: name || guessCompanyName(normalized),
      domain: normalized,
      aliases: [],
      contact_count: 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const retry = await findCompanyByDomain(normalized);
      if (retry) return retry;
    }
    throw new Error(error.message);
  }
  return data as Company;
}

export async function updateCompany(
  id: string,
  patch: Partial<CompanyInput>
): Promise<Company> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Company;
}

export async function deleteCompany(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from(TABLE).delete().eq("id", id);
}

export async function refreshCompanyCount(companyId: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { count } = await supabase
    .from("recruiter_contacts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  await supabase
    .from(TABLE)
    .update({ contact_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq("id", companyId);
}

export async function autoLinkContacts(): Promise<{
  linked: number;
  companies: number;
}> {
  const supabase = requireSupabaseAdmin();
  const { data: unlinked } = await supabase
    .from("recruiter_contacts")
    .select("id, email, company")
    .is("company_id", null);

  let linked = 0;
  const companyIds = new Set<string>();

  for (const contact of unlinked ?? []) {
    if (!contact.email) continue;
    const domain = normalizeDomain(contact.email);
    if (!domain || domain.includes("gmail.") || domain.includes("yahoo.") || domain.includes("hotmail.") || domain.includes("outlook.")) continue;

    try {
      const company = await upsertCompanyFromDomain(
        domain,
        contact.company || undefined
      );
      await supabase
        .from("recruiter_contacts")
        .update({ company_id: company.id, updated_at: new Date().toISOString() })
        .eq("id", contact.id);
      companyIds.add(company.id);
      linked++;
    } catch {
      // skip
    }
  }

  for (const cid of companyIds) {
    await refreshCompanyCount(cid);
  }

  return { linked, companies: companyIds.size };
}
