import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import {
  search,
  searchResultsToContext,
  whichSearchProvider,
  type SearchResult,
} from "@/lib/search";
import { buildFactsContext } from "@/lib/facts";
import { fetchJobRss, rssItemsToSearchResult } from "@/lib/rss";
import { fetchJobDivaListings, jobDivaToContext } from "@/lib/jobdiva";
import { fetchWorkdayJobs, type SourcedJob } from "@/lib/job-sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Profile = "software" | "sap" | "both";

type Body = {
  model?: string;
  companies?: string[];
  targetRole?: string;
  profile?: Profile;
  location?: string;
  remoteOk?: boolean;
};

/** Indeed RSS queries per profile — these return actual individual job listings
 *  with apply links, unlike web search which returns index pages. */
const INDEED_QUERIES: Record<Profile, string[]> = {
  sap: [
    "SAP S/4HANA consultant",
    "SAP Ariba analyst",
    "SAP MM SD consultant",
    "SAP functional consultant",
  ],
  software: [
    "senior AI engineer",
    "full stack engineer next.js",
    "AI agent developer",
    "solutions architect AI",
  ],
  both: [
    "SAP S/4HANA consultant",
    "senior AI engineer",
    "full stack engineer",
    "SAP Ariba analyst",
  ],
};

/** Web search queries as BONUS signal — DDG may or may not return usable results. */
const WEB_SEARCH_QUERIES: Record<Profile, string[]> = {
  sap: [
    "SAP S/4HANA consultant job opening 2025",
    "SAP Ariba implementation hiring remote",
  ],
  software: [
    "senior AI engineer remote job opening 2025",
    "full-stack engineer LLM typescript hiring",
  ],
  both: [
    "SAP S/4HANA consultant hiring 2025",
    "senior AI engineer job opening remote",
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

  // ── Pull the user's FULL resume ──
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

  // ── Strategy: Indeed RSS as PRIMARY source ──
  // Indeed provides RSS feeds that return actual individual job listings with
  // real apply URLs. Unlike web search (DDG), these NEVER return index pages
  // or company homepages — every item is a real job posting.
  //
  // If user picked companies → add company name to each query.
  // If broad market → use profile-specific queries.
  const isBroadMarket = companies.length === 0;

  const indeedQueries: string[] = isBroadMarket
    ? INDEED_QUERIES[profile]
    : companies.flatMap((c) =>
        INDEED_QUERIES[profile].slice(0, 2).map((q) => `${q} ${c}`)
      );

  // Fan out: Indeed RSS + web search (bonus) in parallel.
  const webSearchQueries: string[] = isBroadMarket
    ? WEB_SEARCH_QUERIES[profile].map(
        (q) => `${q}${location ? ` ${location}` : ""}`
      )
    : companies.slice(0, 3).map(
        (c) => `${c} careers hiring ${INDEED_QUERIES[profile][0]} ${location || ""}`
      );

  // Fan out: Indeed RSS + JobDiva portal + web search in parallel.
  const jobDivaKeywords = profile === "sap"
    ? ["SAP", "S/4HANA", "Ariba"]
    : profile === "software"
    ? ["software engineer", "AI engineer", "full stack"]
    : ["SAP", "AI engineer", "software"];

  // Live Workday postings are now the primary source: Indeed's public RSS was
  // retired (404s) and the JobDiva API returns 401, so both were yielding
  // nothing / stale fallbacks.
  // NB: read body.targetRole directly — the `targetRole` const is declared
  // further down, so referencing it here would hit the temporal dead zone.
  const workdayKeyword = (
    body.targetRole?.trim() || (profile === "software" ? "software engineer" : "SAP")
  ).trim();

  const [workdayJobs, indeedJobs, jobDivaJobs, ...webResults] = await Promise.all([
    fetchWorkdayJobs({ keyword: workdayKeyword, companies, location, perTenant: 6 }).catch(
      (): SourcedJob[] => []
    ),
    fetchJobRss(indeedQueries, location || "remote"),
    fetchJobDivaListings(jobDivaKeywords).catch(() => []),
    ...(whichSearchProvider()
      ? webSearchQueries.map((q) =>
          search({ query: q, maxResults: 5 }).catch(
            (): SearchResult => ({ query: q, hits: [] })
          )
        )
      : []),
  ]);

  // Convert Indeed RSS to SearchResult shape + merge with web results.
  const indeedResult = rssItemsToSearchResult(
    `Indeed job listings (${indeedJobs.length} found)`,
    indeedJobs.slice(0, 20)
  );

  // JobDiva listings as a separate context block (not SearchResult shape).
  const jobDivaBlock = jobDivaToContext(jobDivaJobs.slice(0, 15));

  // Live Workday postings as their own context block.
  const workdayBlock = workdayJobs.length
    ? workdayJobs
        .slice(0, 40)
        .map((j, i) => {
          const loc = j.location ? ` — ${j.location}` : "";
          const posted = j.postedOn ? `\n    ${j.postedOn}` : "";
          return `[${i + 1}] ${j.title} — ${j.company}${loc}${posted}\n    Link: ${j.url}`;
        })
        .join("\n\n")
    : "";

  let searchResults: SearchResult[] = [indeedResult, ...webResults];
  searchResults = searchResults.map((r) => ({
    ...r,
    hits: r.hits.filter((h) => h.url && /^https?:\/\//i.test(h.url)),
  }));

  const totalHits =
    searchResults.reduce((n, r) => n + r.hits.length, 0) + workdayJobs.length;
  if (totalHits === 0) {
    return NextResponse.json({
      markdown:
        "No job listings found. Try a different profile, a broader role keyword, or remove the location filter.",
      context: { companies, profile, location, model: body.model },
    });
  }

  const targetRole =
    body.targetRole ||
    "Senior IC roles where I can ship AI + enterprise data products.";

  const profileBlurb =
    profile === "software"
      ? "Krishna wants SOFTWARE / AI engineering roles."
      : profile === "sap"
      ? "Krishna wants SAP / enterprise-data roles."
      : "Krishna is open to BOTH SAP and software / AI engineering roles.";

  const searchBlock = searchResultsToContext(searchResults);

  const factsBlock = await buildFactsContext();
  const todayStr = new Date().toISOString().slice(0, 10);
  const system = `You are Krishna's job scout. Match real job postings to his resume.
${factsBlock ? `\n${factsBlock}\n` : ""}
Below are REAL job listings from Indeed RSS, JobDiva (Abacus Service Corp portal), and web search. Every item with a URL is an actual posting.

YOUR JOB:
1. Read each listing title + snippet + posting date
2. Match against Krishna's resume
3. Group by recency: "Posted Today", "This Week", "Last Week", "Older"
4. Within each group, rank by match %

TODAY'S DATE: ${todayStr}

RULES:
- Use [Apply](url) markdown links — the URL from the listing data. NEVER invent URLs.
- For JobDiva jobs, use [View on JobDiva](url) with that listing's OWN Link value — do not reuse one link for several jobs.
- RECENCY IS STRICT, computed against TODAY'S DATE above: "Posted Today" = today only;
  "This Week" = within the last 7 days; "Last Week" = 8-14 days; anything older = "Older".
  A posting dated more than 14 days before today MUST go under "Older" — never "This Week".
- If a listing is marked [CACHED], say so on that line (e.g. "cached — verify it's still open")
  and never place it in "Posted Today" or "This Week".
- Each job = one line with title, company, location, date posted, match %, fit reason, link
- Max 10 jobs total across all groups
- If a listing is clearly not a job (article, blog) — skip it
- Below 70% match — skip

FORMAT:

## Posted Today
- **SAP S/4HANA Consultant** at Deloitte — Remote — Jun 10 — 88% match
  S/4HANA + Ariba experience directly relevant. [Apply](url)

## This Week
- **Senior AI Engineer** at Stripe — SF — Jun 8 — 75% match
  Next.js + LLM skills match. [Apply](url)

## Last Week
- **ERP Consultant** at Accenture — Remote — Jun 2 — 72% match
  SAP MM/SD background fits. [Apply](url)

If a date group has no matches, skip it entirely (don't show empty groups).
Match scoring: 90-100% exact match, 80-89% strong, 70-79% good. Below 70% skip.`;

  const modeBlurb = isBroadMarket
    ? "Broad market scan."
    : `Companies: ${companies.join(", ")}.`;

  const userPrompt = `${profileBlurb} ${modeBlurb}
Target: ${targetRole}
${location ? `Location: ${location}` : "Location: anywhere / remote"}

KRISHNA'S RESUME:
${experience || "(no jobs on file)"}

Skills: ${skills.join(", ") || "(none)"}

JOB LISTINGS (from Indeed RSS + web search):
${searchBlock}

${workdayBlock ? `LIVE WORKDAY POSTINGS (${workdayJobs.length} openings, fetched just now — these are CURRENT, prefer them):\n${workdayBlock}\n` : ""}
${jobDivaBlock ? `JOBDIVA PORTAL (Abacus Service Corp — ${jobDivaJobs.length} listings):\n${jobDivaBlock}` : ""}`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model: model.startsWith("compound") ? "llama-3.3-70b-versatile" : model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 1800,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Structured listings straight from the sources — deliberately NOT parsed
  // back out of the model's markdown, so the apply URLs are exactly what the
  // feeds returned and can't be mangled or invented by the LLM. The UI uses
  // these to offer "Prepare kit" per job.
  const listings = [
    // Live Workday postings first — these are current and have real apply URLs.
    ...workdayJobs.slice(0, 40).map((j) => ({
      title: j.title,
      company: j.company as string | null,
      location: j.location,
      url: j.url,
      description: j.description,
      source: j.source,
      cached: false,
    })),
    ...indeedJobs.slice(0, 20).map((j) => ({
      title: j.title,
      company: null as string | null,
      location: null as string | null,
      url: j.link,
      description: j.description,
      source: j.source || "indeed",
      cached: false,
    })),
    ...jobDivaJobs.slice(0, 15).map((j) => ({
      title: j.title,
      company: "Abacus Service Corp (JobDiva)" as string | null,
      location: (j.location || null) as string | null,
      url: j.url,
      description: j.description,
      source: "jobdiva",
      cached: j.cached === true,
    })),
  ].filter((l) => l.title && l.url);

  return NextResponse.json({
    markdown: result.content,
    listings,
    context: {
      mode: isBroadMarket ? "broad-market" : "per-company",
      companies,
      profile,
      location: location || null,
      resumeJobs: jobs.length,
      workdayJobsFound: workdayJobs.length,
      indeedJobsFound: indeedJobs.length,
      jobDivaFound: jobDivaJobs.length,
      webSearchHits: webResults.reduce((n, r) => n + r.hits.length, 0),
      model: result.modelUsed ?? model,
      modelRequested: model,
      provider: `workday + indeed-rss + jobdiva${whichSearchProvider() ? ` + ${whichSearchProvider()}` : ""}`,
    },
  });
}
