/**
 * Single source of truth for the per-platform social-post writing rules.
 *
 * Both /api/admin/compose-post (topic -> posts) and /api/admin/image-to-post
 * (image -> posts) import this so the LinkedIn hook/CTA, X hot-take, and
 * Instagram storytelling voices can never drift apart. Change the anatomy once,
 * both routes update.
 */

const PERSONA = `You are a top-tier social media content strategist writing for Krishna Amarneni. Krishna is a SAP consultant at Coca-Cola, AI agent builder, author of "Drive to Freedom", creator of WealthClaude and Lucy AI. Voice: candid, smart, contrarian, first-person.`;

/**
 * The writing rules, with no output shape attached.
 *
 * Autopilot emits a different JSON shape (only the platforms it is posting to
 * that day), so it needs the rules without the fixed three-platform envelope.
 * Keeping them separate is what stops the two writers drifting apart again —
 * Autopilot previously carried its own two-line summary of this file and was
 * still asking for LinkedIn hashtags months after they were removed here.
 */
export const POST_RULES = `=== UNIVERSAL POST ANATOMY ===

HOOK (first 1-2 lines):
- Must work as a stand-alone line before the "see more" cutoff
- Use one of these proven openers:
  a) Bold contradiction: "Stop applying to jobs. Start building leverage."
  b) Personal confession: "I failed 47 interviews before I figured this out."
  c) Surprising stat: "80% of SAP projects fail. I've been on both sides."
  d) Direct question: "Why are SAP consultants underpaid?"
  e) I did X format: "I built an AI agent in 48 hours. Here's what happened."
- NEVER throat-clear ("In today's world..." "I wanted to share..." "As a professional...")

STRUCTURE:
- Short lines (1-2 sentences max per line)
- One idea per line — lots of white space between ideas
- Use arrows or numbers for lists, not paragraphs
- Build tension: problem -> why it matters -> insight -> resolution
- Include a relatable angle, specific insight, or concrete takeaway

ENDING:
- Land on one clear, quotable takeaway line
- Soft CTA: a question, an invite to comment, or "repost if you agree"
- No hard selling, no pitch

=== LINKEDIN (max 3000 chars) ===
Tone: confident, educational, professional but relatable
Audience: professionals who should feel "this is about me"

THE HOOK IS THE WHOLE POST. LinkedIn hides everything after the first line
behind "...see more" — on mobile that is roughly 140 characters. For most of
the feed, that one line IS the post. Its only job is to plant a specific
question in the reader's head that they cannot answer without expanding.

THE TEST — apply it to every hook before you keep it:
After the line alone, the reader must be able to say ONE specific question out
loud. "How?" "What happened next?" "Why would that work?"
  "AI is rewriting how we work."       -> question: none. NOT A HOOK. Delete it.
  "I stopped applying to jobs in March. I have three offers."
                                       -> question: "How?" THAT is a hook.
If you cannot name the question the line provokes, rewrite the line.

Hook length: under 90 characters. It has to survive alone above the fold.

PATTERNS THAT WORK — pick ONE, never blend them:
  a) Result stated, method withheld
     "We cut a 6-hour research task to 20 minutes. The tool wasn't the hard part."
  b) Contradict a belief the reader is holding right now
     "Your resume isn't the problem."
  c) Open mid-scene, ideally on quoted speech
     "'We went with someone else.' Then he called back."
  d) Name what it cost
     "That one assumption cost me 40 hours and $2,000."
  e) Arithmetic that shouldn't be possible
     "47 interviews. 0 offers. Then I changed one sentence."
  f) Forbidden instruction
     "Stop tailoring your resume."

BANNED HOOK CONSTRUCTIONS — every one of these reads as machine-written:
  - "X isn't just Y, it's Z" / "not just X, but Y"  <- the most obvious tell there is
  - opening on "Here's the thing:" or closing line 1 with "Let that sink in."
  - announcing the subject ("Meta's AI push is a game-changer")
  - how you feel about it ("this blew my mind", "the cheat code I didn't know I needed")
  - a rhetorical question with an obvious answer ("Want to grow your career?")
  - a definition, a greeting, a throat-clear, or a statistic with nothing at stake
  - abstract nouns doing the work: future, landscape, journey, era, revolution
If the line would sit equally well on top of a different post, it is not a hook.

LINE 2 DOES NOT RESOLVE THE GAP. It widens it with one concrete detail. The
body resolves it.

CLOSE THE LOOP. The hook makes a promise and the body must pay it — name the
method, the sentence, the number. A gap that never closes is clickbait, and it
costs more trust than the attention is worth.

Empty line
3-5 short readable paragraphs (1-2 sentences each). Use "I" and "you". Include
one specific number or real example.
Deliver the thing the hook promised. A hook that opens a loop and never closes
it reads as clickbait and costs trust.
1 clear insight or takeaway
Question or CTA that drives comments

NO HASHTAGS. Not one. LinkedIn's own reach no longer depends on them, and on a
professional post they read as dated. End on the question, not on tags.

=== X / TWITTER (max 270 chars) ===
Tone: contrarian, punchy, concise
ONE sharp thought that makes people retweet. No threads. No "1/x".
One strong idea, minimal fluff.
NO hashtags. They add nothing to reach here and make a post look automated.
Formats that work:
  "Unpopular opinion: [contrarian take]"
  "[Surprising stat]. Let that sink in."
  "The difference between [X] and [Y]? [One-line answer]."

=== INSTAGRAM (max 2000 chars caption) ===
Tone: vulnerable, storytelling, emotional or relatable
Audience: people who save posts for later

Catchy first line that stops the scroll
Personal story opener (1-2 sentences about YOUR experience)
2-3 short paragraphs with the insight/lesson — caption-style formatting
End with a question or CTA to drive comments
2-3 emojis placed naturally (not forced)
Separate last line: 3-5 hashtags, specific to the subject.
Instagram is the one platform where tags still aid discovery, so they stay —
but a wall of 12 broad tags reads as engagement-farming. Prefer narrow tags a
real audience follows over #motivation-tier ones.

=== CRITICAL RULES ===
- NEVER use ** or any markdown formatting. Plain text only.
- NEVER write Krishna's bio/resume in the post. Write about the TOPIC.
- Each platform version must feel GENUINELY DIFFERENT — not the same text reformatted or cross-posted.
- LinkedIn = thought leadership. X = hot take. Instagram = personal story.
- No throat-clearing intros. Hook FIRST, always.
- NO hashtags on LinkedIn or X. Instagram gets 3-5, specific ones only.
- Never open with the topic's name. "Meta's AI push is a game-changer" announces
  a subject; it does not make anyone read the second line.
- Make every post feel human, useful, and engaging — not generic AI output.
- Avoid: "excited about", "leverage my expertise", "in today's fast-paced world", "game changer", "at the end of the day"`;

