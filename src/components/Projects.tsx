"use client";

import { useState } from "react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { FiExternalLink, FiArrowRight } from "react-icons/fi";
import {
  SiNextdotjs, SiReact, SiTypescript, SiTailwindcss, SiSupabase,
  SiStripe, SiPython, SiVercel, SiThreedotjs,
} from "react-icons/si";
import { FiCpu, FiDatabase } from "react-icons/fi";

const techIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "Next.js": SiNextdotjs, React: SiReact, TypeScript: SiTypescript,
  "Tailwind CSS": SiTailwindcss, Supabase: SiSupabase, Stripe: SiStripe,
  Python: SiPython, Vercel: SiVercel, "Three.js": SiThreedotjs,
  "Groq AI": FiCpu, PostgreSQL: FiDatabase, "Claude AI": FiCpu,
  Recharts: SiReact, Resend: FiCpu,
};

const projects = [
  {
    title: "WealthClaude",
    subtitle: "AI Finance Tracking Platform",
    number: "01",
    description:
      "Full-featured portfolio tracker with 3D interactive globe tracking 51 global stock markets. AI-powered market intelligence, dividend tracking, 15+ financial calculators, and real-time analytics with 7-layer security.",
    link: "https://www.wealthclaude.com",
    features: [
      "3D globe tracking 51 global markets",
      "AI market news & portfolio summaries",
      "50+ brokerage import support",
      "7-layer security system",
      "Stripe subscription payments",
      "15+ financial calculators",
    ],
    tech: ["Next.js", "TypeScript", "Supabase", "Three.js", "Stripe", "Groq AI", "Tailwind CSS", "Python", "Recharts", "Resend"],
    gradient: "from-orange-500 to-amber-500",
  },
  {
    title: "Lucy AI",
    subtitle: "Autonomous AI Agent — 50+ Tasks",
    number: "02",
    description:
      "An autonomous AI agent handling 50+ tasks: Gmail, Calendar, social media, job applications, writing & deploying code, building websites, daily briefings, finance research, and news aggregation. Lucy can write her own code.",
    link: "https://www.lucyaiagent.com",
    features: [
      "Gmail, Calendar & task management",
      "Social media automation",
      "Auto-apply to job applications",
      "Write, build & deploy code autonomously",
      "Daily briefings & news aggregation",
      "Finance research & analysis",
    ],
    tech: ["Python", "Next.js", "TypeScript", "Claude AI", "Supabase", "Vercel"],
    gradient: "from-orange-600 to-red-500",
  },
  {
    title: "North Falmouth Pharmacy",
    subtitle: "Healthcare Website — Full Build",
    number: "03",
    description:
      "Complete website for an independent long-term care pharmacy serving Cape Cod. 10+ service pages, eMAR integration, compliance packaging, immunization services, enrollment forms, and local SEO optimization.",
    link: "https://www.nfpltc.com",
    features: [
      "10+ detailed service pages",
      "Responsive healthcare design",
      "Enrollment & consent forms",
      "FAQ & contact system",
      "Local SEO optimization",
      "24/7 pharmacist access info",
    ],
    tech: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Vercel"],
    gradient: "from-amber-500 to-orange-500",
  },
];

function ProjectCard({ project, index }: { project: typeof projects[0]; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const dirs = ["flipY", "rotate3d", "zoom3d"] as const;

  return (
    <ScrollReveal delay={index * 0.15} direction={dirs[index]}>
      <div className="perspective-1200 w-full" style={{ perspective: "1200px" }}>
        <div
          className={`relative w-full min-h-[580px] transition-transform duration-700 preserve-3d cursor-pointer ${
            flipped ? "rotate-y-180" : ""
          }`}
          onClick={() => setFlipped(!flipped)}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* FRONT */}
          <div className="absolute inset-0 backface-hidden" style={{ backfaceVisibility: "hidden" }}>
            <TiltCard className="h-full rounded-[20px]" intensity={15}>
              <div className="h-full rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-8 lg:p-10 flex flex-col hover:border-[#ff6b00]/20 transition-all duration-500 group overflow-hidden relative card-3d-shine shadow-3d">
                <span className="absolute top-6 right-8 text-8xl font-bold text-white/[0.03] select-none">
                  {project.number}
                </span>

                <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${project.gradient} mb-8`} />

                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2 group-hover:text-[#ff6b00] transition-colors duration-300">
                  {project.title}
                </h3>
                <p className="text-[#ff6b00] text-sm font-mono mb-5">{project.subtitle}</p>
                <p className="text-[#888] text-sm leading-relaxed mb-8 flex-grow">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {project.tech.slice(0, 5).map((t) => {
                    const Icon = techIcons[t];
                    return (
                      <span
                        key={t}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04] text-[#999] hover:border-[#ff6b00]/20 hover:text-[#ff6b00] transition-all"
                      >
                        {Icon && <Icon size={13} />}
                        {t}
                      </span>
                    );
                  })}
                  {project.tech.length > 5 && (
                    <span className="text-xs px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04] text-[#555]">
                      +{project.tech.length - 5}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 text-sm text-[#ff6b00] hover:gap-3 transition-all font-medium"
                  >
                    <FiExternalLink size={15} />
                    Visit Live Site
                  </a>
                  <span className="text-xs text-[#444] flex items-center gap-1 group-hover:text-[#666] transition-colors">
                    Flip for features <FiArrowRight size={12} />
                  </span>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* BACK */}
          <div className="absolute inset-0 backface-hidden rotate-y-180" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="h-full rounded-2xl bg-[#1a1a1a] border border-[#ff6b00]/20 p-8 lg:p-10 flex flex-col overflow-hidden relative shadow-3d">
              <span className="absolute top-6 right-8 text-8xl font-bold text-[#ff6b00]/[0.05] select-none">
                {project.number}
              </span>

              <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${project.gradient} mb-6`} />
              <h3 className="text-xl font-bold text-white mb-1">Key Features</h3>
              <p className="text-[#ff6b00] text-sm font-mono mb-6">{project.title}</p>

              <ul className="space-y-4 flex-grow">
                {project.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-[#ccc] text-sm">
                    <span className="mt-1 w-2 h-2 rounded-full bg-[#ff6b00] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <p className="text-xs text-[#555] mb-3 uppercase tracking-wider">Full Tech Stack</p>
                <div className="flex flex-wrap gap-2">
                  {project.tech.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#ff6b00]/[0.06] border border-[#ff6b00]/10 text-[#ff8c38]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mt-5">
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-sm text-[#ff6b00] font-medium"
                >
                  <FiExternalLink size={15} />
                  Visit Site
                </a>
                <span className="text-xs text-[#444]">Click to flip back</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}

export default function Projects() {
  return (
    <section id="projects" className="relative py-28 lg:py-36 px-6 lg:px-10">
      <Parallax3D speed={0.03} rotateIntensity={1}>
        <div className="absolute top-20 right-6 lg:right-10 text-[100px] lg:text-[160px] font-bold text-stroke-orange leading-none select-none pointer-events-none">
          WORK
        </div>
      </Parallax3D>

      <div className="max-w-7xl mx-auto relative">
        <ScrollReveal direction="rotate3d">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            // Featured Projects
          </p>
        </ScrollReveal>

        <ScrollReveal direction="flipX" delay={0.1}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Things I&apos;ve <span className="text-gradient">Built</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal direction="zoom3d" delay={0.15}>
          <p className="text-[#666] text-lg mb-16 max-w-xl">
            Each project was designed, developed, and deployed by me.
            Click any card to flip and explore features.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
