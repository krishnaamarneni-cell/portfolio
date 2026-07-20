/**
 * Detects addresses that can never reply — no-reply senders, notification bots,
 * mailing-list machinery. These get harvested into the CRM from your inbox
 * (Reddit, GitHub, LinkedIn notifications, etc.) and must never receive outreach:
 * they waste sends, skew reply-rate stats, and often bounce.
 *
 * Deliberately pattern-based (no LLM): deterministic, free, and instant.
 */

/**
 * Role addresses that ARE worth emailing for a job search. Checked FIRST so a
 * naive keyword match can't kill them — note `jobs@acme.com` is a target while
 * `jobs-listings@linkedin.com` is junk.
 */
const SENDABLE_ROLES = new Set([
  "careers",
  "career",
  "jobs",
  "job",
  "hr",
  "hiring",
  "recruiting",
  "recruitment",
  "recruiter",
  "talent",
  "people",
  "peopleops",
  "work",
  "workwithus",
  "joinus",
  "apply",
]);

/** Tokens that mark an address as machine-generated. Matched as substrings. */
const BLOCK_TOKENS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "notification",
  "notifications",
  "notify",
  "mailer-daemon",
  "mailerdaemon",
  "postmaster",
  "bounce",
  "bounces",
  "autoreply",
  "auto-reply",
  "automated",
  "unsubscribe",
  "hit-reply",
  "jobs-listings",
  "job-listings",
  "invitations",
  "newsletter",
  "no.reply",
  "webmaster",
  "abuse",
];

/** Domains that only ever send machine mail. */
const BLOCK_DOMAINS = [
  "redditmail.com",
  "bounces.google.com",
  "sendgrid.net",
  "mcsv.net",
  "mailchimpapp.net",
  "sparkpostmail.com",
  "amazonses.com",
  "mailgun.org",
  "zendesk.com",
  "intercom-mail.com",
];

export type UnsendableVerdict = { unsendable: boolean; reason?: string };

/**
 * `true` when the address is a bot/no-reply sender.
 *
 * Conservative by design: a false positive silently drops a real recruiter from
 * your outreach, which is worse than one wasted send. Anything not clearly
 * machine-generated is treated as sendable.
 */
export function classifyAddress(email: string): UnsendableVerdict {
  const addr = (email ?? "").trim().toLowerCase();
  if (!addr.includes("@")) return { unsendable: true, reason: "Not a valid email address" };

  const [rawLocal, domain] = addr.split("@");
  // strip +tags so "noreply+123@" is still caught
  const local = rawLocal.split("+")[0];

  // Legit role inboxes win outright.
  if (SENDABLE_ROLES.has(local)) return { unsendable: false };

  for (const d of BLOCK_DOMAINS) {
    if (domain === d || domain.endsWith(`.${d}`)) {
      return { unsendable: true, reason: `Automated sender domain (${d})` };
    }
  }

  for (const token of BLOCK_TOKENS) {
    if (local.includes(token)) {
      return { unsendable: true, reason: `No-reply address (“${token}”)` };
    }
  }

  return { unsendable: false };
}

export function isUnsendable(email: string): boolean {
  return classifyAddress(email).unsendable;
}
