import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import { listRecentMessages } from "@/lib/gmail";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";
import { upsertMany, type RecruiterContactInput } from "@/lib/contacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  model?: string;
  /** How many days back to scan. Default 3. */
  days?: number;
};

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {}

  const days = Math.min(body.days ?? 3, 14);

  // Pull emails from Gmail.
  const { messages, error: gmailError } = await listRecentMessages({
    query: `newer_than:${days}d`,
    maxResults: 40,
  });

  if (gmailError) {
    return NextResponse.json({ error: gmailError }, { status: 502 });
  }
  if (messages.length === 0) {
    return NextResponse.json({
      markdown: "## Inbox\n\nNo emails found in the last " + days + " days. Is Gmail connected?",
      context: { days, emailCount: 0 },
    });
  }

  // Pull resume for job matching.
  const [jobs, site, factsBlock] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
    buildFactsContext(),
  ]);
  const experience = jobs
    .map((j) => `- ${j.title} @ ${j.company} (${j.period})`)
    .join("\n");
  const skills = (site.skills?.skills ?? []).slice(0, 30);

  // Format emails for the LLM.
  const emailsBlock = messages
    .map((m, i) => {
      return `[${i + 1}] From: ${m.from ?? "?"}\n    Subject: ${m.subject ?? "(no subject)"}\n    Date: ${m.date ?? "?"}\n    Preview: ${m.snippet ?? ""}`;
    })
    .join("\n\n");

  const system = `You are Krishna's email intelligence agent. Categorize his inbox and surface what matters.
${factsBlock ? `\n${factsBlock}\n` : ""}

You have ${messages.length} emails from the last ${days} days. Categorize EVERY email into one of these buckets:

1. **Jobs/Recruiter** — JDs, recruiter outreach, interview invites, job alerts
2. **Important** — Bills, appointments, government/visa, bank alerts, personal
3. **Newsletters** — Tech newsletters, industry updates worth reading
4. **Marketing/Spam** — Promotions, ads, sales emails, unsubscribe-worthy

For Jobs/Recruiter emails, match against Krishna's resume and rate:
- **Strong match (>70%)** — Skills + experience align well. Flag these prominently.
- **Weak match (<70%)** — Different tech stack, too junior/senior, wrong domain. Note why.

OUTPUT FORMAT:

## Summary
X emails scanned. Y job-related, Z important, W newsletters, V marketing.

## Jobs & Recruiter (Y emails)
### Strong matches
- **[Subject]** from [Sender] — [Why it matches: cite specific resume match]. **85% match**
- ...

### Weak matches
- **[Subject]** from [Sender] — [Why it's weak: wrong stack/level/domain]. **40% match**

## Important (Z emails)
- **[Subject]** from [Sender] — [one-line summary]

## Newsletters (W emails)
- **[Subject]** from [Sender] — [one-line: worth reading?]

## Marketing/Spam (V emails)
[Just the count, don't list each one unless <5 total]

RULES:
- Every email must appear in exactly ONE category
- For job matches, cite specific skills from Krishna's resume
- Be honest about match percentages — don't inflate
- Keep it scannable — he reads this on his phone

IMPORTANT: At the very end, output a JSON block with recruiter contacts extracted from job emails.
Format it exactly like this (after the markdown):

\`\`\`contacts
[
  {"name":"John Smith","email":"john@acme.com","company":"Acme Corp","role":"Senior SAP Consultant","match":85},
  {"name":"Jane Doe","email":"jane@startup.io","company":"Startup","role":"AI Engineer","match":40}
]
\`\`\`

Include ALL job/recruiter senders. Extract the person's name from the From field. If no job emails, output an empty array.`;

  const userPrompt = `KRISHNA'S RESUME (for job matching):
${experience || "(no jobs on file)"}
Skills: ${skills.join(", ") || "(none)"}

INBOX (${messages.length} emails, last ${days} days):
${emailsBlock}`;

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

  // Extract and save recruiter contacts from the structured JSON block.
  let contactsSaved = 0;
  let markdown = result.content || "";
  try {
    const contactsMatch = /```contacts\s*\n([\s\S]*?)```/.exec(markdown);
    if (contactsMatch) {
      const parsed = JSON.parse(contactsMatch[1]) as Array<{
        name?: string;
        email?: string;
        company?: string;
        role?: string;
        match?: number;
      }>;
      const inputs: RecruiterContactInput[] = parsed
        .filter((c) => c.email && c.email.includes("@"))
        .map((c) => ({
          name: c.name || "",
          email: c.email!,
          company: c.company || null,
          role_pitched: c.role || null,
          match_pct: typeof c.match === "number" ? c.match : null,
          source: "inbox-agent",
        }));
      contactsSaved = await upsertMany(inputs);
      // Remove the JSON block from displayed markdown.
      markdown = markdown.replace(/```contacts\s*\n[\s\S]*?```/, "").trim();
    }
  } catch {
    // JSON parse failed — no contacts extracted, that's fine.
  }

  return NextResponse.json({
    markdown,
    context: {
      days,
      emailCount: messages.length,
      contactsSaved,
      model: result.modelUsed ?? model,
      modelRequested: model,
    },
  });
}
