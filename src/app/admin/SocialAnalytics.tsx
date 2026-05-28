"use client";

import { useEffect, useState } from "react";
import {
  FiBarChart2,
  FiRefreshCw,
  FiExternalLink,
  FiAlertTriangle,
  FiEye,
  FiHeart,
  FiMessageCircle,
  FiShare2,
  FiMousePointer,
} from "react-icons/fi";
import { FaXTwitter, FaLinkedinIn, FaInstagram } from "react-icons/fa6";

type Metrics = {
  reach?: number;
  impressions?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reactions?: number;
  replies?: number;
  retweets?: number;
  saves?: number;
  videoViews?: number;
  engagementRate?: number;
  postCount?: number;
};

type SentPost = {
  id: string;
  text: string;
  sentAt?: string | null;
  serviceLink?: string | null;
  channel: { id: string; name: string; service: string } | null;
  metrics: Metrics;
};

type ChannelBucket = {
  channel: { id: string; name: string; service: string; avatar?: string };
  posts: SentPost[];
  summary: Metrics;
  error?: string;
};

type Payload = {
  channels: ChannelBucket[];
  totals: Metrics;
};

function serviceIcon(service: string) {
  const s = service.toLowerCase();
  if (s === "linkedin") return FaLinkedinIn;
  if (s === "twitter" || s === "x") return FaXTwitter;
  if (s === "instagram") return FaInstagram;
  return FiBarChart2;
}

function serviceColor(service: string): string {
  const s = service.toLowerCase();
  if (s === "linkedin") return "#0a66c2";
  if (s === "twitter" || s === "x") return "#ffffff";
  if (s === "instagram") return "#e1306c";
  return "#888";
}

function fmt(n: number | undefined) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Pick the metrics worth showing for a given service. */
function metricRowsFor(service: string, m: Metrics) {
  const rows: { label: string; value: number | undefined; icon: typeof FiEye }[] = [];
  const s = service.toLowerCase();
  if (s === "linkedin") {
    rows.push({ label: "Impressions", value: m.impressions, icon: FiEye });
    rows.push({ label: "Reactions", value: m.reactions ?? m.likes, icon: FiHeart });
    rows.push({ label: "Comments", value: m.comments, icon: FiMessageCircle });
    rows.push({ label: "Shares", value: m.shares, icon: FiShare2 });
    rows.push({ label: "Clicks", value: m.clicks, icon: FiMousePointer });
  } else if (s === "twitter" || s === "x") {
    rows.push({ label: "Impressions", value: m.impressions, icon: FiEye });
    rows.push({ label: "Likes", value: m.likes, icon: FiHeart });
    rows.push({ label: "Replies", value: m.replies ?? m.comments, icon: FiMessageCircle });
    rows.push({ label: "Retweets", value: m.retweets ?? m.shares, icon: FiShare2 });
    rows.push({ label: "Clicks", value: m.clicks, icon: FiMousePointer });
  } else if (s === "instagram") {
    rows.push({ label: "Impressions", value: m.impressions, icon: FiEye });
    rows.push({ label: "Reach", value: m.reach, icon: FiEye });
    rows.push({ label: "Likes", value: m.likes, icon: FiHeart });
    rows.push({ label: "Comments", value: m.comments, icon: FiMessageCircle });
    rows.push({ label: "Saves", value: m.saves, icon: FiShare2 });
  } else {
    rows.push({ label: "Impressions", value: m.impressions, icon: FiEye });
    rows.push({ label: "Likes", value: m.likes ?? m.reactions, icon: FiHeart });
    rows.push({ label: "Comments", value: m.comments ?? m.replies, icon: FiMessageCircle });
    rows.push({ label: "Shares", value: m.shares ?? m.retweets, icon: FiShare2 });
  }
  return rows;
}

