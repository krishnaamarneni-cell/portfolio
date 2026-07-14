"use client";

import { useEffect, useState } from "react";
import { FiCornerUpLeft, FiAlertTriangle } from "react-icons/fi";

export default function AutoReplyCard({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const r = await fetch("/api/admin/briefing/settings", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setEnabled(r.ok && j.settings ? !!j.settings.auto_reply_enabled : false);
    } catch {
      setEnabled(false);
    }
  }

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
            When <strong className="text-[var(--admin-text)]">on</strong>, the 6-hourly agent cron auto-sends a
            personalized reply (with your resume) to any recruiter/job email it scores over 65% —{" "}
            <span className="text-red-400">without asking you first</span>. When{" "}
            <strong className="text-[var(--admin-text)]">off</strong>, nothing is sent; reply yourself from CRM →
            Conversations.
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

      {enabled && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-red-400 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Auto-reply is live — emails go out automatically every ~6 hours with no review. Turn this off if you want to
            approve each reply yourself.
          </span>
        </div>
      )}
    </div>
  );
}
