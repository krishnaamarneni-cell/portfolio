import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("id");
  if (!companyId)
    return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const db = requireSupabaseAdmin();

    const [companyRes, contactsRes, threadsRes] = await Promise.all([
      db.from("crm_companies").select("*").eq("id", companyId).single(),
      db
        .from("recruiter_contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("starred", { ascending: false })
        .order("name"),
      db
        .from("crm_email_threads")
        .select("*")
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false })
        .limit(50),
    ]);

    if (companyRes.error) throw new Error(companyRes.error.message);
    if (contactsRes.error) throw new Error(`Contacts: ${contactsRes.error.message}`);
    if (threadsRes.error) throw new Error(`Threads: ${threadsRes.error.message}`);

    const contacts = contactsRes.data ?? [];
    const threads = threadsRes.data ?? [];

    // Debug: run a separate count to verify the query
    const { count: directCount } = await db
      .from("recruiter_contacts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    const emails = contacts.map((c: Record<string, unknown>) => c.email as string).filter(Boolean);

    return NextResponse.json({
      company: companyRes.data,
      contacts,
      threads,
      emails: [...new Set(emails)],
      _debug: {
        companyId,
        contactsReturned: contacts.length,
        directCount: directCount ?? 0,
        storedContactCount: companyRes.data?.contact_count ?? "N/A",
        contactsError: contactsRes.error?.message ?? null,
        threadsError: threadsRes.error?.message ?? null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load workspace" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "generate-summary" && typeof body.companyId === "string") {
    try {
      const db = requireSupabaseAdmin();
      const { data: threads } = await db
        .from("crm_email_threads")
        .select("subject, snippet, participants, direction, intent, cached_messages")
        .eq("company_id", body.companyId)
        .order("last_message_at", { ascending: false })
        .limit(10);

      if (!threads?.length) {
        return NextResponse.json({ summary: "No email threads found for this company." });
      }

      const { data: company } = await db
        .from("crm_companies")
        .select("name, domain")
        .eq("id", body.companyId)
        .single();

      const threadSummaries = threads.map((t: Record<string, unknown>) => {
        const msgs = t.cached_messages as Array<Record<string, unknown>> | null;
        const preview = msgs?.length
          ? msgs.slice(0, 2).map((m) => `From: ${m.from}\n${(m.bodyText as string || m.snippet as string || "").slice(0, 200)}`).join("\n---\n")
          : t.snippet || "";
        return `Subject: ${t.subject || "(no subject)"}\nDirection: ${t.direction}\nIntent: ${t.intent || "unknown"}\nParticipants: ${(t.participants as string[]).join(", ")}\n${preview}`;
      }).join("\n\n===\n\n");

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return NextResponse.json({ summary: "GROQ_API_KEY not set" });

      const { runAgent } = await import("@/lib/agents");
      const result = await runAgent({
        apiKey,
        model: "llama-3.3-70b-versatile",
        systemPrompt: `Analyze email conversations between Krishna Amarneni and a company. Produce a brief intelligence summary in markdown with these sections:
## Why They Contacted
One paragraph about the relationship and why this company reached out.
## Email Types
Bullet list of the kinds of emails exchanged (job opportunities, follow-ups, rejections, etc.)
## Key Contacts
Bullet list of people from this company who emailed, with their inferred role.
## Recommended Labels
Suggest 2-3 labels for this company (e.g. "active-recruiter", "past-employer", "vendor").
Be concise — max 200 words total.`,
        userPrompt: `Company: ${company?.name ?? "Unknown"} (${company?.domain ?? ""})\n\nEmail threads:\n${threadSummaries}`,
      });

      return NextResponse.json({ summary: result.content ?? "Could not generate summary." });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Summary failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
