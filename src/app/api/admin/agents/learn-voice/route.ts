import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecentMessages, getThread } from "@/lib/gmail";
import { runAgent } from "@/lib/agents";
import { requireSupabaseAdmin } from "@/lib/supabase";
import { sanitizeVoicePrompt } from "@/lib/voice-prompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const SELF_ADDRS = ["krishnaamarneni", "avgk26", "krishna.amarneni", "jobs@krishnaamarneni"];
const isSelf = (addr: string) => SELF_ADDRS.some((h) => addr.toLowerCase().includes(h));

const JOB_RX = /job|hiring|opportunity|role|position|engineer|consultant|recruiter|opening|interview|offer|career|vacancy|talent|resume|application/i;

export async function GET() {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = requireSupabaseAdmin();
  const { data } = await db
    .from("admin_settings")
    .select("voice_prompt, voice_prompt_updated_at")
    .eq("id", "singleton")
    .maybeSingle();

  return NextResponse.json({
    voicePrompt: data?.voice_prompt ?? null,
    updatedAt: data?.voice_prompt_updated_at ?? null,
  });
}

export async function POST(request: Request) {
  if (!(await getSession()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { days?: number };
  const days = Math.min(body.days ?? 180, 365);

  // Step 1: Fetch sent job-related emails
  const { messages, error: gmailErr } = await listRecentMessages({
    query: `in:sent newer_than:${days}d`,
    maxResults: 200,
  });
  if (gmailErr)
    return NextResponse.json({ error: gmailErr }, { status: 502 });

  const jobSent = (messages ?? []).filter((m) => {
    const text = `${m.subject ?? ""} ${m.snippet ?? ""} ${m.to ?? ""}`;
    return JOB_RX.test(text);
  });

  if (jobSent.length === 0)
    return NextResponse.json({
      error: "No sent job/recruiter emails found. Send some replies first, then try again.",
    }, { status: 404 });

  // Step 2: Fetch full thread bodies for unique threads (cap at 40)
  const seen = new Set<string>();
  const uniqueThreadIds: string[] = [];
  for (const m of jobSent) {
    if (!seen.has(m.threadId)) {
      seen.add(m.threadId);
      uniqueThreadIds.push(m.threadId);
    }
  }

  const replies: Array<{ to: string; subject: string; body: string }> = [];

  for (const tid of uniqueThreadIds.slice(0, 40)) {
    try {
      const thread = await getThread(tid);
      if (!thread) continue;

      // Find Krishna's replies (sent by self, not the first message in thread)
      for (const msg of thread.messages) {
        if (!isSelf(msg.from)) continue;
        const body = msg.bodyText.trim();
        if (!body || body.length < 30) continue;
        // Strip common signature/footer noise
        const cleaned = body
          .replace(/^(On .+ wrote:[\s\S]*)/m, "")
          .replace(/^(--.*)$/m, "")
          .replace(/^(Sent from .*)$/m, "")
          .trim();
        if (cleaned.length < 30) continue;

        replies.push({
          to: msg.to,
          subject: msg.subject || thread.subject,
          body: cleaned.slice(0, 800),
        });
      }
    } catch { /* skip bad threads */ }
    if (replies.length >= 50) break;
  }

  if (replies.length < 3)
    return NextResponse.json({
      error: `Only found ${replies.length} sent replies — need at least 3 to learn your voice. Send more recruiter replies and try again.`,
    }, { status: 404 });

  // Step 3: Send to Groq for voice extraction
  const repliesBlock = replies
    .slice(0, 50)
    .map((r, i) => `[${i + 1}] To: ${r.to}\nSubject: ${r.subject}\n---\n${r.body}`)
    .join("\n\n===\n\n");

  const result = await runAgent({
    apiKey,
    model: "llama-3.3-70b-versatile",
    systemPrompt: `You are a communication style analyst. You will receive ${replies.length} emails that Krishna sent to recruiters and hiring contacts. Your job is to analyze his writing style and produce a "Voice Prompt" — a system-prompt block that an AI can use to write emails that sound exactly like Krishna.

Analyze these dimensions:
1. TONE: Is he formal, casual, direct, warm? Does he use humor? How does he open/close?
2. SENTENCE STRUCTURE: Short and punchy or longer compound sentences? Active or passive voice?
3. VOCABULARY: Does he use specific words/phrases frequently? Technical jargon level?
4. GREETING/CLOSING PATTERNS: How does he start and end emails?
5. SELF-REFERENCES: How does he reference his experience? First person style?
6. RESPONSE LENGTH: Typical reply length? Does he over-explain or keep it tight?
7. WHAT HE AVOIDS: Corporate buzzwords? Excessive enthusiasm? Specific patterns he never uses?
8. UNIQUE QUIRKS: Any distinctive patterns, phrasings, or habits?

Output ONLY the voice prompt — a paragraph that starts with "Write emails in Krishna's voice:" followed by specific, actionable style rules. Include 3 example phrases he actually uses. Keep it under 500 words. No preamble, no analysis, just the prompt itself.`,
    userPrompt: `Here are ${replies.length} emails Krishna sent to recruiters:\n\n${repliesBlock}`,
    maxTokens: 1200,
  });

  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 502 });

  // The model's output is a draft, not the artefact. It has returned analysis
  // tables, a worked example, and a reference list carrying two private mobile
  // numbers — all of which would then be injected into the system prompt of
  // every auto-reply that goes to a stranger.
  const { prompt: voicePrompt, removed } = sanitizeVoicePrompt(result.content || "", {
    phones: ["(203) 804-9291"],
    emails: [process.env.GMAIL_USER || "krishna.amarneni@gmail.com"],
  });
  if (!voicePrompt) {
    return NextResponse.json(
      { error: "Nothing usable was left after sanitising the model's output. Try again." },
      { status: 502 }
    );
  }

  // Step 4: Store in admin_settings. Checked, because the whole point is that
  // the voice persists — returning the prompt from a failed write would show a
  // success screen for something the auto-reply pipeline can never read back.
  const db = requireSupabaseAdmin();
  const { error: saveError } = await db
    .from("admin_settings")
    .upsert({
      id: "singleton",
      voice_prompt: voicePrompt,
      voice_prompt_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (saveError) {
    return NextResponse.json(
      { error: `Voice extracted but not saved: ${saveError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    voicePrompt,
    emailsAnalyzed: replies.length,
    threadsScanned: Math.min(uniqueThreadIds.length, 40),
    model: result.modelUsed,
    // Reported rather than scrubbed silently — if third-party details keep
    // appearing, that is worth seeing.
    removed,
  });
}
