import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { listFacts, upsertFact } from "@/lib/facts";
import { createNote, listNotes } from "@/lib/personal";
import { resolveModel } from "@/lib/groq-models";

/**
 * Memory agent — scans recent chats + personal notes for things worth
 * remembering. Suggestions go into a queue you review before they touch
 * the real facts / notes tables.
 *
 * Trigger: manual button OR a scheduled run if you wire one up later.
 *
 * Source signals it looks for:
 *  - Durable facts (visa status, location, preferences, relationships)
 *  - Action items with a date (book flight, call X, pay Y)
 *  - Decisions made
 *  - Important contacts mentioned
 *  - Birthdays / anniversaries
 *
 * Things it explicitly skips:
 *  - Trivia, jokes, casual chat
 *  - Anything already in the facts table (dedup)
 *  - Stuff older than 30 days
 *  - Any line that includes "don't remember" or similar opt-out
 */

export type MemorySuggestionRow = {
  id: string;
  source_kind: "chat" | "note" | "manual";
  source_id: string | null;
  suggested_kind: "fact" | "note";
  suggested_data: Record<string, unknown>;
  confidence: number | null;
  reasoning: string | null;
  status: "pending" | "accepted" | "rejected";
  resolved_at: string | null;
  resolved_resource_id: string | null;
  created_at: string;
};

type ScanReport = {
  scanned: { chats: number; notes: number };
  suggestionsCreated: number;
  skippedDuplicates: number;
  windowStart: string;
  model: string;
  error?: string;
};

const DEFAULT_WINDOW_HOURS = 24 * 30; // 30 days

async function getLastScanAt(): Promise<string | null> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("admin_settings")
    .select("memory_scan_last_at")
    .eq("id", "singleton")
    .maybeSingle();
  return (data?.memory_scan_last_at as string | null) ?? null;
}

async function setLastScanAt(ts: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase
    .from("admin_settings")
    .upsert({ id: "singleton", memory_scan_last_at: ts });
}

export async function scanForMemories(opts: { sinceHours?: number; force?: boolean } = {}): Promise<ScanReport> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return emptyReport({ error: "GROQ_API_KEY not set" });
  }
  const supabase = requireSupabaseAdmin();
  const now = new Date();
  const lastScan = opts.force ? null : await getLastScanAt();
  const windowStart = lastScan
    ? new Date(lastScan)
    : new Date(now.getTime() - (opts.sinceHours ?? DEFAULT_WINDOW_HOURS) * 3_600_000);
  const windowISO = windowStart.toISOString();

  // ── Pull chat messages since cursor ──
  const { data: chatRows } = await supabase
    .from("chat_messages")
    .select("id, thread_id, role, content, created_at")
    .gte("created_at", windowISO)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(200);
  const chats = (chatRows ?? []) as Array<{
    id: string;
    thread_id: string;
    role: string;
    content: string | null;
    created_at: string;
  }>;

  // ── Pull notes since cursor ──
  const allNotes = await listNotes();
  const notes = allNotes
    .filter((n) => n.created_at >= windowISO)
    .slice(0, 50);

  // ── Pull existing facts so we can dedup ──
  const existingFacts = await listFacts();
  const existingKeys = new Set(existingFacts.map((f) => f.key.toLowerCase()));

  if (chats.length === 0 && notes.length === 0) {
    await setLastScanAt(now.toISOString());
    return {
      scanned: { chats: 0, notes: 0 },
      suggestionsCreated: 0,
      skippedDuplicates: 0,
      windowStart: windowISO,
      model: "(no-op)",
    };
  }

  // ── Build the prompt ──
  const factsBlock = existingFacts.length
    ? existingFacts.map((f) => `- ${f.key}: ${f.value} [${f.category}]`).join("\n")
    : "(no facts on file yet)";

  const chatBlock = chats
    .slice(-80)
    .map((c) => `[${c.created_at.slice(0, 16)}][${c.role}] ${truncate(c.content ?? "", 600)}`)
    .join("\n");

  const notesBlock = notes
    .map((n) => `[${n.created_at.slice(0, 16)}] (${n.tags.join(",")}) ${truncate(n.body, 400)}`)
    .join("\n");

  const system = `You are Krishna's memory agent. You read his recent chats and notes and identify items worth REMEMBERING as durable facts or actionable notes.

What "worth remembering" means:
- Personal facts (visa status, location, family, preferences, important contacts)
- Decisions he made ("I decided to use Stripe", "moving to Tampa")
- Dates / events he mentioned in passing ("flight on June 5", "wife's birthday April 12")
- Action items with a clear next step
- Health / visa / legal updates
- Recurring routines

What to SKIP:
- Anything already in the facts table below (dedup on key)
- Trivia, jokes, casual chat
- Hypotheticals ("what if I…")
- Things he explicitly opted out of remembering ("don't save this", "ignore that")

Output STRICT JSON, no markdown fences:
{
  "suggestions": [
    {
      "type": "fact" | "note",
      "data": {
        // for type=fact:
        //   key (lowercase_snake), value, category (visa|location|family|work|health|preferences|finance|general), expires_at? (YYYY-MM-DD)
        // for type=note:
        //   body, tags (lowercase array), event_date? (YYYY-MM-DD)
      },
      "source_kind": "chat" | "note",
      "source_id": "<id of the original chat message or note>",
      "confidence": 0.0-1.0,
      "reasoning": "one sentence explaining what makes this worth remembering"
    }
  ]
}

Quality bar:
- Max 12 suggestions per run. Be picky — surface the highest-leverage items.
- Confidence < 0.5 → don't suggest at all.
- Reasoning must reference what was actually said.`;

  const userPrompt = `# Existing facts (DO NOT duplicate)
${factsBlock}

# Recent chat messages
${chatBlock || "(none in window)"}

# Recent personal notes
${notesBlock || "(none in window)"}

Window start: ${windowISO}`;

  const model = resolveModel("writing");

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: { suggestions?: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return emptyReport({ error: "Model returned non-JSON" });
    }
    const suggestions = (parsed.suggestions ?? []).slice(0, 12);

    // ── Filter dupes + low-confidence, persist new pending rows ──
    let created = 0;
    let dupes = 0;
    for (const s of suggestions) {
      const type = String(s.type ?? "").toLowerCase();
      if (type !== "fact" && type !== "note") continue;
      const conf = Number(s.confidence ?? 0);
      if (!Number.isFinite(conf) || conf < 0.5) continue;

      const data = (s.data ?? {}) as Record<string, unknown>;
      // Dedup against facts table by key.
      if (type === "fact") {
        const key = String(data.key ?? "").toLowerCase();
        if (!key) continue;
        if (existingKeys.has(key)) {
          dupes++;
          continue;
        }
        // Dedup against pending suggestions for same key.
        const { data: existing } = await supabase
          .from("memory_suggestions")
          .select("id")
          .eq("status", "pending")
          .eq("suggested_kind", "fact")
          .filter("suggested_data->>key", "eq", key)
          .limit(1);
        if (existing && existing.length > 0) {
          dupes++;
          continue;
        }
      }

      await supabase.from("memory_suggestions").insert({
        source_kind: ["chat", "note"].includes(String(s.source_kind))
          ? String(s.source_kind)
          : "chat",
        source_id: s.source_id ? String(s.source_id) : null,
        suggested_kind: type,
        suggested_data: data,
        confidence: conf,
        reasoning: s.reasoning ? String(s.reasoning).slice(0, 500) : null,
        status: "pending",
      });
      created++;
    }

    await setLastScanAt(now.toISOString());

    return {
      scanned: { chats: chats.length, notes: notes.length },
      suggestionsCreated: created,
      skippedDuplicates: dupes,
      windowStart: windowISO,
      model,
    };
  } catch (err) {
    return emptyReport({
      error: err instanceof Error ? err.message : "Scan failed",
      model,
      windowStart: windowISO,
    });
  }
}

