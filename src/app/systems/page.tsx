import type { Metadata } from "next";
import Link from "next/link";
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiActivity,
  FiGitBranch,
  FiMail,
  FiImage,
  FiFileText,
  FiShield,
  FiRepeat,
  FiLayers,
  FiCpu,
  FiDownload,
  FiCheck,
} from "react-icons/fi";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "AI Systems I Built · Krishna Amarneni",
  description:
    "A personal AI operations platform — autonomous agents, an inbox-driven CRM, a social studio, and a résumé engine — designed, built, and deployed solo. The AI engineering behind the portfolio.",
};

type System = {
  index: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  tagline: string;
  bullets: string[];
  stack: string[];
};

const SYSTEMS: System[] = [
  {
    index: "01",
    icon: FiActivity,
    title: "Autonomous agent crew",
    tagline: "Six specialised agents that scan, score, and surface — on a schedule.",
    bullets: [
      "News, Jobs, Email, Investing (Atlas), Stock-screening and a Social observer, each with its own persona and job.",
      "Every scout does a real web search first, then is strictly limited to the URLs it found — no hallucinated links.",
      "You can open a chat with any one of them, or all at once in a chief-of-staff mode grounded in their latest reports.",
    ],
    stack: ["Groq LLMs", "Tavily / Brave", "RSS", "Vercel Cron"],
  },
  {
    index: "02",
    icon: FiGitBranch,
    title: "Agents that talk to each other",
    tagline: "A shared blackboard lets them collaborate without being wired together.",
    bullets: [
      "A Social Observer learns my content voice and writes it to a shared profile the other agents read.",
      "The News scout judges each story against that profile and auto-saves the ones that fit as post ideas.",
      "One writes, any surface reads — adding a new agent to the loop is a single function call, not a rewrite.",
    ],
    stack: ["Supabase", "Blackboard pattern", "LLM scoring"],
  },
  {
    index: "03",
    icon: FiMail,
    title: "Inbox-driven CRM",
    tagline: "Turns a mailbox into a classified, enrichable contact database.",
    bullets: [
      "Harvests every contact from job/recruiter email automatically — replied or not.",
      "Classifies each relationship (recruiter, hiring manager, vendor, visa, …) by reading their actual email history, not their domain.",
      "Enriches phone / LinkedIn / title from signatures behind human approval, and runs guard-railed, role-targeted bulk outreach.",
    ],
    stack: ["Gmail API", "Groq", "Postgres", "Exclusion guards"],
  },
  {
    index: "04",
    icon: FiImage,
    title: "Social studio",
    tagline: "Draft, illustrate, schedule, and measure — per platform.",
    bullets: [
      "Generates genuinely different posts per network — LinkedIn hook + CTA, X hot-take, Instagram story.",
      "Makes the image too (text-to-image) or writes posts FROM an uploaded image with a vision model.",
      "A daily auto-drip posts one image a day at a time I set, then an analytics tab reads what actually reached people.",
    ],
    stack: ["Groq vision", "fal.ai", "Buffer", "Cron scheduling"],
  },
  {
    index: "05",
    icon: FiFileText,
    title: "Résumé engine",
    tagline: "Paste a job description, get an ATS-tuned résumé — as a real file.",
    bullets: [
      "Tailors the résumé to the role, scores ATS + keyword fit, and flags matched vs missing keywords.",
      "Reads an uploaded PDF/DOCX as the base (extracts the text server-side) or uses my master résumé.",
      "Exports a real, selectable PDF and a Word document — no print-dialog hack.",
    ],
    stack: ["Groq", "jsPDF", "mammoth / unpdf"],
  },
  {
    index: "06",
    icon: FiLayers,
    title: "Model Context Protocol",
    tagline: "The agents pull live data through the same protocol Claude uses for tools.",
    bullets: [
      "A token-gated, read-only MCP server exposes my portfolio, net worth, dividends and budget over JSON-RPC.",
      "The briefing and investing agents call those tools directly — richer than a flat REST snapshot.",
      "Tolerant handshake: an optional initialize can hiccup without breaking the data pull.",
    ],
    stack: ["MCP / JSON-RPC", "Bearer auth", "SHA-256 tokens"],
  },
];

const PRINCIPLES: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string }[] = [
  {
    icon: FiShield,
    title: "Human-in-the-loop by default",
    body: "Agents surface and draft; a human commits. Anything that acts outward is opt-in — the auto-reply sender ships OFF, behind an explicit toggle.",
  },
  {
    icon: FiRepeat,
    title: "Idempotent triggers",
    body: "A 15-minute cron drives the daily posts, gated by a timezone clock, a once-a-day flag and an atomic row claim — so it can never double-send.",
  },
  {
    icon: FiGitBranch,
    title: "Loose coupling",
    body: "Agents coordinate through shared state (a profile row, an ideas queue), never point-to-point — so the system grows without rewiring.",
  },
  {
    icon: FiShield,
    title: "Fail safe, not open",
    body: "Every guard defaults to deny: a missing flag reads as off, a failed save leaves it off, tolerant JSON parsing recovers instead of crashing a flow.",
  },
];

