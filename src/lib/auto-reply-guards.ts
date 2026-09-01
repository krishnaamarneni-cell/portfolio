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
 * Never send more than this into one conversation.
 *
 * This is the cap that matters. The pipeline once looped for six weeks
 * producing "Re: Re: Re:" subjects because nothing counted prior replies. Two
 * is enough for a real recruiter exchange and short enough that a loop dies
 * immediately.
 */
export const MAX_REPLIES_PER_THREAD = 2;

/**
 * Backstop so a single address cannot monopolise the pipeline across many
 * separate threads. Deliberately loose — a genuine recruiter pitching several
 * roles should not be silenced after the second one.
 */
export const MAX_REPLIES_PER_SENDER = 6;

/**
 * Circuit breaker, not a throttle.
 *
 * There is deliberately no daily quota: if eight good recruiters write on the
 * same day, all eight should get an answer — throttling that would work against
 * the entire point of the feature. This number exists only to bound a runaway,
 * such as a mailing-list burst being misclassified, and sits far above any
 * plausible real day so it never binds in normal use.
 */
export const DAILY_RUNAWAY_LIMIT = 25;

/**
 * Replies only leave during New York business hours.
 *
 * A reply timestamped 03:14 is the clearest possible tell that nobody read the
 * email. Held messages are not lost: nothing is marked until it is actually
 * sent, and the mailbox scan looks back two days, so a 3am arrival is still
 * waiting at 9am.
 *
 * "America/New_York" rather than a fixed UTC-5 so the window tracks EST/EDT.
 */
export const SEND_WINDOW = {
  startHour: 9,
  endHour: 18,
  timeZone: "America/New_York",
} as const;

/** The hour (0-23) in a given IANA zone. */
export function localHourIn(timeZone: string, now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

/** Why sending is closed right now, or null when the window is open. */
export function sendWindowBlockReason(now: Date = new Date()): string | null {
  const hour = localHourIn(SEND_WINDOW.timeZone, now);
  if (hour < SEND_WINDOW.startHour || hour >= SEND_WINDOW.endHour) {
    return `outside send window — ${String(hour).padStart(2, "0")}:00 in New York, sends run ${SEND_WINDOW.startHour}:00-${SEND_WINDOW.endHour}:00`;
  }
  return null;
}

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
    /** Replies already sent into THIS conversation. */
    repliesInThread: number;
    /** Replies already sent to this address across all conversations. */
    repliesToSender: number;
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
  if (opts.repliesInThread >= MAX_REPLIES_PER_THREAD) {
    return `already sent ${opts.repliesInThread} replies in this thread (cap ${MAX_REPLIES_PER_THREAD})`;
  }
  if (opts.repliesToSender >= MAX_REPLIES_PER_SENDER) {
    return `already sent ${opts.repliesToSender} replies to this address (cap ${MAX_REPLIES_PER_SENDER})`;
  }
  return null;
}
