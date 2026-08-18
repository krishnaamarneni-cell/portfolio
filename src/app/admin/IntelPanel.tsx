"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiX,
  FiRefreshCw,
  FiActivity,
  FiTrendingUp,
  FiMapPin,
  FiAlertTriangle,
  FiTarget,
} from "react-icons/fi";

type Bucket = { name: string; count: number };

type Intel = {
  totals: {
    tracked: number;
    active: number;
    newToday: number;
    newThisWeek: number;
    scored: number;
    avgScore: number | null;
    strong: number;
    good: number;
    minScore: number;
  };
  hiring: Bucket[];
  skills: Bucket[];
  gaps: Bucket[];
  regions: Bucket[];
  platforms: Bucket[];
};

/** Horizontal bars scaled to the largest value in their own group. */
function BarList({
  title,
  icon: Icon,
  items,
  empty,
  tone = "#ff6b00",
  hint,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: Bucket[];
  empty: string;
  tone?: string;
  hint?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] flex items-center gap-1.5 mb-1">
        <Icon size={11} />
        {title}
      </p>
      {hint && <p className="text-[10px] text-[var(--admin-text-muted)] mb-2">{hint}</p>}
      {!items.length ? (
        <p className="text-xs text-[var(--admin-text-muted)]">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.name} className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--admin-text)] truncate flex-1 min-w-0">{i.name}</span>
              <div className="w-24 h-1.5 rounded-full bg-[var(--admin-bg)] overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(i.count / max) * 100}%`, backgroundColor: tone }}
                />
              </div>
              <span className="text-[10px] text-[var(--admin-text-muted)] tabular-nums w-6 text-right shrink-0">
                {i.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntelPanel({ onClose }: { onClose: () => void }) {
  const [intel, setIntel] = useState<Intel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-finder/intel");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setError(null);
      setIntel(data);
    } catch {
      setError("Could not load market signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes, matching every other overlay in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const t = intel?.totals;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Market intel">
      <button
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close market intel"
      />

      <div className="relative w-full max-w-md bg-[var(--admin-surface)] border-l border-[var(--admin-border)] shadow-2xl flex flex-col">
        <div className="p-4 border-b border-[var(--admin-border)] bg-gradient-to-br from-[#ff6b00] to-[#ff8c38]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-white text-base flex items-center gap-2">
                <FiActivity size={16} />
                Market Intel
              </h2>
              <p className="text-[11px] text-white/80 mt-0.5">
                From the postings you have collected — not headlines
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={load}
                disabled={loading}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-50"
                aria-label="Refresh"
              >
                <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          {t && (
            <div className="flex flex-wrap gap-3 mt-3 text-white">
              <span className="text-[11px]">
                <span className="font-bold tabular-nums">{t.newToday}</span> today
              </span>
              <span className="text-[11px]">
                <span className="font-bold tabular-nums">{t.newThisWeek}</span> this week
              </span>
              <span className="text-[11px]">
                <span className="font-bold tabular-nums">{t.active}</span> active
              </span>
              <span className="text-[11px]">
                <span className="font-bold tabular-nums">{t.strong + t.good}</span> worth applying
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
              <FiAlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--admin-text)]">{error}</p>
            </div>
          )}

          {loading && !intel && (
            <p className="text-xs text-[var(--admin-text-muted)] text-center py-6">Reading the market…</p>
          )}

          {intel && t && (
            <>
              {t.scored > 0 && (
                <div className="bg-[var(--admin-bg)] rounded-xl border border-[var(--admin-border)] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
                    How you fit this market
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-[var(--admin-text)] tabular-nums">
                      {t.avgScore ?? "–"}
                    </span>
                    <span className="text-[11px] text-[var(--admin-text-muted)]">
                      average match across {t.scored} scored role{t.scored === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--admin-text-muted)] mt-2 leading-relaxed">
                    <span className="text-emerald-500 font-semibold">{t.strong} strong</span> ·{" "}
                    <span className="text-sky-500 font-semibold">{t.good} good</span> · rest below your{" "}
                    {t.minScore} threshold.
                  </p>
                </div>
              )}

              <BarList
                title="Who is hiring"
                icon={FiTrendingUp}
                items={intel.hiring}
                empty="No active postings yet."
                hint="Open roles matching your keywords, by employer"
              />

              <BarList
                title="Skills in demand"
                icon={FiTarget}
                items={intel.skills}
                empty="Skills appear once roles are scored."
                hint="Named across the postings you are tracking"
              />

              <BarList
                title="Your gaps"
                icon={FiAlertTriangle}
                items={intel.gaps}
                tone="#f59e0b"
                empty="No recurring gaps — or nothing scored yet."
                hint="Missing from roles that were otherwise a fit — worth closing first"
              />

              <BarList
                title="Where the roles are"
                icon={FiMapPin}
                items={intel.regions}
                empty="No locations recorded yet."
              />

              <BarList
                title="Sources producing"
                icon={FiActivity}
                items={intel.platforms}
                empty="No sources have produced yet."
              />

              <p className="text-[10px] text-[var(--admin-text-muted)] leading-relaxed pt-1">
                Counts come from {t.tracked} postings collected so far, so they describe the slice of the
                market your keywords reach — not the whole market.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
