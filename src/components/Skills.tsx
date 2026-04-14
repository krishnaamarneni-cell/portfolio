"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";

const SkillsAvatar = dynamic(() => import("./Avatar3D").then(mod => ({ default: mod.SkillsAvatar })), { ssr: false });
import {
  SiNextdotjs, SiReact, SiTypescript, SiPython, SiTailwindcss,
  SiSupabase, SiPostgresql, SiStripe, SiThreedotjs, SiVercel,
  SiGit, SiDocker, SiFramer, SiOpenai,
} from "react-icons/si";
import { FiDatabase, FiServer, FiCpu, FiTool } from "react-icons/fi";

const allSkills = [
  { name: "Next.js", icon: SiNextdotjs },
  { name: "React", icon: SiReact },
  { name: "TypeScript", icon: SiTypescript },
  { name: "Python", icon: SiPython },
  { name: "Tailwind CSS", icon: SiTailwindcss },
  { name: "Supabase", icon: SiSupabase },
  { name: "PostgreSQL", icon: SiPostgresql },
  { name: "Stripe", icon: SiStripe },
  { name: "Three.js", icon: SiThreedotjs },
  { name: "Vercel", icon: SiVercel },
  { name: "Git", icon: SiGit },
  { name: "Docker", icon: SiDocker },
  { name: "Framer Motion", icon: SiFramer },
  { name: "Claude AI", icon: SiOpenai },
  { name: "AI Agents", icon: FiCpu },
  { name: "Groq SDK", icon: FiCpu },
  { name: "SAP S/4HANA", icon: FiDatabase },
  { name: "SAP Ariba", icon: FiDatabase },
  { name: "SAP MM/SD", icon: FiDatabase },
  { name: "Power BI", icon: FiDatabase },
  { name: "REST APIs", icon: FiServer },
  { name: "Vibe Coding", icon: FiTool },
  { name: "LLM Integration", icon: SiOpenai },
  { name: "Supply Chain", icon: FiDatabase },
];

const services = [
  {
    num: "01",
    title: "SAP Consulting",
    desc: "End-to-end SAP implementations across S/4HANA, Ariba, MM/SD/PP/QM — streamlining supply chains for Fortune 500 companies.",
    tools: ["SAP S/4HANA", "Ariba", "MM/SD", "Power BI", "Supply Chain"],
  },
  {
    num: "02",
    title: "Web Development",
    desc: "Full-stack applications built with modern frameworks — responsive, performant, and production-ready from day one.",
    tools: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Supabase"],
  },
  {
    num: "03",
    title: "AI & Automation",
    desc: "Autonomous AI agents, LLM integrations, and intelligent workflows that handle complex tasks end to end.",
    tools: ["Claude AI", "AI Agents", "Python", "Groq SDK", "LLM"],
  },
  {
    num: "04",
    title: "Fintech Products",
    desc: "Financial platforms with real-time data, Stripe integration, and secure transaction handling at scale.",
    tools: ["Stripe", "PostgreSQL", "Vercel", "REST APIs", "Docker"],
  },
];

export default function Skills() {
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
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start mb-20">
          {/* Left — heading */}
          <div>
            <ScrollReveal direction="rotate3d">
              <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
                / Services, Skills, Abilities
              </p>
            </ScrollReveal>

            <ScrollReveal direction="flipX" delay={0.1}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                What I do <span className="text-gradient">best?</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="zoom3d" delay={0.2}>
              <p className="text-[#777] text-lg leading-relaxed max-w-lg">
                I bridge enterprise SAP systems with modern web development and AI — creating
                solutions that help businesses grow and make a real impact.
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
          <div className="hidden lg:flex justify-center items-start -mt-36">
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
                  className="w-[520px] h-[780px]"
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
              <ScrollReveal key={svc.title} delay={0.1 * i} direction={dirs[i]}>
                <TiltCard className="rounded-[20px] h-full" intensity={12}>
                  <div className="card-dark card-3d-shine p-7 h-full shadow-3d">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-[#ff6b00]/30 text-sm font-mono">{svc.num}.</span>
                      <h3 className="text-white font-bold text-xl">{svc.title}</h3>
                    </div>

                    <p className="text-[#888] text-sm leading-relaxed mb-5">{svc.desc}</p>

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
