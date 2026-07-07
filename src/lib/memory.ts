import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────

export type MemoryLayer = "session" | "task" | "profile" | "knowledge" | "skill";

export type ProfileFact = {
  id: string;
  key: string;
  value: string;
  category: string;
  source: string;
  confidence: number;
  verified: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeFact = {
  id: string;
  content: string;
  domain: string;
  source_type: "document" | "email" | "web" | "agent" | "manual";
  source_id: string | null;
  source_url: string | null;
  confidence: number;
  verified: boolean;
  created_by: string | null;
  created_at: string;
};

// ─── Profile Memory ───────────────────────────────────────────────

export async function listProfileFacts(category?: string): Promise<ProfileFact[]> {
  const db = requireSupabaseAdmin();
  let q = db
    .from("profile_memory")
    .select("*")
    .order("category")
    .order("key");
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileFact[];
}

export async function upsertProfileFact(input: {
  key: string;
  value: string;
  category?: string;
  source?: string;
  confidence?: number;
  verified?: boolean;
  expires_at?: string | null;
}): Promise<ProfileFact> {
  const db = requireSupabaseAdmin();
  const row = {
    key: input.key,
    value: input.value,
    category: input.category ?? "general",
    source: input.source ?? "manual",
    confidence: input.confidence ?? 1.0,
    verified: input.verified ?? true,
    expires_at: input.expires_at ?? null,
  };
  const { data, error } = await db
    .from("profile_memory")
    .upsert(row, { onConflict: "key,category" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProfileFact;
}

export async function deleteProfileFact(id: string): Promise<void> {
  const db = requireSupabaseAdmin();
  const { error } = await db.from("profile_memory").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function buildProfileContext(): Promise<string> {
  try {
    const facts = await listProfileFacts();
    if (facts.length === 0) return "";
    const byCategory = new Map<string, ProfileFact[]>();
    for (const f of facts) {
      if (!byCategory.has(f.category)) byCategory.set(f.category, []);
      byCategory.get(f.category)!.push(f);
    }
    const now = Date.now();
    const lines: string[] = [
      "What you know about Krishna (auto-loaded from profile memory):",
    ];
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
        if (!f.verified) suffix += " [unverified]";
        lines.push(`- ${f.key}: ${f.value}${suffix}`);
      }
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

// ─── Knowledge Memory ─────────────────────────────────────────────

export async function insertKnowledge(input: {
  content: string;
  domain: string;
  source_type: KnowledgeFact["source_type"];
  source_id?: string;
  source_url?: string;
  confidence?: number;
  created_by?: string;
}): Promise<KnowledgeFact> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("knowledge_memory")
    .insert({
      content: input.content,
      domain: input.domain,
      source_type: input.source_type,
      source_id: input.source_id ?? null,
      source_url: input.source_url ?? null,
      confidence: input.confidence ?? 1.0,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as KnowledgeFact;
}

export async function searchKnowledge(opts: {
  domain?: string;
  query?: string;
  limit?: number;
}): Promise<KnowledgeFact[]> {
  const db = requireSupabaseAdmin();
  let q = db
    .from("knowledge_memory")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.domain) q = q.eq("domain", opts.domain);
  if (opts.query) q = q.ilike("content", `%${opts.query}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgeFact[];
}

// ─── Memory Read Helpers ──────────────────────────────────────────

export async function readMemoryForAgent(agentSlug: string): Promise<string> {
  const db = requireSupabaseAdmin();
  const { data: reg } = await db
    .from("agent_registry")
    .select("memory_read")
    .eq("slug", agentSlug)
    .maybeSingle();

  const readScopes: string[] = (reg?.memory_read as string[]) ?? ["profile"];
  const blocks: string[] = [];

  if (readScopes.includes("profile")) {
    const profileCtx = await buildProfileContext();
    if (profileCtx) blocks.push(profileCtx);
  }

  if (readScopes.includes("knowledge")) {
    const recent = await searchKnowledge({ limit: 10 });
    if (recent.length > 0) {
      blocks.push(
        "\nRecent knowledge entries:\n" +
          recent.map((k) => `- [${k.domain}] ${k.content.slice(0, 200)}`).join("\n")
      );
    }
  }

  return blocks.join("\n\n");
}
