"use client";

/**
 * On/off switches for the scheduled jobs.
 *
 * Exists because the only way to stop a job used to be commenting out the cron
 * line in its workflow YAML and pushing — which is what was done to all five
 * when Vercel paused the account for Fluid Active CPU.
 *
 * The switch is read by GitHub Actions before it calls the site, so a job that
 * is off costs no Vercel CPU at all. That is why the card talks about cost: it
 * is the reason the control exists.
 */

import { useEffect, useState } from "react";
import { FiClock, FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

type CronSwitch = {
  key: string;
  label: string;
  schedule: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
};

function ago(iso: string | null): string {
  if (!iso) return "never run";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export default function CronJobsCard({
  onSuccess,
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [rows, setRows] = useState<CronSwitch[] | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/cron-switches", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setRows(j.switches ?? []);
      setSetupNeeded(j.error ?? null);
    } catch {
      setRows([]);
      setSetupNeeded("Could not load the switches.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(row: CronSwitch) {
    setBusy(row.key);
    try {
      const r = await fetch("/api/admin/cron-switches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: row.key, enabled: !row.enabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        onError(j.error || "Could not save");
      } else {
        setRows(j.switches ?? []);
        setSetupNeeded(j.error ?? null);
        onSuccess(`${row.label} ${row.enabled ? "paused" : "running"}`);
      }
    } catch {
      onError("Network error");
    }
    setBusy(null);
  }

  if (rows === null) return null;
  const on = rows.filter((r) => r.enabled).length;

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-[#ff6b00]/15 text-[#ff6b00] flex items-center justify-center shrink-0">
          <FiClock size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[var(--admin-text)]">Scheduled jobs</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase border bg-[var(--admin-surface-hover)] text-[var(--admin-text-muted)] border-[var(--admin-border)]">
              {on} of {rows.length} running
            </span>
          </div>
          <p className="text-[11px] text-[var(--admin-text-muted)] mt-1">
            Turning one off stops it before it reaches the site, so it uses{" "}
            <strong className="text-[var(--admin-text)]">no Vercel CPU</strong> at all — the
            switch is read straight from the database by GitHub. Takes effect on the next tick;
            no deploy needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] border border-[var(--admin-border)]"
        >
          <FiRefreshCw size={12} />
          Refresh
        </button>
      </div>

      {setupNeeded && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2">
          <FiAlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{setupNeeded}</span>
        </div>
      )}

      <div className="mt-3 space-y-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 py-2 border-t border-[var(--admin-border)]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-[var(--admin-text)] truncate">{row.label}</p>
              <p className="text-[11px] text-[var(--admin-text-muted)] truncate">
                {row.schedule ?? "no schedule"} · {ago(row.lastRunAt)}
                {row.lastStatus ? ` · ${row.lastStatus}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggle(row)}
              disabled={busy === row.key}
              aria-pressed={row.enabled}
              aria-label={`${row.enabled ? "Pause" : "Run"} ${row.label}`}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
                row.enabled ? "bg-emerald-500" : "bg-[var(--admin-surface-hover)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  row.enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-[var(--admin-text-muted)] leading-relaxed">
        Auto-reply also has its own switch in its card above. This one decides whether the job
        runs at all; that one decides whether it sends once it has run.
      </p>
    </div>
  );
}
