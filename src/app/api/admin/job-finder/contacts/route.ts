import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Who in the CRM could help with a given job.
 *
 * Two kinds of help, ranked separately because they are not the same thing:
 *
 *  - INSIDE: someone at the hiring company. Rare, and the strongest lead —
 *    worth asking for the hiring manager or a referral.
 *  - AGENCY: a staffing recruiter who has pitched this kind of role before.
 *    This is most of the CRM in practice, and for contract work it is the
 *    normal route in — they submit candidates to exactly these requirements.
 *
 * Matching is word-boundary only. Substring matching claimed "Intellectt Inc"
 * and "Intelliswift" were contacts at Intel, which would have produced
 * confident, wrong suggestions.
 */

/** Corporate suffixes that carry no identity — dropped before comparing. */
const NOISE = /\b(inc|llc|ltd|limited|corp|corporation|co|company|group|holdings|technologies|technology|systems|solutions|services|consulting|software|labs|international|global|usa|us|the)\b/gi;

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
}

/** Do two company names refer to the same employer? */
function sameCompany(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // Whole-token containment only: "coca cola" vs "the coca-cola company" is a
  // match, "intellectt" vs "intel" is not.
  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const shorter = ta.length <= tb.length ? ta : tb;
  const longer = ta.length <= tb.length ? tb : ta;
  return shorter.every((tok) => longer.includes(tok));
}

/** An email domain that belongs to the employer is the strongest signal. */
function domainMatches(email: string, company: string): boolean {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (!domain) return false;
  const host = domain.split(".")[0];
  if (!host || host.length < 4) return false;
  const generic = ["gmail", "yahoo", "hotmail", "outlook", "aol", "icloud", "protonmail", "live", "msn"];
  if (generic.includes(host)) return false;
  return sameCompany(host, company);
}

type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  role_pitched: string | null;
  linkedin_url: string | null;
  starred: boolean;
  do_not_contact: boolean;
  emailed_at: string | null;
};

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const company = (sp.get("company") ?? "").trim();
  const title = (sp.get("title") ?? "").trim();
  if (!company && !title) {
    return NextResponse.json({ error: "company or title is required" }, { status: 400 });
  }

  try {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from("recruiter_contacts")
      .select("id,name,email,company,title,role_pitched,linkedin_url,starred,do_not_contact,emailed_at")
      .limit(2000);

    if (error) {
      const missing = /does not exist|schema cache|relation/i.test(error.message);
      return NextResponse.json({
        inside: [],
        agency: [],
        error: missing ? "recruiter_contacts table not found." : error.message,
      });
    }

    const all = (data ?? []) as Contact[];
    const inside: Contact[] = [];
    const agency: Array<Contact & { why: string }> = [];

    // Role words worth matching a past pitch against — skip filler.
    const titleWords = title
      .toLowerCase()
      .split(/[^a-z0-9/]+/)
      .filter((w) => w.length > 2 && !/^(the|and|for|with|senior|sr|jr|lead|of|to|in|at)$/.test(w));

    for (const c of all) {
      if (c.do_not_contact) continue;

      if (company && ((c.company && sameCompany(c.company, company)) || domainMatches(c.email, company))) {
        inside.push(c);
        continue;
      }

      // Otherwise: has this recruiter pitched something like this before?
      const pitched = (c.role_pitched ?? "").toLowerCase();
      if (!pitched || !titleWords.length) continue;
      const hits = titleWords.filter((w) => pitched.includes(w));
      if (hits.length >= 2 || (hits.length === 1 && hits[0].length > 4)) {
        agency.push({ ...c, why: `previously pitched: ${c.role_pitched}` });
      }
    }

    // Starred first, then never-contacted, so the list favours warm and unused.
    const rank = (a: Contact, b: Contact) =>
      Number(b.starred) - Number(a.starred) ||
      Number(!a.emailed_at) - Number(!b.emailed_at);

    return NextResponse.json({
      inside: inside.sort(rank).slice(0, 10),
      agency: agency.sort(rank).slice(0, 8),
      scanned: all.length,
    });
  } catch (err) {
    return NextResponse.json(
      { inside: [], agency: [], error: err instanceof Error ? err.message : "Failed to load" },
      { status: 500 }
    );
  }
}
