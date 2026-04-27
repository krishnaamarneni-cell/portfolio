"use client";

import { FiArrowRight, FiCode, FiCpu, FiDatabase, FiZap } from "react-icons/fi";

export default function WebsiteFeatured() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
      {/* 1200x630 LinkedIn featured card */}
      <div className="relative w-[1200px] h-[630px] rounded-[24px] overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a0500] to-[#050505] border border-white/[0.08] shadow-[0_30px_100px_rgba(255,107,0,0.3)]">
        {/* Glow blobs */}
        <div className="absolute top-[-20%] right-[-15%] w-[700px] h-[700px] bg-[#ff6b00]/[0.18] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-25%] left-[-10%] w-[500px] h-[500px] bg-[#ff3d00]/[0.12] rounded-full blur-[130px]" />

        {/* Hex grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        {/* Two-column */}
        <div className="relative z-10 h-full grid grid-cols-[1.1fr_1fr] gap-10 p-14">
          {/* LEFT: Pitch */}
          <div className="flex flex-col justify-center">
            {/* Browser address bar */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] backdrop-blur-xl mb-6 w-fit">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
              </div>
              <span className="text-[#888] text-xs font-mono ml-2">
                🔒 krishnaamarneni.com
              </span>
            </div>

            <h1 className="text-[64px] font-black leading-[0.92] tracking-tight text-white mb-5">
              I built my{" "}
              <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
                portfolio
              </span>
              <br />
              from scratch.
            </h1>

            <p className="text-[#bbb] text-lg leading-relaxed mb-7 max-w-lg">
              Designed, coded, and deployed it myself — featuring a 3D animated
              avatar, smooth scroll experiences, and a brand voice that feels
              like me.
            </p>

            {/* Tech stack */}
            <div className="flex flex-wrap gap-2 mb-8">
              {[
                { icon: FiCode, label: "Next.js 16" },
                { icon: FiZap, label: "Tailwind v4" },
                { icon: FiCpu, label: "Three.js" },
                { icon: FiDatabase, label: "TypeScript" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[#ddd] text-xs font-mono"
                >
                  <Icon size={11} className="text-[#ff6b00]" />
                  {label}
                </span>
              ))}
            </div>

            {/* CTA */}
            <a className="inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] shadow-[0_8px_30px_rgba(255,107,0,0.5)] w-fit">
              <span className="text-white font-bold text-base">Visit krishnaamarneni.com</span>
              <FiArrowRight size={18} className="text-white" />
            </a>
          </div>

          {/* RIGHT: Browser mockup */}
          <div className="flex items-center justify-center">
            <div className="relative w-full aspect-[4/3] max-h-[440px] rounded-2xl bg-[#0a0a0a] border border-white/[0.1] shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Browser top bar */}
              <div className="absolute top-0 inset-x-0 h-9 bg-[#1a1a1a] border-b border-white/[0.05] flex items-center px-3 gap-2 z-30">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                </div>
                <div className="flex-1 mx-3 h-5 rounded bg-[#0a0a0a] border border-white/[0.05] flex items-center justify-center">
                  <span className="text-[#666] text-[10px] font-mono">krishnaamarneni.com</span>
                </div>
              </div>

              {/* Mock hero */}
              <div className="absolute inset-x-0 top-9 bottom-0 flex items-center justify-center px-6">
                {/* Background hex pattern */}
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='46' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.6'/%3E%3C/svg%3E")`,
                    backgroundSize: "40px 35px",
                  }}
                />

                {/* KRISHNA + AMARNENI */}
                <div className="relative flex items-center gap-4">
                  <span className="text-white font-black text-3xl tracking-tighter">KRISHNA</span>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff3d00] flex items-center justify-center shrink-0 shadow-[0_8px_30px_rgba(255,107,0,0.5)]">
                    <span className="text-white text-xl">👋</span>
                  </div>
                  <span className="bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] bg-clip-text text-transparent font-black text-3xl tracking-tighter">
                    AMARNENI
                  </span>
                </div>
              </div>

              {/* Mock typing line */}
              <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="text-[#ff6b00] text-[10px] font-mono tracking-[0.2em]">
                  ✦ Full-Stack Developer · SAP Expert · AI Builder
                </p>
              </div>

              {/* Subtle orange glow */}
              <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#ff6b00]/[0.15] rounded-full blur-[80px]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
