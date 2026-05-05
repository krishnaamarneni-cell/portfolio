"use client";

import Link from "next/link";
import ScrollReveal from "./ScrollReveal";
import { fieldNotes } from "@/lib/field-notes";
import { FiArrowUpRight, FiCalendar, FiClock } from "react-icons/fi";

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
    month: "short",
    day: "numeric",
  });
}

export default function NotesPreview() {
  // Show 3 most recent notes (sorted by date)
  const latest = [...fieldNotes]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <section id="notes-preview" className="relative py-16 lg:py-20 px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        {/* Header — compact */}
        <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
          <div>
            <ScrollReveal direction="rotate3d">
              <p className="text-[#ff6b00] text-xs font-mono mb-2 tracking-[0.3em] uppercase">
                ─── Latest Field Notes
              </p>
            </ScrollReveal>
            <ScrollReveal direction="flipX" delay={0.1}>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Things I&apos;m{" "}
                <span className="text-gradient">thinking about</span>
              </h2>
            </ScrollReveal>
          </div>

          <ScrollReveal direction="zoom3d" delay={0.15}>
            <Link
              href="/notes"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 text-white text-sm font-medium transition-all"
            >
              See all notes
              <FiArrowUpRight
                size={14}
                className="text-[#ff6b00] group-hover:rotate-45 transition-transform"
              />
            </Link>
          </ScrollReveal>
        </div>

        {/* 3 cards — horizontal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {latest.map((note, i) => (
            <ScrollReveal key={note.slug} delay={i * 0.08} direction="flipY">
              <Link
                href={`/notes/${note.slug}`}
                className="group block h-full rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 transition-all duration-300 p-5 hover:translate-y-[-2px]"
              >
                {/* Tag + date */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md bg-gradient-to-r ${tagColors[note.tag]} text-white text-[9px] font-bold tracking-[0.15em] uppercase`}
                  >
                    {note.tag}
                  </span>
                  <span className="text-[#666] text-[10px] flex items-center gap-1">
                    <FiCalendar size={9} />
                    {formatDate(note.date)}
                  </span>
                  <span className="text-[#666] text-[10px] flex items-center gap-1">
                    <FiClock size={9} />
                    {note.readMinutes}m
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-white leading-snug mb-2 group-hover:text-[#ff6b00] transition-colors line-clamp-2">
                  {note.title}
                </h3>

                {/* Summary */}
                <p className="text-[#888] text-xs leading-relaxed line-clamp-2 mb-3">
                  {note.summary}
                </p>

                {/* Read indicator */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <span className="text-[10px] text-[#ff6b00] font-medium uppercase tracking-wider">
                    Read take
                  </span>
                  <FiArrowUpRight
                    size={13}
                    className="text-[#666] group-hover:text-[#ff6b00] group-hover:rotate-45 transition-all"
                  />
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
