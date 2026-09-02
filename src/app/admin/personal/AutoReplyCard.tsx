"use client";

import { useEffect, useState } from "react";
import { FiCornerUpLeft, FiAlertTriangle, FiChevronDown, FiChevronUp } from "react-icons/fi";

type Decision = {
  from_email: string | null;
  subject: string | null;
  category: string | null;
  match_pct: number | null;
  decision: string;
  reason: string | null;
  created_at: string;
};

type RunLog = {
  lastRunAt: string | null;
  lastSummary: string | null;
  decisions: Decision[];
  setupNeeded?: string;
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export default function AutoReplyCard({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<RunLog | null>(null);
  const [showLog, setShowLog] = useState(false);

  async function loadLog() {
    try {
      const r = await fetch("/api/admin/auto-reply/log", { cache: "no-store" });
      if (r.ok) setLog((await r.json()) as RunLog);
    } catch {
      // The toggle still works without the log; leave it absent rather than
      // showing an error for a diagnostic panel.
    }
  }

  async function load() {
    try {
      const r = await fetch("/api/admin/briefing/settings", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setEnabled(r.ok && j.settings ? !!j.settings.auto_reply_enabled : false);
    } catch {
      setEnabled(false);
    }
  }

  // Declared after both loaders so neither is referenced before it exists.
  useEffect(() => {
    void load();
    void loadLog();
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/briefing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_reply_enabled: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        onError(j.error || "Save failed — did you run add_auto_reply_setting.sql?");
        setSaving(false);
        return;
      }
      setEnabled(!!j.settings?.auto_reply_enabled);
      onSuccess(next ? "Auto-reply turned ON" : "Auto-reply turned OFF");
    } catch {
      onError("Network error");
    }
    setSaving(false);
  }

  if (enabled === null) return null;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        enabled
          ? "border-red-500/30 bg-red-500/[0.04]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
      }`}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-[#ff6b00]/15 text-[#ff6b00] flex items-center justify-center shrink-0">
          <FiCornerUpLeft size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Auto-reply to recruiters</h3>
            <span
              className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase border ${
                enabled
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"
              }`}
            >
              {enabled ? "On" : "Off"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            When <strong className="text-[var(--admin-text)]">on</strong>, a 5-minute cron reads unread inbox
            mail, replies from your Gmail with your resume attached to anything it classifies as a real role pitch
            scoring <strong className="text-[var(--admin-text)]">70%+</strong> —{" "}
            <span className="text-red-400">without asking you first</span>. When{" "}
            <strong className="text-[var(--admin-text)]">off</strong>, nothing is sent; reply yourself from CRM →
            Conversations.
          </p>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1.5">
            No daily quota — every genuine match gets an answer. Limits are{" "}
            <strong className="text-[var(--admin-text)]">2 replies per conversation</strong> so nothing loops, and only
            between{" "}
            <strong className="text-[var(--admin-text)]">9am–6pm New York</strong>. Personal mail, referral requests,
            job-board digests and interview scheduling are never answered.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
            enabled ? "bg-red-500" : "bg-[var(--admin-surface-hover)]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Did it run, and what did it decide? Without this, "replied to nothing"
          and "never fired" are the same empty inbox. */}
      {log && (
        <div className="mt-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-[var(--admin-text-muted)]">
              {log.lastRunAt ? (
                <>
                  Last run <strong className="text-[var(--admin-text)]">{ago(log.lastRunAt)}</strong>
                  {log.lastSummary ? ` — ${log.lastSummary}` : ""}
                </>
              ) : (
                <span className="text-amber-400">
                  No run recorded yet — the 5-minute cron has not reported in.
                </span>
              )}
            </p>
            {log.decisions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
              >
                {showLog ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                {showLog ? "Hide" : `${log.decisions.length} decisions`}
              </button>
            )}
          </div>

          {log.setupNeeded && (
            <p className="mt-1 text-[11px] text-amber-400">{log.setupNeeded}</p>
          )}

          {showLog && (
            <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
              {log.decisions.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] py-1 border-t border-[var(--admin-border)]">
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                      d.decision === "sent"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : d.decision === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)]"
                    }`}
                  >
                    {d.decision}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[var(--admin-text)]">
                      {d.subject || "(no subject)"}
                      {d.match_pct !== null && (
                        <span className="text-[var(--admin-text-muted)]"> · {d.match_pct}%</span>
                      )}
                    </p>
                    <p className="truncate text-[var(--admin-text-muted)]">
                      {d.from_email} — {d.reason}
                    </p>
                  </div>
                  <span className="shrink-0 text-[var(--admin-text-muted)]">{ago(d.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {enabled && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-red-400 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Auto-reply is live — emails go out from your Gmail with no review during 9am–6pm New York. Every reply is
            logged in full under <strong>replied_emails.body_sent</strong>. Turn this off if you want to approve each
            one yourself.
          </span>
        </div>
      )}
    </div>
  );
}
