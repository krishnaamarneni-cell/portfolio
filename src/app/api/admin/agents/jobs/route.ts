import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  searchProviderHelp,
  type SearchResult,
} from "@/lib/search";
import { buildFactsContext } from "@/lib/facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Profile = "software" | "sap" | "both";

type Body = {
  model?: string;
  companies?: string[];
  /** Optional override of the user's "what role I want next" line. */
  targetRole?: string;
  /** Background filter — what kinds of jobs to look for. */
  profile?: Profile;
  /** Location filter, e.g. "Remote", "New Jersey", "Chicago, IL". */
  location?: string;
  remoteOk?: boolean;
};

/** Keyword bags that drive the per-company web search. */
const PROFILE_KEYWORDS: Record<Profile, string[]> = {
  software: [
    "software engineer",
    "AI engineer",
    "full-stack engineer",
    "senior engineer",
    "solutions architect AI",
  ],
  sap: [
    "SAP consultant",
    "SAP S/4HANA",
    "SAP analyst",
    "SAP master data",
    "SAP MM SD",
  ],
  both: [
    "SAP consultant",
    "SAP S/4HANA",
    "software engineer",
    "AI engineer",
    "solutions architect",
  ],
};

/** When the user doesn't pick specific companies, we run a broad market
 *  scan with a curated set of role-shaped queries per profile. These are
 *  designed to land on actual job boards (LinkedIn, Indeed, Dice, etc.)
 *  rather than company landing pages. */
