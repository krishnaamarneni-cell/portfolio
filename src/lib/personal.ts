import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type PersonalNote = {
  id: string;
  body: string;
  tags: string[];
  event_date: string | null; // YYYY-MM-DD
  remind_before_days: number | null;
  pinned: boolean;
  archived: boolean;
  source: "manual" | "agent" | "import";
  created_at: string;
  updated_at: string;
};

export type PersonalNoteInput = Partial<
  Omit<PersonalNote, "id" | "created_at" | "updated_at">
> & {
  body: string;
};

/* ─────────────────── Heuristic date + tag extraction ─────────────────── */

const MONTH_RX =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function toMonthIndex(s: string): number {
  return MONTHS[s.slice(0, 3).toLowerCase()] ?? 0;
}

/** Best-effort regex date extraction so we don't burn a Groq call on every save.
 *  Recognises: "May 5", "May 5th", "may 5 2026", "5 may 2026", "2026-05-05",
 *  "May 2027" (defaults to day 1). Returns YYYY-MM-DD or null. */
export function extractFirstDate(text: string): string | null {
  const now = new Date();
  // ISO yyyy-mm-dd
  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  if (iso) {
    const y = +iso[1];
    const m = +iso[2];
    const d = +iso[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  // "may 5", "may 5th", "may 05 th"
  const md = new RegExp(`\\b${MONTH_RX}\\s+(\\d{1,2})(?:\\s*(?:st|nd|rd|th))?\\b(?:[\\s,]+(20\\d{2}))?`, "i").exec(text);
  if (md) {
    const month = toMonthIndex(md[1]);
    const day = +md[2];
    const year = md[3] ? +md[3] : pickReasonableYear(month, day, now);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  // "5 may 2026"
  const dm = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RX}(?:[\\s,]+(20\\d{2}))?\\b`, "i").exec(text);
  if (dm) {
    const day = +dm[1];
    const month = toMonthIndex(dm[2]);
    const year = dm[3] ? +dm[3] : pickReasonableYear(month, day, now);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  // "Jun2027" / "June 2027"
  const my = new RegExp(`\\b${MONTH_RX}\\s*(20\\d{2})\\b`, "i").exec(text);
  if (my) {
    const month = toMonthIndex(my[1]);
    const year = +my[2];
    if (month) return `${year}-${String(month).padStart(2, "0")}-01`;
  }
  return null;
}

/** If the user didn't give a year, pick the next future occurrence of that day/month. */
function pickReasonableYear(month: number, day: number, ref: Date): number {
  const thisYear = ref.getFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  return candidate.getTime() < ref.getTime() - 7 * 86_400_000 ? thisYear + 1 : thisYear;
}

const TAG_PATTERNS: Array<{ rx: RegExp; tags: string[] }> = [
  { rx: /h-?1\s*b|opt|stem|uscis|i-?129|i-?765|visa|green\s*card|gc|ead/i, tags: ["visa"] },
  { rx: /flight|airline|jfk|hyd|hyderabad|airport|booking|ticket|layover/i, tags: ["travel"] },
  { rx: /apartment|lease|rent|move|tampa|relocat|landlord|deposit/i, tags: ["housing", "move"] },
  { rx: /tax|w-?2|1099|irs|filing/i, tags: ["tax"] },
  { rx: /doctor|appointment|dentist|insurance|prescription|health/i, tags: ["health"] },
  { rx: /interview|recruiter|application|salary|negotiat/i, tags: ["career"] },
  { rx: /car|insurance|registration|dmv|inspection/i, tags: ["car"] },
  { rx: /birthday|anniversary|gift|family|wife|mom|dad/i, tags: ["family"] },
  { rx: /credit|loan|emi|payment|bill|due/i, tags: ["finance"] },
];

export function extractTags(text: string): string[] {
  const found = new Set<string>();
  for (const { rx, tags } of TAG_PATTERNS) {
    if (rx.test(text)) tags.forEach((t) => found.add(t));
  }
  return Array.from(found);
}

/* ───────────────────────────── CRUD ───────────────────────────── */

export async function listNotes(opts: {
  includeArchived?: boolean;
} = {}): Promise<PersonalNote[]> {
  const supabase = requireSupabaseAdmin();
  let q = supabase.from("personal_notes").select("*");
  if (!opts.includeArchived) q = q.eq("archived", false);
  const { data, error } = await q
    .order("pinned", { ascending: false })
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonalNote[];
}

export async function createNote(input: PersonalNoteInput): Promise<PersonalNote> {
  const supabase = requireSupabaseAdmin();
  const inferredDate = input.event_date ?? extractFirstDate(input.body);
  const tagSet = new Set<string>(input.tags ?? []);
  for (const t of extractTags(input.body)) tagSet.add(t);
  const row = {
    body: input.body,
    tags: Array.from(tagSet),
    event_date: inferredDate,
    remind_before_days: input.remind_before_days ?? null,
    pinned: input.pinned ?? false,
    archived: input.archived ?? false,
    source: input.source ?? "manual",
  };
  const { data, error } = await supabase
    .from("personal_notes")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PersonalNote;
}

export async function updateNote(
  id: string,
  patch: Partial<PersonalNoteInput>
): Promise<PersonalNote> {
  const supabase = requireSupabaseAdmin();
  const update: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  // If body changed and the caller didn't explicitly set tags/event_date, re-infer.
  if (typeof patch.body === "string") {
    if (!("event_date" in patch)) {
      update.event_date = extractFirstDate(patch.body);
    }
    if (!("tags" in patch)) {
      update.tags = extractTags(patch.body);
    }
  }
  const { data, error } = await supabase
    .from("personal_notes")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PersonalNote;
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("personal_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ───────────────────────── Urgency bucketing ───────────────────────── */

export type Urgency = "overdue" | "urgent" | "soon" | "later" | "no-date";

export function bucketFor(note: PersonalNote, now: Date = new Date()): Urgency {
  if (!note.event_date) return "no-date";
  const d = new Date(note.event_date + "T00:00:00Z");
  const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 14) return "urgent";
  if (days <= 60) return "soon";
  return "later";
}

export function daysUntil(note: PersonalNote, now: Date = new Date()): number | null {
  if (!note.event_date) return null;
  const d = new Date(note.event_date + "T00:00:00Z");
  return Math.floor((d.getTime() - now.getTime()) / 86_400_000);
}
