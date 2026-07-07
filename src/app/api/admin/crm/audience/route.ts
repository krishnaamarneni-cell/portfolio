import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { listContactsFiltered, type ContactType } from "@/lib/contacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type AudienceRules = {
  include_tags?: string[];
  exclude_tags?: string[];
  include_types?: ContactType[];
  exclude_types?: ContactType[];
  include_companies?: string[];
  exclude_companies?: string[];
  exclude_domains?: string[];
  min_match_pct?: number;
  active_within_days?: number;
  only_inbound?: boolean;
};

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = requireSupabaseAdmin();
  const { data: audiences } = await supabase
    .from("crm_audience_rules")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: exclusions } = await supabase
    .from("crm_outreach_exclusions")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    audiences: audiences ?? [],
    exclusions: exclusions ?? [],
  });
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = requireSupabaseAdmin();
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (body.action === "evaluate") {
    const rules = body.rules as AudienceRules;
    const contacts = await evaluateAudience(rules);
    return NextResponse.json({ contacts, count: contacts.length });
  }

  if (body.action === "save-audience") {
    const { data, error } = await supabase
      .from("crm_audience_rules")
      .insert({
        name: body.name as string,
        description: body.description as string | undefined,
        rules: body.rules as Record<string, unknown>,
        contact_count: typeof body.contact_count === "number" ? body.contact_count : 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ audience: data });
  }

  if (body.action === "add-exclusion") {
    await supabase.from("crm_outreach_exclusions").insert({
      exclusion_type: body.exclusion_type as string,
      exclusion_value: body.exclusion_value as string,
      reason: (body.reason as string) || null,
      is_permanent: body.is_permanent !== false,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove-exclusion" && typeof body.id === "string") {
    await supabase
      .from("crm_outreach_exclusions")
      .update({ active: false })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete-audience" && typeof body.id === "string") {
    await supabase.from("crm_audience_rules").delete().eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function evaluateAudience(rules: AudienceRules) {
  let contacts = await listContactsFiltered({
    excludeDNC: true,
    excludeBulk: true,
  });

  if (rules.include_types?.length) {
    contacts = contacts.filter((c) =>
      rules.include_types!.includes(c.contact_type as ContactType)
    );
  }
  if (rules.exclude_types?.length) {
    contacts = contacts.filter(
      (c) => !rules.exclude_types!.includes(c.contact_type as ContactType)
    );
  }
  if (rules.include_tags?.length) {
    contacts = contacts.filter((c) =>
      rules.include_tags!.some((t) => c.tags?.includes(t))
    );
  }
  if (rules.exclude_tags?.length) {
    contacts = contacts.filter(
      (c) => !rules.exclude_tags!.some((t) => c.tags?.includes(t))
    );
  }
  if (rules.min_match_pct) {
    contacts = contacts.filter(
      (c) => (c.match_pct ?? 0) >= rules.min_match_pct!
    );
  }
  if (rules.active_within_days) {
    const cutoff = new Date(
      Date.now() - rules.active_within_days * 86400000
    ).toISOString();
    contacts = contacts.filter(
      (c) => c.last_gmail_activity_at && c.last_gmail_activity_at >= cutoff
    );
  }

  const supabase = requireSupabaseAdmin();
  const { data: exclusions } = await supabase
    .from("crm_outreach_exclusions")
    .select("exclusion_type, exclusion_value")
    .eq("active", true);

  if (exclusions?.length) {
    const excCompanies = new Set(
      exclusions
        .filter((e) => e.exclusion_type === "company")
        .map((e) => e.exclusion_value.toLowerCase())
    );
    const excDomains = new Set(
      exclusions
        .filter((e) => e.exclusion_type === "domain")
        .map((e) => e.exclusion_value.toLowerCase())
    );
    const excEmails = new Set(
      exclusions
        .filter((e) => e.exclusion_type === "email")
        .map((e) => e.exclusion_value.toLowerCase())
    );

    contacts = contacts.filter((c) => {
      if (excEmails.has(c.email.toLowerCase())) return false;
      const domain = c.email.split("@")[1]?.toLowerCase();
      if (domain && excDomains.has(domain)) return false;
      if (c.company && excCompanies.has(c.company.toLowerCase())) return false;
      return true;
    });
  }

  if (rules.exclude_companies?.length) {
    const excSet = new Set(rules.exclude_companies.map((c) => c.toLowerCase()));
    contacts = contacts.filter(
      (c) => !c.company || !excSet.has(c.company.toLowerCase())
    );
  }
  if (rules.exclude_domains?.length) {
    const excSet = new Set(rules.exclude_domains.map((d) => d.toLowerCase()));
    contacts = contacts.filter((c) => {
      const domain = c.email.split("@")[1]?.toLowerCase();
      return !domain || !excSet.has(domain);
    });
  }

  return contacts;
}
