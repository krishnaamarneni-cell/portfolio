import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { getJobFinderSettings } from "@/lib/job-finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Aggregates behind the Insights views.
 *
 * All three views read the same rows, so they are computed in one pass and one
 * request rather than three — the dataset is a few hundred postings, and
 * splitting it would cost more in round trips than it saves in payload.
 */

const US_STATES: Array<[string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
];

const NAME_TO_CODE = new Map(US_STATES.map(([code, name]) => [name.toLowerCase(), code]));
const CODES = new Set(US_STATES.map(([code]) => code));

/**
 * Which state is a posting in?
 *
 * Tokenised, not pattern-matched. Substring and boundary-regex approaches both
 * failed badly on real data: "US - Remote" scored as Missouri, "San Francisco,
 * CA" as Colorado (the "co" ending "Francisco"), and "Raritan, New Jersey" as
 * Arkansas. A wrong heatmap is worse than none, so a segment now has to BE a
 * state — equal to its name, or exactly its two-letter code in caps — rather
 * than merely contain one.
 */
function stateOf(location: string | null): string | null {
  if (!location) return null;
  for (const raw of location.split(/[,\-–/|]/)) {
    const token = raw.trim();
    if (!token) continue;
    const byName = NAME_TO_CODE.get(token.toLowerCase());
    if (byName) return byName;
    // Uppercase-only, so an ordinary lowercase word cannot pass as a code.
    if (token.length === 2 && CODES.has(token) && token === token.toUpperCase()) return token;
  }
  return null;
}

type Row = {
  company: string | null;
  location: string | null;
  title: string;
  required_skills: string[] | null;
  match_score: number | null;
  status: string;
  application_url: string;
  id: string;
};

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = requireSupabaseAdmin();
    const settings = await getJobFinderSettings();

    const { data, error } = await db
      .from("job_listings")
      .select("id,company,location,title,required_skills,match_score,status,application_url")
      .in("status", ["new", "saved"])
      .limit(5000);

    if (error) {
      const missing = /does not exist|schema cache|relation/i.test(error.message);
      return NextResponse.json({
        needsMigration: missing,
        error: missing ? "Run supabase/job_finder.sql in Supabase." : error.message,
      });
    }

    const rows = (data ?? []) as Row[];

    const states: Record<string, number> = {};
    const skills: Record<string, number> = {};
    const companies: Record<string, number> = {};
    let remote = 0;
    let unplaced = 0;

    // Skill → the roles and employers asking for it. Powers the opportunity map,
    // where clicking a skill should answer "who wants this, and for what".
    const bySkill: Record<string, { companies: Set<string>; jobs: Array<{ id: string; title: string; company: string | null; url: string; score: number | null }> }> = {};

    for (const r of rows) {
      if (r.company) companies[r.company] = (companies[r.company] || 0) + 1;

      const code = stateOf(r.location);
      if (code) states[code] = (states[code] || 0) + 1;
      else if (r.location && /remote|anywhere|virtual/i.test(r.location)) remote++;
      else unplaced++;

      for (const raw of r.required_skills ?? []) {
        const s = raw.trim();
        if (!s) continue;
        skills[s] = (skills[s] || 0) + 1;
        (bySkill[s] ??= { companies: new Set(), jobs: [] });
        if (r.company) bySkill[s].companies.add(r.company);
        if (bySkill[s].jobs.length < 25) {
          bySkill[s].jobs.push({
            id: r.id,
            title: r.title,
            company: r.company,
            url: r.application_url,
            score: r.match_score,
          });
        }
      }
    }

    const sorted = (o: Record<string, number>, n: number) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));

    // The opportunity map is anchored on the profile, not on the market: every
    // skill claimed in Settings appears, including the ones with zero openings.
    // A skill nobody is hiring for is a finding, and dropping it would hide that.
    const profileSkills = settings.profile.skills.map((skill) => {
      const key = Object.keys(bySkill).find((k) => k.toLowerCase() === skill.toLowerCase());
      const entry = key ? bySkill[key] : null;
      return {
        name: skill,
        count: entry?.jobs.length ?? 0,
        companies: entry ? [...entry.companies].slice(0, 12) : [],
        jobs: entry?.jobs.slice(0, 12) ?? [],
      };
    });

    return NextResponse.json({
      totals: {
        active: rows.length,
        placed: Object.values(states).reduce((a, b) => a + b, 0),
        remote,
        unplaced,
        statesLit: Object.keys(states).length,
      },
      states: US_STATES.map(([code, name]) => ({ code, name, count: states[code] ?? 0 })),
      topStates: Object.entries(states)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({
          code,
          name: US_STATES.find(([c]) => c === code)?.[1] ?? code,
          count,
        })),
      skills: sorted(skills, 40),
      companies: sorted(companies, 40),
      profileSkills,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 500 }
    );
  }
}
