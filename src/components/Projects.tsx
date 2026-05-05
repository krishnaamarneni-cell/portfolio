"use client";

import { useState } from "react";
import Image from "next/image";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { FiExternalLink, FiArrowUpRight, FiChevronLeft, FiChevronRight } from "react-icons/fi";

type Project = {
  title: string;
  subtitle: string;
  number: string;
  description: string;
  link: string;
  tags: string[];
  gradient: string;
  preview: string; // local PNG screenshot
};

const projects: Project[] = [
  {
    title: "WealthClaude",
    subtitle: "AI Finance Tracking Platform",
    number: "01",
    description:
      "Full portfolio tracker with 3D globe across 51 markets, AI market intelligence, dividend analytics, 15+ calculators, and 7-layer security.",
    link: "https://www.wealthclaude.com",
    tags: ["Next.js", "Supabase", "Three.js", "Stripe", "Groq AI"],
    gradient: "from-[#22c55e] to-[#16a34a]",
    preview: "/previews/wealthclaude.png",
  },
  {
    title: "North Falmouth Pharmacy",
    subtitle: "LTC Pharmacy · Cape Cod",
    number: "02",
    description:
      "Long-term care pharmacy website serving Cape Cod facilities — eMAR integration, compliance packaging, immunizations, enrollment forms.",
    link: "https://www.nfpltc.com",
    tags: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
    gradient: "from-[#f59e0b] to-[#ea580c]",
    preview: "/previews/nfpltc.png",
  },
  {
    title: "Auburn RX Pharmacy",
    subtitle: "Independent Retail Pharmacy",
    number: "03",
    description:
      "Modern pharmacy website featuring online refill requests, immunization booking, prescription transfer, and local healthcare resources.",
    link: "https://auburnrx.vercel.app",
    tags: ["Next.js", "TypeScript", "Tailwind CSS", "Vercel"],
    gradient: "from-[#0ea5e9] to-[#0284c7]",
    preview: "/previews/auburnrx.png",
  },
  {
    title: "Saint Francis Medical",
    subtitle: "Healthcare & Medical Practice",
    number: "04",
    description:
      "Patient-focused medical practice website with appointment booking, services overview, provider profiles, and HIPAA-conscious contact forms.",
    link: "https://saint-francis-medical.vercel.app",
    tags: ["Next.js", "React", "Tailwind CSS", "Vercel"],
    gradient: "from-[#8b5cf6] to-[#6d28d9]",
    preview: "/previews/saint-francis.png",
  },
  {
    title: "Lucy AI",
    subtitle: "Autonomous AI Agent",
    number: "05",
    description:
      "An autonomous agent handling 50+ tasks: Gmail, Calendar, social media, job applications, writes & deploys her own code, daily briefings.",
    link: "https://www.lucyaiagent.com",
    tags: ["Python", "Claude AI", "Next.js", "Supabase", "Vercel"],
    gradient: "from-[#ff6b00] to-[#ff3d00]",
    preview: "/previews/lucyaiagent.png",
  },
];


