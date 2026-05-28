"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiZap,
  FiClock,
  FiAlertTriangle,
  FiStar,
  FiSave,
  FiX,
  FiArchive,
} from "react-icons/fi";

type PersonalNote = {
  id: string;
  body: string;
  tags: string[];
  event_date: string | null;
  remind_before_days: number | null;
  pinned: boolean;
  archived: boolean;
  source: string;
  created_at: string;
  updated_at: string;
};

type AgentResult = {
  markdown: string;
  context: Record<string, unknown>;
  runAt: number;
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (!Number.isFinite(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

function bucketLabel(d: number | null): {
  label: string;
  color: string;
  rank: number;
} {
  if (d === null) return { label: "no date", color: "#555", rank: 5 };
  if (d < 0) return { label: `${-d}d ago`, color: "#f87171", rank: 0 };
  if (d <= 14) return { label: `in ${d}d`, color: "#fb923c", rank: 1 };
  if (d <= 60) return { label: `in ${d}d`, color: "#fbbf24", rank: 2 };
  if (d <= 365) return { label: `in ${d}d`, color: "#34d399", rank: 3 };
  return { label: `in ${d}d`, color: "#60a5fa", rank: 4 };
}

export default function PersonalTab({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");

  const [agentBusy, setAgentBusy] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    try {
      const saved = window.localStorage.getItem("krishna_admin_life_digest");
      if (saved) setAgentResult(JSON.parse(saved));
    } catch {}
  }, []);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/personal/notes", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.notes)) {
      setNotes(j.notes);
    } else if (j.error) {
      onError(j.error);
    }
    setLoading(false);
  }

  async function create() {
    if (!draft.trim()) return;
    setCreating(true);
    const r = await fetch("/api/admin/personal/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: draft.trim(),
        event_date: draftDate || undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setCreating(false);
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    onSuccess("Note saved");
    setDraft("");
    setDraftDate("");
    setNotes((n) => [j.note, ...n]);
  }

  async function patch(id: string, patch: Partial<PersonalNote>) {
    const r = await fetch(`/api/admin/personal/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Update failed");
      return;
    }
    setNotes((arr) => arr.map((n) => (n.id === id ? j.note : n)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const r = await fetch(`/api/admin/personal/notes/${id}`, { method: "DELETE" });
    if (!r.ok) {
      onError("Delete failed");
      return;
    }
    setNotes((arr) => arr.filter((n) => n.id !== id));
    onSuccess("Deleted");
  }

  async function runAgent() {
    setAgentBusy(true);
    setAgentError(null);
    try {
      const r = await fetch("/api/admin/agents/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAgentError(j.error || "Life agent failed");
        onError(j.error || "Life agent failed");
      } else {
        const next: AgentResult = {
          markdown: j.markdown || "",
          context: j.context || {},
          runAt: Date.now(),
        };
        setAgentResult(next);
        try {
          window.localStorage.setItem(
            "krishna_admin_life_digest",
            JSON.stringify(next)
          );
        } catch {}
        onSuccess("Life agent done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setAgentError(msg);
      onError(msg);
    }
    setAgentBusy(false);
  }

  // Group notes by urgency bucket for rendering.
  const grouped = useMemo(() => {
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ra = bucketLabel(daysUntil(a.event_date)).rank;
      const rb = bucketLabel(daysUntil(b.event_date)).rank;
      if (ra !== rb) return ra - rb;
      return (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999");
    });
    return sorted;
  }, [notes]);

  const stats = useMemo(() => {
    let overdue = 0;
    let urgent = 0;
    let soon = 0;
    for (const n of notes) {
      const d = daysUntil(n.event_date);
      if (d === null) continue;
      if (d < 0) overdue++;
      else if (d <= 14) urgent++;
      else if (d <= 60) soon++;
    }
    return { overdue, urgent, soon };
  }, [notes]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Life Cockpit</h2>
        <p className="text-xs text-[#666] mt-1">
          Notepad + agent. Save anything personal (visa dates, flight plans,
          moves, birthdays). The agent reads it all and tells you what needs
          attention this week — plus blind spots you didn't list.
        </p>
      </div>

      {/* Quick add */}
      <div className="rounded-2xl border border-[#ff6b00]/20 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-5 space-y-3">
        <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38]">
          Add to notepad
        </label>
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass + " resize-y leading-relaxed"}
          placeholder={'e.g. "H1B STEM OPT expires May 5" — dates and tags are auto-detected, or fill the date field below'}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-xs text-white"
            title="Override the auto-detected date"
          />
          <span className="text-[10px] text-[#555] font-mono">
            (optional — auto-detected from text otherwise)
          </span>
          <button
            type="button"
            onClick={create}
            disabled={creating || !draft.trim()}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-xs shadow-[0_4px_15px_rgba(255,107,0,0.35)] hover:scale-[1.03] disabled:opacity-60"
          >
            <FiPlus size={12} />
            {creating ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Stats + agent button */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip
            label="Overdue"
            value={stats.overdue}
            color="#f87171"
            urgent={stats.overdue > 0}
          />
          <StatChip label="Urgent ≤14d" value={stats.urgent} color="#fb923c" />
          <StatChip label="Soon ≤60d" value={stats.soon} color="#fbbf24" />
          <StatChip label="Total" value={notes.length} color="#888" />
        </div>
        <button
          type="button"
          onClick={runAgent}
          disabled={agentBusy || notes.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
        >
          <FiZap size={14} />
          {agentBusy ? "Thinking…" : "Run Life agent"}
        </button>
      </div>

      {/* Agent error */}
      {agentError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300/90 flex items-start gap-2">
          <FiAlertTriangle size={12} className="mt-0.5 shrink-0" />
          <p className="break-all">
            <strong>Agent error:</strong> {agentError}
          </p>
        </div>
      )}

      {/* Agent digest */}
      {agentResult && !agentBusy && (
        <div className="rounded-2xl bg-[#0a0a0a] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-widest text-[#666]">
            <FiClock size={10} />
            Last run {timeAgo(agentResult.runAt)}
            {typeof agentResult.context.provider === "string" && (
              <span>· search: {String(agentResult.context.provider)}</span>
            )}
            {typeof agentResult.context.model === "string" && (
              <span>· {String(agentResult.context.model)}</span>
            )}
          </div>
          <Markdown text={agentResult.markdown} />
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white">All notes</h3>
        {loading ? (
          <p className="text-xs text-[#666]">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-xs text-[#666]">Nothing on file yet.</p>
        ) : (
          <ul className="space-y-2">
            {grouped.map((n) => {
              const d = daysUntil(n.event_date);
              const b = bucketLabel(d);
              const isEditing = editing === n.id;
              return (
                <li
                  key={n.id}
                  className="rounded-xl border border-white/[0.05] bg-[#141414] p-4"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className={inputClass + " text-sm"}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-xs text-white"
                        />
                        <button
                          onClick={async () => {
                            await patch(n.id, {
                              body: editBody,
                              event_date: editDate || null,
                            });
                            setEditing(null);
                          }}
                          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff6b00] text-black text-xs font-bold"
                        >
                          <FiSave size={11} />
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs"
                        >
                          <FiX size={11} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {n.pinned && (
                            <FiStar size={11} className="text-[#ff8c38]" />
                          )}
                          <span
                            className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              color: b.color,
                              backgroundColor: b.color + "22",
                              border: `1px solid ${b.color}33`,
                            }}
                          >
                            {b.label}
                          </span>
                          {n.event_date && (
                            <span className="text-[10px] font-mono text-[#666]">
                              {n.event_date}
                            </span>
                          )}
                          {n.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] border border-white/[0.06]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                          {n.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => patch(n.id, { pinned: !n.pinned })}
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${n.pinned ? "text-[#ff8c38]" : "text-[#555] hover:text-white"}`}
                          title={n.pinned ? "Unpin" : "Pin"}
                        >
                          <FiStar size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(n.id);
                            setEditBody(n.body);
                            setEditDate(n.event_date ?? "");
                          }}
                          className="w-8 h-8 rounded-full text-[#555] hover:text-white flex items-center justify-center"
                          title="Edit"
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button
                          onClick={() => patch(n.id, { archived: true })}
                          className="w-8 h-8 rounded-full text-[#555] hover:text-[#888] flex items-center justify-center"
                          title="Archive"
                        >
                          <FiArchive size={12} />
                        </button>
                        <button
                          onClick={() => remove(n.id)}
                          className="w-8 h-8 rounded-full text-[#555] hover:text-red-400 flex items-center justify-center"
                          title="Delete"
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatChip({
  label,
  value,
  color,
  urgent,
}: {
  label: string;
  value: number;
  color: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2 border ${urgent ? "animate-pulse" : ""}`}
      style={{
        borderColor: color + "44",
        backgroundColor: color + "11",
      }}
    >
      <div className="text-lg font-black" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-[#888]">
        {label}
      </div>
    </div>
  );
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Minimal Markdown renderer reused style from AgentsTab. */
function Markdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul
        key={out.length}
        className="list-disc pl-5 my-3 space-y-1.5 text-[13px] text-[#ddd]"
      >
        {listBuffer.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (/^##\s+/.test(line)) {
      out.push(
        <h2
          key={out.length}
          className="text-base font-bold text-white mt-5 first:mt-0 mb-2 border-t border-white/[0.06] pt-4 first:border-0 first:pt-0"
        >
          {renderInline(line.replace(/^##\s+/, ""))}
        </h2>
      );
    } else if (/^###\s+/.test(line)) {
      out.push(
        <h3
          key={out.length}
          className="text-sm font-semibold text-white mt-3 mb-1"
        >
          {renderInline(line.replace(/^###\s+/, ""))}
        </h3>
      );
    } else if (line.trim() === "") {
      // collapse
    } else {
      out.push(
        <p
          key={out.length}
          className="text-[13px] text-[#ddd] my-2 leading-relaxed"
        >
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return <div className="space-y-0">{out}</div>;
}

function renderInline(s: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(s.slice(i));
    const boldMatch = /\*\*([^*]+)\*\*/.exec(s.slice(i));
    let nextIdx = s.length;
    let kind: "link" | "bold" | null = null;
    if (linkMatch && linkMatch.index < nextIdx) {
      nextIdx = linkMatch.index;
      kind = "link";
    }
    if (boldMatch && boldMatch.index < nextIdx) {
      nextIdx = boldMatch.index;
      kind = "bold";
    }
    if (nextIdx > 0) nodes.push(s.slice(i, i + nextIdx));
    if (kind === "link" && linkMatch) {
      nodes.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#ff8c38] hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
      i += nextIdx + linkMatch[0].length;
    } else if (kind === "bold" && boldMatch) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      );
      i += nextIdx + boldMatch[0].length;
    } else {
      i = s.length;
    }
  }
  return <>{nodes}</>;
}
