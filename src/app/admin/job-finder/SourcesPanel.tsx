"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiPlus,
  FiTrash2,
  FiExternalLink,
  FiRefreshCw,
  FiGlobe,
  FiAlertTriangle,
  FiSearch,
  FiInfo,
} from "react-icons/fi";
import type { DirectoryEntry, Source } from "./types";
import { relativeDate } from "./types";

type Props = { onSuccess: (m: string) => void; onError: (m: string) => void };

export default function SourcesPanel({ onSuccess, onError }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirSearch, setDirSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [liveTenants, setLiveTenants] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const cb = useRef({ onSuccess, onError });
  cb.current = { onSuccess, onError };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-finder/sources");
      const data = await res.json();
      if (data.needsMigration) {
        setNeedsMigration(true);
        return;
      }
      if (data.error) {
        cb.current.onError(data.error);
        return;
      }
      setNeedsMigration(false);
      setSources(data.sources ?? []);
      setDirectory(data.directory ?? []);
      setLiveTenants(data.liveTenants ?? []);
    } catch {
      cb.current.onError("Could not load sources.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/job-finder/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return false;
      }
      onSuccess(okMsg);
      load();
      return true;
    } catch {
      onError("Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!name.trim() || !url.trim()) {
      onError("Name and careers URL are both required.");
      return;
    }
    const ok = await post({ action: "add", name, careers_url: url }, "Source added.");
    if (ok) {
      setName("");
      setUrl("");
    }
  };

  const seedPicked = async () => {
    if (!picked.size) return;
    const ok = await post({ action: "seed", names: [...picked] }, `Added ${picked.size} career page(s).`);
    if (ok) setPicked(new Set());
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/job-finder/sources?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      onSuccess("Source removed.");
      load();
    } catch {
      onError("Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const togglePick = (n: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const visibleDirectory = directory.filter(
    (d) => !d.added && d.name.toLowerCase().includes(dirSearch.trim().toLowerCase())
  );

  if (needsMigration) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex gap-3">
        <FiAlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[var(--admin-text)] text-sm">Database migration needed</p>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1 leading-relaxed">
            Run <code className="px-1 py-0.5 rounded bg-[var(--admin-bg)]">supabase/job_finder.sql</code> in the
            Supabase SQL editor to create the source and listing tables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex gap-3">
        <FiInfo size={16} className="text-sky-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold text-[var(--admin-text)] text-sm">
            Nothing on this page affects “Find jobs” yet
          </p>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1.5 leading-relaxed">
            Sources are a staging list for the crawler in the next phase. Adding one has no effect on search
            results today, so there is no need to add them all — add a company only if you want it queued for
            when the crawler ships.
          </p>
          {liveTenants.length > 0 && (
            <p className="text-xs text-[var(--admin-text-muted)] mt-2 leading-relaxed">
              <span className="font-semibold text-[var(--admin-text)]">Searchable right now</span> (built in, no
              setup needed): {liveTenants.join(", ")}.
            </p>
          )}
        </div>
      </div>

      <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-5">
        <h3 className="font-semibold text-[var(--admin-text)] text-sm mb-1">Add a career page</h3>
        <p className="text-xs text-[var(--admin-text-muted)] mb-4 leading-relaxed">
          Only official company career pages. Job boards that forbid automated access are not supported, and
          nothing here ever submits an application — sources only surface postings for you to review.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://company.com/careers/search?q=SAP"
            className="flex-[2] min-w-[240px] px-3 py-2 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
          />
          <button
            onClick={addManual}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff6b00] text-white text-sm font-semibold hover:bg-[#e55d00] transition-colors disabled:opacity-50"
          >
            <FiPlus size={13} />
            Add
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--admin-text)]">
            Approved sources <span className="text-[var(--admin-text-muted)] font-normal">({sources.length})</span>
          </h3>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {!sources.length ? (
          <div className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-8 text-center">
            <FiGlobe size={24} className="mx-auto text-[var(--admin-text-muted)] mb-2.5" />
            <p className="text-sm text-[var(--admin-text)] font-semibold">No sources yet</p>
            <p className="text-xs text-[var(--admin-text-muted)] mt-1">
              Pick from the verified career-page directory below to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div
                key={s.id}
                className="bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] p-3.5 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--admin-text)] text-sm truncate">{s.name}</p>
                    {s.ats && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]">
                        {s.ats}
                      </span>
                    )}
                    {!s.active && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                        paused
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--admin-text-muted)] truncate mt-0.5">{s.careers_url}</p>
                  <p className="text-[10px] text-[var(--admin-text-muted)] mt-1">
                    {s.last_crawled_at
                      ? `Last checked ${relativeDate(s.last_crawled_at)} · ${s.last_crawl_jobs_found} found`
                      : "Never crawled — the crawler ships in the next phase"}
                    {s.last_crawl_error ? ` · error: ${s.last_crawl_error.slice(0, 60)}` : ""}
                  </p>
                </div>

                <a
                  href={s.careers_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-[#ff6b00] transition-colors"
                  aria-label="Open careers page"
                >
                  <FiExternalLink size={13} />
                </a>
                <button
                  onClick={() => post({ action: "toggle", id: s.id, active: !s.active }, s.active ? "Paused." : "Resumed.")}
                  disabled={busy}
                  className="px-2.5 py-1 rounded-lg border border-[var(--admin-border)] text-[11px] font-semibold text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors disabled:opacity-50"
                >
                  {s.active ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  disabled={busy}
                  className="p-1.5 rounded-lg text-[var(--admin-text-muted)] hover:text-rose-500 transition-colors disabled:opacity-50"
                  aria-label="Remove source"
                >
                  <FiTrash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-[var(--admin-text)]">Verified career-page directory</h3>
          {picked.size > 0 && (
            <button
              onClick={seedPicked}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-[#ff6b00] text-white text-xs font-semibold hover:bg-[#e55d00] transition-colors disabled:opacity-50"
            >
              Add {picked.size} selected
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--admin-text-muted)] mb-3 leading-relaxed">
          Every URL below was fetched and checked by hand. Where a company supports it, the SAP-filtered search
          link is used instead of the generic careers page.
        </p>

        <div className="relative mb-3">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            value={dirSearch}
            onChange={(e) => setDirSearch(e.target.value)}
            placeholder="Filter companies…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[#ff6b00]"
          />
        </div>

        {!visibleDirectory.length ? (
          <p className="text-xs text-[var(--admin-text-muted)] py-4 text-center">
            {dirSearch ? "No companies match that filter." : "Every directory company has been added."}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleDirectory.map((d) => {
              const on = picked.has(d.name);
              return (
                <button
                  key={d.name}
                  onClick={() => togglePick(d.name)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    on
                      ? "border-[#ff6b00] bg-[#ff6b00]/5"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-text-muted)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--admin-text)] text-sm truncate">{d.name}</p>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)] shrink-0">
                      {d.ats}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--admin-text-muted)] truncate mt-1">
                    {d.sap_search_url ?? d.careers_url}
                  </p>
                  {d.account_required && (
                    <p className="text-[10px] text-[var(--admin-text-muted)] mt-1">Account required to apply</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
