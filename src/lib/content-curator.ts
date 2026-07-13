/**
 * The link between the scouts and the Social Observer. Other agents call
 * curateToIdeas() with their findings; it reads the Observer's content profile
 * (what Krishna posts), keeps only findings that fit his style, dedupes against
 * existing ideas, and saves the survivors to the Ideas inbox.
 */
import { requireSupabaseAdmin } from "@/lib/supabase";
import { runAgent } from "@/lib/agents";

// Fallback so the loop works before the Observer has ever run.
const DEFAULT_PROFILE = `Krishna posts about: personal money lessons & wealth-building, consumer/scam warnings from real experiences, AI's impact on work and careers, and building-in-public (his projects like WealthClaude and Lucy). Tone: candid, first-person, contrarian, with bold one-line hooks. LinkedIn = longer personal stories that land a lesson; X = sharp opinionated takes; Instagram = vulnerable storytelling.`;

export async function getContentProfile(): Promise<string> {
  try {
    const db = requireSupabaseAdmin();
    const { data } = await db.from("social_profile").select("profile").eq("id", 1).maybeSingle();
    return (data?.profile || "").trim() || DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveContentProfile(profile: string): Promise<void> {
  if (!profile.trim()) return;
  try {
    const db = requireSupabaseAdmin();
    await db
      .from("social_profile")
      .upsert({ id: 1, profile: profile.slice(0, 4000), updated_at: new Date().toISOString() });
  } catch {
    // table may not exist yet — the default profile still works
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Judge an agent's findings against Krishna's content profile and save the
 * fitting ones as post ideas. Returns how many were saved (0 if nothing fit).
 */
export async function curateToIdeas(opts: {
  apiKey: string;
  source: string; // e.g. "news"
  findings: string; // the agent's markdown / item list
  model?: string;
}): Promise<{ saved: number; ideas: { topic: string; note: string }[] }> {
  const profile = await getContentProfile();

  const system = `You decide which of an agent's findings would make a GREAT social post in Krishna's established style — and ONLY those.

Krishna's content profile (what he posts):
${profile}

From the findings, pick 0-3 items that GENUINELY fit his voice and audience. Skip anything off-brand, or purely informational with no personal angle he could take. Be selective — it's fine to pick zero. For each keeper, write a post TOPIC (specific, phrased the way he'd frame it) and a one-line ANGLE/hook.

Return STRICT JSON, no fences: { "ideas": [ { "topic": "...", "note": "..." } ] }. If nothing fits, return { "ideas": [] }.`;

  const model = (opts.model || "").startsWith("compound")
    ? "llama-3.3-70b-versatile"
    : opts.model || "llama-3.3-70b-versatile";

  const res = await runAgent({
    apiKey: opts.apiKey,
    model,
    systemPrompt: system,
    userPrompt: `Findings:\n${opts.findings.slice(0, 6000)}`,
    maxTokens: 800,
  });
  if (!res.ok || !res.content) return { saved: 0, ideas: [] };

  let parsed: { ideas?: Array<{ topic?: string; note?: string }> } | null = null;
  try {
    parsed = JSON.parse(res.content);
  } catch {
    const s = res.content.indexOf("{");
    const e = res.content.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        parsed = JSON.parse(res.content.slice(s, e + 1));
      } catch {}
    }
  }

  const ideas = (parsed?.ideas ?? [])
    .filter((i) => i && typeof i.topic === "string" && i.topic.trim())
    .slice(0, 3)
    .map((i) => ({ topic: i.topic!.trim().slice(0, 300), note: (i.note ?? "").trim().slice(0, 300) }));
  if (ideas.length === 0) return { saved: 0, ideas: [] };

  try {
    const db = requireSupabaseAdmin();
    const { data: existing } = await db
      .from("social_ideas")
      .select("topic")
      .eq("status", "new")
      .limit(300);
    const seen = new Set((existing ?? []).map((r: { topic: string }) => norm(r.topic)));
    const fresh = ideas.filter((i) => !seen.has(norm(i.topic)));
    if (fresh.length === 0) return { saved: 0, ideas: [] };
    const { error } = await db
      .from("social_ideas")
      .insert(fresh.map((i) => ({ topic: i.topic, note: i.note || null, source: opts.source })));
    if (error) return { saved: 0, ideas: [] };
    return { saved: fresh.length, ideas: fresh };
  } catch {
    return { saved: 0, ideas: [] };
  }
}
