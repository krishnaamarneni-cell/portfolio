"use client";

import { useEffect, useState } from "react";
import {
  FiBarChart2,
  FiRefreshCw,
  FiZap,
  FiExternalLink,
  FiHeart,
  FiEye,
} from "react-icons/fi";
import { FaXTwitter, FaLinkedinIn, FaInstagram } from "react-icons/fa6";

type Metrics = {
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reactions?: number;
  replies?: number;
  retweets?: number;
  saves?: number;
  videoViews?: number;
  postCount?: number;
};
type PostRow = {
  id: string;
  text: string;
  sentAt?: string | null;
  serviceLink?: string | null;
  engagement: number;
  metrics: Metrics;
};
type ContentStats = {
  avgChars: number;
  avgHashtags: number;
  pctWithLink: number;
  pctWithEmoji: number;
  postsPerWeek: number;
};
type Platform = {
  service: "linkedin" | "x" | "instagram";
  channelName: string | null;
  postCount: number;
  metrics: Metrics;
  engagement: number;
  content: ContentStats;
  posts: PostRow[];
};
type Analytics = {
  ok: true;
  totalPosts: number;
  platforms: Platform[];
  overall: { metrics: Metrics; engagement: number };
};

const PLAT: Record<
  Platform["service"],
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
> = {
  linkedin: { label: "LinkedIn", icon: FaLinkedinIn, color: "#0a66c2" },
  x: { label: "X", icon: FaXTwitter, color: "var(--admin-text)" },
  instagram: { label: "Instagram", icon: FaInstagram, color: "#e1306c" },
};

