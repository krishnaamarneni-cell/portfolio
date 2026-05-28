import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { resolveAgentModel, runAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  model?: string;
  companies?: string[];
  /** Optional override of the user's "what role I want next" line. */
  targetRole?: string;
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

  const companies =
    body.companies && body.companies.length > 0
      ? body.companies.slice(0, 12)
      : DEFAULT_COMPANIES;

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

  const targetRole =
    body.targetRole ||
    "Senior IC roles: SAP, AI Engineer, Full-stack with AI focus, Solutions Architect — places where I can ship AI + enterprise data products.";

  const system = `You are Krishna Amarneni's job-hunting agent. You have a web-search tool. Use it.

Job: in one shot, find ACTUAL OPEN ROLES that match Krishna's experience at the target companies below. Only return positions you can back with a real careers-page URL.

Output rules:
- Return clean Markdown. Group by company as H2 (\`## PepsiCo\`).
- Under each company, 1-5 bullets per matching role. Each bullet:
  - **<Job title>** — location/remote · level · key skill match
  - One sentence on why it's a fit for Krishna.
  - Link as: \`[Apply](URL)\`.
- If a company has nothing relevant open, write a single line under its H2: \`No matching open roles right now.\`
- No padding. No "best of luck". No emojis.
- Prefer postings from the last 30 days; mark stale ones.`;

  const userPrompt = `Target companies: ${companies.join(", ")}.

Krishna's experience:
${experience || "(none on file)"}

Krishna's skills: ${skills.join(", ") || "(none on file)"}

What Krishna wants next: ${targetRole}
${body.remoteOk === false ? "On-site/hybrid only." : "Remote is welcome but not required."}

Find roles open right now that match. Be picky — only post things he could actually apply to today.`;

  const model = resolveAgentModel(body.model);
  const result = await runAgent({
    apiKey,
    model,
    systemPrompt: system,
    userPrompt,
    maxTokens: 2600,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    markdown: result.content,
    context: { companies, model, jobs: jobs.length },
  });
}
