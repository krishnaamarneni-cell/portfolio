/**
 * Recruiter contacts — extracted from Gmail by the Email Intelligence agent.
 *
 * Table: recruiter_contacts (auto-created on first use via lazy upsert).
 * Each contact = name + email + company + role they pitched + match % + notes.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type RecruiterContact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role_pitched: string | null;
  match_pct: number | null;
  source: string; // "inbox-agent", "manual"
  notes: string | null;
  starred: boolean;
  emailed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecruiterContactInput = {
  name: string;
  email: string;
  company?: string | null;
  role_pitched?: string | null;
  match_pct?: number | null;
  source?: string;
  notes?: string | null;
};

const TABLE = "recruiter_contacts";

/** Ensure the table exists — runs once, idempotent. */
async function ensureTable() {
  const supabase = requireSupabaseAdmin();
  // Try a lightweight query; if the table doesn't exist, create it.
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (error?.code === "42P01") {
    // Table doesn't exist — create it via raw SQL.
    await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL,
          company TEXT,
          role_pitched TEXT,
          match_pct INT,
          source TEXT NOT NULL DEFAULT 'manual',
          notes TEXT,
          starred BOOLEAN NOT NULL DEFAULT FALSE,
          emailed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(email)
        );
      `,
    });
  }
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
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        email: input.email.toLowerCase().trim(),
        name: input.name || "",
        company: input.company ?? null,
        role_pitched: input.role_pitched ?? null,
        match_pct: input.match_pct ?? null,
        source: input.source ?? "manual",
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RecruiterContact;
}

export async function upsertMany(
  inputs: RecruiterContactInput[]
): Promise<number> {
  let saved = 0;
  for (const c of inputs) {
    try {
      await upsertContact(c);
      saved++;
    } catch {
      // skip duplicates / bad data
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