const STACK = [
  "Next.js 16",
  "TypeScript",
  "Supabase",
  "Postgres + pgvector",
  "Vercel Cron",
  "Edge middleware",
  "Groq · Llama + vision",
  "Model Context Protocol",
  "Gmail OAuth",
  "Buffer",
  "Tailwind",
];

const FLOW = ["Cron / event", "Agent · LLM + web", "Shared state", "You review", "Action"];

export default function SystemsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white relative">
      <Navbar />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] bg-[#ff6b00]/[0.07] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-0 w-[420px] h-[420px] bg-[#ff3d00]/[0.05] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 lg:px-10 py-16 lg:py-24 pb-32">
        <Link href="/" className="inline-flex items-center gap-2 text-[#777] text-sm mb-10 hover:text-[#ff6b00] transition-colors">
          <FiArrowLeft size={14} />
          Back to portfolio
        </Link>

        {/* Header */}
        <header className="mb-12">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">// Behind the portfolio</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-5 max-w-3xl text-balance">
            The AI platform I built to run{" "}
            <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
              on autopilot
            </span>
          </h1>
          <p className="text-[#999] text-lg leading-relaxed max-w-2xl">
            This site is the front door. Behind the login is a personal AI operations platform I designed, built, and
            deploy myself — autonomous agents that scout the web and my inbox, a CRM that reads email to classify people,
            a social studio, and a résumé engine. This is the AI engineering I want to do full-time.
          </p>

          {/* Stat row */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 font-mono text-sm">
            {[
              ["6", "autonomous agents"],
              ["3", "cron systems"],
              ["1", "builder — end to end"],
            ].map(([n, label]) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="text-[#ff8c38] text-xl font-bold tabular-nums">{n}</span>
                <span className="text-[#777] text-xs uppercase tracking-widest">{label}</span>
              </div>
            ))}
          </div>

          {/* How a run flows */}
          <div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {FLOW.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-[#1a1a1a] border border-white/[0.06] text-[#bbb]">{step}</span>
                {i < FLOW.length - 1 && <span className="text-[#ff6b00]/60">→</span>}
              </span>
            ))}
          </div>
        </header>

        {/* Systems */}
        <section className="mb-16">
          <div className="flex items-end gap-4 mb-7">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#ff6b00] to-transparent shrink-0 mb-2.5" />
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              The systems
              <span className="ml-3 text-sm font-mono text-[#666]">{SYSTEMS.length} built &amp; live</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {SYSTEMS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.index}
                  className="group relative rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-300 p-6 overflow-hidden hover:-translate-y-0.5"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#ff6b00] to-transparent opacity-70" />
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#ff6b00]/10 border border-[#ff6b00]/20 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#ff8c38]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-[#ff6b00]/70">{s.index}</span>
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        <h3 className="text-white font-bold leading-tight">{s.title}</h3>
                      </div>
                      <p className="text-[#888] text-sm leading-relaxed mb-4">{s.tagline}</p>
                      <ul className="space-y-2 mb-4">
                        {s.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-[#bbb] leading-relaxed">
                            <span className="text-[#ff6b00]/60 mt-1.5 shrink-0">▸</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1.5">
                        {s.stack.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#888]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Engineering principles */}
        <section className="mb-16">
          <div className="flex items-end gap-4 mb-7">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#ff6b00] to-transparent shrink-0 mb-2.5" />
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              How it&apos;s engineered
              <span className="ml-3 text-sm font-mono text-[#666]">the parts that matter</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PRINCIPLES.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-2xl bg-[#111] border border-white/[0.06] p-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon size={15} className="text-[#ff8c38] shrink-0" />
                    <h3 className="text-white font-semibold text-sm">{p.title}</h3>
                  </div>
                  <p className="text-[#999] text-[13px] leading-relaxed">{p.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Stack */}
        <section className="mb-16">
          <div className="flex items-end gap-4 mb-6">
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#ff6b00] to-transparent shrink-0 mb-2.5" />
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">The stack</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {STACK.map((t) => (
              <span
                key={t}
                className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/[0.06] text-[#bbb] hover:border-[#ff6b00]/30 hover:text-[#ff8c38] transition-colors"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-[#ff6b00]/25 bg-gradient-to-br from-[#ff6b00]/[0.08] to-transparent p-8">
          <div className="flex items-center gap-2 mb-3">
            <FiCpu size={16} className="text-[#ff8c38]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#ff6b00]">Let&apos;s build</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-3 max-w-2xl text-balance">
            This is the kind of AI engineering I want to do full-time.
          </h2>
          <p className="text-[#999] text-sm leading-relaxed max-w-2xl mb-6">
            Seven years bridging enterprise SAP and now AI systems — shipped solo, end to end. If your team is building
            with agents, LLMs, or automation, I&apos;d love to talk.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/Krishna_Amarneni_Resume.docx"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black text-sm font-bold hover:scale-[1.03] transition-transform shadow-[0_4px_20px_rgba(255,107,0,0.3)]"
            >
              <FiDownload size={14} /> Download résumé
            </a>
            <Link
              href="/#contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-white text-sm font-semibold hover:border-[#ff6b00]/50 hover:text-[#ff8c38] transition-colors"
            >
              <FiCheck size={14} /> Get in touch
              <FiArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
