import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { listFacts } from "@/lib/facts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lucy-vault imported facts.
 *
 * Extracted from C:\Users\Krishna\OneDrive\Documents\Codes\Lucy-vault on the
 * day this was wired up. Each entry becomes a memory_suggestion row, so the
 * user reviews them in the Memory agent queue (Life tab) before they touch
 * the real facts table. No fact is auto-accepted.
 *
 * Source files in vault:
 *   personal/krishna_full_profile.md
 *   learnings/krishna_profile.md
 *   learnings/krishna_career.md
 *   learnings/krishna_portfolio_holdings.md
 *   learnings/krishna_interests.md
 *   learnings/krishna_tech_stack.md
 *   Lucy/VISION.md
 */
const LUCY_FACTS: Array<{
  key: string;
  value: string;
  category: string;
  expires_at?: string;
  reasoning: string;
}> = [
  // ─── Identity ───
  {
    key: "age",
    value: "28",
    category: "general",
    reasoning: "From learnings/krishna_profile.md",
  },
  {
    key: "nationality",
    value: "Indian (on STEM OPT in USA)",
    category: "general",
    reasoning: "From personal/krishna_full_profile.md",
  },
  {
    key: "current_location",
    value: "Delaware, USA",
    category: "location",
    reasoning: "From personal/krishna_full_profile.md (Identity section)",
  },
  {
    key: "considering_relocation_to",
    value: "Georgia (top), Florida, North Carolina",
    category: "location",
    reasoning: "From personal/krishna_full_profile.md",
  },

  // ─── Immigration ───
  {
    key: "visa_status",
    value: "H1B STEM OPT",
    category: "visa",
    expires_at: "2026-05-05",
    reasoning: "From personal/krishna_full_profile.md (Immigration section)",
  },
  {
    key: "h1b_cap_gap_extension_until",
    value: "April 1, 2027 (approximate)",
    category: "visa",
    expires_at: "2027-04-01",
    reasoning: "From learnings/krishna_career.md and full profile",
  },

  // ─── Career ───
  {
    key: "career",
    value: "SAP Functional Consultant — 7 years experience",
    category: "work",
    reasoning: "From learnings/krishna_career.md",
  },
  {
    key: "sap_specialization",
    value: "SAP MM, SAP Ariba (Buying/Invoicing/Sourcing), Procure-to-Pay",
    category: "work",
    reasoning: "From learnings/krishna_career.md",
  },
  {
    key: "past_clients",
    value: "Coca-Cola, PepsiCo, Xiromed",
    category: "work",
    reasoning: "From learnings/krishna_career.md",
  },

  // ─── Income ───
  {
    key: "primary_income",
    value: "SAP consulting (contract / full-time)",
    category: "finance",
    reasoning: "From personal/krishna_full_profile.md (Income section)",
  },
  {
    key: "side_projects",
    value:
      "WealthClaude (finance platform for Gen Z, pre-revenue), Lucy AI (personal AI), North Falmouth Pharmacy site, Saint Francis Medical site, n8n automation",
    category: "work",
    reasoning: "From personal/krishna_full_profile.md (Projects)",
  },
  {
    key: "monthly_expenses_floor",
    value: "~$1,200 (rent $600, food $400, utilities $200)",
    category: "finance",
    reasoning: "From personal/krishna_full_profile.md (Monthly Expenses)",
  },
  {
    key: "house_in_india_emi",
    value: "$225 / month",
    category: "finance",
    reasoning: "From personal/krishna_full_profile.md (Real Estate)",
  },

  // ─── Portfolio ───
  {
    key: "portfolio_top_concentration",
    value:
      "Heavy concentration in NKE + WMT (>60% combined per Lucy vault — verify against current WealthClaude data before quoting numbers)",
    category: "finance",
    reasoning:
      "From learnings/krishna_portfolio_holdings.md. Note: vault flagged this as drift-prone — see WealthClaude MCP for live numbers.",
  },
  {
    key: "portfolio_other_holdings",
    value:
      "Also holds: SPCE, GOOGL, SPY, CVX, META, AAPL, UNH, KULR, ARM, RIVN, GXO, MSFT, FUBO, ELF, CELH, UBER, SOFI (some may have been sold — check WealthClaude)",
    category: "finance",
    reasoning: "From learnings/krishna_portfolio_holdings.md",
  },
  {
    key: "trading_style",
    value: "Mix of growth + value, no options yet",
    category: "preferences",
    reasoning: "From personal/krishna_full_profile.md",
  },

  // ─── Risks Krishna actively tracks ───
  {
    key: "tracked_risk_h1b",
    value:
      "H1B visa approval — if not approved, must leave US or find new sponsor",
    category: "visa",
    reasoning: "Top risk per personal/krishna_full_profile.md (Key Risks)",
  },
  {
    key: "tracked_risk_concentration",
    value: "NKE + WMT concentration is dominant portfolio exposure",
    category: "finance",
    reasoning: "Top risk per personal/krishna_full_profile.md",
  },
  {
    key: "tracked_risk_career",
    value: "SAP market demand + AI replacing consultants (job security)",
    category: "work",
    reasoning: "Top risk per personal/krishna_full_profile.md",
  },

  // ─── Interests / Style ───
  {
    key: "interests",
    value:
      "AI projects + agents, stock investing, YouTube finance shorts, personal-finance education for Gen Z, real-time voice AI, GSAP/Lenis/Barba scroll effects, silver/COMEX, conspiracy theories",
    category: "preferences",
    reasoning: "From learnings/krishna_interests.md",
  },
  {
    key: "loves",
    value: "Building AI projects",
    category: "preferences",
    reasoning: "From learnings/krishna_profile.md",
  },
  {
    key: "hates",
    value: "Mornings (still drinks coffee every morning though)",
    category: "preferences",
    reasoning: "From learnings/krishna_profile.md",
  },

  // ─── Public presence ───
  {
    key: "twitter_handle",
    value: "@wealthclaude",
    category: "general",
    reasoning: "From learnings/krishna_profile.md",
  },
  {
    key: "linkedin_cadence",
    value: "Posts 3×/week about personal finance",
    category: "preferences",
    reasoning: "From learnings/krishna_profile.md",
  },

  // ─── Tools ───
  {
    key: "primary_machine",
    value: "Windows 11 + WSL2 (Ubuntu), i7-1265U, 16GB RAM, 238GB storage",
    category: "general",
    reasoning: "From learnings/krishna_tech_stack.md",
  },
  {
    key: "paid_subscriptions",
    value: "Canva Premium, Perplexity Premium",
    category: "general",
    reasoning: "From learnings/krishna_tech_stack.md",
  },
  {
    key: "free_finance_apis",
    value: "Finnhub, Polygon, FMP, Twelve Data (all free tiers)",
    category: "finance",
    reasoning: "From learnings/krishna_portfolio_holdings.md",
  },
  {
    key: "hosting_stack",
    value: "Porkbun (domains), Hostinger, Vercel (hosting), ImprovMX (email forwarding)",
    category: "general",
    reasoning: "From learnings/krishna_tech_stack.md",
  },
];

