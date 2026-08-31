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
  metricsAvailable: boolean;
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
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [playbookMeta, setPlaybookMeta] = useState<{ posts: number; metrics: boolean } | null>(null);
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
      else {
        setPlaybook(j.playbook ?? null);
        setPlaybookMeta({ posts: j.postsAnalyzed ?? 0, metrics: Boolean(j.metricsAvailable) });
        if (j.saveError) setErr(j.saveError);
      }
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

      {data && !data.metricsAvailable && data.totalPosts > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-600 leading-relaxed">
          <strong className="font-semibold">Impression &amp; engagement numbers aren&apos;t available from Buffer for this account</strong>{" "}
          — so the tiles below show &ldquo;—&rdquo;/0, which means <em>unknown</em>, not zero. Buffer only returns per-post
          analytics on its paid <strong>Analyze</strong> plan (or once each network&apos;s native insights are connected).
          The <strong>content breakdown</strong> (cadence, length, hashtags, links, emoji) and the AI content review are
          fully accurate — they come from your posts themselves.
        </div>
      )}

      {data && (
        <>
          {/* Per-platform summary tiles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {data.platforms.map((p) => {
              const meta = PLAT[p.service];
              const Icon = meta.icon;
              const totalImp = p.metrics.impressions ?? p.metrics.reach ?? 0;
              const avgReach = p.postCount ? Math.round(totalImp / p.postCount) : 0;
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
                    <Stat label="Impress." value={fmt(totalImp)} icon={<FiEye size={11} />} />
                    <Stat label="Engage" value={fmt(p.engagement)} icon={<FiHeart size={11} />} />
                    <Stat label="Reach/post" value={fmt(avgReach)} />
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
                {analyzing ? "Analyzing…" : playbook ? "Re-analyze" : "Analyze my content"}
              </button>
            </div>
            {playbook ? (
              <PlaybookView playbook={playbook} meta={playbookMeta} />
            ) : (
              <p className="text-[11px] text-[var(--admin-text-muted)]">
                Reviews what you have posted and works out which hooks and themes actually reached
                people. The result is saved and used when writing your next post.
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
                  Top {PLAT[p.service].label} posts by reach
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
            Impressions and engagement are <strong>cumulative lifetime totals per post</strong> (not per day or week),
            summed across all posts. They come straight from Buffer and depend on your plan and what each network
            exposes — some counts may show as “—”. Pulled live from your connected Buffer account.
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

type PlatformFinding = {
  platform: string;
  posts: number;
  avgImpressions: number | null;
  winningPattern: string;
  bestHook: string | null;
  bestImpressions: number | null;
  losingPattern: string | null;
  verdict: string;
};

type Playbook = {
  headline: string;
  platforms: PlatformFinding[];
  doMore: string[];
  doLess: string[];
  winningThemes: string[];
  biggestLever: string | null;
};

/**
 * The analysis as components rather than prose.
 *
 * It used to be markdown, and the model reached for tables — which this app's
 * minimal renderer does not support, so they arrived as raw pipes. Rendering
 * fields directly means the layout is the app's job and the model only has to
 * be right about the content.
 */
function PlaybookView({
  playbook,
  meta,
}: {
  playbook: Playbook;
  meta: { posts: number; metrics: boolean } | null;
}) {
  const active = playbook.platforms.filter((p) => p.posts > 0);

  return (
    <div className="space-y-3">
      {playbook.headline && (
        <p className="text-sm text-[var(--admin-text)] leading-relaxed font-medium">
          {playbook.headline}
        </p>
      )}

      {meta && (
        <p className="text-[10px] text-[var(--admin-text-muted)]">
          {meta.posts} post{meta.posts === 1 ? "" : "s"} analysed
          {meta.metrics ? " with reach data" : " — no reach data, so these are hypotheses"}
          {meta.posts < 10 && meta.metrics ? " · small sample, treat as directional" : ""}
        </p>
      )}

      {active.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {active.map((f) => (
            <div
              key={f.platform}
              className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--admin-text)]">
                  {f.platform}
                </span>
                <span className="text-[10px] text-[var(--admin-text-muted)] tabular-nums">
                  {f.posts} posts
                  {f.avgImpressions !== null ? ` · ${f.avgImpressions} avg` : ""}
                </span>
              </div>
              {f.winningPattern && (
                <p className="text-[11px] text-[var(--admin-text)] leading-relaxed mt-1.5">
                  {f.winningPattern}
                </p>
              )}
              {f.bestHook && (
                <p className="text-[11px] text-emerald-500 leading-relaxed mt-1.5 border-l-2 border-emerald-500/40 pl-2">
                  &ldquo;{f.bestHook}&rdquo;
                  {f.bestImpressions !== null && (
                    <span className="text-[var(--admin-text-muted)]"> — {f.bestImpressions} impressions</span>
                  )}
                </p>
              )}
              {f.losingPattern && (
                <p className="text-[10px] text-amber-500 leading-relaxed mt-1.5">Avoid: {f.losingPattern}</p>
              )}
              {f.verdict && (
                <p className="text-[10px] text-[var(--admin-text-muted)] leading-relaxed mt-1.5">{f.verdict}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {playbook.winningThemes.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-1.5">
            Themes that reached people
          </p>
          <div className="flex flex-wrap gap-1.5">
            {playbook.winningThemes.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {playbook.doMore.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1.5">
              Do more
            </p>
            <ul className="space-y-1">
              {playbook.doMore.map((d) => (
                <li key={d} className="text-[11px] text-[var(--admin-text)] leading-relaxed flex gap-1.5">
                  <span className="text-emerald-500 shrink-0">+</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
        {playbook.doLess.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1.5">
              Do less
            </p>
            <ul className="space-y-1">
              {playbook.doLess.map((d) => (
                <li key={d} className="text-[11px] text-[var(--admin-text)] leading-relaxed flex gap-1.5">
                  <span className="text-amber-500 shrink-0">–</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {playbook.biggestLever && (
        <div className="rounded-xl border border-[#ff6b00]/40 bg-[#ff6b00]/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#ff6b00] mb-1">
            Biggest lever
          </p>
          <p className="text-[11px] text-[var(--admin-text)] leading-relaxed">{playbook.biggestLever}</p>
        </div>
      )}

      <p className="text-[10px] text-[var(--admin-text-muted)] leading-relaxed">
        Saved and applied automatically when Autopilot and the Composer write your next post.
      </p>
    </div>
  );
}