function ProjectCard({ project, index }: { project: Project; index: number }) {
  const dirs = ["flipY", "rotate3d", "zoom3d", "flipX", "rotate3d"] as const;
  const screenshot = project.preview;

  return (
    <ScrollReveal delay={index * 0.1} direction={dirs[index % dirs.length]}>
      <a
        href={project.link}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full"
      >
        <TiltCard className="h-full rounded-[20px]" intensity={10}>
          <div className="h-full rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-500 overflow-hidden shadow-3d card-3d-shine">
            {/* === BROWSER FRAME WITH SCREENSHOT === */}
            <div className="bg-[#0a0a0a] border-b border-white/[0.06] flex flex-col">
              {/* Browser top bar (sits ABOVE screenshot, doesn't overlay it) */}
              <div className="h-8 bg-[#1a1a1a] border-b border-white/[0.06] flex items-center px-3 gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-2 h-5 rounded bg-[#0a0a0a] border border-white/[0.04] flex items-center justify-center">
                  <span className="text-[#777] text-[10px] font-mono truncate px-2">
                    🔒 {project.link.replace(/^https?:\/\//, "")}
                  </span>
                </div>
              </div>

              {/* Screenshot — Next/Image optimized (WebP, sharp at any size) */}
              <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.02]">
                <Image
                  src={screenshot}
                  alt={`${project.title} preview`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  quality={95}
                  className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                />

                {/* Fallback gradient */}
                <div
                  className={`absolute inset-0 -z-0 bg-gradient-to-br ${project.gradient} opacity-30`}
                />

                {/* Hover dim overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* External link badge on hover */}
                <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#ff6b00] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 shadow-[0_4px_20px_rgba(255,107,0,0.5)]">
                  <FiArrowUpRight size={16} className="text-white" strokeWidth={2.5} />
                </div>

                {/* Project number watermark */}
                <span className="absolute bottom-2 right-3 text-3xl font-black text-white/20 select-none drop-shadow-lg">
                  {project.number}
                </span>
              </div>
            </div>

            {/* === CONTENT === */}
            <div className="p-6 lg:p-7">
              <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${project.gradient} mb-4`} />

              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#ff6b00] transition-colors">
                {project.title}
              </h3>
              <p className="text-[#ff6b00] text-xs font-mono mb-3">{project.subtitle}</p>
              <p className="text-[#888] text-sm leading-relaxed mb-5 line-clamp-3">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {project.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#999] font-mono"
                  >
                    {t}
                  </span>
                ))}
                {project.tags.length > 4 && (
                  <span className="text-[10px] px-2 py-1 rounded-md text-[#555] font-mono">
                    +{project.tags.length - 4}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                <span className="flex items-center gap-1.5 text-xs text-[#ff6b00] font-medium">
                  <FiExternalLink size={12} />
                  Visit Live Site
                </span>
                <FiArrowUpRight
                  size={16}
                  className="text-[#666] group-hover:text-[#ff6b00] group-hover:rotate-45 transition-all"
                />
              </div>
            </div>
          </div>
        </TiltCard>
      </a>
    </ScrollReveal>
  );
}

const PER_PAGE = 3;

export default function Projects() {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(projects.length / PER_PAGE);

  // Loop pagination
  const next = () => setPage((p) => (p + 1) % totalPages);
  const prev = () => setPage((p) => (p - 1 + totalPages) % totalPages);

  const start = page * PER_PAGE;
  const visible = projects.slice(start, start + PER_PAGE);

  return (
    <section id="projects" className="relative py-28 lg:py-36 px-6 lg:px-10">
      <Parallax3D speed={0.03} rotateIntensity={1}>
        <div className="absolute top-20 right-6 lg:right-10 text-[100px] lg:text-[160px] font-bold text-stroke-orange leading-none select-none pointer-events-none">
          WORK
        </div>
      </Parallax3D>

      <div className="max-w-7xl mx-auto relative">
        <div className="flex items-end justify-between mb-16 gap-6">
          <div className="flex-1">
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
              <p className="text-[#666] text-lg max-w-xl">
                Real products, shipped to real users. Click any card to visit the live site.
              </p>
            </ScrollReveal>
          </div>

          {/* Pagination controls */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={prev}
              className="w-11 h-11 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 text-white flex items-center justify-center transition-all active:scale-95"
              aria-label="Previous projects"
            >
              <FiChevronLeft size={18} />
            </button>
            <span className="text-[#888] text-sm font-mono min-w-[60px] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={next}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white flex items-center justify-center shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-105 active:scale-95 transition-all"
              aria-label="Next projects"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          key={page}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-[fadeIn_0.5s_ease-out]"
        >
          {visible.map((p, i) => (
            <ProjectCard key={`${page}-${p.title}`} project={p} index={i} />
          ))}
        </div>

        {/* Page dots */}
        <div className="flex items-center justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`h-2 rounded-full transition-all ${
                i === page ? "w-8 bg-[#ff6b00]" : "w-2 bg-white/[0.15] hover:bg-white/30"
              }`}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>

        {/* Mobile pagination buttons */}
        <div className="flex md:hidden items-center justify-center gap-3 mt-6">
          <button
            onClick={prev}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] text-white flex items-center justify-center"
            aria-label="Previous"
          >
            <FiChevronLeft size={16} />
          </button>
          <span className="text-[#888] text-xs font-mono min-w-[50px] text-center">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={next}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white flex items-center justify-center shadow-md"
            aria-label="Next"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
