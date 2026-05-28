import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";
import {
  bucketFor,
  daysUntil,
  listNotes,
  type PersonalNote,
} from "@/lib/personal";
import { fetchHoldingSymbols, runAgent } from "@/lib/agents";
import { search, searchResultsToContext, whichSearchProvider } from "@/lib/search";
import { sendEmail } from "@/lib/gmail";
import { buildFactsContext } from "@/lib/facts";
import { habitsWithStreaks } from "@/lib/habits";

export type AdminSettings = {
  id: string;
  morning_briefing_enabled: boolean;
  morning_briefing_to: string | null;
  morning_briefing_last_run_at: string | null;
  morning_briefing_last_status: string | null;
  morning_briefing_last_subject: string | null;
  sunday_reflection_enabled: boolean;
  sunday_reflection_to: string | null;
  sunday_reflection_last_run_at: string | null;
  sunday_reflection_last_status: string | null;
  sunday_reflection_last_subject: string | null;
  updated_at: string;
};

export async function getSettings(): Promise<AdminSettings> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from("admin_settings")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  if (data) return data as AdminSettings;
  // Lazy-create the row so the UI works on first open.
  const fresh: Partial<AdminSettings> = {
    id: "singleton",
    morning_briefing_enabled: false,
  };
  await supabase.from("admin_settings").upsert(fresh);
  return {
    id: "singleton",
    morning_briefing_enabled: false,
    morning_briefing_to: null,
    morning_briefing_last_run_at: null,
    morning_briefing_last_status: null,
    morning_briefing_last_subject: null,
    sunday_reflection_enabled: false,
    sunday_reflection_to: null,
    sunday_reflection_last_run_at: null,
    sunday_reflection_last_status: null,
    sunday_reflection_last_subject: null,
    updated_at: new Date().toISOString(),
  };
}

export async function updateSettings(
  patch: Partial<AdminSettings>
): Promise<AdminSettings> {
  const supabase = requireSupabaseAdmin();
  const row = {
    ...patch,
    id: "singleton",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("admin_settings")
    .upsert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AdminSettings;
}

/* ─────────────── Build the briefing content ─────────────── */

export type BriefingPayload = {
  subject: string;
  html: string;
  text: string;
  lifeMarkdown: string;
  newsMarkdown: string;
  stats: {
    noteCount: number;
    overdue: number;
    urgent: number;
  };
};

const GROQ_MODEL_FOR_BRIEFING = "llama-3.3-70b-versatile";

/** Run Life + News agents and assemble one HTML email. */
export async function buildBriefing(): Promise<BriefingPayload> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const now = new Date();
  const notes = await listNotes().catch<PersonalNote[]>(() => []);
  const stats = computeStats(notes, now);

  // ─── Life agent (notes-aware) ───
  const lifeMarkdown = await runLifeAgent(apiKey, notes, now);

  // ─── News scout ───
  const newsMarkdown = await runNewsAgent(apiKey).catch(
    (err) => `## 📰 News unavailable\n\n${err instanceof Error ? err.message : String(err)}`
  );

  const subject = `Morning Briefing — ${now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}${stats.overdue > 0 ? ` · ${stats.overdue} overdue` : stats.urgent > 0 ? ` · ${stats.urgent} urgent` : ""}`;

  const html = renderHtml({
    subject,
    lifeMarkdown,
    newsMarkdown,
    stats,
    now,
  });
  const text = `${subject}\n\n${stripMarkdown(lifeMarkdown)}\n\n${stripMarkdown(newsMarkdown)}`;
  return { subject, html, text, lifeMarkdown, newsMarkdown, stats };
}

function computeStats(notes: PersonalNote[], now: Date) {
  let overdue = 0;
  let urgent = 0;
  for (const n of notes) {
    const b = bucketFor(n, now);
    if (b === "overdue") overdue++;
    if (b === "urgent") urgent++;
  }
  return { noteCount: notes.length, overdue, urgent };
}