function fmt(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

export default function SocialAnalytics({
  onError,
}: {
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/social/analytics");
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Could not load analytics");
        setData(null);
      } else {
        setData(j);
      }
    } catch {
      setErr("Network error");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function analyze() {
    setAnalyzing(true);
    try {
      const r = await fetch("/api/admin/social/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) onError(j.error || "Analysis failed");
      else setAnalysis(j.markdown || "");
    } catch {
      onError("Network error");
    }
    setAnalyzing(false);
  }

  const maxEng = data ? Math.max(1, ...data.platforms.map((p) => p.engagement)) : 1;

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0">
            <FiBarChart2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--admin-text)]">Social Analytics</h2>
            <p className="text-[11px] text-[var(--admin-text-secondary)] max-w-md">
              What you&apos;ve posted across LinkedIn, X, and Instagram — and how it landed.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-secondary)] hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
        >
          <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-600">
          {err}
        </div>
      )}

      {loading && !data && (
        <p className="text-[12px] text-[var(--admin-text-muted)] py-6 text-center">Loading your posting history…</p>
      )}

      {data && (
        <>
          {/* Per-platform summary tiles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {data.platforms.map((p) => {
              const meta = PLAT[p.service];
              const Icon = meta.icon;
              const avgEng = p.postCount ? Math.round(p.engagement / p.postCount) : 0;
              return (
                <div
                  key={p.service}
                  className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon size={15} className="shrink-0" />
                    <span className="font-semibold text-sm text-[var(--admin-text)]">{meta.label}</span>
                    <span className="ml-auto text-[10px] font-mono text-[var(--admin-text-muted)]">
                      {p.postCount} posts
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Impress." value={fmt(p.metrics.impressions ?? p.metrics.reach)} icon={<FiEye size={11} />} />
                    <Stat label="Engage" value={fmt(p.engagement)} icon={<FiHeart size={11} />} />
                    <Stat label="Avg/post" value={fmt(avgEng)} />
                  </div>
                  {/* engagement bar vs the top platform */}
                  <div className="h-1.5 rounded-full bg-[var(--admin-input-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.round((p.engagement / maxEng) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Content mix */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
              Content mix
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--admin-text-muted)] text-[10px] uppercase tracking-widest text-left">
                    <th className="py-1.5 pr-3 font-medium">Platform</th>
                    <th className="py-1.5 px-3 font-medium">Cadence</th>
                    <th className="py-1.5 px-3 font-medium">Avg length</th>
                    <th className="py-1.5 px-3 font-medium">Hashtags</th>
                    <th className="py-1.5 px-3 font-medium">Links</th>
                    <th className="py-1.5 px-3 font-medium">Emoji</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--admin-text)]">
                  {data.platforms.map((p) => (
                    <tr key={p.service} className="border-t border-[var(--admin-border)]">
                      <td className="py-2 pr-3 font-medium">{PLAT[p.service].label}</td>
                      <td className="py-2 px-3 tabular-nums">{p.content.postsPerWeek || 0}/wk</td>
                      <td className="py-2 px-3 tabular-nums">{p.content.avgChars} chars</td>
                      <td className="py-2 px-3 tabular-nums">{p.content.avgHashtags}/post</td>
                      <td className="py-2 px-3 tabular-nums">{p.content.pctWithLink}%</td>
                      <td className="py-2 px-3 tabular-nums">{p.content.pctWithEmoji}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI analysis */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
                What am I posting?
              </span>
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing || data.totalPosts === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                <FiZap size={12} />
                {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze my content"}
              </button>
            </div>
            {analysis ? (
              <Markdown text={analysis} />
            ) : (
              <p className="text-[11px] text-[var(--admin-text-muted)]">
                Run an AI review of your themes, tone, format patterns, and what&apos;s working per platform.
              </p>
            )}
          </div>

          {/* Top posts per platform */}
          {data.platforms
            .filter((p) => p.posts.length > 0)
            .map((p) => (
              <div
                key={p.service}
                className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--admin-text-secondary)]">
                  Top {PLAT[p.service].label} posts by engagement
                </span>
                <div className="space-y-2">
                  {p.posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-input-bg)] p-3 flex gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--admin-text)] leading-relaxed line-clamp-3 whitespace-pre-wrap">
                          {post.text || "(no text)"}
                        </p>
                        {post.sentAt && (
                          <p className="text-[10px] text-[var(--admin-text-muted)] mt-1">
                            {new Date(post.sentAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1 text-[10px] font-mono text-[var(--admin-text-secondary)]">
                        <span className="inline-flex items-center gap-1">
                          <FiHeart size={10} /> {fmt(post.engagement)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FiEye size={10} /> {fmt(post.metrics.impressions ?? post.metrics.reach)}
                        </span>
                        {post.serviceLink && (
                          <a
                            href={post.serviceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:underline inline-flex items-center gap-1"
                          >
                            <FiExternalLink size={10} /> open
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          <p className="text-[10px] text-[var(--admin-text-muted)] leading-relaxed">
            Metrics come straight from Buffer and depend on your Buffer plan and what each network exposes — some
            counts may show as “—”. Posts are pulled live from your connected Buffer account.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--admin-input-bg)] border border-[var(--admin-border)] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-[var(--admin-text-muted)]">
        {icon}
        {label}
      </div>
      <div className="text-sm font-bold text-[var(--admin-text)] tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

/** Minimal markdown — ## / ### headings, ** bold, - bullets, [text](url) links. */
function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={out.length} className="list-disc pl-5 my-2 space-y-1 text-[13px] text-[var(--admin-text-secondary)]">
        {list.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>
    );
    list = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flush();
    if (/^##\s+/.test(line)) {
      out.push(
        <h3 key={out.length} className="text-sm font-bold text-[var(--admin-text)] mt-4 first:mt-0 mb-1.5">
          {inline(line.replace(/^##\s+/, ""))}
        </h3>
      );
    } else if (/^###\s+/.test(line)) {
      out.push(
        <h4 key={out.length} className="text-[13px] font-semibold text-[var(--admin-text)] mt-2 mb-1">
          {inline(line.replace(/^###\s+/, ""))}
        </h4>
      );
    } else if (line.trim() === "") {
      // skip
    } else {
      out.push(
        <p key={out.length} className="text-[13px] text-[var(--admin-text-secondary)] my-1.5 leading-relaxed">
          {inline(line)}
        </p>
      );
    }
  }
  flush();
  return <div>{out}</div>;
}

function inline(s: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(s.slice(i));
    const bold = /\*\*([^*]+)\*\*/.exec(s.slice(i));
    let next = s.length;
    let kind: "link" | "bold" | null = null;
    if (link && link.index < next) {
      next = link.index;
      kind = "link";
    }
    if (bold && bold.index < next) {
      next = bold.index;
      kind = "bold";
    }
    if (next > 0) nodes.push(s.slice(i, i + next));
    if (kind === "link" && link) {
      nodes.push(
        <a key={key++} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
          {link[1]}
        </a>
      );
      i += next + link[0].length;
    } else if (kind === "bold" && bold) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[var(--admin-text)]">
          {bold[1]}
        </strong>
      );
      i += next + bold[0].length;
    } else {
      i = s.length;
    }
  }
  return <>{nodes}</>;
}
