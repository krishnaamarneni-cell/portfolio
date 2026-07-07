"use client";

import { useState, useEffect } from "react";
import {
  FiDownload,
  FiBookOpen,
  FiArrowUpRight,
  FiX,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import ScrollReveal from "./ScrollReveal";
import HoverSpotlight from "./HoverSpotlight";
import Parallax3D from "./Parallax3D";
import ShareMenu from "./ShareMenu";
import { useSiteContent } from "./SiteContentProvider";
import type { BookSection } from "@/lib/site-content-types";

/* ───────────────────────── 3D rotating book ─────────────────────────
 *
 * Each face uses its own image. Create these files in /public:
 *   /public/book-front.png   — 1200 × 1800   (aspect 2:3)
 *   /public/book-back.png    — 1200 × 1800   (aspect 2:3)
 *   /public/book-spine.png   —  260 × 1800   (aspect ~1:7, vertical strip)
 *
 * Each image fills its face exactly (background-size: 100% 100%), so as
 * long as the aspect ratios match, ChatGPT (or any image tool) just needs
 * to be told the dimensions above. The faces will never crop or stretch.
 *
 * If any of these files is missing, that face falls back to the spread
 * (Bookcover.png) slice — so you can swap them in one at a time.
 */
const COVER_IMAGE_SRC = "/Bookcover.png";
const BOOK_FRONT_SRC = "/Front.png";
const BOOK_BACK_SRC = "/back.png";
const BOOK_SPINE_SRC = "/spine.png";

// Book proportions on screen. The 2:3 ratio matches a real-world book.
const BOOK_W = 320; // front face width
const BOOK_H = 480; // front face height — 2:3 aspect
const BOOK_D = 70; // spine thickness — matches a ~300-page paperback

const SPREAD_W = 1774;

// Fallback slices used when the per-face images aren't present yet.
const SLICES = {
  back: { x: 80, w: 610 },
  spine: { x: 760, w: 150 },
  front: { x: 965, w: 720 },
};

/**
 * Stacked background: the per-face image sits on top; the Bookcover.png
 * slice underneath. If the per-face image isn't present yet, the slice
 * shows through unchanged.
 *
 * `topSize` defaults to "100% 100%" (no distortion when the per-face image
 * matches the face aspect ratio exactly). For the spine — whose source
 * image often has padding on the sides — we pass "cover" so the central
 * artwork fills the face without horizontal compression.
 */
function faceWithFallback(
  perFaceSrc: string,
  slice: keyof typeof SLICES,
  topSize: string = "100% 100%"
): React.CSSProperties {
  const s = SLICES[slice];
  const sliceSize = `${(SPREAD_W / s.w) * 100}% 100%`;
  const slicePos = `${(s.x / (SPREAD_W - s.w)) * 100}% center`;
  return {
    backgroundImage: `url(${perFaceSrc}), url(${COVER_IMAGE_SRC})`,
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: `${topSize}, ${sliceSize}`,
    backgroundPosition: `center center, ${slicePos}`,
    backgroundColor: "#050403",
  };
}

function BookGlobe3D({ onOpenInside }: { onOpenInside: () => void }) {
  const [paused, setPaused] = useState(false);

  const faceBase: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    overflow: "hidden",
    borderRadius: 6,
    backfaceVisibility: "hidden",
    boxShadow:
      "inset 0 0 28px rgba(0,0,0,0.45), 0 18px 45px rgba(0,0,0,0.45)",
    border: "1px solid rgba(212,160,70,0.35)",
  };

  return (
    <div className="mx-auto" style={{ width: BOOK_W + 100 }}>
      <div
        className="relative mx-auto"
        style={{
          width: BOOK_W,
          height: BOOK_H,
          perspective: 1800,
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
          }}
        >
          {/* FRONT */}
          <div
            style={{
              ...faceBase,
              ...faceWithFallback(BOOK_FRONT_SRC, "front"),
              width: BOOK_W,
              height: BOOK_H,
              transform: `translate(-50%, -50%) translateZ(${BOOK_D / 2}px)`,
            }}
          />

          {/* BACK */}
          <div
            style={{
              ...faceBase,
              ...faceWithFallback(BOOK_BACK_SRC, "back"),
              width: BOOK_W,
              height: BOOK_H,
              transform: `translate(-50%, -50%) rotateY(180deg) translateZ(${BOOK_D / 2}px)`,
            }}
          />

          {/* SPINE */}
          <div
            style={{
              ...faceBase,
              ...faceWithFallback(BOOK_SPINE_SRC, "spine", "cover"),
              width: BOOK_D,
              height: BOOK_H,
              transform: `translate(-50%, -50%) rotateY(-90deg) translateZ(${BOOK_W / 2}px)`,
            }}
          />

          {/* PAGE SIDE */}
          <div
            style={{
              ...faceBase,
              width: BOOK_D,
              height: BOOK_H,
              transform: `translate(-50%, -50%) rotateY(90deg) translateZ(${BOOK_W / 2}px)`,
              background:
                "repeating-linear-gradient(90deg, #f7ead0 0px, #e8d6ad 2px, #c8ad72 3px, #f7ead0 5px)",
            }}
          />

          {/* TOP PAGES */}
          <div
            style={{
              ...faceBase,
              width: BOOK_W,
              height: BOOK_D,
              transform: `translate(-50%, -50%) rotateX(90deg) translateZ(${BOOK_H / 2}px)`,
              background:
                "repeating-linear-gradient(0deg, #f7ead0 0px, #e8d6ad 2px, #c8ad72 3px)",
            }}
          />

          {/* BOTTOM PAGES */}
          <div
            style={{
              ...faceBase,
              width: BOOK_W,
              height: BOOK_D,
              transform: `translate(-50%, -50%) rotateX(-90deg) translateZ(${BOOK_H / 2}px)`,
              background:
                "repeating-linear-gradient(0deg, #f7ead0 0px, #e8d6ad 2px, #c8ad72 3px)",
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
              "radial-gradient(ellipse at center, rgba(255,107,0,0.28) 0%, rgba(0,0,0,0) 70%)",
            filter: "blur(6px)",
          }}
        />
      </div>
      <p className="text-center text-[10px] text-[var(--text-muted)] mt-10 font-mono tracking-wider uppercase">
        Hover to pause · Click to open
      </p>
    </div>
  );
}

