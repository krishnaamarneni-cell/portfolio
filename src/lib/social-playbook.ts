/**
 * What's working, in a shape the writer can use.
 *
 * The analysis used to be a wall of markdown tables: readable once, stored
 * nowhere, and invisible to the thing actually writing the next post. So every
 * post was written from the same generic rules regardless of what had already
 * worked — the loop was open.
 *
 * Structured findings close it. "Personal outcome hooks average 432
 * impressions; feature announcements average 186" is only worth computing if
 * the generator can read it back, which means fields rather than prose.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type PlatformFinding = {
  platform: string;
  posts: number;
  avgImpressions: number | null;
  /** What the best-performing posts had in common. */
  winningPattern: string;
  /** The single strongest example, quoted, so the writer has a target. */
  bestHook: string | null;
  bestImpressions: number | null;
  /** What the weakest posts did differently. */
  losingPattern: string | null;
  verdict: string;
};

export type Playbook = {
  /** One-line answer to "what should I write next". */
  headline: string;
  platforms: PlatformFinding[];
  /** Concrete rules for the writer, ranked. */
  doMore: string[];
  doLess: string[];
  /** Themes that reached people, most reach first. */
  winningThemes: string[];
  /** The single change worth making, with its evidence. */
  biggestLever: string | null;
};

export type StoredPlaybook = {
  playbook: Playbook;
  postsAnalyzed: number;
  metricsAvailable: boolean;
  analyzedAt: string;
  modelUsed: string | null;
};

export async function getPlaybook(): Promise<StoredPlaybook | null> {
  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("social_playbook")
      .select("playbook,posts_analyzed,metrics_available,analyzed_at,model_used")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data?.playbook) return null;
    return {
      playbook: data.playbook as Playbook,
      postsAnalyzed: data.posts_analyzed ?? 0,
      metricsAvailable: Boolean(data.metrics_available),
      analyzedAt: data.analyzed_at,
      modelUsed: data.model_used ?? null,
    };
  } catch {
    return null;
  }
}

export async function savePlaybook(input: {
  playbook: Playbook;
  postsAnalyzed: number;
  metricsAvailable: boolean;
  modelUsed?: string | null;
}): Promise<string | null> {
  try {
    const db = requireSupabaseAdmin();
    const { error } = await db.from("social_playbook").upsert({
      id: 1,
      playbook: input.playbook,
      posts_analyzed: input.postsAnalyzed,
      metrics_available: input.metricsAvailable,
      model_used: input.modelUsed ?? null,
      analyzed_at: new Date().toISOString(),
    });
    if (!error) return null;
    return /does not exist|schema cache|relation/i.test(error.message)
      ? "Playbook not saved — run supabase/social_playbook.sql in Supabase."
      : `Playbook not saved: ${error.message}`;
  } catch (err) {
    return `Playbook not saved: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

/**
 * The playbook as prompt text.
 *
 * Deliberately terse and evidence-first. A model given "write something
 * engaging" produces the average of everything it has seen; given "your
 * personal-outcome hooks reached 432 while feature announcements reached 186",
 * it has something specific to aim at.
 *
 * Returns "" when there is nothing worth saying — an empty section beats
 * padding the prompt with a heading and no content.
 */
export function playbookToPrompt(stored: StoredPlaybook | null): string {
  if (!stored) return "";
  const p = stored.playbook;

  // Under a handful of posts the "pattern" is noise. Say so rather than letting
  // the writer chase a difference between two samples.
  if (stored.postsAnalyzed < 4 || !stored.metricsAvailable) return "";

  const lines: string[] = [
    "=== WHAT ACTUALLY WORKS FOR THIS ACCOUNT ===",
    `Learned from ${stored.postsAnalyzed} posts with real reach data.`,
    "Follow this over generic best practice — it is measured, not assumed.",
  ];

  if (p.headline) lines.push("", p.headline);

  const withData = p.platforms.filter((f) => f.posts > 0);
  if (withData.length) {
    lines.push("", "Per platform:");
    for (const f of withData) {
      const avg = f.avgImpressions !== null ? `${f.avgImpressions} avg impressions` : "no reach data";
      lines.push(`- ${f.platform} (${f.posts} posts, ${avg}): ${f.winningPattern}`);
      if (f.bestHook) {
        lines.push(
          `  Best hook so far${f.bestImpressions !== null ? ` (${f.bestImpressions} impressions)` : ""}: "${f.bestHook}"`
        );
      }
      if (f.losingPattern) lines.push(`  Avoid: ${f.losingPattern}`);
    }
  }

  if (p.winningThemes.length) {
    lines.push("", `Themes that reached people: ${p.winningThemes.join(", ")}`);
  }
  if (p.doMore.length) {
    lines.push("", "Do more of:");
    for (const d of p.doMore) lines.push(`- ${d}`);
  }
  if (p.doLess.length) {
    lines.push("", "Do less of:");
    for (const d of p.doLess) lines.push(`- ${d}`);
  }
  if (p.biggestLever) lines.push("", `Highest-leverage change: ${p.biggestLever}`);

  return lines.join("\n");
}

/** Tolerant parse of the model's structured answer. */
export function parsePlaybook(raw: string): Playbook | null {
  const block = raw.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    const o = JSON.parse(block[0]) as Record<string, unknown>;
    const str = (v: unknown, max = 300) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
    const list = (v: unknown, max = 8) =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [];

    const platforms = Array.isArray(o.platforms)
      ? o.platforms.map((raw) => {
          const f = raw as Record<string, unknown>;
          return {
            platform: str(f.platform, 40) ?? "unknown",
            posts: num(f.posts) ?? 0,
            avgImpressions: num(f.avgImpressions),
            winningPattern: str(f.winningPattern) ?? "",
            bestHook: str(f.bestHook, 200),
            bestImpressions: num(f.bestImpressions),
            losingPattern: str(f.losingPattern),
            verdict: str(f.verdict) ?? "",
          } satisfies PlatformFinding;
        })
      : [];

    return {
      headline: str(o.headline) ?? "",
      platforms,
      doMore: list(o.doMore),
      doLess: list(o.doLess),
      winningThemes: list(o.winningThemes, 10),
      biggestLever: str(o.biggestLever, 400),
    };
  } catch {
    return null;
  }
}
