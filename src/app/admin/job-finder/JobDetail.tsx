"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiExternalLink,
  FiClipboard,
  FiBookmark,
  FiCheckCircle,
  FiEyeOff,
  FiTrash2,
  FiBriefcase,
  FiMapPin,
  FiGlobe,
  FiShield,
  FiDollarSign,
  FiUsers,
  FiStar,
  FiMail,
  FiLinkedin,
  FiCheck,
  FiX,
} from "react-icons/fi";
import MatchRing from "./MatchRing";
import { postedAge, factTone, type Listing, type WarmContact } from "./types";

type Props = {
  listing: Listing;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onPrepare: (listing: Listing) => void;
  /** Mobile only — the detail pane is a sheet there rather than a column. */
  onClose?: () => void;
};

type Tab = "overview" | "description" | "contacts";

/** One screening fact. These decide eligibility before anything else matters. */
function Fact({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] flex items-center gap-1">
        <Icon size={10} />
        {label}
      </p>
      <p className={`text-xs font-semibold mt-1 truncate ${tone ?? "text-[var(--admin-text)]"}`}>
        {value}
      </p>
    </div>
  );
}

export default function JobDetail({
  listing,
  busy,
  onStatus,
  onDelete,
  onPrepare,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [contacts, setContacts] = useState<{ inside: WarmContact[]; agency: WarmContact[] } | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const age = postedAge(listing.posted_at, listing.created_at);

  // Reset to overview when a different job is selected, so the pane never opens
  // on a tab that made sense for the previous role.
  useEffect(() => {
    setTab("overview");
    setContacts(null);
  }, [listing.id]);

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
    if (tab === "contacts") loadContacts();
  }, [tab, loadContacts]);

  const facts: Array<{
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
    tone?: string;
  }> = [];
  if (listing.seniority) facts.push({ icon: FiBriefcase, label: "Seniority", value: listing.seniority });
  if (listing.salary_range)
    facts.push({ icon: FiDollarSign, label: "Salary", value: listing.salary_range });
  if (listing.work_type || listing.location)
    facts.push({
      icon: FiMapPin,
      label: "Work mode",
      value: listing.work_type || listing.location || "",
    });
  if (listing.sponsorship)
    facts.push({
      icon: FiGlobe,
      label: "Sponsorship",
      value: listing.sponsorship,
      tone: factTone("sponsorship", listing.sponsorship),
    });
  if (listing.clearance)
    facts.push({
      icon: FiShield,
      label: "Clearance",
      value: listing.clearance,
      tone: factTone("clearance", listing.clearance),
    });

  const contactCount = (contacts?.inside.length ?? 0) + (contacts?.agency.length ?? 0);

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
          kind === "inside" ? `Question about the ${listing.title} role` : `${listing.title} — availability`
        )}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--admin-border)] text-[10px] font-semibold text-[var(--admin-text)] hover:border-[#ff6b00] shrink-0"
      >
        <FiMail size={10} />
        {c.emailed_at ? "Again" : "Email"}
      </a>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--admin-border)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
              {listing.company ?? "Unknown company"}
            </p>
            <h2 className="font-bold text-[var(--admin-text)] text-base leading-snug mt-1">
              {listing.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[10px] text-[var(--admin-text-muted)]">
              {listing.location && <span>{listing.location}</span>}
              <span>·</span>
              <span title={age.title} className={age.atCap ? "text-amber-500" : ""}>
                {age.label}
              </span>
              {listing.employment_type && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/30">
                  {listing.employment_type}
                </span>
              )}
              {listing.source_type && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]">
                  {listing.source_type.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MatchRing score={listing.match_score} size={52} />
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] lg:hidden"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <a
            href={listing.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] transition-colors"
          >
            <FiExternalLink size={13} />
            Open posting
          </a>
          <button
            onClick={() => onPrepare(listing)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#ff6b00] text-[#ff6b00] text-xs font-semibold hover:bg-[#ff6b00]/10 transition-colors"
          >
            <FiClipboard size={13} />
            Prepare &amp; tailor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 border-b border-[var(--admin-border)]">
        {([
          ["overview", "Overview"],
          ["description", "Job description"],
          ["contacts", contactCount ? `Contacts (${contactCount})` : "Contacts"],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === id
                ? "border-[#ff6b00] text-[#ff6b00]"
                : "border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {tab === "overview" && (
          <>
            {facts.length > 0 && (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                {facts.map((f) => (
                  <Fact key={f.label} {...f} />
                ))}
              </div>
            )}

            {listing.match_summary && (
              <div className="bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
                  Why this score
                </p>
                <p className="text-xs text-[var(--admin-text)] leading-relaxed">{listing.match_summary}</p>
              </div>
            )}

            {(!!listing.match_skills?.length || !!listing.missing_skills?.length) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
                  Skills analysis
                </p>
                {!!listing.match_skills?.length && (
                  <div className="mb-2.5">
                    <p className="text-[10px] font-semibold text-emerald-500 mb-1.5">
                      ✓ You have ({listing.match_skills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {listing.match_skills.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!!listing.missing_skills?.length && (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-500 mb-1.5">
                      ✗ Missing ({listing.missing_skills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {listing.missing_skills.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!!listing.required_skills?.length && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
                  Required by the posting
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {listing.required_skills.map((s, i) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text)] border border-[var(--admin-border)]"
                    >
                      <span className="text-[var(--admin-text-muted)] mr-1">{i + 1}</span>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {listing.match_score === null && (
              <p className="text-xs text-[var(--admin-text-muted)] text-center py-4">
                Not scored yet — run Score to see the match analysis.
              </p>
            )}
          </>
        )}

        {tab === "description" &&
          (listing.description ? (
            <p className="text-xs text-[var(--admin-text-muted)] leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          ) : (
            <p className="text-xs text-[var(--admin-text-muted)] text-center py-6">
              This source did not include a description. Open the posting to read it.
            </p>
          ))}

        {tab === "contacts" && (
          <>
            {loadingContacts ? (
              <p className="text-xs text-[var(--admin-text-muted)]">Checking your CRM…</p>
            ) : !contactCount ? (
              <div className="text-center py-6">
                <FiUsers size={22} className="mx-auto text-[var(--admin-text-muted)] mb-2" />
                <p className="text-xs text-[var(--admin-text-muted)]">
                  No one in your CRM matches this employer or role yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {!!contacts?.inside.length && (
                  <>
                    <p className="text-[10px] font-semibold text-emerald-500">
                      At {listing.company} — ask who is hiring, or for a referral
                    </p>
                    {contacts.inside.map((c) => (
                      <ContactRow key={c.id} c={c} kind="inside" />
                    ))}
                  </>
                )}
                {!!contacts?.agency.length && (
                  <>
                    <p className="text-[10px] font-semibold text-[var(--admin-text-muted)] pt-1">
                      Recruiters who pitched similar roles
                    </p>
                    {contacts.agency.map((c) => (
                      <ContactRow key={c.id} c={c} kind="agency" />
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 p-3 border-t border-[var(--admin-border)]">
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
            title="You submit the application yourself"
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
        <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--admin-text-muted)]">
          <FiCheck size={10} />
          You submit — nothing is sent for you
        </span>
        <button
          disabled={busy}
          onClick={() => onDelete(listing.id)}
          className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-rose-500 transition-colors disabled:opacity-50"
          aria-label="Delete listing"
        >
          <FiTrash2 size={13} />
        </button>
      </div>
    </div>
  );
}
