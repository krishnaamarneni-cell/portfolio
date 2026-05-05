"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { fieldNotes, tags } from "@/lib/field-notes";
import { FiArrowUpRight, FiClock, FiCalendar, FiArrowLeft } from "react-icons/fi";
import HoverSpotlight from "@/components/HoverSpotlight";

const tagColors: Record<string, string> = {
  AI: "from-[#a855f7] to-[#7c3aed]",
  Finance: "from-[#22c55e] to-[#16a34a]",
  Markets: "from-[#0ea5e9] to-[#0284c7]",
  Geopolitics: "from-[#ef4444] to-[#b91c1c]",
  Enterprise: "from-[#ff6b00] to-[#ff8c38]",
  Misc: "from-[#737373] to-[#525252]",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function NotesPage() {
  const [activeTag, setActiveTag] = useState<string>("All");

  const featured = useMemo(() => fieldNotes.find((n) => n.featured), []);
  const filtered = useMemo(
    () =>
      fieldNotes.filter((n) =>
        activeTag === "All" ? true : n.tag === activeTag
      ),
    [activeTag]
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/4 w-[600px] h-[600px] bg-[#ff6b00]/[0.08] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-0 w-[400px] h-[400px] bg-[#ff3d00]/[0.06] rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 4 L72 22 L72 58 L40 76 L8 58 L8 22 Z' fill='none' stroke='%23ff6b00' stroke-width='0.6'/%3E%3C/svg%3E")`,
            backgroundSize: "80px 70px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 py-16 lg:py-24 pb-32">
        {/* Back link */}
        <Link
          href="/"
          className="hover-link inline-flex items-center gap-2 text-[#777] text-sm mb-10"
        >
          <FiArrowLeft size={14} />
          Back to portfolio
        </Link>

        {/* Header */}
        <div className="mb-12">
          <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
            ✦ Field Notes
          </p>
          <HoverSpotlight as="h1" className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4 cursor-default">
            Things I&apos;m{" "}
            <span className="bg-gradient-to-r from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] bg-clip-text text-transparent">
              thinking about.
            </span>
          </HoverSpotlight>
          <p className="text-[#888] text-lg leading-relaxed max-w-2xl">
            Raw takes on AI, enterprise software, finance, geopolitics, and
            whatever&apos;s rattling around my head this week. Written for builders.
          </p>
        </div>

        {/* Tag filter */}
        <div className="flex flex-wrap gap-2 mb-12">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTag === tag
                  ? "bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_4px_20px_rgba(255,107,0,0.4)]"
                  : "bg-white/[0.04] text-[#999] border border-white/[0.06] hover:border-[#ff6b00]/30 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Featured note */}
        {activeTag === "All" && featured && (
          <Link
            href={`/notes/${featured.slug}`}
            className="group block mb-12 rounded-3xl bg-gradient-to-br from-[#1a0a02] via-[#0f0703] to-[#0a0a0a] border border-[#ff6b00]/20 hover:border-[#ff6b00]/50 transition-all duration-500 overflow-hidden p-8 lg:p-12 relative"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff6b00] to-transparent" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#ff6b00]/[0.15] rounded-full blur-[100px]" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <span className="px-3 py-1 rounded-full bg-[#ff6b00] text-black text-[10px] font-bold tracking-[0.2em] uppercase">
                  Featured
                </span>
                <span
                  className={`px-3 py-1 rounded-full bg-gradient-to-r ${tagColors[featured.tag]} text-white text-[10px] font-bold tracking-[0.15em] uppercase`}
                >
                  {featured.tag}
                </span>
                <span className="text-[#666] text-xs flex items-center gap-1.5">
                  <FiCalendar size={11} />
                  {formatDate(featured.date)}
                </span>
                <span className="text-[#666] text-xs flex items-center gap-1.5">
                  <FiClock size={11} />
                  {featured.readMinutes} min read
                </span>
              </div>

              <HoverSpotlight as="h2" className="text-3xl md:text-4xl font-black text-white leading-tight mb-4 group-hover:text-[#ff6b00] transition-colors cursor-pointer">
                {featured.title}
              </HoverSpotlight>
              <p className="text-[#bbb] text-lg leading-relaxed mb-6 max-w-3xl">
                {featured.summary}
              </p>

              <div className="inline-flex items-center gap-2 text-[#ff6b00] font-semibold text-sm">
                Read the take
                <FiArrowUpRight
                  size={16}
                  className="group-hover:rotate-45 transition-transform duration-300"
                />
              </div>
            </div>
          </Link>
        )}

        {/* Notes list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-[#666] text-center py-16">
              No notes in this category yet — coming soon.
            </p>
          ) : (
            filtered.map((note) => (
              <Link
                key={note.slug}
                href={`/notes/${note.slug}`}
                className="group block rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-300 p-6 lg:p-7 hover:translate-y-[-2px]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md bg-gradient-to-r ${tagColors[note.tag]} text-white text-[9px] font-bold tracking-[0.15em] uppercase`}
                      >
                        {note.tag}
                      </span>
                      <span className="text-[#666] text-xs flex items-center gap-1.5">
                        <FiCalendar size={10} />
                        {formatDate(note.date)}
                      </span>
                      <span className="text-[#666] text-xs flex items-center gap-1.5">
                        <FiClock size={10} />
                        {note.readMinutes} min
                      </span>
                    </div>

                    <HoverSpotlight as="h3" className="text-xl font-bold text-white leading-snug mb-2 group-hover:text-[#ff6b00] transition-colors cursor-pointer" glowSize={200} glowOpacity={0.45}>
                      {note.title}
                    </HoverSpotlight>
                    <p className="text-[#888] text-sm leading-relaxed line-clamp-2">
                      {note.summary}
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-[#ff6b00] group-hover:border-[#ff6b00] transition-all">
                    <FiArrowUpRight
                      size={15}
                      className="text-[#777] group-hover:text-white group-hover:rotate-45 transition-all"
                    />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-20 rounded-3xl bg-gradient-to-br from-[#ff6b00]/[0.1] to-transparent border border-[#ff6b00]/20 p-8 lg:p-10 text-center">
          <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
            Want these in your inbox?
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Subscribe to the newsletter
          </h3>
          <p className="text-[#888] text-base mb-6 max-w-md mx-auto">
            Weekly takes on AI, enterprise tech, and finance — straight from
            the trenches.
          </p>
          <a
            href="https://www.wealthclaude.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.5)] hover:scale-105 transition-transform"
          >
            Subscribe Free
            <FiArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </main>
  );
}
