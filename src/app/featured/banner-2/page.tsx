"use client";

import { FiTerminal, FiCheck, FiZap } from "react-icons/fi";
import DownloadCard from "@/components/DownloadCard";

/* DESIGN 2 — Code editor / Terminal aesthetic — IMPROVED */
export default function Banner2() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-start overflow-auto p-8">
      <DownloadCard filename="krishna-banner-2-terminal" width={1584} height={396}>
      <div className="relative w-[1584px] h-[396px] overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#0f0703] to-[#050505] shrink-0">
        {/* Layered glows for depth */}
        <div className="absolute top-[-30%] right-[15%] w-[700px] h-[700px] bg-[#ff6b00]/[0.18] rounded-full blur-[160px]" />
        <div className="absolute top-[40%] left-[35%] w-[400px] h-[400px] bg-[#ff8c38]/[0.1] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-30%] left-[-5%] w-[500px] h-[500px] bg-[#ff3d00]/[0.12] rounded-full blur-[130px]" />

        {/* Hex grid bg */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(to right, #ff6b00 1px, transparent 1px), linear-gradient(to bottom, #ff6b00 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>

        {/* Decorative floating hexagons */}
        <div className="absolute top-[10%] right-[3%] w-[60px] h-[60px] opacity-[0.15]">
          <svg viewBox="0 0 120 120">
            <path d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z" fill="none" stroke="#ff6b00" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative z-10 h-full grid grid-cols-[280px_1fr_580px] gap-10 items-center px-16">
          {/* LEFT — empty for profile photo overlap */}
          <div />

          {/* CENTER — Bold tagline with status indicator */}
          <div>
            {/* Live status badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-5">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-emerald-400 text-[10px] font-mono tracking-[0.2em] uppercase font-semibold">
                Available · Open to Collab
              </span>
            </div>

            <h1 className="text-[64px] font-black leading-[0.92] tracking-tight text-white mb-4">
              Shipping{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
                  AI agents
                </span>
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-[#ff6b00] to-transparent rounded-full" />
              </span>
              <br />
              & enterprise systems.
            </h1>

            <div className="flex items-center gap-5 mt-5">
              <p className="text-white/90 text-base font-mono">
                <span className="text-[#ff6b00]">→</span> krishnaamarneni.com
              </p>
              <span className="text-[#444]">·</span>
              <div className="flex items-center gap-2">
                <FiZap size={13} className="text-[#ff6b00]" />
                <span className="text-[#888] text-sm font-mono">5+ years building</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Terminal/Code window with rich syntax */}
          <div className="relative">
            {/* Glow under terminal */}
            <div className="absolute -inset-2 bg-gradient-to-r from-[#ff6b00]/20 via-[#ff8c38]/15 to-transparent rounded-3xl blur-xl" />

            <div className="relative rounded-2xl bg-[#0d0d0d] border border-white/[0.08] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.6)]">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border-b border-white/[0.05]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <FiTerminal size={11} className="text-[#666] ml-3" />
                <span className="text-[#888] text-[11px] font-mono ml-1">~/krishna · zsh</span>
                <div className="ml-auto flex items-center gap-1">
                  <FiCheck size={10} className="text-emerald-400" />
                  <span className="text-emerald-400 text-[10px] font-mono">deployed</span>
                </div>
              </div>

              {/* Terminal body — richer syntax */}
              <div className="p-5 font-mono text-[13px] leading-[1.65] space-y-0.5">
                <p>
                  <span className="text-[#ff6b00]">krishna@dev</span>
                  <span className="text-[#666]">:</span>
                  <span className="text-[#3b82f6]">~</span>
                  <span className="text-[#666]">$ </span>
                  <span className="text-white">whoami --verbose</span>
                </p>
                <p className="text-[#aaa] pl-3">
                  <span className="text-emerald-400">✓</span> Krishna Amarneni{" "}
                  <span className="text-[#666]">// builder, shipper, learner</span>
                </p>
                <p className="text-[#aaa] pl-3">
                  <span className="text-emerald-400">✓</span> SAP Business Analyst{" "}
                  <span className="text-[#ff8c38]">@</span> Coca-Cola
                </p>
                <p className="mt-1">
                  <span className="text-[#ff6b00]">krishna@dev</span>
                  <span className="text-[#666]">:</span>
                  <span className="text-[#3b82f6]">~</span>
                  <span className="text-[#666]">$ </span>
                  <span className="text-white">cat </span>
                  <span className="text-[#fbbf24]">building.json</span>
                </p>
                <p className="text-[#aaa] pl-3">
                  <span className="text-[#ff8c38]">⚡</span> <span className="text-white font-semibold">WealthClaude</span>{" "}
                  <span className="text-[#666]">→</span> <span className="text-[#bbb]">AI finance · 5K readers</span>
                </p>
                <p className="text-[#aaa] pl-3">
                  <span className="text-[#ff8c38]">⚡</span> <span className="text-white font-semibold">Lucy AI</span>{" "}
                  <span className="text-[#666]">→</span> <span className="text-[#bbb]">autonomous agents</span>
                </p>
                <p className="text-[#aaa] pl-3">
                  <span className="text-[#ff8c38]">⚡</span> <span className="text-white font-semibold">SAP S/4HANA</span>{" "}
                  <span className="text-[#666]">→</span> <span className="text-[#bbb]">global supply chains</span>
                </p>
                <p className="mt-1">
                  <span className="text-[#ff6b00]">krishna@dev</span>
                  <span className="text-[#666]">:</span>
                  <span className="text-[#3b82f6]">~</span>
                  <span className="text-[#666]">$ </span>
                  <span className="text-white">echo </span>
                  <span className="text-[#a3e635]">&quot;let&apos;s build something&quot;</span>
                  <span className="ml-1 inline-block w-2 h-4 bg-[#ff6b00] align-middle animate-pulse" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DownloadCard>
    </main>
  );
}
