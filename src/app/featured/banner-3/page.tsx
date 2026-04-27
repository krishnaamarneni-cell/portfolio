"use client";

import Image from "next/image";
import {
  FiTrendingUp,
  FiBookOpen,
  FiZap,
  FiCpu,
  FiGlobe,
  FiTool,
  FiArrowRight,
  FiCheck,
} from "react-icons/fi";
import DownloadCard from "@/components/DownloadCard";

/* DESIGN 3 — Bold orange brand statement — IMPROVED */
export default function Banner3() {
  const pills = [
    { Icon: FiCpu, label: "AI Agents" },
    { Icon: FiTrendingUp, label: "WealthClaude" },
    { Icon: FiBookOpen, label: "Free Course" },
    { Icon: FiTool, label: "Free Tools" },
    { Icon: FiZap, label: "SAP @ Coca-Cola" },
  ];

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-start overflow-auto p-8">
      <DownloadCard filename="krishna-banner-3-orange" width={1584} height={396}>
      <div className="relative w-[1584px] h-[396px] overflow-hidden bg-gradient-to-br from-[#ff7a1a] via-[#ff5500] to-[#cc3a00] shrink-0">
        {/* Layered lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,220,170,0.45),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_120%,rgba(0,0,0,0.5),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_40%,rgba(0,0,0,0.15)_100%)]" />

        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.13] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative hexagons (more & varied) */}
        <div className="absolute top-[12%] right-[42%] w-[140px] h-[140px] opacity-[0.18]">
          <svg viewBox="0 0 120 120">
            <path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="absolute bottom-[8%] right-[18%] w-[90px] h-[90px] opacity-[0.22]">
          <svg viewBox="0 0 120 120">
            <path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="white" strokeWidth="2" />
          </svg>
        </div>
        <div className="absolute top-[25%] right-[7%] w-[60px] h-[60px] opacity-[0.25]">
          <svg viewBox="0 0 120 120">
            <path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="white" strokeWidth="2.5" />
          </svg>
        </div>

        {/* Diagonal scan line */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0px, transparent 20px, white 20px, white 21px)",
          }}
        />

        <div className="relative z-10 h-full grid grid-cols-[300px_1fr_360px] items-center pl-20 pr-16 gap-10">
          {/* LEFT — clear for LinkedIn profile photo overlap */}
          <div />

          {/* CENTER — Bold message */}
          <div>
            {/* Wave + name */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/25 backdrop-blur-md border border-white/20 mb-4">
              <span className="text-base">👋</span>
              <span className="text-white text-[11px] font-mono tracking-[0.3em] uppercase font-semibold">
                Hey, I&apos;m Krishna
              </span>
            </div>

            <h1 className="text-[60px] font-black leading-[0.92] tracking-tight text-white mb-5 drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              I help businesses ship{" "}
              <span className="relative inline-block">
                <span className="text-[#1a0500]">AI, SAP & web</span>
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#1a0500]/60 rounded-full" />
              </span>
              <br />
              products that{" "}
              <span className="italic font-extrabold text-white">actually ship.</span>
            </h1>

            {/* Pills row */}
            <div className="flex flex-wrap gap-2">
              {pills.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.22] backdrop-blur-lg border border-white/40 text-white text-xs font-semibold shadow-md"
                >
                  <Icon size={11} />
                  {label}
                </div>
              ))}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a0500] text-white text-xs font-bold shadow-lg">
                <FiGlobe size={11} className="text-[#ff8c38]" />
                krishnaamarneni.com
                <FiArrowRight size={11} />
              </div>
            </div>
          </div>

          {/* RIGHT — Photo card with stats */}
          <div className="flex flex-col items-center gap-3">
            {/* Photo with darker contrast frame */}
            <div className="relative w-[220px] h-[220px] rounded-[24px] overflow-hidden bg-[#1a0500] shadow-[0_15px_40px_rgba(0,0,0,0.4)]">
              <Image
                src="/Krishna.amarneni_ai-removebg-preview.png"
                alt="Krishna"
                fill
                priority
                className="object-cover object-[center_18%]"
                style={{ transform: "scale(1.15)" }}
              />
              {/* Verified badge */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg">
                <FiCheck size={14} className="text-[#ff6b00]" strokeWidth={3} />
              </div>
            </div>

            {/* Stats badge below */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
              <div className="text-center">
                <p className="text-white font-bold text-sm leading-none">5K+</p>
                <p className="text-white/70 text-[8px] font-mono uppercase tracking-wider">readers</p>
              </div>
              <div className="w-px h-7 bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-sm leading-none">3</p>
                <p className="text-white/70 text-[8px] font-mono uppercase tracking-wider">products</p>
              </div>
              <div className="w-px h-7 bg-white/20" />
              <div className="text-center">
                <p className="text-white font-bold text-sm leading-none">F500</p>
                <p className="text-white/70 text-[8px] font-mono uppercase tracking-wider">clients</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DownloadCard>
    </main>
  );
}