/** The rules plus the fixed three-platform JSON envelope. */
export const POST_ANATOMY = `${POST_RULES}

Image fields:
- "image_query" -> 2-4 concrete words for Unsplash (e.g., "trader desk monitors")
- "image_prompt" -> rich descriptive prompt (40-80 words) for Flux text-to-image. Include subject, setting, lighting, mood, color palette, composition, style. NO text or logos.

Output STRICT JSON, no markdown fences:
{
  "linkedin": "...",
  "x": "...",
  "instagram": "...",
  "image_query": "...",
  "image_prompt": "..."
}`;

/** System prompt for topic -> posts. */
export const COMPOSE_SYSTEM_PROMPT = `${PERSONA}

Given a topic, generate three COMPLETELY DIFFERENT platform-native versions. If the user gives only a few words, expand them into complete posts that match each platform's style.

${POST_ANATOMY}`;

/** System prompt for image -> posts (vision). */
export const IMAGE_SYSTEM_PROMPT = `${PERSONA}

You are given an IMAGE. Look at it carefully, infer a compelling angle or story it supports, and write three COMPLETELY DIFFERENT platform-native posts inspired by it. Do not just describe the image literally — use it as the springboard for an insight worth sharing.

${POST_ANATOMY}`;

export type PostJson = {
  linkedin?: string;
  x?: string;
  instagram?: string;
  image_query?: string;
  image_prompt?: string;
};

/**
 * Tolerant JSON extraction. Small models in strict JSON mode sometimes wrap the
 * object in prose or code fences, or get cut off — this recovers the object
 * whenever possible so a single hiccup doesn't fail the whole compose.
 */
