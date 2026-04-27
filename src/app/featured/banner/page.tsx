"use client";

import { FiArrowRight, FiCode, FiCpu, FiDatabase } from "react-icons/fi";

export default function BannerFeatured() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-start justify-start overflow-auto">
      {/* LinkedIn banner — 1584x396 (exact LinkedIn dimensions) */}
      <div className="relative w-[1584px] h-[396px] overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a0500] to-[#050505] shrink-0">
        {/* Glow blobs */}
        <div className="absolute top-[-30%] right-[20%] w-[600px] h-[600px] bg-[#ff6b00]/[0.22] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-40%] left-[10%] w-[500px] h-[500px] bg-[#ff3d00]/[0.15] rounded-full blur-[130px]" />
        <div className="absolute top-[20%] right-[-5%] w-[350px] h-[350px] bg-[#ffaa00]/[0.08] rounded-full blur-[100px]" />

        {/* Hex grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        {/* Floating hexagons (decorative) */}
        <div className="absolute top-[15%] left-[8%] w-[120px] h-[120px] opacity-[0.08]">
          <svg viewBox="0 0 120 120">
            <path
              d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z"
              fill="none"
              stroke="#ff6b00"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="absolute bottom-[12%] left-[42%] w-[80px] h-[80px] opacity-[0.1]">
          <svg viewBox="0 0 120 120">
            <path
              d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z"
              fill="none"
              stroke="#ff6b00"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="absolute top-[20%] right-[8%] w-[100px] h-[100px] opacity-[0.07]">
          <svg viewBox="0 0 120 120">
            <path
              d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z"
              fill="none"
              stroke="#ff6b00"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* === LinkedIn safe zones ===
            Profile photo overlaps the bottom-left ~250px circle.
            Name/title overlaps the bottom area too.
            Keep important content in the CENTER and RIGHT */}

        {/* Content layout */}
        <div className="relative z-10 h-full flex items-center justify-between px-20">
          {/* Left — keep clear/dim because profile photo will go here */}
          <div className="w-[280px] opacity-30">
            {/* visual placeholder */}
          </div>

          {/* CENTER: Big headline */}
          <div className="flex-1 text-center -translate-x-12">
            <p className="text-[#ff6b00] text-xs font-mono tracking-[0.4em] uppercase mb-3">
              ✦ Builder · SAP · AI · Web ✦
            </p>
            <h1 className="text-[68px] font-black leading-[0.95] tracking-tight text-white">
              I build at the intersection of{" "}
              <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
                AI, SAP & Web.
              </span>
            </h1>
          </div>

          {/* RIGHT: Tech & URL */}
          <div className="flex flex-col items-end gap-4 w-[320px]">
            {/* Tech badges */}
            <div className="flex flex-col items-end gap-2">
              {[
                { icon: FiCode, label: "Next.js · React · TS" },
                { icon: FiCpu, label: "Claude AI · Python" },
                { icon: FiDatabase, label: "SAP S/4HANA · Ariba" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] backdrop-blur-xl"
                >
                  <Icon size={12} className="text-[#ff6b00]" />
                  <span className="text-[#ddd] text-xs font-mono">{label}</span>
                </div>
              ))}
            </div>

            {/* URL CTA */}
            <a className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] shadow-[0_8px_30px_rgba(255,107,0,0.5)] mt-2">
              <span className="text-white font-bold text-sm font-mono">
                krishnaamarneni.com
              </span>
              <FiArrowRight size={14} className="text-white" />
            </a>
          </div>
        </div>

        {/* Bottom-right tagline */}
        <p className="absolute bottom-5 right-7 text-[#666] text-[11px] font-mono uppercase tracking-[0.3em] z-10">
          New Jersey · Open to Collaborations
        </p>
      </div>
    </main>
  );
}