const LUCY_NOTES: Array<{
  body: string;
  tags: string[];
  event_date?: string;
  reasoning: string;
}> = [
  {
    body:
      "Lucy's vision: a private financial decision-support tool for Krishna only. The lesson she learned the hard way — building self-improving agents that nobody used. Atlas was the keeper: news → personal financial impact with scoring.",
    tags: ["lucy", "lesson"],
    reasoning: "From Lucy/VISION.md — distilled lesson",
  },
  {
    body:
      "Watch for the same hand-edited-profile drift bug Lucy hit: hard-coded portfolio weights in a markdown profile got quoted verbatim long after Krishna had sold those tickers. Fix: never quote a portfolio weight from facts table — always pull from WealthClaude MCP live.",
    tags: ["lucy", "engineering", "lesson"],
    reasoning: "From Lucy/reviews/bug_news_hallucination_diagnosis_2026-05-13.md",
  },
];

const LUCY_KNOWLEDGE_INDEX = [
  { slug: "h1b-reference", title: "H-1B and STEM OPT reference", category: "visa" },
  { slug: "fed-policy", title: "US Fed policy primer", category: "macro" },
  { slug: "trade-wars", title: "Trade-war framework", category: "macro" },
  { slug: "portfolio-theory", title: "Portfolio theory", category: "finance" },
  { slug: "stock-fundamentals", title: "Stock fundamentals", category: "finance" },
  { slug: "options-basics", title: "Options basics", category: "finance" },
  { slug: "margin-of-safety", title: "Margin of safety (Graham/Buffett)", category: "finance" },
  { slug: "moat-concept", title: "Economic moat", category: "finance" },
  { slug: "pe-ratio", title: "P/E ratio", category: "finance" },
  { slug: "us-housing-market", title: "US housing market", category: "real_estate" },
  { slug: "sap-market", title: "SAP consulting market", category: "career" },
  { slug: "ai-replacing-consultants", title: "AI replacing consultants", category: "career" },
];

export async function POST() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = requireSupabaseAdmin();

  // Don't re-propose facts that already exist in the facts table OR are in a
  // pending suggestion. Use both checks because the queue is the user's gate.
  const existing = await listFacts();
  const existingKeys = new Set(existing.map((f) => f.key.toLowerCase()));
  const { data: pending } = await supabase
    .from("memory_suggestions")
    .select("suggested_kind, suggested_data, status")
    .eq("status", "pending");
  const pendingKeys = new Set<string>();
  for (const p of pending ?? []) {
    if ((p as { suggested_kind: string }).suggested_kind === "fact") {
      const d = (p as { suggested_data: Record<string, unknown> }).suggested_data;
      if (typeof d?.key === "string") pendingKeys.add(d.key.toLowerCase());
    }
  }

  let inserted = 0;
  let skipped = 0;

  // ── Insert fact suggestions ──
  for (const f of LUCY_FACTS) {
    const k = f.key.toLowerCase();
    if (existingKeys.has(k) || pendingKeys.has(k)) {
      skipped++;
      continue;
    }
    await supabase.from("memory_suggestions").insert({
      source_kind: "manual",
      source_id: "lucy-vault-import",
      suggested_kind: "fact",
      suggested_data: {
        key: f.key,
        value: f.value,
        category: f.category,
        expires_at: f.expires_at,
      },
      confidence: 0.9,
      reasoning: f.reasoning,
      status: "pending",
    });
    inserted++;
  }

  // ── Insert lesson notes ──
  for (const n of LUCY_NOTES) {
    await supabase.from("memory_suggestions").insert({
      source_kind: "manual",
      source_id: "lucy-vault-import",
      suggested_kind: "note",
      suggested_data: {
        body: n.body,
        tags: n.tags,
        event_date: n.event_date,
      },
      confidence: 0.85,
      reasoning: n.reasoning,
      status: "pending",
    });
    inserted++;
  }

  return NextResponse.json({
    inserted,
    skipped,
    knowledgeFiles: LUCY_KNOWLEDGE_INDEX,
  });
}

export async function GET() {
  // Simple capability probe — UI can render counts in the import button.
  return NextResponse.json({
    factCount: LUCY_FACTS.length,
    noteCount: LUCY_NOTES.length,
    knowledgeCount: LUCY_KNOWLEDGE_INDEX.length,
  });
}

export const KNOWLEDGE_INDEX = LUCY_KNOWLEDGE_INDEX;
