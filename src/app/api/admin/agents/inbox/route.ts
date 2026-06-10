import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveAgentModel, runAgent } from "@/lib/agents";
import { listRecentMessages } from "@/lib/gmail";
import { fetchJobs, fetchSiteContent } from "@/lib/content";
import { buildFactsContext } from "@/lib/facts";
import { upsertMany, type RecruiterContactInput } from "@/lib/contacts";
import { buildLearningContext } from "@/lib/email-learning";

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

  const days = Math.min(body.days ?? 3, 365);

  // For longer scans, pull more emails but filter job-only before sending to LLM.
  const fetchLimit = days <= 7 ? 40 : days <= 30 ? 100 : 300;
  const { messages: allMessages, error: gmailError } = await listRecentMessages({
    query: `newer_than:${days}d`,
    maxResults: fetchLimit,
  });

  // Filter to job-related emails for longer scans (LLM can't process 300 emails).
  const JOB_RX = /job|hiring|opportunity|role|position|engineer|consultant|recruiter|opening|interview|offer|career|vacancy|talent/i;
  const messages = days <= 7
    ? allMessages // Short scans: show everything
    : allMessages.filter((m) => {
        const text = `${m.subject ?? ""} ${m.snippet ?? ""} ${m.from ?? ""}`;
        return JOB_RX.test(text);
      }).slice(0, 40); // Cap at 40 for LLM context

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

  const [jobs, site, factsBlock, learningCtx] = await Promise.all([
    fetchJobs().catch(() => []),
    fetchSiteContent(),
    buildFactsContext(),
    buildLearningContext().catch(() => ""),
  ]);
  const experience = jobs
    .map((j) => {
      const head = `- ${j.title} @ ${j.company} (${j.period}, ${j.location})`;
      const desc = j.description ? `\n  ${j.description}` : "";
      const highlights = j.highlights?.length
        ? "\n  " + j.highlights.slice(0, 3).join("; ")
        : "";
      const tags = j.tags?.length ? `\n  Skills: ${j.tags.join(", ")}` : "";
      return head + desc + highlights + tags;
    })
    .join("\n\n");
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

2. Draft replies using TWO templates. Read each email carefully and compare against Krishna's resume — reference SPECIFIC matching experience, projects, and companies.

TEMPLATE A (use when email has clear JD/role/skills):
"Thank you for reaching out about the {job_title} role at {company}. This aligns well with my background — I have {X years} of hands-on experience in {matching_skills}, most recently at {recent_company} where I {specific_achievement}. Looking at the requirements, my experience with {skill_1}, {skill_2}, and {skill_3} maps directly to what you are looking for. I would welcome the chance to discuss how my work on {relevant_project} translates to this position. Would you be available for a quick call this week?"

TEMPLATE B (use when email is vague/exploratory/just asking availability):
"Thanks for considering me for the {job_title} position. I am currently working in {domain} with a focus on {top_skills}, and this opportunity caught my attention. My background includes {years} years in {domain} — specifically {relevant_experience} across projects at {company_1} and {company_2}. I would be interested to learn more about the role, the team, and how my experience could contribute. Looking forward to connecting."

\`\`\`drafts
[
  {"to":"john@acme.com","name":"John Smith","subject":"Re: Senior SAP Consultant","body":"Thank you for reaching out about the Senior SAP Consultant role at Acme Corp. This aligns well with my background — I have 4 years of hands-on experience in SAP S/4HANA and Ariba, most recently at Coca-Cola where I led the MM/SD module migration across 12 plants. Looking at the requirements, my experience with S/4HANA, Ariba procurement, and supply chain integration maps directly to what you are looking for. Would you be available for a quick call this week?","match":85,"template":"A"},
  {"to":"jane@startup.io","name":"Jane Doe","subject":"Re: AI role","body":"Thanks for considering me for the AI Engineer position. I am currently working in AI and full-stack development with a focus on LLM agent systems and Next.js, and this opportunity caught my attention. My background includes experience building production AI tools across projects at WealthClaude and EchoNest. I would be interested to learn more about the role and team. Looking forward to connecting.","match":40,"template":"B"}
]
\`\`\`

RULES for drafts:
- Replace ALL {placeholders} with REAL data from Krishna's resume. Reference specific companies, projects, skills.
- BANNED: "excited about the opportunity", "leverage my expertise", "confident in my ability", any **bold** markdown or asterisks — plain text only
- Include ALL job emails, not just strong matches — Krishna decides which to send
- Do NOT include greeting ("Hi Name") or signature — those are added automatically by the UI
${learningCtx}`;

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
