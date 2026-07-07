"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { FiExternalLink, FiArrowUpRight, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import HoverSpotlight from "./HoverSpotlight";
import { FALLBACK_PROJECTS } from "@/lib/content-fallback";
import type { Project } from "@/lib/content-types";


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
          <div className="h-full rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[#ff6b00]/30 transition-all duration-500 overflow-hidden shadow-3d card-3d-shine">
            {/* === BROWSER FRAME WITH SCREENSHOT === */}
            <div className="bg-[var(--bg-primary)] border-b border-[var(--border)] flex flex-col">
              {/* Browser top bar (sits ABOVE screenshot, doesn't overlay it) */}
              <div className="h-8 bg-[var(--bg-card)] border-b border-[var(--border)] flex items-center px-3 gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-2 h-5 rounded bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[var(--text-secondary)] text-[10px] font-mono truncate px-2">
                    🔒 {project.link.replace(/^https?:\/\//, "")}
                  </span>
                </div>
              </div>

              {/* Screenshot — raw 4K PNG, browser handles retina downscale crisply */}
              <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.02]">
                <Image
                  src={screenshot}
                  alt={`${project.title} preview`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px"
                  quality={100}
                  unoptimized
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
                <span className="absolute bottom-2 right-3 text-3xl font-black text-[var(--text-primary)]/20 select-none drop-shadow-lg">
                  {project.number}
                </span>
              </div>
            </div>

            {/* === CONTENT === */}
            <div className="p-6 lg:p-7">
              <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${project.gradient} mb-4`} />

              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1 group-hover:text-[#ff6b00] transition-colors">
                {project.title}
              </h3>
              <p className="text-[#ff6b00] text-xs font-mono mb-3">{project.subtitle}</p>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-5 line-clamp-3">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {project.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-[var(--border)] text-[var(--text-secondary)] font-mono"
                  >
                    {t}
                  </span>
                ))}
                {project.tags.length > 4 && (
                  <span className="text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)] font-mono">
                    +{project.tags.length - 4}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <span className="flex items-center gap-1.5 text-xs text-[#ff6b00] font-medium">
                  <FiExternalLink size={12} />
                  Visit Live Site
                </span>
                <FiArrowUpRight
                  size={16}
                  className="text-[var(--text-muted)] group-hover:text-[#ff6b00] group-hover:rotate-45 transition-all"
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
  const [projects, setProjects] = useState<Project[]>(FALLBACK_PROJECTS);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.projects) && d.projects.length > 0) {
          setProjects(d.projects);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(projects.length / PER_PAGE));

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
              <HoverSpotlight as="h2" className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] leading-tight mb-6 cursor-default">
                Things I&apos;ve <span className="text-gradient">Built</span>
              </HoverSpotlight>
            </ScrollReveal>

            <ScrollReveal direction="zoom3d" delay={0.15}>
              <p className="text-[var(--text-muted)] text-lg max-w-xl">
                Real products, shipped to real users. Click any card to visit the live site.
              </p>
            </ScrollReveal>
          </div>

          {/* Pagination controls */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={prev}
              className="w-11 h-11 rounded-full bg-white/[0.04] border border-[var(--border)] hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 text-[var(--text-primary)] flex items-center justify-center transition-all active:scale-95"
              aria-label="Previous projects"
            >
              <FiChevronLeft size={18} />
            </button>
            <span className="text-[var(--text-secondary)] text-sm font-mono min-w-[60px] text-center">
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
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-center"
            aria-label="Previous"
          >
            <FiChevronLeft size={16} />
          </button>
          <span className="text-[var(--text-secondary)] text-xs font-mono min-w-[50px] text-center">
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
