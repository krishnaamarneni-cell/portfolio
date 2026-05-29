"use client";

import { useEffect, useState } from "react";
import {
  FiZap,
  FiCheck,
  FiX,
  FiClock,
  FiInfo,
  FiAlertCircle,
} from "react-icons/fi";

type Suggestion = {
  id: string;
  source_kind: "chat" | "note" | "manual";
  source_id: string | null;
  suggested_kind: "fact" | "note";
  suggested_data: Record<string, unknown>;
  confidence: number | null;
  reasoning: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type ScanReport = {
  scanned: { chats: number; notes: number };
  suggestionsCreated: number;
  skippedDuplicates: number;
  windowStart: string;
  model: string;
};

export default function MemoryAgentCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastReport, setLastReport] = useState<ScanReport | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/memory/suggestions?status=pending", {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.suggestions)) {
      setSuggestions(j.suggestions);
    }
    setLoading(false);
  }

  async function scan() {
    setScanning(true);
    const r = await fetch("/api/admin/agents/memory/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: false }),
    });
    const j = await r.json().catch(() => ({}));
    setScanning(false);
    if (!r.ok) {
      onError(j.error || "Scan failed");
      return;
    }
    setLastReport(j as ScanReport);
    onSuccess(
      `Memory scan: ${j.suggestionsCreated} new suggestion${j.suggestionsCreated === 1 ? "" : "s"}`
    );
    void load();
    setExpanded(true);
  }

  async function accept(s: Suggestion, override?: Record<string, unknown>) {
    const r = await fetch(`/api/admin/memory/suggestions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", data: override }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Could not accept");
      return;
    }
    onSuccess(
      s.suggested_kind === "fact" ? "Added to facts" : "Added to notes"
    );
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
  }

  async function reject(s: Suggestion) {
    const r = await fetch(`/api/admin/memory/suggestions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (r.ok) {
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.05] to-transparent p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center shrink-0">
          <FiZap size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Memory agent</h3>
            {suggestions.length > 0 ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 uppercase">
                {suggestions.length} pending
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                Clean
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888] mt-1 leading-relaxed">
            Reads your recent chats + notes. Surfaces things worth remembering
            — dates, decisions, facts. Nothing is added without your tap.
          </p>
          {lastReport && (
            <p className="text-[10px] font-mono text-[#666] mt-1">
              last scan: {lastReport.scanned.chats} chats · {lastReport.scanned.notes} notes ·{" "}
              {lastReport.suggestionsCreated} new
              {lastReport.skippedDuplicates > 0 ? ` · ${lastReport.skippedDuplicates} dupes` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={scanning}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(217,70,239,0.35)] hover:scale-[1.03] disabled:opacity-60"
        >
          <FiZap size={11} />
          {scanning ? "Scanning…" : "Scan now"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-4 text-[10px] uppercase tracking-widest text-fuchsia-300/80 hover:text-fuchsia-200"
          >
            {expanded ? "Hide pending" : "Review pending"} →
          </button>
          {expanded && (
            <ul className="mt-3 space-y-2">
              {suggestions.map((s) => (
                <SuggestionRow
                  key={s.id}
                  s={s}
                  onAccept={accept}
                  onReject={reject}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionRow({
  s,
  onAccept,
  onReject,
}: {
  s: Suggestion;
  onAccept: (s: Suggestion, override?: Record<string, unknown>) => void;
  onReject: (s: Suggestion) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(s.suggested_data);

  const isFact = s.suggested_kind === "fact";
  const data = editing ? draft : (s.suggested_data as Record<string, unknown>);
  const confidence = s.confidence ?? 0;

  return (
    <li className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md border uppercase ${
              isFact
                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            }`}
          >
            {isFact ? "Fact" : "Note"}
          </span>
          <span
            className={`text-[10px] font-mono ${
              confidence >= 0.8
                ? "text-emerald-300"
                : confidence >= 0.6
                ? "text-amber-300"
                : "text-[#888]"
            }`}
          >
            {(confidence * 100).toFixed(0)}% sure
          </span>
          <span className="text-[10px] font-mono text-[#555]">
            from {s.source_kind}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] uppercase tracking-widest text-[#888] hover:text-white px-2 py-1"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => onReject(s)}
            className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#888] hover:text-red-400 hover:border-red-500/30 flex items-center justify-center"
            title="Reject"
          >
            <FiX size={11} />
          </button>
          <button
            type="button"
            onClick={() => onAccept(s, editing ? draft : undefined)}
            className="w-7 h-7 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/25 flex items-center justify-center"
            title={isFact ? "Add to facts" : "Add to notes"}
          >
            <FiCheck size={11} />
          </button>
        </div>
      </div>

      {/* Editable payload */}
      {editing ? (
        isFact ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_140px_140px] gap-1.5">
            <input
              value={String(draft.key ?? "")}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="key"
              className={editInputClass}
            />
            <input
              value={String(draft.value ?? "")}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
              placeholder="value"
              className={editInputClass}
            />
            <input
              value={String(draft.category ?? "")}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              placeholder="category"
              className={editInputClass}
            />
            <input
              type="date"
              value={String(draft.expires_at ?? "")}
              onChange={(e) =>
                setDraft((d) => ({ ...d, expires_at: e.target.value || undefined }))
              }
              className={editInputClass}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <textarea
              value={String(draft.body ?? "")}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              rows={2}
              className={editInputClass + " resize-y"}
            />
            <div className="flex gap-1.5">
              <input
                value={
                  Array.isArray(draft.tags)
                    ? (draft.tags as string[]).join(", ")
                    : ""
                }
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    tags: e.target.value
                      .split(",")
                      .map((s) => s.trim().toLowerCase())
                      .filter(Boolean),
                  }))
                }
                placeholder="tags (comma-separated)"
                className={editInputClass + " flex-1"}
              />
              <input
                type="date"
                value={String(draft.event_date ?? "")}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, event_date: e.target.value || undefined }))
                }
                className={editInputClass + " w-40"}
              />
            </div>
          </div>
        )
      ) : (
        <div className="text-[13px] text-white leading-relaxed">
          {isFact ? (
            <>
              <code className="text-cyan-300">{String(data.key)}</code>:{" "}
              <span>{String(data.value)}</span>
              {data.category ? (
                <span className="text-[10px] text-[#666] ml-2">
                  [{String(data.category)}]
                </span>
              ) : null}
              {data.expires_at ? (
                <span className="text-[10px] text-amber-300 ml-2">
                  expires {String(data.expires_at)}
                </span>
              ) : null}
            </>
          ) : (
            <>
              <p>{String(data.body)}</p>
              {Array.isArray(data.tags) && (data.tags as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(data.tags as string[]).map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] border border-white/[0.06]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {data.event_date ? (
                <p className="text-[10px] text-amber-300 mt-1 font-mono">
                  {String(data.event_date)}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}

      {s.reasoning && (
        <p className="text-[11px] text-[#888] flex items-start gap-1.5 leading-relaxed">
          <FiInfo size={10} className="mt-0.5 shrink-0" />
          <span>{s.reasoning}</span>
        </p>
      )}
    </li>
  );
}

const editInputClass =
  "w-full px-3 py-1.5 rounded-lg bg-[#141414] border border-white/[0.08] focus:border-fuchsia-500/40 focus:outline-none text-xs text-white";