async function runLifeAgent(
  apiKey: string,
  notes: PersonalNote[],
  now: Date
): Promise<string> {
  if (notes.length === 0) {
    return "## 📝 Life\n\nNo notes on file. Add things in the Life tab so I can track them for you.";
  }
  // Reuse the same approach as /api/admin/agents/personal but inline so the
  // cron doesn't have to make an internal HTTP call.
  const tagSet = new Set<string>(notes.flatMap((n) => n.tags));
  const queries: string[] = [];
  if (tagSet.has("visa")) queries.push("H1B STEM OPT extension USCIS 2025 latest policy");
  if (tagSet.has("travel")) queries.push("international flight booking window 2025");
  if (tagSet.has("housing") || tagSet.has("move")) queries.push("apartment rental market Tampa 2025 average rent");
  if (tagSet.has("tax")) queries.push("US federal tax filing deadlines 2026");
  const searchBlock = await safeSearchBlock(queries.slice(0, 3));

  const notesBlock = notes
    .map((n) => {
      const d = daysUntil(n, now);
      const date = n.event_date
        ? `[${n.event_date}${d !== null ? `, ${d >= 0 ? `in ${d}d` : `${-d}d ago`}` : ""}]`
        : "[no date]";
      const tagStr = n.tags.length ? ` (${n.tags.join(", ")})` : "";
      const pin = n.pinned ? "📌 " : "";
      return `- ${pin}${date}${tagStr} ${n.body.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n");

  const factsBlock = await buildFactsContext();
  const system = `You are Krishna's life agent writing his morning briefing email. Keep it tight — he'll read it on a phone before coffee.
${factsBlock ? `\n${factsBlock}\n` : ""}

Write three sections in Markdown:

## 🚨 Now
Items overdue or within 14 days. Bold the noun, one short action line.

## 📅 Soon
Items 15–60 days out. Lead with "in Xd".

## 🤔 Don't forget
Adjacent things he probably hasn't noted. Examples:
- H1B/OPT expiry without I-129 / I-765 progress mentioned → flag it
- Move planned without 60-day landlord notice mentioned → flag it
- Tampa move without apartment search underway → flag it
- International travel on OPT → mention re-entry risk

HARD RULES: no invented URLs (only the ones in search results below), no invented facts about Krishna, no emojis except the three section icons. Under 400 words.`;

  const userPrompt = `Today: ${now.toISOString().slice(0, 10)}.

His notepad:
${notesBlock}

${searchBlock ? `Live web-search results (use ONLY these URLs):\n${searchBlock}` : ""}`;

  const result = await runAgent({
    apiKey,
    model: GROQ_MODEL_FOR_BRIEFING,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2000,
  });
  return result.content || "## 📝 Life\n\n(agent returned nothing)";
}

async function runNewsAgent(apiKey: string): Promise<string> {
  const { symbols } = await fetchHoldingSymbols();
  const tickersClause = symbols.length
    ? symbols.slice(0, 8).join(" OR ")
    : "S&P 500";
  const queries = [
    `${tickersClause} stock news today`,
    "new AI tools models released this week",
  ];
  const searchBlock = await safeSearchBlock(queries);
  if (!searchBlock) {
    return "## 📰 Markets & AI\n\n(no search provider configured — set TAVILY_API_KEY or BRAVE_API_KEY)";
  }

  const system = `You are Krishna's news scout. Summarise the search results into a tight market + AI briefing for his morning email.

Format:

## 📈 Markets
- **<Ticker / company>** — one-line takeaway. [Source](url)
(3–5 bullets, prioritise his tickers)

## 🤖 AI
- **<Tool / model>** — what shipped + why he should care. [Source](url)
(2–4 bullets)

HARD RULES: only URLs that appear literally in the search results below. No invented facts. No emojis beyond the two section icons. Under 300 words.`;

  const userPrompt = `Krishna's tickers: ${symbols.join(", ") || "(unknown)"}.

Search results:
${searchBlock}`;

  const result = await runAgent({
    apiKey,
    model: GROQ_MODEL_FOR_BRIEFING,
    systemPrompt: system,
    userPrompt,
    maxTokens: 1800,
  });
  return result.content || "## 📰 News unavailable\n\n(empty model response)";
}

async function safeSearchBlock(queries: string[]): Promise<string> {
  if (queries.length === 0 || !whichSearchProvider()) return "";
  const results = await Promise.all(
    queries.map((q) =>
      search({ query: q, maxResults: 4 }).catch(() => ({ query: q, hits: [] }))
    )
  );
  return searchResultsToContext(
    results.map((r) => ({
      ...r,
      hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
    }))
  );
}

/* ─────────────── HTML rendering ─────────────── */

function renderHtml(opts: {
  subject: string;
  lifeMarkdown: string;
  newsMarkdown: string;
  stats: { noteCount: number; overdue: number; urgent: number };
  now: Date;
}): string {
  const lifeHtml = markdownToHtml(opts.lifeMarkdown);
  const newsHtml = markdownToHtml(opts.newsMarkdown);
  const dateLine = opts.now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  // Inline styles only — most email clients strip <style>.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
      <tr><td style="background:linear-gradient(135deg,#ff6b00,#ff8c38);padding:24px 28px;color:#0a0a0a">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7">${dateLine}</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px">Morning briefing</div>
      </td></tr>
      <tr><td style="padding:20px 28px;border-bottom:1px solid #f1f2f5">
        ${statCells(opts.stats)}
      </td></tr>
      <tr><td style="padding:24px 28px;font-size:15px;line-height:1.6">
        ${lifeHtml}
      </td></tr>
      <tr><td style="padding:0 28px"><hr style="border:none;border-top:1px solid #f1f2f5;margin:8px 0"></td></tr>
      <tr><td style="padding:24px 28px;font-size:15px;line-height:1.6">
        ${newsHtml}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#fafbfc;font-size:12px;color:#6b7280">
        Run from your portfolio admin · <a href="https://krishnaamarneni.com/admin?tab=personal" style="color:#ff6b00">Open Life Cockpit</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function statCells(s: { noteCount: number; overdue: number; urgent: number }): string {
  const cell = (label: string, value: number, color: string) =>
    `<td align="center" style="padding:6px 8px"><div style="font-size:22px;font-weight:800;color:${color}">${value}</div><div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;margin-top:2px">${label}</div></td>`;
  return `<table role="presentation" width="100%"><tr>${cell("Notes", s.noteCount, "#374151")}${cell("Overdue", s.overdue, s.overdue > 0 ? "#dc2626" : "#9ca3af")}${cell("Urgent ≤14d", s.urgent, s.urgent > 0 ? "#ea580c" : "#9ca3af")}</tr></table>`;
}

/** Very small Markdown → HTML — headings, bullets, **bold**, [link](url). */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const flushList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul style="padding-left:20px;margin:6px 0">';
        inList = true;
      }
      html += `<li style="margin:6px 0">${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
      continue;
    }
    flushList();
    if (/^##\s+/.test(line)) {
      html += `<h2 style="font-size:16px;font-weight:700;color:#111827;margin:20px 0 8px;border-top:1px solid #f1f2f5;padding-top:16px">${inline(line.replace(/^##\s+/, ""))}</h2>`;
    } else if (/^###\s+/.test(line)) {
      html += `<h3 style="font-size:14px;font-weight:600;color:#111827;margin:12px 0 6px">${inline(line.replace(/^###\s+/, ""))}</h3>`;
    } else if (line.trim() === "") {
      // skip blanks
    } else {
      html += `<p style="margin:8px 0">${inline(line)}</p>`;
    }
  }
  flushList();
  return html;
}

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#111827">$1</strong>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:#ff6b00;text-decoration:none">$1</a>'
    );
}

