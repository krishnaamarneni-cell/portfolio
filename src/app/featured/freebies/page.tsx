"use client";

import { FiBookOpen, FiTool, FiDownload, FiArrowRight } from "react-icons/fi";

export default function FreebiesFeatured() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
      {/* 1200x630 LinkedIn featured card */}
      <div className="relative w-[1200px] h-[630px] rounded-[24px] overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a0a02] to-[#050505] border border-white/[0.08] shadow-[0_30px_100px_rgba(255,107,0,0.25)]">
        {/* Orange glow blobs */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#ff6b00]/[0.18] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#ff3d00]/[0.12] rounded-full blur-[120px]" />

        {/* Hex grid bg */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />

        {/* Content grid */}
        <div className="relative z-10 h-full grid grid-cols-2 gap-12 p-16">
          {/* LEFT */}
          <div className="flex flex-col justify-center">
            <p className="text-[#ff6b00] text-sm font-mono tracking-[0.3em] uppercase mb-6">
              ✦ 100% Free · No Sign-up
            </p>
            <h1 className="text-[68px] font-black leading-[0.95] tracking-tight text-white mb-6">
              Master <span className="text-gradient bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] bg-clip-text text-transparent">FIRE</span>
              <br />
              Build Wealth.
              <br />
              <span className="text-[#ff6b00]">Free.</span>
            </h1>
            <p className="text-[#bbb] text-xl leading-relaxed mb-8">
              Get my full <span className="text-white font-semibold">Finance Course</span>,{" "}
              <span className="text-white font-semibold">Free Tools</span> &
              <span className="text-white font-semibold"> Starter Book</span> — everything you
              need to take control of your financial future.
            </p>

            <div className="flex items-center gap-3 mt-2">
              <div className="px-6 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white font-bold text-lg shadow-[0_8px_30px_rgba(255,107,0,0.4)] flex items-center gap-2">
                Get Free Access
                <FiArrowRight size={20} />
              </div>
              <span className="text-[#888] text-sm font-mono">wealthclaude.com</span>
            </div>
          </div>

          {/* RIGHT — 3 stacked cards */}
          <div className="flex flex-col justify-center gap-4">
            {[
              {
                Icon: FiBookOpen,
                title: "Free Finance Course",
                subtitle: "Master FIRE, investing & wealth",
                tag: "COURSE",
              },
              {
                Icon: FiTool,
                title: "Free Productivity Tools",
                subtitle: "Calculators, templates, planners",
                tag: "TOOLS",
              },
              {
                Icon: FiDownload,
                title: "Free Starter Book",
                subtitle: "The wealth-building blueprint",
                tag: "EBOOK",
              },
            ].map(({ Icon, title, subtitle, tag }, i) => (
              <div
                key={title}
                className="relative rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl p-5 flex items-center gap-4"
                style={{ transform: `translateX(${i * 12}px)` }}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center shrink-0 shadow-lg">
                  <Icon size={26} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-lg">{title}</h3>
                    <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#ff6b00]/20 text-[#ff8c38] border border-[#ff6b00]/30">
                      {tag}
                    </span>
                  </div>
                  <p className="text-[#999] text-sm">{subtitle}</p>
                </div>
              </div>
            ))}

            <div className="text-center mt-3">
              <p className="text-[#666] text-xs font-mono uppercase tracking-[0.3em]">
                — by Krishna Amarneni —
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
