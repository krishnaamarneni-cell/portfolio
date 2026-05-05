"use client";

import { useState } from "react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import Parallax3D from "./Parallax3D";
import {
  FiTrendingUp,
  FiLock,
  FiArrowUpRight,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import HoverSpotlight from "./HoverSpotlight";

type Holding = {
  ticker: string;
  name: string;
  thesis: string;
  category: "Public" | "Private";
  brandColor: string;
  link?: string;
};

const publicHoldings: Holding[] = [
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
    ticker: "WMT",
    name: "Walmart Inc.",
    thesis:
      "Defensive compounder dominating retail + e-commerce. Steady earnings growth, dividend aristocrat, and a strong digital flywheel.",
    category: "Public",
    brandColor: "#0071ce",
    link: "https://www.google.com/finance/quote/WMT:NYSE",
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
    ticker: "CAVA",
    name: "CAVA Group",
    thesis:
      "Mediterranean fast-casual category creator with strong unit economics and Chipotle-like expansion potential.",
    category: "Public",
    brandColor: "#d4a574",
    link: "https://www.google.com/finance/quote/CAVA:NYSE",
  },
  {
    ticker: "CELH",
    name: "Celsius Holdings",
    thesis:
      "Fast-growing energy drink brand riding the healthier-alternative wave with strong DTC and gym-channel pull.",
    category: "Public",
    brandColor: "#00b3a6",
    link: "https://www.google.com/finance/quote/CELH:NASDAQ",
  },
  {
    ticker: "AMZN",
    name: "Amazon.com",
    thesis:
      "AWS print money + retail flywheel + advertising business. Long-term compounder with AI tailwinds.",
    category: "Public",
    brandColor: "#ff9900",
    link: "https://www.google.com/finance/quote/AMZN:NASDAQ",
  },
];

const privateHoldings: Holding[] = [
  {
    ticker: "EDERRA",
    name: "Ederra (Private)",
    thesis:
      "Early-stage private investment in a category I deeply believe in. Locked-up but high conviction.",
    category: "Private",
    brandColor: "#ff6b00",
  },
];

const PER_PAGE = 3;

function HoldingCard({ h, index }: { h: Holding; index: number }) {
  const dirs = ["flipY", "rotate3d", "zoom3d", "flipX", "rotate3d"] as const;
  const Wrapper = h.link ? "a" : "div";
  const wrapperProps = h.link
    ? { href: h.link, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <ScrollReveal delay={index * 0.08} direction={dirs[index % dirs.length]}>
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
                    {h.category === "Private" ? <FiLock size={18} /> : h.ticker.slice(0, 4)}
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

              {/* Mini sparkline */}
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
              {h.link ? (
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                  <span className="text-xs text-[#ff6b00] font-medium">View on Google Finance</span>
                  <FiArrowUpRight
                    size={14}
                    className="text-[#666] group-hover:text-[#ff6b00] group-hover:rotate-45 transition-all"
                  />
                </div>
              ) : (
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
}

function Carousel({ holdings, label }: { holdings: Holding[]; label: string }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(holdings.length / PER_PAGE));
  const showPagination = holdings.length > PER_PAGE;

  const next = () => setPage((p) => (p + 1) % totalPages);
  const prev = () => setPage((p) => (p - 1 + totalPages) % totalPages);

  const start = page * PER_PAGE;
  const visible = holdings.slice(start, start + PER_PAGE);

  return (
    <div className="mb-16">
      {/* Section heading */}
      <div className="flex items-end justify-between mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#ff6b00] to-transparent" />
          <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {label}
            <span className="ml-3 text-sm font-mono text-[#666]">
              {holdings.length} {holdings.length === 1 ? "position" : "positions"}
            </span>
          </h3>
        </div>

        {/* Pagination controls */}
        {showPagination && (
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 text-white flex items-center justify-center transition-all active:scale-95"
              aria-label="Previous"
            >
              <FiChevronLeft size={16} />
            </button>
            <span className="text-[#888] text-xs font-mono min-w-[50px] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={next}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white flex items-center justify-center shadow-[0_8px_30px_rgba(255,107,0,0.4)] hover:scale-105 active:scale-95 transition-all"
              aria-label="Next"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        key={page}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-[fadeIn_0.5s_ease-out]"
      >
        {visible.map((h, i) => (
          <HoldingCard key={`${page}-${h.ticker}`} h={h} index={i} />
        ))}
      </div>

      {/* Page dots + mobile buttons */}
      {showPagination && (
        <>
          <div className="flex items-center justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-2 rounded-full transition-all ${
                  i === page ? "w-8 bg-[#ff6b00]" : "w-2 bg-white/[0.15] hover:bg-white/30"
                }`}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex md:hidden items-center justify-center gap-3 mt-5">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] text-white flex items-center justify-center"
              aria-label="Previous"
            >
              <FiChevronLeft size={16} />
            </button>
            <span className="text-[#888] text-xs font-mono min-w-[50px] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={next}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-white flex items-center justify-center shadow-md"
              aria-label="Next"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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
          <HoverSpotlight as="h2" className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 cursor-default">
            Where my <span className="text-gradient">money</span> lives
          </HoverSpotlight>
        </ScrollReveal>

        <ScrollReveal direction="zoom3d" delay={0.15}>
          <p className="text-[#666] text-lg mb-16 max-w-xl">
            High-conviction positions across public markets and private deals.
            <span className="block text-xs mt-2 text-[#555] italic">
              ⚠️ Personal positions · Not investment advice.
            </span>
          </p>
        </ScrollReveal>

        {/* Public — paginated 3-per-page loop */}
        <Carousel holdings={publicHoldings} label="Public Markets" />

        {/* Private — separate section */}
        <Carousel holdings={privateHoldings} label="Private Deals" />
      </div>
    </section>
  );
}
