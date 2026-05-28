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
      aria-label={`${book.title} book cover`}
    >
      <defs>
        <linearGradient id="bookBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0a0a" />
          <stop offset="55%" stopColor="#1a0a02" />
          <stop offset="100%" stopColor="#2a0f02" />
        </linearGradient>
        <linearGradient id="orange" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff6b00" />
          <stop offset="100%" stopColor="#ff8c38" />
        </linearGradient>
        <linearGradient id="roadFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6b00" stopOpacity="0" />
          <stop offset="40%" stopColor="#ff6b00" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ff6b00" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffaa66" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#ff6b00" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
        </radialGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0" />
        </filter>
      </defs>

      <rect width="400" height="600" fill="url(#bookBg)" />
      <circle cx="200" cy="360" r="180" fill="url(#sunGlow)" />

      <g opacity="0.85">
        <path d="M 200 360 L 60 600 L 340 600 Z" fill="url(#roadFade)" />
        <g stroke="#ff8c38" strokeLinecap="round" opacity="0.9">
          <line x1="200" y1="378" x2="200" y2="390" strokeWidth="1.2" />
          <line x1="200" y1="408" x2="200" y2="426" strokeWidth="1.6" />
          <line x1="200" y1="446" x2="200" y2="470" strokeWidth="2.2" />
          <line x1="200" y1="494" x2="200" y2="524" strokeWidth="2.8" />
          <line x1="200" y1="552" x2="200" y2="588" strokeWidth="3.5" />
        </g>
      </g>

      <line x1="40" y1="360" x2="360" y2="360" stroke="#ff6b00" strokeOpacity="0.35" strokeWidth="1" />

      <g transform="translate(170, 340)" fill="#0a0a0a" stroke="#ff6b00" strokeWidth="1.2">
        <path d="M 0 18 Q 4 6 14 4 L 38 4 Q 50 4 56 12 L 60 18 Z" />
        <circle cx="14" cy="20" r="3" fill="#ff6b00" />
        <circle cx="48" cy="20" r="3" fill="#ff6b00" />
      </g>
      <path d="M 175 360 L 140 420 L 195 420 Z" fill="#ff8c38" opacity="0.18" />
      <path d="M 225 360 L 205 420 L 260 420 Z" fill="#ff8c38" opacity="0.18" />

      <text x="200" y="60" textAnchor="middle" fill="#ff6b00" fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="9" letterSpacing="4">
        {book.cover_publisher_text}
      </text>
      <line x1="160" y1="74" x2="240" y2="74" stroke="#ff6b00" strokeOpacity="0.4" strokeWidth="0.8" />

      <text x="200" y="160" textAnchor="middle" fill="url(#orange)" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="48" fontWeight="900" letterSpacing="-1">
        {book.cover_title_line_1}
      </text>
      <text x="200" y="212" textAnchor="middle" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="48" fontWeight="900" letterSpacing="-1">
        {book.cover_title_line_2}
      </text>

      <g transform="translate(200, 240)">
        <line x1="-50" y1="0" x2="-10" y2="0" stroke="#ff6b00" strokeWidth="1" />
        <circle cx="0" cy="0" r="2.5" fill="#ff6b00" />
        <line x1="10" y1="0" x2="50" y2="0" stroke="#ff6b00" strokeWidth="1" />
      </g>

      {splitSubtitle(book.cover_subtitle).map((line, i) => (
        <text
          key={i}
          x="200"
          y={272 + i * 20}
          textAnchor="middle"
          fill="#cccccc"
          fontFamily="Georgia, serif"
          fontSize="14"
          fontStyle="italic"
        >
          {line}
        </text>
      ))}

      <text x="200" y="558" textAnchor="middle" fill="#ffffff" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="16" fontWeight="700" letterSpacing="3">
        {book.cover_author}
      </text>

      <rect x="10" y="10" width="380" height="580" fill="none" stroke="#ff6b00" strokeOpacity="0.25" strokeWidth="1" rx="4" />
      <rect width="400" height="600" filter="url(#grain)" opacity="0.5" />
    </svg>
  );
}

function splitSubtitle(s: string): string[] {
  if (s.length <= 30) return [s];
  const words = s.split(" ");
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
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
