"use client";

import { FiMapPin, FiClock, FiMail } from "react-icons/fi";
import MatchRing from "./MatchRing";
import { postedAge, sourceBadge, type Listing } from "./types";

/**
 * One row in the job list.
 *
 * Deliberately shallow: enough to decide whether to open it, and nothing more.
 * The two flags carried here — sponsorship and clearance — are the ones that
 * disqualify a candidate outright, so they belong where a role is skimmed
 * rather than three clicks in.
 */
export default function JobRow({
  listing,
  selected,
  onSelect,
}: {
  listing: Listing;
  selected: boolean;
  onSelect: () => void;
}) {
  const age = postedAge(listing.posted_at, listing.created_at);
  const badge = sourceBadge(listing.source_type);
  const skills = listing.required_skills ?? [];
  const missing = listing.missing_skills ?? [];

  const flag = (label: string, value: string | null, bad: RegExp, warn: RegExp) => {
    if (!value) return null;
    const v = value.toLowerCase();
    const color = bad.test(v)
      ? "bg-rose-500"
      : warn.test(v)
        ? "bg-amber-500"
        : "bg-emerald-500";
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-[var(--admin-text-muted)] whitespace-nowrap">
        <span className={`w-2 h-2 rounded-sm shrink-0 ${color}`} />
        {label}: {value}
      </span>
    );
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
        selected
          ? "border-[#ff6b00] bg-[#ff6b00]/5"
          : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-text-muted)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[11px] font-semibold text-[var(--admin-text-muted)] truncate">
              {listing.company ?? "Unknown company"}
            </p>
            <span
              title={
                badge.isEmail
                  ? "From a recruiter email — reply to apply"
                  : `Found on ${badge.label}`
              }
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0 ${badge.className}`}
            >
              {badge.isEmail && <FiMail size={8} />}
              {badge.label}
            </span>
          </div>
          <h3 className="font-semibold text-[var(--admin-text)] text-sm leading-snug mt-0.5 line-clamp-2">
            {listing.title}
          </h3>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-[var(--admin-text-muted)]">
            {listing.location && (
              <span className="flex items-center gap-1 min-w-0">
                <FiMapPin size={9} className="shrink-0" />
                <span className="truncate max-w-[180px]">{listing.location}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <FiClock size={9} />
              {age.label}
            </span>
          </div>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skills.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"
                >
                  {s}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-[var(--admin-text-muted)]">
                  +{skills.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <MatchRing score={listing.match_score} size={42} />
          <div className="flex flex-col items-end gap-0.5">
            {flag("Sponsors", listing.sponsorship, /^no\b/, /maybe|unclear/)}
            {flag("Clearance", listing.clearance, /never-matches/, /^required/)}
          </div>
        </div>
      </div>

      {missing.length > 0 && listing.match_score !== null && (
        <p className="text-[10px] text-[var(--admin-text-muted)] mt-2 truncate">
          missing: {missing.slice(0, 3).join(", ")}
        </p>
      )}
    </button>
  );
}
