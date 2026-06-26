import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listContacts, updateContactType, type ContactType } from "@/lib/contacts";
import { listRecentMessages } from "@/lib/gmail";
import { runAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    contactIds?: string[];
  };

  const allContacts = await listContacts();
  const targets = body.contactIds
    ? allContacts.filter((c) => body.contactIds!.includes(c.id))
    : allContacts.filter((c) => c.contact_type === "unknown");

  if (targets.length === 0) {
    return NextResponse.json({ classified: 0, results: [] });
  }

  const results: Array<{
    id: string;
    email: string;
    type: ContactType;
    reason: string;
  }> = [];

  const BATCH = 5;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const settled = await Promise.all(
      batch.map(async (contact) => {
        try {
          const { messages } = await listRecentMessages({
            query: `from:${contact.email} OR to:${contact.email}`,
            maxResults: 10,
          });

          if (messages.length === 0) {
            const guessType = guessFromMetadata(contact);
            await updateContactType(contact.id, guessType);
            return {
              id: contact.id,
              email: contact.email,
              type: guessType,
              reason: "no email history — guessed from metadata",
            };
          }

          const conversationSummary = messages
            .map(
              (m) =>
                `From: ${m.from}\nSubject: ${m.subject}\nPreview: ${m.snippet}`
            )
            .join("\n---\n");

          const result = await runAgent({
            apiKey: apiKey!,
            model: "llama-3.3-70b-versatile",
            systemPrompt: `You classify email contacts. Given email conversations between Krishna Amarneni and a contact, determine the relationship type.

Output ONLY a JSON object: {"type":"recruiter"|"personal"|"colleague","reason":"one sentence"}

Definitions:
- "recruiter": staffing agency recruiter, HR person, hiring manager, talent acquisition — anyone sending job opportunities, scheduling interviews, or discussing roles/positions
- "colleague": current or former coworker, professional peer, someone from the same company or project
- "personal": friend, family, newsletter, marketing email, service notification, anything not job or work related

If the emails discuss job openings, roles, interviews, resumes, or hiring → recruiter.
If the emails discuss shared work projects, team matters, or are from a known company Krishna worked at → colleague.
Everything else → personal.

Default to "recruiter" if the contact source is "inbox-agent" or "auto-reply" and emails mention any job-related keywords.`,
            userPrompt: `Contact: ${contact.name} <${contact.email}>
Company: ${contact.company || "unknown"}
Role pitched: ${contact.role_pitched || "none"}
Source: ${contact.source}
Match %: ${contact.match_pct ?? "none"}

EMAIL CONVERSATIONS:
${conversationSummary}`,
            maxTokens: 100,
          });

          let classified: { type: ContactType; reason: string } = {
            type: "unknown",
            reason: "failed to classify",
          };

          if (result.ok && result.content) {
            try {
              const jsonStr = result.content
                .replace(/```json?\s*\n?/g, "")
                .replace(/```/g, "")
                .trim();
              const parsed = JSON.parse(jsonStr);
              if (
                parsed.type &&
                ["recruiter", "personal", "colleague"].includes(parsed.type)
              ) {
                classified = {
                  type: parsed.type as ContactType,
                  reason: parsed.reason || "",
                };
              }
            } catch {}
          }

          await updateContactType(contact.id, classified.type);
          return {
            id: contact.id,
            email: contact.email,
            type: classified.type,
            reason: classified.reason,
          };
        } catch (err) {
          return {
            id: contact.id,
            email: contact.email,
            type: "unknown" as ContactType,
            reason: err instanceof Error ? err.message : "error",
          };
        }
      })
    );
    results.push(...settled);
  }

  return NextResponse.json({
    classified: results.filter((r) => r.type !== "unknown").length,
    results,
  });
}

function guessFromMetadata(contact: {
  source: string;
  role_pitched: string | null;
  match_pct: number | null;
}): ContactType {
  if (
    contact.source === "inbox-agent" ||
    contact.source === "auto-reply" ||
    contact.role_pitched
  ) {
    return "recruiter";
  }
  if (contact.match_pct && contact.match_pct > 0) {
    return "recruiter";
  }
  return "unknown";
}
