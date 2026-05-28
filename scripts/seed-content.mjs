#!/usr/bin/env node
/**
 * Seeds the Supabase `jobs` and `projects` tables with the default content.
 * Re-running is safe: rows whose `title` already exists are skipped.
 *
 * Usage:  node scripts/seed-content.mjs
 *         node scripts/seed-content.mjs --force   (also re-inserts duplicates)
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const force = process.argv.includes("--force");

const JOBS = [
  {
    title: "SAP Business Analyst",
    category: "Enterprise & Integration",
    company: "The Coca-Cola Company",
    location: "Atlanta, USA",
    period: "Feb 2025 – Present",
    logo_src: "/logos/coca-cola.png",
    logo_bg: "#ffffff",
    description:
      "Supporting end-to-end supply chain operations across SAP S/4HANA and SAP Ariba, ensuring system stability and business continuity for global operations.",
    highlights: [
      "SAP S/4HANA & SAP Ariba integration",
      "ASN, inventory & delivery error resolution",
      "CIG and cXML root cause analysis",
      "UAT, regression testing & go-live support",
      "Liaison between business, IT & SAP CoE",
    ],
    tags: ["SAP S/4HANA", "SAP Ariba", "CIG", "cXML", "ASN"],
    sort_order: 10,
  },
  {
    title: "SAP S/4HANA MM / SD Consultant",
    category: "Pharma & Compliance",
    company: "Xiromed",
    location: "New Jersey, USA",
    period: "Nov 2023 – Jan 2025",
    logo_src: null,
    logo_bg: "#0a4da2",
    description:
      "Managed SAP S/4HANA master data with 99.9% accuracy and delivered end-to-end MM, IM, and SD implementations for pharmaceutical operations.",
    highlights: [
      "99.9% master data accuracy",
      "End-to-end SAP MM, IM, SD delivery",
      "DSCSA compliance via TraceLink",
      "Global supply chain: APAC, EU, NA, LATAM",
      "Demand planning & forecasting support",
    ],
    tags: ["SAP MM/SD", "TraceLink", "DSCSA", "Supply Chain"],
    sort_order: 20,
  },
  {
    title: "SAP S/4HANA Master Data Analyst",
    category: "Data Governance & Finance",
    company: "PepsiCo Inc.",
    location: "New York, USA",
    period: "Apr 2023 – Sept 2023",
    logo_src: "/logos/pepsico.png",
    logo_bg: "#004b93",
    description:
      "Reduced master-data-related errors by ~40% through root-cause analysis and standardized data maintenance across procurement and finance.",
    highlights: [
      "~40% error reduction via root-cause analysis",
      "Vendor & material master with SOX compliance",
      "Power BI reporting for data quality",
      "S/4HANA deployment & post-go-live support",
    ],
    tags: ["Master Data", "SOX", "Power BI", "S/4HANA"],
    sort_order: 30,
  },
  {
    title: "Data Analyst",
    category: "Analytics & Procurement",
    company: "DenKen",
    location: "California, USA",
    period: "Dec 2022 – Mar 2023",
    logo_src: "/logos/denken.webp",
    logo_bg: "#2d2d2d",
    description:
      "Utilized MySQL and Tableau for data analysis, providing actionable insights for supplier optimization and cost reduction.",
    highlights: [
      "MySQL & Tableau data analysis",
      "Supplier negotiation & cost savings",
      "Sales & inventory trend optimization",
      "Cross-functional process improvements",
    ],
    tags: ["MySQL", "Tableau", "Data Analysis", "Procurement"],
    sort_order: 40,
  },
  {
    title: "SAP SRM / Vendor Master Data Analyst",
    category: "Master Data Management",
    company: "IFF",
    location: "Hyderabad, India",
    period: "May 2020 – Feb 2021",
    logo_src: "/logos/iff.webp",
    logo_bg: "#1a1a1a",
    description:
      "Created and maintained vendor master records in SAP SRM/S/4HANA, performing validation and cleansing to reduce data inconsistencies.",
    highlights: [
      "Vendor master in SAP SRM/S/4HANA",
      "Data validation & cleansing",
      "Procurement leadership reporting",
      "SOP documentation & knowledge transfer",
    ],
    tags: ["SAP SRM", "Vendor Master", "Procurement"],
    sort_order: 50,
  },
  {
    title: "IT Procurement Associate",
    category: "Procurement & Sourcing",
    company: "SAAS IT",
    location: "Chennai, India",
    period: "Mar 2019 – Apr 2020",
    logo_src: "/logos/saasit.png",
    logo_bg: "#1a1a1a",
    description:
      "Managed procurement using SAP S/4HANA and SAP Ariba, achieving ~10% cost savings through data-driven vendor negotiations.",
    highlights: [
      "SAP S/4HANA & Ariba procurement",
      "~10% cost savings via negotiations",
      "RFI/RFQ analysis & recommendations",
      "Cross-training & knowledge sharing",
    ],
    tags: ["SAP Ariba", "Procurement", "RFQ/RFI"],
    sort_order: 60,
  },
];

const PROJECTS = [
  {
    title: "WealthClaude",
    subtitle: "AI Finance Tracking Platform",
    number: "01",
    description:
      "Full portfolio tracker with 3D globe across 51 markets, AI market intelligence, dividend analytics, 15+ calculators, and 7-layer security.",
    link: "https://www.wealthclaude.com",
    tags: ["Next.js", "Supabase", "Three.js", "Stripe", "Groq AI"],
    gradient: "from-[#22c55e] to-[#16a34a]",
    preview: "/previews/wealthclaude.png",
    sort_order: 10,
  },
  {
    title: "North Falmouth Pharmacy",
    subtitle: "LTC Pharmacy · Cape Cod",
    number: "02",
    description:
      "Long-term care pharmacy website serving Cape Cod facilities — eMAR integration, compliance packaging, immunizations, enrollment forms.",
    link: "https://www.nfpltc.com",
    tags: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
    gradient: "from-[#f59e0b] to-[#ea580c]",
    preview: "/previews/nfpltc.png",
    sort_order: 20,
  },
  {
    title: "Auburn RX Pharmacy",
    subtitle: "Independent Retail Pharmacy",
    number: "03",
    description:
      "Modern pharmacy website featuring online refill requests, immunization booking, prescription transfer, and local healthcare resources.",
    link: "https://auburnrx.vercel.app",
    tags: ["Next.js", "TypeScript", "Tailwind CSS", "Vercel"],
    gradient: "from-[#0ea5e9] to-[#0284c7]",
    preview: "/previews/auburnrx.png",
    sort_order: 30,
  },
  {
    title: "Saint Francis Medical",
    subtitle: "Healthcare & Medical Practice",
    number: "04",
    description:
      "Patient-focused medical practice website with appointment booking, services overview, provider profiles, and HIPAA-conscious contact forms.",
    link: "https://saint-francis-medical.vercel.app",
    tags: ["Next.js", "React", "Tailwind CSS", "Vercel"],
    gradient: "from-[#8b5cf6] to-[#6d28d9]",
    preview: "/previews/saint-francis.png",
    sort_order: 40,
  },
  {
    title: "Lucy AI",
    subtitle: "Autonomous AI Agent",
    number: "05",
    description:
      "An autonomous agent handling 50+ tasks: Gmail, Calendar, social media, job applications, writes & deploys her own code, daily briefings.",
    link: "https://www.lucyaiagent.com",
    tags: ["Python", "Claude AI", "Next.js", "Supabase", "Vercel"],
    gradient: "from-[#ff6b00] to-[#ff3d00]",
    preview: "/previews/lucyaiagent.png",
    sort_order: 50,
  },
];

async function seed(table, rows) {
  const { data: existing, error: readErr } = await sb
    .from(table)
    .select("title");
  if (readErr) {
    console.error(`  ✗ Could not read ${table}: ${readErr.message}`);
    return;
  }
  const existingTitles = new Set((existing ?? []).map((r) => r.title));

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!force && existingTitles.has(row.title)) {
      console.log(`  · skipped (already exists): ${row.title}`);
      skipped++;
      continue;
    }
    const { error } = await sb.from(table).insert(row);
    if (error) {
      console.error(`  ✗ insert failed for ${row.title}: ${error.message}`);
    } else {
      console.log(`  ✓ inserted: ${row.title}`);
      inserted++;
    }
  }
  console.log(`  → ${inserted} inserted, ${skipped} skipped\n`);
}

console.log("Seeding jobs…");
await seed("jobs", JOBS);

console.log("Seeding projects…");
await seed("projects", PROJECTS);

console.log("Done.");
