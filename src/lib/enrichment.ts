import "server-only";
import { requireSupabaseAdmin } from "@/lib/supabase";

const TABLE = "crm_enrichment_queue";

export type Enrichment = {
  id: string;
  contact_id: string;
  field: string;
  suggested_value: string;
  source: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
};

export type SignatureParts = {
  phone?: string;
  title?: string;
  linkedin?: string;
  company?: string;
};

const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const LINKEDIN_RE = /linkedin\.com\/in\/[\w-]+/i;
const SIGN_OFF_RE =
  /(?:regards|best|thanks|cheers|sincerely|warm regards|kind regards|respectfully),?\s*\n/i;

export function parseSignature(bodyText: string): SignatureParts | null {
  if (!bodyText) return null;
  const signOffMatch = bodyText.match(SIGN_OFF_RE);
  const sigBlock = signOffMatch
    ? bodyText.slice(signOffMatch.index!)
    : bodyText.slice(-600);

  const parts: SignatureParts = {};

  const phoneMatch = sigBlock.match(PHONE_RE);
  if (phoneMatch) parts.phone = phoneMatch[0].trim();

  const linkedinMatch = sigBlock.match(LINKEDIN_RE);
  if (linkedinMatch) parts.linkedin = `https://${linkedinMatch[0]}`;

  const lines = sigBlock.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (
      !parts.title &&
      line.length < 80 &&
      /\b(director|manager|senior|lead|vp|head|recruiter|specialist|coordinator|consultant|analyst|engineer|partner|associate|advisor|president|officer)\b/i.test(
        line
      ) &&
      !PHONE_RE.test(line) &&
      !line.includes("@") &&
      !line.startsWith("http")
    ) {
      parts.title = line.replace(/^[-|•]\s*/, "").trim();
    }
  }

  return Object.keys(parts).length > 0 ? parts : null;
}

export async function queueEnrichment(
  contactId: string,
  field: string,
  value: string,
  source = "signature"
): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const { data: existing } = await supabase
    .from(TABLE)
    .select("id")
    .eq("contact_id", contactId)
    .eq("field", field)
    .eq("suggested_value", value)
    .maybeSingle();
  if (existing) return;

  await supabase.from(TABLE).insert({
    contact_id: contactId,
    field,
    suggested_value: value,
    source,
  });
}

export async function listPendingEnrichments(): Promise<Enrichment[]> {
  const supabase = requireSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as Enrichment[];
}

export async function reviewEnrichment(
  id: string,
  action: "approved" | "rejected"
): Promise<void> {
  const supabase = requireSupabaseAdmin();

  if (action === "approved") {
    const { data: item } = await supabase
      .from(TABLE)
      .select("contact_id, field, suggested_value")
      .eq("id", id)
      .single();
    if (item) {
      await supabase
        .from("recruiter_contacts")
        .update({
          [item.field]: item.suggested_value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.contact_id);
    }
  }

  await supabase
    .from(TABLE)
    .update({ status: action, reviewed_at: new Date().toISOString() })
    .eq("id", id);
}

export async function enrichFromMessages(
  contactId: string,
  existingContact: { phone?: string | null; title?: string | null; linkedin_url?: string | null },
  messageBodies: string[]
): Promise<number> {
  let queued = 0;
  for (const body of messageBodies) {
    const sig = parseSignature(body);
    if (!sig) continue;

    if (sig.phone && !existingContact.phone) {
      await queueEnrichment(contactId, "phone", sig.phone);
      queued++;
    }
    if (sig.title && !existingContact.title) {
      await queueEnrichment(contactId, "title", sig.title);
      queued++;
    }
    if (sig.linkedin && !existingContact.linkedin_url) {
      await queueEnrichment(contactId, "linkedin_url", sig.linkedin);
      queued++;
    }
  }
  return queued;
}
