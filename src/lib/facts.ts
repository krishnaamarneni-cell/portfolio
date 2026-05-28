import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type PersonalFact = {
  id: string;
  key: string;
  value: string;
  category: string;
  expires_at: string | null;
  source: string;
  updated_at: string;
};

export type FactInput = Partial<Omit<PersonalFact, "id" | "updated_at">> & {
  key: string;
  value: string;
};

export async function listFacts(): Promise<PersonalFact[]> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from("personal_facts")
    .select("*")
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonalFact[];
}

export async function upsertFact(input: FactInput): Promise<PersonalFact> {
  const supabase = requireSupabaseAdmin();
  const row = {
    key: input.key,
    value: input.value,
    category: input.category ?? "general",
    expires_at: input.expires_at ?? null,
    source: input.source ?? "manual",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("personal_facts")
    .upsert(row, { onConflict: "key" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PersonalFact;
}

export async function deleteFact(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("personal_facts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Build a single Markdown block of facts ready to drop into any system prompt. */
export async function buildFactsContext(): Promise<string> {
  try {
    const facts = await listFacts();
    if (facts.length === 0) return "";
    const byCategory = new Map<string, PersonalFact[]>();
    for (const f of facts) {
      if (!byCategory.has(f.category)) byCategory.set(f.category, []);
      byCategory.get(f.category)!.push(f);
    }
    const now = Date.now();
    const lines: string[] = ["What you know about Krishna (auto-loaded from his facts table):"];
    for (const [cat, items] of byCategory.entries()) {
      lines.push(`\n[${cat}]`);
      for (const f of items) {
        let suffix = "";
        if (f.expires_at) {
          const expMs = new Date(f.expires_at + "T00:00:00Z").getTime();
          const days = Math.floor((expMs - now) / 86_400_000);
          suffix =
            days < 0
              ? ` (EXPIRED ${-days}d ago)`
              : days < 365
              ? ` (in ${days}d)`
              : ` (${f.expires_at})`;
        }
        lines.push(`- ${f.key}: ${f.value}${suffix}`);
      }
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}
