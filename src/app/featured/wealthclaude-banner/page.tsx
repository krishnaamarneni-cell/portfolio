"use client";

import {
  FiTrendingUp,
  FiGlobe,
  FiPieChart,
  FiArrowRight,
  FiCheck,
  FiBarChart2,
} from "react-icons/fi";
import DownloadCard from "@/components/DownloadCard";

/* WealthClaude LinkedIn Banner — 1584×396 */
export default function WealthClaudeBanner() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-start overflow-auto p-8">
      <DownloadCard filename="wealthclaude-linkedin-banner" width={1584} height={396}>
        <div className="relative w-[1584px] h-[396px] overflow-hidden bg-black shrink-0">
          {/* Layered glows */}
          <div className="absolute top-[-30%] right-[10%] w-[700px] h-[700px] bg-[#22c55e]/[0.15] rounded-full blur-[160px]" />
          <div className="absolute top-[40%] left-[35%] w-[400px] h-[400px] bg-[#22c55e]/[0.08] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-30%] left-[-5%] w-[500px] h-[500px] bg-[#22c55e]/[0.1] rounded-full blur-[130px]" />

          {/* Subtle grid lines */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)',
              backgroundSize: '50px 50px',
            }}
          />

          {/* Globe-style dotted circle on left */}
          <svg
            className="absolute top-1/2 left-[280px] -translate-y-1/2 w-[380px] h-[380px] opacity-[0.18]"
            viewBox="0 0 200 200"
          >
            {/* Latitude circles */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((s, i) => (
              <ellipse
                key={`lat-${i}`}
                cx="100"
                cy="100"
                rx="95"
                ry={95 * s}
                fill="none"
                stroke="#22c55e"
                strokeWidth="0.4"
                strokeDasharray="2 3"
              />
            ))}
            {/* Longitude lines */}
            {[0, 30, 60, 90, 120, 150].map((deg) => (
              <ellipse
                key={`lon-${deg}`}
                cx="100"
                cy="100"
                rx={Math.abs(Math.cos((deg * Math.PI) / 180) * 95)}
                ry="95"
                fill="none"
                stroke="#22c55e"
                strokeWidth="0.4"
                strokeDasharray="2 3"
              />
            ))}
            <circle cx="100" cy="100" r="95" fill="none" stroke="#22c55e" strokeWidth="0.5" />
            {/* Tiny dots representing markets */}
            {[
              [60, 35], [140, 50], [70, 80], [130, 95], [50, 130],
              [110, 60], [160, 110], [90, 150], [40, 100], [120, 130],
            ].map(([cx, cy], i) => (
              <circle key={`dot-${i}`} cx={cx} cy={cy} r="2.5" fill="#22c55e" />
            ))}
          </svg>

          <div className="relative z-10 h-full grid grid-cols-[300px_1fr_540px] items-center pl-16 pr-12 gap-8">
            {/* LEFT — empty for LinkedIn profile photo overlap */}
            <div />

            {/* CENTER — Bold message */}
            <div>
              {/* Live status pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/40 backdrop-blur-md mb-4">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-[#22c55e] animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-[#22c55e]" />
                </span>
                <span className="text-[#4ade80] text-[10px] font-mono tracking-[0.3em] uppercase font-bold">
                  LIVE · Free Forever · No Card
                </span>
              </div>

              {/* Brand name */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center shadow-[0_4px_20px_rgba(16,185,129,0.5)]">
                  <FiTrendingUp size={14} className="text-white" strokeWidth={3} />
                </div>
                <span className="text-[#22c55e] text-base font-bold tracking-tight">
                  WealthClaude
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-[58px] font-black leading-[0.92] tracking-tight text-white mb-4 drop-shadow">
                Track.{" "}
                <span className="bg-gradient-to-r from-[#4ade80] to-[#22c55e] bg-clip-text text-transparent">
                  Analyze.
                </span>
                <br />
                Invest{" "}
                <span className="italic">Smarter.</span>
              </h1>

              <p className="text-[#888] text-sm font-medium">
                Real-time portfolio tracking · 15+ free calculators · AI market briefs
              </p>
            </div>

            {/* RIGHT — Stats card with mini chart */}
            <div className="flex flex-col gap-3">
              {/* Mini chart card */}
              <div className="relative rounded-2xl bg-[#0a0a0a]/85 backdrop-blur-md border border-[#22c55e]/25 p-5 shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FiBarChart2 size={14} className="text-[#22c55e]" />
                    <span className="text-white text-xs font-mono tracking-wider">
                      YOUR PORTFOLIO
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#22c55e]/20 text-[#4ade80] text-[10px] font-bold">
                    +24.7%
                  </span>
                </div>

                {/* Tiny SVG chart */}
                <svg viewBox="0 0 240 60" className="w-full h-12">
                  <defs>
                    <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,50 L20,42 L40,45 L60,30 L80,33 L100,22 L120,28 L140,15 L160,18 L180,10 L200,12 L220,5 L240,8 L240,60 L0,60 Z"
                    fill="url(#chartGrad)"
                  />
                  <path
                    d="M0,50 L20,42 L40,45 L60,30 L80,33 L100,22 L120,28 L140,15 L160,18 L180,10 L200,12 L220,5 L240,8"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                </svg>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                  <div>
                    <p className="text-[#22c55e] font-black text-base leading-none">160+</p>
                    <p className="text-[#666] text-[9px] font-mono uppercase tracking-wider mt-1">
                      Countries
                    </p>
                  </div>
                  <div>
                    <p className="text-[#22c55e] font-black text-base leading-none">51</p>
                    <p className="text-[#666] text-[9px] font-mono uppercase tracking-wider mt-1">
                      Markets
                    </p>
                  </div>
                  <div>
                    <p className="text-[#22c55e] font-black text-base leading-none">15+</p>
                    <p className="text-[#666] text-[9px] font-mono uppercase tracking-wider mt-1">
                      Calculators
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <a className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] shadow-[0_8px_30px_rgba(34,197,94,0.5)]">
                <span className="text-black font-bold text-sm font-mono">
                  wealthclaude.com
                </span>
                <FiArrowRight size={14} className="text-black" />
              </a>
            </div>
          </div>

          {/* Bottom-right tagline */}
          <p className="absolute bottom-4 right-7 text-[#555] text-[10px] font-mono uppercase tracking-[0.3em] z-10">
            ✦ Built by Krishna Amarneni ✦
          </p>
        </div>
      </DownloadCard>
    </main>
  );
}