export default function SocialAnalytics({
  onError,
}: {
  onError: (msg: string) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);
  const [openChannelId, setOpenChannelId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setTopLevelError(null);
    try {
      const r = await fetch("/api/admin/buffer/analytics?first=20", {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTopLevelError(j.error || "Failed to load analytics");
        onError(j.error || "Failed to load analytics");
      } else {
        setData(j as Payload);
        if (j.channels?.[0]?.channel?.id) {
          setOpenChannelId((id) => id ?? j.channels[0].channel.id);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setTopLevelError(msg);
      onError(msg);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Analytics</h2>
          <p className="text-xs text-[#666] mt-1">
            Live numbers pulled straight from Buffer for everything you've
            already posted. Click a channel to drill into individual posts.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-[#ff6b00]/40 hover:text-[#ff6b00] disabled:opacity-60"
        >
          <FiRefreshCw
            size={11}
            className={loading ? "animate-spin" : undefined}
          />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {topLevelError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/90 flex items-start gap-2">
          <FiAlertTriangle className="mt-0.5 shrink-0" size={12} />
          <div>
            <strong className="font-semibold">Buffer analytics returned an error:</strong>{" "}
            <code className="break-all">{topLevelError}</code>
            <p className="mt-2 text-amber-300/70">
              Buffer's GraphQL schema may have moved the analytics fields. The
              query we send is in <code>src/lib/buffer.ts</code> →{" "}
              <code>getSentPostsForChannel</code> — paste the error there if
              this keeps showing.
            </p>
          </div>
        </div>
      )}

      {/* Totals strip */}
      {data && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-3">
            All channels (last {data.totals.postCount ?? 0} sent posts)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <TotalCell label="Posts" value={data.totals.postCount} accent />
            <TotalCell label="Impressions" value={data.totals.impressions} />
            <TotalCell
              label="Reactions"
              value={data.totals.reactions ?? data.totals.likes}
            />
            <TotalCell label="Comments" value={data.totals.comments} />
            <TotalCell
              label="Shares"
              value={data.totals.shares ?? data.totals.retweets}
            />
            <TotalCell label="Clicks" value={data.totals.clicks} />
          </div>
        </div>
      )}

      {/* Per-channel tiles */}
      {data?.channels?.length === 0 && !loading && (
        <p className="text-xs text-[#666]">
          No connected Buffer channels yet. Connect one under Connectors →
          Buffer.
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {data?.channels?.map((b) => {
          const Icon = serviceIcon(b.channel.service);
          const color = serviceColor(b.channel.service);
          const rows = metricRowsFor(b.channel.service, b.summary);
          const open = openChannelId === b.channel.id;
          return (
            <div
              key={b.channel.id}
              className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenChannelId((id) =>
                    id === b.channel.id ? null : b.channel.id
                  )
                }
                className="w-full flex items-center justify-between mb-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: color + "22",
                      color: color === "#ffffff" ? "#fff" : color,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">
                      {b.channel.name}
                    </p>
                    <p className="text-[10px] font-mono text-[#666]">
                      {b.summary.postCount ?? 0} sent posts
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">
                  {open ? "Hide" : "Posts"}
                </span>
              </button>

              {b.error ? (
                <p className="text-[11px] text-amber-300/80 break-all">
                  {b.error}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {rows.slice(0, 6).map((r) => {
                    const RIcon = r.icon;
                    return (
                      <div
                        key={r.label}
                        className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2 text-center"
                      >
                        <RIcon size={11} className="mx-auto text-[#888] mb-1" />
                        <div className="text-sm font-bold text-white">
                          {fmt(r.value)}
                        </div>
                        <div className="text-[9px] uppercase tracking-widest text-[#666]">
                          {r.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Per-post list */}
              {open && b.posts.length > 0 && (
                <ul className="mt-2 divide-y divide-white/[0.05] border-t border-white/[0.05]">
                  {b.posts.map((p) => {
                    const postRows = metricRowsFor(
                      b.channel.service,
                      p.metrics
                    );
                    return (
                      <li key={p.id} className="py-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-white/90 leading-snug flex-1">
                            {p.text.length > 220
                              ? p.text.slice(0, 219) + "…"
                              : p.text || <em className="text-[#666]">(no text)</em>}
                          </p>
                          {p.serviceLink && (
                            <a
                              href={p.serviceLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1.5 rounded-md bg-white/[0.04] text-[#888] hover:text-white"
                              title="Open on platform"
                            >
                              <FiExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-[#888]">
                          <span>{relativeTime(p.sentAt)}</span>
                          <span className="text-[#444]">·</span>
                          {postRows.map((r) => (
                            <span key={r.label} className="flex items-center gap-1">
                              <span className="text-[#666]">{r.label}</span>
                              <span className="text-white/90">{fmt(r.value)}</span>
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TotalCell({
  label,
  value,
  accent,
}: {
  label: string;
  value?: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-3 text-center border ${
        accent
          ? "border-[#ff6b00]/30 bg-[#ff6b00]/[0.06]"
          : "border-white/[0.05] bg-white/[0.03]"
      }`}
    >
      <div className={`text-xl font-black ${accent ? "text-[#ffaa66]" : "text-white"}`}>
        {fmt(value)}
      </div>
      <div className="text-[9px] uppercase tracking-widest text-[#666] mt-1">
        {label}
      </div>
    </div>
  );
}