const BROAD_MARKET_QUERIES: Record<Profile, string[]> = {
  sap: [
    "SAP S/4HANA consultant job opening linkedin",
    "SAP Ariba implementation analyst indeed job",
    "SAP MM SD remote job dice careers",
    "SAP procure-to-pay lead hiring glassdoor",
    "SAP functional consultant master data job linkedin",
  ],
  software: [
    "senior AI engineer remote job opening linkedin",
    "full-stack engineer next.js typescript job indeed",
    "AI agent developer hiring linkedin careers",
    "solutions architect AI platform job glassdoor",
    "senior software engineer LLM job dice careers",
  ],
  both: [
    "SAP S/4HANA consultant job opening linkedin",
    "SAP Ariba functional analyst remote indeed job",
    "senior AI engineer hiring linkedin careers",
    "full-stack engineer LLM typescript job indeed",
    "solutions architect SAP AI job glassdoor",
  ],
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set" },
      { status: 503 }
    );
  }
  if (!whichSearchProvider()) {
    return NextResponse.json(
      { error: searchProviderHelp() },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  const companies = (body.companies ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 12);
  const profile: Profile = body.profile ?? "both";
  const location = (body.location ?? "").trim();
  const keywords = PROFILE_KEYWORDS[profile];

  // ── Pull the user's FULL resume from the Jobs table + skills + facts ──
  // Previously we only fed 6 jobs and dropped highlights. Now the agent sees
  // every role with full description + highlights, so its "match to Krishna's
  // experience" line actually reflects what's in the database.
  const [jobs, site] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
  ]);
  const experience = jobs
    .map((j) => {
      const head = `- **${j.title}** @ ${j.company} (${j.period}, ${j.location})`;
      const desc = j.description ? `\n  ${j.description}` : "";
      const highlights = j.highlights?.length
        ? "\n  Highlights:\n" + j.highlights.map((h) => `    • ${h}`).join("\n")
        : "";
      const tags = j.tags?.length ? `\n  Tags: ${j.tags.join(", ")}` : "";
      return head + desc + highlights + tags;
    })
    .join("\n\n");
  const skills = (site.skills?.skills ?? []).slice(0, 40);

  // ── Build the search queries ──
  // If user picked companies → per-company search (existing behaviour).
  // If they didn't → broad market scan using role-shaped keyword queries
  //   so the scout works "even with no specific companies selected".
  const isBroadMarket = companies.length === 0;
  const queries: string[] = isBroadMarket
    ? BROAD_MARKET_QUERIES[profile].map(
        (q) => `${q}${location ? ` ${location}` : ""}`
      )
    : companies.map((c) => {
        const kw = keywords.slice(0, 2).join(" OR ");
        const locClause = location ? ` ${location}` : "";
        return `${c} careers job opening (${kw})${locClause} linkedin indeed`;
      });

  // Fire all searches in parallel.
  let searchResults: SearchResult[] = [];
  try {
    searchResults = await Promise.all(
      queries.map((q) =>
        search({ query: q, maxResults: 6 }).catch(
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 }
    );
  }
  // Drop hits with empty URLs from the LLM context.
  searchResults = searchResults.map((r) => ({
    ...r,
    hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
  }));

  const totalHits = searchResults.reduce((n, r) => n + r.hits.length, 0);
  if (totalHits === 0) {
    return NextResponse.json({
      markdown:
        "## No matches\n\nThe web-search provider returned 0 results. Try a different profile, remove the location filter, or set TAVILY_API_KEY / BRAVE_API_KEY in env.",
      context: { companies, profile, location, hitsByCompany: {}, model: body.model },
    });
  }

  const targetRole =
    body.targetRole ||
    "Senior IC roles where I can ship AI + enterprise data products.";

  const profileBlurb =
    profile === "software"
      ? "Krishna is biasing toward SOFTWARE / AI engineering roles."
      : profile === "sap"
      ? "Krishna is biasing toward SAP / enterprise-data roles."
      : "Krishna is open to BOTH SAP and software / AI engineering roles.";

  const searchBlock = searchResultsToContext(searchResults);

  const factsBlock = await buildFactsContext();
  const system = `You are Krishna's job scout. Phone-screen format.
${factsBlock ? `\n${factsBlock}\n` : ""}
RULES:
- ONLY output jobs with a real URL from search results below.
- ONLY use job titles from the snippets — NEVER invent a title.
- Skip company homepages, news articles, blogs — only actual job listings.
- If ZERO real postings exist in results, say EXACTLY: "No real job postings found today." and STOP. Do NOT invent "potential" or "hypothetical" roles.

FORBIDDEN — do NOT write any of these:
- "However, based on Krishna's skills..." — BANNED
- "the following are some potential job postings" — BANNED
- "No applicable links available" — BANNED
- Any job without a clickable URL from the search results
- Any line starting with "Unfortunately"

FORMAT — one line per job, copy exactly:

**SAP S/4HANA Consultant** at Deloitte — Remote. Fit: 4yr S/4HANA + Ariba. [Apply](url)
**Senior AI Engineer** at Stripe — SF. Fit: LLM + Next.js stack. [Apply](url)

That's it. Title + company + location + fit clause + link. ONE line. Max 8.`;

  const modeBlurb = isBroadMarket
    ? "MODE: Broad market scan. Only output postings with actual URLs from the search results. If nothing is a real job posting, say so."
    : `MODE: Per-company scan. Companies (in this order): ${companies.join(", ")}.`;

  const userPrompt = `${profileBlurb}
${modeBlurb}
Target role: ${targetRole}
${location ? `Location filter: ${location}` : "Location filter: none (remote or anywhere)"}
${body.remoteOk === false ? "On-site/hybrid only." : ""}

═══════════════════════ KRISHNA'S RESUME ═══════════════════════
${experience || "(no jobs on file — use facts above for context)"}

Skills bag: ${skills.join(", ") || "(none on file)"}
═══════════════════════════════════════════════════════════════

Web-search results from job boards:
${searchBlock}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    // For the summarisation step we don't need compound's web search — we
    // already did the search. Force a deterministic non-compound model so the
    // user pays less and there's no "empty response" path.
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 1400,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const hitsByQuery: Record<string, number> = {};
  queries.forEach((q, i) => {
    hitsByQuery[q] = searchResults[i]?.hits.length ?? 0;
  });

  return NextResponse.json({
    markdown: result.content,
    context: {
      mode: isBroadMarket ? "broad-market" : "per-company",
      companies,
      profile,
      location: location || null,
      resumeJobs: jobs.length,
      hitsByQuery,
      model: result.modelUsed ?? model,
      modelRequested: model,
      provider: whichSearchProvider(),
    },
  });
}
