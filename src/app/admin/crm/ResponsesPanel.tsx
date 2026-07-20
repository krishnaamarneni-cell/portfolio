"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FiRefreshCw,
  FiMail,
  FiCornerUpLeft,
  FiAlertTriangle,
  FiClock,
  FiTrash2,
  FiSlash,
} from "react-icons/fi";
import { timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

type Stats = {
  totalSent: number;
  uniqueContacts: number;
  replied: number;
  replyRate: number;
  bounced: number;
  awaiting: number;
  topResponders: Array<{ email: string; name: string | null; replies: number; lastRepliedAt: string | null }>;
  deadAddresses: Array<{ email: string; name: string | null; reason: string | null; contactId: string | null }>;
};

export default function ResponsesPanel({ onSuccess, onError }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [pruning, setPruning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/contacts/email/tracking", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setStats(j as Stats);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load response stats");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const r = await fetch("/api/admin/contacts/email/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Scan failed");
      onSuccess(
        `Checked ${j.checked} sends — ${j.newReplies} new ${j.newReplies === 1 ? "reply" : "replies"}, ${j.newBounces} dead ${j.newBounces === 1 ? "address" : "addresses"}.`
      );
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const pruneDead = async () => {
    if (!stats?.deadAddresses.length) return;
    setPruning(true);
    try {
      const r = await fetch("/api/admin/contacts/email/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prune" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Prune failed");
      onSuccess(`Excluded ${j.pruned} dead ${j.pruned === 1 ? "address" : "addresses"} from future bulk sends.`);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Prune failed");
    } finally {
      setPruning(false);
    }
  };

  const cards: Array<{ label: string; value: string; icon: React.ComponentType<{ size?: number }>; tone: string }> = [
    { label: "Emails sent", value: String(stats?.totalSent ?? 0), icon: FiMail, tone: "text-[var(--text-primary)]" },
    { label: "Replied", value: String(stats?.replied ?? 0), icon: FiCornerUpLeft, tone: "text-emerald-400" },
    { label: "Reply rate", value: `${stats?.replyRate ?? 0}%`, icon: FiCornerUpLeft, tone: "text-emerald-400" },
    { label: "Awaiting", value: String(stats?.awaiting ?? 0), icon: FiClock, tone: "text-[var(--text-secondary)]" },
    { label: "Dead addresses", value: String(stats?.bounced ?? 0), icon: FiAlertTriangle, tone: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[var(--text-primary)] font-semibold text-lg">Email responses</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Who actually replies to your bulk sends, and which addresses are dead.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff6b00] text-black font-semibold text-sm disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning mailbox…" : "Scan for replies"}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4"
          >
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-2">
              <c.icon size={12} />
              {c.label}
            </div>
            <p className={`text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)] text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Responders */}
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <FiCornerUpLeft size={14} className="text-emerald-400" />
              <h4 className="text-[var(--text-primary)] font-semibold text-sm">
                Responding contacts ({stats?.topResponders.length ?? 0})
              </h4>
            </div>
            {stats?.topResponders.length ? (
              <ul className="divide-y divide-[var(--border)] max-h-[420px] overflow-y-auto">
                {stats.topResponders.map((r) => (
                  <li key={r.email} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[var(--text-primary)] text-sm font-medium truncate">
                        {r.name || r.email}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs truncate">{r.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-emerald-400 text-sm font-semibold tabular-nums">
                        {r.replies} {r.replies === 1 ? "reply" : "replies"}
                      </p>
                      {r.lastRepliedAt && (
                        <p className="text-[var(--text-muted)] text-xs">{timeAgo(r.lastRepliedAt)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-[var(--text-muted)] text-sm">
                No replies recorded yet. Send a bulk campaign, then hit “Scan for replies”.
              </p>
            )}
          </div>

          {/* Dead addresses */}
          <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FiAlertTriangle size={14} className="text-red-400" />
                <h4 className="text-[var(--text-primary)] font-semibold text-sm">
                  Dead addresses ({stats?.deadAddresses.length ?? 0})
                </h4>
              </div>
              {!!stats?.deadAddresses.length && (
                <button
                  onClick={pruneDead}
                  disabled={pruning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50"
                >
                  <FiSlash size={12} />
                  {pruning ? "Excluding…" : "Exclude all from bulk"}
                </button>
              )}
            </div>
            {stats?.deadAddresses.length ? (
              <>
                <ul className="divide-y divide-[var(--border)] max-h-[380px] overflow-y-auto">
                  {stats.deadAddresses.map((d) => (
                    <li key={d.email} className="px-4 py-3">
                      <p className="text-[var(--text-primary)] text-sm font-medium truncate">
                        {d.name || d.email}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs truncate">{d.email}</p>
                      {d.reason && (
                        <p className="text-red-400/80 text-xs mt-1 truncate">{d.reason}</p>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="px-4 py-3 text-[var(--text-muted)] text-xs border-t border-[var(--border)] flex items-center gap-1.5">
                  <FiTrash2 size={11} />
                  Excluding only sets “excluded from bulk” — contacts are never deleted, so it’s reversible.
                </p>
              </>
            ) : (
              <p className="px-4 py-6 text-[var(--text-muted)] text-sm">
                No bounced addresses detected. Everything you’ve emailed is still deliverable.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
