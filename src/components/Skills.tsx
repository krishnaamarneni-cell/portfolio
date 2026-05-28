"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { useSiteContent } from "./SiteContentProvider";

const SkillsAvatar = dynamic(() => import("./Avatar3D").then(mod => ({ default: mod.SkillsAvatar })), { ssr: false });
import {
  SiNextdotjs, SiReact, SiTypescript, SiPython, SiTailwindcss,
  SiSupabase, SiPostgresql, SiStripe, SiThreedotjs, SiVercel,
  SiGit, SiDocker, SiFramer, SiOpenai,
} from "react-icons/si";
import { FiDatabase, FiServer, FiCpu, FiTool, FiZap } from "react-icons/fi";
import type { IconType } from "react-icons";

const SKILL_ICONS: Record<string, IconType> = {
  "Next.js": SiNextdotjs,
  React: SiReact,
  TypeScript: SiTypescript,
  Python: SiPython,
  "Tailwind CSS": SiTailwindcss,
  Supabase: SiSupabase,
  PostgreSQL: SiPostgresql,
  Stripe: SiStripe,
  "Three.js": SiThreedotjs,
  Vercel: SiVercel,
  Git: SiGit,
  Docker: SiDocker,
  "Framer Motion": SiFramer,
  "Claude AI": SiOpenai,
  "AI Agents": FiCpu,
  "Groq SDK": FiCpu,
  "SAP S/4HANA": FiDatabase,
  "SAP Ariba": FiDatabase,
  "SAP MM/SD": FiDatabase,
  "Power BI": FiDatabase,
  "REST APIs": FiServer,
  "Vibe Coding": FiTool,
  "LLM Integration": SiOpenai,
  "Supply Chain": FiDatabase,
};

function iconFor(name: string): IconType {
  return SKILL_ICONS[name] ?? FiZap;
}

export default function Skills() {
  const { skills: skillsContent } = useSiteContent();
  const allSkills = skillsContent.skills.map((n) => ({ name: n, icon: iconFor(n) }));
  const services = skillsContent.services;
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const sectionHeight = sectionRef.current.offsetHeight;
      const viewportHeight = window.innerHeight;
      // Progress: 0 when section top hits viewport bottom, 1 when section is fully scrolled
      const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (sectionHeight + viewportHeight)));
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section id="skills" ref={sectionRef} className="relative py-28 lg:py-36 px-6 lg:px-10" style={{ overflow: "clip" }}>
      <Parallax3D speed={0.03} rotateIntensity={1}>
        <div className="absolute top-20 right-6 lg:right-10 text-[120px] lg:text-[180px] font-bold text-stroke leading-none select-none pointer-events-none">
          SKILLS
        </div>
      </Parallax3D>

      <div className="max-w-7xl mx-auto relative">
        {/* Header + Photo layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start mb-20">
          {/* Left — heading */}
          <div>
            <ScrollReveal direction="rotate3d">
              <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
                {skillsContent.eyebrow}
              </p>
            </ScrollReveal>

            <ScrollReveal direction="flipX" delay={0.1}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                {skillsContent.heading_pre} <span className="text-gradient">{skillsContent.heading_accent}</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="zoom3d" delay={0.2}>
              <p className="text-[#777] text-lg leading-relaxed max-w-lg">
                {skillsContent.intro}
              </p>
            </ScrollReveal>

            {/* Skill marquee */}
            <ScrollReveal direction="zoom3d" delay={0.3}>
              <div className="relative overflow-hidden py-8 mt-6">
                <div className="flex animate-marquee whitespace-nowrap">
                  {[...allSkills, ...allSkills].map((skill, i) => (
                    <div
                      key={`${skill.name}-${i}`}
                      className="inline-flex items-center gap-2 mx-2 px-4 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.04] text-[#bbb] hover:border-[#ff6b00]/30 hover:text-[#ff6b00] transition-all duration-300 cursor-default"
                    >
                      <skill.icon size={14} />
                      <span className="text-xs font-medium">{skill.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right — 3D Skills Avatar */}
          <div className="flex justify-center items-start lg:-mt-36 min-w-0 w-full overflow-hidden">
            <ScrollReveal direction="flipY" delay={0.2}>
              <div
                className="relative"
                style={{
                  transform: `perspective(1000px) rotateY(${-4 + scrollProgress * 4}deg) rotateX(${1 - scrollProgress * 1}deg)`,
                  transition: "transform 0.1s ease-out",
                }}
              >
                <SkillsAvatar
                  mouseX={mousePos.x}
                  mouseY={mousePos.y}
                  className="w-[300px] h-[440px] sm:w-[360px] sm:h-[520px] lg:w-[520px] lg:h-[780px]"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((svc, i) => {
            const dirs = ["flipY", "rotate3d", "flipX", "zoom3d"] as const;
            return (
              <ScrollReveal key={`${svc.title}-${i}`} delay={0.1 * i} direction={dirs[i % dirs.length]}>
                <TiltCard className="rounded-[20px] h-full" intensity={12}>
                  <div className="card-dark card-3d-shine p-7 h-full shadow-3d">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-[#ff6b00]/30 text-sm font-mono">{svc.num}.</span>
                      <h3 className="text-white font-bold text-xl">{svc.title}</h3>
                    </div>

                    <p className="text-[#888] text-sm leading-relaxed mb-5">{svc.description}</p>

                    <div className="flex flex-wrap gap-2">
                      {svc.tools.map((t) => (
                        <span
                          key={t}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] text-[#888] border border-white/[0.04] hover:border-[#ff6b00]/20 hover:text-[#ff6b00] transition-all"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </TiltCard>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
