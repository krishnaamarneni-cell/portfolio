/**
 * Guards for the auto-reply pipeline.
 *
 * Kept apart from the pipeline so they run against real strings with no
 * database and no Gmail token. Every rule here exists for one of two reasons:
 * the prompt already asked for it and the model did it anyway, or the input is
 * attacker-controlled and a prompt is not a security boundary.
 *
 * The email being scored is written by whoever emailed Krishna. Treat all of it
 * as hostile input: it can try to talk to the model, and the model's output is
 * about to be sent to a real person under Krishna's name with his resume
 * attached. Both ends need checking.
 */

/** Minimum match percentage before anything is sent. */
export const MATCH_THRESHOLD = 70;

/**
 * Never exchange more than this with one sender.
 *
 * The pipeline once looped for six weeks producing "Re: Re: Re:" subjects
 * because nothing counted prior replies. Two is enough for a real recruiter
 * thread and short enough that a loop dies immediately.
 */
export const MAX_REPLIES_PER_SENDER = 2;

/** Hard ceiling per calendar day across all senders. */
export const MAX_SENDS_PER_DAY = 2;

/**
 * What an incoming email is. Only `job` is ever replied to.
 *
 * `personal` exists as its own category rather than as "not job" so the model
 * has to make a positive call. A binary job/not-job question gets answered
 * "job" far too readily when a friend writes "how did the interview go".
 */
export type EmailCategory =
  | "job"
  | "personal"
  | "marketing"
  | "automated"
  | "suspicious"
  | "other";

export const REPLYABLE_CATEGORIES: readonly EmailCategory[] = ["job"];

export function isReplyable(category: string): category is EmailCategory {
  return (REPLYABLE_CATEGORIES as readonly string[]).includes(category);
}

/** Parse `Name <email>` from a Gmail From header. */
export function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>/);
  if (match) {
    return {
      name: match[1].replace(/"/g, "").trim(),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { name: from.trim(), email: from.trim().toLowerCase() };
}

/** A per-call delimiter an injected email cannot guess and so cannot close. */
export function makeNonce(): string {
  return `UNTRUSTED_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

/**
 * Fence attacker-controlled text so the model reads it as data.
 *
 * Any occurrence of the nonce inside the text is stripped first — otherwise an
 * email that guessed the fence could close it early and have the rest of its
 * body read as instructions.
 */
export function untrustedBlock(label: string, text: string, nonce: string): string {
  const cleaned = (text ?? "").split(nonce).join("");
  return `${nonce}_BEGIN ${label}\n${cleaned}\n${nonce}_END ${label}`;
}

/**
 * Reasons a generated reply must not be sent.
 *
 * The model is asked for plain text with every placeholder filled and no links
 * beyond Krishna's own. It complies most of the time — which is exactly why the
 * exceptions need catching here rather than being trusted to the next retry.
 */
export function replyIssues(
  reply: string,
  opts: { allowedHosts: string[]; ownEmails: string[] }
): string[] {
  const text = (reply ?? "").trim();
  const issues: string[] = [];

  if (text.length < 40) {
    issues.push(`Reply is only ${text.length} characters — too short to send.`);
    return issues;
  }
  if (text.length > 2500) {
    issues.push(`Reply is ${text.length} characters — far longer than a real reply.`);
  }

  // Template placeholders the model was told to fill. Sending "{company}" to a
  // recruiter is worse than sending nothing.
  const placeholder = text.match(/\{[a-z_][a-z0-9_]*\}/i);
  if (placeholder) {
    issues.push(`Contains an unfilled placeholder: ${placeholder[0]}`);
  }

  if (/\*\*|^\s*[*#]\s/m.test(text)) {
    issues.push("Contains markdown formatting; the reply must be plain text.");
  }

  // A link the model invented is a link Krishna did not vet, going out over his
  // name. The only URLs allowed are the ones this pipeline supplies itself.
  const allowed = new Set(opts.allowedHosts.map((h) => h.toLowerCase().replace(/^www\./, "")));
  for (const raw of text.match(/https?:\/\/[^\s<>"')]+/gi) ?? []) {
    let host: string;
    try {
      host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      issues.push(`Contains an unparseable URL: ${raw.slice(0, 60)}`);
      continue;
    }
    if (!allowed.has(host)) {
      issues.push(`Contains a link to an unapproved host: ${host}`);
    }
  }

  // Same reasoning for addresses: an injected "reply to me at X" would route a
  // real recruiter somewhere Krishna never chose.
  const own = new Set(opts.ownEmails.map((e) => e.toLowerCase()));
  for (const addr of text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []) {
    if (!own.has(addr.toLowerCase())) {
      issues.push(`Contains an unexpected email address: ${addr}`);
    }
  }

  // The model repeating the attack back at us is the clearest signal the email
  // tried to steer it.
  if (/ignore (all |the )?(previous|prior|above)|system prompt|as an ai (language )?model/i.test(text)) {
    issues.push("Echoes injected instructions from the source email.");
  }

  return issues;
}

/** Why this sender is off-limits, or null when replying is allowed. */
export function senderBlockReason(
  email: string,
  opts: {
    ownEmails: string[];
    ownDomains: string[];
    repliesSoFar: number;
    doNotContact?: boolean;
    bounced?: boolean;
  }
): string | null {
  const addr = email.toLowerCase().trim();
  if (!addr.includes("@")) return "not an email address";

  // The loop that ran for six weeks was this check missing.
  if (opts.ownEmails.some((e) => e.toLowerCase() === addr)) return "this is Krishna's own address";
  const domain = addr.split("@")[1] ?? "";
  if (opts.ownDomains.some((d) => d.toLowerCase() === domain)) {
    return `sent from our own domain (${domain}) — replying would loop`;
  }

  if (opts.doNotContact) return "marked do_not_contact";
  if (opts.bounced) return "address previously bounced";
  if (opts.repliesSoFar >= MAX_REPLIES_PER_SENDER) {
    return `already replied ${opts.repliesSoFar}x (cap ${MAX_REPLIES_PER_SENDER})`;
  }
  return null;
}
