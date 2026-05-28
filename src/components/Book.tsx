"use client";

import { useState, useEffect } from "react";
import {
  FiDownload,
  FiBookOpen,
  FiArrowUpRight,
  FiRotateCw,
  FiX,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { FaStar } from "react-icons/fa6";
import ScrollReveal from "./ScrollReveal";
import HoverSpotlight from "./HoverSpotlight";
import Parallax3D from "./Parallax3D";
import ShareMenu from "./ShareMenu";
import { useSiteContent } from "./SiteContentProvider";
import type { BookSection } from "@/lib/site-content-types";

/* ───────────────────────── cover image config ─────────────────────────
 * Bookcover.png is a flat spread laid out as: BACK | SPINE | FRONT.
 * The image is 1774 × 887. Each face is ~5/6 (wider than a real 2/3 book
 * because the source is a stylized mockup with margins).
 *
 * We render the cover faces by using the image as a background and sliding
 * it left (back) or right (front).
 */
const COVER_IMAGE_SRC = "/Bookcover.png";
const COVER_FACE_ASPECT = "5 / 6";

/* ───────────────────────── front cover (image) ───────────────────────── */

function BookCoverImage({
  face,
  ariaLabel,
}: {
  face: "front" | "back";
  ariaLabel: string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full h-full block"
      style={{
        backgroundImage: `url(${COVER_IMAGE_SRC})`,
        backgroundSize: "auto 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: face === "front" ? "100% center" : "0% center",
        backgroundColor: "#0a0604",
      }}
    />
  );
}

/* keep the SVG cover as a fallback in case the image is missing */
function BookCoverFrontSVG({ book }: { book: BookSection }) {
  return (
    <svg
      viewBox="0 0 400 600"
      className="w-full h-full block"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-label={`${book.title} front cover`}
    >
      <defs>
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
        <radialGradient id="bkSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff2d6" />
          <stop offset="35%" stopColor="#ffb766" />
          <stop offset="65%" stopColor="#ff7a1f" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bkRoad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0604" stopOpacity="0" />
          <stop offset="30%" stopColor="#0a0604" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
        </linearGradient>
        <filter id="bkGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.6  0 0 0 0.045 0" />
        </filter>
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
        <radialGradient id="bkVignette" cx="0.5" cy="0.5" r="0.7">
          <stop offset="60%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      <rect width="400" height="600" fill="url(#bkSky)" />

      <path d="M 0 372 L 30 360 L 60 366 L 95 350 L 130 362 L 165 348 L 200 360 L 235 350 L 270 364 L 310 354 L 345 366 L 400 358 L 400 372 Z" fill="#1a0b04" opacity="0.85" />
      <path d="M 0 374 L 40 368 L 85 374 L 130 366 L 175 376 L 220 368 L 270 378 L 320 370 L 370 376 L 400 372 L 400 380 L 0 380 Z" fill="#2a1206" opacity="0.7" />

      <ellipse cx="200" cy="372" rx="120" ry="60" fill="url(#bkSun)" />
      <circle cx="200" cy="372" r="22" fill="#fff2d6" opacity="0.95" />
      <circle cx="200" cy="372" r="22" fill="url(#bkSun)" />

      <line x1="0" y1="372" x2="400" y2="372" stroke="#ff8c38" strokeOpacity="0.4" strokeWidth="0.6" />

      <g clipPath="url(#bkRoadClip)">
        <rect x="0" y="372" width="400" height="228" fill="#1a0e06" />
        <rect x="0" y="372" width="400" height="228" fill="url(#bkRoad)" />
        <g stroke="#ffd9a8" strokeLinecap="round" opacity="0.95">
          <line x1="200" y1="385" x2="200" y2="395" strokeWidth="1.4" />
          <line x1="200" y1="410" x2="200" y2="425" strokeWidth="1.8" />
          <line x1="200" y1="445" x2="200" y2="465" strokeWidth="2.4" />
          <line x1="200" y1="488" x2="200" y2="512" strokeWidth="3.2" />
          <line x1="200" y1="540" x2="200" y2="572" strokeWidth="4.2" />
        </g>
        <ellipse cx="200" cy="500" rx="220" ry="120" fill="#ff7a1f" opacity="0.08" />
      </g>

      <g>
        <line x1="80" y1="50" x2="160" y2="50" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.8" />
        <line x1="240" y1="50" x2="320" y2="50" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.8" />
        <text x="200" y="54" textAnchor="middle" fill="#ffaa66" fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="8" letterSpacing="3.5">
          {book.cover_publisher_text}
        </text>
      </g>

      <text x="200" y="148" textAnchor="middle" fill="#ffd9a8" fontFamily="Georgia, 'Times New Roman', serif" fontSize="22" fontWeight="400" letterSpacing="14" filter="url(#bkTitleShadow)">
        {book.cover_title_line_1}
      </text>

      <text x="200" y="232" textAnchor="middle" fill="url(#bkOrange)" fontFamily="Georgia, 'Times New Roman', serif" fontSize="68" fontWeight="700" letterSpacing="2" filter="url(#bkTitleShadow)">
        {book.cover_title_line_2}
      </text>

      <g transform="translate(200, 268)">
        <line x1="-70" y1="0" x2="-12" y2="0" stroke="#ff8c38" strokeWidth="0.6" />
        <circle cx="-6" cy="0" r="1.2" fill="#ff8c38" />
        <circle cx="0" cy="0" r="2" fill="#ff8c38" />
        <circle cx="6" cy="0" r="1.2" fill="#ff8c38" />
        <line x1="12" y1="0" x2="70" y2="0" stroke="#ff8c38" strokeWidth="0.6" />
      </g>

      {splitSubtitleLines(book.cover_subtitle).map((line, i, arr) => (
        <text key={i} x="200" y={296 + i * 22} textAnchor="middle" fill="#ede1d0" fontFamily="Georgia, 'Times New Roman', serif" fontSize={arr.length > 2 ? 13 : 15} fontStyle="italic" letterSpacing="0.5">
          {line}
        </text>
      ))}

      <g>
        <line x1="120" y1="546" x2="180" y2="546" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.6" />
        <line x1="220" y1="546" x2="280" y2="546" stroke="#ff8c38" strokeOpacity="0.5" strokeWidth="0.6" />
        <text x="200" y="550" textAnchor="middle" fill="#ffaa66" fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="8" letterSpacing="3">
          FIRST EDITION
        </text>
        <text x="200" y="578" textAnchor="middle" fill="#ffffff" fontFamily="Georgia, 'Times New Roman', serif" fontSize="17" fontWeight="700" letterSpacing="4">
          {book.cover_author}
        </text>
      </g>

      <rect width="400" height="600" filter="url(#bkGrain)" opacity="0.6" pointerEvents="none" />
      <rect width="400" height="600" fill="url(#bkVignette)" />
    </svg>
  );
}

function splitSubtitleLines(s: string): string[] {
  if (s.length <= 28) return [s];
  const words = s.split(" ");
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

/* ───────────────────────── back cover (HTML) ───────────────────────── */

function BookCoverFront({ book }: { book: BookSection }) {
  void book; // image carries its own typography
  return <BookCoverImage face="front" ariaLabel="Drive to Freedom front cover" />;
}

function BookCoverBack({ book }: { book: BookSection }) {
  void book;
  return <BookCoverImage face="back" ariaLabel="Drive to Freedom back cover" />;
}

function BookCoverBackSVG({ book }: { book: BookSection }) {
  const firstSynopsis = book.back_synopsis[0] ?? "";
  const restSynopsis = book.back_synopsis.slice(1);
  // Drop cap: take first character only if it's a letter; else fall back to whole paragraph.
  const firstChar = /^[A-Za-z]/.test(firstSynopsis) ? firstSynopsis[0] : "";
  const firstBody = firstChar ? firstSynopsis.slice(1) : firstSynopsis;
  const authorInitials = (book.cover_author || "K A")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <div
      className="w-full h-full relative overflow-hidden flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, #0a0604 0%, #1a0e06 35%, #20100a 65%, #0d0805 100%)",
      }}
    >
      {/* paper grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.32] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.6  0 0 0 0.06 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* corner ornaments — gives a designed-cover feel */}
      <div className="absolute top-0 left-0 w-10 h-10 pointer-events-none">
        <div className="absolute top-3 left-3 w-5 h-px bg-[#ff8c38]/40" />
        <div className="absolute top-3 left-3 w-px h-5 bg-[#ff8c38]/40" />
      </div>
      <div className="absolute top-0 right-0 w-10 h-10 pointer-events-none">
        <div className="absolute top-3 right-3 w-5 h-px bg-[#ff8c38]/40" />
        <div className="absolute top-3 right-3 w-px h-5 bg-[#ff8c38]/40" />
      </div>
      <div className="absolute bottom-0 left-0 w-10 h-10 pointer-events-none">
        <div className="absolute bottom-3 left-3 w-5 h-px bg-[#ff8c38]/40" />
        <div className="absolute bottom-3 left-3 w-px h-5 bg-[#ff8c38]/40" />
      </div>
      <div className="absolute bottom-0 right-0 w-10 h-10 pointer-events-none">
        <div className="absolute bottom-3 right-3 w-5 h-px bg-[#ff8c38]/40" />
        <div className="absolute bottom-3 right-3 w-px h-5 bg-[#ff8c38]/40" />
      </div>

      {/* vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 60%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      <div className="relative px-7 pt-7 pb-4 flex-1 flex flex-col">
        {/* publisher mark */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="h-px w-8 bg-[#ff8c38]/50" />
          <span className="text-[#ffaa66] font-mono text-[8px] tracking-[0.35em]">
            {book.cover_publisher_text}
          </span>
          <span className="h-px w-8 bg-[#ff8c38]/50" />
        </div>

        {/* 5-star rating */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <FaStar key={i} size={10} className="text-[#ff8c38]" />
          ))}
        </div>

        {/* praise pull-quote — large drop quote with framing */}
        {book.back_praise_quote && (
          <blockquote className="relative text-center mb-5 px-2">
            <span
              aria-hidden="true"
              className="absolute -top-2 left-0 text-[#ff6b00]/30 font-bold leading-none select-none"
              style={{ fontFamily: "Georgia, serif", fontSize: 28 }}
            >
              &ldquo;
            </span>
            <p
              className="text-[#ffd9a8] text-[12px] leading-[1.45] italic relative z-10"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {book.back_praise_quote}
            </p>
            <span
              aria-hidden="true"
              className="absolute -bottom-3 right-0 text-[#ff6b00]/30 font-bold leading-none select-none"
              style={{ fontFamily: "Georgia, serif", fontSize: 28 }}
            >
              &rdquo;
            </span>
            {book.back_praise_attribution && (
              <p className="text-[#ff8c38] text-[9px] font-mono tracking-[0.2em] uppercase mt-2">
                {book.back_praise_attribution}
              </p>
            )}
          </blockquote>
        )}

        {/* genre divider */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="h-px flex-1 max-w-[60px] bg-[#ff8c38]/30" />
          <span className="text-[#ff8c38] font-mono text-[8px] tracking-[0.3em] uppercase whitespace-nowrap">
            Non-Fiction · Memoir · Finance
          </span>
          <span className="h-px flex-1 max-w-[60px] bg-[#ff8c38]/30" />
        </div>

        {/* synopsis with drop cap */}
        <div className="space-y-2 text-[#e0d4c0] text-[10.5px] leading-[1.55] flex-1 overflow-hidden">
          {firstSynopsis && (
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {firstChar && (
                <span
                  className="float-left text-[#ff8c38] mr-1.5 leading-[0.85]"
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: 34,
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  {firstChar}
                </span>
              )}
              {firstBody}
            </p>
          )}
          {restSynopsis.map((p, i) => (
            <p
              key={i}
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {p}
            </p>
          ))}
        </div>

        {/* ornament divider */}
        <div className="flex items-center justify-center gap-2 my-3.5">
          <span className="h-px w-12 bg-[#ff8c38]/20" />
          <span className="text-[#ff8c38]/60 text-[8px]">✦</span>
          <span className="h-px w-12 bg-[#ff8c38]/20" />
        </div>

        {/* about author with avatar */}
        <div className="flex gap-3 items-start">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 relative"
            style={{
              background: "linear-gradient(135deg, #ff6b00, #ff8c38)",
              boxShadow:
                "0 0 0 1px rgba(255,170,102,0.5), 0 4px 12px rgba(255,107,0,0.3)",
            }}
          >
            <span
              className="text-[#0a0604] font-bold text-sm tracking-wider"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {authorInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#ff8c38] text-[8px] font-mono tracking-[0.25em] uppercase mb-1">
              About the Author
            </p>
            <p
              className="text-[#c4b8a4] text-[9.5px] leading-[1.55]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {book.back_author_bio}
            </p>
          </div>
        </div>
      </div>

      {/* barcode + price + publisher block at bottom */}
      <div className="relative mx-7 mb-5">
        <div className="rounded-[3px] bg-[#f5ead4] px-3 py-2 flex items-stretch gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col justify-between flex-1 min-w-0">
            <Barcode />
            <p className="text-[#0a0604] text-[7px] font-mono tracking-[0.1em] mt-1">
              {book.back_isbn}
            </p>
          </div>
          <div className="w-px bg-[#0a0604]/15 self-stretch" />
          <div className="text-right flex flex-col justify-between shrink-0">
            <p className="text-[#0a0604] text-[7px] font-mono tracking-[0.15em] uppercase">
              ISBN
            </p>
            <p
              className="text-[#0a0604] font-bold text-[14px] leading-tight"
              style={{ fontFamily: "Georgia, serif" }}
            >
              $24.99
              <span className="text-[8px] font-normal ml-0.5">US</span>
            </p>
            <p className="text-[#0a0604]/70 text-[7px] font-mono">
              $32.99 CAN
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Barcode() {
  // Deterministic but varied bar widths to look like a real EAN barcode.
  const bars = "1011010110011010100101100110101011001011010110010110101101101101010";
  return (
    <div className="flex items-end h-5 gap-[1px]">
      {bars.split("").map((c, i) => (
        <div
          key={i}
          className="bg-[#0a0604]"
          style={{
            width: c === "1" ? 2 : 1,
            height: i % 7 === 0 ? "100%" : "92%",
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────── 3D flippable book card ─────────────────── */

/**
 * 3D rotating book — front/back/spine all visible as it spins.
 * Hover or click to pause; click again to open the inside-pages modal.
 */
const BOOK_W = 340;
const BOOK_H = 470;
const BOOK_D = 72; // spine thickness in px

// Calibrated background-position-x for each face based on where the slice
// sits in Bookcover.png (1774×887 spread with back / spine / front).
const FACE_BG = {
  front: "82% center",
  back: "4% center",
  spine: "38% center",
} as const;

function BookGlobe3D({ onOpenInside }: { onOpenInside: () => void }) {
  const [paused, setPaused] = useState(false);

  const baseFace: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    backgroundImage: `url(${COVER_IMAGE_SRC})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "auto 100%",
    backgroundColor: "#0a0604",
    boxShadow: "inset 0 0 40px rgba(0,0,0,0.3)",
    backfaceVisibility: "hidden",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 4,
  };

  return (
    <div className="mx-auto" style={{ width: BOOK_W + 80 }}>
      <div
        className="relative mx-auto"
        style={{
          width: BOOK_W,
          height: BOOK_H,
          perspective: 2000,
          cursor: "pointer",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onClick={onOpenInside}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenInside();
          }
        }}
        aria-label="Open inside the book"
      >
        <div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            animation: "bookGlobeSpin 20s linear infinite",
            animationPlayState: paused ? "paused" : "running",
            transformOrigin: "center center",
          }}
        >
          {/* Front cover */}
          <div
            style={{
              ...baseFace,
              width: BOOK_W,
              height: BOOK_H,
              transform: `translate(-50%, -50%) translateZ(${BOOK_D / 2}px)`,
              backgroundPosition: FACE_BG.front,
            }}
          />
          {/* Back cover */}
          <div
            style={{
              ...baseFace,
              width: BOOK_W,
              height: BOOK_H,
              transform: `translate(-50%, -50%) rotateY(180deg) translateZ(${BOOK_D / 2}px)`,
              backgroundPosition: FACE_BG.back,
            }}
          />
          {/* Left side — spine */}
          <div
            style={{
              ...baseFace,
              width: BOOK_D,
              height: BOOK_H,
              transform: `translate(-50%, -50%) rotateY(-90deg) translateZ(${BOOK_W / 2}px)`,
              backgroundPosition: FACE_BG.spine,
              backgroundSize: "auto 100%",
            }}
          />
          {/* Right side — page edges */}
          <div
            style={{
              ...baseFace,
              width: BOOK_D,
              height: BOOK_H,
              transform: `translate(-50%, -50%) rotateY(90deg) translateZ(${BOOK_W / 2}px)`,
              backgroundImage: "none",
              background:
                "repeating-linear-gradient(90deg, #f5ead4 0px, #efe1bc 2px, #d4c08a 3px, #efe1bc 4px), linear-gradient(180deg, #f5ead4 0%, #c4ad7a 50%, #f5ead4 100%)",
            }}
          />
          {/* Top edge */}
          <div
            style={{
              ...baseFace,
              width: BOOK_W,
              height: BOOK_D,
              transform: `translate(-50%, -50%) rotateX(90deg) translateZ(${BOOK_H / 2}px)`,
              backgroundImage: "none",
              background:
                "repeating-linear-gradient(0deg, #f5ead4 0px, #efe1bc 1.5px, #d4c08a 3px), linear-gradient(90deg, #d4c08a 0%, #efe1bc 8%, #f5ead4 50%, #efe1bc 92%, #d4c08a 100%)",
            }}
          />
          {/* Bottom edge */}
          <div
            style={{
              ...baseFace,
              width: BOOK_W,
              height: BOOK_D,
              transform: `translate(-50%, -50%) rotateX(-90deg) translateZ(${BOOK_H / 2}px)`,
              backgroundImage: "none",
              background:
                "repeating-linear-gradient(0deg, #f5ead4 0px, #efe1bc 1.5px, #d4c08a 3px), linear-gradient(90deg, #d4c08a 0%, #efe1bc 8%, #f5ead4 50%, #efe1bc 92%, #d4c08a 100%)",
            }}
          />
        </div>
        {/* Soft floor shadow */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 bottom-[-32px] -translate-x-1/2 pointer-events-none"
          style={{
            width: BOOK_W * 0.9,
            height: 28,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(255,107,0,0.25) 0%, rgba(0,0,0,0) 70%)",
            filter: "blur(6px)",
          }}
        />
      </div>

      {/* Action buttons under cover */}
      <div className="flex items-center justify-center gap-2 mt-12">
        <button
          type="button"
          onClick={onOpenInside}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black text-xs font-semibold hover:scale-[1.03] transition-transform shadow-[0_4px_15px_rgba(255,107,0,0.35)]"
        >
          <FiBookOpen size={12} />
          Open inside
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-[#ccc] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] transition-colors"
        >
          <FiRotateCw size={12} className={paused ? "" : "animate-spin"} style={{ animationDuration: "3s" }} />
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <p className="text-center text-[10px] text-[#666] mt-2 font-mono tracking-wider uppercase">
        Hover to pause · Click to open
      </p>
    </div>
  );
}

/* ─────────────────── inside pages modal ─────────────────── */

type Spread = {
  leftKind: "toc" | "prologue" | "blank";
  rightKind: "toc" | "prologue" | "blank";
};

function BookPagesModal({
  book,
  onClose,
}: {
  book: BookSection;
  onClose: () => void;
}) {
  const [spread, setSpread] = useState(0);

  // Split prologue into paginated chunks (so it doesn't overflow).
  const prologueChunks = chunkParagraphs(book.prologue_text, 4);

  const spreads: Spread[] = [
    { leftKind: "blank", rightKind: "toc" },
    ...prologueChunks.map(() => ({
      leftKind: "prologue" as const,
      rightKind: "prologue" as const,
    })),
  ];
  // Pair prologue chunks two per spread
  const tocSpread = spreads[0];
  const prologueSpreadCount = Math.ceil(prologueChunks.length / 2);

  const totalSpreads = 1 + prologueSpreadCount;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setSpread((s) => Math.min(totalSpreads - 1, s + 1));
      if (e.key === "ArrowLeft") setSpread((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, totalSpreads]);

  function renderLeft() {
    if (spread === 0) {
      // First spread: blank left page (inside front cover)
      return <BlankPage />;
    }
    const idx = (spread - 1) * 2;
    const chunk = prologueChunks[idx];
    if (!chunk) return <BlankPage />;
    return (
      <ProloguePage
        title={spread === 1 && idx === 0 ? book.prologue_title : undefined}
        paragraphs={chunk}
        pageNumber={spread * 2}
      />
    );
  }
  function renderRight() {
    if (spread === 0) {
      // Right page: Table of contents
      return <TOCPage chapters={book.chapters} title={book.title} />;
    }
    const idx = (spread - 1) * 2 + 1;
    const chunk = prologueChunks[idx];
    if (!chunk) return <BlankPage />;
    return (
      <ProloguePage paragraphs={chunk} pageNumber={spread * 2 + 1} />
    );
  }

  void tocSpread; // silence unused

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 overflow-y-auto"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.12] flex items-center justify-center"
          aria-label="Close"
        >
          <FiX size={18} />
        </button>

        {/* Open-book spread */}
        <div
          className="relative grid grid-cols-1 sm:grid-cols-2 rounded-2xl overflow-hidden shadow-[0_40px_120px_rgba(255,107,0,0.15),0_20px_60px_rgba(0,0,0,0.8)] border border-white/[0.06]"
          style={{ aspectRatio: "2 / 1.4" }}
        >
          <div className="hidden sm:block relative">
            {renderLeft()}
            {/* center spine shadow on right edge of left page */}
            <div
              className="absolute inset-y-0 right-0 w-6 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.45) 100%)",
              }}
            />
          </div>
          <div className="relative">
            {renderRight()}
            {/* center spine shadow on left edge of right page (mobile shows only right) */}
            <div
              className="absolute inset-y-0 left-0 w-6 pointer-events-none hidden sm:block"
              style={{
                background:
                  "linear-gradient(270deg, transparent 0%, rgba(0,0,0,0.45) 100%)",
              }}
            />
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setSpread((s) => Math.max(0, s - 1))}
            disabled={spread === 0}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Previous"
          >
            <FiChevronLeft size={18} />
          </button>
          <span className="text-[#888] text-xs font-mono">
            Spread {spread + 1} / {totalSpreads}
          </span>
          <button
            type="button"
            onClick={() =>
              setSpread((s) => Math.min(totalSpreads - 1, s + 1))
            }
            disabled={spread === totalSpreads - 1}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-[0_4px_15px_rgba(255,107,0,0.35)]"
            aria-label="Next"
          >
            <FiChevronRight size={18} />
          </button>
        </div>

        {/* hint */}
        <p className="text-center text-[10px] text-[#666] mt-3 font-mono tracking-wider uppercase">
          Use ← / → keys to turn pages · Esc to close
        </p>
      </div>
    </div>
  );
}

function chunkParagraphs(paragraphs: string[], perPage: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < paragraphs.length; i += perPage) {
    out.push(paragraphs.slice(i, i + perPage));
  }
  return out;
}

const pageBg =
  "linear-gradient(180deg, #f6ecd6 0%, #efe3c6 100%)";

function BlankPage() {
  return (
    <div
      className="w-full h-full p-8 sm:p-12 flex items-end justify-end"
      style={{ background: pageBg }}
    >
      <span className="text-[#a89373] font-mono text-xs italic">
        — facing page —
      </span>
    </div>
  );
}

function TOCPage({
  chapters,
  title,
}: {
  chapters: string[];
  title: string;
}) {
  return (
    <div
      className="w-full h-full p-8 sm:p-12 overflow-hidden relative"
      style={{
        background: pageBg,
      }}
    >
      <div className="text-center mb-6">
        <p className="text-[#a89373] text-[10px] font-mono tracking-[0.3em] uppercase">
          {title}
        </p>
        <h3
          className="text-[#3a2810] text-2xl sm:text-3xl font-bold mt-2"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Contents
        </h3>
        <div className="flex items-center justify-center mt-3">
          <span className="h-px w-12 bg-[#a89373]/40" />
          <span className="mx-2 text-[#a89373]">✦</span>
          <span className="h-px w-12 bg-[#a89373]/40" />
        </div>
      </div>
      <ol className="space-y-2.5">
        {chapters.map((ch, i) => (
          <li
            key={i}
            className="flex items-baseline gap-2 text-[#3a2810] text-[12px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <span className="font-mono text-[#a89373] text-[10px] w-7 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 truncate">{ch}</span>
            <span
              className="border-b border-dotted border-[#a89373]/40 flex-shrink mx-1 mb-1"
              style={{ minWidth: "20px", flex: "1 1 auto" }}
            />
            <span className="font-mono text-[#a89373] text-[10px]">
              {String(8 + i * 12).padStart(3, " ")}
            </span>
          </li>
        ))}
      </ol>

      {/* page number */}
      <div className="absolute bottom-6 right-8 text-[#a89373] font-mono text-[10px]">
        ii
      </div>
    </div>
  );
}

function ProloguePage({
  title,
  paragraphs,
  pageNumber,
}: {
  title?: string;
  paragraphs: string[];
  pageNumber: number;
}) {
  return (
    <div
      className="w-full h-full p-8 sm:p-12 overflow-hidden relative"
      style={{ background: pageBg }}
    >
      {title && (
        <div className="text-center mb-6">
          <p className="text-[#a89373] text-[10px] font-mono tracking-[0.3em] uppercase">
            Prologue
          </p>
          <h3
            className="text-[#3a2810] text-2xl sm:text-3xl font-bold mt-2"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {title}
          </h3>
          <div className="flex items-center justify-center mt-3">
            <span className="h-px w-10 bg-[#a89373]/40" />
            <span className="mx-2 text-[#a89373]">✦</span>
            <span className="h-px w-10 bg-[#a89373]/40" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[#3a2810] text-[12px] leading-[1.7]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {p}
          </p>
        ))}
      </div>
      <div className="absolute bottom-6 left-8 right-8 flex items-center justify-between text-[#a89373] font-mono text-[10px]">
        <span>Drive to Freedom</span>
        <span>{pageNumber}</span>
      </div>
    </div>
  );
}

/* ─────────────────────── main section ─────────────────────── */

export default function Book() {
  const { book } = useSiteContent();
  const [pagesOpen, setPagesOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/#book`);
    }
  }, []);

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
            <HoverSpotlight as="h2" className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 cursor-default">
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
              <BookGlobe3D onOpenInside={() => setPagesOpen(true)} />
            </ScrollReveal>
          </div>

          <div className="lg:col-span-7">
            <ScrollReveal direction="flipX" delay={0.25}>
              <div className="flex items-center gap-3 mb-5 flex-wrap">
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
              <p className="text-[#ff6b00] text-lg mb-6" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
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
                <button
                  type="button"
                  onClick={() => setPagesOpen(true)}
                  className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.45)] hover:scale-[1.03] active:scale-95 transition-transform"
                >
                  <FiBookOpen size={16} />
                  Read Excerpt
                  <FiArrowUpRight size={14} className="group-hover:rotate-45 transition-transform" />
                </button>
                <a
                  href={book.pdf_url}
                  download
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.04] border border-white/10 text-white font-semibold text-sm hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/[0.08] transition-all"
                >
                  <FiDownload size={16} />
                  Download PDF
                </a>
                <ShareMenu
                  title={`${book.title} — ${book.subtitle}`}
                  description={book.intro}
                  url={shareUrl}
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>

      {pagesOpen && (
        <BookPagesModal book={book} onClose={() => setPagesOpen(false)} />
      )}
    </section>
  );
}
