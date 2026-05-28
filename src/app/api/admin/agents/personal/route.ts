import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  bucketFor,
  daysUntil,
  listNotes,
  type PersonalNote,
  type Urgency,
} from "@/lib/personal";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  type SearchResult,
} from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { model?: string };

/**
 * The Life agent goes deeper than just summarising your notepad. It:
 *  - Buckets every note by urgency.
 *  - For tagged categories (visa, travel, housing, finance, health) it runs
 *    a targeted live web search — current USCIS rules, flight-fare windows,
 *    moving checklists, tax deadlines — so the digest cites real sources.
 *  - Surfaces "blind spots": adjacent tasks the user probably forgot
 *    (e.g. "you mentioned an H1B expiry but no I-765 status").
 *  - Writes the digest as a one-screen Markdown brief with three lanes:
 *    🚨 Now · 📅 Soon · 🤔 Things to consider.
 */

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not set" }, { status: 503 });
  }
  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  let notes: PersonalNote[] = [];
  try {
    notes = await listNotes();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load notes" },
      { status: 500 }
    );
  }
  if (notes.length === 0) {
    return NextResponse.json({
      markdown:
        "## Nothing on file yet\n\nAdd a note above — the agent reads everything you save here, parses the dates, and surfaces what needs attention. Try things like:\n\n- _My H1B STEM OPT expires May 5_\n- _Need to check flights JFK → HYD for June 2027_\n- _Moving to Tampa on July 30 — find apartments_\n- _Wife's birthday is April 12_\n",
      context: {},
    });
  }

  // Bucket notes by urgency for the prompt.
  const now = new Date();
  const buckets: Record<Urgency, PersonalNote[]> = {
    overdue: [],
    urgent: [],
    soon: [],
    later: [],
    "no-date": [],
  };
  for (const n of notes) buckets[bucketFor(n, now)].push(n);

  // Decide what to search the open web for. Cap at 5 queries so we don't
  // burn the Tavily free tier.
  const queries = buildSearchQueries(notes, now);

  let searchResults: SearchResult[] = [];
  if (queries.length > 0 && whichSearchProvider()) {
    searchResults = await Promise.all(
      queries.map((q) =>
        search({ query: q, maxResults: 4 }).catch(
          (err): SearchResult => ({
            query: q,
            hits: [
              {
                title: "Search failed",
                url: "",
                snippet: err instanceof Error ? err.message : String(err),
              },
            ],
          })
        )
      )
    );
    searchResults = searchResults.map((r) => ({
      ...r,
      hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
    }));
  }

  const notesBlock = formatNotesForPrompt(notes, now);
  const searchBlock =
    searchResults.length > 0
      ? `\n\nLive web-search results (use ONLY these URLs when citing sources):\n${searchResultsToContext(searchResults)}`
      : "";

  const system = `You are Krishna's personal life agent. He's a builder in NJ on H1B STEM OPT, planning a possible move to Tampa, with international travel coming up. He saves short notes in a notepad; you read them and tell him what matters.

Your job: write a tight, one-screen Markdown digest that does FOUR things:

## 🚨 Now (next 14 days)
Things with event dates inside 14 days OR overdue. Each bullet: bold the noun, one-line of what to do *today*, link a source if useful.

## 📅 Soon (15–60 days)
Same shape. Lead with "in X days" so he sees the runway.

## 🤔 Things to consider
This is the value-add. Look at his notes + their tags and surface ADJACENT items he probably forgot:
- H1B/OPT expiry without an H1B cap registration or I-765 status mentioned → flag it
- International flight to/from US on OPT without H1B approval → mention the 60-day grace and re-entry risk
- Moving cities without 60-day landlord notice mention → flag it
- Tampa move with no apartment search underway → flag it
- Foreign-exchange / wire-transfer needs around international travel → flag if relevant
- Tax deadlines if his year-end approaches and "tax" is missing
Each bullet: one short reasoning sentence, then "Consider: <one specific action>".

## 📰 Worth knowing
Pull out 2–4 relevant headlines from the search results — visa policy shifts, housing market in Tampa, flight-fare windows for HYD-JFK, etc. Each bullet ends with [Source](url) using ONLY the real URLs above.

HARD RULES:
- Never invent a URL. Only use URLs that appear literally in the search-results block.
- Never invent a fact about Krishna's life that isn't in the notes.
- Keep the whole thing under ~600 words. He'll scan, not read.
- No emojis except the four section icons. No filler ("hope this helps").`;

  const userPrompt = `Today: ${now.toISOString().slice(0, 10)}.
He lives in NJ. He's planning a Tampa move (per his notes). He may have international travel coming up.

His notepad (newest dates first within each urgency bucket):
${notesBlock}${searchBlock}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2500,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    markdown: result.content,
    context: {
      noteCount: notes.length,
      urgentCount: buckets.urgent.length + buckets.overdue.length,
      provider: whichSearchProvider(),
      model: result.modelUsed ?? model,
      modelRequested: model,
      queries,
    },
  });
}

function formatNotesForPrompt(notes: PersonalNote[], now: Date): string {
  const lines: string[] = [];
  for (const n of notes) {
    const days = daysUntil(n, now);
    const dateStr = n.event_date
      ? `[${n.event_date}${days !== null ? `, ${days >= 0 ? `in ${days}d` : `${-days}d ago`}` : ""}]`
      : "[no date]";
    const tagStr = n.tags.length ? ` (${n.tags.join(", ")})` : "";
    const pin = n.pinned ? "📌 " : "";
    lines.push(`- ${pin}${dateStr}${tagStr} ${n.body.replace(/\s+/g, " ").trim()}`);
  }
  return lines.join("\n");
}

/** Decide what to actually search for. Targeted, not generic. */
function buildSearchQueries(notes: PersonalNote[], now: Date): string[] {
  const queries: string[] = [];
  const tagSet = new Set<string>(notes.flatMap((n) => n.tags));
  const upcomingByTag = new Map<string, PersonalNote[]>();
  for (const n of notes) {
    if (!n.event_date) continue;
    const d = daysUntil(n, now) ?? 9999;
    if (d < -7 || d > 365) continue;
    for (const t of n.tags) {
      if (!upcomingByTag.has(t)) upcomingByTag.set(t, []);
      upcomingByTag.get(t)!.push(n);
    }
  }

  // Visa
  if (tagSet.has("visa")) {
    queries.push("H1B STEM OPT extension USCIS 2025 latest policy");
  }
  // Travel — pull cities/airport codes from notes if present.
  if (tagSet.has("travel")) {
    const travelNote = notes.find((n) => n.tags.includes("travel"));
    if (travelNote) {
      // Try to capture an origin/destination phrase.
      const route = /([A-Z]{3})\s*(?:to|→|-)\s*([A-Z]{3})/i.exec(travelNote.body);
      if (route) {
        queries.push(`cheapest flights ${route[1]} to ${route[2]} when to book`);
      } else {
        queries.push("international flight booking window best time 2025");
      }
    }
  }
  // Housing / move
  if (tagSet.has("housing") || tagSet.has("move")) {
    const moveNote = notes.find(
      (n) => n.tags.includes("housing") || n.tags.includes("move")
    );
    const city =
      moveNote && /tampa|austin|miami|orlando|seattle|nyc|nj|texas|florida/i.exec(moveNote.body);
    if (city) {
      queries.push(`apartment rental market ${city[0]} 2025 average rent`);
    } else {
      queries.push("US apartment rental market trends 2025");
    }
  }
  // Tax
  if (tagSet.has("tax")) {
    queries.push("US federal tax filing deadlines 2026 1040 extensions");
  }
  // Finance
  if (tagSet.has("finance")) {
    queries.push("US savings account interest rates 2025");
  }
  // Cap at 5 to respect free-tier search quotas.
  return queries.slice(0, 5);
}
