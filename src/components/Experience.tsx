"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import ScrollReveal from "./ScrollReveal";
import ScrollTrack from "./ScrollTrack";
import { FiBriefcase, FiMapPin, FiCalendar } from "react-icons/fi";
import { FALLBACK_JOBS } from "@/lib/content-fallback";
import type { Job } from "@/lib/content-types";

type Experience = {
  title: string;
  category: string;
  company: string;
  location: string;
  period: string;
  logo: { src: string; bg: string };
  description: string;
  highlights: string[];
  tags: string[];
};

function toExperience(j: Job): Experience {
  return {
    title: j.title,
    category: j.category,
    company: j.company,
    location: j.location,
    period: j.period,
    logo: { src: j.logo_src ?? "", bg: j.logo_bg },
    description: j.description,
    highlights: j.highlights,
    tags: j.tags,
  };
}

/* ── 3D tilt on cursor move ── */
function FloatCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) translateZ(8px)`,
      transition: "transform 0.1s ease-out",
    });
  }, []);

  const handleLeave = useCallback(() => {
    setStyle({
      transform: "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)",
      transition: "transform 0.4s ease-out",
    });
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}

export default function Experience() {
  const [experiences, setExperiences] = useState<Experience[]>(() =>
    FALLBACK_JOBS.map(toExperience)
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll-based index + per-card progress tracking
  const [cardProgress, setCardProgress] = useState(0); // 0-1 how far next card has risen

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.jobs) && d.jobs.length > 0) {
          setExperiences(d.jobs.map(toExperience));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const sectionHeight = el.scrollHeight - window.innerHeight;
      const scrolled = -rect.top;
      const raw = Math.max(0, Math.min(1, scrolled / sectionHeight));
      const scaled = raw * experiences.length;
      const idx = Math.min(experiences.length - 1, Math.floor(scaled));
      const frac = scaled - idx; // 0-1 progress within current card
      setActiveIndex(idx);
      setCardProgress(frac);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [experiences.length]);

  if (experiences.length === 0) return null;
  const safeIndex = Math.min(activeIndex, experiences.length - 1);
  const activeExp = experiences[safeIndex];
  const activeLogo = activeExp.logo;

  return (
    <section id="experience" className="relative">
      {/* Section header */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-28 lg:pt-36 pb-8">
        <ScrollReveal direction="rotate3d">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            // Where I&apos;ve Worked
          </p>
        </ScrollReveal>
        <ScrollReveal direction="flipX" delay={0.1}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] leading-tight">
            Professional <span className="text-gradient">Experience</span>
          </h2>
        </ScrollReveal>
      </div>

      <ScrollTrack text="EXPERIENCE" direction="left" />

      {/* Scroll container — height creates scroll distance, cards are fixed inside */}
      <div
        ref={scrollRef}
        style={{ height: `${experiences.length * 140}vh` }}
        className="relative"
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 h-full">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 h-full items-center">

              {/* LEFT: Card stack — new cards rise from below onto the pile */}
              <div className="lg:col-span-7 relative" style={{ height: "fit-content" }}>
                <div className="relative">
                  {experiences.map((exp, i) => {
                    const isLanded = i <= activeIndex; // already on the stack
                    const isTop = i === activeIndex;
                    const isNext = i === activeIndex + 1; // the card currently rising up
                    const depth = activeIndex - i;

                    // Hold current card for 55% of its scroll, then transition in the next 45%
                    const HOLD = 0.55;
                    const transitionProgress = cardProgress < HOLD ? 0 : (cardProgress - HOLD) / (1 - HOLD);

                    // Next card rises from bottom during transition phase only
                    const riseAmount = isNext ? (1 - transitionProgress) * 110 : 0; // 110% -> 0%
                    const riseOpacity = isNext ? transitionProgress : 0;

                    return (
                      <div
                        key={`${exp.company}-${exp.period}`}
                        className={isNext ? "" : "transition-all duration-500"}
                        style={{
                          position: i === 0 ? "relative" : "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          zIndex: i + 1,
                          opacity: isNext
                            ? riseOpacity
                            : !isLanded
                            ? 0
                            : isTop
                            ? 1
                            : 0,
                          transform: isNext
                            ? `translateY(${riseAmount}%) scale(0.96)`
                            : !isLanded
                            ? "translateY(100%) scale(0.9)"
                            : isTop
                            ? "translateY(0) scale(1)"
                            : `translateY(${-depth * 6}px) scale(${1 - depth * 0.02})`,
                          pointerEvents: isTop ? "auto" : "none",
                          visibility: isTop || isNext ? "visible" : "hidden",
                        }}
                      >
                        <FloatCard className="w-full">
                          <div
                            className={`w-full rounded-3xl p-8 lg:p-10 relative overflow-hidden border transition-colors duration-500 ${
                              isTop
                                ? "bg-white text-[#0c0c0c] shadow-[0_30px_80px_rgba(0,0,0,0.5)] border-white/20"
                                : "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_5px_20px_rgba(0,0,0,0.2)] border-[var(--border)]"
                            }`}
                          >
                            {/* Category */}
                            <p
                              className={`text-sm mb-3 font-medium ${
                                isTop ? "text-[#c2410c]" : "text-[#ff6b00]/50"
                              }`}
                              style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                            >
                              {exp.category}
                            </p>

                            {/* Title */}
                            <h3 className={`text-3xl lg:text-4xl font-bold mb-3 leading-tight ${
                              isTop ? "text-[#0c0c0c]" : "text-[var(--text-primary)]"
                            }`}>
                              {exp.title}
                            </h3>

                            {/* Meta */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
                              <span className={`flex items-center gap-1.5 text-sm font-semibold ${
                                isTop ? "text-[#333]" : "text-[#999]"
                              }`}>
                                <FiBriefcase size={14} className="text-[#ff6b00]" />
                                {exp.company}
                              </span>
                              <span className={`flex items-center gap-1.5 text-sm ${
                                isTop ? "text-[#6b6b6b]" : "text-[var(--text-muted)]"
                              }`}>
                                <FiMapPin size={13} />
                                {exp.location}
                              </span>
                              <span className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full ${
                                isTop ? "bg-[#f5f5f5] text-[#6b6b6b]" : "bg-white/[0.05] text-[#666]"
                              }`}>
                                <FiCalendar size={11} />
                                {exp.period}
                              </span>
                            </div>

                            {/* Description */}
                            <p className={`text-base leading-relaxed mb-5 ${
                              isTop ? "text-[#555]" : "text-[var(--text-secondary)]"
                            }`}>
                              {exp.description}
                            </p>

                            {/* Highlights */}
                            <ul className="space-y-2 mb-5">
                              {exp.highlights.map((h, j) => (
                                <li key={j} className={`flex items-start gap-3 text-sm ${
                                  isTop ? "text-[#666]" : "text-[#888]"
                                }`}>
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#ff6b00] shrink-0" />
                                  {h}
                                </li>
                              ))}
                            </ul>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2">
                              {exp.tags.map((t) => (
                                <span
                                  key={t}
                                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                                    isTop
                                      ? "bg-[#ff6b00]/10 text-[#c2410c] border border-[#ff6b00]/20"
                                      : "bg-[#ff6b00]/[0.06] text-[#ff8c38] border border-[#ff6b00]/15"
                                  }`}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>

                            {/* Mobile logo */}
                            <div className="lg:hidden mt-6 flex items-center gap-4 pt-5 border-t border-black/5">
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                                style={{ backgroundColor: exp.logo.bg }}
                              >
                                {exp.logo.src ? (
                                  <Image src={exp.logo.src} alt={exp.company} width={40} height={40} className="object-contain" />
                                ) : (
                                  <span className="text-xs font-bold text-white">{exp.company.slice(0, 3)}</span>
                                )}
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${isTop ? "text-[#333]" : "text-[var(--text-primary)]"}`}>{exp.company}</p>
                                <p className={`text-xs ${isTop ? "text-[#6b6b6b]" : "text-[var(--text-muted)]"}`}>{exp.location}</p>
                              </div>
                            </div>
                          </div>
                        </FloatCard>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Sticky company logo */}
              <div className="hidden lg:flex lg:col-span-5 items-center justify-center">
                <div className="relative w-full flex flex-col items-center">
                  <div
                    className="relative w-80 h-96 rounded-3xl flex items-center justify-center transition-all duration-700 overflow-hidden"
                    style={{
                      backgroundColor: activeLogo.bg,
                      transform: "perspective(800px) rotateY(-5deg) rotateX(2deg)",
                      boxShadow: `0 30px 80px ${activeLogo.bg}40, 0 10px 30px rgba(0,0,0,0.3)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 z-10" />
                    {activeLogo.src ? (
                      <Image
                        src={activeLogo.src}
                        alt={activeExp.company}
                        width={200}
                        height={200}
                        className="relative z-0 object-contain max-w-[70%] max-h-[70%] transition-all duration-500"
                      />
                    ) : (
                      <span className="relative z-0 text-4xl font-bold tracking-wider text-white transition-all duration-500">
                        {activeExp.company}
                      </span>
                    )}
                  </div>

                  <div className="text-center mt-8">
                    <p className="text-[var(--text-primary)] font-bold text-xl transition-all duration-500">
                      {activeExp.company}
                    </p>
                    <p className="text-[var(--text-muted)] text-sm mt-1 flex items-center justify-center gap-1.5">
                      <FiMapPin size={13} />
                      {activeExp.location}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs font-mono mt-2">
                      {activeExp.period}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScrollTrack text="CAREER · JOURNEY" direction="right" />

      {/* Education */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-28 lg:pb-36">
        <ScrollReveal direction="zoom3d" delay={0.2}>
          <div className="rounded-3xl bg-white text-[#0c0c0c] p-8 flex flex-col md:flex-row md:items-center gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className="w-14 h-14 rounded-2xl bg-[#ff6b00] flex items-center justify-center shrink-0">
              <span className="text-white text-2xl font-bold">E</span>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">Education</h3>
              <p className="text-[var(--text-secondary)] text-sm">
                Bachelor&apos;s Degree — Automotive Engineering &nbsp;|&nbsp; Master&apos;s — Data Analytics
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
