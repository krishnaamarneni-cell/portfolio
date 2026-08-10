"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { FiX, FiSearch, FiChevronLeft, FiChevronRight, FiLoader } from "react-icons/fi";

type MaterialRow = { material: string; description: string };

const PAGE_SIZE = 20;

export default function MaterialBrowser({
  onSelect,
  onClose,
}: {
  onSelect: (material: string) => void;
  onClose: () => void;
}) {
  const [materials, setMaterials] = useState<MaterialRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    let cancelled = false;
    fetch("/api/sap/materials")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setMaterials(json.materials ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error — couldn't load the material catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!materials) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return materials;
    return materials.filter(
      (m) =>
        m.description.toLowerCase().includes(needle) ||
        m.material.toLowerCase().includes(needle),
    );
  }, [materials, query]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] mt-8 sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Browse materials
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {materials
                ? `${materials.length.toLocaleString()} materials in the sandbox catalog`
                : "Loading catalog…"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors shrink-0"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-5 py-3 border-b border-[var(--border)]">
          <div className="relative">
            <FiSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or material number…"
              className="w-full rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-[240px]">
          {error && (
            <div className="p-5 text-sm text-[#f59e0b]">{error}</div>
          )}
          {!error && !materials && (
            <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)] text-sm">
              <FiLoader size={16} className="animate-spin" />
              Loading catalog…
            </div>
          )}
          {!error && materials && filtered.length === 0 && (
            <div className="p-5 text-sm text-[var(--text-muted)]">
              No materials match &ldquo;{query}&rdquo;.
            </div>
          )}
          {!error && materials && pageRows.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <tbody>
                {pageRows.map((m) => (
                  <tr
                    key={m.material}
                    onClick={() => onSelect(m.material)}
                    className="border-b border-[var(--border)] last:border-b-0 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="py-2.5 pl-5 pr-2 font-mono text-xs text-[var(--accent)] whitespace-nowrap w-1">
                      {m.material}
                    </td>
                    <td className="py-2.5 pr-5 text-[var(--text-secondary)]">
                      {m.description || <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!error && materials && filtered.length > PAGE_SIZE && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <FiChevronLeft size={14} />
              </button>
              <span className="px-2 font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
