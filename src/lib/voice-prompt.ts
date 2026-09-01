/**
 * Sanitiser for the learned voice prompt.
 *
 * learn-voice reads real sent mail and asks a model to describe the writing
 * style. The prompt says "output ONLY the voice prompt, no preamble, no
 * analysis" — and the model returned a markdown analysis table, a worked
 * example email, and a block of professional references complete with their
 * personal mobile numbers.
 *
 * That output is not just displayed. buildLearningContext() injects it into the
 * system prompt of every auto-reply, which sends to strangers with a resume
 * attached. A reference's phone number sitting in that context is one
 * plausible generation away from being emailed to a recruiter who never should
 * have had it, and those people never agreed to any of this.
 *
 * So the model's output is treated as a draft, not as the artefact. Krishna's
 * own contact details survive — they belong in his mail. Everyone else's does
 * not, and neither does anything shaped like a transcript of someone else's
 * message.
 */

/** Krishna's own details, which are allowed to appear. */
export type OwnContacts = { phones: string[]; emails: string[] };

/** Digits only, so "(203) 804-9291" and "203‑804‑9291" compare equal. */
function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Phone-shaped runs, tolerant of the unicode non-breaking hyphen (U+2011) that
 * models often emit in place of "-". Matching only ASCII hyphens silently
 * missed every number in the real output.
 */
const PHONE_RX = /(?:\+?\d{1,2}[\s.‐-―-]?)?\(?\d{3}\)?[\s.‐-―-]?\d{3}[\s.‐-―-]?\d{4}/g;
const EMAIL_RX = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export type SanitizeResult = {
  prompt: string;
  /** What was taken out, for reporting rather than silent scrubbing. */
  removed: string[];
};

export function sanitizeVoicePrompt(raw: string, own: OwnContacts): SanitizeResult {
  const removed: string[] = [];
  let text = (raw ?? "").trim();
  if (!text) return { prompt: "", removed };

  const ownPhones = new Set(own.phones.map(digits).filter(Boolean));
  const ownEmails = new Set(own.emails.map((e) => e.toLowerCase()));

  // Fenced blocks are where the worked example and its reference list lived.
  // The pipeline appends its own signature, so nothing here is worth keeping.
  if (/```/.test(text)) {
    text = text.replace(/```[\s\S]*?(?:```|$)/g, "");
    removed.push("fenced example blocks");
  }

  // Everything from an "Example email" heading onward is a transcript, not
  // style guidance, and it is the most likely thing to be copied verbatim.
  const exampleAt = text.search(/^\s*(?:[#*\s]*)example\s+email/im);
  if (exampleAt >= 0) {
    text = text.slice(0, exampleAt);
    removed.push("worked example email");
  }

  // The analysis table is prose about the writing, not instructions for it, and
  // its pipes contradict the plain-text-only rule the reply prompt enforces.
  if (/^\s*\|/m.test(text)) {
    text = text.replace(/^\s*\|.*$/gm, "");
    removed.push("markdown analysis table");
  }

  // Start at the actual instruction when the model prefixed an essay.
  const start = text.search(/write emails in [^\n]*voice/i);
  if (start > 0) {
    text = text.slice(start);
    removed.push("preamble before the voice prompt");
  }

  // Drop whole lines carrying someone else's contact details. Redacting just
  // the number would leave "Sailaja Attelly - Coke - Business Analyst -", which
  // still names a private individual and their employer.
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    // Any instruction to supply references has to go. Krishna sends those
    // himself, and the sanitiser has just removed the only real ones the model
    // had — so an instruction to "list references" that survives here does not
    // produce a shorter email, it produces invented people with invented phone
    // numbers, sent to a recruiter under his name.
    if (/\breferences?\b/i.test(line)) {
      removed.push("instruction to include references");
      continue;
    }
    const foreignPhone = (line.match(PHONE_RX) ?? []).find((p) => {
      const d = digits(p);
      return d.length >= 10 && !ownPhones.has(d) && !ownPhones.has(d.slice(-10));
    });
    const foreignEmail = (line.match(EMAIL_RX) ?? []).find(
      (e) => !ownEmails.has(e.toLowerCase())
    );
    if (foreignPhone) {
      removed.push(`line with third-party phone ${foreignPhone.trim()}`);
      continue;
    }
    if (foreignEmail) {
      removed.push(`line with third-party email ${foreignEmail}`);
      continue;
    }
    kept.push(line);
  }
  text = kept.join("\n");

  // Plain text, matching what the reply prompt demands of the output.
  text = text
    .replace(/\*\*/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { prompt: text, removed };
}
