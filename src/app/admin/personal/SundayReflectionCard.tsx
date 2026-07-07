"use client";

import { useEffect, useState } from "react";
import { FiZap, FiSave, FiMail, FiClock } from "react-icons/fi";
import { inputClass, Markdown } from "./shared";

export default function SundayReflectionCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [settings, setSettings] = useState<{
    sunday_reflection_enabled: boolean;
    sunday_reflection_to: string | null;
    sunday_reflection_last_run_at: string | null;
    sunday_reflection_last_status: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<{
    subject: string;
    markdown: string;
  } | null>(null);

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
      setRecipient(
        j.settings.sunday_reflection_to ??
          j.settings.morning_briefing_to ??
          ""
      );
    }
    setLoading(false);
  }
  async function save(patch: Record<string, unknown>) {
    const r = await fetch("/api/admin/briefing/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    setSettings(j.settings);
    onSuccess("Reflection settings saved");
  }
  async function sendNow() {
    setSending(true);
    const r = await fetch("/api/admin/reflection/send-now", {
      method: "POST",
    });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) onError(j.status || j.error || "Send failed");
    else onSuccess(j.subject ? `Sent: ${j.subject}` : "Reflection sent");
    void load();
  }
  async function runPreview() {
    setPreviewBusy(true);
    setExpanded(true);
    const r = await fetch("/api/admin/reflection/preview", {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    setPreviewBusy(false);
    if (!r.ok) {
      onError(j.error || "Preview failed");
      return;
    }
    setPreview({ subject: j.subject, markdown: j.markdown });
  }

  if (loading) return null;
  const enabled = settings?.sunday_reflection_enabled ?? false;
  const lastRun = settings?.sunday_reflection_last_run_at
    ? new Date(settings.sunday_reflection_last_run_at)
    : null;

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.05] to-transparent p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
          <FiClock size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">
              Sunday Reflection
            </h3>
            {enabled ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                On - Sun 7:00 PM ET
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] uppercase">
                Off
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            Weekly recap email Sunday evening: what you did, what slipped, next 7
            days, and one thing to focus on.
          </p>
          {lastRun && (
            <p className="text-[10px] font-mono text-[var(--admin-text-muted)] mt-1">
              Last run {lastRun.toLocaleString()} -{" "}
              {settings?.sunday_reflection_last_status}
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--admin-text)]">
                Enabled
              </p>
              <p className="text-[11px] text-[var(--admin-text-muted)]">
                Cron fires <code>0 23 * * 0</code> = Sunday 11pm UTC (7pm ET).
              </p>
            </div>
            <button
              type="button"
              onClick={() => save({ sunday_reflection_enabled: !enabled })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                enabled ? "bg-purple-500" : "bg-[var(--admin-surface-hover)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-1.5">
              Send to (defaults to morning-briefing address)
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
                  save({ sunday_reflection_to: recipient || null })
                }
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--admin-surface-hover)] border border-[var(--admin-border)] text-xs hover:border-purple-500/40 hover:text-purple-300"
              >
                <FiSave size={11} />
                Save
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--admin-surface-hover)] border border-[var(--admin-border)] text-xs hover:border-purple-500/40 hover:text-purple-300 disabled:opacity-60"
            >
              <FiZap size={11} />
              {previewBusy ? "Building..." : "Preview now"}
            </button>
            <button
              type="button"
              onClick={sendNow}
              disabled={sending}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(168,85,247,0.35)] hover:scale-[1.03] disabled:opacity-50"
            >
              <FiMail size={11} />
              {sending ? "Sending..." : "Send now"}
            </button>
          </div>
          {preview && (
            <div className="rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)] mb-2">
                Preview - subject
              </p>
              <p className="text-sm text-[var(--admin-text)] mb-3">
                {preview.subject}
              </p>
              <Markdown text={preview.markdown} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
