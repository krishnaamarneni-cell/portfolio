import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron-triggered agent runner. Called by GitHub Actions on a schedule.
 *
 * Auth: CRON_SECRET (same as morning briefing).
 * Agents to run: news, jobs (broad-market, both profiles), screener (risk 5),
 *   inbox (3 days). Each runs independently — one failure doesn't block others.
 *
 * Results are stored in Supabase (contacts) and sent via briefing; no need to
 * return them here. This endpoint just triggers the runs.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret") || "";
    if (auth !== `Bearer ${expected}` && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  // We can't call the admin APIs directly (they need session auth).
  // Instead, run the agent logic inline using the same functions.
  const results: Record<string, string> = {};

  // News scout
  try {
    const { runAgent } = await import("@/lib/agents");
    const { fetchHoldingSymbols } = await import("@/lib/agents");
    const { search, searchResultsToContext, whichSearchProvider } = await import("@/lib/search");
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not set");

    // Quick news scan
    const { symbols } = await fetchHoldingSymbols();
    const tickersClause = symbols.length > 0 ? symbols.slice(0, 5).join(" OR ") : "S&P 500";
    const queries = [`${tickersClause} stock news today`, "AI tools released this week"];
    if (whichSearchProvider()) {
      const searchResults = await Promise.all(
        queries.map((q) => search({ query: q, maxResults: 4 }).catch(() => ({ query: q, hits: [] as Array<{title: string; url: string; snippet: string}> })))
      );
      results.news = `searched ${searchResults.reduce((n, r) => n + r.hits.length, 0)} hits`;
    } else {
      results.news = "no search provider";
    }
  } catch (err) {
    results.news = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  // Inbox scan (extracts contacts)
  try {
    const { listRecentMessages } = await import("@/lib/gmail");
    const { messages, error } = await listRecentMessages({
      query: "newer_than:1d",
      maxResults: 20,
    });
    if (error) {
      results.inbox = `gmail: ${error}`;
    } else {
      results.inbox = `${messages.length} emails scanned`;

      // Extract recruiter contacts from job-related emails
      if (messages.length > 0) {
        const jobEmails = messages.filter((m) => {
          const text = `${m.subject ?? ""} ${m.snippet ?? ""}`.toLowerCase();
          return /job|hiring|opportunity|role|position|engineer|consultant|recruiter/.test(text);
        });
        if (jobEmails.length > 0) {
          try {
            const { upsertMany } = await import("@/lib/contacts");
            const contacts = jobEmails
              .filter((m) => m.from && m.from.includes("@"))
              .map((m) => {
                const fromMatch = m.from?.match(/^(.+?)\s*<(.+?)>/) || [null, m.from, m.from];
                return {
                  name: (fromMatch[1] || "").replace(/"/g, "").trim(),
                  email: (fromMatch[2] || m.from || "").trim(),
                  company: null,
                  role_pitched: m.subject || null,
                  source: "cron-inbox",
                };
              })
              .filter((c) => c.email.includes("@"));
            const saved = await upsertMany(contacts);
            results.contacts = `${saved} contacts saved from ${jobEmails.length} job emails`;
          } catch (err) {
            results.contacts = `error: ${err instanceof Error ? err.message : "unknown"}`;
          }
        }
      }
    }
  } catch (err) {
    results.inbox = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  // Auto-reply pipeline — send personalized replies to >70% matches with resume attached.
  try {
    const { runAutoReplyPipeline } = await import("@/lib/auto-reply");
    const autoReply = await runAutoReplyPipeline();
    results.autoReply = `scanned ${autoReply.scanned}, ${autoReply.jobEmails} job emails, ${autoReply.matched} matched, ${autoReply.sent} sent, ${autoReply.skippedDuplicate} skipped (already replied)`;
    if (autoReply.errors.length > 0) {
      results.autoReplyErrors = autoReply.errors.join("; ");
    }
  } catch (err) {
    results.autoReply = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  // Bulk-email response tracking — who replied, which addresses are dead.
  try {
    const { scanBulkResponses } = await import("@/lib/email-tracking");
    const scan = await scanBulkResponses();
    results.emailTracking = scan.error
      ? `error: ${scan.error}`
      : `checked ${scan.checked}, ${scan.newReplies} new replies, ${scan.newBounces} dead addresses`;
  } catch (err) {
    results.emailTracking = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    results,
  });
}
