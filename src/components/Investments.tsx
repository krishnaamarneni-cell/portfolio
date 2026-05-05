"use client";

import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import { FiTrendingUp, FiLock, FiArrowUpRight } from "react-icons/fi";

type Holding = {
  ticker: string;
  name: string;
  thesis: string;
  category: "Public" | "Private";
  brandColor: string;
  link?: string;
};

const holdings: Holding[] = [
  {
    ticker: "AMD",
    name: "Advanced Micro Devices",
    thesis:
      "Riding the AI compute wave with MI300/MI325 chips — a credible challenger to NVIDIA in data-center GPUs.",
    category: "Public",
    brandColor: "#ed1c24",
    link: "https://www.google.com/finance/quote/AMD:NASDAQ",
  },
  {
    ticker: "WAL",
    name: "Western Alliance Bancorp",
    thesis:
      "Strong regional bank with deep deposit growth and undervalued post-2023 panic — quality compounder at a discount.",
    category: "Public",
    brandColor: "#003366",
    link: "https://www.google.com/finance/quote/WAL:NYSE",
  },
  {
    ticker: "MSTR",
    name: "Strategy (formerly MicroStrategy)",
    thesis:
      "Largest corporate Bitcoin treasury — leveraged, asymmetric exposure to BTC's long-term thesis.",
    category: "Public",
    brandColor: "#f7931a",
    link: "https://www.google.com/finance/quote/MSTR:NASDAQ",
  },
  {
    ticker: "META",
    name: "Meta Platforms",
    thesis:
      "Cash machine with the largest social graph on Earth — Reels monetization, AI personalization, and Llama leverage.",
    category: "Public",
    brandColor: "#1877f2",
    link: "https://www.google.com/finance/quote/META:NASDAQ",
  },
  {
    ticker: "EDERRA",
    name: "Ederra (Private)",
    thesis:
      "Early-stage private investment in a category I deeply believe in. Locked-up but high conviction.",
    category: "Private",
    brandColor: "#ff6b00",
  },
];

export default function Investments() {
  return (
    <section id="investments" className="relative py-28 lg:py-36 px-6 lg:px-10">
      <Parallax3D speed={0.03} rotateIntensity={1}>
        <div className="absolute top-20 right-6 lg:right-10 text-[100px] lg:text-[160px] font-bold text-stroke-orange leading-none select-none pointer-events-none">
          PORTFOLIO
        </div>
      </Parallax3D>

      <div className="max-w-7xl mx-auto relative">
        <ScrollReveal direction="rotate3d">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            // My Top Investments
          </p>
        </ScrollReveal>

        <ScrollReveal direction="flipX" delay={0.1}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Where my{" "}
            <span className="text-gradient">money</span> lives
          </h2>
        </ScrollReveal>

        <ScrollReveal direction="zoom3d" delay={0.15}>
          <p className="text-[#666] text-lg mb-16 max-w-xl">
            High-conviction positions across public markets and private deals.
            <span className="block text-xs mt-2 text-[#555] italic">
              ⚠️ Personal positions · Not investment advice.
            </span>
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {holdings.map((h, i) => {
            const dirs = ["flipY", "rotate3d", "zoom3d", "flipX", "rotate3d"] as const;
            const Wrapper = h.link ? "a" : "div";
            const wrapperProps = h.link
              ? { href: h.link, target: "_blank", rel: "noopener noreferrer" }
              : {};

            return (
              <ScrollReveal key={h.ticker} delay={i * 0.1} direction={dirs[i % dirs.length]}>
                <Wrapper {...wrapperProps} className="group block w-full">
                  <TiltCard className="h-full rounded-[20px]" intensity={10}>
                    <div className="h-full rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-500 overflow-hidden shadow-3d card-3d-shine relative">
                      {/* Brand color stripe */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: h.brandColor }}
                      />

                      <div className="p-7">
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-5">
                          <div className="flex items-center gap-3">
                            {/* Ticker badge */}
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg shrink-0"
                              style={{ backgroundColor: h.brandColor }}
                            >
                              {h.category === "Private" ? <FiLock size={18} /> : null}
                              {h.category === "Public" && h.ticker.slice(0, 4)}
                            </div>
                            <div>
                              <h3 className="text-white font-bold text-lg leading-tight">{h.ticker}</h3>
                              <p className="text-[#888] text-xs mt-0.5">{h.name}</p>
                            </div>
                          </div>

                          {/* Category badge */}
                          {h.category === "Private" ? (
                            <span className="text-[9px] font-bold tracking-wider px-2 py-1 rounded-md bg-[#ff6b00]/15 text-[#ff8c38] border border-[#ff6b00]/30 uppercase">
                              Private
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold tracking-wider px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                              Public
                            </span>
                          )}
                        </div>

                        {/* Thesis */}
                        <p className="text-[#bbb] text-sm leading-relaxed mb-5">{h.thesis}</p>

                        {/* Mini sparkline (decorative) */}
                        <div className="relative h-12 -mx-1 mb-4">
                          <svg viewBox="0 0 240 48" className="w-full h-full">
                            <defs>
                              <linearGradient id={`grad-${h.ticker}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={h.brandColor} stopOpacity="0.5" />
                                <stop offset="100%" stopColor={h.brandColor} stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M0,38 L20,30 L40,34 L60,22 L80,26 L100,18 L120,14 L140,20 L160,10 L180,12 L200,6 L220,4 L240,2 L240,48 L0,48 Z"
                              fill={`url(#grad-${h.ticker})`}
                            />
                            <path
                              d="M0,38 L20,30 L40,34 L60,22 L80,26 L100,18 L120,14 L140,20 L160,10 L180,12 L200,6 L220,4 L240,2"
                              fill="none"
                              stroke={h.brandColor}
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute top-1 right-2 flex items-center gap-1 text-emerald-400 text-xs font-mono">
                            <FiTrendingUp size={11} />
                            <span>conviction</span>
                          </div>
                        </div>

                        {/* Footer */}
                        {h.link && (
                          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                            <span className="text-xs text-[#ff6b00] font-medium">
                              View on Google Finance
                            </span>
                            <FiArrowUpRight
                              size={14}
                              className="text-[#666] group-hover:text-[#ff6b00] group-hover:rotate-45 transition-all"
                            />
                          </div>
                        )}
                        {!h.link && (
                          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                            <span className="text-xs text-[#666] font-mono italic">
                              🔒 Private position — locked up
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TiltCard>
                </Wrapper>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
