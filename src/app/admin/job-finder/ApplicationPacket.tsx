"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiSave,
  FiX,
  FiCheckCircle,
  FiAlertTriangle,
  FiZap,
} from "react-icons/fi";
import { scoreTone, type Listing } from "./types";

type Answer = {
  id: string;
  label: string;
  answer: string;
  keywords: string[] | null;
  category: string;
  sort_order: number;
  use_count: number;
};

type Props = {
  listing: Listing;
  onClose: () => void;
  onApplied: (id: string) => void;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

/** A field with its own copy button — the unit the whole packet is built from. */
function CopyField({
  label,
  value,
  multiline,
  onCopied,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the text is selectable either way.
    }
  };

  return (
    <div className="bg-[var(--admin-bg)] rounded-lg border border-[var(--admin-border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
          {label}
        </p>
        <button
          onClick={copy}
          className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
            copied ? "text-emerald-500" : "text-[#ff6b00] hover:underline"
          }`}
        >
          {copied ? <FiCheck size={10} /> : <FiCopy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p
        className={`text-xs text-[var(--admin-text)] leading-relaxed whitespace-pre-wrap ${
          multiline ? "max-h-48 overflow-y-auto" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ApplicationPacket({
  listing,
  onClose,
  onApplied,
  onSuccess,
  onError,
}: Props) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ label: "", answer: "", keywords: "" });
  const [adding, setAdding] = useState(false);
  const [marking, setMarking] = useState(false);

  const cb = useRef({ onSuccess, onError });
  cb.current = { onSuccess, onError };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-finder/answers");
      const data = await res.json();
      if (data.needsMigration) {
        setNeedsMigration(true);
        return;
      }
      if (data.error) {
        cb.current.onError(data.error);
        return;
      }
      setNeedsMigration(false);
      setAnswers(data.answers ?? []);
    } catch {
      cb.current.onError("Could not load the answer library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Which stored answers this posting is likely to ask for. Keyword hits
   * against the description float to the top; everything else stays available
   * because ATS phrasing varies more than any keyword list can predict.
   */
  const { likely, rest } = useMemo(() => {
    const haystack = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
    const likely: Answer[] = [];
    const rest: Answer[] = [];
    for (const a of answers) {
      const hit = (a.keywords ?? []).some((k) => k && haystack.includes(k));
      (hit ? likely : rest).push(a);
    }
    return { likely, rest };
  }, [answers, listing]);

  const save = async (id: string) => {
    try {
      const res = await fetch("/api/admin/job-finder/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id,
          label: draft.label,
          answer: draft.answer,
          keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      setEditing(null);
      load();
    } catch {
      onError("Save failed.");
    }
  };

  const create = async () => {
    if (!draft.label.trim() || !draft.answer.trim()) {
      onError("Label and answer are both required.");
      return;
    }
    try {
      const res = await fetch("/api/admin/job-finder/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          label: draft.label,
          answer: draft.answer,
          keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      setAdding(false);
      setDraft({ label: "", answer: "", keywords: "" });
      load();
    } catch {
      onError("Could not add the answer.");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/job-finder/answers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      load();
    } catch {
      onError("Delete failed.");
    }
  };

  const markApplied = async () => {
    setMarking(true);
    try {
      const res = await fetch("/api/admin/job-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id: listing.id, status: "applied" }),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      onSuccess("Marked as applied.");
      onApplied(listing.id);
      onClose();
    } catch {
      onError("Could not update status.");
    } finally {
      setMarking(false);
    }
  };

  const tone = scoreTone(listing.match_score);
  const keywords = listing.resume_keywords ?? [];

  const AnswerRow = ({ a, highlight }: { a: Answer; highlight?: boolean }) => {
    const isEditing = editing === a.id;
    if (isEditing) {
      return (
        <div className="bg-[var(--admin-bg)] rounded-lg border border-[#ff6b00] p-3 space-y-2">
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00]"
          />
          <textarea
            value={draft.answer}
            onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
            rows={3}
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00] leading-relaxed"
          />
          <input
            value={draft.keywords}
            onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
            placeholder="Trigger words, comma separated"
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => save(a.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#ff6b00] text-white text-[11px] font-semibold"
            >
              <FiSave size={11} /> Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[var(--admin-border)] text-[var(--admin-text-muted)] text-[11px] font-semibold"
            >
              <FiX size={11} /> Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`bg-[var(--admin-bg)] rounded-lg border p-3 ${
          highlight ? "border-[#ff6b00]/40" : "border-[var(--admin-border)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] truncate">
            {a.label}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <CopyInline
              value={a.answer}
              onCopied={() =>
                fetch("/api/admin/job-finder/answers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "used", id: a.id }),
                }).catch(() => {})
              }
            />
            <button
              onClick={() => {
                setEditing(a.id);
                setDraft({
                  label: a.label,
                  answer: a.answer,
                  keywords: (a.keywords ?? []).join(", "),
                });
              }}
              className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              aria-label="Edit answer"
            >
              <FiEdit2 size={11} />
            </button>
            <button
              onClick={() => remove(a.id)}
              className="text-[var(--admin-text-muted)] hover:text-rose-500"
              aria-label="Delete answer"
            >
              <FiTrash2 size={11} />
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--admin-text)] leading-relaxed whitespace-pre-wrap">{a.answer}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
      <div className="w-full max-w-3xl bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--admin-surface)] border-b border-[var(--admin-border)] rounded-t-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-[var(--admin-text)] text-base leading-snug">
                {listing.title}
              </h2>
              <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                {listing.company ?? "Unknown company"}
                {listing.location ? ` · ${listing.location}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {listing.match_score !== null && (
                <span className="text-lg font-bold tabular-nums text-[var(--admin-text)]">
                  {listing.match_score}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${tone.className}`}>
                {tone.label}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <a
              href={listing.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] transition-colors"
            >
              <FiExternalLink size={12} />
              Open the application form
            </a>
            <button
              onClick={markApplied}
              disabled={marking}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text)] text-xs font-semibold hover:border-emerald-500 transition-colors disabled:opacity-50"
            >
              <FiCheckCircle size={12} />
              {marking ? "Saving…" : "I submitted this"}
            </button>
            <span className="text-[10px] text-[var(--admin-text-muted)] ml-auto">
              You submit — nothing here is sent for you.
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Tailoring */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
              For this role
            </h3>
            {listing.match_summary && (
              <CopyField label="Fit summary" value={listing.match_summary} multiline />
            )}
            {keywords.length > 0 && (
              <CopyField
                label="Keywords to mirror in your resume"
                value={keywords.join(", ")}
                multiline
              />
            )}
            {!!listing.missing_skills?.length && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1.5">
                  Gaps — expect these to come up
                </p>
                <p className="text-xs text-[var(--admin-text)] leading-relaxed">
                  {listing.missing_skills.join(" · ")}
                </p>
              </div>
            )}
          </div>

          {/* Answer library */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                Answer library
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={load}
                  disabled={loading}
                  className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] disabled:opacity-50"
                  aria-label="Reload answers"
                >
                  <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => {
                    setAdding((v) => !v);
                    setDraft({ label: "", answer: "", keywords: "" });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#ff6b00] hover:underline"
                >
                  <FiPlus size={11} /> Add
                </button>
              </div>
            </div>

            {needsMigration ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
                <FiAlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--admin-text)] text-sm">Migration needed</p>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed">
                    Run <code className="px-1 py-0.5 rounded bg-[var(--admin-bg)]">
                      supabase/application_answers.sql
                    </code>{" "}
                    to enable the answer library. It ships with a starter set — edit those before using them.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {adding && (
                  <div className="bg-[var(--admin-bg)] rounded-lg border border-[#ff6b00] p-3 space-y-2">
                    <input
                      value={draft.label}
                      onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                      placeholder="Question label, e.g. Notice period"
                      className="w-full px-2.5 py-1.5 rounded-md bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
                    />
                    <textarea
                      value={draft.answer}
                      onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
                      rows={3}
                      placeholder="Your answer"
                      className="w-full px-2.5 py-1.5 rounded-md bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00] leading-relaxed"
                    />
                    <input
                      value={draft.keywords}
                      onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
                      placeholder="Trigger words, comma separated"
                      className="w-full px-2.5 py-1.5 rounded-md bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
                    />
                    <button
                      onClick={create}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#ff6b00] text-white text-[11px] font-semibold"
                    >
                      <FiSave size={11} /> Add answer
                    </button>
                  </div>
                )}

                {likely.length > 0 && (
                  <>
                    <p className="text-[10px] text-[#ff6b00] font-semibold flex items-center gap-1">
                      <FiZap size={10} /> Mentioned in this posting
                    </p>
                    {likely.map((a) => (
                      <AnswerRow key={a.id} a={a} highlight />
                    ))}
                  </>
                )}

                {rest.map((a) => (
                  <AnswerRow key={a.id} a={a} />
                ))}

                {!loading && !answers.length && (
                  <p className="text-xs text-[var(--admin-text-muted)] py-4 text-center">
                    No saved answers yet. Add the questions you retype most.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact copy control used inside answer rows. */
function CopyInline({ value, onCopied }: { value: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard permissions vary; text stays selectable.
        }
      }}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
        copied ? "text-emerald-500" : "text-[#ff6b00] hover:underline"
      }`}
    >
      {copied ? <FiCheck size={10} /> : <FiCopy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
