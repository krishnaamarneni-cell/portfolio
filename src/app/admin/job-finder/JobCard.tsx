"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiExternalLink,
  FiBookmark,
  FiEyeOff,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiClipboard,
  FiUsers,
  FiStar,
  FiMail,
  FiLinkedin,
  FiBriefcase,
  FiMapPin,
  FiGlobe,
  FiShield,
} from "react-icons/fi";
import { scoreTone, postedAge, factTone, type Listing, type WarmContact } from "./types";

type Props = {
  listing: Listing;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onPrepare?: (listing: Listing) => void;
};

const CHIP = "px-2 py-0.5 rounded-md text-[10px] font-semibold border";

type FactSpec = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone?: string;
};

/** One screening fact — the things a recruiter filters on before reading. */
function Fact({ icon: Icon, label, value, tone }: FactSpec) {
  return (
    <div className="bg-[var(--admin-bg)] rounded-lg border border-[var(--admin-border)] px-2.5 py-2 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] flex items-center gap-1">
        <Icon size={9} />
        {label}
      </p>
      <p className={`text-[11px] font-semibold mt-0.5 truncate ${tone ?? "text-[var(--admin-text)]"}`}>
        {value}
      </p>
    </div>
  );
}

export default function JobCard({ listing, busy, onStatus, onDelete, onPrepare }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<{ inside: WarmContact[]; agency: WarmContact[] } | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const tone = scoreTone(listing.match_score);
  const age = postedAge(listing.posted_at, listing.created_at);

  // Look for contacts only once the card is opened. Firing one request per
  // employer across a 60-row feed would be wasted work.
  const loadContacts = useCallback(async () => {
    if (contacts || loadingContacts) return;
    setLoadingContacts(true);
    try {
      const params = new URLSearchParams();
      if (listing.company) params.set("company", listing.company);
      params.set("title", listing.title);
      const res = await fetch(`/api/admin/job-finder/contacts?${params}`);
      const data = await res.json();
      setContacts({ inside: data.inside ?? [], agency: data.agency ?? [] });
    } catch {
      setContacts({ inside: [], agency: [] });
    } finally {
      setLoadingContacts(false);
    }
  }, [contacts, loadingContacts, listing.company, listing.title]);

  useEffect(() => {
    if (open) loadContacts();
  }, [open, loadContacts]);

  const copyKeywords = async () => {
    const kw = listing.resume_keywords ?? [];
    if (!kw.length) return;
    await navigator.clipboard.writeText(kw.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const facts: FactSpec[] = [];
  if (listing.seniority) {
    facts.push({ icon: FiBriefcase, label: "Seniority", value: listing.seniority });
  }
  if (listing.work_type || listing.location) {
    facts.push({
      icon: FiMapPin,
      label: "Work mode",
      value: listing.work_type || listing.location || "",
    });
  }
  if (listing.sponsorship) {
    facts.push({
      icon: FiGlobe,
      label: "Sponsorship",
      value: listing.sponsorship,
      tone: factTone("sponsorship", listing.sponsorship),
    });
  }
  if (listing.clearance) {
    facts.push({
      icon: FiShield,
      label: "Clearance",
      value: listing.clearance,
      tone: factTone("clearance", listing.clearance),
    });
  }

  const ContactRow = ({ c, kind }: { c: WarmContact; kind: "inside" | "agency" }) => (
    <div className="flex items-center gap-2 bg-[var(--admin-bg)] rounded-lg border border-[var(--admin-border)] px-2.5 py-2">
      {c.starred && <FiStar size={10} className="text-amber-500 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[var(--admin-text)] truncate">
          {c.name || c.email}
          {c.title ? <span className="font-normal text-[var(--admin-text-muted)]"> · {c.title}</span> : null}
        </p>
        <p className="text-[10px] text-[var(--admin-text-muted)] truncate">
          {kind === "inside" ? c.company || c.email : c.why || c.company || c.email}
        </p>
      </div>
      {c.linkedin_url && (
        <a
          href={c.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded text-[var(--admin-text-muted)] hover:text-[#0a66c2] shrink-0"
          aria-label="LinkedIn profile"
        >
          <FiLinkedin size={11} />
        </a>
      )}
      <a
        href={`mailto:${c.email}?subject=${encodeURIComponent(
          kind === "inside"
            ? `Question about the ${listing.title} role`
            : `${listing.title} — availability`
        )}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--admin-border)] text-[10px] font-semibold text-[var(--admin-text)] hover:border-[#ff6b00] shrink-0"
      >
        <FiMail size={10} />
        {c.emailed_at ? "Again" : "Email"}
      </a>
    </div>
  );

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
                <h3 className="font-semibold text-[var(--admin-text)] text-sm leading-snug">
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

            {facts.length > 0 && (
              <div className="grid gap-1.5 mt-2.5 grid-cols-2 sm:grid-cols-4">
                {facts.map((f) => (
                  <Fact key={f.label} {...f} />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {listing.employment_type && (
                <span className={`${CHIP} bg-violet-500/10 text-violet-400 border-violet-500/30`}>
                  {listing.employment_type}
                </span>
              )}
              {listing.source_type && (
                <span
                  className={`${CHIP} bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]`}
                >
                  {listing.source_type.replace(/_/g, " ")}
                </span>
              )}
              <span
                className={`text-[10px] ml-auto ${age.atCap ? "text-amber-500" : "text-[var(--admin-text-muted)]"}`}
                title={age.title}
              >
                {age.label}
              </span>
            </div>

            {!!listing.required_skills?.length && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {listing.required_skills.slice(0, 6).map((s, i) => (
                  <span
                    key={s}
                    className={`${CHIP} bg-[var(--admin-bg)] text-[var(--admin-text)] border-[var(--admin-border)]`}
                  >
                    <span className="text-[var(--admin-text-muted)] mr-1">{i + 1}</span>
                    {s}
                  </span>
                ))}
              </div>
            )}

            {listing.match_summary && !open && (
              <p className="text-xs text-[var(--admin-text-muted)] mt-2 line-clamp-2">
                {listing.match_summary}
              </p>
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
              title="Tailored resume points, screening answers and contacts for this role"
            >
              <FiClipboard size={12} />
              Tailor &amp; apply
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
              Applied
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
          {/* Who you already know. The reason to open a card at all. */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5 flex items-center gap-1.5">
              <FiUsers size={10} />
              Your contacts for this role
            </p>
            {loadingContacts ? (
              <p className="text-xs text-[var(--admin-text-muted)]">Checking your CRM…</p>
            ) : !contacts || (!contacts.inside.length && !contacts.agency.length) ? (
              <p className="text-xs text-[var(--admin-text-muted)]">
                No one in your CRM matches this employer or role yet.
              </p>
            ) : (
              <div className="space-y-2">
                {contacts.inside.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-emerald-500">
                      At {listing.company} — ask who is hiring, or for a referral
                    </p>
                    {contacts.inside.map((c) => (
                      <ContactRow key={c.id} c={c} kind="inside" />
                    ))}
                  </>
                )}
                {contacts.agency.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-[var(--admin-text-muted)]">
                      Recruiters who pitched similar roles — they may be able to submit you
                    </p>
                    {contacts.agency.map((c) => (
                      <ContactRow key={c.id} c={c} kind="agency" />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

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
                Job description
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
