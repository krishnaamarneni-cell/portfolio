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
  FiMail,
  FiSun,
  FiCheck,
  FiBook,
  FiInfo,
} from "react-icons/fi";
import VoiceMic from "./VoiceMic";

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

      {/* Morning Briefing + Sunday Reflection settings */}
      <MorningBriefingCard onError={onError} onSuccess={onSuccess} />
      <SundayReflectionCard onError={onError} onSuccess={onSuccess} />

      {/* Facts table */}
      <FactsCard onError={onError} onSuccess={onSuccess} />

      {/* Habits */}
      <HabitsCard onError={onError} onSuccess={onSuccess} />

      {/* Reading list */}
      <ReadingCard onError={onError} onSuccess={onSuccess} />

      {/* Quick add */}
      <div className="rounded-2xl border border-[#ff6b00]/20 bg-gradient-to-br from-[#ff6b00]/[0.05] to-transparent p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38]">
            Add to notepad
          </label>
          <VoiceMic
            size="sm"
            onText={(text) =>
              setDraft((d) => (d ? `${d} ${text}` : text))
            }
            onError={(msg) => onError(msg)}
          />
        </div>
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass + " resize-y leading-relaxed"}
          placeholder={'e.g. "H1B STEM OPT expires May 5" — dates and tags are auto-detected. Or tap the mic to talk.'}
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

/* ─────────────────── Morning Briefing card ─────────────────── */

type Settings = {
  morning_briefing_enabled: boolean;
  morning_briefing_to: string | null;
  morning_briefing_last_run_at: string | null;
  morning_briefing_last_status: string | null;
  morning_briefing_last_subject: string | null;
};

function MorningBriefingCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<{
    subject: string;
    lifeMarkdown: string;
    newsMarkdown: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/briefing/settings", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.settings) {
      setSettings(j.settings);
      setRecipient(j.settings.morning_briefing_to ?? "");
    }
    setLoading(false);
  }

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    const r = await fetch("/api/admin/briefing/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    setSettings(j.settings);
    onSuccess("Briefing settings saved");
  }

  async function sendNow() {
    setSending(true);
    const r = await fetch("/api/admin/briefing/send-now", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) {
      onError(j.status || j.error || "Send failed");
    } else {
      onSuccess(j.subject ? `Sent: ${j.subject}` : "Briefing sent");
    }
    void load();
  }

  async function runPreview() {
    setPreviewBusy(true);
    setExpanded(true);
    const r = await fetch("/api/admin/briefing/preview", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setPreviewBusy(false);
    if (!r.ok) {
      onError(j.error || "Preview failed");
      return;
    }
    setPreview({
      subject: j.subject,
      lifeMarkdown: j.lifeMarkdown,
      newsMarkdown: j.newsMarkdown,
    });
  }

  if (loading) return null;

  const enabled = settings?.morning_briefing_enabled ?? false;
  const lastRunAt = settings?.morning_briefing_last_run_at
    ? new Date(settings.morning_briefing_last_run_at)
    : null;
  const lastStatus = settings?.morning_briefing_last_status ?? null;
  const recipientChanged = recipient !== (settings?.morning_briefing_to ?? "");

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] to-transparent p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
          <FiSun size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Morning Briefing</h3>
            {enabled ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                On · 7:00 AM ET
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                Off
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            One daily email with what's overdue, what's coming, blind spots from
            your notes, plus market + AI headlines. Runs via Vercel Cron and
            sends through your Gmail OAuth.
          </p>
          {lastRunAt && (
            <p className="text-[10px] font-mono text-[#666] mt-1">
              Last run {lastRunAt.toLocaleString()} · {lastStatus}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] uppercase tracking-widest text-[#888] hover:text-white px-2 py-1"
        >
          {expanded ? "Hide" : "Configure"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-white">Enabled</p>
              <p className="text-[11px] text-[#666]">
                When on, Vercel Cron triggers /api/cron/morning-briefing daily
                at 11:00 UTC (7:00 ET).
              </p>
            </div>
            <button
              type="button"
              onClick={() => save({ morning_briefing_enabled: !enabled })}
              disabled={saving}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                enabled ? "bg-amber-500" : "bg-white/[0.08]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
              Send to
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="you@gmail.com"
                className={inputClass + " flex-1 text-sm"}
              />
              <button
                type="button"
                onClick={() => save({ morning_briefing_to: recipient || null })}
                disabled={saving || !recipientChanged}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
              >
                <FiSave size={11} />
                Save
              </button>
            </div>
            <p className="text-[10px] text-[#666] mt-1">
              Must be reachable from your connected Gmail account. Usually your
              own primary inbox.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-60"
            >
              <FiZap size={11} />
              {previewBusy ? "Building…" : "Preview now"}
            </button>
            <button
              type="button"
              onClick={sendNow}
              disabled={sending || !settings?.morning_briefing_to}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:scale-[1.03] disabled:opacity-50"
            >
              <FiMail size={11} />
              {sending ? "Sending…" : "Send now"}
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="mt-2 rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2">
                Preview · subject
              </p>
              <p className="text-sm text-white mb-3">{preview.subject}</p>
              <Markdown text={preview.lifeMarkdown} />
              <Markdown text={preview.newsMarkdown} />
            </div>
          )}

          {/* Setup help */}
          <details className="text-[11px] text-[#888]">
            <summary className="cursor-pointer text-[#aaa] hover:text-white">
              Setup checklist
            </summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>
                Reconnect Gmail under <strong className="text-white">Connectors → Gmail</strong> so the new <code>gmail.send</code> scope is granted (re-consent screen).
              </li>
              <li>
                Add <code className="text-amber-300">CRON_SECRET</code> to Vercel env (any long random string). Vercel will use it to authenticate the daily cron call.
              </li>
              <li>
                Make sure <code className="text-amber-300">TAVILY_API_KEY</code> or <code className="text-amber-300">BRAVE_API_KEY</code> is set so the News section has live search.
              </li>
              <li>Set the recipient above, toggle Enabled on, hit <strong className="text-white">Send now</strong> to test.</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Sunday Reflection card ─────────────────── */

function SundayReflectionCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [settings, setSettings] = useState<{
    sunday_reflection_enabled: boolean;
    sunday_reflection_to: string | null;
    sunday_reflection_last_run_at: string | null;
    sunday_reflection_last_status: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; markdown: string } | null>(null);

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/briefing/settings", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.settings) {
      setSettings(j.settings);
      setRecipient(j.settings.sunday_reflection_to ?? j.settings.morning_briefing_to ?? "");
    }
    setLoading(false);
  }
  async function save(patch: Record<string, unknown>) {
    const r = await fetch("/api/admin/briefing/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    setSettings(j.settings);
    onSuccess("Reflection settings saved");
  }
  async function sendNow() {
    setSending(true);
    const r = await fetch("/api/admin/reflection/send-now", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) onError(j.status || j.error || "Send failed");
    else onSuccess(j.subject ? `Sent: ${j.subject}` : "Reflection sent");
    void load();
  }
  async function runPreview() {
    setPreviewBusy(true);
    setExpanded(true);
    const r = await fetch("/api/admin/reflection/preview", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setPreviewBusy(false);
    if (!r.ok) {
      onError(j.error || "Preview failed");
      return;
    }
    setPreview({ subject: j.subject, markdown: j.markdown });
  }

  if (loading) return null;
  const enabled = settings?.sunday_reflection_enabled ?? false;
  const lastRun = settings?.sunday_reflection_last_run_at
    ? new Date(settings.sunday_reflection_last_run_at)
    : null;

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.05] to-transparent p-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
          <FiClock size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Sunday Reflection</h3>
            {enabled ? (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                On · Sun 7:00 PM ET
              </span>
            ) : (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase">
                Off
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            Weekly recap email Sunday evening: what you did, what slipped, next 7
            days, and one thing to focus on.
          </p>
          {lastRun && (
            <p className="text-[10px] font-mono text-[#666] mt-1">
              Last run {lastRun.toLocaleString()} · {settings?.sunday_reflection_last_status}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] uppercase tracking-widest text-[#888] hover:text-white px-2 py-1"
        >
          {expanded ? "Hide" : "Configure"}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Enabled</p>
              <p className="text-[11px] text-[#666]">
                Cron fires <code>0 23 * * 0</code> = Sunday 11pm UTC (7pm ET).
              </p>
            </div>
            <button
              type="button"
              onClick={() => save({ sunday_reflection_enabled: !enabled })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                enabled ? "bg-purple-500" : "bg-white/[0.08]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
              Send to (defaults to morning-briefing address)
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="you@gmail.com"
                className={inputClass + " flex-1 text-sm"}
              />
              <button
                type="button"
                onClick={() => save({ sunday_reflection_to: recipient || null })}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs hover:border-purple-500/40 hover:text-purple-300"
              >
                <FiSave size={11} />
                Save
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs hover:border-purple-500/40 hover:text-purple-300 disabled:opacity-60"
            >
              <FiZap size={11} />
              {previewBusy ? "Building…" : "Preview now"}
            </button>
            <button
              type="button"
              onClick={sendNow}
              disabled={sending}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold shadow-[0_4px_15px_rgba(168,85,247,0.35)] hover:scale-[1.03] disabled:opacity-50"
            >
              <FiMail size={11} />
              {sending ? "Sending…" : "Send now"}
            </button>
          </div>
          {preview && (
            <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.05] p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2">
                Preview · subject
              </p>
              <p className="text-sm text-white mb-3">{preview.subject}</p>
              <Markdown text={preview.markdown} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Facts card ─────────────────── */

type Fact = {
  id: string;
  key: string;
  value: string;
  category: string;
  expires_at: string | null;
};

function FactsCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const [c, setC] = useState("general");
  const [exp, setExp] = useState("");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/facts", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.facts)) setFacts(j.facts);
    setLoading(false);
  }
  async function add() {
    if (!k.trim() || !v.trim()) return;
    const r = await fetch("/api/admin/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: k.trim(),
        value: v.trim(),
        category: c,
        expires_at: exp || undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error || "Save failed");
      return;
    }
    onSuccess(`Fact saved: ${k}`);
    setK("");
    setV("");
    setExp("");
    void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this fact?")) return;
    const r = await fetch(`/api/admin/facts/${id}`, { method: "DELETE" });
    if (r.ok) {
      void load();
      onSuccess("Deleted");
    }
  }

  if (loading) return null;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0">
          <FiInfo size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Facts</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase font-mono">
              {facts.length}
            </span>
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            Always-on memory. Every agent (chat, news, jobs, life, briefings)
            auto-loads these into its system prompt.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[#888] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
          {/* Add form */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_120px_140px_auto] gap-2 items-end">
            <input
              value={k}
              onChange={(e) => setK(e.target.value)}
              placeholder="key (e.g. visa_status)"
              className={inputClass + " text-xs"}
            />
            <input
              value={v}
              onChange={(e) => setV(e.target.value)}
              placeholder="value (e.g. H1B STEM OPT)"
              className={inputClass + " text-xs"}
            />
            <select
              value={c}
              onChange={(e) => setC(e.target.value)}
              className={inputClass + " text-xs"}
            >
              {[
                "general",
                "visa",
                "location",
                "family",
                "work",
                "health",
                "preferences",
                "finance",
              ].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              className={inputClass + " text-xs"}
              title="Expires at"
            />
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs hover:bg-cyan-500/25"
            >
              <FiPlus size={11} />
              Add
            </button>
          </div>

          {/* List */}
          {facts.length === 0 ? (
            <p className="text-xs text-[#666]">
              No facts yet. Try keys like <code>visa_status</code>,{" "}
              <code>location_current</code>, <code>wife_birthday</code>,{" "}
              <code>diet</code>.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {facts.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-[#888] border border-white/[0.06]">
                    {f.category}
                  </span>
                  <span className="text-xs font-mono text-cyan-300 shrink-0">
                    {f.key}:
                  </span>
                  <span className="text-xs text-white flex-1 min-w-0 truncate">
                    {f.value}
                  </span>
                  {f.expires_at && (
                    <span className="text-[10px] font-mono text-[#888]">
                      exp {f.expires_at}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="w-7 h-7 rounded-md text-[#555] hover:text-red-400 flex items-center justify-center"
                  >
                    <FiTrash2 size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Habits card ─────────────────── */

type HabitRow = {
  id: string;
  name: string;
  emoji: string | null;
  streak: number;
  checkins: Record<string, boolean>;
};

function HabitsCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/habits", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.habits)) setHabits(j.habits);
    setLoading(false);
  }
  async function add() {
    if (!name.trim()) return;
    const r = await fetch("/api/admin/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), emoji: emoji.trim() || undefined }),
    });
    if (r.ok) {
      onSuccess("Habit added");
      setName("");
      setEmoji("");
      void load();
    } else onError("Failed");
  }
  async function toggle(id: string) {
    const r = await fetch("/api/admin/habits/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habit_id: id }),
    });
    if (r.ok) void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this habit and its history?")) return;
    await fetch(`/api/admin/habits/${id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return null;
  const today = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
          <FiCheck size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Habits</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase font-mono">
              {habits.length}
            </span>
            {habits.some((h) => h.checkins[today]) && (
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {habits.filter((h) => h.checkins[today]).length}/{habits.length} today
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            Daily checkboxes. Streaks counted backward from today. Feeds the Sunday
            Reflection.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[#888] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              placeholder="🏃"
              className="w-16 text-center px-2 py-2 rounded-xl bg-[#0f0f0f] border border-white/[0.08] focus:outline-none text-sm"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New habit (e.g. 'Workout', 'Write 200 words')"
              className={inputClass + " flex-1 text-sm"}
            />
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs hover:bg-emerald-500/25"
            >
              <FiPlus size={11} />
              Add
            </button>
          </div>

          {habits.length === 0 ? (
            <p className="text-xs text-[#666]">No habits yet.</p>
          ) : (
            <ul className="space-y-2">
              {habits.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      h.checkins[today]
                        ? "bg-emerald-500 text-black"
                        : "bg-white/[0.04] border border-white/[0.1] text-[#666] hover:border-emerald-500/40"
                    }`}
                    title="Toggle today"
                  >
                    <FiCheck size={12} />
                  </button>
                  <span className="text-sm shrink-0">{h.emoji || "•"}</span>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">
                    {h.name}
                  </span>
                  <div className="hidden sm:flex items-center gap-0.5">
                    {last7.map((d) => (
                      <span
                        key={d}
                        title={d}
                        className={`w-3 h-3 rounded-sm ${
                          h.checkins[d]
                            ? "bg-emerald-500"
                            : "bg-white/[0.06]"
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${h.streak > 0 ? "text-amber-300" : "text-[#555]"}`}
                  >
                    🔥 {h.streak}d
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(h.id)}
                    className="w-7 h-7 rounded-md text-[#555] hover:text-red-400 flex items-center justify-center"
                  >
                    <FiTrash2 size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Reading card ─────────────────── */

type Reading = {
  id: string;
  title: string;
  author: string | null;
  status: "wishlist" | "reading" | "done" | "abandoned";
  rating: number | null;
  notes: string | null;
};

function ReadingCard({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [items, setItems] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<Reading["status"]>("reading");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/reading", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.items)) setItems(j.items);
    setLoading(false);
  }
  async function add() {
    if (!title.trim()) return;
    const r = await fetch("/api/admin/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        author: author.trim() || undefined,
        status,
      }),
    });
    if (r.ok) {
      onSuccess("Added");
      setTitle("");
      setAuthor("");
      void load();
    } else onError("Failed");
  }
  async function patch(id: string, patch: Partial<Reading>) {
    await fetch(`/api/admin/reading/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this book?")) return;
    await fetch(`/api/admin/reading/${id}`, { method: "DELETE" });
    void load();
  }

  if (loading) return null;
  const grouped: Record<Reading["status"], Reading[]> = {
    reading: [],
    wishlist: [],
    done: [],
    abandoned: [],
  };
  for (const i of items) grouped[i.status].push(i);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-pink-500/15 text-pink-300 flex items-center justify-center shrink-0">
          <FiBook size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white">Reading</h3>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] text-[#999] border border-white/10 uppercase font-mono">
              {items.length}
            </span>
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-300 border border-pink-500/20 uppercase">
              {grouped.reading.length} reading
            </span>
          </div>
          <p className="text-[11px] text-[#888] mt-1">
            Wishlist · Reading · Done. Quick notes per book. You wrote one —
            track what you're reading next.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[#888] px-2 py-1">
          {expanded ? "Hide" : "Open"}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
          {/* Add */}
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_140px_auto] gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className={inputClass + " text-sm"}
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (optional)"
              className={inputClass + " text-sm"}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Reading["status"])}
              className={inputClass + " text-sm"}
            >
              <option value="wishlist">Wishlist</option>
              <option value="reading">Reading</option>
              <option value="done">Done</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs hover:bg-pink-500/25"
            >
              <FiPlus size={11} />
              Add
            </button>
          </div>

          {(["reading", "wishlist", "done", "abandoned"] as const).map((s) => {
            const list = grouped[s];
            if (list.length === 0) return null;
            return (
              <div key={s}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-1.5">
                  {s} ({list.length})
                </p>
                <ul className="space-y-1.5">
                  {list.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{b.title}</p>
                        {b.author && (
                          <p className="text-[10px] text-[#666] truncate">
                            by {b.author}
                          </p>
                        )}
                      </div>
                      <select
                        value={b.status}
                        onChange={(e) => patch(b.id, { status: e.target.value as Reading["status"] })}
                        className="shrink-0 px-2 py-1 rounded-md bg-[#0a0a0a] border border-white/[0.08] text-[10px] text-white"
                      >
                        <option value="wishlist">Wishlist</option>
                        <option value="reading">Reading</option>
                        <option value="done">Done</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                      {b.status === "done" && (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => patch(b.id, { rating: n })}
                              className={n <= (b.rating ?? 0) ? "text-amber-300" : "text-[#444] hover:text-[#888]"}
                            >
                              <FiStar size={10} fill={n <= (b.rating ?? 0) ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(b.id)}
                        className="w-7 h-7 rounded-md text-[#555] hover:text-red-400 flex items-center justify-center"
                      >
                        <FiTrash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
