"use client";

import { FiDownload, FiBookOpen, FiArrowUpRight } from "react-icons/fi";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import HoverSpotlight from "./HoverSpotlight";
import Parallax3D from "./Parallax3D";
import { useSiteContent } from "./SiteContentProvider";
import type { BookSection } from "@/lib/site-content-types";

function BookCover({ book }: { book: BookSection }) {
  return (
    <svg
      viewBox="0 0 400 600"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-label={`${book.title} book cover`}
    >
      <defs>
        {/* Sky → horizon → asphalt vertical gradient */}
        <linearGradient id="bkSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050505" />
          <stop offset="45%" stopColor="#1f0f04" />
          <stop offset="62%" stopColor="#5a2906" />
          <stop offset="68%" stopColor="#ff7a1f" />
          <stop offset="72%" stopColor="#3a1505" />
          <stop offset="100%" stopColor="#0a0604" />
        </linearGradient>

        <linearGradient id="bkOrange" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff6b00" />
          <stop offset="100%" stopColor="#ffb066" />
        </linearGradient>

        {/* Sun disc at horizon */}
        <radialGradient id="bkSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff2d6" />
          <stop offset="35%" stopColor="#ffb766" />
          <stop offset="65%" stopColor="#ff7a1f" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
        </radialGradient>

        {/* Subtle road darkening */}
        <linearGradient id="bkRoad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0604" stopOpacity="0" />
          <stop offset="30%" stopColor="#0a0604" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
        </linearGradient>

        {/* Faint paper grain */}
        <filter id="bkGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.6  0 0 0 0.045 0" />
        </filter>

        {/* Title text shadow */}
        <filter id="bkTitleShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" />
          <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <clipPath id="bkRoadClip">
          <path d="M 200 372 L 30 600 L 370 600 Z" />
        </clipPath>
      </defs>

      {/* Background sky + horizon */}
      <rect width="400" height="600" fill="url(#bkSky)" />

      {/* Distant mountains layer 1 */}
      <path
        d="M 0 372 L 30 360 L 60 366 L 95 350 L 130 362 L 165 348 L 200 360 L 235 350 L 270 364 L 310 354 L 345 366 L 400 358 L 400 372 Z"
        fill="#1a0b04"
        opacity="0.85"
      />
      {/* Distant mountains layer 2 (closer, slightly lighter) */}
      <path
        d="M 0 374 L 40 368 L 85 374 L 130 366 L 175 376 L 220 368 L 270 378 L 320 370 L 370 376 L 400 372 L 400 380 L 0 380 Z"
        fill="#2a1206"
        opacity="0.7"
      />

      {/* Sun glow at horizon center */}
      <ellipse cx="200" cy="372" rx="120" ry="60" fill="url(#bkSun)" />
      {/* Sun disc */}
      <circle cx="200" cy="372" r="22" fill="#fff2d6" opacity="0.95" />
      <circle cx="200" cy="372" r="22" fill="url(#bkSun)" />

      {/* Horizon line */}
      <line x1="0" y1="372" x2="400" y2="372" stroke="#ff8c38" strokeOpacity="0.4" strokeWidth="0.6" />

      {/* Road surface (clipped to triangle) */}
      <g clipPath="url(#bkRoadClip)">
        <rect x="0" y="372" width="400" height="228" fill="#1a0e06" />
        <rect x="0" y="372" width="400" height="228" fill="url(#bkRoad)" />

        {/* Center dashed lane line */}
        <g stroke="#ffd9a8" strokeLinecap="round" opacity="0.95">
          <line x1="200" y1="385" x2="200" y2="395" strokeWidth="1.4" />
          <line x1="200" y1="410" x2="200" y2="425" strokeWidth="1.8" />
          <line x1="200" y1="445" x2="200" y2="465" strokeWidth="2.4" />
          <line x1="200" y1="488" x2="200" y2="512" strokeWidth="3.2" />
          <line x1="200" y1="540" x2="200" y2="572" strokeWidth="4.2" />
        </g>

        {/* Subtle warm wash bouncing off road */}
        <ellipse cx="200" cy="500" rx="220" ry="120" fill="#ff7a1f" opacity="0.08" />
      </g>

      {/* Header — publisher mark */}
      <g>
        <line x1="80" y1="50" x2="160" y2="50" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.8" />
        <line x1="240" y1="50" x2="320" y2="50" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.8" />
        <text x="200" y="54" textAnchor="middle" fill="#ffaa66" fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="8" letterSpacing="3.5">
          {book.cover_publisher_text}
        </text>
      </g>

      {/* Title — DRIVE TO (smaller) */}
      <text
        x="200"
        y="148"
        textAnchor="middle"
        fill="#ffd9a8"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="22"
        fontWeight="400"
        letterSpacing="14"
        filter="url(#bkTitleShadow)"
      >
        {book.cover_title_line_1}
      </text>

      {/* Title — FREEDOM (huge, dramatic) */}
      <text
        x="200"
        y="232"
        textAnchor="middle"
        fill="url(#bkOrange)"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="68"
        fontWeight="700"
        letterSpacing="2"
        filter="url(#bkTitleShadow)"
      >
        {book.cover_title_line_2}
      </text>

      {/* Ornament divider */}
      <g transform="translate(200, 268)">
        <line x1="-70" y1="0" x2="-12" y2="0" stroke="#ff8c38" strokeWidth="0.6" />
        <circle cx="-6" cy="0" r="1.2" fill="#ff8c38" />
        <circle cx="0" cy="0" r="2" fill="#ff8c38" />
        <circle cx="6" cy="0" r="1.2" fill="#ff8c38" />
        <line x1="12" y1="0" x2="70" y2="0" stroke="#ff8c38" strokeWidth="0.6" />
      </g>

      {/* Subtitle */}
      {splitSubtitleLines(book.cover_subtitle).map((line, i, arr) => (
        <text
          key={i}
          x="200"
          y={296 + i * 22}
          textAnchor="middle"
          fill="#ede1d0"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={arr.length > 2 ? 13 : 15}
          fontStyle="italic"
          letterSpacing="0.5"
        >
          {line}
        </text>
      ))}

      {/* Author block at bottom */}
      <g>
        <line x1="120" y1="546" x2="180" y2="546" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.6" />
        <line x1="220" y1="546" x2="280" y2="546" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.6" />
        <text x="200" y="550" textAnchor="middle" fill="#ffaa66" fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="8" letterSpacing="3">
          FIRST EDITION
        </text>
        <text
          x="200"
          y="578"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="17"
          fontWeight="700"
          letterSpacing="4"
        >
          {book.cover_author}
        </text>
      </g>

      {/* Paper grain */}
      <rect width="400" height="600" filter="url(#bkGrain)" opacity="0.6" pointerEvents="none" />

      {/* Vignette */}
      <rect width="400" height="600" fill="url(#bkVignette)" />
      <defs>
        <radialGradient id="bkVignette" cx="0.5" cy="0.5" r="0.7">
          <stop offset="60%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function splitSubtitleLines(s: string): string[] {
  if (s.length <= 28) return [s];
  const words = s.split(" ");
  // Try to find a natural breakpoint near the middle.
  const targetLen = Math.ceil(s.length / 2);
  let acc = 0;
  let breakAt = words.length;
  for (let i = 0; i < words.length; i++) {
    acc += words[i].length + 1;
    if (acc >= targetLen) {
      breakAt = i + 1;
      break;
    }
  }
  return [words.slice(0, breakAt).join(" "), words.slice(breakAt).join(" ")];
}

export default function Book() {
  const { book } = useSiteContent();

  return (
    <section id="book" className="relative py-28 lg:py-36 px-6 lg:px-10 overflow-hidden">
      <Parallax3D speed={0.03} rotateIntensity={1}>
        <div className="absolute top-20 left-6 lg:left-10 text-[100px] lg:text-[160px] font-bold text-stroke-orange leading-none select-none pointer-events-none">
          BOOK
        </div>
      </Parallax3D>

      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-[#ff6b00]/[0.06] rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div className="mb-16">
          <ScrollReveal direction="rotate3d">
            <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
              {book.eyebrow}
            </p>
          </ScrollReveal>

          <ScrollReveal direction="flipX" delay={0.1}>
            <HoverSpotlight
              as="h2"
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 cursor-default"
            >
              {book.heading_pre} <span className="text-gradient">{book.heading_accent}</span>
            </HoverSpotlight>
          </ScrollReveal>

          <ScrollReveal direction="zoom3d" delay={0.15}>
            <p className="text-[#666] text-lg max-w-2xl">{book.intro}</p>
          </ScrollReveal>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <ScrollReveal direction="flipY" delay={0.2}>
              <TiltCard className="rounded-2xl mx-auto max-w-[360px]" intensity={14}>
                <div
                  className="aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(255,107,0,0.25),0_10px_30px_rgba(0,0,0,0.6)] border border-white/[0.06] relative"
                  style={{ transform: "perspective(1200px) rotateY(-3deg)" }}
                >
                  <BookCover book={book} />
                  <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-white/15 to-transparent" />
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>
              </TiltCard>
            </ScrollReveal>
          </div>

          <div className="lg:col-span-7">
            <ScrollReveal direction="flipX" delay={0.25}>
              <div className="flex items-center gap-3 mb-5">
                <span className="px-3 py-1 rounded-full bg-[#ff6b00] text-black text-[10px] font-bold tracking-[0.2em] uppercase">
                  {book.status_badge}
                </span>
                <span className="text-[#666] text-xs font-mono tracking-[0.15em] uppercase">
                  {book.publisher_tag}
                </span>
              </div>

              <h3 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
                {book.title}
              </h3>
              <p
                className="text-[#ff6b00] text-lg mb-6"
                style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
              >
                {book.subtitle}
              </p>

              <div className="space-y-4 text-[#aaa] text-base leading-relaxed mb-8 max-w-2xl">
                {book.blurb_paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {book.chapters.length > 0 && (
                <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] p-6 lg:p-7 mb-8">
                  <p className="text-[#ff6b00] text-xs font-mono tracking-[0.25em] uppercase mb-4">
                    Inside the book
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {book.chapters.map((c, i) => (
                      <li key={`${c}-${i}`} className="flex items-start gap-3 text-sm text-[#bbb]">
                        <span className="text-[#ff6b00] font-mono text-xs w-6 shrink-0 pt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={book.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.45)] hover:scale-[1.03] active:scale-95 transition-transform"
                >
                  <FiBookOpen size={16} />
                  Read Excerpt
                  <FiArrowUpRight
                    size={14}
                    className="group-hover:rotate-45 transition-transform"
                  />
                </a>
                <a
                  href={book.pdf_url}
                  download
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.04] border border-white/10 text-white font-semibold text-sm hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/[0.08] transition-all"
                >
                  <FiDownload size={16} />
                  Download PDF
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
