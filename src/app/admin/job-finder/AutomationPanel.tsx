"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiRefreshCw,
  FiPlay,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiClock,
} from "react-icons/fi";
import { relativeDate } from "./types";

type Props = { onSuccess: (m: string) => void; onError: (m: string) => void };

type Stats = {
  total: number;
  scored: number;
  unscored: number;
  relevant: number;
  minScore: number;
  sources: number;
};

type Run = {
  started_at: string;
  sources_checked: number;
  jobs_seen: number;
  jobs_added: number;
  jobs_scored: number;
  relevant_found: number;
  duration_ms: number | null;
  ok: boolean;
  errors: string[] | null;
  trigger: string;
};

type Health = {
  company: string;
  kind: string;
  last_checked_at: string | null;
  last_ok: boolean | null;
  last_error: string | null;
  last_jobs_found: number;
  total_jobs_found: number;
  consecutive_failures: number;
};

/** The target the automation is working toward. */
const RELEVANT_GOAL = 50;

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-[var(--admin-bg)] rounded-lg border border-[var(--admin-border)] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
        {label}
      </p>
      <p className="text-xl font-bold text-[var(--admin-text)] tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[10px] text-[var(--admin-text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

export default function AutomationPanel({ onSuccess, onError }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [runs, setRuns] = useState<Run[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);

  const cb = useRef({ onSuccess, onError });
  cb.current = { onSuccess, onError };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-finder/automation");
      const data = await res.json();
      setCounts(data.counts ?? {});
      if (data.needsMigration) {
        setNeedsMigration(true);
        return;
      }
      if (data.error) {
        cb.current.onError(data.error);
        return;
      }
      setNeedsMigration(false);
      setStats(data.stats);
      setRuns(data.runs ?? []);
      setHealth(data.health ?? []);
      setPending(data.pending ?? 0);
    } catch {
      cb.current.onError("Could not load automation status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/job-finder/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      onSuccess(
        `Checked ${data.sourcesChecked} employers · ${data.jobsAdded} new · scored ${data.jobsScored}` +
          (data.relevantFound ? ` · ${data.relevantFound} relevant` : "")
      );
      load();
    } catch {
      onError("Run failed.");
    } finally {
      setRunning(false);
    }
  };

  if (needsMigration) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex gap-3">
        <FiAlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[var(--admin-text)] text-sm">Migration needed</p>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed">
            Run <code className="px-1 py-0.5 rounded bg-[var(--admin-bg)]">supabase/job_crawler.sql</code> in
            the Supabase SQL editor to enable the automation log. Discovery and scoring still work without it.
          </p>
        </div>
      </div>
    );
  }

  const pct = stats ? Math.min(100, Math.round((stats.relevant / RELEVANT_GOAL) * 100)) : 0;
  const totalSources = Object.values(counts).reduce((n, v) => n + v, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--admin-text)] text-sm">Automation</h3>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed max-w-2xl">
            A scheduled job sweeps a slice of {totalSources} employer job boards every 15 minutes, saves what
            it finds, then scores it against your profile. Each run continues from where the last one stopped.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={runNow}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] transition-colors disabled:opacity-50"
            title="Run one cycle now instead of waiting for the schedule"
          >
            <FiPlay size={13} className={running ? "animate-pulse" : ""} />
            {running ? "Running…" : "Run now"}
          </button>
        </div>
      </div>

      {stats && (
        <>
          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-[var(--admin-text)]">
                {stats.relevant} relevant {stats.relevant === 1 ? "job" : "jobs"} found
              </p>
              <p className="text-xs text-[var(--admin-text-muted)] tabular-nums">
                goal {RELEVANT_GOAL}
              </p>
            </div>
            <div className="h-2 rounded-full bg-[var(--admin-bg)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#ff6b00] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[var(--admin-text-muted)] mt-2 leading-relaxed">
              Scoring {stats.minScore}+ and inside your preferred locations. {stats.unscored > 0
                ? `${stats.unscored} still queued for scoring.`
                : "Everything discovered has been scored."}
            </p>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Stat label="Jobs checked" value={stats.total} hint="unique postings stored" />
            <Stat label="Scored" value={stats.scored} />
            <Stat label="Queued" value={stats.unscored} hint="awaiting AI scoring" />
            <Stat
              label="Employers"
              value={stats.sources}
              hint={pending > 0 ? `${pending} not yet swept` : "all swept"}
            />
          </div>
        </>
      )}

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2.5">
          Recent runs
        </h4>
        {!runs.length ? (
          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-6 text-center">
            <FiClock size={20} className="mx-auto text-[var(--admin-text-muted)] mb-2" />
            <p className="text-sm text-[var(--admin-text)] font-semibold">No runs yet</p>
            <p className="text-xs text-[var(--admin-text-muted)] mt-1">
              Hit “Run now”, or wait for the schedule once CRON_SECRET is set in GitHub.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {runs.map((r, i) => (
              <div
                key={`${r.started_at}-${i}`}
                className="bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)] px-3.5 py-2.5 flex items-center gap-3 text-xs"
              >
                {r.ok ? (
                  <FiCheckCircle size={13} className="text-emerald-500 shrink-0" />
                ) : (
                  <FiXCircle size={13} className="text-amber-500 shrink-0" />
                )}
                <span className="text-[var(--admin-text-muted)] w-20 shrink-0">
                  {relativeDate(r.started_at)}
                </span>
                <span className="text-[var(--admin-text)] tabular-nums">
                  {r.sources_checked} employers · {r.jobs_added} new · {r.jobs_scored} scored
                  {r.relevant_found > 0 && (
                    <span className="text-emerald-500 font-semibold"> · {r.relevant_found} relevant</span>
                  )}
                </span>
                <span className="ml-auto text-[var(--admin-text-muted)] tabular-nums shrink-0">
                  {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : ""}
                </span>
                {r.trigger === "manual" && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] shrink-0">
                    manual
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {health.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2.5">
            Source health
          </h4>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {health.slice(0, 40).map((h) => (
              <div
                key={`${h.company}-${h.kind}`}
                className="bg-[var(--admin-surface)] rounded-lg border border-[var(--admin-border)] px-3 py-2 flex items-center gap-2 text-xs"
                title={h.last_error ?? undefined}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    h.consecutive_failures > 0 ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
                <span className="text-[var(--admin-text)] truncate">{h.company}</span>
                <span className="text-[10px] text-[var(--admin-text-muted)] shrink-0">{h.kind}</span>
                <span className="ml-auto text-[var(--admin-text-muted)] tabular-nums shrink-0">
                  {h.total_jobs_found}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
