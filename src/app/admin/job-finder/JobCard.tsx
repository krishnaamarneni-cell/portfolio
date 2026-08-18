"use client";

import { useState } from "react";
import {
  FiExternalLink,
  FiBookmark,
  FiEyeOff,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiTrash2,
  FiMapPin,
  FiCopy,
  FiCheck,
  FiClipboard,
} from "react-icons/fi";
import { scoreTone, postedAge, type Listing } from "./types";

type Props = {
  listing: Listing;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onPrepare?: (listing: Listing) => void;
};

const CHIP = "px-2 py-0.5 rounded-md text-[10px] font-semibold border";

export default function JobCard({ listing, busy, onStatus, onDelete, onPrepare }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const tone = scoreTone(listing.match_score);

  const age = postedAge(listing.posted_at, listing.created_at);

  const copyKeywords = async () => {
    const kw = listing.resume_keywords ?? [];
    if (!kw.length) return;
    await navigator.clipboard.writeText(kw.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] shrink-0"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-[var(--admin-text)] text-sm leading-snug truncate">
                  {listing.title}
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5 truncate">
                  {listing.company ?? "Unknown company"}
                  {listing.location ? ` · ${listing.location}` : ""}
                  {listing.salary_range ? ` · ${listing.salary_range}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {listing.match_score !== null && (
                  <span
                    className="text-lg font-bold tabular-nums text-[var(--admin-text)]"
                    title={listing.match_recommendation ?? undefined}
                  >
                    {listing.match_score}
                  </span>
                )}
                <span className={`${CHIP} ${tone.className}`}>{tone.label}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {listing.work_type && (
                <span className={`${CHIP} bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]`}>
                  <FiMapPin size={9} className="inline mr-1 -mt-0.5" />
                  {listing.work_type}
                </span>
              )}
              {listing.source_type && (
                <span className={`${CHIP} bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]`}>
                  {listing.source_type.replace(/_/g, " ")}
                </span>
              )}
              {/* Never label discovery time as posting time — say which it is. */}
              <span
                className={`text-[10px] ml-auto ${age.atCap ? "text-amber-500" : "text-[var(--admin-text-muted)]"}`}
                title={age.title}
              >
                {age.label}
              </span>
            </div>

            {listing.match_summary && !open && (
              <p className="text-xs text-[var(--admin-text-muted)] mt-2 line-clamp-2">{listing.match_summary}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 pl-7">
          <a
            href={listing.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] transition-colors"
          >
            <FiExternalLink size={12} />
            Open posting
          </a>

          {onPrepare && (
            <button
              onClick={() => onPrepare(listing)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ff6b00] text-[#ff6b00] text-xs font-semibold hover:bg-[#ff6b00]/10 transition-colors"
              title="Open the application packet — every answer ready to paste"
            >
              <FiClipboard size={12} />
              Prepare
            </button>
          )}

          {listing.status !== "saved" && (
            <button
              disabled={busy}
              onClick={() => onStatus(listing.id, "saved")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text)] text-xs font-semibold hover:border-[#ff6b00] transition-colors disabled:opacity-50"
            >
              <FiBookmark size={12} />
              Save
            </button>
          )}

          {listing.status !== "applied" && (
            <button
              disabled={busy}
              onClick={() => onStatus(listing.id, "applied")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text)] text-xs font-semibold hover:border-emerald-500 transition-colors disabled:opacity-50"
              title="Mark as applied — you submit the application yourself"
            >
              <FiCheckCircle size={12} />
              Mark applied
            </button>
          )}

          {listing.status !== "ignored" && (
            <button
              disabled={busy}
              onClick={() => onStatus(listing.id, "ignored")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] text-xs font-semibold hover:border-rose-500 transition-colors disabled:opacity-50"
            >
              <FiEyeOff size={12} />
              Ignore
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => onDelete(listing.id)}
            className="ml-auto p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-rose-500 transition-colors disabled:opacity-50"
            aria-label="Delete listing"
          >
            <FiTrash2 size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 pl-11 space-y-4">
          {listing.match_summary && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
                Why this score
              </p>
              <p className="text-xs text-[var(--admin-text)] leading-relaxed">{listing.match_summary}</p>
            </div>
          )}

          {!!listing.match_skills?.length && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
                Skills you already have
              </p>
              <div className="flex flex-wrap gap-1.5">
                {listing.match_skills.map((s) => (
                  <span key={s} className={`${CHIP} bg-emerald-500/10 text-emerald-500 border-emerald-500/30`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!listing.missing_skills?.length && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
                Gaps
              </p>
              <div className="flex flex-wrap gap-1.5">
                {listing.missing_skills.map((s) => (
                  <span key={s} className={`${CHIP} bg-amber-500/10 text-amber-500 border-amber-500/30`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!listing.resume_keywords?.length && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                  Resume keywords
                </p>
                <button
                  onClick={copyKeywords}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#ff6b00] hover:underline"
                >
                  {copied ? <FiCheck size={10} /> : <FiCopy size={10} />}
                  {copied ? "Copied" : "Copy all"}
                </button>
              </div>
              <p className="text-xs text-[var(--admin-text-muted)] leading-relaxed">
                {listing.resume_keywords.join(" · ")}
              </p>
            </div>
          )}

          {listing.description && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
                Posting
              </p>
              <p className="text-xs text-[var(--admin-text-muted)] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {listing.description.slice(0, 4000)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
