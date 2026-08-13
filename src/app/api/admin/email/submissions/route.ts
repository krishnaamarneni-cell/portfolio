import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("rtr_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ submissions: [], tableNeeded: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ submissions: data ?? [] });
}

type SubmissionBody = {
  action?: "create" | "update" | "delete" | "extract";
  id?: string;
  thread_id?: string;
  recruiter_email?: string;
  recruiter_name?: string;
  staffing_company?: string;
  client_company?: string;
  job_title?: string;
  location?: string;
  rate?: string;
  employment_type?: string;
  status?: string;
  notes?: string;
  submitted_at?: string;
  followed_up_at?: string;
  contact_id?: string;
  subject?: string;
  snippet?: string;
  body?: string;
};

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as SubmissionBody;

  if ((body as Record<string, unknown>).action === "scan-rtr") {
    const { listRecentMessages, getThread } = await import("@/lib/gmail");
    const db = requireSupabaseAdmin();
    const days = typeof (body as Record<string, unknown>).days === "number" ? (body as Record<string, unknown>).days as number : 180;
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);
    const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
    const q = `after:${afterStr} {rtr OR "right to represent" OR "authorize us to represent" OR "rate confirmation" OR "confirm your rate"}`;

    const { messages, error: listErr } = await listRecentMessages({ query: q, maxResults: 300 });
    if (listErr) return NextResponse.json({ error: listErr }, { status: 500 });

    const seen = new Set<string>();
    const uniqueThreadIds: string[] = [];
    for (const m of messages ?? []) {
      if (!seen.has(m.threadId)) { seen.add(m.threadId); uniqueThreadIds.push(m.threadId); }
    }

    const { data: existing } = await db.from("rtr_submissions").select("thread_id");
    const tracked = new Set((existing ?? []).map((r: { thread_id: string | null }) => r.thread_id).filter(Boolean));

    const SELF = ["krishnaamarneni", "avgk26", "krishna.amarneni", "jobs@krishnaamarneni"];
    const isSelfAddr = (addr?: string) => addr ? SELF.some((h) => addr.toLowerCase().includes(h)) : false;

    let created = 0;
    let skipped = 0;

    for (const tid of uniqueThreadIds.slice(0, 50)) {
      if (tracked.has(tid)) { skipped++; continue; }
      try {
        const thread = await getThread(tid);
        if (!thread) continue;
        const recruiterMsg = thread.messages.find((m: { from: string }) => !isSelfAddr(m.from)) || thread.messages[0];
        if (!recruiterMsg) continue;

        const recruiterEmail = recruiterMsg.from.match(/<([^>]+)>/)?.[1] || recruiterMsg.from.split("<")[0].trim();
        const recruiterName = recruiterMsg.from.split("<")[0].replace(/"/g, "").trim() || null;

        let extracted: Record<string, string | null> = {};
        const apiKey = process.env.GROQ_API_KEY;
        const text = [
          `Subject: ${thread.subject || ""}`,
          `Snippet: ${recruiterMsg.snippet || ""}`,
          recruiterMsg.bodyText ? `Body: ${recruiterMsg.bodyText.slice(0, 1500)}` : "",
        ].filter(Boolean).join("\n");

        if (apiKey) {
          try {
            const { runAgent } = await import("@/lib/agents");
            const result = await runAgent({
              apiKey,
              model: "llama-3.3-70b-versatile",
              systemPrompt: `Extract RTR (Right-to-Represent) submission details from this recruiter email. Output ONLY valid JSON with these fields:
- recruiter_name: the recruiter's name
- staffing_company: the staffing/consulting company
- client_company: the end client company
- job_title: the job role/title
- location: city, state
- rate: pay rate (e.g. "$43/hr")
- employment_type: W2, C2C, or 1099
If a field is not found, use null. Output ONLY JSON, nothing else.`,
              userPrompt: text,
              maxTokens: 300,
            });
            const cleaned = (result.content || "{}").replace(/```json\s*|\s*```/g, "").trim();
            extracted = JSON.parse(cleaned);
          } catch {
            extracted = extractFallback({ subject: thread.subject, snippet: recruiterMsg.snippet, body: recruiterMsg.bodyText });
          }
        } else {
          extracted = extractFallback({ subject: thread.subject, snippet: recruiterMsg.snippet, body: recruiterMsg.bodyText });
        }

        await db.from("rtr_submissions").insert({
          thread_id: tid,
          recruiter_email: recruiterEmail,
          recruiter_name: extracted.recruiter_name || recruiterName,
          staffing_company: extracted.staffing_company || null,
          client_company: extracted.client_company || null,
          job_title: extracted.job_title || thread.subject.replace(/^(re|fwd|rtr)[:\s]*/i, "").trim(),
          location: extracted.location || null,
          rate: extracted.rate || null,
          employment_type: extracted.employment_type || null,
          status: "submitted",
          submitted_at: recruiterMsg.date || new Date().toISOString(),
        });
        created++;
      } catch { /* skip bad threads */ }
    }

    return NextResponse.json({ ok: true, scanned: uniqueThreadIds.length, created, skipped });
  }

  if (body.action === "extract") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(extractFallback(body));
    }
    try {
      const { runAgent } = await import("@/lib/agents");
      const text = [
        body.subject ? `Subject: ${body.subject}` : "",
        body.snippet ? `Snippet: ${body.snippet}` : "",
        body.body ? `Body: ${body.body.slice(0, 1500)}` : "",
      ].filter(Boolean).join("\n");

      const result = await runAgent({
        apiKey,
        model: "llama-3.3-70b-versatile",
        systemPrompt: `Extract RTR (Right-to-Represent) submission details from this recruiter email. Output ONLY valid JSON with these fields:
- recruiter_name: the recruiter's name
- staffing_company: the staffing/consulting company
- client_company: the end client company
- job_title: the job role/title
- location: city, state
- rate: pay rate (e.g. "$43/hr")
- employment_type: W2, C2C, or 1099
If a field is not found, use null. Output ONLY JSON, nothing else.`,
        userPrompt: text,
        maxTokens: 300,
      });
      try {
        const cleaned = (result.content || "{}").replace(/```json\s*|\s*```/g, "").trim();
        return NextResponse.json(JSON.parse(cleaned));
      } catch {
        return NextResponse.json(extractFallback(body));
      }
    } catch {
      return NextResponse.json(extractFallback(body));
    }
  }

  const db = requireSupabaseAdmin();

  if (body.action === "delete" && body.id) {
    const { error } = await db.from("rtr_submissions").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update" && body.id) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      "recruiter_email", "recruiter_name", "staffing_company",
      "client_company", "job_title", "location", "rate",
      "employment_type", "status", "notes", "followed_up_at", "contact_id",
    ] as const) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const { data, error } = await db
      .from("rtr_submissions")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, submission: data });
  }

  if (!body.recruiter_email)
    return NextResponse.json({ error: "recruiter_email required" }, { status: 400 });

  const { data, error } = await db
    .from("rtr_submissions")
    .insert({
      thread_id: body.thread_id || null,
      recruiter_email: body.recruiter_email,
      recruiter_name: body.recruiter_name || null,
      staffing_company: body.staffing_company || null,
      client_company: body.client_company || null,
      job_title: body.job_title || null,
      location: body.location || null,
      rate: body.rate || null,
      employment_type: body.employment_type || null,
      status: body.status || "submitted",
      notes: body.notes || null,
      submitted_at: body.submitted_at || new Date().toISOString(),
      contact_id: body.contact_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, submission: data });
}

function extractFallback(body: SubmissionBody) {
  const text = `${body.subject || ""} ${body.snippet || ""} ${body.body || ""}`;
  const rateMatch = text.match(/\$[\d,.]+\s*(?:\/?\s*(?:hr|hour|h)\b|on\s+w2)/i);
  const w2Match = text.match(/\b(W2|C2C|1099|Corp.to.Corp)\b/i);
  return {
    recruiter_name: null,
    staffing_company: null,
    client_company: null,
    job_title: null,
    location: null,
    rate: rateMatch?.[0] || null,
    employment_type: w2Match?.[1]?.toUpperCase() || null,
  };
}
