"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  FiBriefcase,
  FiRefreshCw,
  FiZap,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiTrash2,
  FiAlertTriangle,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";

type ScreeningAnswer = { question: string; answer: string };

type Application = {
  id: string;
  job_title: string;
  company: string | null;
  location: string | null;
  job_url: string | null;
  source: string | null;
  match_pct: number | null;
  tailored_resume: { summary?: string; emphasizedBullets?: string[] } | null;
  cover_note: string | null;
  screening_answers: ScreeningAnswer[] | null;
  keywords: string[] | null;
  gaps: string[] | null;
  status: string;
  applied_at: string | null;
  created_at: string;
};

const STATUSES = ["prepared", "applied", "interviewing", "rejected", "offer"] as const;

const STATUS_TONE: Record<string, string> = {
  prepared: "bg-[var(--admin-input-bg)] text-[var(--admin-text-secondary)]",
  applied: "bg-blue-500/15 text-blue-400",
  interviewing: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
  offer: "bg-amber-500/15 text-amber-400",
};

export default function ApplicationsTab({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  // New-job form
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/applications", { cache: "no-store" });
      const j = await r.json();
      if (j.needsMigration || (j.error && !r.ok)) setNeedsMigration(j.error);
      else setNeedsMigration(null);
      setApps(Array.isArray(j.applications) ? j.applications : []);
    } catch {
      onError("Could not load applications");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function prepare() {
    if (!jobTitle.trim()) {
      onError("Add a job title first");
      return;
    }
    setPreparing(true);
    try {
      const r = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          job: {
            jobTitle: jobTitle.trim(),
            company: company.trim() || null,
            jobUrl: jobUrl.trim() || null,
            jobDescription: jobDescription.trim() || null,
            source: "manual",
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not prepare the kit");
      onSuccess(`Kit ready — ${j.kit?.matchPct ?? 0}% match. Review, then apply yourself.`);
      setJobTitle("");
      setCompany("");
      setJobUrl("");
      setJobDescription("");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not prepare the kit");
    } finally {
      setPreparing(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setApps((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status }),
      });
    } catch {
      onError("Could not update status");
    }
  }

  async function remove(id: string) {
    setApps((xs) => xs.filter((a) => a.id !== id));
    try {
      await fetch(`/api/admin/applications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      onError("Could not delete");
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      onError("Clipboard blocked by the browser");
    }
  }

  const shown = useMemo(
    () => (filter === "all" ? apps : apps.filter((a) => a.status === filter)),
    [apps, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    for (const s of STATUSES) c[s] = apps.filter((a) => a.status === s).length;
    return c;
  }, [apps]);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/25 to-indigo-500/5 ring-1 ring-indigo-500/20 flex items-center justify-center shrink-0">
            <FiBriefcase size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--admin-text)]">
              Application kit
            </h2>
            <p className="text-[11px] text-[var(--admin-text-secondary)] max-w-lg">
              Paste a job — the agent tailors your résumé angle, writes the cover note and
              screening answers, and flags gaps. You review and submit it yourself.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-indigo-500 disabled:opacity-50"
        >
          <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {needsMigration && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
          <FiAlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-200 text-sm">{needsMigration}</p>
        </div>
      )}

      {/* Prepare a new kit */}
      <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Job title * e.g. SAP MM Consultant"
            className="px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-indigo-500 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
            className="px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-indigo-500 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
          <input
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="Job / apply URL"
            className="px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-indigo-500 focus:outline-none text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]"
          />
        </div>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={4}
          placeholder="Paste the job description here — the more you paste, the better the tailoring and the more accurate the match %."
          className="w-full px-3 py-2 rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] focus:border-indigo-500 focus:outline-none text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] resize-y"
        />
        <button
          type="button"
          onClick={prepare}
          disabled={preparing || !jobTitle.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50"
        >
          <FiZap size={12} className={preparing ? "animate-pulse" : ""} />
          {preparing ? "Preparing kit…" : "Prepare application kit"}
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["all", ...STATUSES] as string[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
              filter === s
                ? "bg-indigo-600 text-white"
                : "bg-[var(--admin-input-bg)] text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"
            }`}
          >
            {s} {counts[s] ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-[12px] text-[var(--admin-text-muted)] py-8 text-center">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-[12px] text-[var(--admin-text-muted)] py-8 text-center">
          {apps.length === 0
            ? "No kits yet. Paste a job above to prepare your first one."
            : "Nothing with that status."}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((a) => {
            const open = expanded === a.id;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] overflow-hidden"
              >
                <div className="p-4 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : a.id)}
                    className="mt-0.5 text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
                    aria-label={open ? "Collapse" : "Expand"}
                  >
                    {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[var(--admin-text)]">{a.job_title}</p>
                      {a.match_pct != null && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            a.match_pct >= 75
                              ? "bg-emerald-500/15 text-emerald-400"
                              : a.match_pct >= 50
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {a.match_pct}% match
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--admin-text-secondary)] mt-0.5">
                      {[a.company, a.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={a.status}
                      onChange={(e) => setStatus(a.id, e.target.value)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border-0 outline-none capitalize ${STATUS_TONE[a.status] ?? ""}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {a.job_url && (
                      <a
                        href={a.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-indigo-400"
                        title="Open the posting"
                      >
                        <FiExternalLink size={12} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-red-400"
                      title="Delete"
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-[var(--admin-border)] p-4 space-y-4">
                    <Block
                      label="Cover note"
                      value={a.cover_note ?? ""}
                      copyKey={`${a.id}-note`}
                      copied={copied}
                      onCopy={copy}
                    />
                    <Block
                      label="Résumé summary (for this role)"
                      value={a.tailored_resume?.summary ?? ""}
                      copyKey={`${a.id}-sum`}
                      copied={copied}
                      onCopy={copy}
                    />

                    {!!a.tailored_resume?.emphasizedBullets?.length && (
                      <Block
                        label="Bullets to lead with"
                        value={a.tailored_resume.emphasizedBullets.map((b) => `• ${b}`).join("\n")}
                        copyKey={`${a.id}-bul`}
                        copied={copied}
                        onCopy={copy}
                      />
                    )}

                    {!!a.screening_answers?.length && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
                          Screening answers
                        </p>
                        {a.screening_answers.map((qa, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[11px] font-medium text-[var(--admin-text)]">
                                {qa.question}
                              </p>
                              <button
                                type="button"
                                onClick={() => copy(`${a.id}-qa${i}`, qa.answer)}
                                className="text-[var(--admin-text-muted)] hover:text-indigo-400 shrink-0"
                                title="Copy answer"
                              >
                                {copied === `${a.id}-qa${i}` ? (
                                  <FiCheck size={11} />
                                ) : (
                                  <FiCopy size={11} />
                                )}
                              </button>
                            </div>
                            <p className="text-[11px] text-[var(--admin-text-secondary)] mt-1 whitespace-pre-wrap">
                              {qa.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!!a.gaps?.length && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-amber-500/80 mb-1">
                          Gaps — prep an honest answer
                        </p>
                        <ul className="space-y-1">
                          {a.gaps.map((g, i) => (
                            <li key={i} className="text-[11px] text-[var(--admin-text-secondary)] flex gap-2">
                              <span className="text-amber-500 shrink-0">•</span>
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!!a.keywords?.length && (
                      <div className="flex flex-wrap gap-1.5">
                        {a.keywords.map((k) => (
                          <span
                            key={k}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--admin-input-bg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Block({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (k: string, v: string) => void;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
          {label}
        </p>
        <button
          type="button"
          onClick={() => onCopy(copyKey, value)}
          className="inline-flex items-center gap-1 text-[10px] text-[var(--admin-text-muted)] hover:text-indigo-400"
        >
          {copied === copyKey ? <FiCheck size={10} /> : <FiCopy size={10} />}
          {copied === copyKey ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-[var(--admin-text-secondary)] whitespace-pre-wrap rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] p-3">
        {value}
      </p>
    </div>
  );
}
