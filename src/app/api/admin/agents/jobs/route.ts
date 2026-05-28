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

const DEFAULT_COMPANIES = [
  "PepsiCo",
  "Walmart",
  "Anthropic",
  "OpenAI",
  "Stripe",
  "Databricks",
];

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

  const companies =
    body.companies && body.companies.length > 0
      ? body.companies.slice(0, 12)
      : DEFAULT_COMPANIES;
  const profile: Profile = body.profile ?? "both";
  const location = (body.location ?? "").trim();
  const keywords = PROFILE_KEYWORDS[profile];

  const [jobs, site] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
  ]);
  const experience = jobs
    .slice(0, 6)
    .map(
      (j) =>
        `- ${j.title} @ ${j.company} (${j.period}): ${j.description}${j.highlights?.length ? " · " + j.highlights.join("; ") : ""}`
    )
    .join("\n");
  const skills = (site.skills?.skills ?? []).slice(0, 40);

  // Build one search query per company. Use a tight keyword + careers hint so
  // the search engine lands on actual postings, not company landing pages.
  const queries: string[] = companies.map((c) => {
    const kw = keywords.slice(0, 2).join(" OR ");
    const locClause = location ? ` ${location}` : "";
    return `${c} careers (${kw})${locClause} 2024 2025`;
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
        "## No matches\n\nThe web-search provider returned 0 results across all target companies. Try broadening the keyword profile or removing the location filter.",
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
  const system = `You are Krishna Amarneni's job-hunting agent. You are given a block of REAL web-search results below — actual URLs and snippets from public job boards and company career sites. Your only job is to:
${factsBlock ? `\n${factsBlock}\n` : ""}

1. Read the snippets.
2. Pick the entries that are clearly job postings (titles like "Senior Engineer", "SAP Analyst", an Apply CTA, etc.) — IGNORE company homepages, news articles, blog posts.
3. Match them to Krishna's background.
4. Output a Markdown brief.

HARD RULES — break any of these and the result is unusable:
- NEVER invent a URL. Only use URLs that appear literally in the search results below.
- NEVER invent a job title. Only use titles from the snippets.
- If a company has zero real postings in the search results, say exactly: \`No matching open roles in today's results.\` under its H2.
- Do not paste fake "posted X days ago" — only use dates if they're in the snippet text.

Output format:
\`\`\`
## <Company>
- **<Exact job title from snippet>** — <location or 'Remote' if in snippet> · <one short skill phrase>
  <one sentence on why it fits Krishna's experience>
  [Apply](<exact URL from search results>)
\`\`\`

Order companies as they were given. No filler. No emojis.`;

  const userPrompt = `${profileBlurb}
Target role: ${targetRole}
${location ? `Location filter: ${location}` : "Location filter: none (remote or anywhere)"}
${body.remoteOk === false ? "On-site/hybrid only." : ""}

Krishna's experience:
${experience || "(none on file)"}

Krishna's skills: ${skills.join(", ") || "(none on file)"}

Web-search results:
${searchBlock}

Companies to cover (in this order): ${companies.join(", ")}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    // For the summarisation step we don't need compound's web search — we
    // already did the search. Force a deterministic non-compound model so the
    // user pays less and there's no "empty response" path.
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 3000,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const hitsByCompany: Record<string, number> = {};
  companies.forEach((c, i) => {
    hitsByCompany[c] = searchResults[i]?.hits.length ?? 0;
  });

  return NextResponse.json({
    markdown: result.content,
    context: {
      companies,
      profile,
      location: location || null,
      hitsByCompany,
      model: result.modelUsed ?? model,
      modelRequested: model,
      provider: whichSearchProvider(),
    },
  });
}
