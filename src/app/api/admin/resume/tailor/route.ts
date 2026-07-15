import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runAgent } from "@/lib/agents";
import { saveVersion, type ResumeSection, type ResumeAnalysis } from "@/lib/resume";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  jobDescription: string;
  companyName?: string;
  jobTitle?: string;
  seniority?: string;
  tone?: string;
  emphasis?: string;
  customResume?: string;
};

/** GET — return the base/reference resume the AI tailors from. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ baseResume: MASTER_RESUME });
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.jobDescription?.trim()) {
    return NextResponse.json({ error: "Job description required" }, { status: 400 });
  }

  const baseResume = body.customResume?.trim() || MASTER_RESUME;

  const tone = body.tone || "strong";
  const emphasis = body.emphasis || "balanced";
  const seniority = body.seniority || "";

  const systemPrompt = `You are an elite executive resume writer with 20+ years of experience optimizing resumes for ATS systems, recruiter screening, and hiring manager review. You have deep expertise in technical, business, analyst, product, operations, and software engineering roles.

TASK: Given a candidate's current resume and a target job description, produce a tailored resume and analysis.

RULES — NON-NEGOTIABLE:
1. NEVER invent experience, employers, dates, degrees, or certifications
2. You MAY rewrite existing bullets to sound stronger, more results-driven, and more relevant
3. Mirror job description keywords naturally — no keyword stuffing
4. Use strong action verbs: Led, Architected, Delivered, Streamlined, Automated, Reduced, Increased
5. Every bullet should follow: [Action verb] + [what you did] + [measurable result/impact]
6. BANNED words: passionate, hardworking, team player, leverage, synergy, innovative, drive growth
7. Keep section titles standard: Summary, Skills, Experience, Education, Projects, Certifications
8. Single-column, no tables, no graphics — ATS-safe
9. Writing quality: sharp, specific, human-sounding — not generic AI boilerplate
10. Prioritize interview conversion
11. KEEP DEPTH — recent roles (last 2-3 jobs) MUST have 5-7 bullets each. Older roles 2-4 bullets. Do NOT strip detail.
12. ALWAYS include Education section with both degrees
13. Include the AI/Projects section if relevant to the target role — the candidate has shipped 7 production AI products
14. Skills section should have 12-20 items, mixing technical + domain keywords from the JD

TONE: ${tone === "conservative" ? "Professional, measured, traditional corporate language" : tone === "executive" ? "C-suite authority, strategic vision, board-level impact" : "Confident, direct, results-focused — strong without being aggressive"}

EMPHASIS: ${emphasis === "ats" ? "Maximum keyword density for ATS parsing — prioritize exact-match terms from JD" : emphasis === "recruiter" ? "Readability first — clear story arc, skimmable, compelling narrative" : "Balance ATS keyword coverage with recruiter readability"}

${seniority ? `TARGET SENIORITY: ${seniority} — calibrate language, scope, and impact metrics accordingly` : ""}

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown fences:
{
  "resume": {
    "summary": "3-4 sentence professional summary tailored to this exact role",
    "skills": ["skill1", "skill2", ...],
    "experience": [
      {
        "title": "Job Title",
        "company": "Company Name",
        "location": "City, State",
        "period": "Start - End",
        "bullets": ["Achievement bullet 1", "Achievement bullet 2", ...]
      }
    ],
    "projects": [
      {
        "name": "Project Name",
        "description": "One-line description",
        "tech": ["tech1", "tech2"]
      }
    ],
    "education": [
      {
        "degree": "Degree Name",
        "school": "University",
        "year": "Year"
      }
    ],
    "certifications": ["Cert 1", "Cert 2"],
    "additional": ""
  },
  "analysis": {
    "atsScore": 85,
    "keywordScore": 78,
    "matchedKeywords": ["keyword1", "keyword2"],
    "missingKeywords": ["keyword3", "keyword4"],
    "suggestions": ["Suggestion 1", "Suggestion 2"],
    "redFlags": ["Red flag 1"],
    "titleAlignment": "Your current title maps well to the target role because..."
  }
}`;

  const userPrompt = `TARGET ROLE:
Company: ${body.companyName || "Not specified"}
Title: ${body.jobTitle || "Not specified"}

JOB DESCRIPTION:
${body.jobDescription}

CURRENT RESUME:
${baseResume}

Analyze the job description, identify critical keywords and requirements, then produce a tailored resume and analysis. Keep ALL real experience, dates, companies, and education intact. Rewrite bullets and summary to align with this specific role.`;

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt,
    userPrompt,
    maxTokens: 8192,
  });

  if (!result.ok || !result.content) {
    return NextResponse.json(
      { error: result.error || "AI generation failed" },
      { status: 502 }
    );
  }

  let parsed: { resume: ResumeSection; analysis: ResumeAnalysis };
  try {
    const jsonStr = result.content
      .replace(/```json?\s*\n?/g, "")
      .replace(/```/g, "")
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response. Try again." },
      { status: 502 }
    );
  }

  if (!parsed.resume || !parsed.analysis) {
    return NextResponse.json(
      { error: "Incomplete AI response. Try again." },
      { status: 502 }
    );
  }

  let savedId: string | null = null;
  try {
    const saved = await saveVersion({
      company_name: body.companyName || "",
      job_title: body.jobTitle || "",
      job_description: body.jobDescription,
      base_resume_text: baseResume,
      tailored_resume: parsed.resume,
      analysis: parsed.analysis,
      ats_score: parsed.analysis.atsScore ?? null,
      tone,
      emphasis,
      seniority: seniority || "",
    });
    savedId = saved.id;
  } catch (e) {
    console.error("[resume/tailor] saveVersion failed (table may not exist):", e);
  }

  return NextResponse.json({
    id: savedId,
    resume: parsed.resume,
    analysis: parsed.analysis,
  });
}

const MASTER_RESUME = `KRISHNA AMARNENI
NJ, USA | Krishna.amarneni@gmail.com | 203-804-9291 | LinkedIn: krishnaamarneni | krishnaamarneni.com

PROFESSIONAL SUMMARY
Procurement and supply chain business professional with 7+ years of hands-on experience across the full Source-to-Pay lifecycle — vendor management, PO lifecycles, goods receipt, ASNs, inbound logistics, and inventory — in U.S. consumer goods, food & beverage, and healthcare organizations. Deep working knowledge of SAP S/4HANA, Fiori, and SAP Ariba gained through daily business use as a key user and business process expert. Also an AI engineer who has designed and shipped 7 full AI products solo, including an autonomous multi-agent system (8 AI agents) that runs a finance media brand 24/7 for under $10/month. Stack: Python, TypeScript, Next.js, React, Claude/Anthropic API, Model Context Protocol (MCP), Supabase, Vercel.

CORE COMPETENCIES
Source-to-Pay (S2P) & Procure-to-Pay Operations | Vendor Management & PO Lifecycle | Goods Receipt, ASN & Inbound Logistics | Inventory & Batch Management | SAP S/4HANA & Fiori (business use) | SAP Ariba (Buying, portal, transaction troubleshooting) | UAT Scenario Design & Execution | Data Validation, Cutover & Go-Live Readiness | Defect & Enhancement Logging (IT ticketing) | End-User Training, SOPs & Documentation | Advanced Excel, Word, PowerPoint | Power BI Reporting | Python | TypeScript | Next.js | React | Claude/Anthropic API | MCP | Supabase | Vercel | AI/ML | Multi-Agent Systems

PROFESSIONAL EXPERIENCE

S2P Business Process Analyst (Business Support) | The Coca-Cola Company, Atlanta, GA — Feb 2025 – Present
- Primary point of contact for procurement, inbound logistics, and inventory business users on SAP S/4HANA and SAP Ariba, providing daily functional support and keeping operations running through system changes and releases.
- Supported day-to-day S2P activity: purchase orders through Ariba, goods receipts, ASN creation/receipt/confirmation, inbound deliveries, inventory postings, and outbound deliveries.
- Triaged Ariba–S/4HANA transaction failures (ASN and inbound delivery mismatches, inventory posting errors, material data issues) from the business side, investigating in the Ariba portal and documenting root cause for the SAP team.
- Flagged defects and enhancement requests via IT tickets with clear business-language reproduction steps and impact, then tracked them with SAP/integration teams through fix and retest.
- Wrote and executed UAT and regression test scenarios based on real procurement and receiving workflows for each release cycle; provided business sign-off and post-go-live support.
- Validated vendor and material data for new plants and initiatives, ensuring records were correct and complete before business use — preventing delivery discrepancies and customer penalties.
- Acted as liaison between business users, IT, and the SAP CoE, gathering user feedback and turning recurring pain points into improvement requests that reduced repeat errors.

Supply Chain & Procurement Operations Specialist (SAP S/4HANA Key User) | Xiromed, New Jersey — Nov 2023 – Jan 2025
- Ran daily procure-to-pay and order-to-cash operations in SAP S/4HANA as a business super user — POs, goods receipts, inventory movements, and month-end supply chain activities.
- Maintained material, vendor, contract, and pricing data supporting procurement with 99.9% accuracy; owned data validation during system changes and go-lives, including business testing and user training.
- Coordinated inbound logistics with vendors, suppliers, and third-party packaging partners across NA, LATAM, Europe, and APAC; analyzed freight capacity and inventory to keep deliveries on time.
- Evaluated RFPs and approved vendor bids using demand forecasts, sales trends, and inventory levels; supported demand planning and monthly inventory valuation with Finance.
- Owned product release from internal manufacturing sites and serialization label approvals (TraceLink) for regulatory (DSCSA) compliance.
- Escalated system issues to SAP support with detailed business context, and validated fixes through UAT before release to production.

SAP S/4HANA Master Data Analyst – Procurement & Finance (Business User) | PepsiCo Inc., New York — Apr 2023 – Sept 2023
- Created, extended, and maintained vendor and material master data (business partner, purchasing, plant/storage location, UoM) under approval workflows and SOX controls.
- Investigated and resolved master-data errors blocking procurement and finance transactions; reduced data-related errors ~40% through root-cause analysis and standardized maintenance procedures.
- Supported S/4HANA deployment waves as a business validator — data validation, cutover checks, and post-go-live stabilization.
- Wrote SOPs and process documentation used for audits, training, and knowledge transfer; built Excel/Power BI trackers for data quality and resolution trends.

Procurement & Inventory Data Analyst | DenKen, California — Dec 2022 – Mar 2023
- Managed supplier relationships and negotiations, delivering cost savings; ran supplier evaluations, audits, and market research.
- Partnered with inventory management to optimize stock levels, prevent stock-outs, and maintain accurate inventory records; enforced procurement and financial policy compliance.

Vendor Master Data Analyst (SAP SRM / S/4HANA) | IFF, Hyderabad, India — May 2020 – Feb 2021
- Created and maintained vendor master records — addresses, banking, tax data, plant and purchasing org extensions — under governance and approval workflows.
- Performed vendor data validation and cleansing, maintained audit trackers, and produced weekly/monthly reports for procurement leadership.

IT Procurement Associate (SAP MM / Ariba Buyer) | SAAS IT, Chennai, India — Mar 2019 – Apr 2020
- Ran end-to-end procurement in SAP S/4HANA and Ariba: raised POs, sourced forging/machining materials, managed vendor-supplied materials for production, and tracked goods receipt.
- Drafted RFIs/RFQs, analyzed vendor responses, and negotiated terms achieving ~10% cost savings; created training and testing materials for user adoption.

AI ENGINEERING PROJECTS (Solo — all deployed and live)
- WealthClaude: Full-stack AI finance platform — portfolio tracker with 3D globe across 51 markets, AI market intelligence via 8-agent autonomous crew (Atlas CEO, Sage, Pulse, Herald, Scout, Nova, Blitz, Hunter) running 24/7, dividend analytics, 15+ calculators, 7-layer security. Runs for under $10/month via model routing. Stack: Next.js, Supabase, Three.js, Stripe, Groq AI, Claude API, MCP.
- EchoNest: AI music streaming platform with smart playlists, listening analytics, recommendations, and MCP agent integration.
- krishnaamarneni.com: Personal admin cockpit with autonomous AI agents (Lucy AI), contact CRM, social posting, resume tailor, Gmail integration.
- Air Surface Global: AI logistics platform with route planning across air/ocean/road/rail, audience intelligence, cost optimization. Globe.gl + GSAP.
- 3 additional deployed web applications for healthcare and pharmacy clients.

EDUCATION
Master's Degree — Data Analytics, New England College
Bachelor's Degree — Automotive Engineering, Hindustan University

SYSTEMS & TOOLS
SAP S/4HANA (MM, IM, SD, PP, QM) | SAP Fiori | SAP Ariba | SAP SRM | SAP ECC | TraceLink | Microsoft Excel (advanced), Word, PowerPoint | Power BI | Python | TypeScript | Next.js | React | Supabase | Vercel | Claude/Anthropic API | Groq | Model Context Protocol (MCP) | Three.js | GSAP | Tailwind CSS
`;
