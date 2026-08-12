/**
 * Recruiter contacts — extracted from Gmail by the Email Intelligence agent.
 *
 * Table: recruiter_contacts (auto-created on first use via lazy upsert).
 * Each contact = name + email + company + role they pitched + match % + notes.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { isUnsendable } from "@/lib/unsendable";

export type ContactType =
  | "recruiter"
  | "hiring_manager"
  | "visa"
  | "personal"
  | "colleague"
  | "business"
  | "vendor"
  | "unknown";

export type RecruiterContact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  company_id: string | null;
  role_pitched: string | null;
  match_pct: number | null;
  source: string;
  notes: string | null;
  starred: boolean;
  emailed_at: string | null;
  times_contacted: number;
  contact_type: ContactType;
  tags: string[];
  do_not_contact: boolean;
  excluded_from_bulk: boolean;
  priority: number | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  last_gmail_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecruiterContactInput = {
  name: string;
  email: string;
  company?: string | null;
  company_id?: string | null;
  role_pitched?: string | null;
  match_pct?: number | null;
  source?: string;
  notes?: string | null;
  contact_type?: ContactType;
  tags?: string[];
  phone?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
};

export type ContactFilters = {
  tags?: string[];
  companyId?: string;
  contactType?: ContactType;
  excludeDNC?: boolean;
  excludeBulk?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

const TABLE = "recruiter_contacts";

/** Check if the table exists. If not, log a clear error. */
let tableChecked = false;
async function ensureTable() {
  if (tableChecked) return;
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (error?.code === "42P01") {
    console.error(
      "[contacts] Table 'recruiter_contacts' does not exist. Run supabase/recruiter_contacts.sql in the Supabase SQL editor."
    );
    throw new Error("recruiter_contacts table not found — run the SQL migration in Supabase");
  }
  tableChecked = true;
}

export async function listContacts(): Promise<RecruiterContact[]> {
  await ensureTable();
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .order("starred", { ascending: false })
    .order("match_pct", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as RecruiterContact[];
}

export async function upsertContact(
  input: RecruiterContactInput
): Promise<RecruiterContact> {
  await ensureTable();
  const supabase = requireSupabaseAdmin();
  const email = input.email.toLowerCase().trim();

  if (input.source !== "manual" && isUnsendable(email)) {
    throw new Error(`Blocked junk/noreply address: ${email}`);
  }

  // Check if exists — if so, increment times_contacted.
  const { data: existing } = await supabase
    .from(TABLE)
    .select("id, times_contacted")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        name: input.name || undefined,
        company: input.company ?? undefined,
        role_pitched: input.role_pitched ?? undefined,
        match_pct: input.match_pct ?? undefined,
        source: input.source ?? undefined,
        notes: input.notes ?? undefined,
        contact_type: input.contact_type ?? undefined,
        times_contacted: (existing.times_contacted ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as RecruiterContact;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      email,
      name: input.name || "",
      company: input.company ?? null,
      role_pitched: input.role_pitched ?? null,
      match_pct: input.match_pct ?? null,
      source: input.source ?? "manual",
      notes: input.notes ?? null,
      contact_type: input.contact_type ?? "unknown",
      times_contacted: 1,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RecruiterContact;
}

export async function upsertMany(
  inputs: RecruiterContactInput[]
): Promise<number> {
  if (inputs.length === 0) return 0;
  // Ensure table exists once before the loop.
  await ensureTable();
  let saved = 0;
  for (const c of inputs) {
    try {
      if (isUnsendable(c.email)) continue;
      const supabase = requireSupabaseAdmin();
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          {
            email: c.email.toLowerCase().trim(),
            name: c.name || "",
            company: c.company ?? null,
            role_pitched: c.role_pitched ?? null,
            match_pct: c.match_pct ?? null,
            source: c.source ?? "inbox-agent",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );
      if (!error) saved++;
    } catch {
      // skip bad data, continue with rest
    }
  }
  return saved;
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from(TABLE).delete().eq("id", id);
}

export async function toggleStar(
  id: string,
  starred: boolean
): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase
    .from(TABLE)
    .update({ starred, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markEmailed(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase
    .from(TABLE)
    .update({
      emailed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function updateContactType(
  id: string,
  contactType: ContactType
): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase
    .from(TABLE)
    .update({
      contact_type: contactType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function listContactsFiltered(
  filters: ContactFilters = {}
): Promise<RecruiterContact[]> {
  await ensureTable();
  const supabase = requireSupabaseAdmin();
  let q = supabase.from(TABLE).select("*");

  if (filters.companyId) q = q.eq("company_id", filters.companyId);
  if (filters.contactType) q = q.eq("contact_type", filters.contactType);
  if (filters.excludeDNC) q = q.eq("do_not_contact", false);
  if (filters.excludeBulk) q = q.eq("excluded_from_bulk", false);
  if (filters.tags?.length) q = q.contains("tags", filters.tags);
  if (filters.search) {
    q = q.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
    );
  }

  q = q
    .order("starred", { ascending: false })
    .order("last_gmail_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.limit) q = q.limit(filters.limit);
  if (filters.offset) q = q.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

  const { data } = await q;
  return (data ?? []) as RecruiterContact[];
}

export async function updateContactFields(
  id: string,
  patch: Partial<{
    name: string;
    email: string;
    company: string | null;
    company_id: string | null;
    role_pitched: string | null;
    notes: string | null;
    contact_type: ContactType;
    tags: string[];
    do_not_contact: boolean;
    excluded_from_bulk: boolean;
    priority: number | null;
    phone: string | null;
    title: string | null;
    linkedin_url: string | null;
    last_gmail_activity_at: string | null;
  }>
): Promise<RecruiterContact | null> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return null;
  return data as RecruiterContact;
}

export async function getContact(id: string): Promise<RecruiterContact | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RecruiterContact | null) ?? null;
}
