"use client";

import { useState } from "react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { FiCpu, FiCode, FiDatabase, FiGlobe, FiCalendar, FiCopy, FiDownload, FiCheck } from "react-icons/fi";
import { FaXTwitter, FaInstagram, FaYoutube, FaLinkedinIn, FaGithub, FaStar } from "react-icons/fa6";
import { useSiteContent } from "./SiteContentProvider";
import type { IconType } from "react-icons";

const ICONS: Record<string, IconType> = {
  Cpu: FiCpu,
  Code: FiCode,
  Database: FiDatabase,
  Globe: FiGlobe,
};

const SOCIAL_ICONS: Record<string, IconType> = {
  X: FaXTwitter,
  Instagram: FaInstagram,
  YouTube: FaYoutube,
  LinkedIn: FaLinkedinIn,
  GitHub: FaGithub,
};

export default function About() {
  const { about } = useSiteContent();
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(about.email_for_copy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="about" className="relative py-28 lg:py-36 px-6 lg:px-10">
      {/* Big background text */}
      <Parallax3D speed={0.03} rotateIntensity={1}>
        <div className="absolute top-20 left-6 lg:left-10 text-[120px] lg:text-[180px] font-bold text-stroke leading-none select-none pointer-events-none">
          ABOUT
        </div>
      </Parallax3D>

      <div className="max-w-7xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left text */}
          <div>
            <ScrollReveal direction="rotate3d">
              <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
                {about.eyebrow}
              </p>
            </ScrollReveal>

            <ScrollReveal direction="flipX" delay={0.1}>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-8 whitespace-pre-line">
                {about.heading_pre} <span className="text-gradient">{about.heading_accent}</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="zoom3d" delay={0.2}>
              <p className="text-[#888] text-lg leading-relaxed mb-6">
                {about.paragraph_one}
              </p>
            </ScrollReveal>

            <ScrollReveal direction="zoom3d" delay={0.3}>
              <p className="text-[#888] text-lg leading-relaxed">
                {about.paragraph_two}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <hr className="line-accent w-24 my-10" />
            </ScrollReveal>

            {/* Stats with 3D */}
            <ScrollReveal direction="flipX" delay={0.5}>
              <div className="grid grid-cols-3 gap-8">
                {about.stats.map((s) => (
                  <div key={s.label} className="group cursor-default" style={{ perspective: "800px" }}>
                    <div className="transition-transform duration-300 group-hover:[transform:perspective(800px)_rotateY(10deg)_scale(1.05)]">
                      <p className="text-3xl md:text-4xl font-bold text-gradient">{s.value}</p>
                      <p className="text-[#555] text-sm mt-1">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            {/* CTA buttons */}
            <ScrollReveal direction="zoom3d" delay={0.6}>
              <div className="flex flex-wrap gap-3 mt-10">
                <a
                  href={about.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#ff6b00] text-black font-semibold text-sm hover:bg-[#ff8c38] hover:shadow-lg hover:shadow-[#ff6b00]/20 active:scale-[0.97] transition-all"
                >
                  <FiCalendar size={16} />
                  Schedule a call
                </a>
                <button
                  onClick={copyEmail}
                  className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/[0.1] text-[#ccc] text-sm font-medium hover:border-[#ff6b00]/30 hover:text-white active:scale-[0.97] transition-all"
                >
                  {copied ? <FiCheck size={16} className="text-green-400" /> : <FiCopy size={16} />}
                  {copied ? "Copied!" : "Copy email"}
                </button>
                <a
                  href={about.resume_url}
                  download
                  className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/[0.1] text-[#ccc] text-sm font-medium hover:border-[#ff6b00]/30 hover:text-white active:scale-[0.97] transition-all"
                >
                  <FiDownload size={16} />
                  Download CV
                </a>
              </div>
            </ScrollReveal>

            {/* Trust + Socials */}
            <ScrollReveal direction="flipX" delay={0.7}>
              <div className="mt-8">
                <div className="flex items-center gap-1 mb-2">
                  {Array(5).fill(0).map((_, i) => (
                    <FaStar key={i} size={14} className="text-[#ff6b00]" />
                  ))}
                </div>
                <p className="text-[#888] text-sm mb-5">{about.trust_blurb}</p>
                <div className="flex items-center gap-3">
                  {about.socials.map((s) => {
                    const Icon = SOCIAL_ICONS[s.platform] ?? FaGithub;
                    return (
                      <a
                        key={s.platform}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-xl border border-white/[0.08] flex items-center justify-center text-[#888] hover:text-[#ff6b00] hover:border-[#ff6b00]/20 transition-all"
                        aria-label={s.platform}
                      >
                        <Icon size={16} />
                      </a>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right cards — 3D tilt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:pt-24">
            {about.highlights.map((item, i) => {
              const dirs = ["flipY", "rotate3d", "zoom3d", "flipX"] as const;
              const Icon = ICONS[item.icon] ?? FiCpu;
              return (
                <ScrollReveal key={`${item.title}-${i}`} delay={0.1 + i * 0.12} direction={dirs[i % dirs.length]}>
                  <TiltCard className="h-full rounded-[20px]" intensity={20}>
                    <div className="card-dark card-3d-shine p-6 h-full shadow-3d">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                        style={{ backgroundColor: `${item.accent}15` }}
                      >
                        <Icon size={22} style={{ color: item.accent }} />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-[#666] text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </TiltCard>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