function emptyReport(opts: Partial<ScanReport>): ScanReport {
  return {
    scanned: { chats: 0, notes: 0 },
    suggestionsCreated: 0,
    skippedDuplicates: 0,
    windowStart: new Date().toISOString(),
    model: "(none)",
    ...opts,
  };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

/* ─── Queue management ─── */

export async function listSuggestions(opts: {
  status?: "pending" | "accepted" | "rejected" | "all";
} = {}): Promise<MemorySuggestionRow[]> {
  const supabase = requireSupabaseAdmin();
  let q = supabase
    .from("memory_suggestions")
    .select("*")
    .order("created_at", { ascending: false });
  if (!opts.status || opts.status !== "all") {
    q = q.eq("status", opts.status ?? "pending");
  }
  const { data } = await q;
  return (data ?? []) as MemorySuggestionRow[];
}

export async function acceptSuggestion(
  id: string,
  /** Optional override — user may have edited the suggested data before accepting. */
  overrideData?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; resourceId?: string }> {
  const supabase = requireSupabaseAdmin();
  const { data: row } = await supabase
    .from("memory_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Suggestion not found" };
  if (row.status !== "pending") return { ok: false, error: "Already resolved" };

  const data = overrideData ?? (row.suggested_data as Record<string, unknown>);
  let resourceId: string | undefined;
  try {
    if (row.suggested_kind === "fact") {
      const key = String(data.key ?? "").toLowerCase();
      const value = String(data.value ?? "").trim();
      if (!key || !value) return { ok: false, error: "key and value required" };
      const fact = await upsertFact({
        key,
        value,
        category: typeof data.category === "string" ? data.category : "general",
        expires_at: typeof data.expires_at === "string" ? data.expires_at : undefined,
        source: "agent",
      });
      resourceId = fact.id;
    } else if (row.suggested_kind === "note") {
      const body = String(data.body ?? "").trim();
      if (!body) return { ok: false, error: "body required" };
      const note = await createNote({
        body,
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        event_date: typeof data.event_date === "string" ? data.event_date : null,
        source: "agent",
      });
      resourceId = note.id;
    } else {
      return { ok: false, error: "Unknown kind" };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
  await supabase
    .from("memory_suggestions")
    .update({
      status: "accepted",
      resolved_at: new Date().toISOString(),
      resolved_resource_id: resourceId ?? null,
    })
    .eq("id", id);
  return { ok: true, resourceId };
}

export async function rejectSuggestion(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase
    .from("memory_suggestions")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
}