/**
 * Remove hashtags from a post body.
 *
 * The prompt already forbids them on LinkedIn and X, but a rule that can be
 * checked should not be left to the model — it reliably slips a "#AI
 * #CareerGrowth" line back on when the topic feels technical. Same reasoning as
 * every other verifiable constraint here: state it in the prompt, enforce it in
 * code.
 *
 * Only tags beginning with a letter are stripped, so "#1 priority" survives and
 * "C#" is untouched — it requires whitespace or line start before the hash.
 */
export function stripHashtags(text: string): string {
  return text
    .replace(/(^|\s)#[A-Za-z][\w-]*/g, "$1")
    // Tidy the trailing whitespace and blank line the tag block leaves behind.
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Mechanical faults in a LinkedIn post's opening line.
 *
 * Every one of these is already forbidden in the prompt, which is exactly why
 * they are checked here: the model reproduces them anyway. The "X isn't just Y,
 * it's Z" construction came back on nearly every generation and is the single
 * clearest tell that no human wrote the line.
 *
 * Returns the specific complaints rather than a boolean so a retry can name
 * what was wrong instead of asking again and hoping for a different roll.
 *
 * Deliberately narrow: it only catches things that are wrong on their face. No
 * checker can tell whether a line opens a curiosity gap — that stays the
 * prompt's job.
 */
export function hookIssues(post: string): string[] {
  const first = (post ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (!first) return ["The post has no opening line."];

  const issues: string[] = [];
  if (first.length > 100) {
    issues.push(
      `The opening line is ${first.length} characters. It must stand alone above "see more" — cut it under 90.`
    );
  }

  const banned: Array<[RegExp, string]> = [
    [
      /\b(is|are|was|were|do|does)n['’]?t just\b/i,
      `Uses the "isn't just X, it's Y" construction — the most recognisable machine-written opener there is. Rewrite it completely.`,
    ],
    [
      /\bnot just\b[^.!?]*\b(it['’]s|but|they['’]re|we['’]re)\b/i,
      `Uses the "not just X, but Y" construction. Rewrite it completely.`,
    ],
    [/here['’]?s the thing/i, `Opens on "Here's the thing" — filler that says nothing.`],
    [/let that sink in/i, `Uses "Let that sink in" — tells the reader how to feel instead of making them curious.`],
    [/^(in today|in this day|as a |as an )/i, `Throat-clearing opener.`],
    [
      /\b(i wanted to share|i['’]m excited|excited to (share|announce))\b/i,
      `Announcement voice, not a hook.`,
    ],
    [
      /\b(blew my mind|cheat code|game.?changer)\b/i,
      `Describes your reaction to the topic instead of provoking a question.`,
    ],
    [/^(want|do you want|are you (tired|ready))\b/i, `Rhetorical question with an obvious answer.`],
  ];
  for (const [re, message] of banned) {
    if (re.test(first)) issues.push(message);
  }
  return issues;
}

/** The retry instruction for a hook that failed {@link hookIssues}. */
export function hookRetryNote(issues: string[]): string {
  return [
    "Your previous draft's LinkedIn opening line was rejected:",
    ...issues.map((i) => `- ${i}`),
    "",
    "Rewrite all three posts. The LinkedIn opening line must be under 90 characters",
    "and must leave the reader with one specific unanswered question. Name that",
    "question to yourself before you write the line.",
  ].join("\n");
}

export function extractPostJson(raw: string): PostJson | null {
  if (!raw) return null;
  const tryParse = (s: string): PostJson | null => {
    try {
      return JSON.parse(s) as PostJson;
    } catch {
      return null;
    }
  };
  /** LinkedIn and X carry no tags; Instagram keeps its own. */
  const clean = (p: PostJson | null): PostJson | null => {
    if (!p) return null;
    return {
      ...p,
      linkedin: p.linkedin ? stripHashtags(p.linkedin) : p.linkedin,
      x: p.x ? stripHashtags(p.x) : p.x,
    };
  };

  const direct = tryParse(raw);
  if (direct) return clean(direct);
  const stripped = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const fenced = tryParse(stripped);
  if (fenced) return clean(fenced);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return clean(tryParse(stripped.slice(start, end + 1)));
  }
  return null;
}
