/**
 * Turning a sentence into a note the system can act on.
 *
 * The old flow asked for a category, a date and a reminder lead time in
 * separate fields, which is three decisions for something you wanted to jot
 * down in five seconds — so the fields went unfilled and every note became
 * undated, uncategorised text.
 *
 * Here one line of writing produces all of it. The lead time matters as much as
 * the date: a girlfriend's birthday eight months out and a visa filing due next
 * week are both "upcoming", and treating them the same is exactly what turns a
 * daily digest into noise. Each note carries its own idea of when it becomes
 * worth mentioning.
 */
import "server-only";
import { resolveAgentModel, runAgent } from "@/lib/agents";

export type ParsedNote = {
  tags: string[];
  event_date: string | null;
  remind_before_days: number | null;
  urgency: "now" | "soon" | "scheduled" | "background";
  summary: string;
  /** Topics to watch the news for — empty when nothing external would help. */
  watch: string[];
};

/** The categories the rest of the system groups on. */
export const NOTE_CATEGORIES = [
  "work",
  "visa",
  "money",
  "travel",
  "life",
  "health",
  "housing",
  "family",
  "admin",
] as const;

const SYSTEM = `You turn one personal note into structured fields.

Return ONLY a JSON object. No prose, no markdown fences.

{
  "tags": ["1-3 from: work, visa, money, travel, life, health, housing, family, admin"],
  "event_date": "YYYY-MM-DD if the note refers to a specific date, else null",
  "remind_before_days": how many days BEFORE event_date this becomes worth raising, else null,
  "urgency": "now" | "soon" | "scheduled" | "background",
  "summary": "the note in under 12 words, as a thing to be done or known",
  "watch": ["topics worth watching news for, or [] if none would help"]
}

remind_before_days is the important judgement. Pick the point at which the
person could still act:
- a birthday or anniversary: about 14 — enough time to buy something
- a flight to book: about 60 — fares move
- a visa filing or legal deadline: about 90 — these need preparation
- a bill or payment: about 7
- a deadline someone set for themselves ("find a job in 60 days"): about 14

urgency:
- "now": already overdue, or actionable today
- "soon": days to a few weeks away
- "scheduled": a real date, comfortably far off
- "background": true but not time-bound — a standing fact about their situation

DATES. When a month and day are given with no year, choose the NEXT occurrence
from today. "in 60 days" means today plus 60. If no date is stated or implied,
event_date is null — never invent one.

WATCH. Only topics where outside news would genuinely change what they do:
immigration policy for a visa note, airfare or route changes for a flight,
layoffs or hiring at a named employer for a job note, rates for a debt note.
A birthday needs no news. Return [] rather than something tenuous.`;

function clampDays(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(365, Math.round(n));
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function parseNoteResponse(raw: string): ParsedNote | null {
  const block = raw.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    const o = JSON.parse(block[0]) as Record<string, unknown>;
    const allowed = new Set<string>(NOTE_CATEGORIES);
    const tags = Array.isArray(o.tags)
      ? [...new Set(o.tags.map((t) => String(t).toLowerCase().trim()))].filter((t) => allowed.has(t))
      : [];
    const urgency = ["now", "soon", "scheduled", "background"].includes(String(o.urgency))
      ? (o.urgency as ParsedNote["urgency"])
      : "background";

    return {
      tags: tags.length ? tags.slice(0, 3) : ["life"],
      event_date: isIsoDate(o.event_date) ? o.event_date : null,
      remind_before_days: clampDays(o.remind_before_days),
      urgency,
      summary: typeof o.summary === "string" ? o.summary.trim().slice(0, 120) : "",
      watch: Array.isArray(o.watch)
        ? [...new Set(o.watch.map((w) => String(w).trim()).filter(Boolean))].slice(0, 4)
        : [],
    };
  } catch {
    return null;
  }
}

export async function parseNote(
  apiKey: string,
  body: string
): Promise<{ ok: true; parsed: ParsedNote } | { ok: false; error: string }> {
  const today = new Date().toISOString().slice(0, 10);

  const result = await runAgent({
    apiKey,
    model: resolveAgentModel(null),
    systemPrompt: SYSTEM,
    userPrompt: `TODAY IS ${today}.\n\nNOTE:\n${body.slice(0, 2000)}`,
    maxTokens: 500,
  });

  if (!result.ok || !result.content) {
    return { ok: false, error: result.error ?? "no response" };
  }
  const parsed = parseNoteResponse(result.content);
  if (!parsed) return { ok: false, error: "could not parse response" };
  return { ok: true, parsed };
}

/**
 * Should this note be raised today?
 *
 * The rule the digest was missing: a note is due when it is inside its OWN
 * reminder window, not inside a blanket thirty days. Without this, a birthday
 * eight months out and a filing due next week both count as "upcoming", and the
 * daily email becomes a list nobody reads.
 */
export function isDue(
  note: { event_date: string | null; remind_before_days: number | null },
  now: Date = new Date()
): boolean {
  if (!note.event_date) return false;
  const event = Date.parse(`${note.event_date}T00:00:00Z`);
  if (Number.isNaN(event)) return false;

  const days = Math.ceil((event - now.getTime()) / 86_400_000);
  if (days < 0) return true; // overdue stays visible

  // Default of 14 days for notes captured before lead times existed.
  const lead = note.remind_before_days ?? 14;
  return days <= lead;
}
