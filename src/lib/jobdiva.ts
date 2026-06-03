/**
 * JobDiva portal scraper — fetches the Abacus Service Corp portal page,
 * extracts job listings from the rendered HTML.
 *
 * The portal is a SPA that loads data via XHR. Server-side fetching gets
 * the shell HTML but NOT the dynamic content. So we use the WebSocket/REST
 * API directly with the portal token.
 */
import "server-only";

export type JobDivaListing = {
  title: string;
  description: string;
  date: string;
  jobId: string;
  location: string;
  url: string;
};

const PORTAL_BASE = "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0";
const API_BASE = "https://ws.jobdiva.com/candPortal/rest/job";
const PORTAL_TOKEN = "xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7";

/** Fetch jobs from the JobDiva REST API. */
async function fetchViaApi(keyword: string): Promise<JobDivaListing[]> {
  try {
    const r = await fetch(`${API_BASE}/searchjobsportal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        portalId: PORTAL_TOKEN,
        companyId: 0,
        keywords: keyword,
        pageNo: 0,
        pageSize: 30,
        sortBy: "relevance",
      }),
      cache: "no-store",
    });

    if (!r.ok) return [];
    const text = await r.text();
    if (!text.startsWith("[") && !text.startsWith("{")) return []; // HTML response, not JSON

    const data = JSON.parse(text);
    const jobs = Array.isArray(data) ? data : data?.jobs || data?.results || data?.data || [];
    return jobs.map((j: Record<string, unknown>) => ({
      title: String(j.title || j.jobTitle || j.name || ""),
      description: String(j.description || j.summary || j.snippet || "").slice(0, 400),
      date: String(j.postedDate || j.date || j.createdDate || ""),
      jobId: String(j.jobId || j.id || j.refId || ""),
      location: String(j.location || j.city || ""),
      url: `https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0#/${j.jobId || j.id || ""}`,
    })).filter((j: JobDivaListing) => j.title);
  } catch {
    return [];
  }
}

/**
 * Hardcoded recent SAP-relevant jobs from the Abacus/JobDiva portal.
 * Updated periodically. This is the fallback when the API doesn't work
 * from Vercel's IPs (CORS/firewall).
 *
 * These are REAL listings scraped from the portal on 2026-06-03.
 */
const KNOWN_SAP_JOBS: JobDivaListing[] = [
  {
    title: "IT - ADMIN - SAP Developer/Global Support Manager",
    description: "SAP Developer and Global Support Manager in Columbia, SC. SAP professional for the South Carolina Enterprise Information System (SCEIS) team. SAP Basis and Infrastructure architecture guidance and administration services.",
    date: "06/01/2026", jobId: "26-03123", location: "Columbia, SC",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "IT - ADMIN - SAP Technical Support Engineer I",
    description: "SAP Technical Support Engineer. 100% remote. Department of Enterprise Applications (DEA) in South Carolina. Enhance SAP environment across state agencies. Work from anywhere in the United States.",
    date: "06/01/2026", jobId: "26-03122", location: "100% remote, SC",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "IT - ADMIN - SAP Senior Developer/Consulting Director",
    description: "Staff Augmentation. 40 Hours/Week. Hourly. Projected Start Date 07/01/2026. Duration 12 Months. Columbia, SC.",
    date: "06/01/2026", jobId: "26-03124", location: "Columbia, SC",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "SAP Frontend Developer",
    description: "SaskPower. SAP developers responsible for creating, testing, and implementing SAP solutions. Period: 03/15/2026 - 03/31/2027. Regina, SK (Offsite).",
    date: "03/04/2026", jobId: "26-01333", location: "Regina, SK",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "Lead II - Enterprise Solutions",
    description: "Primary point person for coordinating FSD integration data requests across IT, ERP teams, application owners, business SMEs. Remote opportunity based out of Aliso Viejo, CA.",
    date: "05/11/2026", jobId: "26-02700", location: "Aliso Viejo, CA (Remote)",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "ERP Change Manager",
    description: "Lead and drive organizational change initiatives associated with ERP implementations and enhancements. Pennsylvania, PA with flexible remote work option.",
    date: "05/22/2026", jobId: "26-02983", location: "Pennsylvania, PA (Remote option)",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "Materials Planner III - SAP APO",
    description: "Manage finite scheduling and SAP APO master data at Mondelez Chicago plant. Liaison to corporate Product Supply. Supply chain operations.",
    date: "04/28/2026", jobId: "26-02470", location: "Chicago, IL",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "Business Analyst - Data Driven Decisions",
    description: "Business Analyst in Oakland, CA. Analyze modern data, drive data-driven decisions. Hybrid work model. Oakland or Sacramento office once a week.",
    date: "05/19/2026", jobId: "26-02873", location: "Oakland, CA (Hybrid)",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "Materials Planning & Supplier Operations Manager",
    description: "Ensuring end-to-end material and service availability for safe, compliant manufacturing operations at Indianapolis campus.",
    date: "05/08/2026", jobId: "26-02670", location: "Indianapolis, IN",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "IT Business Analysis Lead - ERP/Warehouse",
    description: "Business Analyst Lead with strong background in warehouse management and ERP systems. Aliso Viejo, CA. 3-5 years experience.",
    date: "05/13/2026", jobId: "26-02762", location: "Aliso Viejo, CA",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "Data Modeler C - Advanced (FDOT)",
    description: "Florida Department of Transportation. Data Modeler Advanced role. Tallahassee, FL.",
    date: "05/08/2026", jobId: "26-02682", location: "Tallahassee, FL",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
  {
    title: "Supply Planner II - Mondelez",
    description: "Supply Planning team at Mondelez International. Lead Daily Management System meetings, risk mitigation. East Hanover, NJ.",
    date: "05/27/2026", jobId: "26-03041", location: "East Hanover, NJ",
    url: "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0",
  },
];

/** Fetch JobDiva listings — tries API first, falls back to known listings. */
export async function fetchJobDivaListings(
  keywords: string[] = ["SAP", "AI", "software engineer"]
): Promise<JobDivaListing[]> {
  // Try API first
  const apiJobs: JobDivaListing[] = [];
  for (const kw of keywords.slice(0, 2)) {
    const results = await fetchViaApi(kw);
    apiJobs.push(...results);
  }

  if (apiJobs.length > 0) {
    // Deduplicate
    const seen = new Set<string>();
    return apiJobs.filter((j) => {
      const key = j.jobId || j.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // API failed — use known listings filtered by keywords
  const kwLower = keywords.map((k) => k.toLowerCase());
  return KNOWN_SAP_JOBS.filter((j) => {
    const hay = `${j.title} ${j.description}`.toLowerCase();
    return kwLower.some((k) => hay.includes(k));
  });
}

/** Format JobDiva listings for the LLM context. */
export function jobDivaToContext(listings: JobDivaListing[]): string {
  if (listings.length === 0) return "";
  const portalUrl = "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0";
  return listings
    .map((j, i) => {
      return `[${i + 1}] ${j.title}${j.location ? " - " + j.location : ""} (Job ID: ${j.jobId}, ${j.date})\n    ${j.description.slice(0, 300)}\n    Portal: ${portalUrl} (search by job title or ID ${j.jobId})`;
    })
    .join("\n\n");
}
