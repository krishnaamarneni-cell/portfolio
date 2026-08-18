"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiSearch, FiRefreshCw, FiZap, FiInbox, FiAlertTriangle, FiDownloadCloud } from "react-icons/fi";
import JobCard from "./JobCard";
import ApplicationPacket from "./ApplicationPacket";
import type { Listing, Stats } from "./types";

type Props = {
  /** "active" for the discovery feed, "saved"/"applied"/"ignored" for the tracker views. */
  scope: string;
  emptyTitle: string;
  emptyHint: string;
  onSuccess: (m: string) => void;
  onError: (m: string) => void;
  onStats?: (s: Stats) => void;
  /** Show the "Score with AI" button — only useful on the discovery feed. */
  showScoring?: boolean;
};

/** Must match the batch size in /api/admin/job-finder/match. */
const SCORE_BATCH = 10;

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "match", label: "Best match" },
  { id: "company", label: "Company" },
];

export default function JobFeed({
  scope,
  emptyTitle,
  emptyHint,
  onSuccess,
  onError,
  onStats,
  showScoring,
}: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [finding, setFinding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [packet, setPacket] = useState<Listing | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("newest");
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // The parent passes fresh closures every render; keeping them in refs stops
  // `load` from changing identity and re-firing its effect in a loop.
  const cb = useRef({ onSuccess, onError, onStats });
  cb.current = { onSuccess, onError, onStats };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: scope, sort, limit: "60" });
      if (debounced) params.set("search", debounced);
      if (minScore > 0) params.set("min_score", String(minScore));

      const res = await fetch(`/api/admin/job-finder?${params}`);
      const data = await res.json();

      if (data.needsMigration) {
        setNeedsMigration(true);
        setListings([]);
        return;
      }
      if (data.error) {
        cb.current.onError(data.error);
        return;
      }
      setNeedsMigration(false);
      setListings(data.listings ?? []);
      setTotal(data.total ?? 0);
      if (data.stats) cb.current.onStats?.(data.stats);
    } catch {
      cb.current.onError("Could not load job listings.");
    } finally {
      setLoading(false);
    }
  }, [scope, sort, debounced, minScore]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    // Optimistic: the row leaves this view immediately.
    const previous = listings;
    setListings((rows) => rows.filter((r) => r.id !== id));
    try {
      const res = await fetch("/api/admin/job-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status }),
      });
      const data = await res.json();
      if (data.error) {
        setListings(previous);
        onError(data.error);
        return;
      }
      onSuccess(status === "applied" ? "Marked as applied." : `Moved to ${status}.`);
      load();
    } catch {
      setListings(previous);
      onError("Update failed.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const previous = listings;
    setListings((rows) => rows.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/admin/job-finder?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        setListings(previous);
        onError(data.error);
        return;
      }
      onSuccess("Listing deleted.");
    } catch {
      setListings(previous);
      onError("Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  const findJobs = async () => {
    setFinding(true);
    try {
      const res = await fetch("/api/admin/job-finder/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      if (!data.found) {
        onError(`No live postings came back for ${data.searched?.join(", ") ?? "your keywords"}. Try broader keywords in Settings.`);
        return;
      }
      onSuccess(
        data.added
          ? `Found ${data.found} postings — ${data.added} new.`
          : `Found ${data.found} postings, all already here.`
      );
      load();
      if (data.errors?.length) onError(`Some sources failed: ${data.errors[0]}`);
    } catch {
      onError("Job search failed.");
    } finally {
      setFinding(false);
    }
  };

  const scoreAll = async () => {
    setScoring(true);
    try {
      const res = await fetch("/api/admin/job-finder/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      if (!data.scored) {
        onSuccess(data.message ?? "Everything is already scored.");
      } else {
        onSuccess(`Scored ${data.scored} listing${data.scored === 1 ? "" : "s"}.`);
        load();
      }
      if (data.failures?.length) onError(`Some failed: ${data.failures[0]}`);
    } catch {
      onError("Scoring failed.");
    } finally {
      setScoring(false);
    }
  };

  const unscored = useMemo(() => listings.filter((l) => l.match_score === null).length, [listings]);

  if (needsMigration) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex gap-3">
        <FiAlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[var(--admin-text)] text-sm">Database migration needed</p>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed">
            Run <code className="px-1 py-0.5 rounded bg-[var(--admin-bg)]">supabase/job_finder.sql</code> in the
            Supabase SQL editor to create the <code>job_listings</code> and <code>job_sources</code> tables.
            Nothing else in the admin is affected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, company, description…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00]"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] focus:outline-none focus:border-[#ff6b00]"
        >
          {/* Score filters compare against match_score, so they necessarily
              hide unscored listings. Say so — silently dropping them looked
              like discovery had found almost nothing. */}
          <option value={0}>Any score</option>
          <option value={50}>50+ (scored only)</option>
          <option value={70}>70+ (scored only)</option>
          <option value={85}>85+ (scored only)</option>
        </select>

        {showScoring && (
          <button
            onClick={findJobs}
            disabled={finding}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] transition-colors disabled:opacity-50"
            title="Fetch live postings from Workday career sites using your saved keywords"
          >
            <FiDownloadCloud size={13} className={finding ? "animate-pulse" : ""} />
            {finding ? "Searching…" : "Find jobs"}
          </button>
        )}

        {showScoring && (
          <button
            onClick={scoreAll}
            disabled={scoring}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text)] text-sm font-semibold hover:border-[#ff6b00] transition-colors disabled:opacity-50"
            title="Score unscored listings against your profile"
          >
            <FiZap size={13} className={scoring ? "animate-pulse" : ""} />
            {/* The route scores SCORE_BATCH at a time; promising the full
                unscored count made one click look like it had failed. */}
            {scoring
              ? "Scoring…"
              : unscored
                ? `Score ${Math.min(unscored, SCORE_BATCH)}${unscored > SCORE_BATCH ? ` of ${unscored}` : ""}`
                : "Score with AI"}
          </button>
        )}

        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && !listings.length ? (
        <p className="text-sm text-[var(--admin-text-muted)] py-8 text-center">Loading…</p>
      ) : !listings.length ? (
        <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-10 text-center">
          <FiInbox size={28} className="mx-auto text-[var(--admin-text-muted)] mb-3" />
          <p className="font-semibold text-[var(--admin-text)] text-sm">{emptyTitle}</p>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1.5 max-w-md mx-auto leading-relaxed">
            {emptyHint}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--admin-text-muted)]">
            {listings.length} of {total} shown
          </p>
          <div className="space-y-3">
            {listings.map((l) => (
              <JobCard
                key={l.id}
                listing={l}
                busy={busyId === l.id}
                onStatus={setStatus}
                onDelete={remove}
                onPrepare={setPacket}
              />
            ))}
          </div>
        </>
      )}

      {packet && (
        <ApplicationPacket
          listing={packet}
          onClose={() => setPacket(null)}
          onApplied={(id) => setListings((rows) => rows.filter((r) => r.id !== id))}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}
