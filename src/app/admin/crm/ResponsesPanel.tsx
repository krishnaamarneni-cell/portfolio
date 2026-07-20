"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FiRefreshCw,
  FiMail,
  FiCornerUpLeft,
  FiAlertTriangle,
  FiClock,
  FiSlash,
  FiSearch,
} from "react-icons/fi";
import { timeAgo } from "./types";

type Props = {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
};

type RecipientStatus = "replied" | "awaiting" | "bounced";

type Recipient = {
  email: string;
  name: string | null;
  status: RecipientStatus;
  replies: number;
  lastRepliedAt: string | null;
  bounceReason: string | null;
  contactId: string | null;
  lastSentAt: string | null;
};

type Stats = {
  totalSent: number;
  replied: number;
  replyRate: number;
  bounced: number;
  awaiting: number;
  recipients: Recipient[];
  error?: string;
};

/** Which segment the detail list is showing. "all" = every recipient. */
type Segment = "all" | RecipientStatus;

export default function ResponsesPanel({ onSuccess, onError }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");

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
      if (j.error) {
        onError(j.error);
      } else {
        onSuccess(
          `Checked ${j.checked} — ${j.newReplies} new ${j.newReplies === 1 ? "reply" : "replies"}, ${j.newBounces} dead ${j.newBounces === 1 ? "address" : "addresses"}.`
        );
      }
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const pruneDead = async () => {
    if (!stats?.bounced) return;
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

  const CARDS: Array<{
    seg: Segment;
    label: string;
    hint: string;
    value: number | string;
    icon: React.ComponentType<{ size?: number }>;
    tone: string;
    ring: string;
  }> = [
    {
      seg: "all",
      label: "Emails sent",
      hint: "everyone you emailed",
      value: stats?.totalSent ?? 0,
      icon: FiMail,
      tone: "text-[var(--text-primary)]",
      ring: "border-[var(--text-primary)]/40",
    },
    {
      seg: "replied",
      label: "Responded",
      hint: "wrote back",
      value: stats?.replied ?? 0,
      icon: FiCornerUpLeft,
      tone: "text-emerald-400",
      ring: "border-emerald-400/50",
    },
    {
      seg: "awaiting",
      label: "No response",
      hint: "delivered, silent",
      value: stats?.awaiting ?? 0,
      icon: FiClock,
      tone: "text-amber-400",
      ring: "border-amber-400/50",
    },
    {
      seg: "bounced",
      label: "Doesn't exist",
      hint: "dead address",
      value: stats?.bounced ?? 0,
      icon: FiAlertTriangle,
      tone: "text-red-400",
      ring: "border-red-400/50",
    },
  ];

  const rows = useMemo(() => {
    const all = stats?.recipients ?? [];
    const bySeg = segment === "all" ? all : all.filter((r) => r.status === segment);
    const q = query.trim().toLowerCase();
    if (!q) return bySeg;
    return bySeg.filter(
      (r) => r.email.includes(q) || (r.name ?? "").toLowerCase().includes(q)
    );
  }, [stats, segment, query]);

  const activeCard = CARDS.find((c) => c.seg === segment);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[var(--text-primary)] font-semibold text-lg">Email responses</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Click any number to see exactly which emails are in it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!!stats?.bounced && (
            <button
              onClick={pruneDead}
              disabled={pruning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50"
            >
              <FiSlash size={13} />
              {pruning ? "Excluding…" : `Exclude ${stats.bounced} dead`}
            </button>
          )}
          <button
            onClick={scan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff6b00] text-black font-semibold text-sm disabled:opacity-50"
          >
            <FiRefreshCw size={14} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scanning mailbox…" : "Scan for replies"}
          </button>
        </div>
      </div>

      {/* Setup / connectivity problems surface here rather than as silent zeros */}
      {stats?.error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
          <FiAlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-200 text-sm">{stats.error}</p>
        </div>
      )}

      {/* Clickable stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map((c) => {
          const active = segment === c.seg;
          return (
            <button
              key={c.seg}
              onClick={() => setSegment(c.seg)}
              aria-pressed={active}
              className={`text-left rounded-xl bg-[var(--bg-card)] border p-4 transition-all hover:border-[#ff6b00]/40 ${
                active ? `${c.ring} ring-1 ring-inset ring-white/5` : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-2">
                <c.icon size={12} />
                {c.label}
              </div>
              <p className={`text-3xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
              <p className="text-[var(--text-muted)] text-[11px] mt-1">{c.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Reply-rate strip */}
      <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3 flex items-center gap-4">
        <span className="text-[var(--text-muted)] text-xs shrink-0">Reply rate</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff6b00] to-emerald-400"
            style={{ width: `${Math.min(100, stats?.replyRate ?? 0)}%` }}
          />
        </div>
        <span className="text-emerald-400 font-semibold text-sm tabular-nums shrink-0">
          {stats?.replyRate ?? 0}%
        </span>
      </div>

      {/* Drill-down list */}
      <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
          <h4 className="text-[var(--text-primary)] font-semibold text-sm flex items-center gap-2">
            {activeCard && <activeCard.icon size={14} />}
            {activeCard?.label} ({rows.length})
          </h4>
          <div className="relative">
            <FiSearch
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by email or name…"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-xs w-56 outline-none focus:border-[#ff6b00]/40"
            />
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-[var(--text-muted)] text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-[var(--text-muted)] text-sm">
            {stats?.totalSent
              ? "Nothing in this bucket."
              : "No bulk emails tracked yet. Send a campaign, then hit “Scan for replies”."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] max-h-[520px] overflow-y-auto">
            {rows.map((r) => (
              <li key={r.email} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)] text-sm font-medium truncate">
                    {r.name || r.email}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs truncate">{r.email}</p>
                  {r.status === "bounced" && r.bounceReason && (
                    <p className="text-red-400/80 text-xs mt-0.5 truncate">{r.bounceReason}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {r.status === "replied" && (
                    <>
                      <p className="text-emerald-400 text-sm font-semibold tabular-nums">
                        {r.replies} {r.replies === 1 ? "reply" : "replies"}
                      </p>
                      {r.lastRepliedAt && (
                        <p className="text-[var(--text-muted)] text-xs">{timeAgo(r.lastRepliedAt)}</p>
                      )}
                    </>
                  )}
                  {r.status === "awaiting" && (
                    <>
                      <p className="text-amber-400 text-xs font-medium">No reply</p>
                      {r.lastSentAt && (
                        <p className="text-[var(--text-muted)] text-xs">sent {timeAgo(r.lastSentAt)}</p>
                      )}
                    </>
                  )}
                  {r.status === "bounced" && (
                    <p className="text-red-400 text-xs font-medium">Doesn&apos;t exist</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {segment === "bounced" && rows.length > 0 && (
          <p className="px-4 py-3 text-[var(--text-muted)] text-xs border-t border-[var(--border)]">
            Excluding sets “excluded from bulk” — contacts are never deleted, so it&apos;s reversible.
          </p>
        )}
      </div>
    </div>
  );
}
