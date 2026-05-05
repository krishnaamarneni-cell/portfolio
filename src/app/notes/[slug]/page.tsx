"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fieldNotes, getNoteBySlug } from "@/lib/field-notes";
import { FiArrowLeft, FiClock, FiCalendar, FiArrowUpRight, FiLinkedin } from "react-icons/fi";
import { FaXTwitter } from "react-icons/fa6";

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
    month: "long",
    day: "numeric",
  });
}

// Simple markdown-ish renderer (paragraphs, bold, lists, blockquotes, headings)
function renderBody(body: string) {
  const lines = body.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key++} className="space-y-2.5 my-5 ml-1">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-[#cfcfcf] text-base leading-relaxed">
            <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-[#ff6b00] shrink-0" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
      continue;
    }
    flushList();

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-4 border-[#ff6b00] pl-5 italic text-[#ddd] text-lg my-6"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      blocks.push(
        <h3 key={key++} className="text-2xl font-bold text-white mt-10 mb-3">
          {line.slice(2, -2)}
        </h3>
      );
      continue;
    }

    blocks.push(
      <p key={key++} className="text-[#cfcfcf] text-base leading-[1.75] my-5">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  return blocks;
}

// Inline renderer: handles **bold** and `code`
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith("**")) {
      parts.push(
        <strong key={key++} className="text-white font-semibold">
          {m.slice(2, -2)}
        </strong>
      );
    } else if (m.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-[#ff6b00]/10 text-[#ff8c38] text-sm font-mono"
        >
          {m.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

export default function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const note = getNoteBySlug(slug);

  if (!note) notFound();

  // Find next/previous notes
  const idx = fieldNotes.findIndex((n) => n.slug === slug);
  const prev = idx > 0 ? fieldNotes[idx - 1] : null;
  const next = idx < fieldNotes.length - 1 ? fieldNotes[idx + 1] : null;

  const shareText = encodeURIComponent(`"${note.title}" by Krishna Amarneni`);
  const shareUrl = encodeURIComponent(
    `https://krishnaamarneni.com/notes/${note.slug}`
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-1/4 w-[500px] h-[500px] bg-[#ff6b00]/[0.06] rounded-full blur-[160px]" />
      </div>

      <article className="relative z-10 max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24 pb-32">
        {/* Back link */}
        <Link
          href="/notes"
          className="inline-flex items-center gap-2 text-[#777] hover:text-[#ff6b00] text-sm mb-10 transition-colors"
        >
          <FiArrowLeft size={14} />
          All notes
        </Link>

        {/* Tag + meta */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full bg-gradient-to-r ${tagColors[note.tag]} text-white text-[10px] font-bold tracking-[0.15em] uppercase`}
          >
            {note.tag}
          </span>
          <span className="text-[#666] text-xs flex items-center gap-1.5">
            <FiCalendar size={11} />
            {formatDate(note.date)}
          </span>
          <span className="text-[#666] text-xs flex items-center gap-1.5">
            <FiClock size={11} />
            {note.readMinutes} min read
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight mb-6">
          {note.title}
        </h1>

        {/* Summary */}
        <p className="text-[#999] text-lg leading-relaxed mb-10 italic border-l-4 border-[#ff6b00]/40 pl-5">
          {note.summary}
        </p>

        {/* Body */}
        <div className="prose prose-invert max-w-none">{renderBody(note.body)}</div>

        {/* Author footer */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] flex items-center justify-center font-bold text-black">
              K
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Krishna Amarneni</p>
              <p className="text-[#666] text-xs">Builder · SAP · AI · Web</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#666] text-xs mr-2">Share:</span>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 flex items-center justify-center transition-all"
              aria-label="Share on X"
            >
              <FaXTwitter size={14} className="text-[#ddd]" />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#ff6b00]/40 hover:bg-[#ff6b00]/10 flex items-center justify-center transition-all"
              aria-label="Share on LinkedIn"
            >
              <FiLinkedin size={14} className="text-[#ddd]" />
            </a>
          </div>
        </div>

        {/* Prev/Next */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prev ? (
            <Link
              href={`/notes/${prev.slug}`}
              className="group rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 p-5 transition-all"
            >
              <p className="text-[#666] text-[10px] font-mono uppercase tracking-[0.2em] mb-2">
                ← Previous
              </p>
              <p className="text-white text-sm font-semibold line-clamp-2 group-hover:text-[#ff6b00] transition-colors">
                {prev.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/notes/${next.slug}`}
              className="group rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-[#ff6b00]/30 p-5 text-right transition-all"
            >
              <p className="text-[#666] text-[10px] font-mono uppercase tracking-[0.2em] mb-2">
                Next →
              </p>
              <p className="text-white text-sm font-semibold line-clamp-2 group-hover:text-[#ff6b00] transition-colors">
                {next.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-3xl bg-gradient-to-br from-[#ff6b00]/[0.1] to-transparent border border-[#ff6b00]/20 p-8 text-center">
          <p className="text-[#ff6b00] text-xs font-mono tracking-[0.3em] uppercase mb-3">
            Get more like this
          </p>
          <h3 className="text-xl font-bold text-white mb-3">
            Weekly takes in your inbox
          </h3>
          <a
            href="https://www.wealthclaude.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_8px_30px_rgba(255,107,0,0.5)]"
          >
            Subscribe Free
            <FiArrowUpRight size={14} />
          </a>
        </div>
      </article>
    </main>
  );
}
