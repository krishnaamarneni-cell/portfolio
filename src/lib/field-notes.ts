// Sample Field Notes — replace/edit these with your real takes
// Each note has: id, title, summary, body (markdown-style), tag, date, readMinutes

export type FieldNote = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  tag: "AI" | "Finance" | "Geopolitics" | "Enterprise" | "Markets" | "Misc";
  date: string; // YYYY-MM-DD
  readMinutes: number;
  featured?: boolean;
};

export const fieldNotes: FieldNote[] = [
  {
    slug: "sap-ai-trillion-dollar-opportunity",
    title: "Why SAP + AI is the next trillion-dollar opportunity nobody is talking about",
    summary:
      "Everyone's chasing AI for consumers. The real money is in retrofitting AI into the boring enterprise systems running 80% of the Fortune 500.",
    body: `
Most AI startups are building chatbots, image generators, or copilots for individuals. That's a crowded space.

The bigger, slower, less sexy opportunity? **Retrofitting AI into enterprise systems** — SAP, Oracle, Workday, Salesforce. These platforms run the operations of nearly every Fortune 500 company. The data is messy. The workflows are ancient. And the people running them are crying for better tools.

Here's what I see daily at Coca-Cola:

- 30% of an SAP Business Analyst's time is spent investigating data discrepancies. AI agents can resolve 80% of those in seconds.
- Master data accuracy hovers at ~95% across most enterprises. AI-powered validation can push it to 99.9%.
- Procurement decisions get stuck in 7-step approval flows. AI can pre-validate, route intelligently, and close 60% of cycles autonomously.

This isn't theoretical. It's happening now, slowly, by builders who understand both worlds.

**The opportunity:** Enterprise AI is a $1T+ market over the next decade — and most "AI builders" don't know how SAP works, while most SAP consultants don't know how to ship modern AI products.

The bridge is where the money lives.
    `.trim(),
    tag: "AI",
    date: "2026-04-28",
    readMinutes: 3,
    featured: true,
  },
  {
    slug: "fire-is-not-retirement",
    title: "FIRE isn't about retiring — it's about owning your time",
    summary:
      "The financial independence movement gets misunderstood. It's not about quitting work at 35. It's about decoupling your time from your paycheck.",
    body: `
Most people hear "FIRE" (Financial Independence, Retire Early) and think:

> "I want to stop working at 40 and sit on a beach forever."

That misunderstands the entire point.

FIRE isn't about retiring early. It's about reaching a financial position where **work becomes optional, not mandatory.**

That distinction changes everything:

- You can take the lower-paying job with a steeper learning curve
- You can say no to bullshit projects without panicking
- You can spend 6 months building something risky without burning out
- You can choose meaning over money in any single decision

The math is simple: when your investments cover your basic expenses (~25× annual spending invested), you've bought your own freedom.

Most people will never optimize for it because culture tells them to optimize for status (bigger house, newer car, fancier title). But the people who quietly grind toward FIRE in their 20s and 30s end up with something most never get: **the unconditional freedom to pursue what they actually care about.**

That's worth more than any retirement plan.
    `.trim(),
    tag: "Finance",
    date: "2026-04-21",
    readMinutes: 2,
  },
  {
    slug: "china-byd-vs-tesla",
    title: "China's BYD is more dangerous to Tesla than the market thinks",
    summary:
      "BYD outsold Tesla globally in Q4 2023 and the gap is widening. The narrative hasn't caught up to the spreadsheet.",
    body: `
Quick numbers:

- BYD sold ~3.0M vehicles in 2023. Tesla sold 1.8M.
- BYD's vertical integration (their own batteries via FinDreams, their own chips, their own steel) gives them a structural cost advantage Tesla can't match.
- They're entering Europe, Southeast Asia, and Latin America aggressively. The US is closed to them — for now.

The bull case for Tesla rests on three legs: **autonomy, energy storage, and brand premium.** Two of those are eroding.

- **Autonomy:** Waymo (Google) is operationally ahead in driverless rides. Mercedes shipped Level 3 in Germany before Tesla.
- **Energy storage:** Megapack is a $7B+ business and growing fast — this is real. Bull case still intact.
- **Brand premium:** Eroding fast. Cybertruck's reception was mixed. Model Y is aging. Chinese EV interiors now match or exceed Tesla's quality at half the price.

I still hold some Tesla. But I'm watching BYD's ADR (BYDDY) very carefully. The trade I want is the moment Western markets stop being closed to Chinese EVs — that's a 5-10 year window, but the long-term setup is striking.

(Not investment advice. Just thinking out loud.)
    `.trim(),
    tag: "Markets",
    date: "2026-04-14",
    readMinutes: 3,
  },
  {
    slug: "ai-agents-replace-saas",
    title: "AI agents will replace 70% of SaaS apps within 5 years",
    summary:
      "If your SaaS app's main value is 'a clean UI on top of an API', you're in trouble. AI agents make UIs irrelevant.",
    body: `
Here's a hot take I've been sitting with:

**Most SaaS companies sell convenience, not capability.**

Their actual functionality? Usually a thin wrapper around an API or a database. The reason you pay $50/month is the UI, the integrations, and the polish.

AI agents kill that moat.

When you can say "Claude, post this to LinkedIn, tag these 3 people, schedule it for Tuesday at 9am, then DM me when it gets >100 reactions," you don't need:

- Buffer
- Hootsuite
- HubSpot's social tool
- Zapier flows

The agent IS the UI. It calls APIs directly.

**Who survives?**

1. **Companies with proprietary data** (Bloomberg, LexisNexis, Plaid)
2. **Companies that own infrastructure** (AWS, Stripe, Twilio)
3. **Companies with deep workflow capture** (Salesforce, Notion — *if* they pivot fast)
4. **Companies with strong network effects** (LinkedIn, Slack)

**Who dies?**

The "we're a beautiful UI on top of [boring backend]" startups. Their entire pitch is now obsolete.

I'm building Lucy AI partly because I believe this. The UI of the future is conversation, not dashboards.
    `.trim(),
    tag: "AI",
    date: "2026-04-07",
    readMinutes: 3,
  },
  {
    slug: "geopolitics-tech-decoupling",
    title: "The US-China tech decoupling will create two parallel internets",
    summary:
      "Export controls, AI chip restrictions, and TikTok bans aren't isolated events — they're symptoms of a structural split. Builders should plan for it.",
    body: `
We're not heading toward "one global tech ecosystem with some friction." We're heading toward **two parallel internets** — one led by the US/EU, one led by China and its allies.

Evidence:

- US restricts NVIDIA H100/H200 exports to China → China responds by accelerating Huawei Ascend chips
- China bans Western cloud providers → Alibaba/Tencent dominate Asia + Africa
- TikTok divestment forced in US → ByteDance entrenches in 150+ other countries
- EU AI Act vs. China's AI regulations vs. US executive orders — three different legal regimes

Most builders haven't priced this in. They build assuming a unified global market. But:

1. **Distribution channels** are splitting (App Store policies, payment rails, ad networks)
2. **Talent flows** are slowing (visa restrictions, security reviews)
3. **Standards** are diverging (5G, AI safety, payment systems)
4. **Capital** is decoupling (CFIUS reviews, Chinese listings de-listing from US)

If you're building a product that depends on:
- Global distribution → assume you ship 2 versions
- Chinese hardware → assume export controls hit you
- Cross-border payments → assume more friction
- Open source → assume forks (already happening with Linux ecosystem)

This isn't doom. It's a structural shift. The builders who plan for it will outperform the ones still pretending the 2010s globalization is coming back.

It's not.
    `.trim(),
    tag: "Geopolitics",
    date: "2026-03-31",
    readMinutes: 4,
  },
  {
    slug: "what-coca-cola-taught-me",
    title: "What Coca-Cola taught me about scaling enterprise software",
    summary:
      "Working on global supply chains at one of the world's biggest brands changed how I think about software. Here's what surprised me.",
    body: `
Before Coca-Cola, I thought enterprise software was bloated, slow, and stupid. After 18 months supporting their SAP S/4HANA + Ariba integration, I have a different view.

**Enterprise software is hard for reasons consumer apps don't appreciate:**

1. **Scale isn't users — it's transactions.** A consumer app celebrates 1M users. Coca-Cola's SAP system processes that many records every few hours.

2. **Failure modes are existential.** If Instagram is down, people complain. If Coca-Cola's ASN system is down, trucks don't move, retailers don't stock, and shareholders lose billions in a day.

3. **Legacy isn't lazy — it's load-bearing.** That "ancient" SAP module everyone wants to rewrite? It's been running for 25 years because it works. Replacing it is not a refactor — it's open-heart surgery on a moving body.

4. **The business never stops.** No "maintenance window." No "v2 next quarter." You change things while the engine runs.

5. **Politics is half the engineering.** A change to procurement workflow can affect 200 people in 14 countries. Getting buy-in is harder than writing the code.

This is why "AI will eat enterprise" doesn't quite work the way Twitter thinks. The companies that win in enterprise AI won't be the ones who ship fastest — they'll be the ones who understand the constraints, work *with* legacy, and earn trust slowly.

It's not a sprint. It's siege warfare.
    `.trim(),
    tag: "Enterprise",
    date: "2026-03-24",
    readMinutes: 3,
  },
];

export const getNoteBySlug = (slug: string) =>
  fieldNotes.find((n) => n.slug === slug);

export const tags = ["All", "AI", "Finance", "Markets", "Geopolitics", "Enterprise", "Misc"] as const;