/* ─────────────────── inside pages modal ─────────────────── */

function BookPagesModal({
  book,
  onClose,
}: {
  book: BookSection;
  onClose: () => void;
}) {
  const [spread, setSpread] = useState(0);
  const prologueChunks = chunkParagraphs(book.prologue_text, 4);
  const prologueSpreadCount = Math.ceil(prologueChunks.length / 2);
  const totalSpreads = 1 + prologueSpreadCount;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight")
        setSpread((s) => Math.min(totalSpreads - 1, s + 1));
      if (e.key === "ArrowLeft") setSpread((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, totalSpreads]);

  function renderLeft() {
    if (spread === 0) return <BlankPage />;
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
    if (spread === 0)
      return <TOCPage chapters={book.chapters} title={book.title} />;
    const idx = (spread - 1) * 2 + 1;
    const chunk = prologueChunks[idx];
    if (!chunk) return <BlankPage />;
    return <ProloguePage paragraphs={chunk} pageNumber={spread * 2 + 1} />;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/[0.06] border border-[var(--border)] text-[var(--text-primary)] hover:bg-white/[0.12] flex items-center justify-center"
          aria-label="Close"
        >
          <FiX size={18} />
        </button>

        <div
          className="relative grid grid-cols-1 sm:grid-cols-2 rounded-2xl overflow-hidden shadow-[0_40px_120px_rgba(255,107,0,0.15),0_20px_60px_rgba(0,0,0,0.8)] border border-[var(--border)]"
          style={{ aspectRatio: "2 / 1.4" }}
        >
          <div className="hidden sm:block relative">
            {renderLeft()}
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
            <div
              className="absolute inset-y-0 left-0 w-6 pointer-events-none hidden sm:block"
              style={{
                background:
                  "linear-gradient(270deg, transparent 0%, rgba(0,0,0,0.45) 100%)",
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setSpread((s) => Math.max(0, s - 1))}
            disabled={spread === 0}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-[var(--border)] text-[var(--text-primary)] hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Previous"
          >
            <FiChevronLeft size={18} />
          </button>
          <span className="text-[var(--text-secondary)] text-xs font-mono">
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

        <p className="text-center text-[10px] text-[var(--text-muted)] mt-3 font-mono tracking-wider uppercase">
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

const pageBg = "linear-gradient(180deg, #f6ecd6 0%, #efe3c6 100%)";

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
      style={{ background: pageBg }}
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
            <HoverSpotlight as="h2" className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] leading-tight mb-6 cursor-default">
              {book.heading_pre} <span className="text-gradient">{book.heading_accent}</span>
            </HoverSpotlight>
          </ScrollReveal>

          <ScrollReveal direction="zoom3d" delay={0.15}>
            <p className="text-[var(--text-muted)] text-lg max-w-2xl">{book.intro}</p>
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
                <span className="text-[var(--text-muted)] text-xs font-mono tracking-[0.15em] uppercase">
                  {book.publisher_tag}
                </span>
              </div>

              <h3 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-3 leading-tight">
                {book.title}
              </h3>
              <p
                className="text-[#ff6b00] text-lg mb-6"
                style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
              >
                {book.subtitle}
              </p>

              <div className="space-y-4 text-[var(--text-secondary)] text-base leading-relaxed mb-8 max-w-2xl">
                {book.blurb_paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {book.chapters.length > 0 && (
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 lg:p-7 mb-8">
                  <p className="text-[#ff6b00] text-xs font-mono tracking-[0.25em] uppercase mb-4">
                    Inside the book
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {book.chapters.map((c, i) => (
                      <li key={`${c}-${i}`} className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
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
                  <FiArrowUpRight
                    size={14}
                    className="group-hover:rotate-45 transition-transform"
                  />
                </button>
                <a
                  href={book.pdf_url}
                  download
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.04] border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/[0.08] transition-all"
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
