"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { FiX, FiSearch, FiChevronLeft, FiChevronRight, FiLoader, FiLayers } from "react-icons/fi";

type MaterialRow = {
  material: string;
  description: string;
  productType: string;
  hasStock: boolean;
  hasBOM: boolean;
};

const PAGE_SIZE = 20;

/** SAP material types (MTART). Verified live across the sandbox catalog. */
const TYPE_LABELS: Record<string, string> = {
  FERT: "Finished good",
  HALB: "Semi-finished",
  ROH: "Raw material",
  HAWA: "Trading good",
  SERV: "Service",
  VERP: "Packaging",
  HIBE: "Operating supply",
  ERSA: "Spare part",
  KMAT: "Configurable",
  UNBW: "Non-valuated",
  NLAG: "Non-stock",
  LEIH: "Returnable pkg",
  PIPE: "Pipeline",
  VEHI: "Vehicle",
};

/** Colour-coded so the make-vs-buy distinction reads at a glance. */
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  FERT: { bg: "rgba(34,197,94,0.14)", fg: "#22c55e" },
  HALB: { bg: "rgba(59,130,246,0.14)", fg: "#3b82f6" },
  ROH: { bg: "rgba(245,158,11,0.14)", fg: "#f59e0b" },
  HAWA: { bg: "rgba(168,85,247,0.14)", fg: "#a855f7" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "FERT", label: "Finished" },
  { key: "HALB", label: "Semi-finished" },
  { key: "ROH", label: "Raw" },
  { key: "bom", label: "Has BOM" },
];

function TypeBadge({ type }: { type: string }) {
  if (!type) return null;
  const c = TYPE_COLORS[type] ?? { bg: "rgba(148,163,184,0.14)", fg: "#94a3b8" };
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
      title={TYPE_LABELS[type] ?? type}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export default function MaterialBrowser({
  onSelect,
  onClose,
}: {
  onSelect: (material: string, hasBOM: boolean) => void;
  onClose: () => void;
}) {
  const [materials, setMaterials] = useState<MaterialRow[] | null>(null);
  const [totalInCatalog, setTotalInCatalog] = useState<number | null>(null);
  const [withBOM, setWithBOM] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
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
          setTotalInCatalog(json.totalInCatalog ?? null);
          setWithBOM(json.withBOM ?? null);
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
    return materials.filter((m) => {
      if (typeFilter === "bom" && !m.hasBOM) return false;
      if (typeFilter !== "all" && typeFilter !== "bom" && m.productType !== typeFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        m.description.toLowerCase().includes(needle) ||
        m.material.toLowerCase().includes(needle)
      );
    });
  }, [materials, query, typeFilter]);

  useEffect(() => {
    setPage(0);
  }, [query, typeFilter]);

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
                ? `${materials.length.toLocaleString()} with live data${
                    withBOM ? ` · ${withBOM.toLocaleString()} have a BOM` : ""
                  }${
                    totalInCatalog
                      ? ` (of ${totalInCatalog.toLocaleString()} in master data)`
                      : ""
                  }`
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

          {/* Type filters — finished vs raw is the make-or-buy distinction */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {FILTERS.map((f) => {
              const active = typeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors border ${
                    active
                      ? "bg-[var(--accent)] text-black border-[var(--accent)] font-medium"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
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
              No materials match {query ? `“${query}”` : "this filter"}.
            </div>
          )}
          {!error && materials && pageRows.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <tbody>
                {pageRows.map((m) => (
                  <tr
                    key={m.material}
                    onClick={() => onSelect(m.material, m.hasBOM)}
                    title={
                      m.hasBOM
                        ? "Has a bill of materials — opens its components"
                        : "Opens its stock levels"
                    }
                    className="border-b border-[var(--border)] last:border-b-0 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="py-2.5 pl-5 pr-2 font-mono text-xs text-[var(--accent)] whitespace-nowrap align-top w-1">
                      {m.material}
                    </td>
                    <td className="py-2.5 pr-2 text-[var(--text-secondary)]">
                      {m.description || <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="py-2.5 pr-5 text-right whitespace-nowrap align-top w-1">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.hasBOM && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
                            style={{ background: "rgba(255,107,0,0.14)", color: "var(--accent)" }}
                            title="Has a bill of materials"
                          >
                            <FiLayers size={9} /> BOM
                          </span>
                        )}
                        <TypeBadge type={m.productType} />
                      </div>
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