function stripMarkdown(md: string): string {
  return md
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^##\s*/gm, "")
    .replace(/^###\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

/* ─────────────── Send + record ─────────────── */

export async function sendBriefingNow(): Promise<{
  ok: boolean;
  status: string;
  subject?: string;
}> {
  const settings = await getSettings();
  const to = settings.morning_briefing_to;
  if (!to) {
    const status = "no recipient configured";
    await updateSettings({
      morning_briefing_last_run_at: new Date().toISOString(),
      morning_briefing_last_status: status,
    });
    return { ok: false, status };
  }
  try {
    const briefing = await buildBriefing();
    const send = await sendEmail({
      to,
      subject: briefing.subject,
      html: briefing.html,
      text: briefing.text,
    });
    const status = send.ok ? "sent" : `send failed: ${send.error ?? "unknown"}`;
    await updateSettings({
      morning_briefing_last_run_at: new Date().toISOString(),
      morning_briefing_last_status: status,
      morning_briefing_last_subject: briefing.subject,
    });
    return { ok: send.ok, status, subject: briefing.subject };
  } catch (err) {
    const status = `build failed: ${err instanceof Error ? err.message : String(err)}`;
    await updateSettings({
      morning_briefing_last_run_at: new Date().toISOString(),
      morning_briefing_last_status: status,
    });
    return { ok: false, status };
  }
}

/* ─────────────── Sunday Reflection ─────────────── */

export type ReflectionPayload = {
  subject: string;
  html: string;
  text: string;
  markdown: string;
};

const REFLECTION_MODEL = "llama-3.3-70b-versatile";

/** Build the Sunday Reflection — a weekly recap covering habits, notes,
 *  what changed this week, and what's coming. */
export async function buildReflection(): Promise<ReflectionPayload> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const weekAgoISO = weekAgo.toISOString().slice(0, 10);

  // Pull state for the prompt.
  const [notes, habits, factsBlock] = await Promise.all([
    listNotes().catch<PersonalNote[]>(() => []),
    habitsWithStreaks().catch(() => []),
    buildFactsContext(),
  ]);

  const recentNotes = notes.filter((n) => n.created_at >= weekAgoISO);
  const upcomingNotes = notes.filter((n) => {
    if (!n.event_date) return false;
    const d = daysUntil(n, now) ?? -999;
    return d >= 0 && d <= 30;
  });

  const habitsBlock = habits
    .map(
      (h) => `- ${h.emoji ?? "•"} ${h.name} — streak: ${h.streak}d, ${countDaysInWeek(h)} of last 7 days`
    )
    .join("\n");

  const recentBlock = recentNotes
    .slice(0, 12)
    .map((n) => `- [${n.created_at.slice(0, 10)}] ${n.body.replace(/\s+/g, " ").trim()}`)
    .join("\n");

  const upcomingBlock = upcomingNotes
    .slice(0, 10)
    .map((n) => {
      const d = daysUntil(n, now);
      return `- ${n.event_date} (in ${d}d): ${n.body.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n");

  const system = `You are Krishna's Sunday Reflection agent. He's just finished a week. You're writing him a short email — Sunday-evening tone, not analytical. Help him close the week and look forward.
${factsBlock ? `\n${factsBlock}\n` : ""}
Write four sections in Markdown:

## ✅ What you did
2–4 bullets pulled from notes added this week + habits actually checked off. Specific. No filler.

## ⚠️ What slipped
Habits with low completion this week, deadlines drifting. Honest, not harsh.

## 📅 Next 7 days
2–4 things from upcoming notes. Lead with "Mon", "Tue", or "in Xd".

## 🎯 One thing to focus on
ONE sentence. The single thing that, if he nails it, makes next week better. Pick the highest-leverage item from what's on his plate.

HARD RULES: no invented facts. Reference only the week's actual notes and habit data below. Under 350 words.`;

  const userPrompt = `Today: ${now.toISOString().slice(0, 10)} (Sunday).
Last 7 days began: ${weekAgoISO}.

Habits + streaks:
${habitsBlock || "(no habits tracked yet)"}

Notes added this past week:
${recentBlock || "(nothing this week)"}

Upcoming next 30 days from notes:
${upcomingBlock || "(nothing scheduled)"}`;

  const result = await runAgent({
    apiKey,
    model: REFLECTION_MODEL,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2000,
  });
  const markdown = result.content || "## Sunday Reflection\n\n(agent returned nothing)";
  const subject = `Sunday Reflection — week ending ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const html = renderHtmlSimple(subject, markdown);
  const text = `${subject}\n\n${stripMarkdown(markdown)}`;
  return { subject, html, text, markdown };
}

function countDaysInWeek(h: { checkins: Record<string, boolean> }): number {
  const now = new Date();
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (h.checkins[key]) count++;
  }
  return count;
}

function renderHtmlSimple(subject: string, md: string): string {
  const inner = markdownToHtml(md);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
      <tr><td style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:24px 28px;color:#fff">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7">Sunday Reflection</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px">${subject}</div>
      </td></tr>
      <tr><td style="padding:24px 28px;font-size:15px;line-height:1.6">
        ${inner}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#fafbfc;font-size:12px;color:#6b7280">
        Krishna's portfolio admin · <a href="https://krishnaamarneni.com/admin?tab=personal" style="color:#7c3aed">Open Life Cockpit</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export async function sendReflectionNow(): Promise<{
  ok: boolean;
  status: string;
  subject?: string;
}> {
  const settings = await getSettings();
  // Reuse the morning_briefing_to address by default; allow override if set.
  const to = settings.sunday_reflection_to || settings.morning_briefing_to;
  if (!to) {
    const status = "no recipient configured";
    await updateSettings({
      sunday_reflection_last_run_at: new Date().toISOString(),
      sunday_reflection_last_status: status,
    });
    return { ok: false, status };
  }
  try {
    const reflection = await buildReflection();
    const send = await sendEmail({
      to,
      subject: reflection.subject,
      html: reflection.html,
      text: reflection.text,
    });
    const status = send.ok ? "sent" : `send failed: ${send.error ?? "unknown"}`;
    await updateSettings({
      sunday_reflection_last_run_at: new Date().toISOString(),
      sunday_reflection_last_status: status,
      sunday_reflection_last_subject: reflection.subject,
    });
    return { ok: send.ok, status, subject: reflection.subject };
  } catch (err) {
    const status = `build failed: ${err instanceof Error ? err.message : String(err)}`;
    await updateSettings({
      sunday_reflection_last_run_at: new Date().toISOString(),
      sunday_reflection_last_status: status,
    });
    return { ok: false, status };
  }
}
