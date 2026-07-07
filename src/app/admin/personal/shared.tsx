"use client";

import React from "react";

/* ── Shared type ───────────────────────────────────────────── */

export type PersonalNote = {
  id: string;
  body: string;
  tags: string[];
  event_date: string | null;
  remind_before_days: number | null;
  pinned: boolean;
  archived: boolean;
  source: string;
  created_at: string;
  updated_at: string;
};

/* ── Input class (theme-aware) ─────────────────────────────── */

export const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] transition-colors";

/* ── Helper functions ──────────────────────────────────────── */

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

export function bucketLabel(d: number | null): {
  label: string;
  color: string;
  rank: number;
} {
  if (d === null) return { label: "no date", color: "#555", rank: 5 };
  if (d < 0) return { label: `${-d}d ago`, color: "#f87171", rank: 0 };
  if (d <= 14) return { label: `in ${d}d`, color: "#fb923c", rank: 1 };
  if (d <= 60) return { label: `in ${d}d`, color: "#fbbf24", rank: 2 };
  if (d <= 365) return { label: `in ${d}d`, color: "#34d399", rank: 3 };
  return { label: `in ${d}d`, color: "#60a5fa", rank: 4 };
}

export function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── StatChip ──────────────────────────────────────────────── */

export function StatChip({
  label,
  value,
  color,
  urgent,
}: {
  label: string;
  value: number;
  color: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2 border ${urgent ? "animate-pulse" : ""}`}
      style={{
        borderColor: color + "44",
        backgroundColor: color + "11",
      }}
    >
      <div className="text-lg font-black" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
        {label}
      </div>
    </div>
  );
}

/* ── Markdown renderer ─────────────────────────────────────── */

export function renderInline(s: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(s.slice(i));
    const boldMatch = /\*\*([^*]+)\*\*/.exec(s.slice(i));
    let nextIdx = s.length;
    let kind: "link" | "bold" | null = null;
    if (linkMatch && linkMatch.index < nextIdx) {
      nextIdx = linkMatch.index;
      kind = "link";
    }
    if (boldMatch && boldMatch.index < nextIdx) {
      nextIdx = boldMatch.index;
      kind = "bold";
    }
    if (nextIdx > 0) nodes.push(s.slice(i, i + nextIdx));
    if (kind === "link" && linkMatch) {
      nodes.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#ff8c38] hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
      i += nextIdx + linkMatch[0].length;
    } else if (kind === "bold" && boldMatch) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[var(--admin-text)]">
          {boldMatch[1]}
        </strong>
      );
      i += nextIdx + boldMatch[0].length;
    } else {
      i = s.length;
    }
  }
  return <>{nodes}</>;
}

export function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul
        key={out.length}
        className="list-disc pl-5 my-3 space-y-1.5 text-[13px] text-[var(--admin-text)]"
      >
        {listBuffer.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (/^##\s+/.test(line)) {
      out.push(
        <h2
          key={out.length}
          className="text-base font-bold text-[var(--admin-text)] mt-5 first:mt-0 mb-2 border-t border-[var(--admin-border)] pt-4 first:border-0 first:pt-0"
        >
          {renderInline(line.replace(/^##\s+/, ""))}
        </h2>
      );
    } else if (/^###\s+/.test(line)) {
      out.push(
        <h3
          key={out.length}
          className="text-sm font-semibold text-[var(--admin-text)] mt-3 mb-1"
        >
          {renderInline(line.replace(/^###\s+/, ""))}
        </h3>
      );
    } else if (line.trim() === "") {
      // collapse
    } else {
      out.push(
        <p
          key={out.length}
          className="text-[13px] text-[var(--admin-text)] my-2 leading-relaxed"
        >
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return <div className="space-y-0">{out}</div>;
}

/* ── CollapsibleSection ────────────────────────────────────── */

export function CollapsibleSection({
  title,
  count,
  id,
  children,
}: {
  title: string;
  count: number;
  id: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`life_section_${id}`) === "open";
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(
        `life_section_${id}`,
        next ? "open" : "closed"
      );
    } catch {}
  }

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--admin-surface-hover)] transition-colors"
      >
        <span className="text-sm font-bold text-[var(--admin-text)]">
          {title}
          {count > 0 && (
            <span className="ml-2 text-[10px] font-mono text-[var(--admin-text-muted)]">
              {count}
            </span>
          )}
        </span>
        <span className="text-[10px] font-mono text-[var(--admin-text-muted)]">
          {open ? "HIDE" : "SHOW"}
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
