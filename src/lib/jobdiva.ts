/**
 * JobDiva portal scraper — fetches job listings from the Abacus Service Corp
 * portal and returns structured data for the Jobs Scout to match against.
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

const PORTAL_URL = "https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0";

/** Fetch and parse job listings from the JobDiva portal.
 *  Searches with the given keywords to filter relevant jobs. */
export async function fetchJobDivaListings(
  keywords: string[] = ["SAP", "AI", "software engineer", "analyst"]
): Promise<JobDivaListing[]> {
  const all: JobDivaListing[] = [];

  for (const kw of keywords.slice(0, 3)) {
    try {
      // JobDiva portal is a SPA — but the search results load via XHR.
      // We fetch the page with a search query embedded in the hash.
      const searchUrl = `${PORTAL_URL}#/jobs?keyword=${encodeURIComponent(kw)}`;

      // Since it's a SPA, we can't scrape the HTML directly.
      // Instead, try the REST API endpoint discovered from network inspection.
      const apiUrl = "https://ws.jobdiva.com/candPortal/rest/job/searchjobsportal";
      const r = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Origin": "https://www1.jobdiva.com",
          "Referer": "https://www1.jobdiva.com/",
        },
        body: JSON.stringify({
          portalId: "xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7",
          companyId: 0,
          keywords: kw,
          pageNo: 0,
          pageSize: 30,
          sortBy: "relevance",
        }),
        cache: "no-store",
      });

      if (r.ok) {
        const contentType = r.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = await r.json();
          // Parse the API response — structure may vary
          const jobs = Array.isArray(data) ? data : data?.jobs || data?.results || [];
          for (const j of jobs) {
            all.push({
              title: j.title || j.jobTitle || j.name || "",
              description: j.description || j.summary || j.snippet || "",
              date: j.postedDate || j.date || j.createdDate || "",
              jobId: j.jobId || j.id || j.refId || "",
              location: j.location || j.city || "",
              url: j.url || `${PORTAL_URL}#/job/${j.jobId || j.id || ""}`,
            });
          }
          continue;
        }
      }

      // API didn't work — fallback to scraping the HTML page
      // Use a simple keyword search URL
      const htmlUrl = `https://www1.jobdiva.com/portal/?a=xxjdnwqdu3m8bnvye2snjqpwe7p08z0159aciy1qq0tk3bbaekq4rat1kf6pd5k7&compid=0&keyword=${encodeURIComponent(kw)}`;
      const hr = await fetch(htmlUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cache: "no-store",
      });
      if (!hr.ok) continue;
      const html = await hr.text();

      // Extract job data from inline JSON or script tags
      const jsonMatch = html.match(/var\s+jobs\s*=\s*(\[[\s\S]*?\]);/);
      if (jsonMatch) {
        try {
          const jobs = JSON.parse(jsonMatch[1]);
          for (const j of jobs) {
            all.push({
              title: j.title || "",
              description: j.description || "",
              date: j.postedDate || "",
              jobId: String(j.id || ""),
              location: j.location || "",
              url: `${PORTAL_URL}#/job/${j.id || ""}`,
            });
          }
        } catch {}
      }
    } catch {
      // Network error for this keyword — continue with next
    }
  }

  // Deduplicate by jobId
  const seen = new Set<string>();
  return all.filter((j) => {
    if (!j.title) return false;
    const key = j.jobId || j.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Format JobDiva listings for the LLM context (same format as search results). */
export function jobDivaToContext(listings: JobDivaListing[]): string {
  if (listings.length === 0) return "";
  return listings
    .map((j, i) => {
      return `[${i + 1}] ${j.title}${j.location ? ` - ${j.location}` : ""}${j.date ? ` (${j.date})` : ""}\n    ${j.description.slice(0, 300)}\n    ${j.url}`;
    })
    .join("\n\n");
}
