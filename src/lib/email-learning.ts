/**
 * Email learning system — tracks how Krishna responds to recruiter emails
 * so the AI can learn his preferred tone, which roles he engages with,
 * and generate better auto-replies over time.
 *
 * Stores: original email subject, AI draft, user's final version (after edits),
 * action taken (sent/edited/discarded), match %, and whether the recruiter replied.
 */
import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

export type EmailResponse = {
  id: string;
  to_email: string;
  to_name: string;
  subject: string;
  match_pct: number | null;
  ai_draft: string;
  final_body: string;
  action: "sent" | "edited_sent" | "discarded";
  got_reply: boolean;
  created_at: string;
};

const TABLE = "email_responses";

export async function recordResponse(input: {
  to_email: string;
  to_name: string;
  subject: string;
  match_pct?: number;
  ai_draft: string;
  final_body: string;
  action: "sent" | "edited_sent" | "discarded";
}): Promise<void> {
  const supabase = requireSupabaseAdmin();
  await supabase.from(TABLE).insert({
    to_email: input.to_email,
    to_name: input.to_name,
    subject: input.subject,
    match_pct: input.match_pct ?? null,
    ai_draft: input.ai_draft,
    final_body: input.final_body,
    action: input.action,
    got_reply: false,
    created_at: new Date().toISOString(),
  });
}

export async function getRecentResponses(limit: number = 10): Promise<EmailResponse[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as EmailResponse[];
}

/** Build a context block from past responses for the AI to learn from. */
export async function buildLearningContext(): Promise<string> {
  const responses = await getRecentResponses(15).catch(() => []);
  if (responses.length === 0) return "";

  const sentResponses = responses.filter((r) => r.action !== "discarded");
  if (sentResponses.length === 0) return "";

  // Find patterns: edited vs sent as-is.
  const editedCount = sentResponses.filter((r) => r.action === "edited_sent").length;
  const asIsCount = sentResponses.filter((r) => r.action === "sent").length;

  let context = `\n# Krishna's email style (learned from ${sentResponses.length} past responses)\n`;

  if (editedCount > asIsCount) {
    context += "Krishna usually edits AI drafts before sending — match his tone from the examples below.\n";
  } else {
    context += "Krishna mostly approves AI drafts as-is — your current tone is working.\n";
  }

  // Show the last 5 FINAL versions (what Krishna actually sent, not the AI draft).
  context += "\nRecent emails Krishna actually sent (use these as tone/style reference):\n";
  for (const r of sentResponses.slice(0, 5)) {
    context += `---\nTo: ${r.to_name} | Subject: ${r.subject} | Match: ${r.match_pct ?? "?"}%\n`;
    context += `${r.final_body}\n`;
  }

  // Show edits: what the AI wrote vs what Krishna changed it to.
  const edited = sentResponses.filter((r) => r.action === "edited_sent" && r.ai_draft !== r.final_body);
  if (edited.length > 0) {
    context += "\nEdits Krishna made (learn from these corrections):\n";
    for (const r of edited.slice(0, 3)) {
      context += `---\nAI wrote: "${r.ai_draft.slice(0, 100)}..."\nKrishna changed to: "${r.final_body.slice(0, 100)}..."\n`;
    }
  }

  return context;
}
