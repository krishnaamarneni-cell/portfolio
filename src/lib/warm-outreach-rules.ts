/**
 * Who may receive a warm check-in, and when.
 *
 * Kept pure so eligibility can be reasoned about — and tested — without a
 * database. This decides whether Krishna emails a real recruiter who did not
 * write to him first, so the rules are worth being able to read in one place.
 *
 * The shape of the risk is different from auto-reply. There, the worst case is
 * a bad answer to someone already talking to him. Here it is an unwanted email
 * to someone who was under no obligation to hear from him at all, and the cost
 * lands on the relationship he is trying to preserve.
 */

/**
 * How long a contact must have been quiet before a check-in makes sense.
 *
 * Every one of the 83 contacts who have replied did so within 90 days, and 50
 * within 30. "Just checking in, any openings?" to someone who replied last week
 * does not read as staying in touch; it reads as not having read their email.
 */
export const MIN_QUIET_DAYS = 30;

/** Never approach the same person twice inside this window. */
export const PER_PERSON_COOLDOWN_DAYS = 60;

/** Daily ceiling. Roughly 15 a week — ordinary human volume from a personal Gmail. */
export const MAX_OUTREACH_PER_DAY = 3;

export type OutreachCandidate = {
  email: string;
  name?: string | null;
  company?: string | null;
  rolePitched?: string | null;
  repliedCount: number;
  lastRepliedAt?: string | null;
  /** When this pipeline last wrote to them, if ever. */
  lastOutreachAt?: string | null;
  doNotContact?: boolean;
  bounced?: boolean;
  excludedFromBulk?: boolean;
};

const daysBetween = (a: Date, b: string) =>
  (a.getTime() - new Date(b).getTime()) / 86_400_000;

/**
 * Why this contact must not be approached now, or null when they are eligible.
 *
 * Returns a reason rather than a boolean so a run can report why it sent
 * nothing, which is the difference between "everyone is still in conversation"
 * and "the query is broken".
 */
export function outreachBlockReason(
  c: OutreachCandidate,
  now: Date = new Date()
): string | null {
  if (!c.email?.includes("@")) return "not an email address";
  if (c.doNotContact) return "marked do_not_contact";
  if (c.bounced) return "address previously bounced";
  if (c.excludedFromBulk) return "excluded from bulk";

  // Only people who have actually answered him. Someone who received an email
  // and stayed silent has given the clearest signal available.
  if (c.repliedCount <= 0) return "has never replied";
  if (!c.lastRepliedAt) return "no reply date recorded";

  const quiet = daysBetween(now, c.lastRepliedAt);
  if (quiet < MIN_QUIET_DAYS) {
    return `still in conversation — replied ${Math.floor(quiet)}d ago (needs ${MIN_QUIET_DAYS}d)`;
  }

  if (c.lastOutreachAt) {
    const since = daysBetween(now, c.lastOutreachAt);
    if (since < PER_PERSON_COOLDOWN_DAYS) {
      return `checked in ${Math.floor(since)}d ago (cooldown ${PER_PERSON_COOLDOWN_DAYS}d)`;
    }
    // If they answered our last check-in, the conversation restarted and the
    // quiet-days rule above governs it — never chase a live thread.
    if (new Date(c.lastRepliedAt) > new Date(c.lastOutreachAt)) {
      const replied = daysBetween(now, c.lastRepliedAt);
      if (replied < MIN_QUIET_DAYS) return "replied to our last check-in — conversation is live";
    }
  }

  return null;
}

/** Most-promising first: people who engage most, quiet longest. */
export function rankCandidates(
  candidates: OutreachCandidate[],
  now: Date = new Date()
): OutreachCandidate[] {
  return [...candidates].sort((a, b) => {
    const engagement = (b.repliedCount || 0) - (a.repliedCount || 0);
    if (engagement !== 0) return engagement;
    const aq = a.lastRepliedAt ? daysBetween(now, a.lastRepliedAt) : 0;
    const bq = b.lastRepliedAt ? daysBetween(now, b.lastRepliedAt) : 0;
    return bq - aq;
  });
}

/**
 * What Krishna is looking for. Stated once, here, because it belongs in his
 * own words rather than being re-invented by a model on each send.
 */
export const AVAILABILITY = `Krishna is actively looking now and wants to move quickly.
- Open to relocation anywhere in the US.
- Open to contract, contract-to-hire, full-time, or internship.
- Background: SAP consultant (S/4HANA, MM/SD, Ariba) moving toward AI engineering work.`;
