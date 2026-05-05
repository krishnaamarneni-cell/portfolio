"use client";

import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { FiExternalLink, FiArrowUpRight } from "react-icons/fi";

type Project = {
  title: string;
  subtitle: string;
  number: string;
  description: string;
  link: string;
  tags: string[];
  gradient: string;
  // Live screenshot via thum.io (free, no API key)
  // Falls back gracefully if blocked
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
  },
  {
    title: "Lucy AI",
    subtitle: "Autonomous AI Agent",
    number: "02",
    description:
      "An autonomous agent handling 50+ tasks: Gmail, Calendar, social media, job applications, writes & deploys her own code, daily briefings.",
    link: "https://www.lucyaiagent.com",
    tags: ["Python", "Claude AI", "Next.js", "Supabase", "Vercel"],
    gradient: "from-[#ff6b00] to-[#ff3d00]",
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
  },
  {
    title: "North Falmouth Pharmacy",
    subtitle: "LTC Pharmacy · Cape Cod",
    number: "05",
    description:
      "Long-term care pharmacy website serving Cape Cod facilities — eMAR integration, compliance packaging, immunizations, enrollment forms.",
    link: "https://www.nfpltc.com",
    tags: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
    gradient: "from-[#f59e0b] to-[#ea580c]",
  },
];


function getScreenshotUrl(url: string) {
  // thum.io free, no auth, public endpoint — generates a live screenshot
  const cleaned = url.replace(/^https?:\/\//, "");
  return `https://image.thum.io/get/width/1200/crop/750/noanimate/${cleaned}`;
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const dirs = ["flipY", "rotate3d", "zoom3d", "flipX", "rotate3d"] as const;
  const screenshot = getScreenshotUrl(project.link);

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
            {/* === LIVE SCREENSHOT PREVIEW === */}
            <div className="relative aspect-[16/10] overflow-hidden bg-[#0a0a0a] border-b border-white/[0.06]">
              {/* Browser top bar */}
              <div className="absolute top-0 inset-x-0 h-7 bg-[#0d0d0d]/95 backdrop-blur-sm border-b border-white/[0.05] z-10 flex items-center px-3 gap-1.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400/70" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
                  <div className="w-2 h-2 rounded-full bg-green-400/70" />
                </div>
                <div className="flex-1 mx-2 h-4 rounded bg-[#1a1a1a] flex items-center justify-center">
                  <span className="text-[#666] text-[9px] font-mono truncate px-2">
                    {project.link.replace(/^https?:\/\//, "")}
                  </span>
                </div>
              </div>

              {/* Screenshot */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt={`${project.title} preview`}
                loading="lazy"
                className="w-full h-full object-cover object-top pt-7 transition-transform duration-700 group-hover:scale-[1.04]"
                onError={(e) => {
                  // Hide broken image — fallback gradient bg shows through
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />

              {/* Fallback gradient (visible if image fails) */}
              <div
                className={`absolute inset-x-0 bottom-0 top-7 -z-0 bg-gradient-to-br ${project.gradient} opacity-30`}
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* External link badge on hover */}
              <div className="absolute top-10 right-3 w-9 h-9 rounded-full bg-[#ff6b00] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 shadow-[0_4px_20px_rgba(255,107,0,0.5)]">
                <FiArrowUpRight size={16} className="text-white" strokeWidth={2.5} />
              </div>

              {/* Project number watermark */}
              <span className="absolute bottom-2 right-3 text-3xl font-black text-white/15 select-none">
                {project.number}
              </span>
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
            Real products, shipped to real users. Click any card to visit the live site.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
