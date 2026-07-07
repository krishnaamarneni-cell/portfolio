"use client";

import { useEffect, useState } from "react";
import { FiZap, FiSave, FiMail, FiSun } from "react-icons/fi";
import { inputClass, Markdown } from "./shared";

type Settings = {
  morning_briefing_enabled: boolean;
  morning_briefing_to: string | null;
  morning_briefing_last_run_at: string | null;
  morning_briefing_last_status: string | null;
  morning_briefing_last_subject: string | null;
};

export default function MorningBriefingCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<{
    subject: string;
    lifeMarkdown: string;
    newsMarkdown: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/briefing/settings", {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.settings) {
      setSettings(j.settings);
      setRecipient(j.settings.morning_briefing_to ?? "");
    }
    setLoading(false);
  }

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const r = await fetch("/api/admin/briefing/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    setSettings(j.settings);
    onSuccess("Briefing settings saved");
  }

  async function sendNow() {
    setSending(true);
    const r = await fetch("/api/admin/briefing/send-now", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) {
      onError(j.status || j.error || "Send failed");
    } else {
      onSuccess(j.subject ? `Sent: ${j.subject}` : "Briefing sent");
    }
    void load();
  }

  async function runPreview() {
    setPreviewBusy(true);
    setExpanded(true);
    const r = await fetch("/api/admin/briefing/preview", {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    setPreviewBusy(false);
    if (!r.ok) {
      onError(j.error || "Preview failed");
      return;
    }
    setPreview({
      subject: j.subject,
      lifeMarkdown: j.lifeMarkdown,
      newsMarkdown: j.newsMarkdown,
    });
  }

  if (loading) return null;

  const enabled = settings?.morning_briefing_enabled ?? false;
  const lastRunAt = settings?.morning_briefing_last_run_at
    ? new Date(settings.morning_briefing_last_run_at)
    : null;
  const lastStatus = settings?.morning_briefing_last_status ?? null;
  const recipientChanged = recipient !== (settings?.morning_briefing_to ?? "");

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] to-transparent p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
          <FiSun size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">
              Morning Briefing
            </h3>
            {enabled ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                On - 7:00 AM ET
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] uppercase">
                Off
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            One daily email with what's overdue, what's coming, blind spots from
            your notes, plus market + AI headlines. Runs via Vercel Cron and
            sends through your Gmail OAuth.
          </p>
          {lastRunAt && (
            <p className="text-[10px] font-mono text-[var(--admin-text-muted)] mt-1">
              Last run {lastRunAt.toLocaleString()} - {lastStatus}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] uppercase tracking-widest text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] px-2 py-1"
        >
          {expanded ? "Hide" : "Configure"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--admin-border)] space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-[var(--admin-text)]">
                Enabled
              </p>
              <p className="text-[11px] text-[var(--admin-text-muted)]">
                When on, Vercel Cron triggers /api/cron/morning-briefing daily
                at 11:00 UTC (7:00 ET).
              </p>
            </div>
            <button
              type="button"
              onClick={() => save({ morning_briefing_enabled: !enabled })}
              disabled={saving}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                enabled ? "bg-amber-500" : "bg-[var(--admin-surface-hover)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Send to
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="you@gmail.com"
                className={inputClass + " flex-1 text-sm"}
              />
              <button
                type="button"
                onClick={() =>
                  save({ morning_briefing_to: recipient || null })
                }
                disabled={saving || !recipientChanged}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--admin-surface-hover)] border border-[var(--admin-border)] text-xs hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
              >
                <FiSave size={11} />
                Save
              </button>
            </div>
            <p className="text-[10px] text-[var(--admin-text-muted)] mt-1">
              Must be reachable from your connected Gmail account. Usually your
              own primary inbox.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--admin-surface-hover)] border border-[var(--admin-border)] text-xs hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-60"
            >
              <FiZap size={11} />
              {previewBusy ? "Building..." : "Preview now"}
            </button>
            <button
              type="button"
              onClick={sendNow}
              disabled={sending || !settings?.morning_briefing_to}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:scale-[1.03] disabled:opacity-50"
            >
              <FiMail size={11} />
              {sending ? "Sending..." : "Send now"}
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="mt-2 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-2">
                Preview - subject
              </p>
              <p className="text-sm text-[var(--admin-text)] mb-3">
                {preview.subject}
              </p>
              <Markdown text={preview.lifeMarkdown} />
              <Markdown text={preview.newsMarkdown} />
            </div>
          )}

          {/* Setup help */}
          <details className="text-[11px] text-[var(--admin-text-muted)]">
            <summary className="cursor-pointer text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
              Setup checklist
            </summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>
                Reconnect Gmail under{" "}
                <strong className="text-[var(--admin-text)]">
                  Connectors - Gmail
                </strong>{" "}
                so the new <code>gmail.send</code> scope is granted (re-consent
                screen).
              </li>
              <li>
                Add <code className="text-amber-300">CRON_SECRET</code> to
                Vercel env (any long random string). Vercel will use it to
                authenticate the daily cron call.
              </li>
              <li>
                Make sure{" "}
                <code className="text-amber-300">TAVILY_API_KEY</code> or{" "}
                <code className="text-amber-300">BRAVE_API_KEY</code> is set so
                the News section has live search.
              </li>
              <li>
                Set the recipient above, toggle Enabled on, hit{" "}
                <strong className="text-[var(--admin-text)]">Send now</strong>{" "}
                to test.
              </li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
