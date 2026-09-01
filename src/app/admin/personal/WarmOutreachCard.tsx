"use client";

/**
 * Toggle for warm check-in outreach.
 *
 * Separate from the auto-reply card on purpose. Auto-reply answers people who
 * wrote first; this writes to people who did not, which is a different thing to
 * be switching on and deserves its own deliberate decision.
 */

import { useEffect, useState } from "react";
import { FiSend, FiAlertTriangle } from "react-icons/fi";

export default function WarmOutreachCard({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/briefing/settings", { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setEnabled(r.ok && j.settings ? !!j.settings.warm_outreach_enabled : false);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/briefing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warm_outreach_enabled: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        onError(j.error || "Save failed — did you run supabase/warm_outreach.sql?");
        setSaving(false);
        return;
      }
      setEnabled(!!j.settings?.warm_outreach_enabled);
      onSuccess(next ? "Warm outreach turned ON" : "Warm outreach turned OFF");
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
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
      }`}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-[#ff6b00]/15 text-[#ff6b00] flex items-center justify-center shrink-0">
          <FiSend size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Warm check-ins</h3>
            <span
              className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase border ${
                enabled
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"
              }`}
            >
              {enabled ? "On" : "Off"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            Emails recruiters who <strong className="text-[var(--admin-text)]">have replied to you before</strong> and
            have since gone quiet — a short note saying you&apos;re looking, open to relocation and to
            contract/full-time/internship, asking what they have now.
          </p>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1.5">
            Limits: <strong className="text-[var(--admin-text)]">3 a day</strong>, quiet{" "}
            <strong className="text-[var(--admin-text)]">30+ days</strong> before anyone qualifies, never twice inside{" "}
            <strong className="text-[var(--admin-text)]">60 days</strong>, weekdays 9am–6pm New York. Never contacts
            anyone who has never replied, bounced, or is marked do-not-contact.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
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

      {enabled && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2">
          <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Outbound email is going out from your Gmail without review. Every send is logged in full under{" "}
            <strong>outreach_log.body_sent</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
