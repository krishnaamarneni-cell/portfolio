/**
 * What Groq actually serves right now.
 *
 * Groq retires model ids silently, and a retired one 404s with
 * "model_not_found". `llama-3.3-70b-versatile` going away broke every agent at
 * once; `llama-3.1-8b-instant` later took down the SAP assistant and everything
 * defaulting to DEFAULT_WRITING_MODEL. Hardcoding replacements just moves the
 * next outage, so ask Groq for its list and keep only ids that exist.
 *
 * This lives apart from lib/agents.ts so a route that calls the Groq SDK
 * directly — tool calling, JSON mode, vision — can share the same cache and the
 * same rename table without importing the whole agent runtime.
 */

let modelCache: { at: number; ids: Set<string> } | null = null;
const MODEL_CACHE_MS = 10 * 60_000;

/** Renames Groq has done. Tried when the original id is gone. */
export const RENAMES: Record<string, string[]> = {
  "compound-beta": ["groq/compound"],
  "compound-beta-mini": ["groq/compound-mini"],
};

/** Preference order when nothing the caller asked for still exists. */
export const PREFERRED = [
  "groq/compound",
  "groq/compound-mini",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
];

/** Null when the list can't be fetched — callers then trust their static ids. */
export async function availableModels(apiKey: string): Promise<Set<string> | null> {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_MS) return modelCache.ids;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: Array<{ id?: string }> };
    const ids = new Set((j.data ?? []).map((m) => String(m.id)).filter(Boolean));
    if (!ids.size) return null;
    modelCache = { at: Date.now(), ids };
    return ids;
  } catch {
    // Offline or the endpoint changed — fall through to the static chain.
    return null;
  }
}

/**
 * The first id in `preferred` that Groq is serving, for callers that use the
 * Groq SDK directly and so can't go through runAgent's fallback loop.
 *
 * Degrades in order: a requested id, a known rename of one, the global
 * preference list, anything Groq serves, and finally the caller's first choice —
 * so a failure to resolve still produces a real API error rather than
 * `undefined` reaching the SDK.
 */
export async function pickServableModel(
  apiKey: string,
  preferred: string[],
): Promise<string> {
  const fallback = preferred[0] ?? PREFERRED[0];
  const available = await availableModels(apiKey);
  if (!available) return fallback;

  for (const m of preferred) {
    if (available.has(m)) return m;
    for (const alt of RENAMES[m] ?? []) if (available.has(alt)) return alt;
  }
  for (const m of PREFERRED) if (available.has(m)) return m;
  return [...available][0] ?? fallback;
}
