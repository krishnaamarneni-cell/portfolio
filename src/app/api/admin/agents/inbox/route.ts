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
      contacts: [],
      drafts: [],
      context: { days, emailCount: 0 },
    });
  }

  const [jobs, site, factsBlock] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
    buildFactsContext(),
  ]);
  const experience = jobs
    .map((j) => `- ${j.title} @ ${j.company} (${j.period})`)
    .join("\n");
  const skills = (site.skills?.skills ?? []).slice(0, 30);

  const emailsBlock = messages
    .map((m, i) => {
      return `[${i + 1}] From: ${m.from ?? "?"}\n    Subject: ${m.subject ?? "(no subject)"}\n    Date: ${m.date ?? "?"}\n    Preview: ${m.snippet ?? ""}`;
    })
    .join("\n\n");

  const system = `You are Krishna's email intelligence agent. Categorize his inbox, extract contacts, and draft replies.
${factsBlock ? `\n${factsBlock}\n` : ""}

You have ${messages.length} emails from the last ${days} days.

STEP 1: Categorize every email into: Jobs/Recruiter, Important, Newsletters, Marketing/Spam
STEP 2: For ALL job/recruiter emails (not just strong matches), extract the sender's contact
STEP 3: For each job/recruiter email, draft a SHORT reply (2-3 sentences, human tone)

OUTPUT FORMAT:

## Summary
X emails scanned. Y job-related, Z important, W newsletters, V marketing.

## Jobs & Recruiter (Y emails)
### Strong matches (>70%)
- **[Subject]** from [Sender] — [Why it matches]. **85% match**

### Other job emails
- **[Subject]** from [Sender] — [Brief note]. **40% match**

## Important (Z emails)
- **[Subject]** from [Sender] — [one-line summary]

## Newsletters (W emails)
- **[Subject]** from [Sender] — [worth reading?]

## Marketing/Spam (V emails)
[count only]

CRITICAL: After the markdown, output TWO JSON blocks:

1. ALL contacts from job/recruiter emails (save every single one for future cold outreach):
\`\`\`contacts
[
  {"name":"John Smith","email":"john@acme.com","company":"Acme Corp","role":"Senior SAP Consultant","match":85},
  {"name":"Jane Doe","email":"jane@startup.io","company":"Startup","role":"AI Engineer","match":40}
]
\`\`\`

2. Draft replies for each job/recruiter email (Krishna will approve/edit before sending):
\`\`\`drafts
[
  {"to":"john@acme.com","name":"John Smith","subject":"Re: Senior SAP Consultant","body":"Saw the S/4HANA role — I just wrapped a similar migration at Coca-Cola covering MM/SD and Ariba. Would love to hear more about the scope. Free for a quick call this week?","match":85},
  {"to":"jane@startup.io","name":"Jane Doe","subject":"Re: AI Engineer role","body":"Thanks for reaching out. The AI engineer role looks interesting — I've been building LLM-powered agent systems with Next.js and Python. Happy to chat if the role is still open.","match":40}
]
\`\`\`

RULES for drafts:
- Sound human, not templated. Lead with something specific from the email.
- 2-3 sentences max. End with a casual call-to-action.
- BANNED: "excited about the opportunity", "leverage my expertise", "confident in my ability"
- Include ALL job emails, not just strong matches — Krishna decides which to send`;

  const userPrompt = `KRISHNA'S RESUME:
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
    maxTokens: 3500,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  let markdown = result.content || "";
  let contactsSaved = 0;
  let drafts: Array<{ to: string; name: string; subject: string; body: string; match: number }> = [];

  // Extract contacts
  try {
    const contactsMatch = /```contacts\s*\n([\s\S]*?)```/.exec(markdown);
    if (contactsMatch) {
      const parsed = JSON.parse(contactsMatch[1]) as Array<{
        name?: string; email?: string; company?: string; role?: string; match?: number;
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
      markdown = markdown.replace(/```contacts\s*\n[\s\S]*?```/, "").trim();
    }
  } catch {}

  // Extract drafts
  try {
    const draftsMatch = /```drafts\s*\n([\s\S]*?)```/.exec(markdown);
    if (draftsMatch) {
      drafts = JSON.parse(draftsMatch[1]) as typeof drafts;
      markdown = markdown.replace(/```drafts\s*\n[\s\S]*?```/, "").trim();
    }
  } catch {}

  return NextResponse.json({
    markdown,
    drafts,
    context: {
      days,
      emailCount: messages.length,
      contactsSaved,
      draftsGenerated: drafts.length,
      model: result.modelUsed ?? model,
      modelRequested: model,
    },
  });
}
